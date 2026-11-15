import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Manage Users shows the signed-in admin the WHOLE roster, including their own
// account. Suspend and Delete are therefore both scoped away from admin rows
// with the same guard, so the two buttons always agree:
//
//   role !== 'admin'  ->  Suspend and Delete are offered
//   role === 'admin'  ->  neither is offered
//
// The reason the admin row matters more than the applicant row: deleting a
// profiles row does not delete the auth.users row behind it (profiles.id
// references auth.users, one way), and AuthContext.recoverMissingProfile()
// explicitly refuses to rebuild a row whose metadata says admin. An admin who
// removed their own account could sign in again and still be parked on "/"
// forever, with no UI route back. Applicants are the opposite — their row is
// rebuilt on next sign-in, so the destructive action stays available there.

const h = vi.hoisted(() => ({ users: [], rpc: [], writes: [] }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        delete: () => {
          h.writes.push({ table, op: 'delete' });
          return q;
        },
        update: (payload) => {
          h.writes.push({ table, op: 'update', payload });
          return q;
        },
        then: (ok, err) => Promise.resolve({ data: [], error: null }).then(ok, err),
      };
      return q;
    },
    rpc(name) {
      h.rpc.push(name);
      return Promise.resolve({ data: h.users, error: null });
    },
  },
}));

import Users from '../pages/Users';

const APPLICANT = {
  id: 'a1b2c3d4-0000-0000-0000-000000000001',
  full_name: 'Maria Cruz',
  email: 'maria@example.com',
  role: 'applicant',
  status: 'pending',
  phone_number: '09171234567',
  location: 'Toledo City',
  skills: 'Excel, Customer Service',
  resume_url: null,
  created_at: '2026-01-01T00:00:00Z',
};

const ADMIN = {
  id: 'a1b2c3d4-0000-0000-0000-000000000002',
  full_name: 'Site Admin',
  email: 'admin@gmail.com',
  role: 'admin',
  status: 'active',
  phone_number: null,
  location: null,
  skills: '',
  resume_url: null,
  created_at: '2026-01-01T00:00:00Z',
};

const profileDeletes = () =>
  h.writes.filter((w) => w.table === 'profiles' && w.op === 'delete');

beforeEach(() => {
  h.users = [];
  h.rpc = [];
  h.writes = [];
  // jsdom does not implement confirm(); deleteUser() asks before it writes.
  window.confirm = vi.fn(() => true);
});

describe('Manage Users — applicants are fully manageable', () => {
  it('offers Approve, Suspend and Delete for an applicant', async () => {
    h.users = [APPLICANT];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes an applicant by writing to profiles', async () => {
    h.users = [APPLICANT];
    render(<Users />);
    await screen.findByText('Manage Users');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(profileDeletes()).toHaveLength(1);
    expect(window.confirm).toHaveBeenCalled();
  });
});

describe('Manage Users — an admin row is never destroyable', () => {
  it('offers neither Suspend nor Delete for an admin', async () => {
    h.users = [ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    // The admin sees their own account in this roster — this is the row the
    // guard exists for.
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('never issues a delete while an admin is in the roster', async () => {
    h.users = [ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(profileDeletes()).toHaveLength(0);
  });

  it('scopes each row by its OWN role, not by whoever is signed in', async () => {
    h.users = [APPLICANT, ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    // Both rows render: one Delete (the applicant's), none for the admin.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Suspend' })).toHaveLength(1);
    expect(screen.getByText('Site Admin')).toBeInTheDocument();
    expect(screen.getByText('Maria Cruz')).toBeInTheDocument();
  });

  it('can still moderate an admin — approving is not the same as destroying', async () => {
    h.users = [{ ...ADMIN, status: 'pending' }];
    render(<Users />);
    await screen.findByText('Manage Users');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(profileDeletes()).toHaveLength(0);
    expect(h.writes.filter((w) => w.op === 'update')).toHaveLength(1);
  });
});
