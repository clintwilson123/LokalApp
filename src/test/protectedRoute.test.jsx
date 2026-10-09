import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Protected access must stay fail-closed: an unverified (or profile-less)
// applicant never reaches a protected page, while admin behaviour is intact.

const h = vi.hoisted(() => ({
  auth: { user: null, profile: null, loading: false },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => h.auth,
}));

import ProtectedRoute from '../components/ProtectedRoute';

function renderProtected(requireVerification = true, allowedRoles) {
  return render(
    <MemoryRouter initialEntries={['/find-jobs']}>
      <Routes>
        <Route
          path="/find-jobs"
          element={
            <ProtectedRoute requireVerification={requireVerification} allowedRoles={allowedRoles}>
              <div>PROTECTED_CONTENT</div>
            </ProtectedRoute>
          }
        />
        <Route path="/verify-email" element={<div>VERIFY_EMAIL_PAGE</div>} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/consent" element={<div>CONSENT_PAGE</div>} />
        <Route path="/" element={<div>HOME_PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const applicant = (overrides = {}) => ({
  id: 'u1',
  role: 'applicant',
  status: 'active',
  email_verified: true,
  consent_accepted: true,
  ...overrides,
});

beforeEach(() => {
  h.auth = { user: null, profile: null, loading: false };
});

describe('ProtectedRoute', () => {
  it('Test 8 — a valid but unconfirmed applicant cannot access protected pages', () => {
    h.auth = {
      user: { id: 'u1', email: 'ana@gmail.com' },
      profile: applicant({ email_verified: false }),
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('an unconfirmed user with no profile row is sent to /verify-email, never a protected page', () => {
    // This is the shape a fresh signup has BEFORE the confirmation link
    // issues a session: Auth user present, no profile row yet.
    h.auth = { user: { id: 'u1', email_confirmed_at: null }, profile: null, loading: false };
    renderProtected();
    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
    expect(screen.queryByText('HOME_PAGE')).toBeNull();
  });

  it('fails closed when a CONFIRMED user has no readable profile', () => {
    h.auth = {
      user: { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' },
      profile: null,
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('grants access from the trusted session confirmation even if the profile mirror lags', () => {
    // Requirement 5: right after the confirmation link lands, the session
    // carries email_confirmed_at — access must work even before the
    // profiles.email_verified mirror catches up.
    h.auth = {
      user: { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' },
      profile: applicant({ email_verified: false }),
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('blocks suspended accounts', () => {
    h.auth = { user: { id: 'u1' }, profile: applicant({ status: 'suspended' }), loading: false };
    renderProtected();
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('sends a consent-less applicant to the consent page', () => {
    h.auth = {
      user: { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' },
      profile: applicant({ consent_accepted: false }),
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('CONSENT_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('blocks the wrong role', () => {
    h.auth = { user: { id: 'u1' }, profile: applicant(), loading: false };
    renderProtected(true, ['admin']);
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('lets a confirmed applicant through', () => {
    h.auth = {
      user: { id: 'u1', email_confirmed_at: '2026-01-01T00:00:00Z' },
      profile: applicant(),
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('Test 10 — admin routes stay reachable without email verification', () => {
    h.auth = {
      user: { id: 'admin-1', email: 'admin@gmail.com' },
      profile: applicant({ id: 'admin-1', role: 'admin', email_verified: false }),
      loading: false,
    };
    renderProtected(false, ['admin']);
    expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument();
  });

  it('renders a loading state instead of redirecting while auth settles', () => {
    h.auth = { user: null, profile: null, loading: true };
    renderProtected();
    expect(screen.queryByText('HOME_PAGE')).toBeNull();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
  });

  it('a stored verification notice can never grant access to an unconfirmed user', () => {
    // The localStorage notice is wording for the verification screens — it
    // is never consulted here and never authorizes anything.
    window.localStorage.setItem(
      'cjlink:verified-notice',
      JSON.stringify({ email: 'ana@gmail.com', at: Date.now() })
    );
    h.auth = {
      user: { id: 'u1', email: 'ana@gmail.com', email_confirmed_at: null },
      profile: applicant({ email_verified: false }),
      loading: false,
    };
    renderProtected();
    expect(screen.getByText('VERIFY_EMAIL_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
    window.localStorage.clear();
  });

  it('a stored verification notice can never authenticate a visitor with no session', () => {
    window.localStorage.setItem(
      'cjlink:verified-notice',
      JSON.stringify({ email: 'ana@gmail.com', at: Date.now() })
    );
    h.auth = { user: null, profile: null, loading: false };
    renderProtected();
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('PROTECTED_CONTENT')).toBeNull();
    window.localStorage.clear();
  });
});
