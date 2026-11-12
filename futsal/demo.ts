// Sample data for local demo mode only: one event mid-way through its group stage
// with a match live, a finished one so rankings have history, and a football league.
import { addEvent, drawGroups, endPeriod, generateFixtures, resolveSlots, startPeriod } from './engine';
import { DEFAULT_SCHEDULE, newCategory, newId } from './presets';
import { scheduleMatches } from './scheduler';
import type { FutsalMatch, FutsalTeam, FutsalTournament, Position } from './types';

const CLUBS: [string, string, string][] = [
    ['Clifton Comets', 'CLC', '#3B82F6'], ['DHA Dynamos', 'DHA', '#F59E0B'], ['Saddar Strikers', 'SAD', '#EF4444'],
    ['Gulshan Gladiators', 'GUL', '#10B981'], ['Malir Mavericks', 'MAL', '#8B5CF6'], ['Korangi Kings', 'KOR', '#EC4899'],
    ['Lyari Lions', 'LYA', '#F97316'], ['PECHS Phoenix', 'PEC', '#06B6D4'],
];
const JUNIORS: [string, string, string][] = [
    ['Clifton Cubs', 'CCU', '#60A5FA'], ['DHA Juniors', 'DHJ', '#FBBF24'], ['Gulshan Colts', 'GCO', '#34D399'], ['Malir Minis', 'MMI', '#A78BFA'],
];
const FIRST = ['Ali', 'Hamza', 'Bilal', 'Usman', 'Zain', 'Saad', 'Faris', 'Rayyan', 'Daniyal', 'Shayan', 'Taha', 'Areeb', 'Hassan', 'Moiz', 'Arham', 'Ibrahim', 'Yahya', 'Haris'];
const LAST = ['Khan', 'Sheikh', 'Siddiqui', 'Qureshi', 'Ahmed', 'Raza', 'Baig', 'Malik', 'Hussain', 'Farooqui', 'Ansari', 'Mirza', 'Abbasi', 'Jafri'];
const POS: Position[] = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD', 'MID', 'GK'];

let s = 42;
const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const makeTeams = (tournamentId: string, categoryId: string, clubs: [string, string, string][], squad: number, phoneBase: number): FutsalTeam[] =>
    clubs.map(([name, short, color], i) => ({
        id: newId('t_'), tournamentId, categoryId, name, shortName: short, color,
        captainName: `${pick(FIRST)} ${pick(LAST)}`, captainPhone: `0300${phoneBase + i}000`, status: 'ACCEPTED', seed: i + 1,
        registeredAt: new Date().toISOString(),
        players: Array.from({ length: squad }, (_, j) => ({
            id: newId('p_'), name: `${FIRST[(i * 3 + j * 5) % FIRST.length]} ${LAST[(i * 7 + j * 3) % LAST.length]}`,
            number: j === 0 ? 1 : j + 2 + (i % 3), position: POS[j % POS.length],
            phone: `03${String(phoneBase + i).padStart(2, '0')}${String(1000000 + j * 1371 + i * 97).slice(-7)}`,
        })),
    }));

