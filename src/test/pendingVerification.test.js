import { describe, it, expect, beforeEach } from 'vitest';
import {
  writePendingEmail,
  readPendingEmail,
  clearPendingEmail,
  writePendingSignup,
  readPendingSignup,
  clearPendingSignup,
  readLoginFlash,
  clearLoginFlash,
  writeLoginFlash,
} from '../lib/pendingVerification';

// Confirm email is enabled, so signUp() returns session: null and /verify-email
// is reached with no session at all. These helpers are what keep the pending
// address (and the deferred profile) alive across the reload that follows.

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('pending email', () => {
  it('survives a reload', () => {
    writePendingEmail('normal.realistic@gmail.com');
    // A reload keeps localStorage but a fresh navigation state — this is the
    // state VerifyEmail sees on the second load.
    expect(readPendingEmail({})).toBe('normal.realistic@gmail.com');
  });

  it('prefers navigation state over anything persisted', () => {
    writePendingEmail('stored@gmail.com');
    expect(readPendingEmail({ email: 'from-nav@gmail.com' })).toBe('from-nav@gmail.com');
  });

  it('ignores blank navigation state and falls back to storage', () => {
    writePendingEmail('stored@gmail.com');
    expect(readPendingEmail({ email: '   ' })).toBe('stored@gmail.com');
    expect(readPendingEmail({})).toBe('stored@gmail.com');
    expect(readPendingEmail(undefined)).toBe('stored@gmail.com');
  });

  it('is written to both storage areas so a new tab can see it', () => {
    // Confirmation links are frequently opened in a brand-new tab, where
    // sessionStorage does not follow.
    writePendingEmail('normal.realistic@gmail.com');
    expect(window.sessionStorage.getItem('cjlink:pending-verification-email')).toBe(
      'normal.realistic@gmail.com'
    );
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBe(
      'normal.realistic@gmail.com'
    );
  });

  it('trims and refuses to store an empty address', () => {
    writePendingEmail('   ');
    expect(readPendingEmail({})).toBe('');
    writePendingEmail('  spaced@gmail.com  ');
    expect(readPendingEmail({})).toBe('spaced@gmail.com');
  });

  it('clears both copies', () => {
    writePendingEmail('a@gmail.com');
    clearPendingEmail();
    expect(readPendingEmail({})).toBe('');
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
  });
});

describe('pending signup (deferred profile row)', () => {
  it('round-trips the address and risk level', () => {
    writePendingSignup('normal.realistic@gmail.com', 'low');
    const pending = readPendingSignup();
    expect(pending.email).toBe('normal.realistic@gmail.com');
    expect(pending.riskLevel).toBe('low');
    expect(typeof pending.at).toBe('number');
  });

  it('defaults the risk level', () => {
    writePendingSignup('normal.realistic@gmail.com');
    expect(readPendingSignup().riskLevel).toBe('low');
  });

  it('lives in localStorage only, so a different tab can pick it up', () => {
    writePendingSignup('normal.realistic@gmail.com', 'low');
    expect(window.sessionStorage.getItem('cjlink:pending-signup')).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-signup')).not.toBeNull();
  });

  it('returns null and self-heals on corrupt data', () => {
    window.localStorage.setItem('cjlink:pending-signup', 'not json');
    expect(readPendingSignup()).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-signup')).toBeNull();

    window.localStorage.setItem('cjlink:pending-signup', JSON.stringify({ email: '' }));
    expect(readPendingSignup()).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-signup')).toBeNull();
  });

  it('expires so an abandoned signup cannot keep steering routing', () => {
    writePendingSignup('normal.realistic@gmail.com', 'low');
    const stored = JSON.parse(window.localStorage.getItem('cjlink:pending-signup'));
    window.localStorage.setItem(
      'cjlink:pending-signup',
      JSON.stringify({ ...stored, at: Date.now() - 3 * 60 * 60 * 1000 })
    );
    expect(readPendingSignup()).toBeNull();
    expect(window.localStorage.getItem('cjlink:pending-signup')).toBeNull();
  });

  it('ignores an empty address', () => {
    writePendingSignup('  ', 'low');
    expect(readPendingSignup()).toBeNull();
  });

  it('clears', () => {
    writePendingSignup('a@gmail.com', 'low');
    clearPendingSignup();
    expect(readPendingSignup()).toBeNull();
  });
});

describe('login flash (hard-reset hand-off)', () => {
  it('round-trips the verified address without consuming it on read', () => {
    writeLoginFlash('normal.realistic@gmail.com');
    // StrictMode-safe: a read must NOT eat the message — clearLoginFlash does.
    expect(readLoginFlash().email).toBe('normal.realistic@gmail.com');
    expect(readLoginFlash().email).toBe('normal.realistic@gmail.com');
    clearLoginFlash();
    expect(readLoginFlash()).toBeNull();
  });

  it('lives in both storage areas so it survives the reload that follows', () => {
    writeLoginFlash('a@gmail.com');
    expect(window.sessionStorage.getItem('cjlink:login-flash')).not.toBeNull();
    expect(window.localStorage.getItem('cjlink:login-flash')).not.toBeNull();
    expect(readLoginFlash().email).toBe('a@gmail.com');
  });

  it('expires and self-heals on corrupt data', () => {
    writeLoginFlash('a@gmail.com');
    // Session copy first: the flash only expires once BOTH copies are stale.
    window.sessionStorage.removeItem('cjlink:login-flash');
    const stored = JSON.parse(window.localStorage.getItem('cjlink:login-flash'));
    window.localStorage.setItem(
      'cjlink:login-flash',
      JSON.stringify({ ...stored, at: Date.now() - 11 * 60 * 1000 })
    );
    expect(readLoginFlash()).toBeNull();

    window.localStorage.setItem('cjlink:login-flash', 'not json');
    expect(readLoginFlash()).toBeNull();
    expect(window.localStorage.getItem('cjlink:login-flash')).toBeNull();
  });

  it('a blank address still produces a flash — the message does not need one', () => {
    writeLoginFlash('   ');
    expect(readLoginFlash()).toEqual({ email: '' });
  });
});
