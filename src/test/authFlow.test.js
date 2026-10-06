import { describe, it, expect } from 'vitest';
import {
  VERIFY_EMAIL_PATH,
  LOGIN_PATH,
  ADMIN_PATH,
  APPLICANT_PATH,
  isEmailVerified,
  roleOf,
  dashboardPathFor,
  postAuthPath,
  verifyPageState,
} from '../lib/authFlow';

// Redirect rules for the signup -> verify -> login flow.
// These assert the single governing rule:
//   an authenticated but unverified user belongs on /verify-email,
// and that no two states ever point at each other.

const unverifiedApplicant = {
  user: { email: 'a@gmail.com', email_confirmed_at: null },
  profile: { role: 'applicant', email_verified: false },
};

const verifiedApplicant = {
  user: { email: 'a@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
  profile: { role: 'applicant', email_verified: true },
};

const admin = {
  user: { email: 'admin@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' },
  profile: { role: 'admin', email_verified: true },
};

describe('isEmailVerified', () => {
  it('is true when either signal says so', () => {
    expect(isEmailVerified(null, { email_verified: true })).toBe(true);
    expect(isEmailVerified({ email_confirmed_at: 'x' }, null)).toBe(true);
    expect(isEmailVerified({ email_confirmed_at: 'x' }, { email_verified: false })).toBe(true);
  });

  it('is false when neither signal is set', () => {
    expect(isEmailVerified({ email_confirmed_at: null }, { email_verified: false })).toBe(false);
    expect(isEmailVerified(null, null)).toBe(false);
    expect(isEmailVerified(undefined, undefined)).toBe(false);
  });
});

describe('roleOf', () => {
  it('prefers the profile role', () => {
    expect(roleOf({ role: 'admin' }, { user_metadata: { role: 'applicant' } })).toBe('admin');
  });

  it('falls back to signup metadata, then applicant', () => {
    expect(roleOf(null, { user_metadata: { role: 'applicant' } })).toBe('applicant');
    expect(roleOf(null, { user_metadata: { role: 'admin' } })).toBe('admin');
    expect(roleOf(null, null)).toBe('applicant');
  });
});

describe('dashboardPathFor', () => {
  it('maps roles to their existing destinations', () => {
    expect(dashboardPathFor('admin')).toBe(ADMIN_PATH);
    expect(dashboardPathFor('applicant')).toBe(APPLICANT_PATH);
    expect(dashboardPathFor('anything-else')).toBe(APPLICANT_PATH);
  });
});

describe('postAuthPath', () => {
  it('sends an unverified applicant to /verify-email', () => {
    expect(postAuthPath(unverifiedApplicant.profile, unverifiedApplicant.user)).toBe(
      VERIFY_EMAIL_PATH
    );
  });

  it('sends a verified applicant to the applicant dashboard', () => {
    expect(postAuthPath(verifiedApplicant.profile, verifiedApplicant.user)).toBe(APPLICANT_PATH);
  });

  it('sends an admin to /admin and skips verification', () => {
    expect(postAuthPath(admin.profile, admin.user)).toBe(ADMIN_PATH);
    // Admin is exempt even when unverified — matches requireVerification={false}.
    expect(postAuthPath({ role: 'admin', email_verified: false }, { email_confirmed_at: null })).toBe(
      ADMIN_PATH
    );
  });

  it('uses a role restored from auth metadata when the profile is absent', () => {
    expect(postAuthPath(null, { user_metadata: { role: 'applicant' } })).toBe(VERIFY_EMAIL_PATH);
    expect(postAuthPath(null, { user_metadata: { role: 'admin' } })).toBe(ADMIN_PATH);
  });
});

describe('verifyPageState', () => {
  it('Test 6 — authenticated + unverified stays on /verify-email', () => {
    const state = verifyPageState({
      loading: false,
      user: unverifiedApplicant.user,
      profile: unverifiedApplicant.profile,
    });
    expect(state).toBe('form');
    // ...which is NOT the destination postAuthPath picks for the same inputs,
    // so the two pages can never send a user back and forth.
    expect(postAuthPath(unverifiedApplicant.profile, unverifiedApplicant.user)).toBe(
      VERIFY_EMAIL_PATH
    );
    expect(state).not.toBe('already-verified');
  });

  it('Test 7 — an already-verified user is redirected to their dashboard', () => {
    expect(
      verifyPageState({ loading: false, user: verifiedApplicant.user, profile: verifiedApplicant.profile })
    ).toBe('already-verified');
    expect(
      verifyPageState({ loading: false, user: admin.user, profile: admin.profile })
    ).toBe('already-verified');
  });

  it('Test 8 — never decides anything while auth is still loading', () => {
    expect(verifyPageState({ loading: true, user: null, profile: null })).toBe('loading');
    expect(verifyPageState({ loading: true, user: verifiedApplicant.user, profile: null })).toBe(
      'loading'
    );
  });

  it('Test 8 — no session after loading finished yields a login-again state, not a redirect', () => {
    expect(verifyPageState({ loading: false, user: null, profile: null })).toBe('login-again');
    // login-again must not point back at /verify-email, or the pair would loop.
    expect(LOGIN_PATH).toBe('/login');
    expect(VERIFY_EMAIL_PATH).not.toBe(LOGIN_PATH);
  });

  it('an authenticated user with an unresolved profile still gets the form', () => {
    expect(verifyPageState({ loading: false, user: unverifiedApplicant.user, profile: null })).toBe(
      'form'
    );
  });
});

describe('no redirect loop', () => {
  const pairs = [
    ['unverified applicant', unverifiedApplicant],
    ['verified applicant', verifiedApplicant],
    ['admin', admin],
  ];

  it('/verify-email and /login never point at each other', () => {
    for (const [label, { user, profile }] of pairs) {
      const dest = postAuthPath(profile, user);
      const verifyState = verifyPageState({ loading: false, user, profile });
      // Landing on /verify-email must settle into "form" or "already-verified",
      // never into a state that bounces back to /login.
      if (dest === VERIFY_EMAIL_PATH) {
        expect(`${label}:${verifyState}`).toBe(`${label}:form`);
      } else {
        expect(verifyState).toBe('already-verified');
      }
    }
  });

  it('an unauthenticated visitor is never auto-sent to /verify-email', () => {
    // verifyPageState is the only thing that drives /verify-email, and with no
    // user it resolves to "login-again" (a static state, no navigate call).
    expect(verifyPageState({ loading: false, user: null, profile: null })).toBe('login-again');
  });
});
