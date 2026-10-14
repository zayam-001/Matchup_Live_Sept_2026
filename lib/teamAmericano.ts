// Team Americano: fixed pairs register as one team, play a set number of
// rounds against rotating opponents and are ranked by total points scored.
//
// Everything in here is pure (no Firestore, no React) so scheduling and
// standings behave identically in the admin panel, the referee app, spectator
// mode and the stats self-heal in services/storage.ts.

import type {
    Match,
    Team,
    TeamAmericanoConfig,
    TeamAmericanoTiebreaker,
    Tournament,
} from '../types';
import { STAGE_WEIGHT } from './pointsSystems';

// ── Format helpers ───────────────────────────────────────────────────────────

export const TEAM_AMERICANO = 'TEAM_AMERICANO';

export const isTeamAmericanoFormat = (format?: string | null) => format === TEAM_AMERICANO;

/** Individual-registration formats (one "team" record per player). */
export const isPlayerAmericanoFormat = (format?: string | null) => format === 'AMERICANO' || format === 'MEXICANO';

/** Formats scored as a running rally-points total instead of games/sets. */
export const isPointsScoredFormat = (format?: string | null) =>
    isPlayerAmericanoFormat(format) || isTeamAmericanoFormat(format);

export const FORMAT_LABELS: Record<string, string> = {
    SINGLE_ELIMINATION: 'Single Elimination',
    DOUBLE_ELIMINATION: 'Double Elimination',
    ROUND_ROBIN: 'Round Robin',
    GROUP_TO_KNOCKOUT: 'Group Stage + Knockout',
    AMERICANO: 'Player Americano',
    MEXICANO: 'Mexicano',
    TEAM_AMERICANO: 'Team Americano',
};

export const formatLabel = (format?: string | null) =>
    (format && FORMAT_LABELS[format]) || String(format || 'Standard').replace(/_/g, ' ');

/** The format that actually applies to a category (categories can override the tournament). */
export const getActiveFormat = (tournament: Partial<Tournament> | null | undefined, categoryId?: string | null): string => {
    if (!tournament) return '';
    if (categoryId && categoryId !== 'ALL' && categoryId !== 'all') {
        const cat = tournament.categories?.find(c => c.id === categoryId);
        if (cat?.format) return cat.format;
    }
    return tournament.format || '';
};

// ── Config ───────────────────────────────────────────────────────────────────

export const TIEBREAKER_LABELS: Record<TeamAmericanoTiebreaker, string> = {
    wins: 'Match wins',
    pointDiff: 'Point differential',
    headToHead: 'Head-to-head result',
    fewestByes: 'Fewest byes',
};

export const DEFAULT_TIEBREAKERS: TeamAmericanoTiebreaker[] = ['wins', 'pointDiff', 'headToHead', 'fewestByes'];

export const TARGET_POINT_PRESETS = [16, 21, 24, 32];

export type ResolvedTeamAmericanoConfig = Required<Omit<TeamAmericanoConfig, 'rounds'>> & { rounds?: number };

export const TEAM_AMERICANO_DEFAULTS: ResolvedTeamAmericanoConfig = {
    minTeams: 4,
    rounds: undefined,
    scoringMode: 'points_total',
    targetPoints: 24,
    roundDuration: 20,
    breakMinutes: 5,
    byeScoring: 'average',
    byePoints: 12,
    tiebreakers: DEFAULT_TIEBREAKERS,
    showPlayerStandings: false,
    finals: 'none',
    withdrawalRule: 'keep',
};

export const resolveTeamAmericanoConfig = (config?: TeamAmericanoConfig | null): ResolvedTeamAmericanoConfig => {
    const merged: ResolvedTeamAmericanoConfig = { ...TEAM_AMERICANO_DEFAULTS };
    if (config) {
        (Object.keys(config) as (keyof TeamAmericanoConfig)[]).forEach(k => {
            if (config[k] !== undefined && config[k] !== null) (merged as any)[k] = config[k];
        });
    }
    // Keep every tiebreaker exactly once, in the admin's order.
    const order = (merged.tiebreakers || []).filter((t, i, arr) => DEFAULT_TIEBREAKERS.includes(t) && arr.indexOf(t) === i);
    merged.tiebreakers = [...order, ...DEFAULT_TIEBREAKERS.filter(t => !order.includes(t))];
    return merged;
};

