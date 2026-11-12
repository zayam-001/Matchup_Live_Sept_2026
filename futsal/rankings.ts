// Futsal rankings, worked out live from results like the padel ones: placement
// points by tournament tier, plus small bonuses for individual awards. Kept apart
// from padel, and juniors apart from seniors.
import { placementPoints, rankingSystemFor, STAGE_WEIGHT, tierLabel, type KnockoutStage } from '../lib/pointsSystems';
import { normalizeEmail, normalizeName, normalizePhone } from '../lib/playerIdentity';
import { computeAwards, computeStandings, placements, playerStats } from './engine';
import type { Division, FutsalMatch, FutsalTeam, FutsalTournament } from './types';

export const AWARD_BONUS = { goldenBoot: 3, bestPlayer: 3, goldenGlove: 2 };

export interface FutsalResult {
    tournamentId: string;
    tournamentName: string;
    categoryName: string;
    division: Division;
    tier: string;
    teamName: string;
    stage: string;
    points: number;
    bonus: number;
    goals: number;
    assists: number;
    apps: number;
    date: string;
}

export interface FutsalRankRow {
    key: string;
    name: string;
    uid?: string;
    division: Division;
    points: number;
    goals: number;
    assists: number;
    apps: number;
    titles: number;
    results: FutsalResult[];
    rank: number;
}

const pool = (d: Division): Division => (d === 'Kids' ? 'Kids' : d);

/** One person across events: account first, then phone, then email, then name within a team name. */
const personKey = (p: { uid?: string; phone?: string; email?: string; name: string }, teamName: string) =>
    p.uid ? `u:${p.uid}` : normalizePhone(p.phone) ? `p:${normalizePhone(p.phone)}:${normalizeName(p.name).split(' ')[0]}`
        : normalizeEmail(p.email) ? `e:${normalizeEmail(p.email)}:${normalizeName(p.name).split(' ')[0]}`
            : `n:${normalizeName(p.name)}:${normalizeName(teamName)}`;

export const computeFutsalRankings = (tournaments: FutsalTournament[], teams: FutsalTeam[], matches: FutsalMatch[]) => {
    const players = new Map<string, FutsalRankRow>();
    const teamRows = new Map<string, FutsalRankRow>();

    for (const t of tournaments) {
        if (t.status === 'DRAFT') continue;
        const system = rankingSystemFor(t.tier);
        for (const cat of t.categories) {
            const cTeams = teams.filter(x => x.tournamentId === t.id && x.categoryId === cat.id && x.status === 'ACCEPTED');
            const cMatches = matches.filter(m => m.tournamentId === t.id && m.categoryId === cat.id);
            if (!cMatches.some(m => m.status === 'COMPLETED')) continue;
            const places = placements(cat, cTeams, cMatches);
            const lines = playerStats(cTeams, cMatches);
            const table = computeStandings(cTeams.map(x => x.id), cMatches.filter(m => m.stage === 'GROUP' || m.stage === 'LEAGUE'), cat.rules);
            const done = cMatches.length > 0 && cMatches.every(m => m.status === 'COMPLETED');
            const awards = done ? computeAwards([...lines.values()], table, t.bestPlayer?.[cat.id]) : {};
            const div = pool(cat.division);

            for (const team of cTeams) {
                const stage = places.get(team.id) || '';
                const pts = placementPoints(system, stage);
                const tk = `${div}|t:${normalizeName(team.name)}`;
                const tr = teamRows.get(tk) || { key: tk, name: team.name, division: div, points: 0, goals: 0, assists: 0, apps: 0, titles: 0, results: [], rank: 0 };
                const teamGoals = [...lines.values()].filter(l => l.teamId === team.id).reduce((n, l) => n + l.goals, 0);
                tr.points += pts; tr.goals += teamGoals; tr.titles += stage === 'CHAMPION' ? 1 : 0;
                tr.results.push({ tournamentId: t.id, tournamentName: t.name, categoryName: cat.name, division: div, tier: tierLabel(t.tier), teamName: team.name, stage, points: pts, bonus: 0, goals: teamGoals, assists: 0, apps: 0, date: t.startDate });
                teamRows.set(tk, tr);

                for (const p of team.players) {
                    const l = lines.get(p.id);
                    if (!l || l.apps === 0) continue; // in the squad but never played
                    const bonus = (awards.goldenBoot?.playerId === p.id ? AWARD_BONUS.goldenBoot : 0)
                        + (awards.bestPlayer?.playerId === p.id ? AWARD_BONUS.bestPlayer : 0)
                        + (awards.goldenGlove?.playerId === p.id ? AWARD_BONUS.goldenGlove : 0);
                    const k = `${div}|${personKey(p, team.name)}`;
                    const row = players.get(k) || { key: k, name: p.name, uid: p.uid, division: div, points: 0, goals: 0, assists: 0, apps: 0, titles: 0, results: [], rank: 0 };
                    row.points += pts + bonus; row.goals += l.goals; row.assists += l.assists; row.apps += l.apps;
                    row.titles += stage === 'CHAMPION' ? 1 : 0;
                    if (p.name.length > row.name.length) row.name = p.name;
                    row.uid = row.uid || p.uid;
                    row.results.push({ tournamentId: t.id, tournamentName: t.name, categoryName: cat.name, division: div, tier: tierLabel(t.tier), teamName: team.name, stage, points: pts, bonus, goals: l.goals, assists: l.assists, apps: l.apps, date: t.startDate });
                    players.set(k, row);
                }
            }
        }
    }
    const rank = (rows: FutsalRankRow[]) => {
        rows.forEach(r => r.results.sort((a, b) => b.date.localeCompare(a.date)));
        rows.sort((a, b) => b.points - a.points || b.titles - a.titles || b.goals - a.goals || a.name.localeCompare(b.name));
        rows.forEach((r, i) => { r.rank = i + 1; });
        return rows;
    };
    return { players: rank([...players.values()]), teams: rank([...teamRows.values()]) };
};

export const bestStage = (r: FutsalRankRow) =>
    r.results.map(x => x.stage).sort((a, b) => (STAGE_WEIGHT[b as KnockoutStage] || 0) - (STAGE_WEIGHT[a as KnockoutStage] || 0))[0] || '';
