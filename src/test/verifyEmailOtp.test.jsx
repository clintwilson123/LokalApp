import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The OTP verification flow. The server decides everything: verifyOtp()
// validates the six digits, the session it creates is adopted just long
// enough for the profile row, then released — verification never logs
// anyone in. Every branch of that hand-off is pinned here, including the
// unrelated-session snapshot/restore and the hard fallback for a signOut
// that will not go through.

const h = vi.hoisted(() => ({
  token: 'valid-token',
  reset: vi.fn(),
  remove: vi.fn(),
  configured: true,
  resend: vi.fn(),
  verifyOtp: vi.fn(),
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

vi.mock('../lib/turnstile', () => ({
  isTurnstileConfigured: () => h.configured,
  getTurnstileSiteKey: () => 'test-site-key',
  renderTurnstile: vi.fn(() =>
    Promise.resolve({
      getToken: () => h.token,
      reset: h.reset,
      remove: h.remove,
    })
  ),
  loadTurnstileScript: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      resend: (...args) => h.resend(...args),
      verifyOtp: (...args) => h.verifyOtp(...args),
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

// Stands in for /login and reports what the hand-off carried.
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

async function typeAndSubmit(code) {
  fireEvent.change(screen.getByLabelText(/verification code/i), {
    target: { value: code },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }));
  });
}

const VERIFY_SUCCESS = {
  data: { session: { user: { email: 'ana@gmail.com' } }, error: null },
};

beforeEach(() => {
  h.configured = true;
  h.token = 'valid-token';
  h.reset.mockClear();
  h.remove.mockClear();
  h.resend.mockReset();
  h.verifyOtp.mockReset();
  h.getSession.mockReset();
  // Default: nothing signed in. Tests that need a snapshot chain override
  // with mockResolvedValueOnce, which takes precedence over this fallback.
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

afterEach(() => {
  vi.useRealTimers();
});

describe('VerifyEmail — OTP verification', () => {
  it('blocks a short code before any network call and never claims success', async () => {
    seedPending();
    renderVerify();
    await act(async () => {});

    await typeAndSubmit('123');

    expect(await screen.findByText(/Enter the 6-digit verification code/i)).toBeInTheDocument();
    expect(h.verifyOtp).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
    // The old self-claim button is gone; only a server-accepted code confirms.
    expect(screen.queryByRole('button', { name: /i've confirmed my email/i })).toBeNull();
    expect(screen.getByText('Email Verified!')).toHaveStyle({ opacity: '0' });
  });

  it('confirms server-side, adopts the profile, releases the session, and hands off to a manual sign-in', async () => {
    seedPending();
    // Snapshot before verify, then the post-cleanup check.
    h.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: null } });
    h.verifyOtp.mockResolvedValue(VERIFY_SUCCESS);
    h.auth.refreshSession.mockResolvedValue({ email: 'ana@gmail.com' });
    h.signOut.mockResolvedValue({ error: null });

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    // Server-side validation, with the address and the typed code.
    expect(h.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@gmail.com',
      token: '123456',
      type: 'signup',
    });
    // Order: validate -> adopt the profile row while the session exists ->
    // release the session. Verification ends signed OUT.
    expect(h.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      h.auth.refreshSession.mock.invocationCallOrder[0]
    );
    expect(h.auth.refreshSession.mock.invocationCallOrder[0]).toBeLessThan(
      h.signOut.mock.invocationCallOrder[0]
    );
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(h.setSession).not.toHaveBeenCalled();

    // The pending address is retired; the signup marker is deliberately KEPT
    // until AuthContext.ensureProfile really inserted the row (a mocked
    // refreshSession never runs it here — the marker is its to consume).
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-signup')).not.toBeNull();

    // Hand-off: /login, success notice, no auto-login.
    expect(screen.getByText(/^LOGIN_PAGE\|/)).toHaveTextContent(AUTH_MSG.verifiedSuccess);
  });

  it('an expired code is reported as expired — nothing signed out, pending state intact', async () => {
    seedPending();
    h.verifyOtp.mockResolvedValue({
      error: { code: 'otp_expired', message: 'Token has expired', status: 400 },
    });

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    expect(await screen.findByText(/That code has expired/i)).toBeInTheDocument();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.auth.refreshSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/^LOGIN_PAGE\|/)).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBe(
      'ana@gmail.com'
    );
  });

  it('a connectivity failure is the network message, never a bad code', async () => {
    seedPending();
    h.verifyOtp.mockRejectedValue(new TypeError('Failed to fetch'));

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    expect(await screen.findByText(/Could not reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/incorrect or has expired/i)).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('an address GoTrue says is already confirmed goes straight to sign-in with the reason', async () => {
    seedPending();
    h.verifyOtp.mockResolvedValue({
      error: { code: '', message: 'User already confirmed', status: 400 },
    });

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    expect(screen.getByText(/^LOGIN_PAGE\|/)).toHaveTextContent(AUTH_MSG.alreadyVerified);
    // verifyOtp never created a session, so there is nothing to release.
    expect(h.signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
  });

  it('an unrelated signed-in account is put back after the verified session is released', async () => {
    seedPending();
    const foreign = {
      access_token: 'foreign-at',
      refresh_token: 'foreign-rt',
      user: { email: 'other@gmail.com' },
    };
    // Snapshot shows the other account; post-cleanup storage is empty.
    h.getSession
      .mockResolvedValueOnce({ data: { session: foreign } })
      .mockResolvedValueOnce({ data: { session: null } });
    h.verifyOtp.mockResolvedValue(VERIFY_SUCCESS);
    h.auth.refreshSession.mockResolvedValue({ email: 'ana@gmail.com' });
    h.signOut.mockResolvedValue({ error: null });
    h.setSession.mockResolvedValue({ data: { session: foreign }, error: null });

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    // Released first, restored second — in that order.
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(h.setSession).toHaveBeenCalledWith({
      access_token: 'foreign-at',
      refresh_token: 'foreign-rt',
    });
    expect(h.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      h.setSession.mock.invocationCallOrder[0]
    );
    expect(screen.getByText(/^LOGIN_PAGE\|/)).toHaveTextContent(AUTH_MSG.verifiedSuccess);
  });

  it('when signOut keeps failing, the stored session is wiped and the success message rides the flash', async () => {
    seedPending();
    window.localStorage.setItem(
      'sb-test-auth-token',
      JSON.stringify({ currentSession: { access_token: 'leftover' } })
    );
    h.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { user: { email: 'ana@gmail.com' } } } });
    h.verifyOtp.mockResolvedValue(VERIFY_SUCCESS);
    h.auth.refreshSession.mockResolvedValue({ email: 'ana@gmail.com' });
    h.signOut.mockResolvedValue({ error: { message: 'network down' } });

    renderVerify();
    await act(async () => {});
    await typeAndSubmit('123456');

    // Initial attempt plus three retried ones — then the hard fallback
    // (short real delays: 100 + 200 + 400 ms) wipes the persisted keys.
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(4), { timeout: 3000 });
    await waitFor(
      () =>
        expect(
          window.sessionStorage.getItem('cjlink:login-flash') ||
            window.localStorage.getItem('cjlink:login-flash')
        ).toBeTruthy(),
      { timeout: 3000 }
    );
    // Flush the trailing setLoading that follows the fallback.
    await act(async () => {});

    // Persisted session keys are gone…
    expect(window.localStorage.getItem('sb-test-auth-token')).toBeNull();
    // …and the one-shot flash carries the message across the reload.
    const flash = JSON.parse(
      window.sessionStorage.getItem('cjlink:login-flash') ||
        window.localStorage.getItem('cjlink:login-flash')
    );
    expect(flash.email).toBe('ana@gmail.com');
    // No in-app hand-off happened — the reload owns that.
    expect(screen.queryByText(/^LOGIN_PAGE\|/)).toBeNull();
  });
});
