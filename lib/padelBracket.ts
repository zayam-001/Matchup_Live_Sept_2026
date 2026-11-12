// Padel knockout brackets: build a linked bracket in one go, and keep every
// knockout slot filled from where it comes from (a match winner, a match loser
// or a group finishing position). Resolution is recomputed from scratch, so it
// also corrects itself when a result is edited or a match is reset.
import { MatchStatus, type Match, type MatchDependency, type Team, type Tournament } from '../types';

export const isDone = (m: Pick<Match, 'status'>) => ['COMPLETED', 'FINISHED'].includes(String(m.status).toUpperCase());
export const isKnockoutMatch = (m: Pick<Match, 'stage'>) => ['KNOCKOUT', 'PLAYOFF'].includes(String(m.stage || '').toUpperCase());
const hasStarted = (m: Match) => isDone(m) || ['IN_PROGRESS', 'LIVE'].includes(String(m.status).toUpperCase());

/** The group a group-stage match belongs to: its `group`, its "Group X" round name, or its first team's group. */
export const groupOfMatch = (m: Match, teams: Team[]) =>
    m.group || /^Group\s+(\S+)/i.exec(m.roundName || '')?.[1] || teams.find(t => t.id === m.team1Id)?.groupId || 'A';

/** Same tiebreak order as the standings tables: points, game difference, wins, games won, fewest games lost. */
export const sortStandings = <T extends Partial<Team> & { standingRank?: number }>(list: T[]) => [...list].sort((a, b) => {
    if ((a.standingRank || 0) > 0 && (b.standingRank || 0) > 0) return a.standingRank! - b.standingRank!;
    return (b.points || 0) - (a.points || 0)
        || ((b.gamesWon || 0) - (b.gamesLost || 0)) - ((a.gamesWon || 0) - (a.gamesLost || 0))
        || (b.wins || 0) - (a.wins || 0)
        || (b.gamesWon || 0) - (a.gamesWon || 0)
        || (a.gamesLost || 0) - (b.gamesLost || 0);
});

/** Ranks the accepted teams of one group from that group's matches (stats computed by the caller). */
export type GroupRanker = (group: string, categoryId: string | undefined, groupMatches: Match[]) => string[];

const label = (dep: MatchDependency, byId: Map<string, Match>) => {
    if (dep.sourceType === 'GROUP_RANK') return `Group ${dep.sourceId} #${dep.rank || 1}`;
    const src = byId.get(dep.sourceId);
    return `${dep.sourceType === 'MATCH_LOSER' ? 'Loser' : 'Winner'} ${src?.roundName || 'previous match'}`;
};

/**
 * Knockout matches that need new teams, given the current results. Only matches
 * that haven't started are touched; a slot whose source isn't decided yet goes
 * back to a "Winner Quarter-Final 2" placeholder.
 */
export const resolveBracket = (t: Pick<Tournament, 'teams'>, matches: Match[], rankGroup: GroupRanker): Match[] => {
    const teams = (t.teams || []).filter(x => x.status === 'ACCEPTED');
    const byId = new Map(matches.map(m => [m.id, m]));
    const ranks = new Map<string, string[] | null>();
    const groupRanks = (group: string, categoryId?: string) => {
        const key = `${categoryId || ''}|${group}`;
        if (!ranks.has(key)) {
            const gm = matches.filter(m => !isKnockoutMatch(m) && String(m.stage || '').toUpperCase() === 'GROUP'
                && (m.categoryId || '') === (categoryId || '') && groupOfMatch(m, teams) === group);
            // Positions are only final once every match in the group is played.
            ranks.set(key, gm.length && gm.every(isDone) ? rankGroup(group, categoryId, gm) : null);
        }
        return ranks.get(key);
    };
    const resolve = (dep: MatchDependency, m: Match): string | null => {
        if (dep.sourceType === 'GROUP_RANK') return groupRanks(dep.sourceId, m.categoryId)?.[(dep.rank || 1) - 1] || null;
        const src = byId.get(dep.sourceId);
        if (!src || !isDone(src) || !src.winnerTeamId) return null;
        if (dep.sourceType === 'MATCH_WINNER') return src.winnerTeamId;
        return (src.winnerTeamId === src.team1Id ? src.team2Id : src.team1Id) || null;
    };
    const fill = (id: string | null, fallback: string) => {
        const team = id ? teams.find(x => x.id === id) : undefined;
        return {
            id: id || '',
            name: team?.name || fallback,
            players: team ? [team.player1?.name, team.player2?.name].filter(Boolean).join(' & ') : '',
        };
    };

    const changed: Match[] = [];
    for (const m of matches) {
        if (!isKnockoutMatch(m) || hasStarted(m)) continue;
        let d1 = m.team1Dependency, d2 = m.team2Dependency;
        // Older brackets only link forward (nextMatchId): feeders in creation order fill team 1 then team 2.
        if (!d1 && !d2) {
            const feeders = matches.filter(x => x.nextMatchId === m.id);
            if (!feeders.length) continue;
            d1 = { sourceType: 'MATCH_WINNER', sourceId: feeders[0].id };
            if (feeders[1]) d2 = { sourceType: 'MATCH_WINNER', sourceId: feeders[1].id };
        }
        const s1 = d1 ? fill(resolve(d1, m), label(d1, byId)) : null;
        const s2 = d2 ? fill(resolve(d2, m), label(d2, byId)) : null;
        // A legacy match already holding both teams the other way round stays as it is.
        if (s1 && s2 && s1.id && s2.id && m.team1Id === s2.id && m.team2Id === s1.id) continue;
        const next = { ...m };
        if (s1) { next.team1Id = s1.id; next.team1Name = s1.name; next.team1PlayerNames = s1.players; }
        if (s2) { next.team2Id = s2.id; next.team2Name = s2.name; next.team2PlayerNames = s2.players; }
        if (next.team1Id !== m.team1Id || next.team2Id !== m.team2Id || next.team1Name !== m.team1Name || next.team2Name !== m.team2Name) {
            byId.set(m.id, next);
            changed.push(next);
        }
    }
    return changed;
};

