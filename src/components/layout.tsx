import { Children, useState, type ReactNode } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../theme.ts';

// One app for every screen. A phone is one column with the tabs at the foot; a tablet (768 and up) gets the tabs as a
// rail down the side and its pages in two columns; a laptop (1100 and up) a wider rail with names, three columns where
// a page has that much to show, and a reading width so lines never stretch across the whole screen.

export type Layout = {
  width: number;
  height: number;
  /** A tablet or bigger: side rail, two columns. */
  wide: boolean;
  /** A laptop or bigger: rail with names, up to three columns. */
  desk: boolean;
  /** Side gutter for a page's content. */
  gutter: number;
  /** The widest a page's content gets. */
  maxWidth: number;
};

export const TABLET = 768;
export const LAPTOP = 1100;

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const wide = width >= TABLET;
  const desk = width >= LAPTOP;
  return { width, height, wide, desk, gutter: desk ? space.xl : wide ? space.lg : space.md, maxWidth: desk ? 1240 : 980 };
}

/** Centres a page's content at its reading width on big screens; does nothing on a phone. */
export function Page({ children, style, max }: { children: ReactNode; style?: StyleProp<ViewStyle>; max?: number }) {
  const { wide, maxWidth } = useLayout();
  if (!wide) return <View style={style}>{children}</View>;
  // Auto margins as well as alignSelf: it centres in a row (a page's header bar) as well as in a column.
  return <View style={[{ width: '100%', maxWidth: max ?? maxWidth, alignSelf: 'center', marginHorizontal: 'auto' }, style]}>{children}</View>;
}

/** A pushed or tab page's scroll padding on a tablet or laptop: the gutter at the sides, the same room above and below. */
export const widePad = (gutter: number) => ({ paddingHorizontal: gutter, paddingTop: space.xl, paddingBottom: space.xxl });

/**
 * Its children side by side on a tablet or laptop (`tablet` and `laptop` columns), one under the other on a phone.
 * `weights` sets each column's share (e.g. [3, 2]); children beyond the columns wrap to the next row. `minItem` caps
 * the columns so none gets narrower than that (measured, so it holds with or without the rail). Every cell of a row is
 * as tall as the row: a child with `flex: 1` fills it, so cards side by side end on one line. `stretch` does the same
 * for weighted columns, which otherwise keep their own heights.
 */
export function Columns({
  children,
  tablet = 2,
  laptop = tablet,
  gap = space.md,
  weights,
  minItem,
  stretch,
  style,
}: {
  children: ReactNode;
  tablet?: number;
  laptop?: number;
  gap?: number;
  weights?: number[];
  minItem?: number;
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { wide, desk } = useLayout();
  const [measured, setMeasured] = useState(0);
  const items = Children.toArray(children).filter(Boolean);
  // Never more columns than there are children: one card alone takes the row rather than half of it.
  const most = Math.min(desk ? laptop : wide ? tablet : 1, Math.max(1, items.length));
  const n = minItem && measured ? Math.max(1, Math.min(most, Math.floor((measured + gap) / (minItem + gap)))) : most;
  const measure = minItem ? (e: { nativeEvent: { layout: { width: number } } }) => setMeasured(Math.round(e.nativeEvent.layout.width)) : undefined;
  if (n <= 1) return <View onLayout={measure} style={[{ gap }, style]}>{items}</View>;
  if (weights) {
    return (
      <View onLayout={measure} style={[{ flexDirection: 'row', gap, alignItems: stretch ? 'stretch' : 'flex-start' }, style]}>
        {items.map((child, i) => (
          <View key={i} style={{ flex: weights[i] ?? 1, minWidth: 0, gap }}>
            {child}
          </View>
        ))}
      </View>
    );
  }
  const rows: ReactNode[][] = [];
  items.forEach((child, i) => (rows[Math.floor(i / n)] ??= []).push(child));
  return (
    <View onLayout={measure} style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>
          {Array.from({ length: n }, (_, i) => (
            <View key={i} style={{ flex: 1, minWidth: 0 }}>
              {row[i] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
