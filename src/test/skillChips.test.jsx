import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillChips from '../components/SkillChips';

/**
 * One component folds skill lists for the records table, the applicant's own
 * application detail, the user list and both applicant detail cards. When the
 * limit moves or the toggle wording changes, it moves for all four — which is
 * the point, and is why the limit is now a prop rather than a constant that
 * every page had to work around.
 */

const SKILLS = 'Excel, Word, React, CSS, SQL, Git, Docker, Kubernetes';

describe('SkillChips — the fold', () => {
  it('shows four by default and says how many it is holding back', () => {
    render(<SkillChips skills={SKILLS} />);

    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    // Four in, four held back — never eight dumped at once.
    expect(screen.queryByText('Git')).toBeNull();
    expect(screen.queryByText('Kubernetes')).toBeNull();

    expect(screen.getByRole('button', { name: 'Show 4 more skills' })).toHaveTextContent('+4 more');
  });

  it('reveals the rest and offers a way back', () => {
    render(<SkillChips skills={SKILLS} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more skills' }));

    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    // The label is the accessible name; the text is what is drawn. Both are
    // pinned, because a screen reader and a glance have to agree.
    expect(screen.getByRole('button', { name: 'Show fewer skills' })).toHaveTextContent('Show less');

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer skills' }));
    expect(screen.queryByText('Docker')).toBeNull();
  });

  it('takes a shorter preview when the page asks for one', () => {
    // A table cell has room for two; a detail card has room for more. Same
    // component, same behaviour, different ceiling.
    render(<SkillChips skills={SKILLS} visible={2} />);

    expect(screen.getByText('Word')).toBeInTheDocument();
    expect(screen.queryByText('React')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show 6 more skills' })).toBeInTheDocument();
  });

  it('has nothing to fold when the whole list fits', () => {
    render(<SkillChips skills="Excel, Word" />);

    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('Word')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says so rather than rendering an empty row', () => {
    render(<SkillChips skills="" />);
    expect(screen.getByText('Not set')).toBeInTheDocument();

    render(<SkillChips skills={null} />);
    expect(screen.getAllByText('Not set')).toHaveLength(2);
  });

  it('survives the messy shapes a skills column actually arrives in', () => {
    render(<SkillChips skills=" Excel , , Word ," />);

    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('Word')).toBeInTheDocument();
    // Two entries only, so the blanks never become blank chips.
    expect(screen.queryByRole('button')).toBeNull();
  });
});