/** Play a match through the real state machine so the demo exercises the engine. */
const simulate = (m: FutsalMatch, teams: FutsalTeam[], rules: FutsalTournament['categories'][number]['rules'], startAt: number, opts: { live?: boolean } = {}) => {
    const home = teams.find(t => t.id === m.homeId)!, away = teams.find(t => t.id === m.awayId)!;
    const lineup = (t: FutsalTeam) => ({ players: t.players.map(p => p.id), gk: t.players[0].id });
    let now = startAt;
    let x: FutsalMatch = { ...startPeriod(m, now), lineups: { home: lineup(home), away: lineup(away) } };
    const half = rules.periodMinutes * 60000;
    const goals = (side: 'home' | 'away', count: number, from: number, to: number) => {
        const t = side === 'home' ? home : away;
        for (let i = 0; i < count; i++) {
            now = from + Math.floor(rand() * (to - from));
            const scorer = t.players[1 + Math.floor(rand() * 6)];
            const assist = rand() > 0.35 ? t.players[1 + Math.floor(rand() * 6)] : undefined;
            x = addEvent(x, rules, { type: 'GOAL', side, playerId: scorer.id, assistId: assist && assist.id !== scorer.id ? assist.id : undefined }, now);
        }
    };
    const extras = (from: number, to: number) => {
        for (let i = 0; i < 3; i++) { now = from + Math.floor(rand() * (to - from)); x = addEvent(x, rules, { type: 'FOUL', side: rand() > 0.5 ? 'home' : 'away' }, now); }
        if (rand() > 0.5) { const side = rand() > 0.5 ? 'home' : 'away'; const t = side === 'home' ? home : away; x = addEvent(x, rules, { type: 'YELLOW', side, playerId: t.players[2].id }, from + 60000); }
    };
    goals('home', Math.floor(rand() * 3), startAt + 60000, startAt + half - 60000);
    goals('away', Math.floor(rand() * 3), startAt + 60000, startAt + half - 60000);
    extras(startAt, startAt + half);
    x.events.sort((a, b) => a.at - b.at || 0);
    x = { ...x, events: x.events.map(e => ({ ...e, ms: Math.max(0, e.at - startAt) })) };
    if (opts.live) return { ...x, clock: { elapsedMs: 0, runningSince: startAt } };
    x = endPeriod(x, rules, startAt + half);
    const second = startAt + half + rules.halftimeMinutes * 60000;
    x = startPeriod(x, second);
    goals('home', Math.floor(rand() * 3), second + 60000, second + half - 60000);
    goals('away', Math.floor(rand() * 2), second + 60000, second + half - 60000);
    extras(second, second + half);
    x = { ...x, events: x.events.map(e => (e.period === 2 ? { ...e, ms: Math.max(0, e.at - second) } : e)) };
    x = endPeriod(x, rules, second + half);
    if (x.periodState === 'SHOOTOUT') {
        ['PEN_SCORED', 'PEN_SCORED', 'PEN_SCORED', 'PEN_MISSED', 'PEN_SCORED', 'PEN_SCORED', 'PEN_SCORED', 'PEN_SCORED', 'PEN_SCORED', 'PEN_MISSED']
            .forEach(k => { if (x.status !== 'COMPLETED') x = addEvent(x, rules, { type: k as any, side: x.events.filter(e => e.type.startsWith('PEN')).length % 2 ? 'away' : 'home' }, second + half); });
    }
    if (x.status === 'COMPLETED') {
        const all = [...home.players, ...away.players];
        x.motm = pick(all.slice(1, 7)).id;
    }
    return x;
};

