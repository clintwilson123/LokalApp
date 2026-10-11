import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Signup request discipline and rate-limit handling:
//  * a rapid double-submit never starts two signUp() calls (ref guard +
//    disabled button), and never calls signUp() from an effect;
//  * GoTrue's email-send rate limit (over_email_send_rate_limit) means the
//    account EXISTS — the user is handed to /verify-email with a resend
//    notice, never a bare error that invites "already registered" confusion;
//  * spam-prevention's pre-signup 429 (RATE_LIMITED) means NO account was
//    created — a plain error is shown and signUp() is never called.

const h = vi.hoisted(() => ({
  signUp: vi.fn(),
  invoke: vi.fn(),
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

function VerifyProbe() {
  const location = useLocation();
  const state = location.state || {};
  return (
    <div>
      <div>VERIFY_EMAIL_PAGE</div>
      {state.notice ? <div data-testid="verify-notice">{state.notice}</div> : null}
    </div>
  );
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyProbe />} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Full Name'), {
    target: { value: 'Ana Cruz' },
  });
  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'ana.cruz@gmail.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
    target: { value: 'secret123' },
  });
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
    target: { value: 'secret123' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

const submitButton = () =>
  screen.getByRole('button', { name: /create account|creating account/i });

beforeEach(() => {
  h.signUp.mockReset();
  h.invoke.mockReset();
  h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Signup — request discipline', () => {
  it('a rapid double-submit starts exactly one signUp() and disables the button', async () => {
    let resolveSignup;
    h.signUp.mockImplementation(
      () => new Promise((resolve) => { resolveSignup = resolve; })
    );

    renderSignup();
    await act(async () => {});
    fillForm();

    const button = submitButton();
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(h.signUp).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      resolveSignup({ user: { id: 'u1', email: 'ana.cruz@gmail.com' }, session: null });
    });
  });

  it('never triggers a signup from a React effect — only an explicit click submits', async () => {
    h.signUp.mockResolvedValue({ user: null, session: null });

    renderSignup();
    await act(async () => {});

    expect(h.signUp).not.toHaveBeenCalled();
    expect(h.invoke).not.toHaveBeenCalled();
  });
});

describe('Signup — email-send rate limit (account already exists)', () => {
  it('hands off to /verify-email with a resend notice instead of a bare error', async () => {
    h.signUp.mockRejectedValue(
      Object.assign(new Error('Email rate limit exceeded'), {
        code: 'over_email_send_rate_limit',
      })
    );

    renderSignup();
    await act(async () => {});
    fillForm();
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('verify-notice').textContent).toBe(
      AUTH_MSG.rateLimitedAfterCreate
    );
    // The address is remembered so /verify-email can offer the resend.
    const pending = window.localStorage.getItem('cjlink:pending-verification-email');
    expect(pending).toContain('ana.cruz@gmail.com');
  });
});

describe('Signup — spam-prevention 429 (no account created)', () => {
  it('shows the rate-limit message, stays on /signup and never calls signUp()', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'Edge Function returned a non-2xx status code',
        context: {
          json: async () => ({
            error: 'Too many signups recently. Please try again later.',
            code: 'RATE_LIMITED',
          }),
        },
      },
    });

    renderSignup();
    await act(async () => {});
    fillForm();
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(screen.getByText(AUTH_MSG.rateLimited)).toBeInTheDocument();
    expect(h.signUp).not.toHaveBeenCalled();
    expect(screen.queryByText('VERIFY_EMAIL_PAGE')).toBeNull();
  });
});

describe('Signup — codeless 5xx from signUp (Send Email hook failure)', () => {
  it('hands off to /verify-email instead of a dead-end generic error', async () => {
    // auth-js never reads the body of a 500-range response: the error has
    // NO code and (before the fix) a "{}" message. In this architecture
    // that is the Send Email hook failing AFTER the account was created,
    // so the resend screen — not a blank "try again" — is the honest
    // destination.
    h.signUp.mockRejectedValue(
      Object.assign(new Error('{}'), { status: 500 })
    );

    renderSignup();
    await act(async () => {});
    fillForm();
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('verify-notice').textContent).toBe(
      AUTH_MSG.signupEmailDeliveryFailed
    );
    const pending = window.localStorage.getItem('cjlink:pending-verification-email');
    expect(pending).toContain('ana.cruz@gmail.com');
  });
});
