import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// OAuth callback decides where the returning user lands: intent=signup with a
// brand-new NON-admin profile keeps the session and routes back to /signup
// (prefilled) so consent is collected BEFORE any application route — the
// session is never signed out to do it.
//
// The component reads the redirect fragment at MODULE scope and guards
// replays with a module-scope flag, so each case re-imports it fresh with its
// own fragment — exactly what a real page load does.

const OAUTH_HASH =
  '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.sig' +
  '&expires_in=3600&provider_token=gp&refresh_token=rr&token_type=bearer';

const h = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  getUserAsync: vi.fn(),
  updateUser: vi.fn(),
  functionsInvoke: vi.fn(),
  auth: {
    user: null,
    profile: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    loadProfile: vi.fn(),
    ensureOAuthProfile: vi.fn(),
    refreshSession: vi.fn(),
  },
  locationPath: '',
  locationSearch: '',
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (...a) => h.exchangeCodeForSession(...a),
      signOut: (...a) => h.signOut(...a),
      getUser: (...a) => h.getUserAsync(...a),
      updateUser: (...a) => h.updateUser(...a),
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
    functions: {
      invoke: (...a) => h.functionsInvoke(...a),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({
      pathname: h.locationPath,
      search: h.locationSearch,
      // Carried through per test — the completion form is handed its prefill
      // in navigation state, exactly as the callback does in the browser.
      state: h.locationState,
      key: 'test',
    }),
  };
});

import Signup from '../pages/Signup';

// Re-import the callback with a fresh module state (INITIAL_HASH +
// callbackHandled are module scope) after planting the success fragment,
// mirroring one real page load per case.
async function renderCallback({ search = '?code=abc&intent=signup' } = {}) {
  window.location.hash = OAUTH_HASH;
  vi.resetModules();
  const { default: FreshCallback } = await import('../components/OAuthCallback');
  h.locationPath = '/auth/callback';
  h.locationSearch = search;
  h.locationState = null;
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/auth/callback', search }]}>
      <Routes>
        <Route path="/auth/callback" element={<FreshCallback />} />
        <Route path="/signup" element={<div>SIGNUP_PAGE</div>} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/employer-dashboard" element={<div>EMPLOYER_PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN_PAGE</div>} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
        <Route path="/" element={<div>HOME_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderSignupWithState(state) {
  h.locationPath = '/signup';
  h.locationSearch = '';
  h.locationState = state;
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/signup', state }]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_OTP_ENABLED', 'true');
  h.exchangeCodeForSession.mockReset();
  h.getUser.mockReset();
  h.signOut.mockReset();
  h.getUserAsync.mockReset();
  h.updateUser.mockReset();
  h.functionsInvoke.mockReset();
  h.locationPath = '';
  h.locationSearch = '';
  h.locationState = null;
  h.auth = {
    // A signed-in Google user is what the callback and the completion form
    // both expect; individual cases override it below.
    user: {
      id: 'u-9',
      email: 'newuser@gmail.com',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'New User', email: 'newuser@gmail.com' },
    },
    profile: null,
    loading: false,
    signInWithGoogle: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    loadProfile: vi.fn(),
    ensureOAuthProfile: vi.fn(),
    refreshSession: vi.fn(),
  };
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('OAuth callback — intent=signup routing', () => {
  it('routes a brand-new non-admin Google user back to /signup and keeps their session', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: null });
    h.getUserAsync.mockResolvedValue({
      data: {
        user: {
          id: 'u-1',
          email: 'newuser@gmail.com',
          app_metadata: { provider: 'google' },
          user_metadata: { full_name: 'New User', email: 'newuser@gmail.com' },
        },
      },
      error: null,
    });
    h.auth.user = {
      id: 'u-1',
      email: 'newuser@gmail.com',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'New User', email: 'newuser@gmail.com' },
    };
    h.auth.profile = {
      id: 'u-1',
      role: 'applicant',
      consent_accepted: false,
      email: 'newuser@gmail.com',
      full_name: 'New User',
    };

    await renderCallback({ search: '?code=abc&intent=signup' });
    await act(async () => {});

    expect(screen.getByText('SIGNUP_PAGE')).toBeInTheDocument();
    // The session stays — the user is NOT bounced to /login and NOT signed out.
    expect(h.signOut).not.toHaveBeenCalled();
    // And the profile hand-off was written for the completion form.
    const prefill = window.sessionStorage.getItem('cjlink:google-prefill');
    expect(prefill).toBeTruthy();
    expect(JSON.parse(prefill).email).toBe('newuser@gmail.com');
  });

  it('still sends an admin (or already-consented) Google user straight to their dashboard', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: null });
    h.getUserAsync.mockResolvedValue({
      data: {
        user: {
          id: 'u-2',
          email: 'admin@gmail.com',
          app_metadata: { provider: 'google' },
        },
      },
      error: null,
    });
    h.auth.user = {
      id: 'u-2',
      email: 'admin@gmail.com',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Admin', email: 'admin@gmail.com' },
    };
    h.auth.profile = {
      id: 'u-2',
      role: 'admin',
      consent_accepted: true,
      email: 'admin@gmail.com',
      full_name: 'Admin',
    };

    await renderCallback({ search: '?code=abc&intent=signup' });
    await act(async () => {});

    expect(screen.getByText('ADMIN_PAGE')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('cjlink:google-prefill')).toBeNull();
  });

  it('keeps the OLD behaviour (dashboard first) when no intent is present', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: null });
    h.getUserAsync.mockResolvedValue({
      data: {
        user: {
          id: 'u-3',
          email: 'applicant@gmail.com',
          app_metadata: { provider: 'google' },
        },
      },
      error: null,
    });
    h.auth.user = {
      id: 'u-3',
      email: 'applicant@gmail.com',
      // Verified address + consented profile + NO intent → the original
      // destination rules, untouched by the signup hand-off.
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Applicant', email: 'applicant@gmail.com' },
    };
    h.auth.profile = {
      id: 'u-3',
      role: 'applicant',
      consent_accepted: true,
      email: 'applicant@gmail.com',
      full_name: 'Applicant',
    };

    await renderCallback({ search: '?code=abc' });
    await act(async () => {});

    expect(screen.getByText('APPLICANT_PAGE')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('cjlink:google-prefill')).toBeNull();
  });
});

