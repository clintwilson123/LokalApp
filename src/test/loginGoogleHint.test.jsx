import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// "Wrong email or password." was a dead end for the most common failure on
// this screen: a Google account typing the password it uses for Gmail. Google
// never sends that password to any site, so CJLink cannot and must not ever
// check it — but nothing on the page used to say so, which is how it reads as
// "CJLink failed to store my password". The hint appears for that error and
// ONLY that error.

const h = vi.hoisted(() => ({
  auth: { user: null, profile: null, loading: false, signIn: vi.fn() },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {},
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import Login from '../pages/Login';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
        <Route path="/" element={<div>HOME_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

async function attemptSignIn() {
  fireEvent.change(screen.getByPlaceholderText('Email address'), {
    target: { value: 'google.user@gmail.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'their-gmail-password' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  });
}

beforeEach(() => {
  h.auth = { user: null, profile: null, loading: false, signIn: vi.fn() };
  window.localStorage.clear();
});

describe('Login — the Google-password dead end', () => {
  it('explains the Google case when the credentials are rejected', async () => {
    h.auth.signIn.mockRejectedValue({ message: 'Invalid login credentials' });
    renderLogin();
    await attemptSignIn();

    expect(await screen.findByText('Wrong email or password.')).toBeInTheDocument();
    // The specific, actionable part — not just another generic failure line.
    expect(
      screen.getByText(/your google password stays with google and is never shared with cjlink/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/that is the one this form accepts/i)).toBeInTheDocument();
    expect(h.auth.signIn).toHaveBeenCalledWith(
      'google.user@gmail.com',
      'their-gmail-password'
    );
  });

  it('does NOT show the Google hint for an unrelated failure', async () => {
    h.auth.signIn.mockRejectedValue({ message: 'Network error, try again' });
    renderLogin();
    await attemptSignIn();

    expect(await screen.findByText('Network error, try again')).toBeInTheDocument();
    expect(
      screen.queryByText(/your google password stays with google/i)
    ).toBeNull();
  });

  it('clears the hint on the next attempt instead of leaving it stale', async () => {
    h.auth.signIn.mockRejectedValueOnce({ message: 'Invalid login credentials' });
    renderLogin();
    await attemptSignIn();

    expect(
      await screen.findByText(/your google password stays with google/i)
    ).toBeInTheDocument();

    // Second attempt fails differently — the hint belongs to the first error.
    h.auth.signIn.mockRejectedValueOnce({ message: 'Network error, try again' });
    await attemptSignIn();

    expect(await screen.findByText('Network error, try again')).toBeInTheDocument();
    expect(
      screen.queryByText(/your google password stays with google/i)
    ).toBeNull();
  });
});
