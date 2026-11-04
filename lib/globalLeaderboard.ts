// The Match Up rankings, worked out live from tournament results: FIP-scale
// placement points added up across every tournament a player has played. Nothing
// is stored, so the table can't drift from results or collect duplicate rows.
import type { Team, Tournament } from '../types';
import { buildKnockoutRoundSizes, getMatchStage, isKnockoutMatch, loserStage, placementPoints, STAGE_WEIGHT, tournamentTier, tournamentTierLabel, type KnockoutStage } from './pointsSystems';
import type { Match } from '../types';
import { isPlaceholderName, firstNameOf, linkIdFor, normalizeEmail, normalizeName, normalizePhone, personName, type PersonLike } from './playerIdentity';

export type Division = 'Men' | 'Women' | 'Kids' | 'Mixed';

/** Which side of the rankings a result belongs to, from its category (or event) name. */
export const divisionOf = (categoryName?: string, tournamentName?: string): Division => {
    const n = String(categoryName || tournamentName || '').toLowerCase();
    if (/\b(kids?|juniors?|under[ -]?\d+|u[ -]?\d{1,2}|boys|girls)\b/.test(n)) return 'Kids';
    if (/\bmixed\b/.test(n)) return 'Mixed';
    if (/\b(women|woman|ladies|lady|female)('?s)?\b/.test(n)) return 'Women';
    return 'Men';
};

export interface TournamentResult {
    division: Division;
    tournamentId: string;
    tournamentName: string;
    tier: string;
    category?: string;
    stage?: string;
    points: number;
    wins: number;
    losses: number;
    date?: string;
}

export interface RankedPlayer {
    key: string;
    uid?: string;
    name: string;
    photoUrl?: string;
    points: number;
    wins: number;
    losses: number;
    matchesPlayed: number;
    tournaments: number;
    tierCounts: Record<string, number>;
    results: TournamentResult[];
    rank: number;
}

export const countsForRankings = (t: Tournament) => {
    const status = String(t.status || '').toUpperCase();
    if (status === 'RETIRED' || status === 'DRAFT') return false;
    return !/\btest\b/i.test(t.name || '') && !/-test$/i.test(t.id || '');
};

// Formats with no knockout rounds rank by final table position once the event is over.
const stageFromRank = (rank?: number) => {
    if (!rank) return '';
    if (rank === 1) return 'CHAMPION';
    if (rank === 2) return 'RUNNER_UP';
    if (rank <= 4) return 'SEMI_FINALIST';
    if (rank <= 8) return 'QUARTER_FINALIST';
    if (rank <= 16) return 'ROUND_OF_16';
    return 'ROUND_OF_32';
};

const isOver = (t: Tournament) =>
    String(t.status || '').toUpperCase() === 'COMPLETED' || (!!t.endDate && new Date(t.endDate).getTime() < Date.now());

const isDone = (m: any) => ['COMPLETED', 'FINISHED'].includes(String(m?.status || '').toUpperCase());
const TABLE_FORMATS = ['AMERICANO', 'MEXICANO', 'TEAM_AMERICANO', 'ROUND_ROBIN'];

export interface TeamRecord { stage: string; wins: number; losses: number; ties: number; }

/**
 * Each team's real record, worked out from the matches: how far it got and every
 * match it won or lost, knockouts included. Saved team stats can be stale or
 * missing, so this is the source of truth whenever matches are available.
 */
export const deriveTeamRecords = (t: Tournament, matches: Match[]): Map<string, TeamRecord> => {
    const rec = new Map<string, TeamRecord>();
    const get = (id: string) => {
        if (!rec.has(id)) rec.set(id, { stage: '', wins: 0, losses: 0, ties: 0 });
        return rec.get(id)!;
    };
    const setStage = (id: string | undefined, stage: KnockoutStage) => {
        if (!id) return;
        const r = get(id);
        if ((STAGE_WEIGHT[stage] || 0) > (STAGE_WEIGHT[r.stage as KnockoutStage] || 0)) r.stage = stage;
    };
    const sizes = buildKnockoutRoundSizes(matches, isKnockoutMatch);
    const done = matches.filter(isDone);
    done.forEach(m => {
        const a = m.team1Id, b = m.team2Id, w = m.winnerTeamId;
        if (w) {
            get(w).wins += 1;
            const loser = w === a ? b : w === b ? a : undefined;
            if (loser) get(loser).losses += 1;
        } else if (a && b) {
            get(a).ties += 1;
            get(b).ties += 1;
        }
        if (!w || !isKnockoutMatch(m)) return;
        const stage = getMatchStage(m, sizes, isKnockoutMatch);
        if (!stage) return;
        const loser = w === a ? b : w === b ? a : undefined;
        if (stage === 'F') setStage(w, 'CHAMPION');
        setStage(loser, loserStage(stage));
        // Winning a round means reaching at least the round after it.
        if (stage === 'SF') setStage(w, 'RUNNER_UP');
        if (stage === 'QF') setStage(w, 'SEMI_FINALIST');
        if (stage === 'R16') setStage(w, 'QUARTER_FINALIST');
        if (stage === 'R32') setStage(w, 'ROUND_OF_16');
        if (stage === 'R64') setStage(w, 'ROUND_OF_32');
    });

    // Formats with no knockout rounds: final table position once the event is over.
    if (isOver(t)) {
        const hasKnockout = new Set(matches.filter(isKnockoutMatch).map(m => m.categoryId || ''));
        const cats = new Set((t.teams || []).map(x => x.categoryId || ''));
        cats.forEach(catId => {
            if (hasKnockout.has(catId)) return;
            const fmt = String(t.categories?.find(c => c.id === catId)?.format || t.format || '');
            if (!TABLE_FORMATS.includes(fmt)) return;
            const teams = (t.teams || []).filter((x: any) => (x.categoryId || '') === catId && (x.matchesPlayed || rec.has(x.id)));
            const scoreOf = (x: any) => x.pointsScored ?? x.gamesWon ?? 0;
            [...teams]
                .sort((x: any, y: any) => (x.standingRank && y.standingRank ? x.standingRank - y.standingRank : 0)
                    || (y.points || 0) - (x.points || 0) || scoreOf(y) - scoreOf(x))
                .forEach((x: any, i) => { const st = stageFromRank(i + 1); if (st) setStage(x.id, st as KnockoutStage); });
        });
    }
    return rec;
};

export const computeGlobalLeaderboard = (
    tournaments: Tournament[],
    accounts: PersonLike[] = [],
    links: Record<string, string> = {},
    matches?: Match[],
): RankedPlayer[] => {
    // Real records per tournament, when the matches are available.
    const recordsByTournament = new Map<string, Map<string, TeamRecord>>();
    if (matches?.length) {
        const byT = new Map<string, Match[]>();
        matches.forEach(m => {
            const id = (m as any).tournamentId;
            if (!id) return;
            if (!byT.has(id)) byT.set(id, []);
            byT.get(id)!.push(m);
        });
        tournaments.forEach(t => { const ms = byT.get(t.id); if (ms?.length) recordsByTournament.set(t.id, deriveTeamRecords(t, ms)); });
    }

    const byUid = new Map(accounts.filter(a => a.id).map(a => [a.id as string, a]));

    // Same person across events: union their phone+first-name and email+first-name keys.
    const parent = new Map<string, string>();
    const find = (k: string): string => {
        if (!parent.has(k)) parent.set(k, k);
        const p = parent.get(k)!;
        if (p === k) return k;
        const r = find(p);
        parent.set(k, r);
        return r;
    };
    const union = (a: string, b: string) => { parent.set(find(a), find(b)); };

    const uidOf = (p: PersonLike) => {
        if (p.id && byUid.has(p.id)) return p.id;
        return links[linkIdFor(p)] || '';
    };
    // A phone or email used by both players on a team (a parent's, a shared contact)
    // doesn't identify one person, so it only counts together with the full name.
    const sharedContacts = new Set<string>();
    tournaments.forEach(t => (t.teams || []).forEach(team => {
        const a = team.player1, b = team.player2;
        if (!a || !b) return;
        const pa = normalizePhone(a.phone), ea = normalizeEmail(a.email);
        if (pa && pa === normalizePhone(b.phone)) sharedContacts.add(pa);
        if (ea && ea === normalizeEmail(b.email)) sharedContacts.add(ea);
    }));
    const keysOf = (p: PersonLike) => {
        const first = firstNameOf(personName(p));
        const full = normalizeName(personName(p));
        const out: string[] = [];
        const uid = uidOf(p);
        if (uid) out.push(`u:${uid}`);
        const phone = normalizePhone(p.phone), email = normalizeEmail(p.email);
        if (phone) out.push(`p:${phone}:${sharedContacts.has(phone) ? full : first}`);
        if (email) out.push(`e:${email}:${sharedContacts.has(email) ? full : first}`);
        return out;
    };

    type Slot = { p: PersonLike; team: Team; t: Tournament };
    const slots: Slot[] = [];
    tournaments.filter(countsForRankings).forEach(t => (t.teams || []).forEach(team => {
        if (team.status && !['ACCEPTED', 'APPROVED'].includes(String(team.status).toUpperCase())) return;
        [team.player1, team.player2].forEach(p => {
            if (p && !isPlaceholderName(personName(p))) slots.push({ p, team, t });
        });
    }));

    const fullNameToRoot = new Map<string, Set<string>>();
    slots.forEach(({ p }) => {
        const keys = keysOf(p);
        keys.slice(1).forEach(k => union(keys[0], k));
    });
    // Same full name with no contact detail that disagrees: one person whose entries
    // were typed with different details ("Rayyan Faizan" with a phone, then an email).
    const contactsByName = new Map<string, Map<string, { phones: Set<string>; emails: Set<string> }>>();
    slots.forEach(({ p }) => {
        const keys = keysOf(p);
        const n = normalizeName(personName(p));
        if (!keys.length || !n.includes(' ')) return;
        const root = find(keys[0]);
        if (!contactsByName.has(n)) contactsByName.set(n, new Map());
        const group = contactsByName.get(n)!;
        if (!group.has(root)) group.set(root, { phones: new Set(), emails: new Set() });
        const phone = normalizePhone(p.phone), email = normalizeEmail(p.email);
        if (phone) group.get(root)!.phones.add(phone);
        if (email) group.get(root)!.emails.add(email);
    });
    const disagree = (a: Set<string>, b: Set<string>) => a.size > 0 && b.size > 0 && ![...a].some(x => b.has(x));
    contactsByName.forEach(group => {
        const roots = [...group.entries()];
        for (let i = 0; i < roots.length; i++) for (let j = i + 1; j < roots.length; j++) {
            const [ra, a] = roots[i], [rb, b] = roots[j];
            if (!disagree(a.phones, b.phones) && !disagree(a.emails, b.emails)) union(ra, rb);
        }
    });
    slots.forEach(({ p }) => {
        const keys = keysOf(p);
        if (!keys.length) return;
        const n = normalizeName(personName(p));
        if (!fullNameToRoot.has(n)) fullNameToRoot.set(n, new Set());
        fullNameToRoot.get(n)!.add(find(keys[0]));
    });

    const rows = new Map<string, RankedPlayer>();
    const seenTeams = new Set<string>();
    slots.forEach(({ p, team, t }) => {
        const keys = keysOf(p);
        const n = normalizeName(personName(p));
        let root: string;
        if (keys.length) root = find(keys[0]);
        else {
            // No contact details: join a known player only if that full name is unambiguous.
            const roots = fullNameToRoot.get(n);
            // A lone first name ("Danish") with no details can't be told apart from other
            // Danishes, so it stays one entry per team until it's merged into an account.
            if (!n.includes(' ')) root = `n:${n}:${team.id}`;
            else root = roots && roots.size === 1 ? [...roots][0] : `n:${n}`;
        }
        const system = tournamentTier(t);
        const records = recordsByTournament.get(t.id);
        const record = records?.get(team.id);
        const americano = ['AMERICANO', 'MEXICANO'].includes(String(t.categories?.find(c => c.id === team.categoryId)?.format || t.format));
        const stage = records ? (record?.stage || '') : ((team as any).knockoutStage || (isOver(t) ? stageFromRank((team as any).standingRank) : ''));
        const points = placementPoints(system, stage);
        // Americano rounds record players individually, so keep their saved win counts.
        const wins = records && !americano ? (record?.wins || 0) : (team.wins || 0);
        const losses = records && !americano ? (record?.losses || 0) : (team.losses || 0);
        const ties = records && !americano ? (record?.ties || 0) : (team.ties || 0);

        let row = rows.get(root);
        if (!row) {
            row = { key: root, name: personName(p), points: 0, wins: 0, losses: 0, matchesPlayed: 0, tournaments: 0, tierCounts: {}, results: [], rank: 0 };
            rows.set(root, row);
        }
        const uid = uidOf(p);
        if (uid) {
            row.uid = uid;
            const acc = byUid.get(uid);
            if (acc) {
                row.name = personName(acc) || row.name;
                row.photoUrl = acc.photoUrl || row.photoUrl;
            }
        } else if (personName(p).length > row.name.length && !row.uid) {
            row.name = personName(p);
        }
        row.photoUrl = row.photoUrl || p.photoUrl;
        row.points += points;
        row.wins += wins;
        row.losses += losses;
        row.matchesPlayed += wins + losses + ties;
        const category = t.categories?.find(c => c.id === team.categoryId)?.name;
        // Never count one team twice for the same person.
        if (seenTeams.has(`${root}|${t.id}|${team.id}`)) {
            row.points -= points; row.wins -= wins; row.losses -= losses; row.matchesPlayed -= wins + losses + ties;
            return;
        }
        seenTeams.add(`${root}|${t.id}|${team.id}`);
        row.results.push({ division: divisionOf(category, t.name), tournamentId: t.id, tournamentName: t.name, tier: tournamentTierLabel(t), category, stage, points, wins, losses, date: t.startDate });
    });

    const out = [...rows.values()].filter(r => r.matchesPlayed > 0 || r.points > 0);
    out.forEach(r => {
        r.tournaments = new Set(r.results.map(x => x.tournamentId)).size;
        r.results.forEach(x => { r.tierCounts[x.tier] = (r.tierCounts[x.tier] || 0) + 1; });
        r.results.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    });
    out.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
    out.forEach((r, i) => { r.rank = i + 1; });
    return out;
};
