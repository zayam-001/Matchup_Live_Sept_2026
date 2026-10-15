// Seeds (or removes) a "Team Americano" test tournament for checking the
// broadcast screen. Writes to the production Firestore with your Firebase CLI
// login (`firebase login` as a project owner), so security rules don't apply.
//
//   Build:               npx esbuild scripts/seed-team-americano-test.ts --bundle --platform=node --outfile=/tmp/seed-ta.cjs
//   Preview (no writes): node /tmp/seed-ta.cjs --dry-run
//   Create / reset:      node /tmp/seed-ta.cjs
//   Delete everything:   node /tmp/seed-ta.cjs --delete
//
// Fixed document ids, so running it again resets the same tournament instead
// of creating duplicates.

import type { Match, Team } from '../types';
import { buildRoundRobinPlan, computeTeamAmericanoStandings, layoutRound, resolveTeamAmericanoConfig } from '../lib/teamAmericano';

const PROJECT = 'tournament-scoring-app-7dff5';
const TOURNAMENT_ID = 'team-americano-test';
const OWNER_EMAIL = 'taha.nadeem@maidan.pk';
const FIREBASE_TOOLS = '/opt/homebrew/lib/node_modules/firebase-tools/lib';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const DELETE = args.has('--delete');

// ── Test data ────────────────────────────────────────────────────────────────

const PAIRS: [string, string, string, string, string][] = [
    // team, player 1, player 2, country 1, country 2
    ['Smash Bros', 'Ali Khan', 'Bilal Ahmed', 'PK', 'PK'],
    ['Net Ninjas', 'Sara Malik', 'Hina Raza', 'PK', 'PK'],
    ['Vibora Kings', 'Omar Shah', 'Zain Ali', 'PK', 'AE'],
    ['Lob Stars', 'Ayesha Noor', 'Fatima Iqbal', 'PK', 'PK'],
    ['Wall Warriors', 'Hamza Tariq', 'Usman Javed', 'PK', 'GB'],
    ['Bandeja Boys', 'Saad Akhtar', 'Faisal Qureshi', 'PK', 'PK'],
    ['Drop Shots', 'Maria Gomez', 'Noor Fatima', 'ES', 'PK'],
    ['Chiquita Crew', 'Danish Butt', 'Rehan Mirza', 'PK', 'PK'],
    ['Golden Point', 'Imran Siddiqui', 'Kamran Haider', 'PK', 'SA'],
];
const COURTS = ['Court 1', 'Court 2', 'Court 3', 'Court 4'];
const CONFIG = { targetPoints: 24, scoringMode: 'points_total', roundDuration: 20, breakMinutes: 5, byeScoring: 'average', finals: 'top4', showPlayerStandings: true, minTeams: 4 } as const;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.');
const now = new Date();

const teams: Team[] = PAIRS.map(([name, p1, p2, c1, c2], i) => ({
    id: `ta_test_team_${i + 1}`,
    name,
    status: 'ACCEPTED',
    registeredAt: now.toISOString(),
    player1: { name: p1, email: `${slug(p1)}@example.com`, phone: `0300000${String(i * 2 + 1).padStart(4, '0')}`, verified: false, country: c1 },
    player2: { name: p2, email: `${slug(p2)}@example.com`, phone: `0300000${String(i * 2 + 2).padStart(4, '0')}`, verified: false, country: c2 },
}));

// Rounds 1-2 finished, round 3 live on every court, the rest scheduled.
const cfg = resolveTeamAmericanoConfig(CONFIG as any);
const rounds = buildRoundRobinPlan(teams.map(t => t.id), teams.length, { rng: (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })() });
const slotMs = (cfg.roundDuration + cfg.breakMinutes) * 60000;
const firstRoundStart = new Date(now.getTime() - 2 * slotMs - 10 * 60000);
const FINAL_SCORES = [[14, 10], [13, 11], [16, 8], [9, 15], [12, 12], [11, 13], [15, 9], [10, 14]];
const LIVE_SCORES = [[7, 5], [3, 6], [10, 9], [4, 4]];

const matches: Match[] = rounds.flatMap(plan =>
    layoutRound(plan, COURTS, cfg, new Date(firstRoundStart.getTime() + (plan.round - 1) * slotMs)).map((slot, i) => {
        const t1 = teams.find(t => t.id === slot.team1Id)!;
        const t2 = teams.find(t => t.id === slot.team2Id)!;
        const done = plan.round <= 2;
        const live = plan.round === 3;
        const [a, b] = done ? FINAL_SCORES[(plan.round * 4 + i) % FINAL_SCORES.length] : live ? LIVE_SCORES[i % LIVE_SCORES.length] : [0, 0];
        return {
            id: `ta_test_r${plan.round}_m${i + 1}`,
            tournamentId: TOURNAMENT_ID,
            team1Id: t1.id,
            team2Id: t2.id,
            team1Name: t1.name,
            team2Name: t2.name,
            team1PlayerNames: `${t1.player1.name} & ${t1.player2.name}`,
            team2PlayerNames: `${t2.player1.name} & ${t2.player2.name}`,
            round: plan.round,
            roundName: `Round ${plan.round}`,
            stage: 'GROUP',
            court: slot.court,
            courtId: slot.court,
            courtName: slot.court,
            scheduledCourtId: slot.court,
            scheduledTime: slot.scheduledTime,
            scheduledStartTime: slot.scheduledTime,
            startedAt: done || live ? slot.scheduledTime : null,
            status: (done ? 'COMPLETED' : live ? 'IN_PROGRESS' : 'SCHEDULED') as any,
            winnerTeamId: done && a !== b ? (a > b ? t1.id : t2.id) : undefined,
            score: {
                p1Points: String(a), p2Points: String(b),
                p1Games: a, p2Games: b,
                p1Sets: done && a > b ? 1 : 0, p2Sets: done && b > a ? 1 : 0,
                p1SetScores: done || live ? [a] : [], p2SetScores: done || live ? [b] : [],
                currentSet: 1, isTiebreak: false, history: [],
                rawPointsA: a, rawPointsB: b,
                americanoMode: 'fixed_total', americanoTargetPoints: cfg.targetPoints,
            } as any,
        } as Match;
    }),
);

