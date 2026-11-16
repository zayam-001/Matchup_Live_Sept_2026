// FIP broadcast moments for the padel scorebug, worked out from the live score:
// - the point tag: MATCH POINT / SET POINT / BREAK POINT ("2 BREAK POINTS" when the receivers have two chances)
// - the rest timers: a 90-second changeover after the 3rd, 5th, 7th... game of a set (ends change after
//   every odd game, with no rest after the first) and a 2-minute break after each set.

type Side = 'A' | 'B';
interface ScoreLike {
    p1Points?: string | number; p2Points?: string | number;
    p1Games?: number; p2Games?: number; p1Sets?: number; p2Sets?: number;
    p1SetScores?: number[]; goldenPoint?: boolean; isTiebreak?: boolean; history?: string[];
}

export const CHANGEOVER_SECONDS = 90;
export const SET_BREAK_SECONDS = 120;

const POINT_INDEX: Record<string, number> = { '0': 0, '15': 1, '30': 2, '40': 3, AD: 4, A: 4, SP: 3 };
const idx = (v: unknown) => POINT_INDEX[String(v ?? '0').toUpperCase()] ?? 0;

/** How many chances a side has to win the current game on the next point(s). */
const chances = (s: ScoreLike, side: Side): number => {
    const mine = side === 'A' ? s.p1Points : s.p2Points, theirs = side === 'A' ? s.p2Points : s.p1Points;
    if (s.isTiebreak) {
        const x = Number(mine) || 0, y = Number(theirs) || 0;
        const target = (s.p1Games ?? 0) === 6 && (s.p2Games ?? 0) === 6 ? 7 : 10; // 6-6 tie-break or super tie-break
        return x >= target - 1 && x > y ? x - y : 0;
    }
    const x = idx(mine), y = idx(theirs);
    if (x === 4) return 1;                         // advantage
    if (x === 3 && y === 3) return s.goldenPoint ? 1 : 0; // deuce: only the star point decides
    if (x === 3 && y < 3) return 3 - y;            // 40-0 / 40-15 / 40-30
    return 0;
};

/**
 * The tag shown above the scorebug, or null. `server` is the side serving this game (null if unknown,
 * in which case break points can't be told apart and only set/match points show).
 */
export const pointTag = (s: ScoreLike | undefined, server: Side | null): string | null => {
    if (!s) return null;
    const rank = { MATCH: 3, SET: 2, BREAK: 1 } as const;
    let best: { kind: keyof typeof rank; n: number } | null = null;
    for (const side of ['A', 'B'] as Side[]) {
        const n = chances(s, side);
        if (!n) continue;
        const g = (side === 'A' ? s.p1Games : s.p2Games) ?? 0, og = (side === 'A' ? s.p2Games : s.p1Games) ?? 0;
        const sets = (side === 'A' ? s.p1Sets : s.p2Sets) ?? 0;
        // Winning this game wins the set: 6 games two clear, 7-5, or any tie-break.
        const winsSet = s.isTiebreak || (g + 1 >= 6 && g + 1 - og >= 2);
        const kind = winsSet ? (sets + 1 >= 2 ? 'MATCH' : 'SET') : server && server !== side ? 'BREAK' : null;
        if (kind && (!best || rank[kind] > rank[best.kind])) best = { kind, n };
    }
    if (!best) return null;
    // As on the FIP feed: SET / MATCH POINT however many chances; break points show how many ("2 BREAK POINTS").
    return best.kind === 'BREAK' && best.n > 1 ? `${best.n} BREAK POINTS` : `${best.kind} POINT`;
};

/** A running changeover or set-break countdown, or null. `now` in ms. */
export const restTimer = (s: ScoreLike | undefined, now: number): { label: string; secondsLeft: number } | null => {
    if (!s || s.isTiebreak) return null;
    if (idx(s.p1Points) || idx(s.p2Points)) return null; // a point has been played since
    const last = s.history?.[s.history.length - 1];
    const at = last ? Number(String(last).split('|')[1]) : NaN;
    if (!Number.isFinite(at)) return null;
    const games = (s.p1Games ?? 0) + (s.p2Games ?? 0);
    const setsPlayed = s.p1SetScores?.length ?? 0;
    const rest = games === 0 && setsPlayed > 0 ? { label: 'SET BREAK', total: SET_BREAK_SECONDS }
        : games % 2 === 1 && games >= 3 ? { label: 'CHANGEOVER', total: CHANGEOVER_SECONDS } : null;
    if (!rest) return null;
    const secondsLeft = Math.ceil(rest.total - (now - at) / 1000);
    return secondsLeft > 0 ? { label: rest.label, secondsLeft } : null;
};

export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
