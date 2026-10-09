import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Password reset and confirmation-resend are both captcha-protected GoTrue
// routes (/recover, /resend), so both screens must supply a token.

const h = vi.hoisted(() => ({
  token: 'valid-token',
  reset: vi.fn(),
  remove: vi.fn(),
  configured: true,
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  signOut: vi.fn(),
  auth: {
    user: { id: 'u1', email: 'ana@gmail.com' },
    profile: { id: 'u1', role: 'applicant', email_verified: false, consent_accepted: true },
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
      resetPasswordForEmail: (...args) => h.resetPasswordForEmail(...args),
      resend: (...args) => h.resend(...args),
      signOut: (...args) => h.signOut(...args),
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import ForgotPassword from '../pages/ForgotPassword';
import VerifyEmail from '../pages/VerifyEmail';
import { AUTH_MSG } from '../lib/authErrors';

beforeEach(() => {
  h.token = 'valid-token';
  h.configured = true;
  h.reset.mockClear();
  h.resetPasswordForEmail.mockReset();
  h.resend.mockReset();
  h.auth = {
    user: { id: 'u1', email: 'ana@gmail.com' },
    profile: { id: 'u1', role: 'applicant', email_verified: false, consent_accepted: true },
    loading: false,
    refreshSession: vi.fn(),
  };
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ForgotPassword with Turnstile', () => {
  function renderForgot() {
    return render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Routes>
      </MemoryRouter>
    );
  }

  async function submitEmail() {
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'ana@gmail.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    });
  }

  it('passes the CAPTCHA token to the recover request', async () => {
    h.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderForgot();
    await act(async () => {});
    await submitEmail();

    expect(h.resetPasswordForEmail).toHaveBeenCalledWith('ana@gmail.com', {
      redirectTo: expect.stringContaining('/update-password'),
      captchaToken: 'valid-token',
    });
    expect(screen.getByText('Check Your Email')).toBeInTheDocument();
  });

  it('Test 3 — missing CAPTCHA token → no request is made', async () => {
    h.token = '';
    h.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderForgot();
    await act(async () => {});
    await submitEmail();

    expect(screen.getByText(/Please complete the security check/i)).toBeInTheDocument();
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('Test 4 — CAPTCHA rejection is reported as a CAPTCHA problem and resets the widget', async () => {
    h.resetPasswordForEmail.mockResolvedValue({
      error: { code: 'captcha_failed', message: 'captcha protection: request disallowed' },
    });
    renderForgot();
    await act(async () => {});
    await submitEmail();

    expect(await screen.findByText(/The security check failed/i)).toBeInTheDocument();
    expect(h.reset).toHaveBeenCalled();
  });

  it('Test 8 — missing CAPTCHA configuration never silently bypasses protection', async () => {
    h.configured = false;
    renderForgot();
    await act(async () => {});
    await submitEmail();

    expect(screen.getAllByText(AUTH_MSG.captchaNotConfigured).length).toBeGreaterThan(0);
    expect(h.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('resets the widget after a non-CAPTCHA recover failure and keeps its message', async () => {
    h.resetPasswordForEmail.mockResolvedValue({
      error: { code: 'over_email_send_rate_limit', status: 429, message: 'Rate limit exceeded' },
    });
    renderForgot();
    await act(async () => {});
    await submitEmail();

    // C-2: /recover's middleware spent the token, so every failure clears it,
    // while the rate-limit wording (not a CAPTCHA or address message) survives.
    expect(await screen.findByText(/Too many reset requests/i)).toBeInTheDocument();
    expect(h.reset).toHaveBeenCalled();
    expect(screen.queryByText(/The security check failed/i)).toBeNull();
    expect(screen.queryByText(/valid email address/i)).toBeNull();
  });
});

describe('VerifyEmail resend with Turnstile', () => {
  function renderVerify() {
    return render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/signup" element={<div>SIGNUP_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  // The resend button only appears once the 60 s cooldown elapses.
  async function advanceToResend() {
    await act(async () => {
      vi.advanceTimersByTime(61000);
    });
  }

  it('passes the CAPTCHA token when resending the confirmation link', async () => {
    vi.useFakeTimers();
    h.resend.mockResolvedValue({ error: null });
    renderVerify();
    await act(async () => {});
    await advanceToResend();

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    await act(async () => {});

    expect(h.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ana@gmail.com',
      options: { captchaToken: 'valid-token' },
    });
    expect(screen.getByText(/confirmation email sent again/i)).toBeInTheDocument();
  });

  it('Test 3 — missing CAPTCHA token → resend is blocked', async () => {
    vi.useFakeTimers();
    h.token = '';
    h.resend.mockResolvedValue({ error: null });
    renderVerify();
    await act(async () => {});
    await advanceToResend();

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    await act(async () => {});

    expect(screen.getByText(/Please complete the security check/i)).toBeInTheDocument();
    expect(h.resend).not.toHaveBeenCalled();
  });

  it('Test 4 — CAPTCHA rejection on resend is reported as a CAPTCHA problem', async () => {
    vi.useFakeTimers();
    h.resend.mockResolvedValue({
      error: { code: 'captcha_failed', message: 'captcha protection: request disallowed' },
    });
    renderVerify();
    await act(async () => {});
    await advanceToResend();

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    await act(async () => {});

    // getByText, not findByText: waitFor polls with timers, and this suite
    // runs on fake timers to skip the 60 s resend cooldown.
    expect(screen.getByText(/The security check failed/i)).toBeInTheDocument();
    expect(h.reset).toHaveBeenCalled();
  });

  it('resets the widget after a non-CAPTCHA resend failure and keeps its message', async () => {
    vi.useFakeTimers();
    h.resend.mockResolvedValue({
      error: {
        code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this after 60 seconds.',
      },
    });
    renderVerify();
    await act(async () => {});
    await advanceToResend();

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    await act(async () => {});

    // C-2: /resend's middleware spent the token, so the retry gets a fresh
    // challenge — and the original rate-limit mapping still wins over any
    // CAPTCHA wording.
    // getByText with a regex: the banner prefixes the message with an icon.
    expect(screen.getByText(/Too many signups/i)).toBeInTheDocument();
    expect(h.reset).toHaveBeenCalled();
    expect(screen.queryByText(/The security check failed/i)).toBeNull();
  });

  it('shows the notice carried from a refused login, with the address ready to resend', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/verify-email', state: { email: 'ana@gmail.com', notice: AUTH_MSG.emailNotConfirmed } },
        ]}
      >
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/signup" element={<div>SIGNUP_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Requirement 4: clear message + pending verification state, no access.
    // Regex because the banner prefixes the message with an icon.
    expect(screen.getByText(/Please confirm your email address first/i)).toBeInTheDocument();
    expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
  });

  it('a resend delivery failure is reported as "created, but could not send" — never as verified or invalid', async () => {
    vi.useFakeTimers();
    h.resend.mockResolvedValue({
      error: { code: 'EMAIL_PROVIDER_ERROR', message: 'smtp unavailable' },
    });
    renderVerify();
    await act(async () => {});
    await advanceToResend();

    fireEvent.click(screen.getByRole('button', { name: /resend confirmation email/i }));
    await act(async () => {});

    // The account exists — the failure is about DELIVERY, and the wording
    // must not claim verification succeeded or that the address is bad.
    expect(
      screen.getByText(/account was created successfully, but we couldn't send the verification email/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/valid email address/i)).toBeNull();
    // The success overlay ("Email Verified!") is always mounted but must stay
    // hidden — the delivery failure may never activate the verified state.
    expect(screen.getByText('Email Verified!')).toHaveStyle({ opacity: '0' });
    expect(h.reset).toHaveBeenCalled();
  });
});
