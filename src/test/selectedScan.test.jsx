import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Spending Gemini quota is the one thing on this page with a real cost. The
// panel used to offer three competing ways to choose — Quick Scan, Analyze
// all, and a tickable roster — and the first two answered a question the
// checkboxes already answer better. These tests pin what is left: tick who you
// want, see the count, and pay for exactly that many calls.

const h = vi.hoisted(() => ({
  jobs: [],
  profiles: [],
  interviews: [],
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table) {
      const q = {
        select: () => q,
        order: () => q,
        eq: () => q,
        in: () => q,
        then: (ok, err) => {
          const result =
            table === 'jobs' ? { data: h.jobs, error: null }
            : table === 'profiles' ? { data: h.profiles, error: null }
            : table === 'interviews' ? { data: h.interviews, error: null }
            : { data: [], error: null };
          return Promise.resolve(result).then(ok, err);
        },
      };
      return q;
    },
  },
}));

vi.mock('../lib/aiSkillMatch', () => ({
  aiSkillMatch: vi.fn(async () => ({
    matched: 1, total: 2, score: 50, basicScore: 50,
    matchedItems: ['Excel'], missingItems: ['Word'], explanation: '',
  })),
}));

vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: vi.fn(async () => ({ aliasIndex: {}, options: [], grouped: [] })),
}));

import AdminApplicants from '../pages/AdminApplicants';
import { aiSkillMatch } from '../lib/aiSkillMatch';

const JOB = {
  id: 1,
  title: 'Sales Assistant',
  company: 'CJTECH Computer Trading',
  location: 'Sangi, Toledo City',
  requirements: ['Excel'],
  icon: '🏪',
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
};

const OTHER_JOB = { ...JOB, id: 2, title: 'Software Developer' };

const REGISTRANTS = Array.from({ length: 10 }, (_, i) => ({
  id: `u${i + 1}`,
  full_name: `Applicant ${i + 1}`,
  skills: 'Excel',
  location: 'Toledo City',
  phone_number: '',
  bio: '',
  resume_url: null,
  created_at: '2026-01-01T00:00:00Z',
}));

/** Mounts the page and picks a job so the selection panel renders. */
async function chooseJob(job = JOB) {
  render(<AdminApplicants />);
  await screen.findByText('Applicants');
  fireEvent.change(screen.getByLabelText('Rank applicants against a job'), {
    target: { value: String(job.id) },
  });
  await screen.findByText(`Choose applicants to score against ${job.title}`);
}

beforeEach(() => {
  // Both postings are always listed, so a test can switch between them.
  h.jobs = [JOB, OTHER_JOB];
  h.profiles = REGISTRANTS;
  h.interviews = [];
  aiSkillMatch.mockClear();
});

