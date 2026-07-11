import { render, screen } from '@testing-library/react';
import EditPage from './page';

describe('EditPage', () => {
  it('uses AI-neutral wording and real form labels', () => {
    render(<EditPage />);

    expect(screen.getByLabelText('Topic (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('AI-generated draft')).toBeInTheDocument();
    expect(screen.getByLabelText('Your refined caption')).toBeInTheDocument();
    expect(screen.queryByText(/Claude/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Spacer')).not.toBeInTheDocument();
  });
});
