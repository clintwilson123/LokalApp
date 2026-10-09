import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  useAuth: () => ({ signIn: h.signIn, user: null, profile: null, loading: false }),
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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
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
});
