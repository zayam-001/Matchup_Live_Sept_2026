// Futsal rules as pure functions: the match clock and state machine, scores,
// fouls and cards from the event log, fixtures, brackets, standings and stats.
// Nothing here touches Firestore, so it all runs the same in demo mode and tests.
import { newId } from './presets';
import type {
    CompetitionFormat, DecidedBy, FutsalCategory, FutsalEvent, FutsalMatch, FutsalRules, FutsalTeam,
    Side, SlotSource, Stage, Tiebreaker,
} from './types';

export const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
export const isKnockout = (stage: Stage) => stage !== 'LEAGUE' && stage !== 'GROUP';
/** Formats whose first stage is one table with every team. */
export const isLeagueFormat = (f: CompetitionFormat) => f === 'LEAGUE' || f === 'DOUBLE_LEAGUE' || f === 'LEAGUE_PLAYOFFS' || f === 'LEAGUE_KNOCKOUT';
/** Formats that end in knockout matches. */
export const hasKnockoutStage = (f: CompetitionFormat) => f === 'KNOCKOUT' || f === 'GROUPS_KNOCKOUT' || f === 'LEAGUE_PLAYOFFS' || f === 'LEAGUE_KNOCKOUT';
/** How many league places go through: 4 for page playoffs, `advancePerGroup` for a knockout, else none. */
export const leagueQualifiers = (c: Pick<FutsalCategory, 'format' | 'advancePerGroup'>) => (c.format === 'LEAGUE_PLAYOFFS' ? 4 : c.format === 'LEAGUE_KNOCKOUT' ? Math.max(2, c.advancePerGroup) : 0);
export const GROUP_NAMES = 'ABCDEFGHIJKLMNOP'.split('');

// ---------------------------------------------------------------- clock

export const clockMs = (m: Pick<FutsalMatch, 'clock'>, now = Date.now()) =>
    (m.clock?.elapsedMs || 0) + (m.clock?.runningSince ? Math.max(0, now - m.clock.runningSince) : 0);

export const periodLengthMs = (rules: FutsalRules, period: number) =>
    (period > rules.periods ? rules.extraTimeMinutes : rules.periodMinutes) * 60000;

/** Clock time since kick-off, adding up the periods before this one. */
export const absoluteMs = (rules: FutsalRules, period: number, ms: number) => {
    let total = 0;
    for (let p = 1; p < period; p++) total += periodLengthMs(rules, p);
    return total + ms;
};

export const fmtClock = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** The match clock as shown on screen: "mm:ss", or "45:00 +01:20" once a period runs over. */
export const displayClock = (rules: FutsalRules, period: number, ms: number) => {
    const len = periodLengthMs(rules, period);
    const base = rules.continuousClock ? absoluteMs(rules, period, 0) : 0;
    return ms > len ? `${fmtClock(base + len)} +${fmtClock(ms - len)}` : fmtClock(base + ms);
};

/** The minute a fan would quote: 1-based, "20+" once a period runs over. */
export const eventMinute = (rules: FutsalRules, e: Pick<FutsalEvent, 'period' | 'ms'>) => {
    const len = periodLengthMs(rules, e.period);
    const before = absoluteMs(rules, e.period, 0) / 60000;
    if (e.ms >= len) return `${before + len / 60000}+'`;
    return `${Math.floor(before + e.ms / 60000) + 1}'`;
};

export const periodName = (rules: FutsalRules, period: number) => {
    if (period <= rules.periods) {
        if (rules.periods === 1) return 'Match';
        if (rules.periods === 2) return period === 1 ? '1st half' : '2nd half';
        return `Period ${period}`;
    }
    return `Extra time ${period - rules.periods}`;
};

export const phaseLabel = (m: FutsalMatch, rules: FutsalRules) => {
    if (m.status === 'COMPLETED') return m.decidedBy === 'penalties' ? 'FT · pens' : m.decidedBy === 'extra_time' || m.decidedBy === 'golden_goal' ? 'AET' : 'FT';
    if (m.status === 'SCHEDULED' || m.periodState === 'PRE') return 'Not started';
    if (m.periodState === 'SHOOTOUT') return 'Penalties';
    if (m.periodState === 'BREAK') return m.period === 1 && rules.periods === 2 ? 'Half-time' : 'Break';
    return periodName(rules, m.period);
};

// ---------------------------------------------------------------- score & counters

const real = (e: FutsalEvent, period?: number) => period == null || e.period === period;

export const scoreOf = (m: Pick<FutsalMatch, 'events'>) => {
    let home = 0, away = 0, pensHome = 0, pensAway = 0, pensTaken = 0;
    for (const e of m.events || []) {
        if (e.type === 'GOAL') e.side === 'home' ? home++ : away++;
        else if (e.type === 'OWN_GOAL') e.side === 'home' ? away++ : home++;
        else if (e.type === 'PEN_SCORED') { pensTaken++; e.side === 'home' ? pensHome++ : pensAway++; }
        else if (e.type === 'PEN_MISSED') pensTaken++;
    }
    return { home, away, pensHome, pensAway, hasPens: pensTaken > 0 };
};

