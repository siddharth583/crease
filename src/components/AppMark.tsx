import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop, G } from 'react-native-svg';
import { MARK, MARK_PITCH, MARK_SCALE, MARK_VOLT } from '../engine/mark.ts';

/** The app icon itself, drawn in the app: the same picture as on the phone's home screen. */
export function AppMark({ size = 32 }: { size?: number }) {
  const inset = (100 * (1 - MARK_SCALE)) / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Crease">
      <Defs>
        <LinearGradient id="markPitch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={MARK_PITCH[0]} />
          <Stop offset="0.55" stopColor={MARK_PITCH[1]} />
          <Stop offset="1" stopColor={MARK_PITCH[2]} />
        </LinearGradient>
        <RadialGradient id="markGlow" cx="0.5" cy="0.45" r="0.55">
          <Stop offset="0" stopColor={MARK_VOLT} stopOpacity={0.16} />
          <Stop offset="1" stopColor={MARK_VOLT} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={100} height={100} rx={23} fill="url(#markPitch)" />
      <Rect width={100} height={100} rx={23} fill="url(#markGlow)" />
      <G transform={`translate(${inset} ${inset}) scale(${MARK_SCALE})`}>
        {MARK.map((s, i) =>
          s.kind === 'circle' ? (
            <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={MARK_VOLT} />
          ) : (
            <Rect
              key={i}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={s.r}
              fill={MARK_VOLT}
              transform={s.rotate ? `rotate(${s.rotate.join(' ')})` : undefined}
            />
          ),
        )}
      </G>
    </Svg>
  );
}