/** Category config overrides the tournament-level one. */
export const getTeamAmericanoConfig = (tournament: Partial<Tournament> | null | undefined, categoryId?: string | null) => {
    const cat = categoryId ? tournament?.categories?.find(c => c.id === categoryId) : undefined;
    return resolveTeamAmericanoConfig({ ...(tournament?.teamAmericano || {}), ...(cat?.teamAmericano || {}) });
};

// ── Setup summary ────────────────────────────────────────────────────────────

/** Rounds needed for every team to meet every other team once. */
export const suggestedRounds = (teamCount: number) => {
    if (teamCount < 2) return 0;
    return teamCount % 2 === 0 ? teamCount - 1 : teamCount;
};

export const finalsMatchCount = (finals: ResolvedTeamAmericanoConfig['finals']) =>
    finals === 'top2' ? 1 : finals === 'top4' ? 3 : 0;

export interface TeamAmericanoSummary {
    rounds: number;
    matchesPerRound: number;
    roundMatches: number;
    finalsMatches: number;
    totalMatches: number;
    byesPerRound: number;
    courtsNeeded: number;
    wavesPerRound: number;
    minutesPerRound: number;
    totalMinutes: number;
    fullRotation: boolean;
}

export const summarizeTeamAmericano = (
    teamCount: number,
    courtCount: number,
    config?: TeamAmericanoConfig | null,
): TeamAmericanoSummary => {
    const cfg = resolveTeamAmericanoConfig(config);
    const full = suggestedRounds(teamCount);
    const rounds = Math.max(0, cfg.rounds || full);
    const matchesPerRound = Math.floor(teamCount / 2);
    const courts = Math.max(1, courtCount || 0);
    const wavesPerRound = matchesPerRound > 0 ? Math.ceil(matchesPerRound / courts) : 0;
    const slot = cfg.roundDuration + cfg.breakMinutes;
    const minutesPerRound = wavesPerRound * slot;
    const finalsMatches = teamCount >= (cfg.finals === 'top4' ? 4 : 2) ? finalsMatchCount(cfg.finals) : 0;
    const finalsMinutes = cfg.finals === 'top4' ? 2 * slot : cfg.finals === 'top2' ? slot : 0;
    return {
        rounds,
        matchesPerRound,
        roundMatches: rounds * matchesPerRound,
        finalsMatches,
        totalMatches: rounds * matchesPerRound + finalsMatches,
        byesPerRound: teamCount % 2,
        courtsNeeded: matchesPerRound,
        wavesPerRound,
        minutesPerRound,
        totalMinutes: rounds * minutesPerRound + finalsMinutes,
        fullRotation: rounds >= full,
    };
};

// ── Scheduling ───────────────────────────────────────────────────────────────

export const BYE = 'BYE';

export interface RoundPlan {
    round: number;
    pairings: [string, string][];
    byeTeamId?: string;
}

const shuffle = <T,>(items: T[], rng: () => number): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/**
 * Circle-method round robin. Within one full rotation no two teams meet twice
 * and, for odd counts, every team sits out exactly once before anyone sits out
 * a second time. Asking for more rounds than a full rotation starts a second
 * rotation; fewer rounds simply stops early (some opponents are never met).
 */