/** Fouls count per half; extra time carries on from the last regular period, as in the Laws. */
export const foulsFor = (m: FutsalMatch, rules: FutsalRules, side: Side, period = m.period) => {
    // Without a foul limit (football, casual futsal) nothing resets at half-time: count the match.
    if (!rules.foulLimit) return (m.events || []).filter(e => e.type === 'FOUL' && e.side === side).length;
    const p = Math.min(period, rules.periods);
    return (m.events || []).filter(e => e.type === 'FOUL' && e.side === side && (e.period === p || (p === rules.periods && e.period > rules.periods && e.period <= period))).length;
};

export const timeoutsLeft = (m: FutsalMatch, rules: FutsalRules, side: Side) => {
    if (!rules.timeoutsPerPeriod || m.period > rules.periods) return 0;
    const used = (m.events || []).filter(e => e.type === 'TIMEOUT' && e.side === side && real(e, m.period)).length;
    return Math.max(0, rules.timeoutsPerPeriod - used);
};

export interface ShortHanded { side: Side; playerId?: string; remainingMs: number }

/**
 * Teams currently a player down after a red card. The penalty ends after the set
 * minutes of clock time, or as soon as the short team concedes.
 */
export const shortHanded = (m: FutsalMatch, rules: FutsalRules, now = Date.now()): ShortHanded[] => {
    if (!rules.redCardMinutes || m.status !== 'LIVE') return [];
    const nowAbs = absoluteMs(rules, m.period, clockMs(m, now));
    const out: ShortHanded[] = [];
    const evs = m.events || [];
    evs.forEach((e, i) => {
        if (e.type !== 'RED') return;
        const start = absoluteMs(rules, e.period, e.ms);
        const end = start + rules.redCardMinutes * 60000;
        if (nowAbs >= end) return;
        const conceded = evs.slice(i + 1).some(x => (x.type === 'GOAL' && x.side !== e.side) || (x.type === 'OWN_GOAL' && x.side === e.side));
        if (conceded) return;
        out.push({ side: e.side, playerId: e.playerId, remainingMs: end - nowAbs });
    });
    return out;
};

export const cardsFor = (m: FutsalMatch, playerId: string) => {
    const evs = (m.events || []).filter(e => e.playerId === playerId);
    return { yellows: evs.filter(e => e.type === 'YELLOW').length, red: evs.some(e => e.type === 'RED') };
};

// ---------------------------------------------------------------- state machine

const stamp = (m: FutsalMatch): FutsalMatch => ({ ...m, updatedAt: Date.now() });
const marker = (m: FutsalMatch, type: 'PERIOD_START' | 'PERIOD_END', ms: number, at = Date.now()): FutsalEvent =>
    ({ id: newId('e'), type, side: 'home', period: m.period, ms, at });

export const startPeriod = (m: FutsalMatch, now = Date.now()): FutsalMatch => {
    const period = m.periodState === 'PRE' || m.status === 'SCHEDULED' ? 1 : m.period + 1;
    const next: FutsalMatch = { ...m, status: 'LIVE', period, periodState: 'PLAYING', clock: { elapsedMs: 0, runningSince: now } };
    return stamp({ ...next, events: [...(m.events || []), marker(next, 'PERIOD_START', 0, now)] });
};

export const pauseClock = (m: FutsalMatch, now = Date.now()): FutsalMatch =>
    m.periodState !== 'PLAYING' ? m : stamp({ ...m, periodState: 'PAUSED', clock: { elapsedMs: clockMs(m, now), runningSince: null } });

export const resumeClock = (m: FutsalMatch, now = Date.now()): FutsalMatch =>
    m.periodState !== 'PAUSED' ? m : stamp({ ...m, periodState: 'PLAYING', clock: { elapsedMs: m.clock.elapsedMs, runningSince: now } });

/** Nudge the clock when the scorer started it late or forgot to stop it. */
export const adjustClock = (m: FutsalMatch, deltaMs: number, now = Date.now()): FutsalMatch => {
    const ms = Math.max(0, clockMs(m, now) + deltaMs);
    return stamp({ ...m, clock: { elapsedMs: ms, runningSince: m.clock.runningSince ? now : null } });
};

const level = (m: FutsalMatch) => { const s = scoreOf(m); return s.home === s.away; };

export const finishMatch = (m: FutsalMatch, decidedBy?: DecidedBy, now = Date.now()): FutsalMatch => {
    const s = scoreOf(m);
    let winner: Side | null = s.home > s.away ? 'home' : s.away > s.home ? 'away' : null;
    if (!winner && s.hasPens) winner = s.pensHome > s.pensAway ? 'home' : s.pensAway > s.pensHome ? 'away' : null;
    const how: DecidedBy = decidedBy || (s.hasPens && s.home === s.away ? 'penalties' : 'regular');
    const ms = m.clock ? clockMs(m, now) : 0;
    const events = m.periodState === 'PLAYING' || m.periodState === 'PAUSED' ? [...(m.events || []), marker(m, 'PERIOD_END', ms, now)] : m.events || [];
    return stamp({
        ...m, events, status: 'COMPLETED', periodState: 'ENDED',
        clock: { elapsedMs: ms, runningSince: null },
        winnerId: winner ? (winner === 'home' ? m.homeId : m.awayId) || null : null,
        decidedBy: how,
    });
};

