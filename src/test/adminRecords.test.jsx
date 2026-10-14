import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// The overview's Applications / Interviews / Hired cards used to all open the
// skill-match page. Each now opens a list of exactly the rows it counted —
// which only helps if those lists are right: the same set, the real fields,
// and the embeds that name the applicant and the job.

const h = vi.hoisted(() => ({ rows: {}, calls: [] }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        _table: table,
        _select: null,
        _eq: null,
        select(cols) { q._select = cols; return q; },
        order() { return q; },
        eq(col, val) { q._eq = [col, val]; return q; },
        then(ok, err) {
          h.calls.push({ table: q._table, select: q._select, eq: q._eq });
          let data = h.rows[q._table] || [];
          if (q._eq) data = data.filter((r) => r[q._eq[0]] === q._eq[1]);
          return Promise.resolve({ data, error: null }).then(ok, err);
        },
      };
      return q;
    },
  },
}));

import AdminRecords from '../pages/AdminRecords';

beforeEach(() => {
  h.rows = {};
  h.calls = [];
});

describe('AdminRecords — Interviews', () => {
  beforeEach(() => {
    h.rows.interviews = [
      {
        id: 3,
        date: '2026-10-31',
        time: '09:50:00',
        location: 'CJTECH Shop',
        status: 'scheduled',
        created_at: '2026-10-14T06:47:41Z',
        applications: {
          profiles: { full_name: 'Maria Santos' },
          jobs: { title: 'IT Support Specialist', icon: '💻' },
        },
      },
    ];
  });

  it('shows who, which job, when and where', async () => {
    render(<AdminRecords view="interviews" />);

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('IT Support Specialist')).toBeInTheDocument();
    // Field-by-field: never new Date("2026-10-31"), which is UTC midnight and
    // renders as the 30th anywhere west of UTC.
    expect(screen.getByText('Oct 31')).toBeInTheDocument();
    // The column stores HH:MM:SS; the seconds are dropped, not shown.
    expect(screen.getByText('9:50 AM')).toBeInTheDocument();
    expect(screen.getByText('CJTECH Shop')).toBeInTheDocument();
  });

  it('reads interviews, joined through their application', async () => {
    render(<AdminRecords view="interviews" />);
    await screen.findByText('Maria Santos');

    expect(h.calls[0].table).toBe('interviews');
    expect(h.calls[0].select).toContain('applications(profiles(full_name)');
    expect(h.calls[0].select).toContain('jobs(title, icon)');
    // An interview list is never filtered by application status.
    expect(h.calls[0].eq).toBeNull();
  });
});

describe('AdminRecords — Applications and Hired', () => {
  beforeEach(() => {
    h.rows.applications = [
      { id: 1, status: 'hired', score: 91, created_at: '2026-10-13T09:00:00Z',
        profiles: { full_name: 'Ana Reyes' }, jobs: { title: 'Sales Assistant', icon: '🏪' } },
      { id: 2, status: 'pending', score: 64, created_at: '2026-10-14T08:00:00Z',
        profiles: { full_name: 'Juan Dela Cruz' }, jobs: { title: 'Sales Assistant', icon: '🏪' } },
    ];
  });

  it('lists every application with its applicant, job, score and status', async () => {
    render(<AdminRecords view="applications" />);

    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getAllByText('pending')).toHaveLength(1);
    expect(screen.getAllByText('hired')).toHaveLength(1);
    // No status filter: the card counts every row, so the list shows every row.
    expect(h.calls[0].eq).toBeNull();
  });

  it('shows only the hired — the same set the Hired card counts', async () => {
    render(<AdminRecords view="hired" />);

    expect(await screen.findByText('Ana Reyes')).toBeInTheDocument();
    expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
    expect(h.calls[0].eq).toEqual(['status', 'hired']);
  });

  it('says so plainly rather than showing an empty table', async () => {
    h.rows.applications = [];
    render(<AdminRecords view="applications" />);

    expect(
      await screen.findByText('No applications yet — this fills in as they arrive.')
    ).toBeInTheDocument();
  });
});
