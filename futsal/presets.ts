import type { CompetitionFormat, FutsalCategory, FutsalRules, GoalType, PresetId, ScheduleSettings, Tiebreaker } from './types';

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = ['h2h_points', 'h2h_gd', 'h2h_gf', 'gd', 'gf', 'fair_play', 'lots'];

const base: Omit<FutsalRules, 'preset'> = {
    onPitch: 5, squadMin: 6, squadMax: 10, periods: 2, periodMinutes: 15, halftimeMinutes: 5,
    clock: 'running', timeoutsPerPeriod: 0, foulLimit: 0, redCardMinutes: 0,
    knockoutTiebreak: 'penalties', extraTimeMinutes: 5, thirdPlace: false,
    points: { win: 3, draw: 1, loss: 0 }, forfeitScore: 3, mercyGoals: 0, kickIn: true,
    tiebreakers: DEFAULT_TIEBREAKERS,
};

// Football: no accumulated fouls, no kick-ins, players are sent off for a red.
const eleven: Omit<FutsalRules, 'preset'> = {
    ...base, onPitch: 11, squadMin: 14, squadMax: 23, periodMinutes: 45, halftimeMinutes: 15,
    knockoutTiebreak: 'extra_time_penalties', extraTimeMinutes: 15, kickIn: false, continuousClock: true,
};

export const PRESETS: Record<PresetId, { label: string; blurb: string; rules: FutsalRules }> = {
    casual5: {
        label: '5v5 Casual',
        blurb: 'Running clock, 2 × 15 min, straight to penalties. How most local events run.',
        rules: { ...base, preset: 'casual5' },
    },
    fifa5: {
        label: '5v5 FIFA Futsal',
        blurb: 'Laws of the Game: stopped clock, 2 × 20, accumulated fouls, 2-minute reds.',
        rules: {
            ...base, preset: 'fifa5', squadMin: 8, squadMax: 14, periodMinutes: 20, halftimeMinutes: 10,
            clock: 'stopped', timeoutsPerPeriod: 1, foulLimit: 5, redCardMinutes: 2,
            knockoutTiebreak: 'extra_time_penalties', extraTimeMinutes: 5,
        },
    },
    six: {
        label: '6v6',
        blurb: 'Six a side, 2 × 20 running clock, one timeout a half, 5-foul limit.',
        rules: {
            ...base, preset: 'six', onPitch: 6, squadMin: 8, squadMax: 12, periodMinutes: 20,
            timeoutsPerPeriod: 1, foulLimit: 5, redCardMinutes: 2,
        },
    },
    seven: {
        label: '7v7',
        blurb: 'Seven a side, 2 × 25 running clock, players sent off for a red.',
        rules: {
            ...base, preset: 'seven', onPitch: 7, squadMin: 9, squadMax: 14, periodMinutes: 25,
            timeoutsPerPeriod: 1,
        },
    },
    custom: {
        label: 'Custom',
        blurb: 'Start from 5v5 Casual and set every rule yourself.',
        rules: { ...base, preset: 'custom' },
    },
    eleven: {
        label: '11v11 Standard',
        blurb: 'Full match: 2 × 45, 15-minute break, extra time then penalties in knockouts.',
        rules: { ...eleven, preset: 'eleven' },
    },
    eleven_short: {
        label: '11v11 Short',
        blurb: 'Tournament day format: 2 × 30, 10-minute break, straight to penalties.',
        rules: { ...eleven, preset: 'eleven_short', periodMinutes: 30, halftimeMinutes: 10, knockoutTiebreak: 'penalties' },
    },
    nine: {
        label: '9v9',
        blurb: 'Nine a side on a smaller pitch, 2 × 30, rolling subs.',
        rules: { ...eleven, preset: 'nine', onPitch: 9, squadMin: 11, squadMax: 16, periodMinutes: 30, halftimeMinutes: 10, knockoutTiebreak: 'penalties' },
    },
    eight: {
        label: '8v8',
        blurb: 'Eight a side, 2 × 25, straight to penalties.',
        rules: { ...eleven, preset: 'eight', onPitch: 8, squadMin: 10, squadMax: 14, periodMinutes: 25, halftimeMinutes: 5, knockoutTiebreak: 'penalties' },
    },
    football_custom: {
        label: 'Custom',
        blurb: 'Start from 11v11 Standard and set every rule yourself.',
        rules: { ...eleven, preset: 'football_custom' },
    },
};

export const PRESET_ORDER: PresetId[] = ['casual5', 'fifa5', 'six', 'seven', 'custom'];
export const FOOTBALL_PRESET_ORDER: PresetId[] = ['eleven', 'eleven_short', 'nine', 'eight', 'football_custom'];

export const FORMAT_LABELS: Record<CompetitionFormat, string> = {
    GROUPS_KNOCKOUT: 'Groups, then knockout',
    LEAGUE_PLAYOFFS: 'League, then playoffs (Qualifier, Eliminators, Final)',
    LEAGUE_KNOCKOUT: 'League, then knockout',
    LEAGUE: 'League (round robin)',
    DOUBLE_LEAGUE: 'League, home and away',
    KNOCKOUT: 'Straight knockout',
    GROUPS: 'Groups only',
};

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
    h2h_points: 'Head-to-head points',
    h2h_gd: 'Head-to-head goal difference',
    h2h_gf: 'Head-to-head goals scored',
    gd: 'Goal difference',
    gf: 'Goals scored',
    fair_play: 'Fair play (fewest card points)',
    lots: 'Drawing of lots',
};

export const DEFAULT_SCHEDULE: ScheduleSettings = { dayStart: '17:00', dayEnd: '23:30', bufferMinutes: 5, minRestMinutes: 30, maxPerDay: 3 };

export const newId = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const newCategory = (name = "Men's Open", preset: PresetId = 'casual5'): FutsalCategory => ({
    id: newId('c_'),
    name,
    division: /kid|u\d|under|junior/i.test(name) ? 'Kids' : /women|ladies|girls/i.test(name) ? 'Women' : 'Men',
    rules: { ...PRESETS[preset].rules, points: { ...PRESETS[preset].rules.points }, tiebreakers: [...PRESETS[preset].rules.tiebreakers] },
    format: 'GROUPS_KNOCKOUT',
    groupCount: 2,
    advancePerGroup: 2,
    maxTeams: 8,
    entryFee: 0,
});

/** Minutes a match takes on the pitch, half-time and changeover included. */
export const matchMinutes = (r: FutsalRules, bufferMinutes = 0) => {
    const play = r.periods * r.periodMinutes + (r.periods - 1) * r.halftimeMinutes;
    // A stopped clock runs roughly half as long again in real time.
    return Math.ceil(r.clock === 'stopped' ? play * 1.5 : play) + bufferMinutes;
};

export const GOAL_TYPES: { id: GoalType; label: string }[] = [
    { id: 'volley', label: 'Volley' }, { id: 'tap_in', label: 'Tap-in' }, { id: 'header', label: 'Header' },
    { id: 'long_shot', label: 'Long shot' }, { id: 'penalty', label: 'Penalty' }, { id: 'free_kick', label: 'Free kick' },
];
export const goalTypeLabel = (g?: GoalType) => GOAL_TYPES.find(x => x.id === g)?.label || '';