/** End the running period and move to whatever the rules say comes next. */
export const endPeriod = (m: FutsalMatch, rules: FutsalRules, now = Date.now()): FutsalMatch => {
    const ms = clockMs(m, now);
    const ended: FutsalMatch = { ...m, clock: { elapsedMs: ms, runningSince: null }, events: [...(m.events || []), marker(m, 'PERIOD_END', ms, now)] };
    const P = rules.periods;
    const ko = isKnockout(m.stage);
    if (m.period < P) return stamp({ ...ended, periodState: 'BREAK' });
    if (m.period === P) {
        if (!ko || !level(ended)) return finishMatch({ ...ended, periodState: 'BREAK' }, 'regular', now);
        if (rules.knockoutTiebreak === 'penalties') return stamp({ ...ended, periodState: 'SHOOTOUT' });
        return stamp({ ...ended, periodState: 'BREAK' });
    }
    if (m.period === P + 1) return stamp({ ...ended, periodState: 'BREAK' });
    if (!level(ended)) return finishMatch({ ...ended, periodState: 'BREAK' }, 'extra_time', now);
    return stamp({ ...ended, periodState: 'SHOOTOUT' });
};

/** What the scorer's big button does next. */
export const nextAction = (m: FutsalMatch, rules: FutsalRules): { label: string; kind: 'start' | 'end' | 'none' } => {
    if (m.status === 'COMPLETED') return { label: 'Full time', kind: 'none' };
    if (m.periodState === 'SHOOTOUT') return { label: 'Penalty shootout', kind: 'none' };
    if (m.status === 'SCHEDULED' || m.periodState === 'PRE') return { label: 'Kick off', kind: 'start' };
    if (m.periodState === 'BREAK') return { label: `Start ${periodName(rules, m.period + 1).toLowerCase()}`, kind: 'start' };
    // The organiser sets how many periods there are; the last one ends the match
    // (unless a level knockout still needs extra time or penalties).
    const levelKo = isKnockout(m.stage) && (() => { const s = scoreOf(m); return s.home === s.away; })();
    if (m.period >= rules.periods && !levelKo) return { label: 'End match', kind: 'end' };
    return { label: `End ${periodName(rules, m.period).toLowerCase()}`, kind: 'end' };
};

/** Kicks taken per side in a shootout, in order. */
export const shootoutKicks = (m: FutsalMatch) => (m.events || []).filter(e => e.type === 'PEN_SCORED' || e.type === 'PEN_MISSED');
const kicks = shootoutKicks;

/** Which side kicks next; the side that kicked first keeps going first. */
export const shootoutNext = (m: FutsalMatch): Side => {
    const k = kicks(m);
    if (!k.length) return 'home';
    const first = k[0].side;
    const h = k.filter(e => e.side === first).length, a = k.length - h;
    return h > a ? other(first) : first;
};

/** True once one side can't be caught: best of five, then sudden death. */
export const shootoutDecided = (m: FutsalMatch, bestOf = 5) => {
    const k = kicks(m);
    const taken = { home: 0, away: 0 }, scored = { home: 0, away: 0 };
    k.forEach(e => { taken[e.side]++; if (e.type === 'PEN_SCORED') scored[e.side]++; });
    if (taken.home <= bestOf && taken.away <= bestOf) {
        const leftH = bestOf - taken.home, leftA = bestOf - taken.away;
        if (scored.home > scored.away + leftA) return true;
        if (scored.away > scored.home + leftH) return true;
        if (taken.home < bestOf || taken.away < bestOf) return false;
    }
    return taken.home === taken.away && scored.home !== scored.away;
};

/**
 * Add an event. A second yellow brings an automatic red; a golden goal or the
 * mercy rule ends the match; a decisive penalty ends the shootout.
 */
export const addEvent = (m: FutsalMatch, rules: FutsalRules, e: Omit<FutsalEvent, 'id' | 'at' | 'period' | 'ms'> & Partial<FutsalEvent>, now = Date.now()): FutsalMatch => {
    const ev: FutsalEvent = { id: newId('e'), at: now, period: m.period || 1, ms: clockMs(m, now), ...e } as FutsalEvent;
    let events = [...(m.events || []), ev];
    if (ev.type === 'YELLOW' && ev.playerId) {
        const yellows = events.filter(x => x.type === 'YELLOW' && x.playerId === ev.playerId).length;
        if (yellows === 2) events = [...events, { ...ev, id: newId('e'), type: 'RED', auto: true }];
    }
    let next: FutsalMatch = stamp({ ...m, events });
    if (ev.type === 'TIMEOUT' && next.periodState === 'PLAYING') next = pauseClock(next, now);
    if (ev.type === 'GOAL' || ev.type === 'OWN_GOAL') {
        const s = scoreOf(next);
        if (rules.knockoutTiebreak === 'golden_goal' && isKnockout(m.stage) && m.period > rules.periods && s.home !== s.away) return finishMatch(next, 'golden_goal', now);
        if (rules.mercyGoals > 0 && Math.abs(s.home - s.away) >= rules.mercyGoals) return finishMatch(next, 'mercy', now);
    }
    if ((ev.type === 'PEN_SCORED' || ev.type === 'PEN_MISSED') && shootoutDecided(next)) return finishMatch(next, 'penalties', now);
    return next;
};

