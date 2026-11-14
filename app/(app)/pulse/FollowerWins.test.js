import { render, screen } from '@testing-library/react';
import FollowerWins, { hourLabel } from './FollowerWins';

const EMPTY_WINS = { byFollows: [], byVisitsPer1k: [], postsWithSignals: 0 };

describe('FollowerWins', () => {
  test('explains what is coming when nothing has been collected yet', () => {
    render(<FollowerWins wins={EMPTY_WINS} flow={{ days: [], totals: { follows: 0, unfollows: 0, net: 0 }, daysWithData: 0 }} online={null} />);
    expect(screen.getByText('What wins followers')).toBeInTheDocument();
    expect(screen.getByText(/not Reels/)).toBeInTheDocument();
    expect(screen.getByText(/starts logging this tonight/)).toBeInTheDocument();
    expect(screen.getByText(/after tonight/)).toBeInTheDocument();
  });

  test('renders ranked posts, the flow totals and the online peak', () => {
    render(
      <FollowerWins
        wins={{
          byFollows: [{ mediaId: 'a', excerpt: 'A very long caption about Sunday roast that keeps going', follows: 9, profileVisits: 30, format: 'Images' }],
          byVisitsPer1k: [{ mediaId: 'b', excerpt: 'Short one', visitsPer1k: 20, views: 1500 }],
          postsWithSignals: 2,
        }}
        flow={{
          days: [{ date: '2026-11-10', follows: 5, unfollows: 2, net: 3 }, { date: '2026-11-11', follows: null, unfollows: null, net: null }],
          totals: { follows: 5, unfollows: 2, net: 3 },
          daysWithData: 1,
        }}
        online={{ hours: Array.from({ length: 24 }, (_, hour) => ({ hour, followers: hour === 21 ? 2000 : 1000 })), peak: [{ hour: 21, followers: 2000 }], daysUsed: 28 }}
      />
    );
    expect(screen.getByText('+9')).toBeInTheDocument();
    expect(screen.getByText(/A very long caption about Sun…/)).toBeInTheDocument();
    expect(screen.getByText('20.0')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /peaks at 9pm/ })).toBeInTheDocument();
  });

  test('hourLabel reads like a clock', () => {
    expect([0, 9, 12, 21].map(hourLabel)).toEqual(['12am', '9am', '12pm', '9pm']);
  });
});
