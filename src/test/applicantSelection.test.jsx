import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ApplicantSelection, { AnalyzeSelectedButton } from '../components/ApplicantSelection';

// Before this, "who gets quota spent on them" was all-or-nothing. An employer
// who already knew they wanted three people out of forty had no way to say so.
// These tests pin the picker that gave them one: bulk select, individual
// ticks, and the live count in the button that is about to charge Gemini.

const people = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${i + 1}`,
    full_name: `Applicant ${i + 1}`,
    location: 'Toledo City',
    skills: '',
  }));

/** Drives the component with real state, so `onChange` round-trips like it does in the pages. */
function Harness({ items, initial = [], ...props }) {
  const [ids, setIds] = useState(initial);
  return <ApplicantSelection items={items} selectedIds={ids} onChange={setIds} {...props} />;
}

describe('ApplicantSelection — checkboxes', () => {
  it('renders one labelled checkbox per applicant', () => {
    render(<Harness items={people(3)} />);
    expect(screen.getByRole('checkbox', { name: 'Analyze Applicant 1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Analyze Applicant 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('toggles a single applicant and keeps the rest of the selection', () => {
    render(<Harness items={people(4)} />);
    const first = screen.getByRole('checkbox', { name: 'Analyze Applicant 1' });

    fireEvent.click(first);
    expect(first).toBeChecked();
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 3' }));
    expect(first).toBeChecked();
    expect(screen.getByText('2 of 4 selected')).toBeInTheDocument();

    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();
  });

  it('numbers the rows in list order, so the tally above is countable', () => {
    render(<Harness items={people(7)} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows an empty state instead of an empty toolbar', () => {
    render(<Harness items={[]} emptyMessage="No applicants for this job yet." />);
    expect(screen.getByText('No applicants for this job yet.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('ApplicantSelection — bulk controls', () => {
  it('selects everyone at once, then offers to clear them', () => {
    render(<Harness items={people(9)} />);
    expect(screen.getByText('0 of 9 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select all 9' }));
    expect(screen.getByText('9 of 9 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getByText('0 of 9 selected')).toBeInTheDocument();
  });

  it('Clear empties the selection but leaves it when already empty', () => {
    render(<Harness items={people(4)} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 2' }));
    expect(screen.getByText('1 of 4 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 of 4 selected')).toBeInTheDocument();
    // Nothing left to clear, so the control is inert rather than a no-op click.
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('Select all is aware of a selection made one tick at a time', () => {
    render(<Harness items={people(4)} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 2' }));
    // Not all selected yet, so the button still reads as "take the rest too".
    fireEvent.click(screen.getByRole('button', { name: 'Select all 4' }));
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('reports the live state in the toolbar and the footer', () => {
    render(<Harness items={people(5)} />);
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(screen.getByText('Tick applicants above to enable the scan.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 1' }));
    expect(screen.getByText('1 of 5 ready to scan')).toBeInTheDocument();
    expect(screen.getByText('Your selection is kept — change it and run again any time.')).toBeInTheDocument();
  });
});

describe('ApplicantSelection — the skills preview', () => {
  const roster = [
    { id: 'u1', full_name: 'Ana Reyes', location: 'Toledo City', skills: 'Excel, Word' },
    { id: 'u2', full_name: 'Ben Cruz', location: 'Toledo City', skills: 'React, JS, CSS, SQL, Git' },
    { id: 'u3', full_name: 'Cal Wong', location: null, skills: null },
  ];

  // A name and a town say nothing about whether a person is worth a Gemini
  // call — the skills are the whole reason an employer can decide.
  it('shows the skills that justify the decision', () => {
    render(<Harness items={roster} />);
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('Word')).toBeInTheDocument();
  });

  it('folds a long skill list instead of overflowing the card', () => {
    render(<Harness items={roster} />);
    // React, JS, CSS are shown…
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    // …and SQL + Git are behind a "+2", not dropped off the card.
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('SQL')).toBeNull();
    expect(screen.queryByText('Git')).toBeNull();
  });

  it('renders a person with no location and no skills without crashing', () => {
    render(<Harness items={roster} />);
    expect(screen.getByText('Cal Wong')).toBeInTheDocument();
    expect(screen.getByText('No location set')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Analyze Cal Wong' })).toBeInTheDocument();
  });
});

describe('ApplicantSelection — the dynamic action button', () => {
  it('carries the live count, because that is what is about to be charged', () => {
    render(<Harness items={people(6)} onAnalyze={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Analyze Selected Applicants (0)' })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select all 6' }));
    expect(
      screen.getByRole('button', { name: 'Analyze Selected Applicants (6)' })
    ).toBeEnabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Analyze Applicant 3' }));
    expect(
      screen.getByRole('button', { name: 'Analyze Selected Applicants (5)' })
    ).toBeEnabled();
  });

  it('reports how many were chosen when pressed', () => {
    const onAnalyze = vi.fn();
    render(<Harness items={people(6)} onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select all 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (6)' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed with nobody checked', () => {
    const onAnalyze = vi.fn();
    render(<Harness items={people(3)} onAnalyze={onAnalyze} />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Selected Applicants (0)' }));
    expect(onAnalyze).not.toHaveBeenCalled();
  });

  it('is hidden when the page passes no handler', () => {
    render(<Harness items={people(3)} />);
    expect(screen.queryByRole('button', { name: /Analyze Selected/ })).toBeNull();
    // The checkboxes are still meaningful — the page may drive them itself.
    expect(screen.getByRole('checkbox', { name: 'Analyze Applicant 1' })).toBeInTheDocument();
  });
});

describe('AnalyzeSelectedButton', () => {
  it('is inert until somebody is checked', () => {
    const onClick = vi.fn();
    const { unmount } = render(<AnalyzeSelectedButton count={0} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Analyze Selected Applicants \(0\)/ }));
    expect(onClick).not.toHaveBeenCalled();
    unmount();

    render(<AnalyzeSelectedButton count={3} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Analyze Selected Applicants \(3\)/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