/** Remove the last thing the scorer entered (a second yellow takes its automatic red with it). */
export const undoLast = (m: FutsalMatch): FutsalMatch => {
    const events = [...(m.events || [])];
    for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (e.type === 'PERIOD_START' || e.type === 'PERIOD_END') continue;
        events.splice(i, 1);
        if (e.auto && i > 0 && events[i - 1]?.type === 'YELLOW') events.splice(i - 1, 1);
        break;
    }
    return stamp({ ...m, events });
};

export const forfeitMatch = (m: FutsalMatch, rules: FutsalRules, by: Side): FutsalMatch => {
    const winner = other(by);
    const events: FutsalEvent[] = Array.from({ length: rules.forfeitScore }, () => ({ id: newId('e'), type: 'GOAL' as const, side: winner, period: 1, ms: 0, at: Date.now(), auto: true }));
    return stamp({
        ...m, events, status: 'COMPLETED', periodState: 'ENDED', period: 1, clock: { elapsedMs: 0, runningSince: null },
        winnerId: (winner === 'home' ? m.homeId : m.awayId) || null, decidedBy: 'forfeit', forfeitBy: by,
    });
};

export const resetMatch = (m: FutsalMatch): FutsalMatch => stamp({
    ...m, status: 'SCHEDULED', period: 0, periodState: 'PRE', clock: { elapsedMs: 0, runningSince: null },
    events: [], winnerId: null, decidedBy: undefined, forfeitBy: undefined, motm: undefined, ratings: undefined,
});

// ---------------------------------------------------------------- fixtures

export const blankMatch = (p: Partial<FutsalMatch> & Pick<FutsalMatch, 'tournamentId' | 'categoryId' | 'stage' | 'round'>): FutsalMatch => ({
    id: newId('m_'), matchNo: 0, status: 'SCHEDULED', period: 0, periodState: 'PRE',
    clock: { elapsedMs: 0, runningSince: null }, events: [], ...p,
});

/** Round robin by the circle method; home and away alternate round to round. */
export const roundRobin = (ids: string[], double = false): [string, string][][] => {
    const list = ids.length % 2 ? [...ids, ''] : [...ids];
    const n = list.length;
    const rounds: [string, string][][] = [];
    for (let r = 0; r < n - 1; r++) {
        const pairs: [string, string][] = [];
        for (let i = 0; i < n / 2; i++) {
            const a = list[i], b = list[n - 1 - i];
            if (!a || !b) continue;
            pairs.push(r % 2 === 0 || i > 0 ? [a, b] : [b, a]);
        }
        rounds.push(pairs);
        list.splice(1, 0, list.pop()!);
    }
    return double ? [...rounds, ...rounds.map(rd => rd.map(([a, b]) => [b, a] as [string, string]))] : rounds;
};

/** Standard bracket order, so 1 and 2 can only meet in the final: 8 -> 1,8,4,5,2,7,3,6. */
export const seedOrder = (size: number): number[] => {
    let order = [1];
    while (order.length < size) {
        const n = order.length * 2;
        order = order.flatMap(s => [s, n + 1 - s]);
    }
    return order;
};

export const stageForSize = (size: number): Stage =>
    size <= 2 ? 'F' : size <= 4 ? 'SF' : size <= 8 ? 'QF' : size <= 16 ? 'R16' : size <= 32 ? 'R32' : 'R64';

export const STAGE_NAMES: Record<Stage, string> = {
    LEAGUE: 'League', GROUP: 'Group stage', R64: 'Round of 64', R32: 'Round of 32', R16: 'Round of 16',
    QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final', '3P': 'Third place',
    QUAL: 'Qualifier', EL1: 'Eliminator 1', EL2: 'Eliminator 2',
};

/**
 * Knockout matches for seeded sources (best first). Top seeds get byes when the
 * field isn't a power of two; a bye just passes the source on to the next round.
 */
export const buildBracket = (tournamentId: string, categoryId: string, sources: SlotSource[], thirdPlace: boolean, firstRound = 100): FutsalMatch[] => {
    if (sources.length < 2) return [];
    let size = 2;
    while (size < sources.length) size *= 2;
    const slots: (SlotSource | null)[] = seedOrder(size).map(s => sources[s - 1] || null);
    const out: FutsalMatch[] = [];
    let round = firstRound;
    let current: (SlotSource | null)[] = slots;
    let semis: FutsalMatch[] = [];
    while (current.length > 1) {
        const stage = stageForSize(current.length);
        const next: (SlotSource | null)[] = [];
        const made: FutsalMatch[] = [];
        for (let i = 0; i < current.length; i += 2) {
            const a = current[i], b = current[i + 1];
            if (a && b) {
                const m = blankMatch({ tournamentId, categoryId, stage, round, homeFrom: a, awayFrom: b });
                made.push(m);
                next.push({ type: 'winner', matchId: m.id });
            } else next.push(a || b);
        }
        if (stage === 'SF') semis = made;
        out.push(...made);
        current = next;
        round++;
    }
    if (thirdPlace && semis.length === 2) {
        const final = out[out.length - 1];
        const third = blankMatch({ tournamentId, categoryId, stage: '3P', round: final.round, homeFrom: { type: 'loser', matchId: semis[0].id }, awayFrom: { type: 'loser', matchId: semis[1].id } });
        out.splice(out.length - 1, 0, third);
    }
    return out;
};

