# Crease: cricket scoring for local matches

A mobile app (Expo / React Native) for scoring local cricket games ball by ball, offline.

Live at **https://siddharth583.github.io/crease/**.

## Run it

```bash
npm install
npm start
```

Scan the QR code with **Expo Go** on your phone (same Wi-Fi), or press `w` to open it in a browser.

## Put it on everyone's phone

Crease runs as a web app: open the link and tap **Add to Home Screen** (Safari share menu on iPhone, ⋮ menu in
Chrome on Android). It opens full screen with its own icon and keeps working with no signal once it has been opened.

Every push to `main` builds the app and publishes it to GitHub Pages (`.github/workflows/pages.yml`). To build by
hand: `npm run build:web` writes the site to `dist/` for any static host (Netlify Drop works; `public/_redirects`
handles the routes there), and `npm run build:pages` builds it for the `/crease` sub-folder.

### Moving matches between phones: match files

Everything is saved on the phone that scored it. Every match can be exported as a file with every ball in it, so it
carries all the player and team stats. Send it to the group (WhatsApp, email…) and everyone else taps **Import** on
the home screen. Importing the same file twice is harmless, and an older copy never overwrites a newer one.
**Back up all matches** (Settings) saves every match in one file: use it as a backup or to move to a new phone.

## What it does

- Match setup: team names and squads (remembered for next time, Copan A and Copan B to start), 1–50 overs, 2–11 a side
- House rules: run for wides/no-balls, re-bowl them, free hits, overs per bowler (with a few allowed one more),
  bounces (fair or wide within the allowance, then a no-ball or wide), last man stands
- Toss, then ball-by-ball scoring: runs, extras, every wicket type, retired hurt, swap strike, penalty runs, dead ball
- Undo any number of balls; tap any ball to fix or delete it, and everything after it is worked out again
- Rain: cut the overs and get a DLS target, or end an innings early; super over on a tie; late arrivals
- Man of the Match on every result; series (best of 3, 5 or 7) with Man of the Series
- The squad: the regulars with roles, ratings and an auction category; their stats follow them across teams
- Auction: two captains with a ₹1 lakh wallet each, base prices by category, then start a match with the sides
- Players: career stats, a profile per player, and the Record Book (records, rivalries batter v bowler)
- Exports: PDF match reports, a PDF record book, match files and backups; a share card for WhatsApp
- Night and Day themes

## Code

- `src/engine/`: the scoring rules, stats, records, DLS, the auction and the printed reports. Every number is worked
  out from the list of events, so undo is just "drop the last event". Tests: `npm test`.
- `src/app/`: screens (Expo Router).
- `src/store/`: matches and saved teams (AsyncStorage), the squad and auctions, preferences, files.
- `src/theme.ts`, `src/components/`: colours and shared UI.

`npm run typecheck` checks the types.
