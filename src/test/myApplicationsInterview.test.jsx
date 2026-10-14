// The config below ships only browser globals, so vitest's `expect` has to be
// imported like every other test here rather than assumed as a global.
/* global process */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The schedule was always written to `interviews` and never read back — the
// applicant's View Details screen said an interview existed and showed nothing.
// RLS already let them read it; nothing fetched it.

const h = vi.hoisted(() => ({ apps: [] }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        delete: () => q,
        update: () => q,
        insert: () => q,
        then: (ok, err) =>
          Promise.resolve({ data: table === 'applications' ? h.apps : [], error: null }).then(ok, err),
      };
      return q;
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { skills: 'Excel', bio: '', resume_url: null },
  }),
}));

import MyApplications from '../pages/MyApplications';

const makeApp = (overrides = {}) => ({
  id: 101,
  job_id: 1,
  status: 'interview_scheduled',
  score: 80,
  created_at: '2026-10-01T00:00:00Z',
  interviews: [
    {
      id: 1,
      date: '2026-10-20',
      time: '14:30:00',
      location: 'CJTECH Shop',
      instructions: 'Bring two copies of your resume.',
      status: 'scheduled',
      created_at: '2026-10-10T00:00:00Z',
    },
  ],
  jobs: {
    title: 'Sales Assistant',
    company: 'CJTECH Computer Trading',
    location: 'Toledo City',
    icon: '🏪',
    description: 'Assist customers.',
    salary: '₱15,000 / month',
    requirements: ['Excel'],
  },
  ...overrides,
});

beforeEach(() => {
  h.apps = [makeApp()];
});

describe('My Applications — the interview schedule the applicant can actually read', () => {
  it('shows date, time, location and instructions in View Details', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    expect(await screen.findByText('Interview Schedule')).toBeInTheDocument();
    expect(screen.getByText('Tuesday, October 20, 2026')).toBeInTheDocument();
    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    expect(screen.getByText('CJTECH Shop')).toBeInTheDocument();
    expect(screen.getByText('Bring two copies of your resume.')).toBeInTheDocument();
  });

  it('no longer tells the applicant to check details that were never there', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.queryByText(/An interview has been scheduled\./)).toBeNull();
    expect(screen.getByText(/Your interview details are shown above/)).toBeInTheDocument();
  });

  it('shows the LATEST schedule after a reschedule, not the first one', async () => {
    h.apps = [
      makeApp({
        interviews: [
          { id: 1, date: '2026-10-20', time: '14:30:00', location: 'Office', status: 'scheduled', created_at: '2026-10-10T00:00:00Z' },
          { id: 2, date: '2026-10-27', time: '09:00:00', location: 'Shop', status: 'scheduled', created_at: '2026-10-12T00:00:00Z' },
        ],
      }),
    ];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.getByText('Tuesday, October 27, 2026')).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.queryByText('Tuesday, October 20, 2026')).toBeNull();

    // The newest row's location too, not the superseded one's — 'Shop' only
    // appears in the row that was rescheduled over.
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.queryByText('Office')).toBeNull();
  });

  it('flags the application on the list before it is even opened', async () => {
    render(<MyApplications />);
    expect(await screen.findByText(/📅 Interview Oct 20/)).toBeInTheDocument();
    expect(screen.getByText(/View Details/)).toBeInTheDocument();
  });

  it('says so if the status is scheduled but no row came back', async () => {
    h.apps = [makeApp({ interviews: [] })];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    expect(await screen.findByText(/Refresh the page to load the details/)).toBeInTheDocument();
    expect(screen.queryByText('Interview Schedule')).toBeNull();
  });

  it('shows no schedule block at all when nothing has been scheduled', async () => {
    h.apps = [makeApp({ status: 'pending', interviews: [] })];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Application Progress');
    expect(screen.queryByText('Interview Schedule')).toBeNull();
    expect(screen.queryByText(/Refresh the page/)).toBeNull();
    expect(screen.getByText(/Your application is under review/)).toBeInTheDocument();
  });

  it('formats 12-hour times correctly at the edges', async () => {
    h.apps = [
      makeApp({
        interviews: [{ id: 3, date: '2026-10-21', time: '00:05:00', location: 'Office', status: 'scheduled', created_at: '2026-10-11T00:00:00Z' }],
      }),
    ];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.getByText('12:05 AM')).toBeInTheDocument();
  });
});

describe('the calendar day does not shift with the viewer timezone', () => {
  const prevTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = prevTZ;
  });

  it('renders October 20 as October 20 west of UTC', async () => {
    // New York is UTC-4 in October, so `new Date("2026-10-20")` — UTC
    // midnight — lands on the 19th. If this guard does not hold, the TZ was
    // not actually applied and the rest of the test proves nothing.
    process.env.TZ = 'America/New_York';
    expect(new Date('2026-10-20').getDate()).toBe(19);

    h.apps = [
      makeApp({
        interviews: [{ id: 4, date: '2026-10-20', time: '14:30:00', location: 'Office', status: 'scheduled', created_at: '2026-10-10T00:00:00Z' }],
      }),
    ];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.getByText('Tuesday, October 20, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Monday, October 19, 2026')).toBeNull();
  });
});

describe('interviews scheduled before the location dropdown was removed', () => {
  it('still displays whatever location the row actually holds', async () => {
    // Rows already in production were written by the old Shop / Office /
    // Business Address dropdown. The applicant view must not blank them out
    // just because the admin form no longer offers those choices.
    h.apps = [
      makeApp({
        interviews: [
          {
            id: 9,
            date: '2026-10-22',
            time: '10:00:00',
            location: 'Business Address',
            status: 'scheduled',
            created_at: '2026-10-11T00:00:00Z',
          },
        ],
      }),
    ];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.getByText('Business Address')).toBeInTheDocument();
    expect(screen.getByText('Thursday, October 22, 2026')).toBeInTheDocument();
    expect(screen.queryByText('To be confirmed')).toBeNull();
  });

  it('falls back to "To be confirmed" if a row somehow has no location', async () => {
    h.apps = [
      makeApp({
        interviews: [
          { id: 10, date: '2026-10-23', time: '11:00:00', location: null, status: 'scheduled', created_at: '2026-10-11T00:00:00Z' },
        ],
      }),
    ];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Interview Schedule');
    expect(screen.getByText('To be confirmed')).toBeInTheDocument();
  });
});