export const buildRoundRobinPlan = (
    teamIds: string[],
    rounds: number,
    options: { startRound?: number; rng?: () => number } = {},
): RoundPlan[] => {
    const rng = options.rng || Math.random;
    const startRound = options.startRound || 1;
    if (teamIds.length < 2 || rounds < 1) return [];

    const ring = shuffle(teamIds, rng);
    if (ring.length % 2 === 1) ring.push(BYE);
    const n = ring.length;
    const fixed = ring[0];
    const rotating = ring.slice(1);

    const plans: RoundPlan[] = [];
    for (let r = 0; r < rounds; r++) {
        const k = r % (n - 1);
        const rotated = [...rotating.slice(n - 1 - k), ...rotating.slice(0, n - 1 - k)];
        const order = [fixed, ...rotated];
        const plan: RoundPlan = { round: startRound + r, pairings: [] };
        for (let i = 0; i < n / 2; i++) {
            // Alternate sides so the fixed team isn't always listed first.
            const a = order[i];
            const b = order[n - 1 - i];
            if (a === BYE || b === BYE) {
                plan.byeTeamId = a === BYE ? b : a;
            } else {
                plan.pairings.push(r % 2 === 0 ? [a, b] : [b, a]);
            }
        }
        plans.push(plan);
    }
    return plans;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Plans the rounds still to be played after the field changed mid-event (a
 * withdrawal or disqualification). Already-played meetings are respected: it
 * prefers opponents a team hasn't met, and gives the bye to whoever has had
 * the fewest so far.
 */
export const planRemainingRounds = (
    activeTeamIds: string[],
    playedPairs: [string, string][],
    byeCounts: Record<string, number>,
    roundNumbers: number[],
    rng: () => number = Math.random,
): RoundPlan[] => {
    // Round-by-round planning can paint itself into a corner, so try a few
    // draws and keep the one with the fewest repeat meetings.
    let best: { plans: RoundPlan[]; repeats: number } | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
        const plans = planRemainingRoundsOnce(activeTeamIds, playedPairs, byeCounts, roundNumbers, rng);
        const seen: Record<string, number> = {};
        playedPairs.forEach(([a, b]) => (seen[pairKey(a, b)] = (seen[pairKey(a, b)] || 0) + 1));
        let repeats = 0;
        plans.forEach(p => p.pairings.forEach(([a, b]) => {
            const key = pairKey(a, b);
            if (seen[key]) repeats += seen[key];
            seen[key] = (seen[key] || 0) + 1;
        }));
        if (!best || repeats < best.repeats) best = { plans, repeats };
        if (repeats === 0) break;
    }
    return best ? best.plans : [];
};

const planRemainingRoundsOnce = (
    activeTeamIds: string[],
    playedPairs: [string, string][],
    byeCounts: Record<string, number>,
    roundNumbers: number[],
    rng: () => number,
): RoundPlan[] => {
    const meetings: Record<string, number> = {};
    playedPairs.forEach(([a, b]) => {
        const key = pairKey(a, b);
        meetings[key] = (meetings[key] || 0) + 1;
    });
    const byes: Record<string, number> = { ...byeCounts };
    const plans: RoundPlan[] = [];

    for (const round of roundNumbers) {
        let pool = shuffle(activeTeamIds, rng);
        let byeTeamId: string | undefined;
        if (pool.length % 2 === 1) {
            const fewest = Math.min(...pool.map(id => byes[id] || 0));
            // Among those due a bye, prefer the team with the fewest opponents left to meet.
            const unmet = (id: string) => pool.filter(o => o !== id && !meetings[pairKey(id, o)]).length;
            byeTeamId = pool
                .filter(id => (byes[id] || 0) === fewest)
                .sort((a, b) => unmet(a) - unmet(b))[0];
            pool = pool.filter(id => id !== byeTeamId);
            byes[byeTeamId!] = (byes[byeTeamId!] || 0) + 1;
        }

        const pairings = pairWithFewestRepeats(pool, meetings);
        pairings.forEach(([a, b]) => {
            const key = pairKey(a, b);
            meetings[key] = (meetings[key] || 0) + 1;
        });
        plans.push({ round, pairings, byeTeamId });
    }
    return plans;
};

/** Perfect matching where no pair has met more than `limit` times, raising the limit until one exists. */
const pairWithFewestRepeats = (teamIds: string[], meetings: Record<string, number>): [string, string][] => {
    const met = (a: string, b: string) => meetings[pairKey(a, b)] || 0;
    const maxMet = teamIds.reduce((m, a) => Math.max(m, ...teamIds.map(b => (a === b ? 0 : met(a, b)))), 0);

    for (let limit = 0; limit <= maxMet + 1; limit++) {
        let budget = 20000; // keeps pathological cases from hanging the UI
        const search = (remaining: string[]): [string, string][] | null => {
            if (remaining.length === 0) return [];
            if (--budget < 0) return null;
            // Most-constrained team first.
            const options = (id: string) => remaining.filter(o => o !== id && met(id, o) <= limit);
            const first = [...remaining].sort((a, b) => options(a).length - options(b).length)[0];
            const candidates = options(first).sort((a, b) => met(first, a) - met(first, b));
            for (const partner of candidates) {
                const rest = search(remaining.filter(id => id !== first && id !== partner));
                if (rest) return [[first, partner], ...rest];
            }
            return null;
        };
        const result = search(teamIds);
        if (result) return result;
    }
    // Fallback: pair in order (only reachable if the search budget ran out).
    const out: [string, string][] = [];
    for (let i = 0; i + 1 < teamIds.length; i += 2) out.push([teamIds[i], teamIds[i + 1]]);
    return out;
};

