import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The /login auto-redirect must never bounce a SUSPENDED session into a
// protected page: ProtectedRoute would send it straight back here with no
// progress — an infinite /login <-> /find-jobs loop. Regression test for the
// Google (OAuth) arrival, where the callback hands a live session to Login
// via ProtectedRoute's navigation state instead of a password sign-in.

const h = vi.hoisted(() => ({
  auth: { user: null, profile: null, loading: false, signIn: vi.fn() },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {},
    functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import Login from '../pages/Login';
import { AUTH_MSG } from '../lib/authErrors';

function renderLogin(initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/find-jobs" element={<div>APPLICANT_PAGE</div>} />
        <Route path="/admin" element={<div>ADMIN_PAGE</div>} />
        <Route path="/verify-email" element={<div>VERIFY_PAGE</div>} />
        <Route path="/" element={<div>HOME_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const suspendedArrival = [
  {
    pathname: '/login',
    state: { notice: AUTH_MSG.suspended, noticeType: 'error' },
  },
];

beforeEach(() => {
  h.auth = { user: null, profile: null, loading: false, signIn: vi.fn() };
  window.localStorage.clear();
});

describe('Login — suspended sessions never loop', () => {
  it('stays on /login for a suspended session (no bounce to the dashboard)', async () => {
    h.auth.user = { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' };
    h.auth.profile = {
      id: 'u1',
      role: 'applicant',
      status: 'suspended',
      email_verified: true,
      consent_accepted: true,
    };

    renderLogin(suspendedArrival);

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    // The suspension notice arrived via navigation state and is shown.
    expect(screen.getByText(AUTH_MSG.suspended)).toBeInTheDocument();
    // The effect must not have fired the postAuthPath redirect.
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
    expect(screen.queryByText('ADMIN_PAGE')).toBeNull();
    expect(screen.queryByText('HOME_PAGE')).toBeNull();
  });

  it('still auto-redirects a healthy confirmed applicant (normal path intact)', async () => {
    h.auth.user = { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' };
    h.auth.profile = {
      id: 'u1',
      role: 'applicant',
      status: 'active',
      email_verified: true,
      consent_accepted: true,
    };

    renderLogin();

    await waitFor(() => expect(screen.getByText('APPLICANT_PAGE')).toBeInTheDocument());
    expect(screen.queryByText('ADMIN_PAGE')).toBeNull();
  });

  it('a suspended session with no notice still stays (the guard is the status, not the message)', async () => {
    h.auth.user = { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' };
    h.auth.profile = {
      id: 'u1',
      role: 'applicant',
      status: 'suspended',
      email_verified: true,
      consent_accepted: true,
    };

    renderLogin();

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.queryByText('APPLICANT_PAGE')).toBeNull();
  });
});
