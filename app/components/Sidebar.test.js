import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

jest.mock('next/navigation', () => ({ usePathname: () => '/edit' }));
jest.mock('./EngagementBadge', () => function MockEngagementBadge() {
  return <span>3</span>;
});

describe('Sidebar', () => {
  beforeEach(() => localStorage.clear());

  it('organises every route around the four-stage workflow', () => {
    render(<Sidebar />);

    expect(screen.getByText('REFINE')).toBeInTheDocument();
    expect(screen.getByText('PUBLISH')).toBeInTheDocument();
    expect(screen.getByText('MEASURE')).toBeInTheDocument();
    expect(screen.getByText('LEARN')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('gives shell icon controls state-aware accessible names', () => {
    render(<Sidebar />);

    const mobileToggle = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(mobileToggle);

    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
  });
});
