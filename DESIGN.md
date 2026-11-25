# Crease design brief: "Pavilion"

Crease is a cricket scoring app. Every screen has to feel like it belongs to a cricket ground and a scorer's hands, not
like a generic dashboard. Premium, calm, confident. Think the Lord's pavilion at night with a modern scoreboard: deep
outfield green, ivory whites, champagne brass, the app's signature volt green (`colors.accent`, #D7FF3A) for what you can act on, leather red ONLY for wickets and
the live dot (never as decoration, never beside green as a flag-like pairing).

## Tokens (src/theme.ts, do not edit)
- `colors.*` (bg, surface, surfaceHi, text = ivory, muted, faint, accent = volt green (the owner's choice: keep it, use it with purpose, not on everything), accentInk, accentDim, onAccent, gold =
  brass, danger = leather red, cyan = fours, violet = extras, ink(a) for faint lines), `hero` (dark panel colours), `gradients`,
  `radius` (sm 12, md 16, lg 22, xl 30), `space`, `font.*` (Bricolage for headlines and numbers, Inter for text), `type.*`.
- Day theme exists (`isDay`): everything must work in both. Use tokens, never hard-coded colours (except inside gradients
  built from tokens).
- Team themes: `teamTheme(name)`, `ownTeamTheme(name)`; `TeamCrest`, `TeamWash`, `crestOf` in components/TeamCrest.tsx.
  Copan Strikers (Thunder blue) and Copan Royals (Royal purple and gold) have their own logos.

## Shared building blocks (read them, USE them, do not edit them)
- components/ui.tsx: Screen, Card (has a glass sheen), Button (gradient primary), IconButton, Chip, Segmented (accent when
  selected), SectionLabel (now a real heading), Sheet, Stepper, ToggleRow, BallChip, WideHead, useToast, FadeIn, PopText,
  PressableScale, PitchStripes, YearChips, MomentFlash.
- components/cricket.tsx: OvalGround (ground line-art backdrop for heroes), SeamDivider (ball-seam divider instead of a
  hairline), SeamBall, Stumps (animated wicket), Flip (scoreboard digit roll), Stagger (cards rise in one by one).
- components/motion.tsx: CountUp, Ticker, GrowBar, Pulse, Sheen, Rise, Confetti, PopIn, Tug, useReducedMotion.
- components/layout.tsx: useLayout (wide = tablet, desk = laptop), Page, Columns, widePad.
- components/StatsNav.tsx: Players | Records | Awards bar. Put it at the top of those three pages.
- engine/*: do not change any scoring or stats logic. You may add small pure helpers in NEW files if a screen needs a
  derived number.

## Navigation (already built, in app/(tabs)/_layout.tsx)
Dock: Home, Stats, (big + New match), Teams, Me. Stats = Players, Records, Awards (tab routes `players`, `records`,
`awards`, all inside app/(tabs)). Me = profile; Settings is reached from Me. Pushed pages: match, player, team, series,
new, squad, compare, rivalry, auction, settings. Pages inside the tab group must leave room for the dock (~130px bottom
padding on phones). Pushed pages show their own back button.

## UX principles (this is the point of the redesign)
1. One obvious primary action per screen, in the place the thumb expects it. Secondary actions are quieter. Rare actions
   (delete, rain, DLS, export) live in a ... menu or a sheet, never next to the main action.
2. Say what a thing is. Replace jargon-only labels and unlabeled icons with words; put the unit next to a number
   (runs, ov, SR). An insight needs a one-line takeaway ("Needs 8.4 an over, scoring 7.1") not just a chart.
3. Hierarchy first: ONE hero per screen (the number or fact that matters), then supporting cards of clearly different
   weight, then detail. No wall of equal boxes. Use bento sizes deliberately.
4. Nothing hidden that people look for: anything you move must still be reachable in at most two taps from the dock, and
   its entry point should name it. Empty states explain what to do next, with a button.
5. Forgiving: destructive actions confirm or can be undone; show what changed with a toast.
6. Scannable lists: a clear left identity (badge/avatar), a bold primary line, a quiet secondary line, the key number
   on the right in the scoreboard font, a chevron only if it navigates.
7. Thumb-friendly: 44px minimum targets, the scoring pad within reach of the bottom half of a phone.
8. Responsive: phone is one column; tablet (`wide`) and laptop (`desk`) get real multi-column layouts, not stretched
   phone screens. Keep what is already there for those and upgrade it.
9. Accessibility: keep every existing accessibilityLabel/role, add them to new controls, respect reduced motion.

## Cricket feel (use generously, but with taste)
- Hero panels sit on the outfield gradient (`gradients.hero`) with `OvalGround` line-art behind and a slow `Sheen`.
- Scores are scoreboards: Bricolage heavy numerals, tabular figures, `Flip` or `Ticker` digits that roll when they change.
- Use `SeamDivider` between the parts of a card where a hairline was; use `SeamBall` as a bullet or loader.
- Overs read as six balls: dot/run/four/six/wicket chips, an over's total at the end of its row.
- Honours (awards, Man of the Match, records) look like a pavilion honours board: brass (`colors.gold`) on deep green,
  engraved-plaque feel, a star or ribbon. Fixtures and results look like match tickets with both team badges.
- A wicket falling is a moment: `Stumps` with `hit`, the red flash. A boundary is a flash of volt/cyan. Milestones
  (50, 100, 5-for) get a small celebration (`Confetti` / `PopIn`).
- Charts are part of the story: label the axes in cricket words (overs, runs), mark wickets, end with the takeaway.

## Motion (add it, everywhere it helps, never in the way)
- Every screen opens with a staggered reveal (`Stagger`, `FadeIn`, `Rise`). Numbers count up (`CountUp`) or flip.
- Pressables spring (`PressableScale` already). Selected states glide (animated indicator) where there is room.
- Bars and lines grow in (`GrowBar`; animate SVG stroke/opacity with Animated). Live things pulse (`Pulse`).
- All motion respects `useReducedMotion()`. Keep native-driver-safe props (opacity, transform) on native.

## Rules for working in parallel
- Several people are redesigning different screens at the same time in the same folder. Edit ONLY the files you were
  assigned. If you need a new shared component, create a NEW file named for your screen (e.g. components/HomeX.tsx).
  Never edit theme.ts, ui.tsx, cricket.tsx, motion.tsx, layout.tsx, (tabs)/_layout.tsx, app/_layout.tsx or engine files.
- Type errors in files that are not yours may be someone else mid-edit: ignore them, retry later. `npx tsc --noEmit`
  must have no errors in YOUR files when you finish.
- Keep all behaviour: every action, prop, route and param that exists today must still work. This is a redesign of
  presentation, hierarchy and flow, not a feature cut.
- Dev server already runs at http://localhost:8081 (do not start another). Open your own browser tab with
  `tabs_create` and test your routes there (sample data: on Home press "Load sample season" once if the app is empty).
  Check phone width (resize_window mobile) and desktop, and the console for errors. Reset the viewport afterwards.
- Do not git commit. Do not run `npm install`.
