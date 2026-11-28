// Quick Play: a player sets up a casual padel, futsal or football match, invites
// friends by email, and anyone holding the referee code can score it.
//   quickMatches/{id}   the match (readable when signed in; listed for its host and invitees)
//   quickCodes/{code}   referee code -> match id (exact lookup only, never listed)
//   players/{uid}.friends   the player's saved friends
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../services/storage';
import { mailFriendAdded, mailQuickInvite } from './emails';

export type QuickSport = 'padel' | 'futsal' | 'football';
export type QuickSide = 'home' | 'away';
export interface QuickPlayer { name: string; email?: string; uid?: string }
export interface QuickTeam { name: string; players: QuickPlayer[] }
/** One padel set as games won by each side. (Firestore can't store arrays inside arrays.) */
export interface SetScore { h: number; a: number }
/** The match clock for futsal and football: which half, and time played in it (ms). */
export interface QuickClock { period: number; running: boolean; startedAt?: number; elapsed: number }
/** One kick in a penalty shootout. */
export interface PenKick { side: QuickSide; scored: boolean; name?: string }
/** One finished game in a "winner stays" session: team indexes, goals, shootout, winner. */
export interface RotGame { a: number; b: number; ga: number; gb: number; pa?: number; pb?: number; winner: number | null; off: number }
/** Winner stays: who's on (playing as home, away), who's waiting, and the games so far. */
export interface Rotation { on: [number, number]; queue: number[]; since: number[]; games: RotGame[] }
export interface QuickScore {
    /** Padel: games per set, and points in the current game. */
    sets?: SetScore[]; game?: SetScore;
    /** Team sports: goals, fouls this half (futsal), and the clock. */
    goals?: [number, number]; fouls?: [number, number]; clock?: QuickClock;
    /** A penalty shootout in progress (or done) for the current game. */
    phase?: 'play' | 'pens'; pens?: PenKick[];
    /** The side the referee picked (after the toss) to take the first shootout kick. */
    pensFirst?: QuickSide;
    /** Winner stays sessions only. */
    rot?: Rotation;
}
export interface QuickEvent {
    id: string; side: QuickSide; kind: 'goal' | 'game' | 'point' | 'card' | 'foul' | 'period' | 'penmiss' | 'gameend';
    playerEmail?: string; playerName?: string; card?: 'Y' | 'R'; minute?: number; at: number;
    /** Scored from the penalty spot. */
    pen?: boolean;
    /** Winner stays: the team (index in `teams`) this event belongs to, and which game it was in. */
    team?: number; game?: number;
    /** The score just before this event, so Undo puts it back exactly. */
    prev?: QuickScore;
}

export interface QuickMatch {
    id: string;
    sport: QuickSport;
    title: string;
    venue?: string;
    startAt: string; // ISO
    hostUid: string;
    hostEmail: string;
    hostName: string;
    /**
     * Padel: sets (best of), games per set, and deuce: `deuceLimit` advantages before golden point
     * (0 golden point, 2 star point, 99 advantage). Team sports: periods × minutes, players per side,
     * shootout length, and for "winner stays" the goal cap and what a draw does.
     */
    format: {
        sets?: number; games?: number; goldenPoint?: boolean; deuceLimit?: number;
        halves?: number; minutes?: number; onPitch?: number; pensBestOf?: number;
        mode?: 'match' | 'rotation'; goalCap?: number; drawRule?: 'pens' | 'champion' | 'challenger';
    };
    /** Winner stays: every team in the session (home/away mirror the first two). */
    teams?: QuickTeam[];
    home: QuickTeam;
    away: QuickTeam;
    /** Lower-case emails of everyone in the match (and the host), so each can list it. */
    invites: string[];
    refereeCode: string;
    status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
    score: QuickScore;
    events: QuickEvent[];
    winner?: QuickSide | 'draw';
    createdAt: string;
    updatedAt?: number;
}

export const SPORT_NAMES: Record<QuickSport, string> = { padel: 'Padel', futsal: 'Futsal', football: 'Football' };
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const emailOf = (s?: string) => (s || '').trim().toLowerCase();
export const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