/**
 * Group qualifiers in seeding order: every group winner, then every runner-up...
 * With the bracket order this pairs A1 with the last group's runner-up, never A2.
 */
export const groupQualifierSources = (groups: string[], advance: number): SlotSource[] => {
    const out: SlotSource[] = [];
    for (let pos = 1; pos <= advance; pos++) groups.forEach(g => out.push({ type: 'group', group: g, pos }));
    return out;
};

/** Split teams into groups: snake by seed, or a shuffled draw. */
export const drawGroups = (teams: FutsalTeam[], groupCount: number, mode: 'seeded' | 'random', rand = Math.random): Record<string, string> => {
    const list = [...teams];
    if (mode === 'random') {
        for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    } else list.sort((a, b) => (a.seed || 999) - (b.seed || 999) || a.name.localeCompare(b.name));
    const out: Record<string, string> = {};
    list.forEach((t, i) => {
        const row = Math.floor(i / groupCount), col = i % groupCount;
        out[t.id] = GROUP_NAMES[row % 2 ? groupCount - 1 - col : col];
    });
    return out;
};

/** Every fixture for a category, knockout placeholders included. */
export const generateFixtures = (tournamentId: string, cat: FutsalCategory, teams: FutsalTeam[]): FutsalMatch[] => {
    const accepted = teams.filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED');
    const out: FutsalMatch[] = [];
    const rr = (ids: string[], stage: Stage, group: string | undefined, double: boolean) =>
        roundRobin(ids, double).forEach((pairs, r) => pairs.forEach(([h, a]) => out.push(blankMatch({ tournamentId, categoryId: cat.id, stage, group, round: r + 1, homeId: h, awayId: a }))));

    if (isLeagueFormat(cat.format)) {
        rr(accepted.map(t => t.id), 'LEAGUE', undefined, cat.format === 'DOUBLE_LEAGUE');
        const next = Math.max(0, ...out.map(m => m.round)) + 1;
        const pos = (p: number): SlotSource => ({ type: 'league', pos: p });
        if (cat.format === 'LEAGUE_PLAYOFFS' && accepted.length >= 4) {
            // Page playoffs: 1st v 2nd for a place in the final; the loser gets a second chance.
            const q = blankMatch({ tournamentId, categoryId: cat.id, stage: 'QUAL', round: next, homeFrom: pos(1), awayFrom: pos(2) });
            const e1 = blankMatch({ tournamentId, categoryId: cat.id, stage: 'EL1', round: next, homeFrom: pos(3), awayFrom: pos(4) });
            const e2 = blankMatch({ tournamentId, categoryId: cat.id, stage: 'EL2', round: next + 1, homeFrom: { type: 'loser', matchId: q.id }, awayFrom: { type: 'winner', matchId: e1.id } });
            const f = blankMatch({ tournamentId, categoryId: cat.id, stage: 'F', round: next + 2, homeFrom: { type: 'winner', matchId: q.id }, awayFrom: { type: 'winner', matchId: e2.id } });
            out.push(q, e1, e2, f);
        }
        if (cat.format === 'LEAGUE_KNOCKOUT') {
            const n = Math.min(accepted.length, leagueQualifiers(cat));
            out.push(...buildBracket(tournamentId, cat.id, Array.from({ length: n }, (_, i) => pos(i + 1)), cat.rules.thirdPlace, next));
        }
    } else if (cat.format === 'KNOCKOUT') {
        const seeded = [...accepted].sort((a, b) => (a.seed || 999) - (b.seed || 999) || a.name.localeCompare(b.name));
        out.push(...buildBracket(tournamentId, cat.id, seeded.map((_, i) => ({ type: 'seed', seed: i + 1 })), cat.rules.thirdPlace, 1));
        // Seed sources resolve straight away.
        const bySeed = new Map(seeded.map((t, i) => [i + 1, t.id]));
        out.forEach(m => {
            if (m.homeFrom?.type === 'seed') m.homeId = bySeed.get(m.homeFrom.seed);
            if (m.awayFrom?.type === 'seed') m.awayId = bySeed.get(m.awayFrom.seed);
        });
    } else {
        const groups = [...new Set(accepted.map(t => t.groupId).filter(Boolean) as string[])].sort();
        groups.forEach(g => rr(accepted.filter(t => t.groupId === g).map(t => t.id), 'GROUP', g, false));
        if (cat.format === 'GROUPS_KNOCKOUT' && groups.length) {
            const maxRound = Math.max(0, ...out.map(m => m.round));
            out.push(...buildBracket(tournamentId, cat.id, groupQualifierSources(groups, cat.advancePerGroup), cat.rules.thirdPlace, maxRound + 1));
        }
    }
    out.forEach((m, i) => { m.matchNo = i + 1; });
    return out;
};

