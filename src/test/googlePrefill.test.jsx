import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The OAuth callback decides where the returning user lands: a NON-admin
// profile that still owes consent keeps the session and routes back to /signup
// (prefilled) so consent is collected BEFORE any application route — the
// session is never signed out to do it. Which page started the round-trip is
// irrelevant, so no ?intent parameter is involved anywhere.
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
import { AUTH_MSG } from '../lib/authErrors';

// Re-import the callback with a fresh module state (INITIAL_HASH +
// callbackHandled are module scope) after planting the success fragment,
// mirroring one real page load per case.
async function renderCallback({ search = '?code=abc' } = {}) {
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
  // Default: GoTrue accepts the new password for the OAuth user. Cases that
  // need a rejection override this below.
  h.updateUser.mockResolvedValue({ data: {}, error: null });
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

describe('OAuth callback — routing to the completion form', () => {
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

    await renderCallback({ search: '?code=abc' });
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

    await renderCallback({ search: '?code=abc' });
    await act(async () => {});

    expect(screen.getByText('ADMIN_PAGE')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('cjlink:google-prefill')).toBeNull();
  });

  it('sends an already-consented applicant straight to the dashboard — nothing to complete', async () => {
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
      // Verified address + consented profile → the normal destination
      // rules: the completion form has nothing to collect.
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
  it('shows the read-only verified email, prefills the name and ASKS for a CJLink password', async () => {
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

    // No CAPTCHA / second Google button here, and this is NOT the plain
    // password signup form — but it DOES collect the password that lets this
    // person sign in manually (email + password) from now on.
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    expect(screen.queryByText('Create Account')).toBeNull();
    expect(screen.getByPlaceholderText('Password (min. 6 characters)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument();
  });

  it('refuses to finish without a password of at least 6 characters', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    // Consent is ticked, so the NEXT missing thing is the password itself.
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();

    // Too short still refuses — and nothing was written anywhere.
    fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
      target: { value: '123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: '123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });

  it('refuses to finish when the two passwords differ', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
      target: { value: 'hunter2hunter' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'hunter2hunterx' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });

  it('writes the chosen password to the SAME Google account, then finishes', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
      target: { value: 'hunter2hunter' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'hunter2hunter' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });

    // One call, on the existing session's user — no sign-up, no new account.
    expect(h.updateUser).toHaveBeenCalledTimes(1);
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'hunter2hunter' });
    expect(await screen.findByText('APPLICANT_PAGE')).toBeInTheDocument();
  });

  it('surfaces a rejected password change instead of pretending the account is finished', async () => {
    h.updateUser.mockResolvedValue({
      data: null,
      error: { code: 'weak_password', message: 'Password is too short' },
    });
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
      target: { value: 'abcdef' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
      target: { value: 'abcdef' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });

    expect(await screen.findByText(AUTH_MSG.weakPassword)).toBeInTheDocument();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
    // Still on the completion form — the account is NOT finished.
    expect(screen.getByText('Complete Your Account')).toBeInTheDocument();
  });

  it('requires the consent tick before completing', async () => {
    renderSignupWithState({
      googlePrefill: { email: 'newuser@gmail.com', name: 'New User', at: Date.now() },
    });
    await act(async () => {});

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /complete sign-up/i }));
    });
    expect(screen.getByText(/must accept the cjlink consent agreement/i)).toBeInTheDocument();
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
