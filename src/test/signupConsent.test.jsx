import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// "View Consent" on Signup: reading the document must show the exact wording
// the /consent page shows, without ticking the checkbox, without losing what
// was already typed, and without leaving the form.

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

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_EMAIL_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function openConsent() {
  fireEvent.click(screen.getByRole('button', { name: /view consent/i }));
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
  window.sessionStorage.clear();
});

describe('Signup — View Consent modal', () => {
  it('shows the consent document with the exact wording from /consent', async () => {
    renderSignup();
    await act(async () => {});
    openConsent();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Platform Terms')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Employer Consent')).toBeInTheDocument();
    expect(screen.getByText('Applicant Responsibilities')).toBeInTheDocument();
    expect(
      screen.getByText(/We do not sell your data to third parties\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/By using CJLink, you agree to provide accurate information/)
    ).toBeInTheDocument();
  });

  it('closes without navigating and without touching the checkbox or typed values', async () => {
    renderSignup();
    await act(async () => {});

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Juan Dela Cruz' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'juan.delacruz@gmail.com' },
    });

    openConsent();
    // Reading never agrees for you…
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('CONSENT_PAGE')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    // …never loses what was typed, never ticks on its own.
    expect(screen.getByPlaceholderText('Full Name')).toHaveValue('Juan Dela Cruz');
    expect(screen.getByPlaceholderText('Email address')).toHaveValue(
      'juan.delacruz@gmail.com'
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('closes on Escape and on a backdrop click', async () => {
    renderSignup();
    await act(async () => {});

    openConsent();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    openConsent();
    fireEvent.click(screen.getByRole('presentation'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the /consent link as an explicit way to reach the full page', async () => {
    renderSignup();
    await act(async () => {});

    expect(
      screen.getByRole('link', { name: /terms, privacy policy, and employer consent/i })
    ).toBeInTheDocument();
  });

  it('still refuses signup without the checkbox after the modal was used', async () => {
    renderSignup();
    await act(async () => {});

    openConsent();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { value: 'Juan Dela Cruz' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'juan.delacruz@gmail.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'secret123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    });

    expect(screen.getByText('You must agree to the terms to create an account.')).toBeInTheDocument();
    expect(h.signUp).not.toHaveBeenCalled();
  });
});
