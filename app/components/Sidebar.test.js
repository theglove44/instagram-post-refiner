import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

jest.mock('next/navigation', () => ({ usePathname: () => '/edit' }));

describe('Sidebar', () => {
  beforeEach(() => localStorage.clear());

  it('shows only the voice workshop navigation', () => {
    render(<Sidebar />);

    expect(screen.getByText('VOICE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voice Workshop' })).toHaveAttribute('href', '/edit');
    expect(screen.getByRole('link', { name: 'Workshop' })).toHaveAttribute('href', '/edit');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');

    expect(screen.queryByText('PUBLISH')).not.toBeInTheDocument();
    expect(screen.queryByText('MEASURE')).not.toBeInTheDocument();
    expect(screen.queryByText('LEARN')).not.toBeInTheDocument();
    expect(screen.queryByText('Compose')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('gives shell icon controls state-aware accessible names', () => {
    render(<Sidebar />);

    const mobileToggle = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(mobileToggle);

    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument();
  });
});