export interface ScheduledSlot {
    round: number;
    team1Id: string;
    team2Id: string;
    court: string;
    wave: number;
    scheduledTime: string;
}

/** Puts one round's matches on courts, starting at `roundStart`; extra matches queue into waves. */
export const layoutRound = (
    plan: RoundPlan,
    courts: string[],
    config: TeamAmericanoConfig | null | undefined,
    roundStart: Date,
): ScheduledSlot[] => {
    const cfg = resolveTeamAmericanoConfig(config);
    const courtList = courts.length > 0 ? courts : ['Court 1'];
    const slotMs = (cfg.roundDuration + cfg.breakMinutes) * 60000;
    return plan.pairings.map(([team1Id, team2Id], i) => {
        const wave = Math.floor(i / courtList.length);
        return {
            round: plan.round,
            team1Id,
            team2Id,
            court: courtList[i % courtList.length],
            wave,
            scheduledTime: new Date(roundStart.getTime() + wave * slotMs).toISOString(),
        };
    });
};

/**
 * Spreads each round's matches over the courts. With fewer courts than
 * matches, the round runs in waves; the next round starts after the last wave.
 */
export const assignCourtsAndTimes = (
    plans: RoundPlan[],
    courts: string[],
    config: TeamAmericanoConfig | null | undefined,
    startTime: Date,
): ScheduledSlot[] => {
    const cfg = resolveTeamAmericanoConfig(config);
    const slotMs = (cfg.roundDuration + cfg.breakMinutes) * 60000;
    const maxMatches = Math.max(1, ...plans.map(p => p.pairings.length));
    const roundMs = Math.ceil(maxMatches / Math.max(1, courts.length)) * slotMs;
    return plans.flatMap(plan => layoutRound(plan, courts, cfg, new Date(startTime.getTime() + (plan.round - 1) * roundMs)));
};

// ── Match helpers ────────────────────────────────────────────────────────────

const INACTIVE_STATUSES = ['WITHDRAWN', 'DISQUALIFIED', 'REJECTED', 'REPLACED'];

export const isTeamActive = (team: Partial<Team> | undefined) =>
    !!team && !INACTIVE_STATUSES.includes(String(team.status || '').toUpperCase());

