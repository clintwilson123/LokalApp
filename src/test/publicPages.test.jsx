import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Two public-facing pages, and between them the things that made them read
// as unfinished: a home page that never said how the product worked, an
// About page whose "stats" row was three emoji rendered at 28px next to one
// genuine number, a tech stack listing a framework the project does not use,
// and a hero promising AI the deployment does not currently have.

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import Home from '../pages/home';
import About from '../pages/About';

function CurrentPath() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<><Home /><CurrentPath /></>} />
        <Route path="/login" element={<><div>LOGIN_PAGE</div><CurrentPath /></>} />
        <Route path="/find-jobs" element={<><div>FIND_JOBS_PAGE</div><CurrentPath /></>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAbout() {
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <Routes>
        <Route path="/about" element={<><About /><CurrentPath /></>} />
        <Route path="/" element={<><div>HOME_PAGE</div><CurrentPath /></>} />
        <Route path="/signup" element={<><div>SIGNUP_PAGE</div><CurrentPath /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Home — answers the question a first-time visitor has', () => {
  it('explains how the thing actually works, in three steps', () => {
    renderHome();

    expect(screen.getByText('How CJLink Works')).toBeInTheDocument();
    expect(screen.getByText('Create your profile')).toBeInTheDocument();
    expect(screen.getByText('Apply to open roles')).toBeInTheDocument();
    expect(screen.getByText('Follow it to an offer')).toBeInTheDocument();

    const numbers = [...document.querySelectorAll('.step-num')].map((n) => n.textContent);
    expect(numbers).toEqual(['1', '2', '3']);
  });

  it('states checkable facts instead of adjectives', () => {
    renderHome();

    expect(screen.getByText('One location — CJTECH Shop, Toledo City')).toBeInTheDocument();
    expect(screen.getByText('Free to apply, always')).toBeInTheDocument();
    expect(screen.getByText('You only ever see your own applications')).toBeInTheDocument();
  });

  it('gives each feature its own accent rather than six identical tiles', () => {
    renderHome();

    const cards = [...document.querySelectorAll('.feature-card')];
    expect(cards).toHaveLength(6);

    const accents = new Set(cards.map((c) => c.style.borderLeft));
    expect(accents.size).toBe(cards.length);
  });

  it('offers both routes forward, and they lead somewhere', () => {
    renderHome();

    const primary = screen.getAllByRole('button', { name: /Create an account/ });
    expect(primary).toHaveLength(2); // hero and closing band

    fireEvent.click(primary[0]);
    expect(screen.getByTestId('path')).toHaveTextContent('/login');
  });
});

describe('About — claims only what is true', () => {
  it('shows figures in the stats row, not decorations', () => {
    renderAbout();

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Fees to Apply')).toBeInTheDocument();

    // Three of these were emoji rendered at 28px under a "stats" heading.
    for (const decoration of ['🤖', '⚡', '🔒']) {
      expect(screen.queryByText(decoration)).toBeNull();
    }
  });

  it('does not list a framework the project does not use', () => {
    renderAbout();

    expect(screen.queryByText('Bootstrap 5')).toBeNull();
    expect(screen.getByText('React 19')).toBeInTheDocument();
    expect(screen.getByText('Vite 7')).toBeInTheDocument();
  });

  it('does not promise AI the deployment does not currently have', () => {
    renderAbout();

    expect(screen.queryByText(/powered by AI/)).toBeNull();
    expect(screen.queryByText(/AI-Powered/)).toBeNull();
    // Skill matching always runs, so that claim stays.
    expect(screen.getByText('Skill Matching')).toBeInTheDocument();
  });

  it('writes the AI category correctly', () => {
    renderAbout();

    expect(screen.getByText('AI / ML')).toBeInTheDocument();
    expect(screen.queryByText('AI /ML')).toBeNull();
  });

  it('credits all five developers with their roles', () => {
    renderAbout();

    for (const name of ['Clint Wilson Gonzales', 'Jay Mica Rebias', 'Rechelle Cabahug', 'Carey Acaylar', 'Arnel Villanueva']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText('Lead Developer')).toBeInTheDocument();
    expect(screen.getByText('QA Tester')).toBeInTheDocument();
  });

  it('closes on a call to action rather than a bare button', () => {
    renderAbout();

    expect(screen.getByText('Ready to get started?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to Home/ }));
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
  });
});
