import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The ROLLBACK build: VITE_OTP_ENABLED is explicitly "false", so
// /verify-email shows the confirmation-LINK panel instead of the 6-digit
// code box. The link flow stays available while the Send Email hook / EmailJS
// delivery is not confirmed working — and the "I clicked the link" button is
// a SERVER recheck (getUser), never a self-claim.

const h = vi.hoisted(() => ({
  resend: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  setSession: vi.fn(),
  auth: {
    user: null,
    profile: null,
    loading: false,
    refreshSession: vi.fn(),
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resend: (...args) => h.resend(...args),
      verifyOtp: vi.fn(),
      getUser: (...args) => h.getUser(...args),
      getSession: (...args) => h.getSession(...args),
      signOut: (...args) => h.signOut(...args),
      setSession: (...args) => h.setSession(...args),
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import VerifyEmail from '../pages/VerifyEmail';
import { AUTH_MSG } from '../lib/authErrors';

function LoginSpy() {
  const location = useLocation();
  return (
    <div>
      LOGIN_PAGE|{String(location.state?.notice || '')}
    </div>
  );
}

function renderVerify(state = { email: 'ana@gmail.com', accountCreated: true }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-email', state }]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/login" element={<LoginSpy />} />
        <Route path="/signup" element={<div>SIGNUP_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function seedPending() {
  window.localStorage.setItem('cjlink:pending-verification-email', 'ana@gmail.com');
  window.localStorage.setItem(
    'cjlink:pending-signup',
    JSON.stringify({ email: 'ana@gmail.com', riskLevel: 'low', at: Date.now() })
  );
}

beforeEach(() => {
  // The rollback (link) panel is the subject under test here.
  vi.stubEnv('VITE_OTP_ENABLED', 'false');
  h.resend.mockReset();
  h.getUser.mockReset();
  h.getSession.mockReset();
  h.getSession.mockResolvedValue({ data: { session: null } });
  h.signOut.mockReset();
  h.setSession.mockReset();
  h.auth = {
    user: null,
    profile: null,
    loading: false,
    refreshSession: vi.fn(),
  };
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('VerifyEmail — confirmation-LINK panel (safe build)', () => {
  it('shows the link instructions and NO 6-digit code box', async () => {
    seedPending();
    renderVerify();
    await act(async () => {});

    expect(screen.getByText(new RegExp(AUTH_MSG.verifyLinkInstructions.slice(0, 30)))).toBeInTheDocument();
    expect(screen.queryByLabelText(/verification code/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /verify email/i })).toBeNull();
    // The old self-claim button is gone; this one only asks the server.
    expect(screen.queryByRole('button', { name: /i've confirmed my email/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /i[’']ve clicked the confirmation link/i })
    ).toBeInTheDocument();
  });

  it('a recheck on an UNCONFIRMED address stays on the panel — nothing is marked verified', async () => {
    seedPending();
    h.getUser.mockResolvedValue({
      data: { user: { email: 'ana@gmail.com', email_confirmed_at: null } },
      error: null,
    });

    renderVerify();
    await act(async () => {});
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /i[’']ve clicked the confirmation link/i })
      );
    });

    expect(await screen.findByText(/not confirmed yet/i)).toBeInTheDocument();
    // The success overlay stays closed: its Sign In affordance only appears
    // once the SERVER confirmed the address.
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
    expect(screen.queryByText(/^LOGIN_PAGE\|/)).toBeNull();
  });

  it('a recheck on a SERVER-CONFIRMED address shows success and hands off to sign-in', async () => {
    seedPending();
    h.getUser.mockResolvedValue({
      data: {
        user: {
          email: 'ana@gmail.com',
          email_confirmed_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    });

    renderVerify();
    await act(async () => {});
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /i[’']ve clicked the confirmation link/i })
      );
    });

    // The success-driven state is what flips the overlay on: the Sign In
    // hand-off button only exists after getUser() agreed, and the caption
    // switches away from "Redirecting to your dashboard...".
    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByText('You can now sign in to your account.')).toBeInTheDocument();
    // Only the server's own confirmation state flipped this — getUser was the
    // sole source, and nothing wrote email_verified itself.
    expect(h.getUser).toHaveBeenCalledTimes(1);
    // The pending address is retired once the server agreed.
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });
    expect(screen.getByText(/^LOGIN_PAGE\|/)).toHaveTextContent(AUTH_MSG.verifiedSuccess);
  });

  it('a confirmed DIFFERENT account on this device never verifies the pending address', async () => {
    seedPending();
    h.getUser.mockResolvedValue({
      data: {
        user: {
          email: 'someone.else@gmail.com',
          email_confirmed_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    });

    renderVerify();
    await act(async () => {});
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /i[’']ve clicked the confirmation link/i })
      );
    });

    expect(await screen.findByText(/not confirmed yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
  });

  it('a recheck network failure is reported as a check failure, never as success', async () => {
    seedPending();
    h.getUser.mockRejectedValue(new TypeError('Failed to fetch'));

    renderVerify();
    await act(async () => {});
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /i[’']ve clicked the confirmation link/i })
      );
    });

    expect(await screen.findByText(/could not check your confirmation status/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
  });

  it('resends with no CAPTCHA token and reports the link wording on success', async () => {
    vi.useFakeTimers();
    seedPending();
    h.resend.mockResolvedValue({ error: null });

    renderVerify();
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });

    fireEvent.click(
      screen.getByRole('button', { name: /resend confirmation email/i })
    );
    await act(async () => {});

    expect(h.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ana@gmail.com',
    });
    expect(screen.getByText(/confirmation email sent again/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('a failed resend reports the delivery message — never the raw server text', async () => {
    vi.useFakeTimers();
    seedPending();
    h.resend.mockResolvedValue({
      error: { code: '', message: 'hook 500 at send-auth-email' },
    });

    renderVerify();
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });

    fireEvent.click(
      screen.getByRole('button', { name: /resend confirmation email/i })
    );
    await act(async () => {});

    expect(screen.getByText(/couldn't send the verification email/i)).toBeInTheDocument();
    expect(screen.queryByText(/send-auth-email/)).toBeNull();
    vi.useRealTimers();
  });
});
