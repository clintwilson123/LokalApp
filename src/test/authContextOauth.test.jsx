import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

// AuthContext's Google (OAuth) surface: starting the sign-in, and minting the
// profile row a brand-new Google user needs. The security rules under test
// are the ones the whole flow depends on: OAuth metadata can never mint an
// admin, an existing row is never touched, and email/password users are
// never processed by the OAuth path.

const h = vi.hoisted(() => ({
  insertCalls: [],
  insertError: null,
  signInWithOAuth: null,
  getSession: null,
  rpc: null,
  getUser: null,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => h.getSession(),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      getUser: () => h.getUser(),
      signInWithOAuth: (...args) => h.signInWithOAuth(...args),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
      stopAutoRefresh: vi.fn(),
    },
    rpc: (...args) => h.rpc(...args),
    from: () => ({
      insert: (row) => {
        h.insertCalls.push(row);
        return Promise.resolve({ error: h.insertError });
      },
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          update: () => Promise.resolve({ error: null }),
        }),
        update: () => Promise.resolve({ error: null }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

async function mountAuthProvider() {
  const mod = await import('../context/AuthContext');
  let captured;
  function Grab() {
    captured = mod.useAuth();
    return null;
  }
  render(
    <mod.AuthProvider>
      <Grab />
    </mod.AuthProvider>
  );
  await waitFor(() => expect(captured.loading).toBe(false));
  return () => captured;
}

function googleUser(overrides = {}) {
  return {
    id: 'g-1',
    email: 'google.user@gmail.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Google User', email: 'google.user@gmail.com' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.insertCalls = [];
  h.insertError = null;
  h.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
  h.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  h.getUser = vi.fn().mockResolvedValue({ data: { user: null } });
  h.signInWithOAuth = vi.fn().mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/auth?...' }, error: null });
});

describe('signInWithGoogle', () => {
  it('calls signInWithOAuth with provider "google" and a /auth/callback redirect', async () => {
    const getAuth = await mountAuthProvider();
    await act(async () => {
      await getAuth().signInWithGoogle();
    });

    expect(h.signInWithOAuth).toHaveBeenCalledTimes(1);
    const [payload] = h.signInWithOAuth.mock.calls[0];
    expect(payload.provider).toBe('google');
    expect(payload.options.redirectTo).toMatch(/\/auth\/callback$/);
  });

  it('throws the Supabase error so the button can classify it', async () => {
    h.signInWithOAuth = vi.fn().mockResolvedValue({
      data: null,
      error: Object.assign(new Error('provider not enabled'), { code: 'provider_not_enabled' }),
    });
    const getAuth = await mountAuthProvider();
    await expect(
      act(async () => {
        await getAuth().signInWithGoogle();
      })
    ).rejects.toThrow('provider not enabled');
  });
});

describe('ensureOAuthProfile (via session handling)', () => {
  it('a returning Google user with an existing profile row (23505) is treated as success', async () => {
    h.insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    h.getSession = vi.fn().mockResolvedValue({
      data: { session: { user: googleUser(), access_token: 'x' } },
    });
    // get_my_profile returns the existing row so loadProfile settles.
    h.rpc = vi.fn(async (name) =>
      name === 'get_my_profile'
        ? { data: { id: 'g-1', role: 'applicant', email_verified: true, consent_accepted: false }, error: null }
        : { data: null, error: null }
    );

    const getAuth = await mountAuthProvider();
    await waitFor(() => expect(getAuth().user).toBeTruthy());

    // The insert was ATTEMPTED (and the duplicate was accepted as success),
    // but the row keeps the database's role — never overwritten.
    expect(h.insertCalls.length).toBeGreaterThan(0);
    expect(getAuth().profile.role).toBe('applicant');
  });

  it('never runs the OAuth profile path for an email/password user', async () => {
    h.getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: googleUser({ app_metadata: { provider: 'email' } }),
          access_token: 'x',
        },
      },
    });
    h.rpc = vi.fn(async (name) =>
      name === 'get_my_profile'
        ? { data: { id: 'g-1', role: 'applicant', email_verified: false, consent_accepted: true }, error: null }
        : { data: null, error: null }
    );

    const getAuth = await mountAuthProvider();
    await waitFor(() => expect(getAuth().loading).toBe(false));

    expect(h.insertCalls).toHaveLength(0);
  });

  it('a brand-new Google user is inserted as applicant with consent still outstanding', async () => {
    h.getSession = vi.fn().mockResolvedValue({
      data: { session: { user: googleUser(), access_token: 'x' } },
    });
    h.rpc = vi.fn(async (name) =>
      name === 'get_my_profile'
        ? { data: { id: 'g-1', role: 'applicant', email_verified: true, consent_accepted: false }, error: null }
        : { data: null, error: null }
    );

    await mountAuthProvider();
    await waitFor(() => expect(h.insertCalls.length).toBeGreaterThan(0));

    const row = h.insertCalls[0];
    expect(row.role).toBe('applicant');
    expect(row.consent_accepted).toBe(false);
    expect(row.email_verified).toBe(true);
    expect(row.status).toBe('active');
  });

  it('ignores any admin role smuggled in through Google user_metadata', async () => {
    h.getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: googleUser({
            user_metadata: { full_name: 'Evil', role: 'admin', email: 'evil@gmail.com' },
          }),
          access_token: 'x',
        },
      },
    });
    h.rpc = vi.fn(async (name) =>
      name === 'get_my_profile'
        ? { data: { id: 'g-1', role: 'applicant', email_verified: true, consent_accepted: false }, error: null }
        : { data: null, error: null }
    );

    await mountAuthProvider();
    await waitFor(() => expect(h.insertCalls.length).toBeGreaterThan(0));

    // The row always says applicant, regardless of what the OAuth metadata claims.
    expect(h.insertCalls[0].role).toBe('applicant');
  });
});