/** Players allowed on one side: padel is always 2 v 2; team sports take the starters plus subs. */
export const SUBS: Record<QuickSport, number> = { padel: 0, futsal: 5, football: 7 };
export const sideLimits = (sport: QuickSport, onPitch = 5) => sport === 'padel' ? { min: 2, max: 2 } : { min: 1, max: onPitch + SUBS[sport] };
/** Sets needed to win a padel match. */
export const setsToWin = (m: Pick<QuickMatch, 'format'>) => Math.ceil((m.format.sets || 3) / 2);
/** Advantages allowed before golden point decides a game (0 golden point, 99 plain advantage). */
export const deuceLimitOf = (f: QuickMatch['format']) => f.deuceLimit ?? (f.goldenPoint === false ? 99 : 0);
export const deuceName = (n: number) => n === 0 ? 'Golden point' : n >= 99 ? 'Advantage' : n === 2 ? 'Star point' : `${n} advantage${n > 1 ? 's' : ''}, then golden point`;
/** A set is won at the target with a two-game lead, or 7-5 / 7-6. */
export const setDone = (games: number, { h, a }: SetScore) => (Math.max(h, a) >= games && Math.abs(h - a) >= 2) || Math.max(h, a) === games + 1;
/** The match's sets, reading the old [h, a] shape too. */
export const setsOf = (m: QuickMatch): SetScore[] => (m.score.sets || []).map(s => (Array.isArray(s) ? { h: s[0], a: s[1] } : s));
/** True once a padel side has won enough sets. */
export const padelOver = (m: QuickMatch) => { const [h, a] = setsWon(m); return Math.max(h, a) >= setsToWin(m); };

// ---------------------------------------------------------------- padel points

/** True when the current padel game is a tie-break (games level at the set target). */
export const inTiebreak = (m: QuickMatch) => {
    const games = m.format.games || 6;
    const sets = setsOf(m);
    const cur = sets[sets.length - 1];
    return !!cur && !setDone(games, cur) && cur.h === games && cur.a === games;
};
/**
 * The score after one side wins a point: 0-15-30-40, then golden point (next point wins at 40-40)
 * or advantage (win by two); a tie-break at games level goes to 7, win by two. Winning the game
 * updates the set, and a new set starts when the last one is done.
 */
export const padelPoint = (m: QuickMatch, side: QuickSide): QuickScore => {
    const games = m.format.games || 6;
    const limit = deuceLimitOf(m.format);
    const sets = setsOf(m).map(x => ({ ...x }));
    if (!sets.length) sets.push({ h: 0, a: 0 });
    let cur = sets[sets.length - 1];
    if (setDone(games, cur)) { cur = { h: 0, a: 0 }; sets.push(cur); }
    const g = { ...(m.score.game || { h: 0, a: 0 }) };
    const k = side === 'home' ? 'h' : 'a', o = side === 'home' ? 'a' : 'h';
    const tb = cur.h === games && cur.a === games;
    // At deuce number n (40-40 the n-th time), golden point decides once n is past the limit.
    const decider = !tb && g.h === g.a && g.h >= 3 && g.h - 2 > limit;
    g[k]++;
    const won = tb ? g[k] >= 7 && g[k] - g[o] >= 2 : decider || (g[k] >= 4 && g[k] - g[o] >= 2);
    if (!won) return { ...m.score, sets, game: g };
    cur[k]++;
    return { ...m.score, sets, game: { h: 0, a: 0 } };
};
/** What the scoreboard shows for a side's points in the current game. */
export const pointLabel = (m: QuickMatch, side: QuickSide) => {
    const g = m.score.game || { h: 0, a: 0 };
    const me = side === 'home' ? g.h : g.a, op = side === 'home' ? g.a : g.h;
    if (inTiebreak(m)) return String(me);
    if (me >= 3 && op >= 3) return me > op ? 'AD' : '40';
    return ['0', '15', '30', '40'][Math.min(me, 3)];
};
/** "Deuce", "Golden point", "Tie-break" … for the current padel game. */
export const gameState = (m: QuickMatch) => {
    if (inTiebreak(m)) return 'Tie-break';
    const g = m.score.game || { h: 0, a: 0 };
    if (g.h >= 3 && g.a >= 3) {
        if (g.h !== g.a) return 'Advantage';
        const n = g.h - 2, limit = deuceLimitOf(m.format);
        if (n > limit) return 'Golden point';
        return limit >= 99 ? 'Deuce' : `Deuce ${n} of ${limit + 1} · golden point on deuce ${limit + 1}`;
    }
    return '';
};

