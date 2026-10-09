import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pure Google (OAuth) helpers: the redirect target builder, the cancelled
// consent-screen classifier, the "failed to start" error mapper, and the
// fragment classifier that tells a Google redirect apart from an email
// confirmation. No React, no Supabase — just the decision rules.

describe('oauthRedirectTo', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState(null, '', '/');
  });

  it('points at /auth/callback on the current origin in dev', async () => {
    // jsdom runs with import.meta.env.DEV === true, so the localhost branch
    // is the one under test here.
    const { oauthRedirectTo } = await import('../lib/oauth');
    expect(oauthRedirectTo()).toBe(`${window.location.origin}/auth/callback`);
  });

  it('never produces a doubled slash or a trailing slash', async () => {
    const { oauthRedirectTo } = await import('../lib/oauth');
    const url = oauthRedirectTo();
    expect(url.endsWith('/auth/callback')).toBe(true);
    expect(url.includes('//auth')).toBe(false);
  });
});

describe('isCancelledOAuth', () => {
  let isCancelledOAuth;

  beforeEach(async () => {
    vi.resetModules();
    ({ isCancelledOAuth } = await import('../lib/oauth'));
  });

  it('recognises a cancelled Google consent screen by code or description', () => {
    expect(isCancelledOAuth({ kind: 'error', code: 'access_denied', description: '' })).toBe(true);
    expect(isCancelledOAuth({ kind: 'error', code: 'cancelled', description: '' })).toBe(true);
    expect(isCancelledOAuth({ kind: 'error', code: 'canceled', description: '' })).toBe(true);
    expect(isCancelledOAuth({ kind: 'error', code: '', description: 'The user denied the request' })).toBe(true);
    expect(isCancelledOAuth({ kind: 'error', code: '', description: 'User cancelled sign-in' })).toBe(true);
  });

  it('does NOT treat real failures as cancellations', () => {
    expect(isCancelledOAuth({ kind: 'error', code: 'server_error', description: 'internal' })).toBe(false);
    expect(isCancelledOAuth({ kind: 'error', code: 'invalid_request', description: 'bad redirect' })).toBe(false);
    expect(isCancelledOAuth({ kind: 'success' })).toBe(false);
    expect(isCancelledOAuth({ kind: 'none' })).toBe(false);
    expect(isCancelledOAuth(null)).toBe(false);
    expect(isCancelledOAuth(undefined)).toBe(false);
  });
});

describe('messageForOAuthError', () => {
  let messageForOAuthError;
  let AUTH_MSG;

  beforeEach(async () => {
    vi.resetModules();
    ({ messageForOAuthError, AUTH_MSG } = await import('../lib/authErrors'));
  });

  it('maps a disabled/misconfigured provider to the "not set up" message', () => {
    expect(messageForOAuthError({ code: 'provider_not_enabled' })).toBe(AUTH_MSG.oauthNotConfigured);
    expect(messageForOAuthError(new Error('OAuth provider is not enabled'))).toBe(
      AUTH_MSG.oauthNotConfigured
    );
    expect(messageForOAuthError(new Error('invalid client'))).toBe(AUTH_MSG.oauthNotConfigured);
    expect(messageForOAuthError(new Error('invalid redirect url'))).toBe(AUTH_MSG.oauthNotConfigured);
  });

  it('maps a network failure to the network message — never "Google is broken"', () => {
    expect(messageForOAuthError(new TypeError('Failed to fetch'))).toBe(AUTH_MSG.network);
    expect(messageForOAuthError(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      AUTH_MSG.network
    );
  });

  it('falls back to the generic OAuth failure for unclassified errors', () => {
    expect(messageForOAuthError(new Error('something else'))).toBe(AUTH_MSG.oauthFailed);
    expect(messageForOAuthError(undefined)).toBe(AUTH_MSG.oauthFailed);
    expect(messageForOAuthError(null)).toBe(AUTH_MSG.oauthFailed);
  });
});

describe('parseAuthCallback — OAuth provider token', () => {
  let parseAuthCallback;
  let isOAuthCallback;

  beforeEach(async () => {
    vi.resetModules();
    ({ parseAuthCallback, isOAuthCallback } = await import('../lib/authCallback'));
  });

  it('flags a fragment carrying provider_token as an OAuth callback', () => {
    const parsed = parseAuthCallback('#access_token=at&provider_token=pt&provider_refresh_token=pr');
    expect(parsed.hasProviderToken).toBe(true);
    expect(isOAuthCallback(parsed)).toBe(true);
  });

  it('does NOT flag a plain confirmation fragment (no provider tokens)', () => {
    const parsed = parseAuthCallback('#access_token=at&type=signup');
    expect(parsed.hasProviderToken).toBe(false);
    expect(isOAuthCallback(parsed)).toBe(false);
  });

  it('treats provider_refresh_token alone as OAuth too', () => {
    const parsed = parseAuthCallback('#access_token=at&provider_refresh_token=pr');
    expect(isOAuthCallback(parsed)).toBe(true);
  });

  it('returns false for error and none fragments', () => {
    expect(isOAuthCallback(parseAuthCallback('#error=access_denied'))).toBe(false);
    expect(isOAuthCallback(parseAuthCallback(''))).toBe(false);
    expect(isOAuthCallback(null)).toBe(false);
  });
});
