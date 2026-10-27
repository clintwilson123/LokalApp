import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Scheduling an interview used to fail invisibly. handleScheduleInterview
// returned without a word when a field was missing, and on a database error
// it fell straight through an `if (!error)` — so the button did nothing and
// nothing said why. The modal also kept only the application id, so a date
// and time could be set with no indication of which person they were for.

const h = vi.hoisted(() => ({
  jobs: [],
  apps: [],
  profiles: [],
  writes: [],
  failInterviewInsert: false,
  failStatusUpdate: false,
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        in: () => q,
        insert: (payload) => { h.writes.push({ table, op: 'insert', payload }); return q; },
        update: (payload) => { q._op = 'update'; h.writes.push({ table, op: 'update', payload }); return q; },
        then: (ok, err) => {
          let result = { data: null, error: null };
          if (table === 'jobs') result = { data: h.jobs, error: null };
          if (table === 'applications') result = { data: h.apps, error: null };
          if (table === 'profiles') result = { data: h.profiles, error: null };
          if (table === 'interviews' && h.failInterviewInsert) {
            result = { data: null, error: { message: 'permission denied for table interviews' } };
          }
          if (table === 'applications' && q._op === 'update' && h.failStatusUpdate) {
            result = { data: null, error: { message: 'row was locked' } };
          }
          return Promise.resolve(result).then(ok, err);
        },
      };
      return q;
    },
    rpc() {
      return { then: (ok, err) => Promise.resolve({ data: [], error: null }).then(ok, err) };
    },
  },
}));

vi.mock('../lib/aiSkillMatch', () => ({
  aiSkillMatch: vi.fn().mockResolvedValue({
    matched: 1, total: 2, score: 50, basicScore: 50,
    matchedItems: ['Excel'], missingItems: ['Word'], explanation: '',
  }),
}));

vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: () =>
    Promise.resolve({ options: ['Excel'], grouped: [], aliasIndex: {} }),
}));

import ManageJobs from '../pages/ManageJobs';

const JOB = {
  id: 1,
  title: 'Sales Assistant',
  company: 'CJTECH Computer Trading',
  location: 'Sangi, Toledo City',
  salary: '₱15,000 / month',
  description: 'Assist customers.',
  requirements: ['Excel', 'Word'],
  icon: '🏪',
  status: 'published',
  max_applicants: 0,
  created_at: '2026-01-01T00:00:00Z',
};

const interviewWrites = () => h.writes.filter((w) => w.table === 'interviews');

/**
 * Opening a job now stops at the scan picker — the admin chooses Quick Scan or
 * a full run instead of having quota spent automatically. Start a full run so
 * the ranked grid (and every card these tests click) exists.
 */
async function startScan() {
  fireEvent.click(await screen.findByRole('button', { name: /Analyze all/ }));
}

/** Walks Manage Jobs -> Applicants -> the applicant's detail view. */
async function openApplicant() {
  render(<ManageJobs />);
  await screen.findByText('Manage Jobs');
  fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
  await startScan();
  fireEvent.click(await screen.findByText('Maria Santos'));
  await screen.findByText('← Back to applicants');
}

function fillModal() {
  fireEvent.change(screen.getByLabelText('Date *'), { target: { value: '2026-10-20' } });
  fireEvent.change(screen.getByLabelText('Time *'), { target: { value: '14:30' } });
  // No location field any more — CJLink has one, so it is filled in for you.
}

beforeEach(() => {
  h.jobs = [JOB];
  h.apps = [{ id: 101, user_id: 'u1', job_id: 1, status: 'pending', score: null }];
  h.profiles = [{
    id: 'u1',
    full_name: 'Maria Santos',
    skills: 'Excel',
    location: 'Toledo City',
    phone_number: '09171234567',
    bio: '',
    resume_url: null,
  }];
  h.writes = [];
  h.failInterviewInsert = false;
  h.failStatusUpdate = false;
});

describe('Schedule Interview — the modal says who it is for', () => {
  it('shows the applicant inside the modal, not just behind it', async () => {
    await openApplicant();

    // Only the detail heading carries the name while the modal is closed —
    // the applicant list is not in the DOM in this view.
    const before = screen.getAllByText('Maria Santos').length;
    expect(before).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));

    // The 📞 form is unique to the banner: the detail view writes it as
    // "Phone: ...".
    expect(await screen.findByText('📞 09171234567')).toBeInTheDocument();
    expect(screen.getAllByText('Maria Santos').length).toBe(before + 1);
  });

  it('shows the job and the match score alongside the name', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));

    // The job title also appears in the list behind the overlay; this is the
    // banner's own combined line, so it is unique to the modal.
    expect(await screen.findByText('Sales Assistant · Toledo City')).toBeInTheDocument();
    expect(screen.getByText('50% match')).toBeInTheDocument();
  });

  it('does not leave the previous applicant on the form after closing', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    await screen.findByText('📞 09171234567');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('📞 09171234567')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    expect(await screen.findByText('📞 09171234567')).toBeInTheDocument();
  });
});

