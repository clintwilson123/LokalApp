import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkeletonLine, SkeletonCard, SkeletonGrid } from '../components/Skeleton';

describe('Skeleton components', () => {
  it('renders SkeletonLine', () => {
    const { container } = render(<SkeletonLine width="50%" height="20px" />);
    const div = container.firstChild;
    expect(div).toBeInTheDocument();
    expect(div).toHaveStyle({ width: '50%', height: '20px' });
  });

  it('renders SkeletonCard with default lines', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelector('[style*="animation: shimmer"]')).toBeInTheDocument();
  });

  it('renders SkeletonGrid with 4 cards', () => {
    const { container } = render(<SkeletonGrid cards={4} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
