# Crease: cricket scoring for local matches

A mobile app (Expo / React Native) for scoring local cricket games ball by ball, offline.

## Run it

```bash
npm install
npm start
```

Scan the QR code with **Expo Go** on your phone (same Wi-Fi), or press `w` to open it in a browser.

## Put it on everyone's phone

Crease runs as a web app: host it once, share the link, and each player taps **Add to Home Screen**
(Safari share menu on iPhone, ⋮ menu in Chrome on Android). It opens full screen with its own icon and keeps working
with no signal once it has been opened.

### Sharing without a database: match files

Every match can be exported as a file with every ball in it, so it carries all the player and team stats. When a
match ends, tap **Export match file** and send it to the group (WhatsApp, email…). Everyone else taps **Import** on
the home screen. Importing the same file twice is harmless, and an older copy never overwrites a newer one.
**Export all** (home or Players screen) saves every match in one file: use it as a backup or to move to a new phone.

### 1. Club database (optional: automatic sharing instead of passing files around)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and press **Run**.
3. In **Project Settings → API**, copy the **Project URL** and the **publishable** (or `anon`) key.
4. Locally: copy `.env.example` to `.env.local` and paste both values in.

Without this the app still works: matches stay on each phone, and you share them as match files.

### 2. Host it (free)

**Vercel** (`vercel.json` is ready): import this repo at [vercel.com/new](https://vercel.com/new), add
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` under **Environment Variables**, and deploy.
You get a link like `https://crease-yourname.vercel.app`.

**Netlify** also works: build command `npm run build:web`, publish directory `dist`, same two environment variables
(`public/_redirects` handles the routes).

To build by hand: `npm run build:web` writes the site to `dist/`.

### 3. Share a club

In the app, tap **Club** (top right) → **Create club**, then **Invite players**. They open the link (or type the
8-letter code) and every phone shows the same matches, squads and player stats. Scores sync every few seconds while
the app is open; anything scored offline goes up when the phone is back online. If two phones score the *same* match
at the same time, the last one to sync wins, so keep one scorer per match.

## What's in v1

- Match setup: team names and squads (remembered for next time), 1–50 overs, 2–11 players a side
- House rules: penalty run for wides/no-balls, re-bowl wides/no-balls, last man stands
- Toss, then ball-by-ball scoring: runs, wides, no-balls, byes, leg-byes, all wicket types, retired hurt, swap strike
- Strike rotation, end of over and bowler changes handled for you (no bowler bowls two overs in a row)
- Undo any number of balls, including back across the innings break; each undo says what it took back
- Tap any ball in the over to fix or delete it, and everything after it is worked out again
- House rules for free hits after a no-ball, a cap on overs per bowler (with a few bowlers allowed one more, e.g. two bowl 3 and the rest 2), and bouncers (how many an over are fair, and whether the rest are wides or no-balls); the bowler list puts whoever bowled from this end first
- Match menu: cut the overs for rain, or end an innings early
- FOUR / SIX / OUT / FIFTY / CENTURY / HAT-TRICK moments, a hat-trick-ball warning and maiden-over toasts
- Coin toss, paste a whole squad at once, one-tap rematch; new matches start with the last match's rules
- Man of the Match on every result, and a form chart on every player's profile
- Series: start a best of 3, 5 or 7, play the next match in one tap, and follow the series table, leaders and Man of the Series
- The screen stays on while you score
- Live scoreboard with run rate, partnership, this over, and target / required rate in the chase
- Full scorecard (batting, bowling, extras, fall of wickets) and a share button for WhatsApp
- Player stats across all matches: runs and wickets leaderboards, and a profile per player (batting, bowling, fielding, recent scores, match list). Tap a name on any scorecard to open it
- Export any matches you pick, one or many, as a **PDF scorecard** (a page per match, for printing or sending) or as a **match file** to import on another phone; the stats come with match files
- Everything is saved on the device, and shared with your club when you're in one

## Code

- `src/engine/`: the scoring rules, and `stats.ts` for career numbers (a player is matched by team name + player name; unnamed "Player N" placeholders are left out).
  The scoring rules: Every number is worked out from the list of events, so undo is just "drop the last event". Tests: `npm test`.
- `src/app/`: screens (Expo Router): home, new match, live scoring, scorecard.
- `src/store/`: matches and saved squads, kept on the device with AsyncStorage; `cloud.ts` and the sync loop in
  `matches.tsx` share them with a club through the functions in `supabase/schema.sql`.
- `src/theme.ts`, `src/components/ui.tsx`: colours and shared UI.

`npm run typecheck` checks the types.
