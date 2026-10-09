import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Signup flow tests with the CAPTCHA mocked: no real network, no real
// Turnstile widget, no real Supabase Auth calls.

const h = vi.hoisted(() => ({
  token: 'valid-token',
  reset: vi.fn(),
  remove: vi.fn(),
  configured: true,
  renderError: null,
  opts: null,
  signUp: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('../lib/turnstile', () => ({
  isTurnstileConfigured: () => h.configured,
  getTurnstileSiteKey: () => 'test-site-key',
  renderTurnstile: vi.fn((_, opts) => {
    h.opts = opts;
    return h.renderError
      ? Promise.reject(h.renderError)
      : Promise.resolve({
          getToken: () => h.token,
          reset: h.reset,
          remove: h.remove,
        });
  }),
  loadTurnstileScript: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args) => h.invoke(...args) },
    auth: {},
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signUp: h.signUp }),
}));

import Signup from '../pages/Signup';
import { AUTH_MSG } from '../lib/authErrors';

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<div>VERIFY_EMAIL_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAndSubmit({ email = 'juan.delacruz@gmail.com' } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Full Name'), {
    target: { value: 'Juan Dela Cruz' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
    target: { value: 'secret123' },
  });
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
    target: { value: 'secret123' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  });
}

beforeEach(() => {
  h.token = 'valid-token';
  h.configured = true;
  h.renderError = null;
  h.opts = null;
  h.reset.mockClear();
  h.signUp.mockReset();
  h.invoke.mockReset();
  window.localStorage.clear();
});

