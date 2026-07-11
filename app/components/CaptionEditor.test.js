import { render, screen } from '@testing-library/react';
import CaptionEditor from './CaptionEditor';

describe('CaptionEditor', () => {
  it('names the caption and editor tool controls', () => {
    render(
      <CaptionEditor
        caption=""
        onCaptionChange={jest.fn()}
        onInsertHashtags={jest.fn()}
        onLoadTemplate={jest.fn()}
      />
    );

    expect(screen.getByRole('textbox', { name: 'Instagram caption' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert hashtags into caption' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load caption template' })).toBeInTheDocument();
  });
});
