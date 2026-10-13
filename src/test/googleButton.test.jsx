import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// "Continue with Google" is rendered by BOTH auth pages with the SAME label;
// neither page decides where the user lands — /auth/callback does, and it
// sends an applicant who has never completed sign-up to the completion form.
// Under test: the label, logo, loading state, error surface and double-click
// guard cannot drift apart between Login and Signup.

const h = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signUp: vi.fn(),
  auth: { signIn: vi.fn(), signUp: null, user: null, profile: null, loading: false },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: { risk_level: 'low' }, error: null }) },
    auth: {},
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    ...h.auth,
    signInWithGoogle: (...args) => h.signInWithGoogle(...args),
    signUp: h.signUp,
  }),
}));

import Login from '../pages/Login';
import Signup from '../pages/Signup';
import { AUTH_MSG } from '../lib/authErrors';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<div>SIGNUP_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN_PAGE</div>} />
        <Route path="/forgot-password" element={<div>FORGOT_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.signInWithGoogle.mockReset();
  h.signInWithGoogle.mockResolvedValue({ data: { url: 'https://accounts.google.com/...' }, error: null });
  h.signUp.mockReset();
  h.auth = { signIn: vi.fn(), user: null, profile: null, loading: false };
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Continue with Google — Login', () => {
  it('renders the SAME button above an untouched password form', async () => {
    renderLogin();
    await act(async () => {});

    const button = screen.getByRole('button', { name: /continue with google/i });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Continue with Google');
    // The password form is untouched, and the shared "or" divider separates them.
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('starts the OAuth round-trip with no page-specific flags to parse', async () => {
    renderLogin();
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    });
    expect(h.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(h.signInWithGoogle).toHaveBeenCalledWith();
  });

  it('a double-click cannot start a second OAuth round-trip from Login either', async () => {
    renderLogin();
    await act(async () => {});

    const button = screen.getByRole('button', { name: /continue with google/i });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(h.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('reports a failed start clearly and re-enables the button', async () => {
    h.signInWithGoogle.mockRejectedValue(
      Object.assign(new Error('OAuth provider is not enabled'), { code: 'provider_not_enabled' })
    );
    renderLogin();
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    });

    expect(await screen.findByText(AUTH_MSG.oauthNotConfigured)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });
});

describe('Continue with Google — Signup', () => {
  it('is always visible on the password form with the SAME shared label', async () => {
    renderSignup();
    await act(async () => {});

    const button = screen.getByRole('button', { name: /continue with google/i });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Continue with Google');
  });

  it('starts the SAME OAuth round-trip as Login — the callback decides the destination', async () => {
    renderSignup();
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    });
    expect(h.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(h.signInWithGoogle).toHaveBeenCalledWith();
  });

  it('a double-click cannot start a second OAuth round-trip from Signup either', async () => {
    renderSignup();
    await act(async () => {});

    const button = screen.getByRole('button', { name: /continue with google/i });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(h.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('reports a failed start clearly and re-enables the button', async () => {
    h.signInWithGoogle.mockRejectedValue(
      Object.assign(new Error('OAuth provider is not enabled'), { code: 'provider_not_enabled' })
    );
    renderSignup();
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    });

    expect(await screen.findByText(AUTH_MSG.oauthNotConfigured)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  });
});
