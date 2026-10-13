import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SkillPicker from '../components/SkillPicker';

// One picker for both sides of the marketplace. Applicants use it to say what
// they can do; admins use it to say what a job needs. It has to behave the
// same way for both or the two vocabularies drift apart again.

const CATALOG = [
  { category: 'Office & Admin', skills: ['Excel', 'Bookkeeping'] },
  { category: 'Soft Skills', skills: ['Communication', 'Teamwork'] },
];
const FLAT = CATALOG.flatMap((g) => g.skills);

function setup(props = {}) {
  const onChange = vi.fn();
  render(
    <SkillPicker
      selected={[]}
      onChange={onChange}
      options={FLAT}
      grouped={CATALOG}
      {...props}
    />
  );
  return { onChange };
}

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: /select skills/i }));
}

describe('SkillPicker — closed state', () => {
  it('shows the placeholder when nothing is selected', () => {
    setup({ placeholder: 'Pick skills...' });
    expect(screen.getByText('Pick skills...')).toBeInTheDocument();
  });

  it('shows the first three selections as chips plus a count', () => {
    setup({ selected: ['Excel', 'Bookkeeping', 'Communication', 'Teamwork'] });
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByText('Bookkeeping')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    // The fourth is folded into a count rather than a fourth chip.
    expect(screen.queryByText('Teamwork')).toBeNull();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('SkillPicker — choosing skills', () => {
  it('lists every option once opened', () => {
    setup();
    openPicker();
    FLAT.forEach((s) => expect(screen.getByText(s)).toBeInTheDocument());
  });

  it('groups options under their category when browsing', () => {
    setup();
    openPicker();
    expect(screen.getByText('Office & Admin')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
  });

  it('adds a skill on check and reports the new array', () => {
    const { onChange } = setup();
    openPicker();
    fireEvent.click(screen.getByLabelText('Excel'));
    expect(onChange).toHaveBeenCalledWith(['Excel']);
  });

  it('removes a skill on uncheck', () => {
    const { onChange } = setup({ selected: ['Excel', 'Teamwork'] });
    openPicker();
    fireEvent.click(screen.getByLabelText('Excel'));
    expect(onChange).toHaveBeenCalledWith(['Teamwork']);
  });

  it('removes a skill from its chip without opening the list', () => {
    const { onChange } = setup({ selected: ['Excel', 'Teamwork'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Excel' }));
    expect(onChange).toHaveBeenCalledWith(['Teamwork']);
    expect(screen.getByText('Teamwork')).toBeInTheDocument();
  });

  it('clears everything from the header row', () => {
    const { onChange } = setup({ selected: ['Excel', 'Teamwork'] });
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('SkillPicker — searching', () => {
  it('narrows the list to matches and drops the group headings', () => {
    setup();
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'commun' },
    });
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.queryByText('Excel')).toBeNull();
    // Group headers only help while browsing.
    expect(screen.queryByText('Office & Admin')).toBeNull();
  });

  it('says so when nothing matches', () => {
    setup();
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText(/No skills match "zzz"/)).toBeInTheDocument();
  });

  it('clears the search from the ✕ beside it', () => {
    setup();
    openPicker();
    const box = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(box, { target: { value: 'excel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Teamwork')).toBeInTheDocument();
  });
});

describe('SkillPicker — custom skills', () => {
  it('offers to add a skill the catalog does not have', () => {
    setup({ allowCustom: true, onCreateCustom: vi.fn() });
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'QuickBooks' },
    });
    expect(screen.getByRole('button', { name: /Add “QuickBooks”/ })).toBeInTheDocument();
  });

  it('does not offer to add something already in the catalog', () => {
    const onCreateCustom = vi.fn();
    setup({ allowCustom: true, onCreateCustom });
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'excel' },
    });
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull();
    expect(onCreateCustom).not.toHaveBeenCalled();
  });

  it('does not offer to add when allowCustom is off', () => {
    setup({ allowCustom: false, onCreateCustom: vi.fn() });
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'QuickBooks' },
    });
    expect(screen.queryByRole('button', { name: /Add/ })).toBeNull();
    expect(screen.getByText(/No skills match/)).toBeInTheDocument();
  });

  it('hands the trimmed name back and empties the search', () => {
    const onCreateCustom = vi.fn();
    setup({ allowCustom: true, onCreateCustom });
    openPicker();
    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: '  QuickBooks  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add “QuickBooks”/ }));
    expect(onCreateCustom).toHaveBeenCalledWith('QuickBooks');
    expect(screen.getByPlaceholderText('Search skills...')).toHaveValue('');
  });
});

describe('SkillPicker — closing', () => {
  it('closes on Escape', () => {
    setup();
    openPicker();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Excel')).toBeNull();
  });

  it('closes when the click lands outside it', () => {
    setup();
    openPicker();
    expect(screen.getByText('Excel')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Excel')).toBeNull();
  });

  it('stays open for a click inside it', () => {
    setup();
    openPicker();
    fireEvent.mouseDown(screen.getByText('Excel'));
    expect(screen.getByText('Excel')).toBeInTheDocument();
  });
});

describe('SkillPicker — empty catalog', () => {
  it('explains itself rather than showing a blank menu', () => {
    setup({ options: [], grouped: [], emptyMessage: 'Nothing here yet.' });
    openPicker();
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
  });
});