// ---------------------------------------------------------------- standings

export interface StandingRow {
    teamId: string;
    p: number; w: number; d: number; l: number;
    gf: number; ga: number; gd: number; pts: number;
    yc: number; rc: number; fairPlay: number;
    form: ('W' | 'D' | 'L')[];
    live?: boolean;
}

const countsForTable = (m: FutsalMatch, includeLive: boolean) =>
    !!m.homeId && !!m.awayId && (m.status === 'COMPLETED' || (includeLive && m.status === 'LIVE'));

const tally = (teamIds: string[], matches: FutsalMatch[], rules: FutsalRules, includeLive: boolean) => {
    const rows = new Map<string, StandingRow>(teamIds.map(id => [id, { teamId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, yc: 0, rc: 0, fairPlay: 0, form: [] }]));
    const ordered = [...matches].sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')) || a.matchNo - b.matchNo);
    for (const m of ordered) {
        if (!countsForTable(m, includeLive)) continue;
        const h = rows.get(m.homeId!), a = rows.get(m.awayId!);
        if (!h || !a) continue;
        const s = scoreOf(m);
        const live = m.status === 'LIVE';
        [[h, s.home, s.away, 'home'], [a, s.away, s.home, 'away']].forEach(([row, f, ag, side]: any) => {
            row.p++; row.gf += f; row.ga += ag;
            const res = f > ag ? 'W' : f < ag ? 'L' : 'D';
            if (res === 'W') { row.w++; row.pts += rules.points.win; }
            else if (res === 'D') { row.d++; row.pts += rules.points.draw; }
            else { row.l++; row.pts += rules.points.loss; }
            row.form.push(res);
            if (live) row.live = true;
            (m.events || []).forEach(e => {
                if (e.side !== side) return;
                if (e.type === 'YELLOW') row.yc++;
                if (e.type === 'RED' && !e.auto) row.rc++;
            });
        });
    }
    rows.forEach(r => { r.gd = r.gf - r.ga; r.fairPlay = r.yc + r.rc * 3; r.form = r.form.slice(-5); });
    return rows;
};

const metric = (t: Tiebreaker, r: StandingRow, mini?: Map<string, StandingRow>): number => {
    const m = mini?.get(r.teamId);
    switch (t) {
        case 'h2h_points': return m?.pts ?? 0;
        case 'h2h_gd': return m?.gd ?? 0;
        case 'h2h_gf': return m?.gf ?? 0;
        case 'gd': return r.gd;
        case 'gf': return r.gf;
        case 'fair_play': return -r.fairPlay;
        default: return 0;
    }
};

/**
 * A group or league table. Level on points, teams go through the tiebreakers in
 * order; head-to-head ones use only the matches between the teams still level.
 */
export const computeStandings = (teamIds: string[], matches: FutsalMatch[], rules: FutsalRules, opts: { includeLive?: boolean; seedOf?: (id: string) => number } = {}): StandingRow[] => {
    const includeLive = !!opts.includeLive;
    const rows = tally(teamIds, matches, rules, includeLive);
    const all = [...rows.values()];
    const breakers = rules.tiebreakers?.length ? rules.tiebreakers : ['gd', 'gf'] as Tiebreaker[];

    const sortTied = (tied: StandingRow[], from: number): StandingRow[] => {
        if (tied.length < 2) return tied;
        for (let i = from; i < breakers.length; i++) {
            const t = breakers[i];
            if (t === 'lots') break;
            const ids = new Set(tied.map(r => r.teamId));
            const mini = t.startsWith('h2h') ? tally([...ids], matches.filter(m => ids.has(m.homeId || '') && ids.has(m.awayId || '')), rules, includeLive) : undefined;
            const buckets = new Map<number, StandingRow[]>();
            tied.forEach(r => { const k = metric(t, r, mini); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(r); });
            if (buckets.size === 1) continue;
            return [...buckets.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, rs]) => sortTied(rs, i + 1));
        }
        // Still level after every rule: seed, then name, stands in for the drawing of lots.
        return [...tied].sort((a, b) => (opts.seedOf?.(a.teamId) ?? 0) - (opts.seedOf?.(b.teamId) ?? 0) || a.teamId.localeCompare(b.teamId));
    };

    const byPts = new Map<number, StandingRow[]>();
    all.forEach(r => { if (!byPts.has(r.pts)) byPts.set(r.pts, []); byPts.get(r.pts)!.push(r); });
    return [...byPts.entries()].sort((a, b) => b[0] - a[0]).flatMap(([, rs]) => sortTied(rs, 0));
};

export const groupComplete = (matches: FutsalMatch[], group: string) => {
    const ms = matches.filter(m => m.stage === 'GROUP' && m.group === group);
    return ms.length > 0 && ms.every(m => m.status === 'COMPLETED');
};

/**
 * Fill knockout slots whose team is now known: group places once a group is
 * finished, winners and losers once their match is. Returns only changed matches.
 */
