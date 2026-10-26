import { memo } from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

// The ground at night, drawn once: floodlights with their beams, the crowd in the stands, the boards, the outfield
// mown in stripes running away from us, and the pitch in perspective with its creases and the far stumps.
// Drawn on a 360 × 420 stage; the toss scene scales the stage to the screen.

export const STAGE = { w: 360, h: 420 };
/** Where the pitch's far end and near end sit, for the figures and the coin to stand on it. */
export const PITCH = { farY: 168, nearY: 420, farHalf: 26, nearHalf: 74, cx: 180 };

/** A pitch's half-width at a height on the stage: it narrows into the distance. */
export const pitchHalf = (y: number) => PITCH.farHalf + ((y - PITCH.farY) / (PITCH.nearY - PITCH.farY)) * (PITCH.nearHalf - PITCH.farHalf);

/** The same crowd every time: a small seeded random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CROWD_COLOURS = ['#C9D7C2', '#8FB0D9', '#E7C86B', '#D98E7A', '#9BC48F', '#B9A6FF', '#F1F5EE', '#6F8F7A'];

function StadiumArt() {
  const rand = seeded(7);
  const crowd = Array.from({ length: 340 }, () => ({
    x: rand() * 360,
    y: 98 + rand() * 50,
    r: 1 + rand() * 1.4,
    c: CROWD_COLOURS[Math.floor(rand() * CROWD_COLOURS.length)],
    o: 0.25 + rand() * 0.45,
  }));
  // Mowing stripes: bands that meet far beyond the pitch, light and dark in turn.
  const vanish = { x: 180, y: 40 };
  const stripes = Array.from({ length: 14 }, (_, i) => {
    const x0 = -120 + i * 46;
    const x1 = x0 + 46;
    const at = (x: number, y: number) => vanish.x + ((x - vanish.x) * (y - vanish.y)) / (420 - vanish.y);
    return { pts: `${at(x0, 160)},160 ${at(x1, 160)},160 ${x1},420 ${x0},420`, light: i % 2 === 0 };
  });
  const board = ['#D7FF3A', '#7FE6FF', '#F1F5EE', '#FFCB52', '#B9A6FF', '#7FE6FF', '#D7FF3A'];
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${STAGE.w} ${STAGE.h}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03070A" />
          <Stop offset="0.7" stopColor="#0A1712" />
          <Stop offset="1" stopColor="#10261A" />
        </LinearGradient>
        <RadialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFBE6" stopOpacity="0.55" />
          <Stop offset="0.35" stopColor="#FFF3C2" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FFF3C2" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF8D6" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FFF8D6" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id="field" cx="0.5" cy="0.62" r="0.75">
          <Stop offset="0" stopColor="#2F6B3A" />
          <Stop offset="0.6" stopColor="#1B4526" />
          <Stop offset="1" stopColor="#0C2414" />
        </RadialGradient>
        <LinearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B9A06A" />
          <Stop offset="1" stopColor="#D8C38E" />
        </LinearGradient>
        <LinearGradient id="stand" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1310" />
          <Stop offset="1" stopColor="#15211B" />
        </LinearGradient>
        <LinearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </LinearGradient>
      </Defs>

      <Rect width="360" height="420" fill="url(#sky)" />
      {/* Stars in a clear sky. */}
      {Array.from({ length: 26 }, (_, i) => (
        <Circle key={`s${i}`} cx={(i * 137) % 360} cy={8 + ((i * 53) % 70)} r={i % 3 === 0 ? 0.9 : 0.5} fill="#FFFFFF" opacity={0.25 + (i % 4) * 0.12} />
      ))}

      {/* The stands and the crowd. */}
      <Polygon points="0,92 360,92 360,152 0,152" fill="url(#stand)" />
      {crowd.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
      ))}
      <Rect x="0" y="92" width="360" height="3" fill="#24332A" />

      {/* Floodlight towers, their lamps and beams. */}
      {[22, 338].map((x, i) => (
        <G key={`f${i}`}>
          <Line x1={x} y1="40" x2={x + (i ? 6 : -6)} y2="152" stroke="#2A3A30" strokeWidth="3" />
          <Polygon points={`${x - 14},${30} ${x + 14},${30} ${360 / 2 + (i ? 60 : -60)},420 ${360 / 2 + (i ? -160 : 160)},420`} fill="url(#beam)" />
          <Circle cx={x} cy="34" r="70" fill="url(#lampGlow)" />
          <Rect x={x - 13} y="26" width="26" height="14" rx="2" fill="#2A3A30" />
          {[0, 1, 2, 3].map((c) =>
            [0, 1].map((r) => <Rect key={`${c}${r}`} x={x - 11 + c * 6} y={28 + r * 6} width="4" height="4" rx="1" fill="#FFFBE6" />),
          )}
        </G>
      ))}

      {/* The outfield, mown in stripes. */}
      <Rect x="0" y="152" width="360" height="268" fill="url(#field)" />
      {stripes.map((s, i) => (
        <Polygon key={`m${i}`} points={s.pts} fill={s.light ? '#FFFFFF' : '#000000'} opacity={s.light ? 0.035 : 0.06} />
      ))}

      {/* Advertising boards along the rope. */}
      {board.map((c, i) => (
        <Rect key={`b${i}`} x={i * 52} y="150" width="50" height="8" rx="1" fill={c} opacity="0.75" />
      ))}
      <Rect x="0" y="158" width="360" height="2" fill="#0B1A10" opacity="0.6" />

      {/* The pitch, its creases and the far stumps. */}
      <Polygon
        points={`${PITCH.cx - PITCH.farHalf},${PITCH.farY} ${PITCH.cx + PITCH.farHalf},${PITCH.farY} ${PITCH.cx + PITCH.nearHalf},${PITCH.nearY} ${PITCH.cx - PITCH.nearHalf},${PITCH.nearY}`}
        fill="url(#pitch)"
      />
      {[188, 392].map((y) => {
        const half = pitchHalf(y) + 6;
        return <Rect key={`c${y}`} x={PITCH.cx - half} y={y} width={half * 2} height={y > 300 ? 2.4 : 1.2} fill="#FFFFFF" opacity="0.9" />;
      })}
      {[-1, 1].map((side) => (
        <Line key={`r${side}`} x1={PITCH.cx + side * (pitchHalf(392) - 10)} y1="420" x2={PITCH.cx + side * (pitchHalf(392) - 6)} y2="384" stroke="#FFFFFF" strokeWidth="2" opacity="0.85" />
      ))}
      {[-4, 0, 4].map((dx) => (
        <Rect key={`st${dx}`} x={PITCH.cx + dx - 0.8} y="172" width="1.6" height="14" fill="#F4ECD8" />
      ))}
      <Rect x={PITCH.cx - 5} y="171" width="10" height="1" fill="#F4ECD8" />

      {/* The far side falls into the dark. */}
      <Rect x="0" y="300" width="360" height="120" fill="url(#haze)" />
    </Svg>
  );
}

/** The ground: it never changes, so it's drawn once. */
export const Stadium = memo(StadiumArt);
