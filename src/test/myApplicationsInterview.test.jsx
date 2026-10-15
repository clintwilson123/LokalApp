// The config below ships only browser globals, so vitest's `expect` has to be
// imported like every other test here rather than assumed as a global.
/* global process */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The schedule was always written to `interviews` and never read back — the
// applicant's View Details screen said an interview existed and showed nothing.
// RLS already let them read it; nothing fetched it.

const h = vi.hoisted(() => ({
  apps: [],
  profile: { skills: 'Excel', bio: '', resume_url: null },
}));

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
    profile: h.profile,
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
  h.profile = { skills: 'Excel', bio: '', resume_url: null };
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
    // The status panel points at the details that are actually on this
    // screen, rather than sending the applicant hunting for a banner that
    // was never rendered.
    expect(screen.getByText(/The date, time and location are below/)).toBeInTheDocument();
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

    await screen.findByText('Where you are');
    expect(screen.queryByText('Interview Schedule')).toBeNull();
    expect(screen.queryByText(/Refresh the page/)).toBeNull();
    // The status panel says what "pending" means instead of printing the
    // word and leaving the applicant to infer the rest.
    expect(screen.getByText(/in the queue and has not been opened yet/)).toBeInTheDocument();
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

  it('spells the status out instead of showing the raw column value', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());

    // Two of the three status chips rendered `app.status` verbatim. The chip
    // is text-transform: capitalize, which only breaks on whitespace, so the
    // applicant's headline badge read "Interview_scheduled" — on the one
    // status they most needed to understand.
    expect(screen.getAllByText('interview scheduled').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/interview_scheduled/)).toBeNull();
  });

  it('reads the same in the detail view as on the card', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());

    // Exactly one chip, on the card.
    expect(screen.getAllByText('interview scheduled')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));
    await screen.findByText('Interview Schedule');

    // Two in the detail, both deliberate: the status panel's title and the
    // current step. The header chip, the "Application Status:" row and the
    // banner buried under the profile section are all gone — one statement
    // of it instead of four small ones — and it is never the raw column
    // value either way.
    expect(screen.getAllByText('Interview Scheduled')).toHaveLength(2);
    expect(screen.queryByText(/interview_scheduled/)).toBeNull();
  });
});

describe('My Applications — the status is actually readable', () => {
  it('says what the status means, not just what it is called', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    expect(await screen.findByText(/The date, time and location are below/)).toBeInTheDocument();
    expect(screen.queryByText('Application Status:')).toBeNull();
    expect(screen.queryByText('Application Progress')).toBeNull();
  });

  it('marks where the applicant is on the ladder, in plain words', async () => {
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Where you are');
    expect(screen.getByText('Now')).toBeInTheDocument();
    // Human labels, not the column values the old timeline used to print.
    expect(screen.getByText('Application Submitted')).toBeInTheDocument();
    // Twice: the status panel's title and the step it sits on.
    expect(screen.getAllByText('Interview Scheduled')).toHaveLength(2);
    expect(screen.getByText('Hired')).toBeInTheDocument();
  });

  it('gives interviewed a place on the ladder, which the old timeline lacked', async () => {
    h.apps = [makeApp({ status: 'interviewed', interviews: [] })];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Where you are');
    // Once for the status panel's title, once for the step it sits on —
    // the old timeline had no `interviewed` entry at all, so the marker
    // rested on the step before it.
    expect(screen.getAllByText('Interviewed')).toHaveLength(2);
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('lays the ladder out as one horizontal row, not six stacked ones', async () => {
    // Six rows of dot + label + sentence ate the better part of 400px of
    // card, pushing everything the applicant came for below the fold. The
    // same six steps now share a single line.
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Where you are');
    const list = screen.getByRole('list');
    expect(list.style.display).toBe('flex');
    expect(list.style.flexDirection).not.toBe('column');
    expect(list.children).toHaveLength(6);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    // Still exactly one marker on the step the applicant is actually on.
    expect(screen.getByText('Now')).toBeInTheDocument();
    // The six sentences that sat under the labels are gone: the status panel
    // directly above already says what the current step means, once.
    expect(screen.queryByText('We have your application.')).toBeNull();
    expect(screen.queryByText('A date, time and place are set.')).toBeNull();
  });

  it('folds a long skills list in the profile rather than dumping it', async () => {
    h.profile = {
      skills: 'Word, PowerPoint, Outlook, SQL, React, Node.js, Git, Figma',
      bio: '',
      resume_url: null,
    };
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    await screen.findByText('Skills');
    expect(screen.getByText('Word')).toBeInTheDocument();
    expect(screen.queryByText('Git')).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Show 4 more skills' });
    expect(toggle).toHaveTextContent('+4 more');
    fireEvent.click(toggle);

    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer skills' })).toHaveTextContent('Show less');
  });

  it('does not show a rejected applicant a ladder of what they did not reach', async () => {
    h.apps = [makeApp({ status: 'rejected', interviews: [] })];
    render(<MyApplications />);
    await waitFor(() => expect(screen.getByText(/1 application submitted/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /View Details/ }));

    expect(await screen.findByText('Not Selected')).toBeInTheDocument();
    expect(screen.getByText(/moved ahead with other applicants/)).toBeInTheDocument();
    // No step-by-step: we do not record how far a rejected application got,
    // and a list of six things they did not achieve helps nobody.
    expect(screen.queryByText('Application Submitted')).toBeNull();
    expect(screen.queryByText('Now')).toBeNull();
    expect(screen.queryByText('Hired')).toBeNull();
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
