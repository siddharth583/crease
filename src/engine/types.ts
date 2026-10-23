export type Player = { id: string; name: string };

export type Team = { id: string; name: string; players: Player[] };

export type Rules = {
  overs: number;
  playersPerSide: number;
  /** Penalty run for a wide or no-ball. Local games often play 0. */
  extraRun: number;
  /** Wides and no-balls are bowled again (they don't count as a ball of the over). */
  reball: boolean;
  /** The last batter can keep batting alone. */
  lastManStands: boolean;
  /** Most overs one bowler may bowl in an innings; 0 or missing means no limit. */
  maxOversPerBowler?: number;
  /** How many bowlers may bowl one over more than that limit (e.g. two bowl 3, the rest 2). */
  extraOverBowlers?: number;
  /** The ball after a no-ball is a free hit: only a run out counts. */
  freeHit?: boolean;
  /** Bouncers (over head height): how many an over are fair, and what the rest are called. */
  bouncer?: { fair: number; calledAs: 'wide' | 'noball' };
};

export type Extra = 'wide' | 'noball' | 'bye' | 'legbye';

export type WicketKind = 'bowled' | 'caught' | 'lbw' | 'runout' | 'stumped' | 'hitwicket' | 'retired';

export type BallEvent = {
  type: 'ball';
  /** Runs run or hit: off the bat, or byes/leg-byes, or runs run on a wide. Not the penalty run. */
  runs: number;
  extra?: Extra;
  wicket?: { kind: WicketKind; playerOut: string; fielder?: string };
  /** The umpire gave it as a bouncer: fair or called, depending on the house rule and the over so far. */
  bouncer?: boolean;
};

export type InningsEvent =
  | { type: 'openers'; striker: string; nonStriker: string }
  | { type: 'bowler'; bowler: string }
  | { type: 'batter'; batter: string }
  | { type: 'swap' }
  /** Close the innings now: declared, ran out of time or light. */
  | { type: 'endInnings' }
  /** Retired hurt between balls: not a wicket, and they can bat again later. */
  | { type: 'retire'; batter: string }
  | BallEvent;

export type Innings = { battingTeam: string; bowlingTeam: string; events: InningsEvent[] };

export type Match = {
  id: string;
  createdAt: number;
  teams: [Team, Team];
  rules: Rules;
  toss: { winner: string; choice: 'bat' | 'bowl' };
  innings: Innings[];
  /** Part of a series: which one, how long it is, and which match of it this is. */
  series?: SeriesInfo;
};

export type SeriesInfo = { id: string; name: string; of: number; number: number };