export const isMatchFinished = (m: Partial<Match>) => {
    const s = String(m?.status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'FINISHED';
};

export const isMatchStarted = (m: Partial<Match>) => {
    const s = String(m?.status || '').toUpperCase();
    return isMatchFinished(m) || s === 'IN_PROGRESS' || s === 'LIVE';
};

export const isFinalsMatch = (m: Partial<Match>) => String(m?.stage || '').toUpperCase() === 'KNOCKOUT';

/** Points each side scored. Rally scoring stores them as games / a single "set". */
export const matchPoints = (m: Partial<Match>): [number, number] => {
    const s: any = m?.score || {};
    if (Array.isArray(s.p1SetScores) && s.p1SetScores.length > 0) {
        const sum = (arr: any[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
        return [sum(s.p1SetScores), sum(s.p2SetScores || [])];
    }
    if (s.p1Games !== undefined || s.p2Games !== undefined) return [Number(s.p1Games) || 0, Number(s.p2Games) || 0];
    return [Number(s.rawPointsA ?? s.p1Points) || 0, Number(s.rawPointsB ?? s.p2Points) || 0];
};

export interface RoundOverview {
    round: number;
    matches: Match[];
    byeTeamIds: string[];
    started: boolean;
    finished: boolean;
}

/** Round-by-round view of the schedule, with the team(s) sitting out each round. */
export const getRoundOverview = (teams: Team[], matches: Match[]): RoundOverview[] => {
    const roundMatches = matches.filter(m => !isFinalsMatch(m));
    const scheduledTeamIds = new Set<string>();
    roundMatches.forEach(m => {
        if (m.team1Id) scheduledTeamIds.add(m.team1Id);
        if (m.team2Id) scheduledTeamIds.add(m.team2Id);
    });
    const eligible = teams.filter(t => isTeamActive(t) && scheduledTeamIds.has(t.id));

    const rounds = Array.from(new Set(roundMatches.map(m => Number(m.round) || 1))).sort((a, b) => a - b);
    return rounds.map(round => {
        const ms = roundMatches
            .filter(m => (Number(m.round) || 1) === round)
            .sort((a, b) => String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || '')) || String(a.court || '').localeCompare(String(b.court || '')));
        const playing = new Set<string>();
        ms.forEach(m => {
            if (m.team1Id) playing.add(m.team1Id);
            if (m.team2Id) playing.add(m.team2Id);
        });
        return {
            round,
            matches: ms,
            byeTeamIds: eligible.filter(t => !playing.has(t.id)).map(t => t.id),
            started: ms.some(isMatchStarted),
            finished: ms.length > 0 && ms.every(isMatchFinished),
        };
    });
};

// ── Standings ────────────────────────────────────────────────────────────────

export type TeamAmericanoStanding<T extends Team = Team> = T & {
    matchesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    pointsScored: number;
    pointsConceded: number;
    pointDifferential: number;
    byes: number;
    byePoints: number;
    standingRank: number;
    tieUnresolved: boolean;
    knockoutStage: string;
    knockoutWeight: number;
};

const sortDesc = <T,>(items: T[], key: (t: T) => number) => [...items].sort((a, b) => key(b) - key(a));

const splitByKey = <T,>(items: T[], key: (t: T) => number): T[][] => {
    const groups: T[][] = [];
    sortDesc(items, key).forEach(item => {
        const last = groups[groups.length - 1];
        if (last && key(last[0]) === key(item)) last.push(item);
        else groups.push([item]);
    });
    return groups;
};

/**
 * Ranks teams by total points, then the admin's tiebreaker order. Teams still
 * level after every tiebreaker are flagged `tieUnresolved` (the admin decides
 * or runs a sudden-death playoff) and listed alphabetically.
 */
export const computeTeamAmericanoStandings = <T extends Team>(
    teams: T[],
    matches: Match[],
    config?: TeamAmericanoConfig | null,
): TeamAmericanoStanding<T>[] => {
    const cfg = resolveTeamAmericanoConfig(config);
    const teamById = new Map(teams.map(t => [t.id, t]));
    const excluded = (id?: string) => !!id && teamById.has(id) && !isTeamActive(teamById.get(id));

    const rows = new Map<string, TeamAmericanoStanding<T>>();
    teams.forEach(t => {
        rows.set(t.id, {
            ...t,
            matchesPlayed: 0, wins: 0, losses: 0, ties: 0,
            points: 0, pointsScored: 0, pointsConceded: 0, pointDifferential: 0,
            byes: 0, byePoints: 0,
            standingRank: 0, tieUnresolved: false,
            knockoutStage: '', knockoutWeight: 0,
        });
    });

    const counted = matches.filter(m => {
        if (isFinalsMatch(m)) return false;
        if (cfg.withdrawalRule === 'void' && (excluded(m.team1Id) || excluded(m.team2Id))) return false;
        return true;
    });
    const finished = counted.filter(isMatchFinished);

    finished.forEach(m => {
        const [a, b] = matchPoints(m);
        const apply = (id: string | undefined, scored: number, conceded: number) => {
            const row = id ? rows.get(id) : undefined;
            if (!row) return;
            row.matchesPlayed += 1;
            row.pointsScored += scored;
            row.pointsConceded += conceded;
            if (scored > conceded) row.wins += 1;
            else if (scored < conceded) row.losses += 1;
            else row.ties += 1;
        };
        apply(m.team1Id, a, b);
        apply(m.team2Id, b, a);
    });

    // Byes: a team on the schedule that isn't playing in a round that's under way.
    const overview = getRoundOverview(teams, counted);
    const finishedTeamMatches = finished.length * 2;
    const totalScored = finished.reduce((sum, m) => sum + matchPoints(m)[0] + matchPoints(m)[1], 0);
    const byeValue =
        cfg.byeScoring === 'zero' ? 0
        : cfg.byeScoring === 'fixed' ? Number(cfg.byePoints) || 0
        : finishedTeamMatches > 0 ? Math.round(totalScored / finishedTeamMatches) : 0;
    overview.forEach(r => {
        if (!r.matches.some(isMatchFinished)) return;
        r.byeTeamIds.forEach(id => {
            const row = rows.get(id);
            if (!row) return;
            row.byes += 1;
            row.byePoints += byeValue;
        });
    });

    rows.forEach(row => {
        row.pointDifferential = row.pointsScored - row.pointsConceded;
        row.points = row.pointsScored + row.byePoints;
        // Mirror into the generic fields older screens/exports read.
        (row as any).gamesWon = row.pointsScored;
        (row as any).gamesLost = row.pointsConceded;
        (row as any).gamesPlayed = row.pointsScored + row.pointsConceded;
        (row as any).gd = row.pointDifferential;
        (row as any).setsWon = 0;
        (row as any).setsLost = 0;
        (row as any).missedMatchPoints = row.byePoints;
    });

    // Only confirmed teams are ranked; pending registrations and teams that
    // left keep their stats but no position.
    const isRanked = (r: Team) => isTeamActive(r) && ['', 'ACCEPTED', 'APPROVED'].includes(String(r.status || '').toUpperCase());
    const active = Array.from(rows.values()).filter(isRanked);
    const inactive = Array.from(rows.values()).filter(r => !isRanked(r));

    // Head-to-head inside a tied group: wins, then point difference, in the
    // matches those teams played against each other.
    const headToHead = (group: TeamAmericanoStanding<T>[]) => {
        const ids = new Set(group.map(g => g.id));
        const h2h: Record<string, { wins: number; diff: number }> = {};
        group.forEach(g => (h2h[g.id] = { wins: 0, diff: 0 }));
        finished.forEach(m => {
            if (!m.team1Id || !m.team2Id || !ids.has(m.team1Id) || !ids.has(m.team2Id)) return;
            const [a, b] = matchPoints(m);
            h2h[m.team1Id].diff += a - b;
            h2h[m.team2Id].diff += b - a;
            if (a > b) h2h[m.team1Id].wins += 1;
            else if (b > a) h2h[m.team2Id].wins += 1;
        });
        return (t: TeamAmericanoStanding<T>) => h2h[t.id].wins * 100000 + h2h[t.id].diff;
    };

    const keyFor = (criterion: TeamAmericanoTiebreaker, group: TeamAmericanoStanding<T>[]) => {
        switch (criterion) {
            case 'wins': return (t: TeamAmericanoStanding<T>) => t.wins;
            case 'pointDiff': return (t: TeamAmericanoStanding<T>) => t.pointDifferential;
            case 'headToHead': return headToHead(group);
            case 'fewestByes': return (t: TeamAmericanoStanding<T>) => -t.byes;
        }
    };

    const resolve = (group: TeamAmericanoStanding<T>[], criteria: TeamAmericanoTiebreaker[]): TeamAmericanoStanding<T>[][] => {
        if (group.length <= 1 || criteria.length === 0) return [group];
        const [first, ...rest] = criteria;
        return splitByKey(group, keyFor(first, group)).flatMap(g => resolve(g, rest));
    };

    const tieGroups = splitByKey(active, t => t.points).flatMap(g => resolve(g, cfg.tiebreakers));
    let ordered: TeamAmericanoStanding<T>[] = [];
    tieGroups.forEach(group => {
        const playedSomething = group.some(t => t.matchesPlayed > 0);
        group.forEach(t => (t.tieUnresolved = group.length > 1 && playedSomething));
        ordered.push(...[...group].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });

    // Placement for the ranking system.
    const finals = matches.filter(m => isFinalsMatch(m) && isMatchFinished(m));
    const setStage = (id: string | undefined, stage: keyof typeof STAGE_WEIGHT) => {
        const row = id ? rows.get(id) : undefined;
        if (row && STAGE_WEIGHT[stage] > row.knockoutWeight) {
            row.knockoutStage = stage;
            row.knockoutWeight = STAGE_WEIGHT[stage];
        }
    };
    const winnerOf = (m: Match) => {
        const [a, b] = matchPoints(m);
        if (m.winnerTeamId) return m.winnerTeamId;
        return a >= b ? m.team1Id : m.team2Id;
    };
    finals.forEach(m => {
        const winner = winnerOf(m);
        const loser = winner === m.team1Id ? m.team2Id : m.team1Id;
        if (/^final$/i.test(String(m.roundName || '').trim())) {
            setStage(winner, 'CHAMPION');
            setStage(loser, 'RUNNER_UP');
        } else {
            setStage(loser, 'SEMI_FINALIST');
        }
    });

    const allRoundsDone = counted.length > 0 && counted.every(isMatchFinished);
    if (cfg.finals === 'none' && allRoundsDone) {
        const stages: (keyof typeof STAGE_WEIGHT)[] = ['CHAMPION', 'RUNNER_UP', 'SEMI_FINALIST', 'SEMI_FINALIST',
            'QUARTER_FINALIST', 'QUARTER_FINALIST', 'QUARTER_FINALIST', 'QUARTER_FINALIST'];
        ordered.forEach((t, i) => stages[i] && setStage(t.id, stages[i]));
    }

    // With finals, bracket finish is the primary sort key.
    if (finals.length > 0) {
        const roundRank = new Map(ordered.map((t, i) => [t.id, i]));
        ordered = [...ordered].sort((a, b) => (b.knockoutWeight - a.knockoutWeight) || (roundRank.get(a.id)! - roundRank.get(b.id)!));
    }

    ordered.forEach((t, i) => (t.standingRank = i + 1));
    inactive.forEach(t => (t.standingRank = 0));
    return [...ordered, ...inactive];
};

// ── Finals ───────────────────────────────────────────────────────────────────

export interface FinalsSlot {
    key: 'F' | 'SF1' | 'SF2';
    roundName: string;
    round: number;
    team1Id?: string;
    team2Id?: string;
    feedsFrom?: [FinalsSlot['key'], FinalsSlot['key']];
}

/** Top 2 → one final; top 4 → 1v4 and 2v3 semifinals feeding the final. */
export const buildFinalsPlan = (rankedTeamIds: string[], finals: ResolvedTeamAmericanoConfig['finals'], afterRound: number): FinalsSlot[] => {
    if (finals === 'top2' && rankedTeamIds.length >= 2) {
        return [{ key: 'F', roundName: 'Final', round: afterRound + 1, team1Id: rankedTeamIds[0], team2Id: rankedTeamIds[1] }];
    }
    if (finals === 'top4' && rankedTeamIds.length >= 4) {
        return [
            { key: 'SF1', roundName: 'Semi-Final 1', round: afterRound + 1, team1Id: rankedTeamIds[0], team2Id: rankedTeamIds[3] },
            { key: 'SF2', roundName: 'Semi-Final 2', round: afterRound + 1, team1Id: rankedTeamIds[1], team2Id: rankedTeamIds[2] },
            { key: 'F', roundName: 'Final', round: afterRound + 2, feedsFrom: ['SF1', 'SF2'] },
        ];
    }
    return [];
};

/** Per-player view: both players share the team's result. */
export const toPlayerStandings = (standings: TeamAmericanoStanding[]) =>
    standings
        .filter(t => isTeamActive(t))
        .flatMap(t => [t.player1, t.player2]
            .filter(p => p && p.name && p.name !== 'N/A')
            .map(p => ({
                key: `${t.id}_${p.id || p.email || p.name}`,
                playerName: p.name,
                country: p.country,
                teamId: t.id,
                teamName: t.name,
                rank: t.standingRank,
                points: t.points,
                wins: t.wins,
                matchesPlayed: t.matchesPlayed,
            })));
