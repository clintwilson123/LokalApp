import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// The overview was six identical cards in a 3x2 grid: same shape, same
// weight, no colour, and nothing on the page you could act on. Pending
// review — the one number that is a to-do — sat in the middle of the grid
// looking exactly like the four that were merely facts.

const h = vi.hoisted(() => ({
  statusRows: [],
  jobs: [],
  applicantsCount: 0,
  interviewsCount: 0,
  recent: [],
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        _table: table,
        _select: null,
        _head: false,
        select(cols, opts) { q._select = cols; q._head = !!opts?.head; return q; },
        eq: () => q,
        order: () => q,
        limit: () => q,
        then(ok, err) {
          let result = { data: [], error: null };
          if (table === 'applications' && q._select === 'status') {
            result = { data: h.statusRows, error: null };
          } else if (table === 'applications') {
            result = { data: h.recent, error: null };
          } else if (table === 'jobs') {
            result = { data: h.jobs, count: h.jobs.length, error: null };
          } else if (table === 'profiles' && q._head) {
            result = { data: null, count: h.applicantsCount, error: null };
          } else if (table === 'interviews' && q._head) {
            result = { data: null, count: h.interviewsCount, error: null };
          }
          return Promise.resolve(result).then(ok, err);
        },
      };
      return q;
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), profile: { full_name: 'Clint Wilson', role: 'admin' } }),
}));

// The other admin pages have their own effects; keep them out of this.
vi.mock('../pages/ManageJobs', () => ({ default: () => <div>JOBS PAGE</div> }));
vi.mock('../pages/AdminApplicants', () => ({ default: () => <div>APPLICANTS PAGE</div> }));
vi.mock('../pages/AdminRecords', () => ({ default: ({ view }) => <div>RECORDS {view}</div> }));
vi.mock('../pages/Users', () => ({ default: () => <div>USERS PAGE</div> }));

import AdminDashboard from '../pages/AdminDashboard';

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<><AdminDashboard /><CurrentPath /></>} />
        <Route path="/admin/jobs" element={<><div>JOBS PAGE</div><CurrentPath /></>} />
        <Route path="/admin/applicants" element={<><div>APPLICANTS PAGE</div><CurrentPath /></>} />
        <Route path="/admin/users" element={<><div>USERS PAGE</div><CurrentPath /></>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.statusRows = [
    { status: 'pending' },
    { status: 'pending' },
    { status: 'reviewed' },
    { status: 'interview_scheduled' },
    { status: 'hired' },
    { status: 'rejected' },
  ];
  h.jobs = [
    { id: 1, title: 'Sales Assistant', status: 'published', applications: [{ count: 3 }] },
    { id: 2, title: 'IT Support Specialist', status: 'published', applications: [{ count: 1 }] },
    { id: 3, title: 'Draft Role', status: 'draft', applications: [{ count: 0 }] },
  ];
  h.applicantsCount = 7;
  h.interviewsCount = 1;
  h.recent = [
    {
      id: 101,
      status: 'interview_scheduled',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      profiles: { full_name: 'Maria Santos' },
      jobs: { title: 'Sales Assistant', icon: '🏪' },
    },
  ];
});

