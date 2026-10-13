import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ManageJobs is where a posting is written. Requirements used to be a
// comma-separated string split on save, which is how "Good communication"
// and "Communication Skills" came to be two different skills — and
// applicants build their own dropdown out of whatever jobs list, so every
// such split became permanent.

const h = vi.hoisted(() => ({
  jobs: [],
  reads: [],
  writes: [],
  rpc: [],
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      h.reads.push(table);
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        in: () => q,
        insert: (payload) => { h.writes.push({ table, op: 'insert', payload }); return q; },
        update: (payload) => { h.writes.push({ table, op: 'update', payload }); return q; },
        then: (ok, err) => Promise.resolve({ data: h.jobs, error: null }).then(ok, err),
      };
      return q;
    },
    rpc(name) {
      h.rpc.push(name);
      return { then: (ok, err) => Promise.resolve({ data: [], error: null }).then(ok, err) };
    },
  },
}));

vi.mock('../lib/aiSkillMatch', () => ({
  aiSkillMatch: vi.fn().mockResolvedValue({ matched: 0, total: 0, score: 0 }),
}));

vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: () =>
    Promise.resolve({
      options: ['Excel', 'Customer Service', 'Communication'],
      grouped: [{ category: 'Office & Admin', skills: ['Customer Service', 'Excel'] }],
      aliasIndex: {},
    }),
}));

import ManageJobs from '../pages/ManageJobs';

const JOB = {
  id: 1,
  title: 'Sales Assistant',
  company: 'CJTECH Computer Trading',
  location: 'Sangi, Toledo City',
  salary: '₱15,000 / month',
  description: 'Assist customers.',
  requirements: ['Excel', 'Customer Service'],
  icon: '🏪',
  status: 'published',
  max_applicants: 0,
  created_at: '2026-01-01T00:00:00Z',
};

const jobWrites = () => h.writes.filter((w) => w.table === 'jobs');

async function openNewJobForm() {
  render(<ManageJobs />);
  await screen.findByText('Manage Jobs');
  fireEvent.click(screen.getByRole('button', { name: '+ New Job' }));
  await screen.findByText('Create New Job');
}

async function pickSkill(name) {
  fireEvent.click(screen.getByRole('button', { name: /Pick the skills this job needs/ }));
  fireEvent.click(await screen.findByLabelText(name));
}

function title(value) {
  fireEvent.change(screen.getByPlaceholderText('e.g. Sales Assistant'), {
    target: { value },
  });
}

beforeEach(() => {
  h.jobs = [JOB];
  h.reads = [];
  h.writes = [];
  h.rpc = [];
});

describe('ManageJobs — requirements are picked, not typed', () => {
  it('offers the catalog in the create form', async () => {
    await openNewJobForm();
    expect(screen.getByRole('button', { name: /Pick the skills this job needs/ })).toBeInTheDocument();
    // The old free-text field is gone.
    expect(screen.queryByPlaceholderText('e.g. High school graduate')).toBeNull();
  });

  it('sends requirements as an ARRAY, never a split string', async () => {
    await openNewJobForm();
    title('Front Desk Clerk');
    await pickSkill('Excel');

    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].op).toBe('insert');
    expect(jobWrites()[0].payload.requirements).toEqual(['Excel']);
    expect(Array.isArray(jobWrites()[0].payload.requirements)).toBe(true);
  });

  it('defaults a new job to published', async () => {
    await openNewJobForm();
    title('Front Desk Clerk');

    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].payload.status).toBe('published');
  });

  it('refuses to save a job with no title', async () => {
    await openNewJobForm();
    await pickSkill('Excel');

    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    expect(jobWrites()).toHaveLength(0);
    expect(await screen.findByText('A job title is required.')).toBeInTheDocument();
  });

  it('prefills an existing job with its requirements as an array', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit Job');

    // Both requirements are on the trigger, so the picker holds two entries
    // rather than one comma-joined string.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pick the skills this job needs/ })).toBeInTheDocument();
  });

  it('writes the array back unchanged on update', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Edit Job');

    fireEvent.click(screen.getByRole('button', { name: 'Update Job' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].op).toBe('update');
    expect(jobWrites()[0].payload.requirements).toEqual(['Excel', 'Customer Service']);
  });
});

describe('ManageJobs — custom skills', () => {
  it('adds an uncatalogued skill to the posting AND to the catalog', async () => {
    await openNewJobForm();
    title('Accounting Clerk');

    fireEvent.click(screen.getByRole('button', { name: /Pick the skills this job needs/ }));
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'QuickBooks' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add “QuickBooks”/ }));

    await waitFor(() => {
      const skillWrite = h.writes.find((w) => w.table === 'skills');
      expect(skillWrite).toBeTruthy();
      expect(skillWrite.payload.name).toBe('QuickBooks');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));
    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].payload.requirements).toEqual(['QuickBooks']);
  });
});

describe('ManageJobs — closing replaces deleting', () => {
  it('offers Close, never Delete', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('closes a job by setting its status, and keeps the row', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].op).toBe('update');
    expect(jobWrites()[0].payload).toEqual({ status: 'closed' });
    // The row is still listed — it is closed, not destroyed.
    expect(screen.getByText('Sales Assistant')).toBeInTheDocument();
  });

  it('reopens a closed job', async () => {
    h.jobs = [{ ...JOB, status: 'closed' }];
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].payload).toEqual({ status: 'published' });
  });

  it('shows a status chip on every row', async () => {
    h.jobs = [{ ...JOB }, { ...JOB, id: 2, title: 'Draft Role', status: 'draft' }];
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');

    expect(screen.getAllByText('published')).toHaveLength(1);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('treats a row from before the migration as published', async () => {
    // No `status` key at all — the column did not exist when it was written.
    const legacy = { ...JOB };
    delete legacy.status;
    h.jobs = [legacy];
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');

    expect(screen.getByText('published')).toBeInTheDocument();
    // Still closable, because closing is what brings it in line.
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('ManageJobs — visibility in the form', () => {
  it('sends whatever status is chosen', async () => {
    await openNewJobForm();
    title('Back Office Clerk');

    fireEvent.change(screen.getByDisplayValue('Published — visible to applicants'), {
      target: { value: 'draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

    await waitFor(() => expect(jobWrites()).toHaveLength(1));
    expect(jobWrites()[0].payload.status).toBe('draft');
  });

  it('defaults the visibility select to published', async () => {
    await openNewJobForm();
    expect(screen.getByDisplayValue('Published — visible to applicants')).toBeInTheDocument();
  });
});