// ---------------------------------------------------------------- building

const seedOrder = (size: number): number[] => {
    let order = [1];
    while (order.length < size) { const n = order.length * 2; order = order.flatMap(s => [s, n + 1 - s]); }
    return order;
};
export const roundTitle = (size: number) => (size === 2 ? 'Final' : size === 4 ? 'Semi-Final' : size === 8 ? 'Quarter-Final' : `Round of ${size}`);

export type BracketSource = { teamId: string } | { group: string; rank: number };

/**
 * Every knockout match from the first round to the final, linked with
 * nextMatchId and team dependencies. Sources are best first; the top seeds get
 * byes when the field isn't a power of two (a bye just passes the team on).
 */
export const buildPadelBracket = (
    t: Pick<Tournament, 'id' | 'teams'>, categoryId: string | undefined, sources: BracketSource[], opts: { firstRound: number; thirdPlace?: boolean },
): Match[] => {
    if (sources.length < 2) return [];
    let size = 2;
    while (size < sources.length) size *= 2;
    const stamp = Date.now();
    let n = 0;
    const now = new Date().toISOString();
    const blank = (round: number, roundName: string): Match => ({
        id: `m_${stamp}_ko${++n}`, tournamentId: t.id, categoryId, team1Id: '', team2Id: '', team1Name: '', team2Name: '', team1PlayerNames: '', team2PlayerNames: '',
        status: MatchStatus.SCHEDULED, stage: 'KNOCKOUT', round, roundName,
        score: { p1Points: '0', p2Points: '0', p1Games: 0, p2Games: 0, p1Sets: 0, p2Sets: 0, p1SetScores: [], p2SetScores: [], currentSet: 1, isTiebreak: false, history: [] } as any,
        court: '"TBD"', courtId: '"TBD"', scheduledCourtId: '"TBD"', scheduledStartTime: now, scheduledTime: now,
        actualCourtId: null, courtOverrideBy: null, courtOverrideAt: null, conflictAcknowledged: null,
    });
    type Slot = MatchDependency | { teamId: string } | null;
    const asSlot = (s: BracketSource | undefined): Slot => (!s ? null : 'teamId' in s ? { teamId: s.teamId } : { sourceType: 'GROUP_RANK', sourceId: s.group, rank: s.rank });
    const place = (match: Match, side: 1 | 2, s: Exclude<Slot, null>) => {
        const m = match as any;
        if ('teamId' in s) {
            const team = (t.teams || []).find(x => x.id === s.teamId);
            m[`team${side}Id`] = s.teamId;
            m[`team${side}Name`] = team?.name || '';
            m[`team${side}PlayerNames`] = team ? [team.player1?.name, team.player2?.name].filter(Boolean).join(' & ') : '';
        } else {
            m[`team${side}Dependency`] = s;
            m[`team${side}Name`] = s.sourceType === 'GROUP_RANK' ? `Group ${s.sourceId} #${s.rank}` : '';
        }
    };

    const out: Match[] = [];
    let current: Slot[] = seedOrder(size).map(s => asSlot(sources[s - 1]));
    let round = opts.firstRound;
    let semis: Match[] = [];
    while (current.length > 1) {
        const title = roundTitle(current.length);
        const made: Match[] = [];
        const next: Slot[] = [];
        for (let i = 0; i < current.length; i += 2) {
            const a = current[i], b = current[i + 1];
            if (a && b) {
                const m = blank(round, '');
                place(m, 1, a); place(m, 2, b);
                made.push(m);
                next.push({ sourceType: 'MATCH_WINNER', sourceId: m.id });
            } else next.push(a || b);
        }
        made.forEach((m, i) => { m.roundName = title === 'Final' ? 'Final' : `${title}${title.startsWith('Round of') ? ' - Match' : ''} ${i + 1}`; });
        // Link forward too, for screens that follow nextMatchId.
        out.forEach(prev => {
            const target = made.find(m => m.team1Dependency?.sourceId === prev.id || m.team2Dependency?.sourceId === prev.id);
            if (target && !prev.nextMatchId) prev.nextMatchId = target.id;
        });
        if (title === 'Semi-Final') semis = made;
        out.push(...made);
        current = next;
        round++;
    }
    if (opts.thirdPlace && semis.length === 2) {
        const final = out[out.length - 1];
        const third = blank(final.round, 'Third Place');
        third.team1Dependency = { sourceType: 'MATCH_LOSER', sourceId: semis[0].id };
        third.team2Dependency = { sourceType: 'MATCH_LOSER', sourceId: semis[1].id };
        semis.forEach(s => { s.loserNextMatchId = third.id; });
        out.splice(out.length - 1, 0, third);
    }
    return out;
};

/** Qualifiers from groups, best first: every group winner, then every runner-up, and so on. */
export const groupSources = (groups: string[], perGroup: number): BracketSource[] => {
    const out: BracketSource[] = [];
    for (let rank = 1; rank <= perGroup; rank++) groups.forEach(group => out.push({ group, rank }));
    return out;
};