export const buildDemo = () => {
    s = 42;
    const today = new Date();
    const tId = 'demo-champions-cup';
    const men = { ...newCategory("Men's Open", 'casual5'), id: 'demo-men', groupCount: 2, advancePerGroup: 2 };
    men.rules.thirdPlace = true;
    const kids = { ...newCategory('Under 14', 'casual5'), id: 'demo-u14', division: 'Kids' as const, format: 'LEAGUE' as const, maxTeams: 4 };
    kids.rules.periodMinutes = 10;
    const cup: FutsalTournament = {
        id: tId, name: 'Karachi Futsal Champions Cup', organizerId: 'demo', organizerEmail: 'demo@matchup.com.pk', organizerName: 'Match Up Futsal',
        city: 'Karachi', venue: 'Arena 7, DHA', pitches: ['Pitch 1', 'Pitch 2'], startDate: ymd(today), endDate: ymd(new Date(today.getTime() + 86400000)),
        status: 'ACTIVE', categories: [men, kids], scorerPasscode: '2468', currency: 'PKR', tier: 'fip_silver',
        schedule: { ...DEFAULT_SCHEDULE, dayStart: '00:00', dayEnd: '23:59', maxPerDay: 4 }, createdAt: today.toISOString(),
    };
    const menTeams = makeTeams(tId, men.id, CLUBS, 9, 10);
    const draw = drawGroups(menTeams, 2, 'seeded');
    menTeams.forEach(t => { t.groupId = draw[t.id]; });
    const kidTeams = makeTeams(tId, kids.id, JUNIORS, 7, 40);
    let matches = [...generateFixtures(tId, men, menTeams), ...generateFixtures(tId, kids, kidTeams)];
    // Slot everything from three hours ago so some is played, one is live, the rest upcoming.
    const startMs = Date.now() - 3 * 3600000;
    const d0 = new Date(startMs);
    cup.startDate = ymd(d0);
    cup.schedule.dayStart = `${String(d0.getHours()).padStart(2, '0')}:${String(d0.getMinutes()).padStart(2, '0')}`;
    const scheduled = scheduleMatches(cup, matches).matches;
    matches = matches.map(m => scheduled.find(x => x.id === m.id) || m);
    cup.schedule.dayStart = '17:00';
    const allTeams = [...menTeams, ...kidTeams];
    let liveMade = false;
    matches = matches
        .sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)))
        .map(m => {
            const st = new Date(m.startAt || 0).getTime();
            const cat = m.categoryId === men.id ? men : kids;
            if (!m.homeId || !m.awayId) return m;
            const durMs = (cat.rules.periodMinutes * 2 + cat.rules.halftimeMinutes) * 60000;
            if (st + durMs < Date.now()) return simulate(m, allTeams, cat.rules, st);
            if (st < Date.now() + 15 * 60000 && cat.id === men.id) { const ago = liveMade ? 4 : 9; liveMade = true; return simulate(m, allTeams, cat.rules, Date.now() - ago * 60000, { live: true }); }
            return m;
        });
    const changed = resolveSlots(men, menTeams, matches);
    matches = matches.map(m => changed.find(c => c.id === m.id) || m);

    // A finished event earlier in the year.
    const pastId = 'demo-ramadan-nights';
    const past = { ...newCategory("Men's Open", 'casual5'), id: 'demo-past-men', format: 'KNOCKOUT' as const };
    const pastT: FutsalTournament = {
        ...cup, id: pastId, name: 'Ramadan Futsal Nights', status: 'COMPLETED', tier: 'fip_bronze', categories: [past],
        startDate: '2026-03-10', endDate: '2026-03-11', schedule: { ...DEFAULT_SCHEDULE }, pitches: ['Pitch 1'],
    };
    // Same squads (same phones), so rankings join players across both events.
    const pastTeams = menTeams.slice(0, 4).map((t, i) => ({ ...t, id: `${t.id}-past`, tournamentId: pastId, categoryId: past.id, groupId: undefined, seed: i + 1 }));
    let pastMatches = generateFixtures(pastId, past, pastTeams);
    for (let round = 0; round < 3; round++) {
        pastMatches = pastMatches.map(m => (m.homeId && m.awayId && m.status === 'SCHEDULED' ? simulate({ ...m, startAt: `2026-03-1${round ? 1 : 0}T19:00:00.000Z`, pitch: 'Pitch 1' }, pastTeams, past.rules, Date.parse('2026-03-10T19:00:00Z') + round * 3600000) : m));
        const ch = resolveSlots(past, pastTeams, pastMatches);
        pastMatches = pastMatches.map(m => ch.find(c => c.id === m.id) || m);
    }
    // A football league: 11 a side, one match live.
    const fbId = 'demo-karachi-football-league';
    const fbCat = { ...newCategory("Men's Open", 'eleven_short'), id: 'demo-fb-men', format: 'LEAGUE' as const, maxTeams: 6 };
    const fbT: FutsalTournament = {
        ...cup, id: fbId, name: 'Karachi Football League', sport: 'football', venue: 'KMC Stadium', pitches: ['Ground 1'],
        status: 'ACTIVE', tier: 'fip_bronze', categories: [fbCat], schedule: { ...DEFAULT_SCHEDULE },
    };
    const fbTeams = makeTeams(fbId, fbCat.id, CLUBS.slice(0, 6).map(([n, sh, c]) => [n.replace(/ \w+$/, ' FC'), sh, c] as [string, string, string]), 16, 60);
    const slot = (fbCat.rules.periodMinutes * 2 + fbCat.rules.halftimeMinutes + 10) * 60000;
    const fbStart = Date.now() - 3 * slot - 20 * 60000;
    const fbMatches = generateFixtures(fbId, fbCat, fbTeams).map((m, i) => {
        const st = fbStart + i * slot;
        const x = { ...m, startAt: new Date(st).toISOString(), pitch: 'Ground 1' };
        if (i < 3) return simulate(x, fbTeams, fbCat.rules, st);
        if (i === 3) return simulate(x, fbTeams, fbCat.rules, Date.now() - 20 * 60000, { live: true });
        return x;
    });
    return { tournaments: [cup, pastT, fbT], teams: [...allTeams, ...pastTeams, ...fbTeams], matches: [...matches, ...pastMatches, ...fbMatches] };
};
