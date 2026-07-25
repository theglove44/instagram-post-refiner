import { render, screen } from '@testing-library/react';
import EditPage from './page';

describe('EditPage', () => {
  it('presents the voice workshop flow with Keep handoff', () => {
    render(<EditPage />);

    expect(screen.getByRole('heading', { name: 'Voice Workshop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeInTheDocument();
    const notes = screen.getByLabelText(/Notes template/i);
    expect(notes).toBeInTheDocument();
    expect(notes.value).toContain('VENUE:');
    expect(notes.value).toContain('TYPE: Feed post / Reel');
    expect(notes.value).toContain("DON'T MENTION:");
    expect(notes.value).toContain('NOTES/BRAIN DUMP:');
    expect(screen.getByLabelText('AI-generated draft')).toBeInTheDocument();
    expect(screen.getByLabelText(/Your final caption/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy final for Keep/i })).toBeInTheDocument();
    expect(screen.getByText(/Notes in → caption out → copy to Keep for Michelle/i)).toBeInTheDocument();
  });
});
