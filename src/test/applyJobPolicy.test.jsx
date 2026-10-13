import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// The hiring policy used to be a SECOND agreement: ApplyJob popped its own
// "Hiring Policy Acknowledgment" modal and blocked the application until the
// person clicked "I Acknowledge & Agree". Its text was a near-verbatim
// restatement of the CJLink Consent Agreement, so it is folded into that one
// document now. Under test: applying never surfaces a policy prompt again,
// even when a hiring_policy row genuinely exists in the database.

const h = vi.hoisted(() => ({
  rows: {},
  inserts: [],
  rpc: vi.fn(async () => ({ data: [], error: null })),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        insert: async (row) => {
          h.inserts.push({ table, row });
          return { data: null, error: null };
        },
        update: () => builder,
        single: async () => ({ data: h.rows[table] ?? null, error: null }),
        maybeSingle: async () => ({ data: h.rows[table] ?? null, error: null }),
      };
      return builder;
    },
    rpc: (...args) => h.rpc(...args),
  },
}));

const h2 = vi.hoisted(() => ({ loadProfile: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1' },
    profile: { id: 'u-1', full_name: 'Juan', location: 'Manila', skills: 'React' },
    loadProfile: (...a) => h2.loadProfile(...a),
  }),
}));

import ApplyJob from '../pages/ApplyJob';

const JOB = {
  id: 7,
  title: 'Frontend Developer',
  company: 'CJTECH',
  location: 'Manila',
  salary: '₱30,000',
  description: 'Build things.',
  max_applicants: 0,
};

function renderApply() {
  return render(
    <MemoryRouter initialEntries={['/apply-job/7']}>
      <Routes>
        <Route path="/apply-job/:jobId" element={<ApplyJob />} />
        <Route path="/my-applications" element={<div>MY_APPLICATIONS</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.rows = {
    jobs: JOB,
    // No existing application -> the fresh "insert" path runs.
    applications: null,
  };
  h.inserts = [];
  h.rpc.mockClear();
  h2.loadProfile.mockReset();
});

describe('ApplyJob — the hiring policy is part of the Consent Agreement now', () => {
  it('never renders a hiring-policy acknowledgment prompt', async () => {
    renderApply();

    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();

    expect(screen.queryByText(/hiring policy/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /acknowledge/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /i agree/i })).toBeNull();
    // The apply path itself is untouched.
    expect(screen.getByRole('button', { name: /apply now/i })).toBeInTheDocument();
  });

  it('applies straight through — no policy gate, no second agreement', async () => {
    renderApply();
    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply now/i }));
    });

    // The application was written...
    expect(h.inserts.some((c) => c.table === 'applications')).toBe(true);
    // ...and NO acknowledgment row was, because there is nothing left to ack.
    expect(h.inserts.some((c) => c.table === 'hiring_policy_acknowledgments')).toBe(false);
    expect(await screen.findByText('Application Submitted!')).toBeInTheDocument();
    expect(screen.queryByText(/hiring policy/i)).toBeNull();
  });
});
