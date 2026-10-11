import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// A Send Email hook / mailer failure arrives from signUp() as an error even
// though Confirm email created the account first. That MUST NOT read as a
// failed signup: no "already registered", no dead end — the address is kept
// and the user lands on /verify-email, which has a resend and the real state.

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

// Only what Signup destructures — a delivery failure never reaches
// loadProfile/ensureOAuthProfile, so those must not be required here.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signUp: h.signUp }),
}));

import Signup from '../pages/Signup';
import { AUTH_MSG } from '../lib/authErrors';

function VerifyEmailStub() {
  const location = useLocation();
  return (
    <div>
      VERIFY_EMAIL_PAGE
      <div data-testid="notice">{location.state?.notice || ''}</div>
      <div data-testid="email">{location.state?.email || ''}</div>
      <div data-testid="accountCreated">{String(location.state?.accountCreated ?? '')}</div>
    </div>
  );
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/verify-email" element={<VerifyEmailStub />} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function fillAndSubmit() {
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
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  });
}

beforeEach(() => {
  h.signUp.mockReset();
  h.invoke.mockReset();
  h.invoke.mockResolvedValue({ data: { risk_level: 'low' }, error: null });
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Signup — email delivery failure after the account was created', () => {
  it('routes to /verify-email with a resend-ready notice instead of "already registered"', async () => {
    h.signUp.mockRejectedValue({
      code: 'unexpected_failure',
      message: 'Error sending confirmation email (hook 500)',
    });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('notice')).toHaveTextContent(AUTH_MSG.signupEmailDeliveryFailed);
    expect(screen.getByTestId('email')).toHaveTextContent('ana.cruz@gmail.com');
    // Not reported as an existing account — a retry here must not dead-end.
    expect(screen.queryByText(/already registered/i)).toBeNull();
    expect(screen.queryByText(/could not create account/i)).toBeNull();
    // The address is remembered for a reload of the verification screen.
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBe('ana.cruz@gmail.com');
  });

  it('still reports a REAL duplicate address as already registered', async () => {
    h.signUp.mockResolvedValue({ user: null, session: null });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    // signUp() handed back nothing → the address exists: the plain failed
    // path stays on the form with the duplicate message.
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(screen.queryByText('VERIFY_EMAIL_PAGE')).toBeNull();
  });

  it('keeps a non-delivery failure on the form with its mapped message', async () => {
    h.signUp.mockRejectedValue({ code: 'weak_password', message: 'Password is too weak' });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.queryByText('VERIFY_EMAIL_PAGE')).toBeNull();
    expect(screen.getByText(/password/i)).toBeInTheDocument();
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
  });
});
