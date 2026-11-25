import { router, usePathname } from 'expo-router';
import { Segmented } from './ui.tsx';

type Page = 'players' | 'records' | 'awards';
const PATH: Record<Page, string> = { players: '/players', records: '/records', awards: '/awards' };

/**
 * The bar that ties the Stats pages together: Players (the leaderboards), Records (the record book) and Awards (the
 * season's caps and trophies). Put it at the top of each of the three so they read as one place with three views,
 * wherever you arrive from.
 */
export function StatsNav() {
  const path = usePathname();
  const value: Page = path.startsWith('/records') ? 'records' : path.startsWith('/awards') ? 'awards' : 'players';
  return (
    <Segmented<Page>
      value={value}
      onChange={(p) => p !== value && router.replace(PATH[p] as never)}
      options={[
        { value: 'players', label: 'Players' },
        { value: 'records', label: 'Records' },
        { value: 'awards', label: 'Awards' },
      ]}
    />
  );
}