describe('Schedule Interview — scheduling', () => {
  it('writes the interview against the right application and confirms it', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(() => expect(interviewWrites()).toHaveLength(1));
    expect(interviewWrites()[0].payload).toMatchObject({
      application_id: 101,
      date: '2026-10-20',
      time: '14:30',
      location: 'CJTECH Shop',
      status: 'scheduled',
    });
    expect(await screen.findByText(/Interview scheduled for Maria Santos/)).toBeInTheDocument();
  });

  it('refuses a half-filled form OUT LOUD instead of doing nothing', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal();
    fireEvent.change(screen.getByLabelText('Time *'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(await screen.findByText(/Pick a date and a time/)).toBeInTheDocument();
    expect(interviewWrites()).toHaveLength(0);
    // The modal stays open so the field can be fixed.
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('reports a failed insert instead of silently doing nothing', async () => {
    h.failInterviewInsert = true;
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    expect(await screen.findByText(/Could not schedule the interview/)).toBeInTheDocument();
    expect(screen.getByText(/permission denied for table interviews/)).toBeInTheDocument();
    // Still open, nothing was scheduled.
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
  });

  it('does not claim success when only the status update failed', async () => {
    h.failStatusUpdate = true;
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    // The interview row itself went in, so this must not read as a total
    // failure — but it must not claim the status moved either.
    await waitFor(() => expect(interviewWrites()).toHaveLength(1));
    expect(
      await screen.findByText(/Interview scheduled, but .* status could not be updated/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Interview scheduled for Maria Santos\./)).toBeNull();
  });
});

describe('Schedule Interview — the location is fixed', () => {
  it('states the location instead of asking the admin to pick it', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));

    expect(await screen.findByText('CJTECH Shop')).toBeInTheDocument();

    // A dropdown offering one real answer is not a choice. It was also
    // required, so leaving it blank stalled scheduling with no visible error.
    expect(screen.queryByLabelText('Location *')).toBeNull();
    expect(document.getElementById('iv-location')).toBeNull();
  });

  it('writes CJTECH Shop without the admin ever entering it', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal(); // date and time only

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(() => expect(interviewWrites()).toHaveLength(1));
    expect(interviewWrites()[0].payload.location).toBe('CJTECH Shop');
    expect(screen.getByText(/Interview scheduled for Maria Santos/)).toBeInTheDocument();
  });

  it('no longer lets a missing location block scheduling', async () => {
    await openApplicant();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Interview' }));
    fillModal();

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    // Previously this stalled on "Select location" and said nothing.
    await waitFor(() => expect(interviewWrites()).toHaveLength(1));
    expect(screen.queryByText(/Pick a date and a time/)).toBeNull();
  });
});

describe('the admin can see who has been scheduled', () => {
  const asScheduled = () => {
    h.apps = [{ id: 101, user_id: 'u1', job_id: 1, status: 'interview_scheduled', score: null }];
  };

  it('shows the status on the applicant card, which carried none at all', async () => {
    asScheduled();
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
    await startScan();

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
    // Scheduling updated the row correctly and left nothing on screen to show
    // for it — you had to open each applicant to find out which had moved.
    expect(screen.getByText('interview scheduled')).toBeInTheDocument();
  });

  it('offers Reschedule and marks the detail as scheduled', async () => {
    asScheduled();
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
    await startScan();
    fireEvent.click(await screen.findByText('Maria Santos'));

    expect(await screen.findByRole('button', { name: 'Reschedule Interview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schedule Interview' })).toBeNull();
    expect(screen.getByText('interview scheduled')).toBeInTheDocument();
  });

  it('still reads pending on the detail when nothing is scheduled', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
    await startScan();
    fireEvent.click(await screen.findByText('Maria Santos'));

    expect(await screen.findByRole('button', { name: 'Schedule Interview' })).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.queryByText('interview scheduled')).toBeNull();
  });

  it('uses the same label on the card as in the detail', async () => {
    render(<ManageJobs />);
    await screen.findByText('Manage Jobs');
    fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
    await startScan();

    expect(await screen.findByText('pending')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Maria Santos'));
    await screen.findByText('← Back to applicants');
    // Card is not in the DOM in the detail view, so exactly one badge here.
    expect(screen.getAllByText('pending')).toHaveLength(1);
  });
});