describe('Analyze Selected — only the checked subset is billed', () => {
  it('spends exactly one call on one ticked applicant', async () => {
    await chooseJob();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (1)' }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(1));
    // Ten people were on the roster; only one was asked for.
    expect(screen.getByText('Your selection: 1 of 10')).toBeInTheDocument();
  });

  it('an unticked applicant never reaches the model', async () => {
    await chooseJob();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 2' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 7' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (2)' }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(2));

    // Applicant 4 sits between the two ticked rows — it must not have been
    // swept in, and applicant 10 sits after the second.
    expect(aiSkillMatch.mock.calls).toHaveLength(2);
    expect(screen.getByText('Your selection: 2 of 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change selection/ })).toBeInTheDocument();
  });

  it('Select all runs the whole roster, and the button says so', async () => {
    await chooseJob();

    fireEvent.click(screen.getByRole('button', { name: 'Select all 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (10)' }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(10));
    expect(screen.getByText('Your selection: 10 of 10')).toBeInTheDocument();
  });

  it('cannot start a scan with nobody checked', async () => {
    await chooseJob();

    const button = screen.getByRole('button', { name: 'Analyze Selected Applicants (0)' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(aiSkillMatch).not.toHaveBeenCalled();
  });

  it('the pre-ranker is gone — nothing here runs behind the checkboxes', async () => {
    await chooseJob();
    expect(screen.queryByText(/pre-ranker/i)).toBeNull();
    // No Quick scan on this page: these are registered profiles rather than a
    // job's own applicants, so there is no requirement to pre-rank them
    // against. The whole-roster route that remains is an ordinary, visible
    // button, sitting beside Select all instead of replacing it.
    expect(screen.queryByRole('button', { name: /Quick scan/ })).toBeNull();
    expect(screen.getByRole('button', { name: '🧠 Scan all 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select all 10' })).toBeInTheDocument();
  });
});

describe('Analyze Selected — going back does not cost the answers', () => {
  it('returns to the panel with the previous ticks intact', async () => {
    await chooseJob();

    fireEvent.click(screen.getByRole('button', { name: 'Select all 10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (10)' }));
    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(10));

    fireEvent.click(screen.getByRole('button', { name: /Change selection/ }));

    // Back on the panel, and the selection is still ticked — nobody has to
    // remember and re-select what they chose a moment ago.
    expect(
      screen.getByText('Choose applicants to score against Sales Assistant')
    ).toBeInTheDocument();
    expect(screen.getByText('10 of 10 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Analyze Applicant 10' })).toBeChecked();
    // Re-deriving it costs nothing: no new call was made by going back.
    expect(aiSkillMatch).toHaveBeenCalledTimes(10);
  });
});

describe('Analyze Selected — the selection belongs to the job', () => {
  it('a different posting starts with a clean slate', async () => {
    await chooseJob();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 4' }));
    expect(screen.getByText('1 of 10 selected')).toBeInTheDocument();

    // Switch postings. The tick was made against Sales Assistant; carrying it
    // over would silently decide who gets charged for Software Developer.
    fireEvent.change(screen.getByLabelText('Rank applicants against a job'), {
      target: { value: '2' },
    });
    await screen.findByText('Choose applicants to score against Software Developer');

    expect(screen.getByText('0 of 10 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Analyze Applicant 4' })).not.toBeChecked();
    expect(aiSkillMatch).not.toHaveBeenCalled();
  });
});

describe('Analyze Selected — the applicant card after the scan', () => {
  /** Scan one applicant and open their card. */
  async function openFirstCard() {
    await chooseJob();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (1)' }));
    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Applicant 1'));
    await screen.findByText('← Back to applicants');
  }

  it('reads as labelled sections, not one undifferentiated list', async () => {
    // A second skill, so the applicant's own skill chips can be told apart
    // from the matched-skill list — the mocked matcher also returns "Excel",
    // and asserting on it would match both.
    h.profiles[0] = { ...h.profiles[0], skills: 'Excel, Budgeting' };

    await openFirstCard();

    // Before this the card was `Skills: <everything>, Location: ..., Phone:
    // ...` run together — no grouping, and the skills arrived as one comma
    // string long enough to push everything else off the screen.
    expect(screen.getByText('How they score')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();

    // Matched/missing are named as their own groups rather than trailing the
    // score, because they are the reason for it.
    expect(screen.getByText('Matched Skills')).toBeInTheDocument();
    expect(screen.getByText('Missing Skills')).toBeInTheDocument();

    // The skills are chips, one per skill, not a single blob of text.
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Budgeting')).toBeInTheDocument();
    expect(screen.getAllByText('Excel').length).toBeGreaterThan(0);
  });

  it('shows a scheduled interview for this applicant', async () => {
    h.interviews = [{
      id: 1,
      date: '2026-11-04',
      time: '14:30:00',
      location: 'CJTECH Shop',
      instructions: 'Bring two copies of your resume.',
      status: 'scheduled',
      applications: { user_id: 'u1', job_id: 1, jobs: { title: 'Sales Assistant' } },
    }];

    await openFirstCard();

    // Booking happens on Manage Jobs, so without this the admin had no way to
    // see the appointment from the page they were actually on.
    expect(await screen.findByText('Scheduled interview')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, November 4, 2026')).toBeInTheDocument();
    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    expect(screen.getByText('CJTECH Shop')).toBeInTheDocument();
    expect(screen.getByText('Bring two copies of your resume.')).toBeInTheDocument();
    // Which posting it is for, since an applicant can interview for several.
    expect(screen.getByText('Sales Assistant')).toBeInTheDocument();
  });

  it('leaves the section out entirely when nobody has an interview', async () => {
    await openFirstCard();

    expect(screen.queryByText('Scheduled interview')).toBeNull();
    // The rest of the card is unaffected.
    expect(screen.getByText('How they score')).toBeInTheDocument();
  });

  it('shows an interview that belongs to somebody else only on that person', async () => {
    h.interviews = [{
      id: 7,
      date: '2026-11-06',
      time: '09:00:00',
      location: 'CJTECH Shop',
      instructions: '',
      status: 'scheduled',
      // Applicant 2's application, not Applicant 1's.
      applications: { user_id: 'u2', job_id: 1, jobs: { title: 'Sales Assistant' } },
    }];

    await openFirstCard();

    expect(screen.queryByText('Scheduled interview')).toBeNull();
  });
});