describe('Signup — Google completion form', () => {
  it('shows the read-only verified email, prefills the name and hides the password form', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    expect(screen.getByText('Complete Your Account')).toBeInTheDocument();
    expect(screen.getByText(/signed in with google/i)).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('Email address');
    expect(emailInput).toBeDisabled();
    expect(emailInput).toHaveValue('newuser@gmail.com');

    const nameInput = screen.getByPlaceholderText('Full Name');
    expect(nameInput).toHaveValue('New User');

    // No password / confirm / CAPTCHA / second Google button in this variant.
    expect(screen.queryByPlaceholderText('Password (min. 6 characters)')).toBeNull();
    expect(screen.queryByPlaceholderText('Confirm password')).toBeNull();
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    // The password-form heading is NOT the one shown here.
    expect(screen.queryByText('Create Account')).toBeNull();
  });

  it('requires the consent tick before completing', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });
    expect(screen.getByText(/must agree to the terms/i)).toBeInTheDocument();
  });

  it('does not enter completion mode for a signed-out or password user', async () => {
    // Signed out entirely → the crafted navigation state is ignored.
    h.auth.user = null;
    renderSignupWithState({
      googlePrefill: { email: 'victim@gmail.com', name: 'Victim', at: Date.now() },
    });
    await act(async () => {});

    expect(screen.queryByText('Complete Your Account')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password (min. 6 characters)')).toBeInTheDocument();
  });

  it('never walks a PASSWORD user into the completion form via crafted navigation state', async () => {
    h.auth.user = {
      id: 'p-1',
      email: 'password.user@gmail.com',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Password User' },
    };
    renderSignupWithState({
      googlePrefill: { email: 'password.user@gmail.com', name: 'Forged Name', at: Date.now() },
    });
    await act(async () => {});

    // The prefill only applies to a signed-in OAUTH user: the password form
    // stays exactly as it is (and never adopts the forged name either).
    expect(screen.queryByText('Complete Your Account')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toHaveValue('');
  });
});
