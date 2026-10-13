import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// "View Consent" on Signup: reading the document must show the exact wording
// the /consent page shows, without ticking the checkbox, without losing what
// was already typed, and without leaving the form.

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
      </Routes>
    </MemoryRouter>
  );
}

function openConsent() {
  fireEvent.click(screen.getByRole('button', { name: /view consent/i }));
}

beforeEach(() => {
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
      screen.getByText(/By using CJLink, you agree to provide accurate and truthful information/)
    ).toBeInTheDocument();
  });

  it('carries the hiring policy, so nobody is ever asked about it a second time', async () => {
    // ApplyJob used to demand its own "Hiring Policy Acknowledgment" on top of
    // this. Its text was a restatement of these same sections, so it lives here
    // now — accepting THIS agreement at sign-up is accepting the hiring policy.
    renderSignup();
    await act(async () => {});
    openConsent();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Unique hiring-policy wording, now folded into section 1.
    expect(
      screen.getByText(/truthful information in your profile and/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/false or misleading information may result in disqualification/i)
    ).toBeInTheDocument();
    // §1 and §3 both carry it, so match every occurrence rather than one.
    expect(
      screen.getAllByText(/solely for hiring purposes/)
    ).toHaveLength(2);
    // The standalone prompt must not exist anywhere in the app.
    expect(screen.queryByText(/hiring policy acknowledgment/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /acknowledge/i })).toBeNull();
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

  it('opens the agreement IN PLACE from the checkbox text — never navigates to a second tick-box', async () => {
    // This used to be a <Link to="/consent">, which threw the user out to a
    // separate page that asked them to tick a SECOND, duplicate box under the
    // name "Terms & Conditions". It now opens the same dialog inline.
    renderSignup();
    await act(async () => {});

    const opener = screen.getByRole('button', { name: /cjlink consent agreement/i });
    await act(async () => {
      fireEvent.click(opener);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('CONSENT_PAGE')).toBeNull();
    // Reading still never ticks the checkbox for them.
    expect(screen.getByRole('checkbox')).not.toBeChecked();
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

    expect(screen.getByText('You must accept the CJLink Consent Agreement to create an account.')).toBeInTheDocument();
    expect(h.signUp).not.toHaveBeenCalled();
  });
});