// ---------------------------------------------------------------- team clock

export const clockMs = (c?: QuickClock, now = Date.now()) => (!c ? 0 : c.elapsed + (c.running && c.startedAt ? Math.max(0, now - c.startedAt) : 0));
/** Match minute for an event, counting the first half's length into the second. */
export const matchMinute = (m: QuickMatch, now = Date.now()) => {
    const c = m.score.clock;
    return ((c?.period || 1) - 1) * (m.format.minutes || 20) + Math.floor(clockMs(c, now) / 60000) + 1;
};

// ---------------------------------------------------------------- penalties

export const pensBestOf = (m: QuickMatch) => m.format.pensBestOf || (m.format.mode === 'rotation' ? 3 : 5);
export const pensTally = (kicks: PenKick[] = []) => {
    const t = { h: 0, a: 0, th: 0, ta: 0 };
    kicks.forEach(k => { if (k.side === 'home') { t.th++; if (k.scored) t.h++; } else { t.ta++; if (k.scored) t.a++; } });
    return t;
};
/** The side to kick next: the referee's pick from the toss, then the first side keeps going first. */
export const pensNext = (kicks: PenKick[] = [], pensFirst: QuickSide = 'home'): QuickSide => {
    const first = kicks[0]?.side || pensFirst;
    const { th, ta } = pensTally(kicks);
    const [f, o] = first === 'home' ? [th, ta] : [ta, th];
    return f > o ? (first === 'home' ? 'away' : 'home') : first;
};
/** True once one side can't be caught in the first N kicks, or a sudden-death round is decided. */
export const pensDecided = (kicks: PenKick[] = [], bestOf = 5) => {
    const { h, a, th, ta } = pensTally(kicks);
    if (th <= bestOf && ta <= bestOf) {
        if (h > a + (bestOf - ta) || a > h + (bestOf - th)) return true;
        if (th < bestOf || ta < bestOf) return false;
    }
    return th === ta && h !== a;
};

// ---------------------------------------------------------------- winner stays

export const isRotation = (m: Pick<QuickMatch, 'format'>) => m.format.mode === 'rotation';
/** The team on a side of the current game (winner stays maps sides to whoever is on). */
export const teamOn = (m: QuickMatch, side: QuickSide): QuickTeam => {
    if (isRotation(m) && m.teams && m.score.rot) return m.teams[m.score.rot.on[side === 'home' ? 0 : 1]];
    return side === 'home' ? m.home : m.away;
};
export const teamIndexOn = (m: QuickMatch, side: QuickSide) => (m.score.rot ? m.score.rot.on[side === 'home' ? 0 : 1] : side === 'home' ? 0 : 1);
export const freshRotation = (teams: number): Rotation => ({ on: [0, 1], queue: Array.from({ length: Math.max(0, teams - 2) }, (_, i) => i + 2), since: Array.from({ length: teams }, (_, i) => (i < 2 ? 0 : -1)), games: [] });
/**
 * Finish the current winner-stays game: the winner stays, the loser goes to the back of the queue and the
 * next team comes on. A draw follows the session's rule (penalties are played first by the caller).
 */
