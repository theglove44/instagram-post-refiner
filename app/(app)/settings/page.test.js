import { render, screen } from '@testing-library/react';
import SettingsPage from './page';

describe('SettingsPage OAuth feedback', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/settings?instagram_connected=creator');
    global.fetch = jest.fn(async (url) => ({
      json: async () => {
        if (String(url).includes('/api/hashtags/library')) {
          return { success: true, hashtags: [], categories: [] };
        }
        if (String(url).includes('/api/instagram/account')) {
          return { connected: false };
        }
        return { success: false };
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.history.replaceState({}, '', '/settings');
  });

  it('keeps successful OAuth feedback visible on Settings', async () => {
    render(<SettingsPage />);

    expect(await screen.findByRole('status')).toHaveTextContent('Instagram account @creator connected successfully.');
  });

  it('keeps OAuth failures visible as an alert', async () => {
    window.history.replaceState({}, '', '/settings?instagram_error=Permission%20denied');
    render(<SettingsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
  });
});