describe('Signup with Turnstile', () => {
  it('Test 1 — valid email + valid CAPTCHA + allowed rate → signup proceeds', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    renderSignup();
    await act(async () => {}); // flush widget render
    await fillAndSubmit();

    // Pre-signup checks still run, and the request body carries ONLY the
    // email — no client-supplied rate-limit key a bot could vary.
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith('spam-prevention', {
      body: { email: 'juan.delacruz@gmail.com' },
    });

    // The single-use token reaches Supabase Auth through options.captchaToken.
    expect(h.signUp).toHaveBeenCalledWith(
      'juan.delacruz@gmail.com',
      'secret123',
      'Juan Dela Cruz',
      'applicant',
      'low',
      'valid-token'
    );

    // Native confirmation-link flow is preserved.
    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
  });

  it('Test 2 — a random-looking multi-signal address is NOT hard-blocked and proceeds to verification', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'medium' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    renderSignup();
    await act(async () => {});
    // long_username + low_diversity (score 3) — previously returned a
    // "suspicious activity" block before any network call. Verification-led
    // policy: shape never blocks; the confirmation link proves the mailbox.
    await fillAndSubmit({ email: 'fsafsdfsdfsdfsdfdssadsa@gmail.com' });

    expect(screen.queryByText(AUTH_MSG.suspicious)).toBeNull();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith('spam-prevention', {
      body: { email: 'fsafsdfsdfsdfsdfdssadsa@gmail.com' },
    });
    // The medium verdict still travels to Supabase Auth and is persisted as
    // signup_risk_level — the address is flagged, never silently trusted.
    expect(h.signUp).toHaveBeenCalledWith(
      'fsafsdfsdfsdfsdfdssadsa@gmail.com',
      'secret123',
      'Juan Dela Cruz',
      'applicant',
      'medium',
      'valid-token'
    );
    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
  });

  it('Test 2b — a single-signal address is NOT blocked client-side and reaches spam-prevention', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'medium' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    renderSignup();
    await act(async () => {});
    // low_diversity alone (score 2): accepted as medium risk instead of
    // being hard-blocked as suspicious.
    await fillAndSubmit({ email: 'lovelovelove@gmail.com' });

    expect(screen.queryByText(AUTH_MSG.suspicious)).toBeNull();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith('spam-prevention', {
      body: { email: 'lovelovelove@gmail.com' },
    });
    // The medium verdict still travels to Supabase Auth and is persisted as
    // signup_risk_level — the address is flagged, never silently trusted.
    expect(h.signUp).toHaveBeenCalledWith(
      'lovelovelove@gmail.com',
      'secret123',
      'Juan Dela Cruz',
      'applicant',
      'medium',
      'valid-token'
    );
  });

  it('Test 2c — a non-Gmail domain is rejected with the Gmail-required message', async () => {
    renderSignup();
    await act(async () => {});
    await fillAndSubmit({ email: 'john.doe@yahoo.com' });

    // Its own message: the requirement that failed is the Gmail-only rule,
    // not the address syntax.
    expect(screen.getByText(AUTH_MSG.gmailRequired)).toBeInTheDocument();
    expect(screen.queryByText(AUTH_MSG.invalidFormat)).toBeNull();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('Test 2 — a malformed address is rejected with the format message', async () => {
    renderSignup();
    await act(async () => {});
    await fillAndSubmit({ email: 'not-an-email' });

    expect(screen.getByText(AUTH_MSG.invalidFormat)).toBeInTheDocument();
    expect(screen.queryByText(AUTH_MSG.gmailRequired)).toBeNull();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('Test 3 — missing CAPTCHA token → rejected before any network call', async () => {
    h.token = '';
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' } });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText(AUTH_MSG.captchaIncomplete)).toBeInTheDocument();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('Test 4 — token rejected by Supabase Auth → CAPTCHA message and widget reset', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockRejectedValue({
      code: 'captcha_failed',
      message: 'captcha protection: request disallowed (invalid-input-response)',
    });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    // Reported as a CAPTCHA problem — never as an invalid address or a
    // generic connection error.
    expect(await screen.findByText(AUTH_MSG.captchaFailed)).toBeInTheDocument();
    expect(screen.queryByText(/valid gmail address/i)).toBeNull();
    expect(screen.queryByText(AUTH_MSG.network)).toBeNull();
    // The stale token is burned so the retry renders a fresh challenge.
    expect(h.reset).toHaveBeenCalled();
  });

  it('Test 5 — CAPTCHA widget cannot be loaded → signup fails closed', async () => {
    h.renderError = new Error('network down');
    h.signUp.mockResolvedValue({ user: { id: 'user-1' } });

    renderSignup();
    await act(async () => {});

    // The page shows why the security check is unavailable…
    expect(screen.getByText(AUTH_MSG.captchaLoadFailed)).toBeInTheDocument();

    await fillAndSubmit();

    // …and refuses to create the account.
    expect(h.signUp).not.toHaveBeenCalled();
    expect(screen.getByText(AUTH_MSG.captchaIncomplete)).toBeInTheDocument();
  });

  it('Test 6 — rate limit from spam-prevention → clear message, no account created', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: {
          json: async () => ({
            error: 'Too many signups recently. Please try again later.',
            code: 'RATE_LIMITED',
          }),
        },
      },
    });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' } });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText(AUTH_MSG.rateLimited)).toBeInTheDocument();
    expect(h.signUp).not.toHaveBeenCalled();
    // C-2: even a pre-Auth failure burns the single-use token, so the retry
    // must start from a fresh challenge.
    expect(h.reset).toHaveBeenCalled();
  });

  it('resets the widget after a non-CAPTCHA Supabase Auth failure and keeps its message', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockRejectedValue({
      code: 'user_already_exists',
      message: 'A user with this email address has already been registered',
    });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    // Duplicate-address classification is preserved exactly…
    expect(await screen.findByText(AUTH_MSG.alreadyRegistered)).toBeInTheDocument();
    expect(screen.queryByText(AUTH_MSG.captchaFailed)).toBeNull();
    // …and the spent token is cleared for the next attempt.
    expect(h.reset).toHaveBeenCalled();
  });

  it('Test 7 — the client supplies no rate-limit identifier that a bot could vary', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    // Spam checks are keyed server-side; the only client input is the email.
    expect(h.invoke.mock.calls[0][1]).toEqual({
      body: { email: 'juan.delacruz@gmail.com' },
    });
    expect(Object.keys(h.invoke.mock.calls[0][1].body)).toEqual(['email']);
  });

  it('Test 8 — missing CAPTCHA configuration never silently bypasses protection', async () => {
    h.configured = false;
    h.signUp.mockResolvedValue({ user: { id: 'user-1' } });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    // Shown both as the widget notice and as the submit error banner.
    expect(screen.getAllByText(AUTH_MSG.captchaNotConfigured).length).toBeGreaterThan(0);
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('Test 7 — an expired token is reported clearly and still blocks signup', async () => {
    h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
    h.signUp.mockResolvedValue({ user: { id: 'user-1' }, session: null });

    renderSignup();
    await act(async () => {});
    expect(h.opts).not.toBeNull();

    // The token expires while the form is being filled in; the widget clears
    // it and re-renders the challenge.
    act(() => {
      h.token = '';
      h.opts.onExpired();
    });

    expect(screen.getByText(AUTH_MSG.captchaExpired)).toBeInTheDocument();

    await fillAndSubmit();
    expect(screen.getByText(AUTH_MSG.captchaIncomplete)).toBeInTheDocument();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(h.signUp).not.toHaveBeenCalled();
  });
});