export const finishGame = (m: QuickMatch): { score: QuickScore; winner: number | null; off: number; on: number } => {
    const rot = m.score.rot!;
    const [a, b] = rot.on;
    const [ga, gb] = m.score.goals || [0, 0];
    const p = pensTally(m.score.pens);
    let winner: number | null = ga > gb ? a : gb > ga ? b : null;
    if (winner == null && (m.score.pens || []).length) winner = p.h > p.a ? a : p.a > p.h ? b : null;
    // A draw: the rule picks who leaves; the team on longer is the champion.
    const champion = rot.since[a] <= rot.since[b] ? a : b;
    const off = winner != null ? (winner === a ? b : a) : (m.format.drawRule === 'challenger' ? (champion === a ? b : a) : champion);
    const stays = off === a ? b : a;
    const next = rot.queue.length ? rot.queue[0] : off;
    const games = [...rot.games, { a, b, ga, gb, ...((m.score.pens || []).length ? { pa: p.h, pb: p.a } : {}), winner, off }];
    const on: [number, number] = off === a ? [next, stays] : [stays, next];
    const since = rot.since.map((x, i) => (i === next && next !== off ? games.length : x));
    const queue = rot.queue.length ? [...rot.queue.slice(1), off] : [];
    return {
        score: { ...m.score, goals: [0, 0], fouls: [0, 0], phase: 'play', pens: [], pensFirst: undefined, clock: { period: 1, running: false, elapsed: 0 }, rot: { on, queue, since, games } },
        winner, off, on: next,
    };
};

/** A match's score before a single point is played. */
export const freshScore = (sport: QuickSport, format?: QuickMatch['format'], teams = 2): QuickScore => sport === 'padel'
    ? { sets: [{ h: 0, a: 0 }], game: { h: 0, a: 0 } }
    : { goals: [0, 0], fouls: [0, 0], phase: 'play', pens: [], clock: { period: 1, running: false, elapsed: 0 }, ...(format?.mode === 'rotation' ? { rot: freshRotation(teams) } : {}) };

/** A friendly reason for a failed write, instead of blaming the connection every time. */
export const explain = (e: any): string => {
    const code = String(e?.code || '');
    if (code.includes('permission-denied')) return 'Your account isn’t allowed to do that. Sign out and back in, then try again.';
    if (code.includes('unauthenticated')) return 'You’re signed out. Sign in and try again.';
    if (code.includes('unavailable') || code.includes('deadline-exceeded') || (typeof navigator !== 'undefined' && !navigator.onLine)) return 'We couldn’t reach the server. Check your connection and try again.';
    if (code.includes('invalid-argument') || code.includes('failed-precondition')) return 'Some match details weren’t accepted. Check the players and try again.';
    return e?.message ? String(e.message).slice(0, 140) : 'Something went wrong. Try again.';
};

/** The match's current score as text, e.g. "6-4 3-2" (padel) or "3-1". */
export const scoreText = (m: QuickMatch) => m.sport === 'padel'
    ? setsOf(m).filter((s, i, all) => s.h + s.a > 0 || all.length === 1).map(({ h, a }) => `${h}-${a}`).join(' ') || '0-0'
    : isRotation(m) ? `${m.score.rot?.games.length || 0} games`
    : `${m.score.goals?.[0] ?? 0}-${m.score.goals?.[1] ?? 0}${(m.score.pens || []).length ? ` (${pensTally(m.score.pens).h}-${pensTally(m.score.pens).a} p)` : ''}`;

/** Which side a player is on (by account or email), if any. */
const hasPlayer = (t: QuickTeam, who: { uid?: string; email?: string }) => {
    const e = emailOf(who.email);
    return t.players.some(p => (who.uid && p.uid === who.uid) || (e && emailOf(p.email) === e));
};
export const sideOf = (m: QuickMatch, who: { uid?: string; email?: string }): QuickSide | null => {
    if (isRotation(m)) return null;
    return hasPlayer(m.home, who) ? 'home' : hasPlayer(m.away, who) ? 'away' : null;
};
/** The team index a player is on in a winner-stays session. */
export const rotTeamOf = (m: QuickMatch, who: { uid?: string; email?: string }) => (m.teams || []).findIndex(t => hasPlayer(t, who));

