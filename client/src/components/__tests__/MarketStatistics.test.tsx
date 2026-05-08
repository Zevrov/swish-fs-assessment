import { render, screen } from '@testing-library/react';
import { MarketStatistics } from '../MarketStatistics';
import { Market } from '../../types';

const market = (overrides: Partial<Market> = {}): Market => ({
  id: 1,
  player_id: 1,
  stat_type_id: 102,
  line: 8.5,
  market_suspended: 0,
  manual_suspension: null,
  player_name: 'Russell Westbrook',
  team_nickname: 'Lakers',
  team_abbr: 'LAL',
  position: 'PG',
  stat_type_name: 'assists',
  low_line: 6,
  high_line: 9.5,
  is_suspended: false,
  ...overrides
});

describe('<MarketStatistics />', () => {
  it('shows em-dash placeholders only on the very first load (markets empty + loading)', () => {
    render(<MarketStatistics markets={[]} loading={true} />);
    const values = screen.getAllByText('—');
    expect(values).toHaveLength(4);
  });

  it('shows real numbers during a refetch (markets present + loading)', () => {
    // The fix that prevents the tab-click scroll-to-top relies on this:
    // numbers must keep showing during a refetch instead of flipping to —.
    const markets = [
      market({ id: 1, is_suspended: false, manual_suspension: null }),
      market({ id: 2, is_suspended: true, manual_suspension: 1 }),
      market({ id: 3, is_suspended: true, manual_suspension: null })
    ];
    render(<MarketStatistics markets={markets} loading={true} />);
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText('Total Markets').nextSibling?.textContent).toBe('3');
    expect(screen.getByText('Suspended').nextSibling?.textContent).toBe('2');
    expect(screen.getByText('Released').nextSibling?.textContent).toBe('1');
    expect(screen.getByText('Manual Overrides').nextSibling?.textContent).toBe('1');
  });

  it('counts manual overrides regardless of which way the override points', () => {
    const markets = [
      market({ id: 1, manual_suspension: 1 }),
      market({ id: 2, manual_suspension: 0 }),
      market({ id: 3, manual_suspension: null })
    ];
    render(<MarketStatistics markets={markets} loading={false} />);
    expect(screen.getByText('Manual Overrides').nextSibling?.textContent).toBe('2');
  });

  it('partition holds: suspended + active = total', () => {
    const markets = [
      market({ is_suspended: true }),
      market({ is_suspended: true }),
      market({ is_suspended: false }),
      market({ is_suspended: false }),
      market({ is_suspended: false })
    ];
    render(<MarketStatistics markets={markets} loading={false} />);
    expect(screen.getByText('Total Markets').nextSibling?.textContent).toBe('5');
    expect(screen.getByText('Suspended').nextSibling?.textContent).toBe('2');
    expect(screen.getByText('Released').nextSibling?.textContent).toBe('3');
  });
});
