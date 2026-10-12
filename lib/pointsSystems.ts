// Tournament points plans. A tournament picks one (Tournament.pointsSystem);
// it drives the player Tournament Leaderboard and the team placement points
// used to rank final standings.
//
// Placement = the furthest knockout stage a team reached. FIP plans follow
// the FIP Tour points table (men's and women's values are identical); FIP
// qualifying-draw points (Q1/Q2/last/bonus qualy) aren't modelled because the
// app has no qualifying draws.

export type PointsSystemId = 'matchup' | 'fip_platinum' | 'fip_gold' | 'fip_silver' | 'fip_bronze' | 'fip_finals';

export type KnockoutStage = 'CHAMPION' | 'RUNNER_UP' | 'SEMI_FINALIST' | 'QUARTER_FINALIST' | 'ROUND_OF_16' | 'ROUND_OF_32' | 'ROUND_OF_64';

export interface PointsSystem {
    id: PointsSystemId;
    label: string;
    description: string;
    color: string; // badge colour in the setup picker
    placement: Record<KnockoutStage, number>;
    participation: number; // teams/players who didn't reach a counted stage
    perWin: number; // per match won
    perSkillShot: number; // per winning smash/vibora/bandeja/volley/drop shot
}

export const STAGE_LABELS: Record<KnockoutStage, string> = {
    CHAMPION: 'Winner',
    RUNNER_UP: 'Finalist',
    SEMI_FINALIST: 'Semifinal',
    QUARTER_FINALIST: '1/4 Final',
    ROUND_OF_16: 'R16',
    ROUND_OF_32: 'R32',
    ROUND_OF_64: 'R64',
};

export const STAGE_ORDER: KnockoutStage[] = ['CHAMPION', 'RUNNER_UP', 'SEMI_FINALIST', 'QUARTER_FINALIST', 'ROUND_OF_16', 'ROUND_OF_32', 'ROUND_OF_64'];

// Rank weight so a deeper run always sorts above a shallower one.
export const STAGE_WEIGHT: Record<KnockoutStage, number> = {
    CHAMPION: 100000,
    RUNNER_UP: 50000,
    SEMI_FINALIST: 25000,
    QUARTER_FINALIST: 12000,
    ROUND_OF_16: 6000,
    ROUND_OF_32: 3000,
    ROUND_OF_64: 1500,
};

const fip = (id: PointsSystemId, label: string, color: string, p: number[]): PointsSystem => ({
    id,
    label,
    description: 'FIP Tour placement points only',
    color,
    placement: {
        CHAMPION: p[0] ?? 0,
        RUNNER_UP: p[1] ?? 0,
        SEMI_FINALIST: p[2] ?? 0,
        QUARTER_FINALIST: p[3] ?? 0,
        ROUND_OF_16: p[4] ?? 0,
        ROUND_OF_32: p[5] ?? 0,
        ROUND_OF_64: p[6] ?? 0,
    },
    participation: 0,
    perWin: 0,
    perSkillShot: 0,
});

export const POINTS_SYSTEMS: Record<PointsSystemId, PointsSystem> = {
    // The app's original logic, unchanged.
    matchup: {
        id: 'matchup',
        label: 'Matchup Standard',
        description: 'Placement + 15 per win + 5 per skill shot',
        color: '#4D78FF',
        placement: {
            CHAMPION: 200,
            RUNNER_UP: 150,
            SEMI_FINALIST: 100,
            QUARTER_FINALIST: 30,
            ROUND_OF_16: 15,
            ROUND_OF_32: 15,
            ROUND_OF_64: 15,
        },
        participation: 15,
        perWin: 15,
        perSkillShot: 5,
    },
    fip_platinum: fip('fip_platinum', 'FIP Platinum', '#7aaed4', [300, 180, 90, 50, 25, 14]),
    fip_gold: fip('fip_gold', 'FIP Gold', '#c5a43c', [150, 90, 50, 25, 14, 8]),
    fip_silver: fip('fip_silver', 'FIP Silver', '#b4b4b4', [80, 45, 25, 14, 8, 5]),
    fip_bronze: fip('fip_bronze', 'FIP Bronze', '#a0633a', [40, 22, 14, 8, 5, 3]),
    fip_finals: fip('fip_finals', 'FIP Finals', '#5b2a86', [225]),
};

