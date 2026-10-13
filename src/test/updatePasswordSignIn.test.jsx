import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Password recovery must END on the sign-in form, not on the dashboard.
//
// Supabase's recovery link mints a live session. Before this test existed the
// reset screen just navigated to /login — where Login's auto-redirect sees an
// authenticated user and ships them straight to the dashboard. So the person
// who had just chosen a new password was never asked for it, and could not
// have told a working password from a broken one. Two things have to happen:
// the recovery session is released, and the hand-off carries a "success"
// notice, which is the exact flag Login uses to hold its redirect.

const h = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...a) => h.getSession(...a),
      updateUser: (...a) => h.updateUser(...a),
      signOut: (...a) => h.signOut(...a),
      onAuthStateChange: (...a) => h.onAuthStateChange(...a),
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' },
    profile: { id: 'u1', role: 'applicant', status: 'active', email_verified: true, consent_accepted: true },
    loading: false,
    loadProfile: vi.fn(),
  }),
}));

import UpdatePassword from '../pages/UpdatePassword';
import { AUTH_MSG } from '../lib/authErrors';

const RECOVERY_SESSION = { access_token: 'recovery-token', user: { id: 'u1' } };

// Captures the navigation state so the assertions can read what /login was
// handed, exactly like ProtectedRoute's own bounce.
function LoginProbe() {
  const location = useLocation();
  const state = location.state || {};
  return (
    <div>
      <div>LOGIN_PAGE</div>
      {state.notice ? <div data-testid="login-notice">{state.notice}</div> : null}
      {state.noticeType ? <div data-testid="notice-type">{state.noticeType}</div> : null}
    </div>
  );
}

function renderReset() {
  return render(
    <MemoryRouter initialEntries={['/update-password']}>
      <Routes>
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fill(password, confirm = password) {
  fireEvent.change(screen.getByPlaceholderText('New password (min. 6 characters)'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
    target: { value: confirm },
  });
}

beforeEach(() => {
  h.updateUser.mockReset();
  h.signOut.mockReset();
  h.getSession.mockReset();
  h.onAuthStateChange.mockReset();

  h.getSession.mockResolvedValue({ data: { session: RECOVERY_SESSION } });
  h.updateUser.mockResolvedValue({ error: null });
  h.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UpdatePassword — a reset ends on the sign-in form', () => {
  it('releases the recovery session and lands on /login, never the dashboard', async () => {
    renderReset();

    await screen.findByPlaceholderText('New password (min. 6 characters)');
    await act(async () => {
      fill('brand-new-pass');
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    expect(h.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass' });

    expect(await screen.findByText('Password Updated!')).toBeInTheDocument();

    // The session the recovery link minted is gone, so /login has nothing to
    // auto-redirect — that is the actual fix, not just the target URL.
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 2700));
    });

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
    expect(screen.queryByText('ADMIN_PAGE')).toBeNull();

    // "success" is what tells Login to hold its auto-redirect, so even a
    // sign-out that failed could not bounce this person to the dashboard.
    expect(screen.getByTestId('notice-type').textContent).toBe('success');
    expect(screen.getByTestId('login-notice').textContent).toBe(AUTH_MSG.passwordUpdated);
  });

  it('a failed sign-out still reaches the sign-in form — it never traps the user', async () => {
    h.signOut.mockRejectedValue(new Error('network down'));

    renderReset();
    await screen.findByPlaceholderText('New password (min. 6 characters)');

    await act(async () => {
      fill('brand-new-pass');
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    expect(await screen.findByText('Password Updated!')).toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 2700));
    });

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.getByTestId('notice-type').textContent).toBe('success');
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });

  it('a rejected update keeps them here with the error and never signs them out', async () => {
    h.updateUser.mockResolvedValue({ error: { message: 'New password is too common.' } });

    renderReset();
    await screen.findByPlaceholderText('New password (min. 6 characters)');

    await act(async () => {
      fill('brand-new-pass');
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    expect(await screen.findByText('New password is too common.')).toBeInTheDocument();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(screen.getByPlaceholderText('New password (min. 6 characters)')).toBeInTheDocument();
  });

  it('client-side validation runs before any network call', async () => {
    renderReset();
    await screen.findByPlaceholderText('New password (min. 6 characters)');

    await act(async () => {
      fill('brand-new-pass', 'different-pass');
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();

    await act(async () => {
      fill('short', 'short');
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });

    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('a live session is required — an expired link never reaches the form', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    h.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    renderReset();

    // Still verifying; the password fields must not have appeared.
    expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('New password (min. 6 characters)')).toBeNull();
  });
});