/** One result line per game a player played: a normal match gives one; winner stays gives one per game. */
export interface PlayerGame { result: 'W' | 'D' | 'L'; gf: number; ga: number; goals: number; label: string; at: string }
export const playerGames = (m: QuickMatch, who: { uid?: string; email?: string }): PlayerGame[] => {
    if (m.status !== 'COMPLETED') return [];
    const e = emailOf(who.email);
    const mine = (ev: QuickEvent) => ev.kind === 'goal' && !!e && emailOf(ev.playerEmail) === e;
    if (isRotation(m)) {
        const t = rotTeamOf(m, who);
        if (t < 0 || !m.teams) return [];
        return (m.score.rot?.games || []).flatMap((g, i) => {
            if (g.a !== t && g.b !== t) return [];
            const [gf, ga] = g.a === t ? [g.ga, g.gb] : [g.gb, g.ga];
            const result: PlayerGame['result'] = g.winner == null ? 'D' : g.winner === t ? 'W' : 'L';
            const opp = m.teams![g.a === t ? g.b : g.a]?.name || 'Team';
            return [{ result, gf, ga, goals: m.events.filter(ev => mine(ev) && ev.game === i).length, label: `${result} ${gf}-${ga} v ${opp}`, at: m.startAt }];
        });
    }
    const side = sideOf(m, who);
    if (!side) return [];
    const [hf, af] = m.sport === 'padel' ? setsWon(m) : (m.score.goals || [0, 0]);
    const [gf, ga] = side === 'home' ? [hf, af] : [af, hf];
    const result: PlayerGame['result'] = m.winner === 'draw' ? 'D' : m.winner === side ? 'W' : 'L';
    return [{ result, gf, ga, goals: m.events.filter(mine).length, label: `${result} ${scoreText(m)} · ${m.title}`, at: m.startAt }];
};

/** Sets won per side; a padel set is won at the target games with a two-game lead, or 7-5 / 7-6. */
export const setsWon = (m: QuickMatch): [number, number] => {
    const target = m.format.games || 6;
    return setsOf(m).reduce<[number, number]>(([h, a], s) => (setDone(target, s) ? (s.h > s.a ? [h + 1, a] : [h, a + 1]) : [h, a]), [0, 0]);
};
export const decide = (m: QuickMatch): QuickSide | 'draw' => {
    if (m.sport === 'padel') { const [h, a] = setsWon(m); return h > a ? 'home' : a > h ? 'away' : 'draw'; }
    if (isRotation(m)) return 'draw';
    const [h, a] = m.score.goals || [0, 0];
    if (h === a && (m.score.pens || []).length) { const p = pensTally(m.score.pens); return p.h > p.a ? 'home' : p.a > p.h ? 'away' : 'draw'; }
    return h > a ? 'home' : a > h ? 'away' : 'draw';
};

// ---------------------------------------------------------------- reading

export const subscribeMyQuickMatches = (email: string | undefined, cb: (rows: QuickMatch[]) => void) => {
    const e = emailOf(email);
    if (!db || !e) { cb([]); return () => {}; }
    return onSnapshot(query(collection(db, 'quickMatches'), where('invites', 'array-contains', e)),
        snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }) as QuickMatch).sort((a, b) => b.startAt.localeCompare(a.startAt))),
        err => { console.error('Quick matches', err); cb([]); });
};
/** The live match; `pending` is true while this phone has changes the server hasn't confirmed yet. */
export const subscribeQuickMatch = (id: string, cb: (m: QuickMatch | null, pending?: boolean) => void) => {
    if (!db) { cb(null); return () => {}; }
    return onSnapshot(doc(db, 'quickMatches', id), { includeMetadataChanges: true },
        d => cb(d.exists() ? ({ ...d.data(), id: d.id } as QuickMatch) : null, d.metadata.hasPendingWrites), () => cb(null));
};
/** The match a referee code belongs to. */
export const findByCode = async (code: string): Promise<string | null> => {
    if (!db) return null;
    const d = await getDoc(doc(db, 'quickCodes', code.trim()));
    return d.exists() ? (d.data().matchId as string) : null;
};

// ---------------------------------------------------------------- writing

