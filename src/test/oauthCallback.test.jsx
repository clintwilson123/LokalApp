import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The /auth/callback page: where a Google redirect lands. It never decides
// authentication itself — every redirect is derived from the session +
// profile AuthContext already loaded, using the same postAuthPath() rules
// the password flow uses. What is under test: the role-based destination,
// the cancelled/failed classifications, suspended-account parking, and that
// OAuth metadata can never promote anyone to admin.

const h = vi.hoisted(() => ({
  auth: { user: null, profile: null, loading: false, refreshSession: null },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import { AUTH_MSG } from '../lib/authErrors';

function StateProbe({ name }) {
  const location = useLocation();
  const state = location.state || {};
  return (
    <div>
      <div>{name}</div>
      {state.notice ? <div data-testid="notice">{state.notice}</div> : null}
      {state.noticeType ? <div data-testid="notice-type">{state.noticeType}</div> : null}
    </div>
  );
}

function tree(Callback, initialEntries = ['/auth/callback']) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Callback />
      <Routes>
        <Route path="/" element={<div>HOME_PAGE</div>} />
        <Route path="/login" element={<StateProbe name="LOGIN_PAGE" />} />
        <Route path="/find-jobs" element={<StateProbe name="APPLICANT_PAGE" />} />
        <Route path="/admin" element={<StateProbe name="ADMIN_PAGE" />} />
        <Route path="/verify-email" element={<StateProbe name="VERIFY_PAGE" />} />
        <Route path="/consent" element={<StateProbe name="CONSENT_PAGE" />} />
        <Route path="/signup" element={<StateProbe name="SIGNUP_PAGE" />} />
      </Routes>
    </MemoryRouter>
  );
}

// The module keeps a once-guard and an INITIAL_HASH at module scope (it must
// beat auth-js to the fragment), so every test loads a pristine copy.
async function loadCallback() {
  vi.resetModules();
  const mod = await import('../components/OAuthCallback');
  return mod.default;
}

function googleUser(overrides = {}) {
  return {
    id: 'g-1',
    email: 'google.user@gmail.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Google User' },
    ...overrides,
  };
}

function setFragment(fragment) {
  window.history.replaceState(null, '', `/auth/callback${fragment}`);
}

const OAUTH_FRAGMENT = '#access_token=at&provider_token=pt&type=';

beforeEach(() => {
  h.auth = {
    user: null,
    profile: null,
    loading: false,
    refreshSession: vi.fn().mockResolvedValue(null),
  };
  window.history.replaceState(null, '', '/');
});

describe('OAuthCallback — role-based redirect', () => {
  it('sends a NEW Google applicant to /find-jobs once the profile is readable', async () => {
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser();
    h.auth.profile = { id: 'g-1', role: 'applicant', email_verified: true, consent_accepted: false };

    const Callback = await loadCallback();
    render(tree(Callback));
    await screen.findByText('APPLICANT_PAGE');
  });

  it('sends an EXISTING admin to /admin — the database role is the only one honoured', async () => {
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser();
    h.auth.profile = { id: 'g-1', role: 'admin', email_verified: true };

    const Callback = await loadCallback();
    render(tree(Callback));
    await screen.findByText('ADMIN_PAGE');
  });

  it('does NOT promote a Google user whose profile row is missing — refreshSession is retried, never /admin', async () => {
    // user_metadata.role = "admin" (as an attacker might inject) must not be
    // consulted: only the profiles row decides the role. With no row, the
    // page retries via refreshSession and never routes to /admin.
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser({
      user_metadata: { full_name: 'Evil', role: 'admin' },
    });
    h.auth.profile = null;

    const Callback = await loadCallback();
    render(tree(Callback));

    await waitFor(() => expect(h.auth.refreshSession).toHaveBeenCalled());
    expect(screen.queryByText('ADMIN_PAGE')).toBeNull();
  });
});

describe('OAuthCallback — suspended accounts', () => {
  it('a suspended Google user parks on /login with the suspension notice, never a dashboard', async () => {
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser();
    h.auth.profile = {
      id: 'g-1',
      role: 'applicant',
      email_verified: true,
      consent_accepted: true,
      status: 'suspended',
    };

    const Callback = await loadCallback();
    render(tree(Callback));

    await screen.findByText('LOGIN_PAGE');
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.suspended);
    expect(screen.getByTestId('notice-type').textContent).toBe('error');
  });

  it('suspension outranks the Signup completion hand-off (?intent=signup)', async () => {
    // A round-trip Signup started must not hand a suspended account the
    // consent/completion form: the session is refused at /login instead.
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser();
    h.auth.profile = {
      id: 'g-1',
      role: 'applicant',
      email_verified: true,
      consent_accepted: false,
      status: 'suspended',
    };

    const Callback = await loadCallback();
    render(tree(Callback, ['/auth/callback?intent=signup']));

    await screen.findByText('LOGIN_PAGE');
    expect(screen.queryByText('SIGNUP_PAGE')).toBeNull();
    expect(screen.queryByText('CONSENT_PAGE')).toBeNull();
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.suspended);
  });
});

describe('OAuthCallback — cancelled and failed sign-ins', () => {
  it('a cancelled sign-in (access_denied) goes to /login with the cancel message', async () => {
    setFragment('#error=access_denied&error_description=The+user+denied+the+request');

    const Callback = await loadCallback();
    render(tree(Callback));
    await screen.findByText('LOGIN_PAGE');
    expect(screen.getByTestId('notice').textContent).toMatch(/cancelled/i);
    expect(screen.getByTestId('notice-type').textContent).toBe('error');
  });

  it('an unclassified error fragment goes to /login with the generic OAuth-failure message', async () => {
    setFragment('#error=server_error&error_description=internal');

    const Callback = await loadCallback();
    render(tree(Callback));
    await screen.findByText('LOGIN_PAGE');
    expect(screen.getByTestId('notice').textContent).toMatch(/could not sign in with google/i);
  });
});

describe('OAuthCallback — ordinary visits and loading', () => {
  it('an ordinary visit (no fragment) with no session goes home, not into a loop', async () => {
    // No fragment set — window.location is just /auth/callback.
    const Callback = await loadCallback();
    render(tree(Callback));
    await screen.findByText('HOME_PAGE');
  });

  it('shows a spinner while auth is still loading and does NOT decide a redirect yet', async () => {
    setFragment(OAUTH_FRAGMENT);
    h.auth.loading = true;

    const Callback = await loadCallback();
    render(tree(Callback));
    await act(async () => {});

    expect(screen.getByText(/completing sign-in/i)).toBeInTheDocument();
    expect(screen.queryByText('HOME_PAGE')).toBeNull();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });

  it('StrictMode double-mount navigates exactly once (module-scope once-guard)', async () => {
    setFragment(OAUTH_FRAGMENT);
    h.auth.user = googleUser();
    h.auth.profile = { id: 'g-1', role: 'applicant', email_verified: true };

    const Callback = await loadCallback();
    render(
      <StrictMode>
        {tree(Callback)}
      </StrictMode>
    );
    await screen.findByText('APPLICANT_PAGE');
    expect(screen.getAllByText('APPLICANT_PAGE')).toHaveLength(1);
  });
});
