import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The confirmation-link handoff, end to end at the component level:
// what the callback does to this browser's session, where it sends the
// user, and — crucially — what it must NEVER do (touch a session it did
// not create, act twice, or treat a stored notice as proof of anything).

const h = vi.hoisted(() => ({
  auth: { user: null, loading: false },
  getSession: null,
  signOut: null,
  listeners: [],
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args) => h.getSession(...args),
      onAuthStateChange: (callback) => {
        h.listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                h.listeners = h.listeners.filter((l) => l !== callback);
              },
            },
          },
        };
      },
      signOut: (...args) => h.signOut(...args),
    },
  },
}));

import { CONFIRMATION_SETTLE_MS } from '../lib/authCallback';
import { AUTH_MSG } from '../lib/authErrors';

const SUB = '11111111-2222-3333-4444-555555555555';
const EMAIL = 'ana@gmail.com';

function makeToken(payload) {
  const enc = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

function setFragment(fragment) {
  window.history.replaceState(null, '', `/${fragment}`);
}

// Fresh module state per test: AuthCallbackHandler keeps its once-guard and
// its captured INITIAL_HASH at module scope (on purpose — it must beat
// auth-js to the fragment), so every test imports a pristine copy.
async function loadHandler() {
  vi.resetModules();
  const mod = await import('../components/AuthCallbackHandler');
  return mod.default;
}

function StateProbe({ name }) {
  const location = useLocation();
  const state = location.state || {};
  return (
    <div>
      <div>{name}</div>
      {state.notice ? <div data-testid="notice">{state.notice}</div> : null}
      {state.noticeType ? <div data-testid="notice-type">{state.noticeType}</div> : null}
      {state.email ? <div data-testid="notice-email">{state.email}</div> : null}
    </div>
  );
}

function tree(Handler) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Handler />
      <Routes>
        <Route path="/" element={<div>HOME_PAGE</div>} />
        <Route path="/login" element={<StateProbe name="LOGIN_PAGE" />} />
        <Route path="/verify-email" element={<StateProbe name="VERIFY_EMAIL_PAGE" />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderHandler(Handler) {
  return render(tree(Handler));
}

beforeEach(() => {
  h.auth = { user: null, loading: false };
  h.getSession = vi.fn().mockResolvedValue({ data: { session: null } });
  h.signOut = vi.fn().mockResolvedValue({ error: null });
  h.listeners = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthCallbackHandler — success fragment', () => {
  it('signs out ONLY the session this callback created and hands off to /login', async () => {
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&token_type=bearer&type=signup&expires_in=3600&refresh_token=rt`);
    window.localStorage.setItem('cjlink:pending-verification-email', EMAIL);
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: SUB, email: EMAIL }, access_token: token } },
    });

    const Handler = await loadHandler();
    renderHandler(Handler);

    await screen.findByText('LOGIN_PAGE');
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });

    // Success notice, address prefilled, pending marker retired, fragment gone.
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.verifiedSuccess);
    expect(screen.getByTestId('notice-type').textContent).toBe('success');
    expect(screen.getByTestId('notice-email').textContent).toBe(EMAIL);
    const notice = JSON.parse(window.localStorage.getItem('cjlink:verified-notice'));
    expect(notice.email).toBe(EMAIL);
    expect(window.localStorage.getItem('cjlink:pending-verification-email')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('waits out auth-js: the session stored a round-trip later still gets signed out', async () => {
    // The exchange has not finished when the redirect lands — storage is
    // still empty (or holds an older session), so a single snapshot would
    // miss the callback's own session entirely.
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);
    h.getSession.mockResolvedValue({ data: { session: null } });

    const Handler = await loadHandler();
    renderHandler(Handler);

    await screen.findByText('LOGIN_PAGE');
    expect(h.signOut).not.toHaveBeenCalled(); // not yet — nothing proven
    await waitFor(() => expect(h.listeners.length).toBe(1));

    await act(async () => {
      h.listeners.forEach((cb) => cb('SIGNED_IN', { user: { id: SUB }, access_token: token }));
    });

    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(h.listeners.length).toBe(0); // watcher torn down
  });

  it('callback without any session: still the success handoff, and nothing is signed out', async () => {
    vi.useFakeTimers();
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);

    const Handler = await loadHandler();
    renderHandler(Handler);
    await act(async () => {});

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('notice-type').textContent).toBe('success');
    expect(h.signOut).not.toHaveBeenCalled();

    // The wait expires quietly — a missing session is never guessed at.
    await act(async () => {
      vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1);
    });
    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.verifiedSuccess);
  });

  it("never signs out someone else's session (different account)", async () => {
    vi.useFakeTimers();
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);
    // Another user was already signed in here when the link was opened.
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: 'unrelated-user' }, access_token: 'their-token' } },
    });

    const Handler = await loadHandler();
    renderHandler(Handler);
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1);
    });

    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument(); // handoff unaffected
  });

  it('never signs out the same account holding a session this callback did not create', async () => {
    vi.useFakeTimers();
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);
    // A pre-existing password sign-in for the SAME account: provably not
    // this callback's doing, so it must survive untouched.
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: SUB }, access_token: 'password-grant-token' } },
    });

    const Handler = await loadHandler();
    renderHandler(Handler);
    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(CONFIRMATION_SETTLE_MS + 1);
    });

    expect(h.signOut).not.toHaveBeenCalled();
  });
});

describe('AuthCallbackHandler — error fragment', () => {
  it('an expired link with a pending address goes to /verify-email with the clear message', async () => {
    setFragment(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=signup'
    );
    window.localStorage.setItem('cjlink:pending-verification-email', EMAIL);
    window.sessionStorage.setItem('cjlink:pending-verification-email', EMAIL);

    const Handler = await loadHandler();
    renderHandler(Handler);

    await screen.findByText('VERIFY_EMAIL_PAGE');
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.linkInvalidOrExpired);
    expect(screen.getByTestId('notice-type').textContent).toBe('error');
    expect(screen.getByTestId('notice-email').textContent).toBe(EMAIL);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cjlink:verified-notice')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('an expired link with nothing pending goes to /login with the same message', async () => {
    setFragment('#error=access_denied&error_code=otp_expired&error_description=Nope');

    const Handler = await loadHandler();
    renderHandler(Handler);

    await screen.findByText('LOGIN_PAGE');
    expect(screen.getByTestId('notice').textContent).toBe(AUTH_MSG.linkInvalidOrExpired);
    expect(screen.getByTestId('notice-type').textContent).toBe('error');
    expect(h.signOut).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });
});

describe('AuthCallbackHandler — scope and ordering', () => {
  it('leaves a recovery callback entirely alone (its page owns it)', async () => {
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=recovery&expires_in=3600`);

    const Handler = await loadHandler();
    renderHandler(Handler);
    await act(async () => {});
    await act(async () => {});

    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cjlink:verified-notice')).toBeNull();
    // The fragment is left for the recovery flow to consume.
    expect(window.location.hash).toContain('access_token');
  });

  it('does nothing at all while auth is still loading', async () => {
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);
    h.auth = { user: null, loading: true };

    const Handler = await loadHandler();
    const utils = render(tree(Handler));
    await act(async () => {});

    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
    expect(h.getSession).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('cjlink:verified-notice')).toBeNull();
    expect(window.location.hash).toContain('access_token');

    // Auth settles -> the same page load picks the callback up exactly once.
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: SUB }, access_token: token } },
    });
    h.auth = { user: null, loading: false };
    utils.rerender(tree(Handler));
    await screen.findByText('LOGIN_PAGE');
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
  });

  it('repeated processing (StrictMode double-effects + a remount) acts exactly once', async () => {
    const token = makeToken({ sub: SUB, email: EMAIL });
    setFragment(`#access_token=${token}&type=signup`);
    h.getSession.mockResolvedValue({
      data: { session: { user: { id: SUB }, access_token: token } },
    });

    const Handler = await loadHandler();
    const utils = render(<StrictMode>{tree(Handler)}</StrictMode>);

    await screen.findByText('LOGIN_PAGE');
    await waitFor(() => expect(h.signOut).toHaveBeenCalledTimes(1));
    // One watcher started, one storage read — the effect's second pass was
    // stopped by the page-load guard.
    expect(h.getSession).toHaveBeenCalledTimes(1);

    // A remount on the same page load must not replay the callback either.
    utils.unmount();
    renderHandler(Handler);
    await act(async () => {});
    await act(async () => {});
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.getSession).toHaveBeenCalledTimes(1);
  });
});
