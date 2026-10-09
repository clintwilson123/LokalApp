import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  parseAuthCallback,
  isConfirmationCallback,
  callbackErrorMessage,
  clearCallbackHash,
  sessionMatchesCallback,
  waitForCallbackSession,
  CONFIRMATION_SETTLE_MS,
} from '../lib/authCallback';
import { AUTH_MSG } from '../lib/authErrors';

// The confirmation link redirects to the Site URL with the outcome in the URL
// fragment. Supabase Auth consumes a success fragment itself and silently
// drops an error one, so everything the app knows about a failed link comes
// from parsing that fragment — these tests pin that classification down.

function makeToken(payload) {
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('parseAuthCallback', () => {
  it('classifies a signup success fragment and reads the confirmed address', () => {
    const token = makeToken({ email: 'juan.delacruz@gmail.com' });
    const parsed = parseAuthCallback(`#access_token=${token}&expires_in=3600&refresh_token=r&type=signup`);

    expect(parsed.kind).toBe('success');
    expect(parsed.type).toBe('signup');
    expect(parsed.email).toBe('juan.delacruz@gmail.com');
    expect(parsed.code).toBe('');
  });

  it('exposes the token identity (sub) and raw token for session proof', () => {
    const sub = '9a4b7c10-1234-4abc-9def-000000000001';
    const token = makeToken({ sub, email: 'juan.delacruz@gmail.com' });
    const parsed = parseAuthCallback(`#access_token=${token}&type=signup`);

    expect(parsed.sub).toBe(sub);
    expect(parsed.accessToken).toBe(token);
    expect(parsed.email).toBe('juan.delacruz@gmail.com');
  });

  it('leaves identity fields empty on error and none results', () => {
    const errorParsed = parseAuthCallback('#error=access_denied&error_code=otp_expired');
    expect(errorParsed.sub).toBe('');
    expect(errorParsed.accessToken).toBe('');

    const noneParsed = parseAuthCallback('#section');
    expect(noneParsed.sub).toBe('');
    expect(noneParsed.accessToken).toBe('');
  });

  it('keeps the flow type so recovery can be excluded from the handoff', () => {
    const token = makeToken({ email: 'juan.delacruz@gmail.com' });
    const parsed = parseAuthCallback(`#access_token=${token}&type=recovery`);

    expect(parsed.kind).toBe('success');
    expect(parsed.type).toBe('recovery');
  });

  it('never fails on an undecodable token — it just has no address', () => {
    const parsed = parseAuthCallback('#access_token=not-a-jwt&type=signup');

    expect(parsed.kind).toBe('success');
    expect(parsed.email).toBe('');
  });

  it('classifies a dead confirmation link via error_code (the probed GoTrue shape)', () => {
    const parsed = parseAuthCallback(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb='
    );

    expect(parsed.kind).toBe('error');
    // The specific code wins over the generic `error` value.
    expect(parsed.code).toBe('otp_expired');
    expect(parsed.description).toBe('Email link is invalid or has expired');
  });

  it('falls back to `error` when GoTrue sends no error_code', () => {
    const parsed = parseAuthCallback('#error=access_denied&error_description=No+reason');

    expect(parsed.kind).toBe('error');
    expect(parsed.code).toBe('access_denied');
  });

  it('leaves ordinary visits alone', () => {
    expect(parseAuthCallback('').kind).toBe('none');
    expect(parseAuthCallback('#').kind).toBe('none');
    expect(parseAuthCallback('#section').kind).toBe('none');
    expect(parseAuthCallback(undefined).kind).toBe('none');
  });

  it('parses with or without the leading hash', () => {
    const token = makeToken({ email: 'a@gmail.com' });
    expect(parseAuthCallback(`access_token=${token}`).kind).toBe('success');
  });
});

describe('isConfirmationCallback', () => {
  const success = (type) => ({ kind: 'success', type });

  it('accepts signup confirmations and untyped fragments', () => {
    expect(isConfirmationCallback(success('signup'))).toBe(true);
    expect(isConfirmationCallback(success('confirmation'))).toBe(true);
    expect(isConfirmationCallback(success(''))).toBe(true);
  });

  it('rejects every other flow — recovery owns /update-password', () => {
    expect(isConfirmationCallback(success('recovery'))).toBe(false);
    expect(isConfirmationCallback(success('magiclink'))).toBe(false);
    expect(isConfirmationCallback({ kind: 'error', type: 'signup' })).toBe(false);
    expect(isConfirmationCallback({ kind: 'none', type: '' })).toBe(false);
    expect(isConfirmationCallback(null)).toBe(false);
  });
});

describe('callbackErrorMessage', () => {
  it('maps the expired-link code to the shared wording', () => {
    expect(callbackErrorMessage({ code: 'otp_expired' })).toBe(AUTH_MSG.linkInvalidOrExpired);
  });

  it('maps access_denied to the same wording', () => {
    expect(callbackErrorMessage({ code: 'access_denied' })).toBe(AUTH_MSG.linkInvalidOrExpired);
  });

  it('never leaks an unrecognized code — still says the LINK failed', () => {
    expect(callbackErrorMessage({ code: 'something_new' })).toBe(AUTH_MSG.linkInvalidOrExpired);
    expect(callbackErrorMessage({ code: '' })).toBe(AUTH_MSG.linkInvalidOrExpired);
    expect(callbackErrorMessage()).toBe(AUTH_MSG.linkInvalidOrExpired);
  });
});

describe('clearCallbackHash', () => {
  it('removes the fragment without navigating', () => {
    window.history.replaceState(null, '', '/?ref=1#error=otp_expired');
    expect(window.location.hash).toBe('#error=otp_expired');

    clearCallbackHash();

    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('?ref=1');
  });

  it('is a no-op when there is nothing to clear', () => {
    clearCallbackHash();
    expect(window.location.hash).toBe('');
  });
});

describe('sessionMatchesCallback', () => {
  const proof = { sub: 'user-a', email: 'a@gmail.com', accessToken: 'token-from-fragment' };

  it('matches only when BOTH the id and the exact token agree', () => {
    expect(
      sessionMatchesCallback({ user: { id: 'user-a' }, access_token: 'token-from-fragment' }, proof)
    ).toBe(true);
  });

  it('rejects a session belonging to a different account (even with our token)', () => {
    expect(
      sessionMatchesCallback({ user: { id: 'user-b' }, access_token: 'token-from-fragment' }, proof)
    ).toBe(false);
  });

  it('rejects the same account holding a token this callback did not create', () => {
    // e.g. a password sign-in that happened to be active already — signing
    // it out would be touching an unrelated session.
    expect(
      sessionMatchesCallback({ user: { id: 'user-a' }, access_token: 'other-token' }, proof)
    ).toBe(false);
  });

  it('fails closed on missing pieces', () => {
    expect(sessionMatchesCallback(null, proof)).toBe(false);
    expect(sessionMatchesCallback({ user: { id: 'user-a' }, access_token: 'x' }, null)).toBe(false);
    expect(sessionMatchesCallback({ user: { id: 'user-a' }, access_token: 'x' }, {})).toBe(false);
    expect(
      sessionMatchesCallback({ user: { id: 'user-a' }, access_token: 'x' }, { sub: '', accessToken: '' })
    ).toBe(false);
    // Email is NEVER part of the proof.
    expect(
      sessionMatchesCallback(
        { user: { id: 'someone-else', email: 'a@gmail.com' }, access_token: 'x' },
        { ...proof, accessToken: 'x' }
      )
    ).toBe(false);
  });
});

describe('waitForCallbackSession', () => {
  const proof = { sub: 'user-a', email: 'a@gmail.com', accessToken: 'fragment-token' };

  function makeAuth({ session = null, sessionError = null } = {}) {
    const listeners = [];
    return {
      listeners,
      getSession: vi.fn(() =>
        sessionError
          ? Promise.reject(sessionError)
          : Promise.resolve({ data: { session } })
      ),
      onAuthStateChange: vi.fn((cb) => {
        listeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(() => {
                const i = listeners.indexOf(cb);
                if (i >= 0) listeners.splice(i, 1);
              }),
            },
          },
        };
      }),
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves true immediately when storage already holds the callback session', async () => {
    const auth = makeAuth({ session: { user: { id: 'user-a' }, access_token: 'fragment-token' } });
    await expect(waitForCallbackSession(auth, proof, 1000)).resolves.toBe(true);
    // No listener was ever needed.
    expect(auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('waits for the session to appear on an auth event, then unsubscribes', async () => {
    vi.useFakeTimers();
    const auth = makeAuth({ session: null });

    const pending = waitForCallbackSession(auth, proof, CONFIRMATION_SETTLE_MS);
    await Promise.resolve();
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(auth.listeners.length).toBe(1);

    // auth-js stores the session a network round-trip after the redirect —
    // the matching session shows up as an event, not in the first read.
    auth.listeners[0]('SIGNED_IN', { user: { id: 'user-a' }, access_token: 'fragment-token' });
    await expect(pending).resolves.toBe(true);
    expect(auth.listeners.length).toBe(0); // torn down
    vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1); // no zombie timer fires
  });

  it('ignores events for sessions this callback did not create', async () => {
    vi.useFakeTimers();
    const auth = makeAuth({ session: null });

    const pending = waitForCallbackSession(auth, proof, CONFIRMATION_SETTLE_MS);
    await Promise.resolve();

    auth.listeners[0]('SIGNED_IN', { user: { id: 'user-b' }, access_token: 'fragment-token' });
    auth.listeners[0]('SIGNED_IN', { user: { id: 'user-a' }, access_token: 'someone-elses' });
    auth.listeners[0]('SIGNED_OUT', null);
    await Promise.resolve();
    expect(await Promise.race([pending, Promise.resolve('still-waiting')])).toBe('still-waiting');

    vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1);
    await expect(pending).resolves.toBe(false);
  });

  it('gives up after the timeout without ever matching a foreign session', async () => {
    vi.useFakeTimers();
    const auth = makeAuth({ session: { user: { id: 'user-b' }, access_token: 'their-token' } });

    const pending = waitForCallbackSession(auth, proof, CONFIRMATION_SETTLE_MS);
    await Promise.resolve(); // first read resolves, timer gets armed
    vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1);
    await expect(pending).resolves.toBe(false);
    expect(auth.listeners.length).toBe(0);
  });

  it('falls back to the event listener when the first read fails', async () => {
    vi.useFakeTimers();
    const auth = makeAuth({ sessionError: new Error('storage blocked') });

    const pending = waitForCallbackSession(auth, proof, CONFIRMATION_SETTLE_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);

    auth.listeners[0]('TOKEN_REFRESHED', {
      user: { id: 'user-a' },
      access_token: 'fragment-token',
    });
    await expect(pending).resolves.toBe(true);
  });
});