const standings = computeTeamAmericanoStandings(teams, matches, CONFIG as any);

const tournament = {
    id: TOURNAMENT_ID,
    name: 'Team Americano',
    format: 'TEAM_AMERICANO',
    skillLevel: 'OPEN',
    maxTeams: 12,
    entryFee: 6000,
    currency: 'PKR',
    prizeMoney: 100000,
    venue: 'Matchup Test Courts',
    venueId: '',
    courtId: '',
    city: 'Karachi',
    sport: 'Padel',
    organizer: 'Matchup',
    organizerId: '',
    organizerEmail: OWNER_EMAIL,
    adminTag: OWNER_EMAIL,
    refereePasscode: '1234',
    courts: COURTS,
    registrationDeadline: now.toISOString(),
    startDate: firstRoundStart.toISOString(),
    endDate: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    teams,
    matches: [],
    categories: [],
    isMultiCategory: false,
    status: 'ACTIVE',
    slug: 'team-americano',
    createdAt: now.toISOString(),
    slotDuration: cfg.roundDuration,
    bufferTime: cfg.breakMinutes,
    teamAmericano: CONFIG,
    showNationFlags: true,
    broadcastTheme: 'matchup',
    pointsSystem: 'matchup',
};

// ── Firestore REST encoding ──────────────────────────────────────────────────

const encode = (v: any): any => {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
    return { mapValue: { fields: encodeFields(v) } };
};
const encodeFields = (obj: Record<string, any>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));

const BASE = `projects/${PROJECT}/databases/(default)/documents`;
const docName = (path: string) => `${BASE}/${path}`;

const writes = [
    { update: { name: docName(`tournaments/${TOURNAMENT_ID}`), fields: encodeFields(tournament) } },
    ...matches.flatMap(m => [
        { update: { name: docName(`tournaments/${TOURNAMENT_ID}/matches/${m.id}`), fields: encodeFields(m) } },
        { update: { name: docName(`matches/${m.id}`), fields: encodeFields(m) } },
    ]),
    ...standings.map(s => ({ update: { name: docName(`tournaments/${TOURNAMENT_ID}/standings/${s.id}`), fields: encodeFields(s) } })),
];
const deletes = [
    ...matches.flatMap(m => [{ delete: docName(`tournaments/${TOURNAMENT_ID}/matches/${m.id}`) }, { delete: docName(`matches/${m.id}`) }]),
    ...teams.map(t => ({ delete: docName(`tournaments/${TOURNAMENT_ID}/standings/${t.id}`) })),
    { delete: docName(`tournaments/${TOURNAMENT_ID}`) },
];

// ── Run ──────────────────────────────────────────────────────────────────────

(async () => {
    const plan = DELETE ? deletes : writes;
    console.log(`${DELETE ? 'Deleting' : 'Writing'} ${plan.length} documents in ${PROJECT} (tournament "${tournament.name}", id ${TOURNAMENT_ID}, owner ${OWNER_EMAIL}).`);
    if (!DELETE) {
        console.log(`  ${teams.length} teams, ${COURTS.length} courts, ${rounds.length} rounds, ${matches.length} matches (${matches.filter(m => m.status === 'IN_PROGRESS').length} live)`);
        console.log('  Standings:', standings.map(s => `${s.standingRank}. ${s.name} ${s.points}`).join(' | '));
    }
    if (DRY_RUN) {
        console.log('Dry run: nothing written.');
        return;
    }

    const { requireAuth } = require(`${FIREBASE_TOOLS}/requireAuth`);
    const { Client } = require(`${FIREBASE_TOOLS}/apiv2`);
    const { getGlobalDefaultAccount } = require(`${FIREBASE_TOOLS}/auth`);
    await requireAuth({ project: PROJECT, ...getGlobalDefaultAccount() });
    const client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true, apiVersion: 'v1' });
    for (let i = 0; i < plan.length; i += 400) {
        await client.post(`/${BASE}:commit`, { writes: plan.slice(i, i + 400) });
    }
    console.log(DELETE ? 'Deleted.' : `Done. Open the "Team Americano" tournament page, then Broadcast Mode.`);
})().catch(e => {
    console.error('Failed:', e?.message || e);
    process.exit(1);
});