export const createQuickMatch = async (m: Omit<QuickMatch, 'id' | 'refereeCode' | 'invites' | 'createdAt' | 'status' | 'score' | 'events'>): Promise<QuickMatch> => {
    if (!db) throw new Error('Database not available');
    const ref = doc(collection(db, 'quickMatches'));
    const refereeCode = newCode();
    // The rules check the host against the signed-in account, so always use the live auth uid.
    m = { ...m, hostUid: auth?.currentUser?.uid || m.hostUid };
    const everyone = (m.teams || [m.home, m.away]).flatMap(t => t.players.map(p => p.email));
    const invites = [...new Set([m.hostEmail, ...everyone].map(emailOf).filter(Boolean))];
    const full: QuickMatch = {
        ...m, id: ref.id, refereeCode, invites, status: 'SCHEDULED', events: [], createdAt: new Date().toISOString(),
        score: freshScore(m.sport, m.format, m.teams?.length),
    };
    await setDoc(ref, clean(full));
    await setDoc(doc(db, 'quickCodes', refereeCode), { matchId: ref.id, hostUid: full.hostUid });
    return full;
};
export const saveQuickMatch = (m: QuickMatch) => db ? setDoc(doc(db, 'quickMatches', m.id), clean({ ...m, updatedAt: Date.now() })) : Promise.resolve();
/** Score-only update (what a referee may change). */
export const saveQuickScore = (m: QuickMatch) => db ? updateDoc(doc(db, 'quickMatches', m.id), clean({ score: m.score, events: m.events, status: m.status, winner: m.winner ?? null, updatedAt: Date.now() })) : Promise.resolve();
export const deleteQuickMatch = async (m: QuickMatch) => {
    if (!db) return;
    await deleteDoc(doc(db, 'quickCodes', m.refereeCode)).catch(() => {});
    await deleteDoc(doc(db, 'quickMatches', m.id));
};

/** Email every invited player (not the host) a link to the match. */
export const emailInvites = async (m: QuickMatch) => {
    const to = m.invites.filter(e => e !== emailOf(m.hostEmail));
    const when = new Date(m.startAt).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const teams = (m.teams || [m.home, m.away]).map(t => t.name).join(' v ');
    await Promise.all(to.map(email => mailQuickInvite({ hostName: m.hostName, sport: m.sport, title: m.title, when, venue: m.venue, teams }, email)));
    return to.length;
};

// ---------------------------------------------------------------- friends

export interface Friend { name: string; email: string }
export const loadFriends = async (uid: string): Promise<Friend[]> => {
    if (!db) return [];
    const d = await getDoc(doc(db, 'players', uid));
    return (d.data()?.friends as Friend[]) || [];
};
export const saveFriends = async (uid: string, friends: Friend[]) => {
    if (!db) return;
    await updateDoc(doc(db, 'players', uid), { friends: clean(friends) });
};

/** Invite someone just added as a friend to Match Up. */
export const emailFriendInvite = (from: { name: string; email?: string }, friend: Friend) => mailFriendAdded(from, friend);

export const me = () => ({ uid: auth?.currentUser?.uid as string | undefined, email: auth?.currentUser?.email as string | undefined });

// ---------------------------------------------------------------- local table

export interface TableRow { email: string; name: string; p: number; w: number; d: number; l: number; gf: number; ga: number; goals: number; pts: number }
/**
 * The Quick Play table: everyone with an email across finished matches you can see.
 * Win 3, draw 1. Email is the player's identity, so players added without one don't rank.
 */
export const quickTable = (matches: QuickMatch[], sport?: QuickSport): TableRow[] => {
    const rows = new Map<string, TableRow>();
    matches.filter(m => m.status === 'COMPLETED' && (!sport || m.sport === sport)).forEach(m => {
        const people = new Map<string, string>();
        [...(m.teams || [m.home, m.away])].forEach(t => t.players.forEach(p => {
            const e = emailOf(p.email || (p.uid && p.uid === m.hostUid ? m.hostEmail : ''));
            if (e && !people.has(e)) people.set(e, p.name);
        }));
        people.forEach((name, e) => playerGames(m, { email: e }).forEach(g => {
            const r = rows.get(e) || { email: e, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, goals: 0, pts: 0 };
            r.p++; r.gf += g.gf; r.ga += g.ga; r.goals += g.goals;
            if (g.result === 'W') r.w++; else if (g.result === 'D') r.d++; else r.l++;
            r.pts += gamePoints(g, m.sport);
            rows.set(e, r);
        }));
    });
    return [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.goals - x.goals || x.name.localeCompare(y.name));
};

