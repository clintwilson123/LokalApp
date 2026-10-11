import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Cloudflare Turnstile was removed from the signup flow: no widget, no
// pre-network CAPTCHA gate, and signUp() is called without any captcha token.
// If a widget or gate ever creeps back, this suite fails.

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

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_EMAIL_PAGE</div>} />
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

describe('Signup — no CAPTCHA', () => {
  it('renders no Turnstile widget', async () => {
    renderSignup();
    await act(async () => {});

    expect(screen.queryByTestId('turnstile-container')).toBeNull();
    expect(document.querySelector('[data-cjlink-turnstile]')).toBeNull();
  });

  it('submits without any captcha token and reaches /verify-email', async () => {
    h.signUp.mockResolvedValue({
      user: { id: 'u1', email: 'ana.cruz@gmail.com' },
      session: null,
    });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(h.signUp).toHaveBeenCalledTimes(1);

    // email, password, fullName, role, riskLevel — no sixth captcha argument
    // and no captchaToken in the options object.
    const args = h.signUp.mock.calls[0];
    expect(args.length).toBe(5);
    expect(args[0]).toBe('ana.cruz@gmail.com');
    expect(args[3]).toBe('applicant');
    expect(args[4]).toBe('low');
    expect(JSON.stringify(args)).not.toContain('captcha');
  });

  it('never surfaces a CAPTCHA error message on a normal failure', async () => {
    h.signUp.mockRejectedValue({ code: 'weak_password', message: 'Password is too short' });

    renderSignup();
    await act(async () => {});
    await fillAndSubmit();

    expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/security check/i)).toBeNull();
  });
});
