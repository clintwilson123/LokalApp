import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Manage Users is where an admin moderates accounts, and it deliberately has
// no Delete — only the reversible actions.
//
// Two reasons, and the second is the one that matters:
//   1. Consistency. Manage Jobs already refuses to destroy a posting ("Close,
//      never Delete" — see manageJobsForm.test.jsx), so offering Delete here
//      put two different ideas of "remove" on the same admin shell.
//   2. Consequence. Deleting a profiles row does not delete the auth.users row
//      behind it (profiles.id references auth.users, one way), and the healing
//      path — AuthContext.recoverMissingProfile() — explicitly refuses to
//      rebuild a row whose metadata says admin. An admin who deleted their own
//      profile could sign in again and still be parked on "/" forever, with no
//      UI route back. Suspend is reversible; Delete was not.

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

const profileDeletes = () => h.writes.filter((w) => w.table === 'profiles' && w.op === 'delete');

beforeEach(() => {
  h.users = [];
  h.rpc = [];
  h.writes = [];
});

describe('Manage Users — suspending replaces deleting', () => {
  it('offers Approve and Suspend, never Delete', async () => {
    h.users = [APPLICANT];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('never issues a delete against profiles', async () => {
    h.users = [APPLICANT, ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(profileDeletes()).toHaveLength(0);
  });

  it('still lists every account — moderating a row does not remove it', async () => {
    h.users = [APPLICANT, ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(screen.getByText('Maria Cruz')).toBeInTheDocument();
    expect(screen.getByText('Site Admin')).toBeInTheDocument();
  });
});

describe('Manage Users — an admin row is not destroyable', () => {
  it('offers neither Suspend nor Delete for an admin', async () => {
    h.users = [ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    // Suspend already excluded admins; Delete now matches it instead of
    // outranking it.
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('reads the roster through the admin-gated RPC, not a raw table scan', async () => {
    h.users = [ADMIN];
    render(<Users />);
    await screen.findByText('Manage Users');

    expect(h.rpc).toContain('get_profiles_with_email');
  });
});
