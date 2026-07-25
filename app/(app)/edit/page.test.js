import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditPage from './page';

describe('EditPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('presents the voice workshop flow with generate and Keep handoff', () => {
    render(<EditPage />);

    expect(screen.getByRole('heading', { name: 'Voice Workshop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeInTheDocument();
    const notes = screen.getByLabelText(/Notes template/i);
    expect(notes.value).toContain('VENUE:');
    expect(screen.getByRole('button', { name: /Generate caption/i })).toBeInTheDocument();
    expect(screen.getByLabelText('AI-generated draft')).toBeInTheDocument();
    expect(screen.getByLabelText(/Your final caption/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy final for Keep/i })).toBeInTheDocument();
  });

  it('fills AI draft from generate API', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ caption: 'Generated wing night caption\n\n#tuckinandtalk #a #b #c #d' }),
    });

    render(<EditPage />);

    fireEvent.change(screen.getByLabelText(/Notes template/i), {
      target: {
        value: 'VENUE: home\nHAD: buffalo wings\nNOTES/BRAIN DUMP: air fryer night',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate caption/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('AI-generated draft').value).toContain(
        'Generated wing night caption'
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/caption/generate',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