describe('Dashboard Overview — hierarchy', () => {
  it('leads with what needs doing rather than a grid of equals', async () => {
    renderDashboard();

    expect(await screen.findByText('Needs your attention')).toBeInTheDocument();
    expect(screen.getByText(/applications waiting to be reviewed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review now/ })).toBeInTheDocument();
  });

  it('counts from the status rows rather than trusting a single total', async () => {
    renderDashboard();
    await screen.findByText('Needs your attention');

    // Scope to the stat cards: the sidebar also says "Jobs" and "Applicants",
    // and the pipeline also says "Hired". Only the stat cards carry a caret
    // (they expand) or an arrow (Jobs navigates).
    const statValue = (label) => {
      const card = screen
        .getAllByRole('button')
        .find((b) => /[→▾▴]/.test(b.textContent) && b.textContent.includes(label));
      return card ? card.textContent : '';
    };

    // 6 rows: 2 pending, 1 reviewed, 1 interview_scheduled, 1 hired, 1 rejected
    expect(statValue('Jobs')).toContain('3');
    expect(statValue('Applicants')).toContain('7');
    expect(statValue('Applications')).toContain('6');
    expect(statValue('Interviews')).toContain('1');
    expect(statValue('Hired')).toContain('1');
  });

  it('says so plainly when nothing is waiting', async () => {
    h.statusRows = [{ status: 'hired' }, { status: 'rejected' }];
    renderDashboard();

    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(screen.getByText('Nothing is waiting for review.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review now/ })).toBeNull();
    expect(screen.getByRole('button', { name: /View applicants/ })).toBeInTheDocument();
  });
});

describe('Dashboard Overview — the pipeline', () => {
  it('charts every stage so the counts have context', async () => {
    renderDashboard();

    await screen.findByText('Hiring pipeline');
    // "Hired" also labels a stat card, so presence rather than uniqueness.
    for (const label of ['Pending review', 'Reviewed', 'Interview set', 'Accepted', 'Hired']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('6 applications in total')).toBeInTheDocument();
  });

  it('shows an empty state instead of five empty bars', async () => {
    h.statusRows = [];
    h.jobs = [];
    h.recent = [];
    renderDashboard();

    await screen.findByText('Hiring pipeline');
    expect(screen.getByText('Nothing to chart yet.')).toBeInTheDocument();
    expect(screen.getByText('No jobs posted yet.')).toBeInTheDocument();
    expect(screen.getByText('No applications yet.')).toBeInTheDocument();
  });
});

describe('Dashboard Overview — panels', () => {
  it('ranks jobs by applications, most first', async () => {
    renderDashboard();

    await screen.findByText('Applications by job');
    const rows = screen.getAllByRole('button').filter((b) => /Assistant|Specialist|Draft Role/.test(b.textContent));
    expect(rows[0]).toHaveTextContent('Sales Assistant');
    expect(rows[1]).toHaveTextContent('IT Support Specialist');
    expect(rows[2]).toHaveTextContent('Draft Role');
  });

  it('shows who applied recently, with their status and how long ago', async () => {
    renderDashboard();

    await screen.findByText('Recent activity');
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    // The job title also appears in the Applications-by-job panel.
    expect(screen.getAllByText('Sales Assistant').length).toBeGreaterThan(0);
    expect(screen.getByText('interview scheduled')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('marks a draft job as draft rather than Live', async () => {
    renderDashboard();

    await screen.findByText('Applications by job');
    expect(screen.getAllByText('Live')).toHaveLength(2);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });
});

describe('Dashboard Overview — every number is a way in', () => {
  it('navigates to Jobs from the Jobs card', async () => {
    renderDashboard();

    await screen.findByText('Needs your attention');
    fireEvent.click(screen.getByRole('button', { name: /Jobs/ }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/admin/jobs'));
  });

  it('navigates to Applicants from the attention card', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /Review now/ }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/admin/applicants'));
  });

  it('navigates from a job row', async () => {
    renderDashboard();

    await screen.findByText('Applications by job');
    // The job title also appears in Recent activity, so take the job row.
    fireEvent.click(screen.getAllByText('Sales Assistant')[0]);
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/admin/jobs'));
  });

  it('offers a way to post a job from the header', async () => {
    renderDashboard();

    fireEvent.click(await screen.findByRole('button', { name: /\+ Post a job/ }));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/admin/jobs'));
  });
});

// Regression: all four cards pointed at /admin/applicants, so "Interviews: 4"
// opened a skill-match page with no interviews on it — and no way to tell
// which number had been clicked. Each card now drops its own rows down
// beneath itself, without leaving the overview.
describe('Dashboard Overview — each card opens its own rows in place', () => {
  const statCard = (label) =>
    screen
      .getAllByRole('button')
      .find((b) => /[→▾▴]/.test(b.textContent) && b.textContent.includes(label));

  [
    ['Applicants',   'applicants'],
    ['Applications', 'applications'],
    ['Interviews',   'interviews'],
    ['Hired',        'hired'],
  ].forEach(([label, view]) => {
    it(`drops the ${label} list under the card and stays on the overview`, async () => {
      renderDashboard();
      await screen.findByText('Needs your attention');

      const card = statCard(label);
      expect(card).toBeDefined();
      fireEvent.click(card);

      expect(await screen.findByText(`RECORDS ${view}`)).toBeInTheDocument();
      // Still the overview: the rest of it is on screen and no route was taken.
      expect(screen.getByText('Hiring pipeline')).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/admin$/);
    });
  });

  it('clicking the open card again closes it', async () => {
    renderDashboard();
    await screen.findByText('Needs your attention');

    fireEvent.click(statCard('Interviews'));
    await screen.findByText('RECORDS interviews');

    fireEvent.click(statCard('Interviews'));
    await waitFor(() => expect(screen.queryByText('RECORDS interviews')).toBeNull());
    expect(screen.getByText('Hiring pipeline')).toBeInTheDocument();
  });

  it('only one list is open at a time', async () => {
    renderDashboard();
    await screen.findByText('Needs your attention');

    fireEvent.click(statCard('Applicants'));
    await screen.findByText('RECORDS applicants');

    fireEvent.click(statCard('Hired'));
    expect(await screen.findByText('RECORDS hired')).toBeInTheDocument();
    expect(screen.queryByText('RECORDS applicants')).toBeNull();
  });

  it('the caret tells you which card is open', async () => {
    renderDashboard();
    await screen.findByText('Needs your attention');

    expect(statCard('Interviews').textContent).toContain('▾');

    fireEvent.click(statCard('Interviews'));
    await screen.findByText('RECORDS interviews');
    expect(statCard('Interviews').textContent).toContain('▴');
  });

  it('Jobs is still a destination, not a dropdown — it goes somewhere', async () => {
    renderDashboard();
    await screen.findByText('Needs your attention');

    fireEvent.click(statCard('Jobs'));
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/admin/jobs'));
  });
});
