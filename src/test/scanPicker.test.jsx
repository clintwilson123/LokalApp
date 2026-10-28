import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Manage Jobs ranks a job's OWN applicants, so its scan panel has an option the
 * Admin Applicants page cannot offer: Quick scan, backed by the free local
 * pre-ranker. What both pages must share is the decision band — ticked people,
 * the whole roster, and the counted action, all in one place, with the count in
 * front of you before you press it.
 *
 * These tests pin that band down on the page that has the widest set of
 * options, because it is the one most likely to grow a fourth button and
 * quietly stop matching the other screen.
 */

const h = vi.hoisted(() => ({
  jobs: [],
  apps: [],
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
        insert: () => q,
        update: () => q,
        then: (ok, err) => {
          const result =
            table === 'jobs' ? { data: h.jobs, error: null }
            : table === 'applications' ? { data: h.apps, error: null }
            : table === 'profiles' ? { data: h.profiles, error: null }
            : table === 'interviews' ? { data: h.interviews, error: null }
            : { data: [], error: null };
          return Promise.resolve(result).then(ok, err);
        },
      };
      return q;
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
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
    Promise.resolve({ options: ['Excel', 'Word'], grouped: [], aliasIndex: {} }),
}));

import ManageJobs from '../pages/ManageJobs';
import { aiSkillMatch } from '../lib/aiSkillMatch';

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

const NAMES = ['Maria Santos', 'Ana Reyes', 'Ben Cruz', 'Cara Lim'];

beforeEach(() => {
  h.jobs = [JOB];
  h.apps = NAMES.map((_, i) => ({
    id: 101 + i,
    user_id: `p${i + 1}`,
    job_id: 1,
    status: 'pending',
    score: null,
  }));
  h.profiles = NAMES.map((name, i) => ({
    id: `p${i + 1}`,
    full_name: name,
    skills: 'Excel',
    location: 'Toledo City',
    phone_number: '09171234567',
    resume_url: '',
    bio: '',
  }));
  h.interviews = [];
  aiSkillMatch.mockClear();
});

/** Walk Manage Jobs -> the job's Applicants panel. */
async function openPicker() {
  render(<ManageJobs />);
  await screen.findByText('Manage Jobs');
  fireEvent.click(screen.getByRole('button', { name: 'Applicants' }));
  await screen.findByText('Choose applicants to score against Sales Assistant');
}

describe('Scan panel — every way of starting a scan sits together', () => {
  it('offers picking, Quick scan and Scan all in the one decision band', async () => {
    await openPicker();

    expect(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select all 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();

    // Whole-roster routes, and the counted one. All three are present before
    // anything is ticked, because the choice of scope is the whole point.
    expect(screen.getByRole('button', { name: /Quick scan/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🧠 Scan all 4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze Selected Applicants (0)' })).toBeInTheDocument();

    // Nothing charged until a scope is chosen.
    expect(aiSkillMatch).not.toHaveBeenCalled();
  });

  it('states how many people are about to be charged, and blocks until some are', async () => {
    await openPicker();

    const blocked = screen.getByRole('button', { name: 'Analyze Selected Applicants (0)' });
    expect(blocked).toBeDisabled();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' }));

    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();
    expect(screen.getByText('1 of 4 ready to scan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze Selected Applicants (1)' })).toBeEnabled();
  });

  it('Clear empties the ticks without emptying the roster', async () => {
    await openPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Select all 4' }));
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText('0 of 4 selected')).toBeInTheDocument();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    // The people are still there to pick from again.
    expect(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' })).toBeInTheDocument();
  });
});

describe('Scan panel — each scope sends exactly what it promises', () => {
  it('Analyze Selected sends only the people who were ticked', async () => {
    await openPicker();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (1)' }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('Analyzed results')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.queryByText('Ana Reyes')).toBeNull();
    // A bare count reads as a total: this says how much of the roster it left out.
    expect(screen.getByText('Your selection: 1 of 4')).toBeInTheDocument();
  });

  it('Scan all sends everyone, ignoring what is ticked', async () => {
    await openPicker();

    // Ticked one, then asked for the whole roster — the explicit button wins,
    // and the selection is not silently reinterpreted as the scope.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' }));
    fireEvent.click(screen.getByRole('button', { name: '🧠 Scan all 4' }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(4));

    expect(await screen.findByText('Analyzed results')).toBeInTheDocument();
    expect(screen.getByText('4 applicants — the whole roster')).toBeInTheDocument();
    expect(screen.getByText('Cara Lim')).toBeInTheDocument();
  });

  it('Quick scan pre-ranks first and says how much of the roster it used', async () => {
    await openPicker();

    fireEvent.click(screen.getByRole('button', { name: /Quick scan/ }));

    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalled());

    expect(await screen.findByText('Analyzed results')).toBeInTheDocument();
    expect(screen.getByText(/^Quick scan: top \d+ of 4 by local skill match/)).toBeInTheDocument();
  });
});

describe('Scan panel — going back does not cost the answers', () => {
  it('returns to the panel with the previous ticks intact', async () => {
    await openPicker();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (1)' }));
    await waitFor(() => expect(aiSkillMatch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /Change selection/ }));

    // Nobody has to remember and re-select what they chose a moment ago.
    expect(screen.getByText('Choose applicants to score against Sales Assistant')).toBeInTheDocument();
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Analyze Maria Santos' })).toBeChecked();
  });
});
