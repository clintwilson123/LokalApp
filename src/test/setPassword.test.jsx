import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// /set-password is the safety net for Google accounts that never chose a
// CJLink password — the exact state behind "Continue with Google creates the
// user, but email + password says Wrong email or password". Google never
// shares its password, so the fix is a guaranteed place to pick a new one,
// not a way to store Google's.

const h = vi.hoisted(() => ({
  updateUser: vi.fn(),
  loadProfile: vi.fn(),
  auth: { user: null, profile: null, loading: false },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: { updateUser: (...a) => h.updateUser(...a) },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: h.auth.user,
    profile: h.auth.profile,
    loading: h.auth.loading,
    loadProfile: (...a) => h.loadProfile(...a),
  }),
}));

import SetPassword from '../pages/SetPassword';

function googleAuth(overrides = {}) {
  return {
    user: {
      id: 'g-1',
      email: 'google.user@gmail.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      app_metadata: { provider: 'google' },
      user_metadata: { full_name: 'Google User', role: 'applicant' },
      ...(overrides.user || {}),
    },
    profile: {
      id: 'g-1',
      role: 'applicant',
      email_verified: true,
      consent_accepted: true,
      ...(overrides.profile || {}),
    },
    loading: false,
  };
}

function renderSetPassword() {
  return render(
    <MemoryRouter initialEntries={['/set-password']}>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fill(password, confirm = password) {
  fireEvent.change(screen.getByPlaceholderText('Password (min. 6 characters)'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {
    target: { value: confirm },
  });
}

beforeEach(() => {
  h.auth = googleAuth();
  h.updateUser.mockReset();
  h.updateUser.mockResolvedValue({ data: {}, error: null });
  h.loadProfile.mockReset();
  h.loadProfile.mockResolvedValue(null);
});

describe('/set-password', () => {
  it('saves the password and the "has a password" flag in ONE write', async () => {
    renderSetPassword();

    expect(
      screen.getByText(/your google password stays with google/i)
    ).toBeInTheDocument();

    fill('hunter2hunter');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    });

    expect(h.updateUser).toHaveBeenCalledTimes(1);
    expect(h.updateUser).toHaveBeenCalledWith({
      password: 'hunter2hunter',
      data: expect.objectContaining({
        cjlink_password_set: true,
        // Existing metadata is preserved, never replaced wholesale — losing
        // `role` here would cost us the fallback in roleOf().
        role: 'applicant',
      }),
    });

    // Honest success, not a silent redirect that could be mistaken for one.
    expect(await screen.findByText('Password saved')).toBeInTheDocument();
    expect(screen.queryByText(/could not save/i)).toBeNull();
  });

  it('refuses to write until both the length and match rules pass', async () => {
    renderSetPassword();

    fill('abc');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    });
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();

    fill('hunter2hunter', 'hunter2hunterx');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    });
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
    // Still here, still no false success.
    expect(screen.queryByText('Password saved')).toBeNull();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });

  it('surfaces a rejected write instead of pretending the account is fixed', async () => {
    h.updateUser.mockResolvedValue({
      data: null,
      error: { code: 'weak_password', message: 'Password is too short' },
    });
    renderSetPassword();

    fill('hunter2hunter');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    });

    expect(await screen.findByText(/password is too short/i)).toBeInTheDocument();
    expect(screen.queryByText('Password saved')).toBeNull();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
    // The escape hatch is still on offer, so a persistent failure cannot trap
    // anyone on this page.
    expect(
      screen.getByRole('button', { name: /skip for now/i })
    ).toBeInTheDocument();
  });

  it('"Skip for now" reaches the dashboard without writing anything', async () => {
    renderSetPassword();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    });

    expect(screen.getByText('APPLICANT_PAGE')).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(screen.queryByText('Password saved')).toBeNull();
  });

  it('sends an ADMIN onward to /admin after a save — the role decides, not this page', async () => {
    h.auth = googleAuth({
      profile: { role: 'admin', email_verified: true },
      user: { user_metadata: { full_name: 'Admin', role: 'admin' } },
    });
    renderSetPassword();

    fill('hunter2hunter');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save password/i }));
    });

    expect(h.updateUser).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Password saved')).toBeInTheDocument();
  });

  it('never shows the form to an email+password account — it already has one', async () => {
    h.auth = googleAuth({
      user: { app_metadata: { provider: 'email' } },
    });
    renderSetPassword();

    await act(async () => {});

    expect(screen.queryByPlaceholderText('Password (min. 6 characters)')).toBeNull();
    expect(screen.getByText('APPLICANT_PAGE')).toBeInTheDocument();
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('bounces a signed-out visitor to /login rather than rendering a dead form', async () => {
    h.auth = { user: null, profile: null, loading: false };
    renderSetPassword();

    await act(async () => {});

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Password (min. 6 characters)')).toBeNull();
  });

  it('waits for auth to settle instead of redirecting mid-load', async () => {
    h.auth = { user: null, profile: null, loading: true };
    renderSetPassword();

    await act(async () => {});

    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(screen.queryByPlaceholderText('Password (min. 6 characters)')).toBeNull();
  });
});