export const resolveSlots = (cat: FutsalCategory, teams: FutsalTeam[], matches: FutsalMatch[]): FutsalMatch[] => {
    const inCat = matches.filter(m => m.categoryId === cat.id);
    const byId = new Map(inCat.map(m => [m.id, m]));
    const tables = new Map<string, StandingRow[]>();
    const tableFor = (g: string) => {
        if (!tables.has(g)) {
            const ids = teams.filter(t => t.categoryId === cat.id && t.groupId === g && t.status === 'ACCEPTED').map(t => t.id);
            tables.set(g, computeStandings(ids, inCat.filter(m => m.stage === 'GROUP' && m.group === g), cat.rules, { seedOf: id => teams.find(t => t.id === id)?.seed ?? 99 }));
        }
        return tables.get(g)!;
    };
    const resolve = (src?: SlotSource): string | undefined => {
        if (!src) return undefined;
        if (src.type === 'group') return groupComplete(inCat, src.group) ? tableFor(src.group)[src.pos - 1]?.teamId : undefined;
        if (src.type === 'league') {
            const league = inCat.filter(m => m.stage === 'LEAGUE');
            if (!league.length || !league.every(m => m.status === 'COMPLETED')) return undefined;
            if (!tables.has('__league')) {
                const ids = teams.filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED').map(t => t.id);
                tables.set('__league', computeStandings(ids, league, cat.rules, { seedOf: id => teams.find(t => t.id === id)?.seed ?? 99 }));
            }
            return tables.get('__league')![src.pos - 1]?.teamId;
        }
        if (src.type === 'winner' || src.type === 'loser') {
            const m = byId.get(src.matchId);
            if (!m || m.status !== 'COMPLETED' || !m.winnerId) return undefined;
            if (src.type === 'winner') return m.winnerId;
            return m.winnerId === m.homeId ? m.awayId : m.homeId;
        }
        return undefined;
    };
    const changed: FutsalMatch[] = [];
    for (const m of inCat) {
        if (!isKnockout(m.stage) || m.status !== 'SCHEDULED') continue;
        const h = m.homeFrom ? resolve(m.homeFrom) : m.homeId;
        const a = m.awayFrom ? resolve(m.awayFrom) : m.awayId;
        if (h !== m.homeId || a !== m.awayId) {
            const next = { ...m, homeId: h, awayId: a };
            byId.set(m.id, next);
            changed.push(next);
        }
    }
    return changed;
};

export const sourceLabel = (src: SlotSource | undefined, matches: FutsalMatch[]) => {
    if (!src) return 'TBD';
    if (src.type === 'group') return `${src.group}${src.pos} · ${src.pos === 1 ? 'Winner' : src.pos === 2 ? 'Runner-up' : `${src.pos}th`} Group ${src.group}`;
    if (src.type === 'seed') return `Seed ${src.seed}`;
    if (src.type === 'league') return `${src.pos}${['st', 'nd', 'rd'][src.pos - 1] || 'th'} in league`;
    const m = matches.find(x => x.id === src.matchId);
    return `${src.type === 'winner' ? 'Winner' : 'Loser'} M${m?.matchNo ?? '?'}`;
};

// ---------------------------------------------------------------- stats

export interface PlayerLine {
    playerId: string;
    teamId: string;
    apps: number; goals: number; assists: number; ownGoals: number;
    yellows: number; reds: number; motm: number;
    gkApps: number; cleanSheets: number; conceded: number;
    /** Average of the referee's optional 1–5 ratings; 0 when never rated. */
    rating: number; ratedMatches: number;
}

/** Who was in the squad of the day: the lineup if entered, else anyone with an event. */
export const appearedIn = (m: FutsalMatch, side: Side, team?: FutsalTeam): Set<string> => {
    const lu = m.lineups?.[side]?.players;
    const ids = new Set<string>(lu && lu.length ? lu : []);
    (m.events || []).forEach(e => {
        if (e.side !== side || e.auto && e.type === 'GOAL') return;
        [e.playerId, e.assistId, e.inId].forEach(x => x && ids.add(x));
    });
    if (!ids.size && team && m.decidedBy !== 'forfeit') team.players.forEach(p => ids.add(p.id));
    return ids;
};