// ---------------------------------------------------------------- Quick Play points & community board
//   quickBoard/{matchId}   one finished match's points per player (no emails: players are keyed by a hash)
// Separate from the official rankings: it never touches tournaments or the landing-page leaderboard.

/** Points for one game: 1 for playing, 3 a win or 1 a draw, plus 1 per goal (or per padel set won). */
export const QUICK_POINTS = { play: 1, win: 3, draw: 1, goal: 1 };
export const gamePoints = (g: PlayerGame, sport: QuickSport) =>
    QUICK_POINTS.play + (g.result === 'W' ? QUICK_POINTS.win : g.result === 'D' ? QUICK_POINTS.draw : 0) + (sport === 'padel' ? g.gf : g.goals) * QUICK_POINTS.goal;

/** A stable, non-reversible key for a player's email, so the public board never shows addresses. */
export const playerKey = async (email: string) => {
    const data = new TextEncoder().encode(emailOf(email));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
};
export interface BoardLine { key: string; name: string; p: number; w: number; d: number; l: number; goals: number; pts: number }
export interface BoardDoc { matchId: string; sport: QuickSport; hostUid: string; at: string; lines: BoardLine[] }

/** Publish a finished match's points (the host's device does this; it's safe to repeat). */
export const publishBoard = async (m: QuickMatch) => {
    if (!db || m.status !== 'COMPLETED') return;
    const people = new Map<string, string>();
    (m.teams || [m.home, m.away]).forEach(t => t.players.forEach(p => { const e = emailOf(p.email || (p.uid === m.hostUid ? m.hostEmail : '')); if (e && !people.has(e)) people.set(e, p.name); }));
    const lines: BoardLine[] = [];
    for (const [e, name] of people) {
        const games = playerGames(m, { email: e });
        if (!games.length) continue;
        lines.push({
            key: await playerKey(e), name,
            p: games.length, w: games.filter(g => g.result === 'W').length, d: games.filter(g => g.result === 'D').length, l: games.filter(g => g.result === 'L').length,
            goals: games.reduce((n, g) => n + g.goals, 0), pts: games.reduce((n, g) => n + gamePoints(g, m.sport), 0),
        });
    }
    await setDoc(doc(db, 'quickBoard', m.id), { matchId: m.id, sport: m.sport, hostUid: m.hostUid, at: m.startAt, lines } satisfies BoardDoc);
};
/** The latest published matches, for the community leaderboard. */
export const subscribeBoard = (cb: (rows: BoardDoc[]) => void) => {
    if (!db) { cb([]); return () => {}; }
    return onSnapshot(query(collection(db, 'quickBoard'), orderBy('at', 'desc'), limit(500)), snap => cb(snap.docs.map(d => d.data() as BoardDoc)), () => cb([]));
};
/** Add up published matches into a leaderboard (optionally one sport). */
export const boardTable = (docs: BoardDoc[], sport?: QuickSport) => {
    const rows = new Map<string, BoardLine>();
    docs.filter(d => !sport || d.sport === sport).forEach(d => d.lines.forEach(l => {
        const r = rows.get(l.key) || { key: l.key, name: l.name, p: 0, w: 0, d: 0, l: 0, goals: 0, pts: 0 };
        r.p += l.p; r.w += l.w; r.d += l.d; r.l += l.l; r.goals += l.goals; r.pts += l.pts; r.name = l.name;
        rows.set(l.key, r);
    }));
    return [...rows.values()].sort((a, b) => b.pts - a.pts || b.w - a.w || b.goals - a.goals || a.name.localeCompare(b.name));
};
