import { render, screen } from '@testing-library/react';
import FacebookBlock, { verdict } from './FacebookBlock';

const EMPTY = {
  page: { days: [], totals: null },
  crosspost: { checked: 0, crossposted: 0, facebookViews: 0, totalViews: 0, share: null, byFormat: {} },
  top: [],
};

const FULL = {
  page: {
    days: [
      { date: '2026-11-12', views: 727, viewers: 605, followers: 224, follows: 0, unfollows: 1 },
      { date: '2026-11-13', views: 4903, viewers: 4132, followers: 224, follows: 1, unfollows: 1 },
      { date: '2026-11-14', views: 541, viewers: 449, followers: 224, follows: 0, unfollows: 0 },
    ],
    totals: { views: 6171, follows: 1, unfollows: 2, followers: 224, followerChange: 0, daysWithData: 3 },
  },
  crosspost: {
    checked: 12, crossposted: 9, facebookViews: 213, totalViews: 9900, share: 213 / 9900,
    byFormat: {
      Posts: { posts: 5, facebookViews: 213, totalViews: 5800, share: 213 / 5800 },
      Reels: { posts: 4, facebookViews: 0, totalViews: 4100, share: 0 },
    },
  },
  top: [
    { mediaId: 'a', excerpt: 'The best chippy on the whole of the Wirral, no question about it', facebookViews: 54, totalViews: 1031, share: 54 / 1031, format: 'Posts' },
    { mediaId: 'b', excerpt: '', facebookViews: 43, totalViews: 1094, share: 43 / 1094, format: 'Posts' },
  ],
};

describe('FacebookBlock', () => {
  test('says what is coming when nothing has been collected, and shows no numbers', () => {
    const { container } = render(<FacebookBlock facebook={EMPTY} />);
    expect(screen.getByText('Facebook, on the side')).toBeInTheDocument();
    expect(screen.getByText(/after tonight/)).toBeInTheDocument();
    expect(screen.getByText(/crossposted views start arriving/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0%/);
  });

  test('renders also when the facebook key is missing (older API response)', () => {
    render(<FacebookBlock facebook={undefined} />);
    expect(screen.getByText('Facebook, on the side')).toBeInTheDocument();
  });

  test('says so plainly when recent posts were checked but none were shared', () => {
    render(<FacebookBlock facebook={{ ...EMPTY, crosspost: { ...EMPTY.crosspost, checked: 25 } }} />);
    expect(screen.getByText(/none of the last 25 posts were shared to Facebook/i)).toBeInTheDocument();
  });

  test('shows the Page trend, the Facebook share, formats and top crossposts', () => {
    render(<FacebookBlock facebook={FULL} />);
    expect(screen.getByRole('img', { name: /Facebook Page views, last 3 days: 6,171/ })).toBeInTheDocument();
    expect(screen.getByText('6,171')).toBeInTheDocument();
    expect(screen.getByText('4,903')).toBeInTheDocument(); // busiest day
    expect(screen.getByText('224')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument(); // overall share
    expect(screen.getByText(/9 of the last 12 posts/)).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument(); // Reels
    expect(screen.getByText(/The best chippy on the whole…/)).toBeInTheDocument();
    expect(screen.getByText('Untitled post')).toBeInTheDocument();
    expect(screen.getByText(/a bonus, not a channel/)).toBeInTheDocument();
  });
});

describe('verdict', () => {
  test('small share reads as a bonus', () => {
    expect(verdict(0.03)).toMatch(/bonus/);
  });
  test('a big share reads as a real audience', () => {
    expect(verdict(0.25)).toMatch(/real audience/);
  });
  test('no share, no verdict', () => {
    expect(verdict(null)).toBeNull();
  });
});