export const POINTS_SYSTEM_LIST: PointsSystem[] = ['matchup', 'fip_platinum', 'fip_gold', 'fip_silver', 'fip_bronze', 'fip_finals'].map(id => POINTS_SYSTEMS[id as PointsSystemId]);

export const getPointsSystem = (id?: string | null): PointsSystem =>
    POINTS_SYSTEMS[(id as PointsSystemId) || 'matchup'] || POINTS_SYSTEMS.matchup;

export const placementPoints = (system: PointsSystem, stage?: string | null): number =>
    stage && (stage as KnockoutStage) in system.placement ? system.placement[stage as KnockoutStage] : system.participation;

// Which knockout stage a match belongs to. Uses the round name first
// ("Final", "Semi-Final 1", "Quarter-Final 2", "Round of 16 - Match 3"); for
// generic names ("Round 2 - Match 4") falls back to how many knockout matches
// share that round number (1 = final, 2 = semis, 4 = quarters, ...).
export type MatchStage = 'F' | 'SF' | 'QF' | 'R16' | 'R32' | 'R64';

const STAGE_BY_MATCH_COUNT: Record<number, MatchStage> = { 1: 'F', 2: 'SF', 4: 'QF', 8: 'R16', 16: 'R32', 32: 'R64' };
const STAGE_BY_DRAW_SIZE: Record<number, MatchStage> = { 2: 'F', 4: 'SF', 8: 'QF', 16: 'R16', 32: 'R32', 64: 'R64' };

export const buildKnockoutRoundSizes = (matches: any[], isKnockout: (m: any) => boolean): Map<string, number> => {
    const sizes = new Map<string, number>();
    matches.forEach(m => {
        if (!m || !isKnockout(m) || m.round === undefined || m.round === null) return;
        const key = `${m.categoryId || ''}|${m.round}`;
        sizes.set(key, (sizes.get(key) || 0) + 1);
    });
    return sizes;
};

export const getMatchStage = (m: any, roundSizes?: Map<string, number>, isKnockout?: (m: any) => boolean): MatchStage | null => {
    const name = String(m?.roundName || '').toUpperCase();
    if (name.includes('3RD') || name.includes('THIRD')) return null; // 3rd-place playoff doesn't change placement
    const drawSize = name.match(/ROUND OF (\d+)/);
    if (drawSize) return STAGE_BY_DRAW_SIZE[Number(drawSize[1])] || null;
    if (/SEMI|\b1\/2\b/.test(name) || name === 'SF') return 'SF';
    if (/QUARTER|\b1\/4\b/.test(name) || name === 'QF') return 'QF';
    if (/\bR16\b|\b1\/8\b/.test(name)) return 'R16';
    if (/\bR32\b|\b1\/16\b/.test(name)) return 'R32';
    if (/\bR64\b|\b1\/32\b/.test(name)) return 'R64';
    if (/FINAL/.test(name) || name === 'F') return 'F';
    if (roundSizes && (!isKnockout || isKnockout(m))) {
        const count = roundSizes.get(`${m.categoryId || ''}|${m.round}`);
        if (count) return STAGE_BY_MATCH_COUNT[count] || null;
    }
    return null;
};

// Stage a team is credited with for losing (or, in the final, winning) a match at `stage`.
export const loserStage = (stage: MatchStage): KnockoutStage => ({
    F: 'RUNNER_UP', SF: 'SEMI_FINALIST', QF: 'QUARTER_FINALIST', R16: 'ROUND_OF_16', R32: 'ROUND_OF_32', R64: 'ROUND_OF_64',
} as Record<MatchStage, KnockoutStage>)[stage];