export const playerStats = (teams: FutsalTeam[], matches: FutsalMatch[]): Map<string, PlayerLine> => {
    const out = new Map<string, PlayerLine>();
    const teamOf = new Map<string, FutsalTeam>(teams.map(t => [t.id, t]));
    const line = (playerId: string, teamId: string) => {
        if (!out.has(playerId)) out.set(playerId, { playerId, teamId, apps: 0, goals: 0, assists: 0, ownGoals: 0, yellows: 0, reds: 0, motm: 0, gkApps: 0, cleanSheets: 0, conceded: 0, rating: 0, ratedMatches: 0 });
        return out.get(playerId)!;
    };
    teams.forEach(t => t.players.forEach(p => line(p.id, t.id)));
    for (const m of matches) {
        if (m.status !== 'COMPLETED' || m.decidedBy === 'forfeit') continue;
        const s = scoreOf(m);
        (['home', 'away'] as Side[]).forEach(side => {
            const teamId = side === 'home' ? m.homeId : m.awayId;
            if (!teamId) return;
            appearedIn(m, side, teamOf.get(teamId)).forEach(pid => line(pid, teamId).apps++);
            const gk = m.lineups?.[side]?.gk;
            if (gk) {
                const g = line(gk, teamId);
                g.gkApps++;
                const against = side === 'home' ? s.away : s.home;
                g.conceded += against;
                if (!against) g.cleanSheets++;
            }
        });
        for (const e of m.events || []) {
            const teamId = e.side === 'home' ? m.homeId : m.awayId;
            if (!teamId || !e.playerId) continue;
            const l = line(e.playerId, teamId);
            if (e.type === 'GOAL') l.goals++;
            if (e.type === 'OWN_GOAL') l.ownGoals++;
            if (e.type === 'YELLOW') l.yellows++;
            if (e.type === 'RED' && !e.auto) l.reds++;
            if (e.type === 'GOAL' && e.assistId) line(e.assistId, teamId).assists++;
        }
        if (m.motm) {
            const t = teams.find(x => x.players.some(p => p.id === m.motm));
            if (t) line(m.motm, t.id).motm++;
        }
        Object.entries(m.ratings || {}).forEach(([pid, r]) => {
            const t = teams.find(x => x.players.some(p => p.id === pid));
            if (!t || !r) return;
            const l = line(pid, t.id);
            l.rating = (l.rating * l.ratedMatches + r) / (l.ratedMatches + 1);
            l.ratedMatches++;
        });
    }
    return out;
};

export interface Awards {
    goldenBoot?: PlayerLine;
    topAssists?: PlayerLine;
    goldenGlove?: PlayerLine;
    bestPlayer?: PlayerLine;
    fairPlayTeamId?: string;
}

export const computeAwards = (lines: PlayerLine[], standings: StandingRow[], bestPlayerPick?: string): Awards => {
    const pick = (rank: (a: PlayerLine, b: PlayerLine) => number, ok: (l: PlayerLine) => boolean) => [...lines].filter(ok).sort(rank)[0];
    const minGames = Math.max(1, Math.min(...standings.map(s => s.p).filter(Boolean), 3));
    return {
        goldenBoot: pick((a, b) => b.goals - a.goals || b.assists - a.assists || a.apps - b.apps, l => l.goals > 0),
        topAssists: pick((a, b) => b.assists - a.assists || b.goals - a.goals || a.apps - b.apps, l => l.assists > 0),
        goldenGlove: pick((a, b) => b.cleanSheets - a.cleanSheets || a.conceded / Math.max(1, a.gkApps) - b.conceded / Math.max(1, b.gkApps), l => l.gkApps > 0),
        bestPlayer: (bestPlayerPick && lines.find(l => l.playerId === bestPlayerPick)) || pick((a, b) => b.motm - a.motm || b.goals + b.assists - (a.goals + a.assists), l => l.motm > 0),
        fairPlayTeamId: [...standings].filter(s => s.p >= minGames).sort((a, b) => a.fairPlay / a.p - b.fairPlay / b.p || b.pts - a.pts)[0]?.teamId,
    };
};

/** How far each team got: CHAMPION, RUNNER_UP... in the same stage names padel rankings use. */
export const placements = (cat: FutsalCategory, teams: FutsalTeam[], matches: FutsalMatch[]): Map<string, string> => {
    const out = new Map<string, string>();
    const inCat = matches.filter(m => m.categoryId === cat.id);
    const ko = inCat.filter(m => isKnockout(m.stage) && m.stage !== '3P' && m.status === 'COMPLETED' && m.winnerId);
    // Page playoffs: losing Eliminator 2 is third, losing Eliminator 1 fourth (the Qualifier loser plays on).
    const loserStage: Partial<Record<Stage, string>> = { F: 'RUNNER_UP', SF: 'SEMI_FINALIST', QF: 'QUARTER_FINALIST', R16: 'ROUND_OF_16', R32: 'ROUND_OF_32', R64: 'ROUND_OF_64', EL2: 'SEMI_FINALIST', EL1: 'QUARTER_FINALIST' };
    ko.forEach(m => {
        const loser = m.winnerId === m.homeId ? m.awayId : m.homeId;
        if (m.stage === 'F') out.set(m.winnerId!, 'CHAMPION');
        if (loser && loserStage[m.stage] && !out.has(loser)) out.set(loser, loserStage[m.stage]!);
    });
    const leagueLike = cat.format === 'LEAGUE' || cat.format === 'DOUBLE_LEAGUE' || cat.format === 'GROUPS';
    if (leagueLike && inCat.length && inCat.every(m => m.status === 'COMPLETED')) {
        const ids = teams.filter(t => t.categoryId === cat.id && t.status === 'ACCEPTED').map(t => t.id);
        const table = computeStandings(ids, inCat, cat.rules);
        const byRank = ['CHAMPION', 'RUNNER_UP', 'SEMI_FINALIST', 'SEMI_FINALIST', 'QUARTER_FINALIST', 'QUARTER_FINALIST', 'QUARTER_FINALIST', 'QUARTER_FINALIST'];
        if (cat.format !== 'GROUPS') table.forEach((r, i) => { if (byRank[i] && !out.has(r.teamId)) out.set(r.teamId, byRank[i]); });
    }
    return out;
};

export const teamInitials = (name: string) => {
    const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
    return (words[0] || 'TBD').slice(0, 3).toUpperCase();
};
