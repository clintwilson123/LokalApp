import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// FindJobs is where a posting is actually discovered. It used to search only
// `title` and `description`, so a job that named a skill in its requirements
// was invisible to anyone searching for that skill — typing "Excel" never
// surfaced the Sales Assistant post that asks for it.

const h = vi.hoisted(() => ({
  fromQueue: [],
  fromCalls: [],
  rpcCalls: [],
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(name) {
      h.fromCalls.push(name);
      const result = h.fromQueue.length > 1 ? h.fromQueue.shift() : h.fromQueue[0];
      const q = {
        select: () => q,
        eq: (...args) => { q._eq = args; return q; },
        order: () => q,
        then: (ok, err) => Promise.resolve(result).then(ok, err),
      };
      return q;
    },
    rpc(name) {
      h.rpcCalls.push(name);
      return { then: (ok, err) => Promise.resolve({ data: [], error: null }).then(ok, err) };
    },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ profile: h.profile }),
}));

const ALIAS_INDEX = {};
vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: () =>
    Promise.resolve({ options: [], grouped: [], aliasIndex: h.aliasIndex || ALIAS_INDEX }),
}));

import FindJobs from '../pages/FindJobs';

const SALES = {
  id: 1,
  title: 'Sales Assistant',
  company: 'CJTECH Computer Trading',
  location: 'Sangi, Toledo City',
  salary: '₱15,000 / month',
  description: 'Assist customers on the shop floor and operate the till.',
  requirements: ['Excel', 'Customer Service'],
  icon: '🏪',
  status: 'published',
  max_applicants: 0,
  created_at: '2026-01-01T00:00:00Z',
};

const TECH = {
  id: 2,
  title: 'Computer Technician',
  company: 'CJTECH Computer Trading',
  location: 'Sangi, Toledo City',
  salary: '₱18,000 / month',
  description: 'Diagnose and repair customer units.',
  requirements: ['Computer Hardware Repair'],
  icon: '💻',
  status: 'published',
  max_applicant: 0,
  created_at: '2026-01-02T00:00:00Z',
};

function renderFindJobs() {
  return render(
    <MemoryRouter>
      <FindJobs />
    </MemoryRouter>
  );
}

function search(term) {
  fireEvent.change(screen.getByPlaceholderText(/Search title, description or skill/), {
    target: { value: term },
  });
}

beforeEach(() => {
  h.fromQueue = [{ data: [SALES, TECH], error: null }];
  h.fromCalls = [];
  h.rpcCalls = [];
  h.profile = null;
  h.aliasIndex = {};
});

describe('FindJobs — searching', () => {
  it('finds a job by a skill listed in its requirements', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('excel');

    expect(await screen.findByText('Sales Assistant')).toBeInTheDocument();
    expect(screen.queryByText('Computer Technician')).toBeNull();
    expect(screen.getByText('1 job found')).toBeInTheDocument();
  });

  it('still finds a job by its title', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('technician');

    expect(await screen.findByText('Computer Technician')).toBeInTheDocument();
    expect(screen.queryByText('Sales Assistant')).toBeNull();
  });

  it('still finds a job by its description', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('till');

    expect(await screen.findByText('Sales Assistant')).toBeInTheDocument();
  });

  it('ignores case', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('EXCEL');

    expect(await screen.findByText('Sales Assistant')).toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('nursing');

    expect(await screen.findByText(/No jobs match your search/)).toBeInTheDocument();
  });

  it('shows everything again once the search is cleared', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    search('excel');
    await screen.findByText('1 job found');

    fireEvent.click(screen.getByRole('button', { name: '✕' }));

    expect(await screen.findByText('2 jobs found')).toBeInTheDocument();
    expect(screen.getByText('Computer Technician')).toBeInTheDocument();
  });
});

describe('FindJobs — only published jobs are advertised', () => {
  it('asks the database for published jobs', async () => {
    renderFindJobs();
    await screen.findByText('Sales Assistant');

    expect(h.fromCalls[0]).toBe('jobs');
  });

  it('keeps working when the status column has not been migrated yet', async () => {
    // A frontend deployed ahead of its migration: the filter errors, data
    // comes back null, and the board must not go empty over that gap.
    h.fromQueue = [
      { data: null, error: { message: 'column jobs.status does not exist' } },
      { data: [SALES, TECH], error: null },
    ];

    renderFindJobs();

    expect(await screen.findByText('Sales Assistant')).toBeInTheDocument();
    expect(screen.getByText('Computer Technician')).toBeInTheDocument();
    // Two attempts: the filtered one, then the unfiltered fallback.
    expect(h.fromCalls.filter((n) => n === 'jobs')).toHaveLength(2);
  });
});

describe('FindJobs — the match badge', () => {
  it('scores the applicant against the requirements using the alias index', async () => {
    // The job asks for "Good communication"; the applicant picked
    // "Communication" from the catalog. They are the same skill.
    h.profile = { skills: 'Communication' };
    h.aliasIndex = { 'good communication': 'Communication' };
    h.fromQueue = [
      {
        data: [
          { ...SALES, requirements: ['Good communication'] },
        ],
        error: null,
      },
    ];

    renderFindJobs();

    expect(await screen.findByText('100% Match')).toBeInTheDocument();
  });

  it('shows a low score when the applicant is missing requirements', async () => {
    h.profile = { skills: 'Teamwork' };
    h.fromQueue = [{ data: [SALES], error: null }];

    renderFindJobs();

    expect(await screen.findByText('0% Match')).toBeInTheDocument();
  });

  it('shows no badge at all when the applicant has listed nothing', async () => {
    h.profile = { skills: '' };
    h.fromQueue = [{ data: [SALES], error: null }];

    renderFindJobs();

    await screen.findByText('Sales Assistant');
    expect(screen.queryByText(/% Match/)).toBeNull();
  });
});
