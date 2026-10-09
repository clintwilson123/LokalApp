import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Login with Turnstile: the token must reach signInWithPassword and CAPTCHA
// failures must never be reported as wrong credentials.

const h = vi.hoisted(() => ({
  token: 'valid-token',
  reset: vi.fn(),
  remove: vi.fn(),
  configured: true,
  signIn: vi.fn(),
  auth: { signIn: null, user: null, profile: null, loading: false },
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

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import Login from '../pages/Login';
import { AUTH_MSG } from '../lib/authErrors';

// Stub that also surfaces what Login carried over in navigation state, so
// tests can assert the reason followed the user to the verification screen.
function VerifyEmailStub() {
  const location = useLocation();
  return (
    <div>
      VERIFY_EMAIL_PAGE
      {location.state?.notice && <div>{location.state.notice}</div>}
      {location.state?.email && <div>{location.state.email}</div>}
    </div>
  );
}

function renderLogin(initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/find-jobs" element={<div>APPLICANT_DASHBOARD</div>} />
        <Route path="/admin" element={<div>ADMIN_DASHBOARD</div>} />
        <Route path="/verify-email" element={<VerifyEmailStub />} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'ana@gmail.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'secret123' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  });
}

beforeEach(() => {
  h.token = 'valid-token';
  h.configured = true;
  h.reset.mockClear();
  h.signIn.mockReset();
  h.auth = { signIn: h.signIn, user: null, profile: null, loading: false };
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Login with Turnstile', () => {
  it('Test 9 — a confirmed applicant can sign in normally', async () => {
    h.signIn.mockResolvedValue({
      user: { user_metadata: { full_name: 'Ana Cruz' }, email_confirmed_at: '2026-01-01' },
      role: 'applicant',
      email_verified: true,
    });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(h.signIn).toHaveBeenCalledWith('ana@gmail.com', 'secret123', 'valid-token');
    expect(await screen.findByText('Welcome back, Ana Cruz!')).toBeInTheDocument();
    expect(screen.queryByText(AUTH_MSG.captchaFailed)).toBeNull();
  });

  it('Test 10 — an admin can still sign in', async () => {
    h.signIn.mockResolvedValue({
      user: { user_metadata: { full_name: 'Site Admin' } },
      role: 'admin',
      email_verified: false,
    });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(h.signIn).toHaveBeenCalledWith('ana@gmail.com', 'secret123', 'valid-token');
    expect(await screen.findByText('Welcome back, Site Admin!')).toBeInTheDocument();
  });

  it('Test 3 — missing CAPTCHA token → login rejected before any request', async () => {
    h.token = '';
    h.signIn.mockResolvedValue({ user: {}, role: 'applicant', email_verified: true });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText(AUTH_MSG.captchaIncomplete)).toBeInTheDocument();
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('Test 4 — CAPTCHA rejected by Supabase Auth is reported as a CAPTCHA problem', async () => {
    h.signIn.mockRejectedValue({
      code: 'captcha_failed',
      message: 'captcha protection: request disallowed (timeout-or-duplicate)',
    });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(await screen.findByText(AUTH_MSG.captchaFailed)).toBeInTheDocument();
    expect(screen.queryByText('Wrong email or password.')).toBeNull();
    expect(h.reset).toHaveBeenCalled();
  });

  it('keeps the existing wrong-password message and resets the spent token', async () => {
    h.signIn.mockRejectedValue({ message: 'Invalid login credentials' });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(await screen.findByText('Wrong email or password.')).toBeInTheDocument();
    // C-2: the middleware already verified the token before the handler
    // rejected the credentials, so ANY failure must burn it — not just a
    // captcha_failed rejection. The message itself is untouched.
    expect(h.reset).toHaveBeenCalled();
    expect(screen.queryByText(AUTH_MSG.captchaFailed)).toBeNull();
  });

  it('an unconfirmed login is refused with a clear message and redirected to /verify-email', async () => {
    window.localStorage.clear();
    h.signIn.mockRejectedValue({
      code: 'email_not_confirmed',
      message: 'Email not confirmed',
    });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    // Clear instruction from our message table — never "wrong password",
    // never a CAPTCHA/network message, never the raw server string.
    expect(await screen.findByText(AUTH_MSG.emailNotConfirmed)).toBeInTheDocument();
    expect(screen.queryByText('Email not confirmed')).toBeNull();
    expect(screen.queryByText('Wrong email or password.')).toBeNull();
    expect(screen.queryByText(AUTH_MSG.captchaFailed)).toBeNull();

    // No session exists → there is nothing to access. The user lands on the
    // verification screen instead of any protected page…
    expect(await screen.findByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('APPLICANT_DASHBOARD')).toBeNull();
    expect(screen.queryByText('ADMIN_DASHBOARD')).toBeNull();

    // …with the attempted address remembered so the confirmation can be
    // resent from there.
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBe(
      'ana@gmail.com'
    );
    // C-2: the password grant was still reached, so the spent token is burned.
    expect(h.reset).toHaveBeenCalled();
  });

  it('Test 8 — missing CAPTCHA configuration never silently bypasses protection', async () => {
    h.configured = false;
    h.signIn.mockResolvedValue({ user: {}, role: 'applicant' });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    // Shown both as the widget notice and as the submit error banner.
    expect(screen.getAllByText(AUTH_MSG.captchaNotConfigured).length).toBeGreaterThan(0);
    expect(h.signIn).not.toHaveBeenCalled();
  });

  it('a verification success notice is shown and no session auto-redirects past login', async () => {
    // The confirmation callback hands off here with a session (real or
    // leftover) still present — the user must sign in themselves.
    h.auth = {
      signIn: h.signIn,
      user: { email: 'ana@gmail.com', email_confirmed_at: '2026-01-01' },
      profile: { role: 'applicant', email_verified: true },
      loading: false,
    };

    renderLogin([
      {
        pathname: '/login',
        state: {
          notice: AUTH_MSG.verifiedSuccess,
          noticeType: 'success',
          email: 'ana@gmail.com',
        },
      },
    ]);
    await act(async () => {});

    expect(await screen.findByText(AUTH_MSG.verifiedSuccess)).toBeInTheDocument();
    // The confirmed address is ready to be used…
    expect(screen.getByPlaceholderText('Email address')).toHaveValue('ana@gmail.com');
    // …but nobody is taken to a dashboard without signing in first.
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.queryByText('APPLICANT_DASHBOARD')).toBeNull();
    expect(screen.queryByText('ADMIN_DASHBOARD')).toBeNull();
  });

  it('a confirmed user can still sign in manually while the success notice is showing', async () => {
    // Spec 6.8: verification never auto-authenticates anyone — but the
    // password path must work untouched, notice and all.
    vi.useFakeTimers();
    h.auth = {
      signIn: h.signIn,
      user: { email: 'ana@gmail.com', email_confirmed_at: '2026-01-01' },
      profile: { role: 'applicant', email_verified: true },
      loading: false,
    };
    h.signIn.mockResolvedValue({
      user: { user_metadata: { full_name: 'Ana Cruz' }, email_confirmed_at: '2026-01-01' },
      role: 'applicant',
      email_verified: true,
    });

    renderLogin([
      {
        pathname: '/login',
        state: { notice: AUTH_MSG.verifiedSuccess, noticeType: 'success', email: 'ana@gmail.com' },
      },
    ]);
    await act(async () => {});
    await fillAndSubmit();

    expect(h.signIn).toHaveBeenCalledWith('ana@gmail.com', 'secret123', 'valid-token');
    expect(screen.getByText('Welcome back, Ana Cruz!')).toBeInTheDocument();

    // …and the usual handoff to the dashboard still happens after the overlay.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('APPLICANT_DASHBOARD')).toBeInTheDocument();
  });

  it('a plain error notice does not block the normal redirect for a signed-in user', async () => {
    h.auth = {
      signIn: h.signIn,
      user: { email: 'ana@gmail.com', email_confirmed_at: '2026-01-01' },
      profile: { role: 'applicant', email_verified: true },
      loading: false,
    };

    renderLogin([
      { pathname: '/login', state: { notice: 'That link did not work.', noticeType: 'error' } },
    ]);
    await act(async () => {});

    expect(await screen.findByText('APPLICANT_DASHBOARD')).toBeInTheDocument();
  });

  it('a successful sign-in retires the pending verification markers', async () => {
    window.localStorage.setItem('cjlink:pending-verification-email', 'ana@gmail.com');
    window.localStorage.setItem(
      'cjlink:verified-notice',
      JSON.stringify({ email: 'ana@gmail.com', at: Date.now() })
    );
    window.sessionStorage.setItem('cjlink:pending-verification-email', 'ana@gmail.com');
    h.signIn.mockResolvedValue({
      user: { user_metadata: { full_name: 'Ana Cruz' }, email_confirmed_at: '2026-01-01' },
      role: 'applicant',
      email_verified: true,
    });

    renderLogin();
    await act(async () => {});
    await fillAndSubmit();

    expect(await screen.findByText('Welcome back, Ana Cruz!')).toBeInTheDocument();
    // Nothing about the finished verification survives to steer a later visit.
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
    expect(window.sessionStorage.getItem('cjlink:pending-verification-email')).toBeNull();
    expect(window.localStorage.getItem('cjlink:verified-notice')).toBeNull();
  });
});
