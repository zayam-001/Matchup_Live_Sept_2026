// Futsal and football live in their own collections (futsalTournaments, futsalTeams, futsalMatches)
// so padel screens, rankings and the merge engine never see them. `sport` tells the two apart.

export type PresetId = 'fifa5' | 'casual5' | 'six' | 'seven' | 'custom'
    | 'eleven' | 'eleven_short' | 'nine' | 'eight' | 'football_custom';
export type ClockMode = 'stopped' | 'running';
export type KnockoutTiebreak = 'extra_time_penalties' | 'penalties' | 'golden_goal';
export type Tiebreaker = 'h2h_points' | 'h2h_gd' | 'h2h_gf' | 'gd' | 'gf' | 'fair_play' | 'lots';
export type CompetitionFormat = 'LEAGUE' | 'DOUBLE_LEAGUE' | 'GROUPS_KNOCKOUT' | 'KNOCKOUT' | 'GROUPS'
    /** League, then the top four play Qualifier, Eliminator 1, Eliminator 2 and a Final. */
    | 'LEAGUE_PLAYOFFS'
    /** League, then the top `advancePerGroup` play a straight knockout. */
    | 'LEAGUE_KNOCKOUT';
export type Division = 'Men' | 'Women' | 'Kids' | 'Mixed';
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD' | '';

export interface FutsalRules {
    preset: PresetId;
    onPitch: number;
    squadMin: number;
    squadMax: number;
    periods: number;
    periodMinutes: number;
    halftimeMinutes: number;
    clock: ClockMode;
    timeoutsPerPeriod: number;
    /** Team fouls per period before every foul gives a direct kick from 10 m. 0 = off. */
    foulLimit: number;
    /** Minutes a team plays short after a red card. 0 = the player is just sent off. */
    redCardMinutes: number;
    knockoutTiebreak: KnockoutTiebreak;
    extraTimeMinutes: number;
    thirdPlace: boolean;
    points: { win: number; draw: number; loss: number };
    forfeitScore: number;
    /** Match stops once a side leads by this many. 0 = off. */
    mercyGoals: number;
    kickIn: boolean;
    tiebreakers: Tiebreaker[];
    /** Football style: the second half's clock carries on from 45:00 instead of restarting at 00:00. */
    continuousClock?: boolean;
}

export interface FutsalCategory {
    id: string;
    name: string;
    division: Division;
    rules: FutsalRules;
    format: CompetitionFormat;
    groupCount: number;
    advancePerGroup: number;
    maxTeams: number;
    entryFee: number;
}

export interface ScheduleSettings {
    dayStart: string; // "09:00"
    dayEnd: string;   // "23:00"
    bufferMinutes: number;
    minRestMinutes: number;
    maxPerDay: number;
    /** Days of the week matches can be played (0 = Sunday). Empty or missing = every day. */
    weekdays?: number[];
    /** Exact match days (yyyy-mm-dd). When set, only these days are used and `weekdays` is ignored. */
    matchDates?: string[];
    /** Fixed kick-off times ("17:30") per pitch per day. When set, matches only start at these times. */
    slotTimes?: string[];
    /** Most matches on the whole venue per day. 0 or missing = no limit. */
    maxMatchesPerDay?: number;
}

export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'ACTIVE' | 'COMPLETED';

export interface FutsalTournament {
    id: string;
    name: string;
    /** 'futsal' when missing (records made before football existed). */
    sport?: 'futsal' | 'football';
    organizerId: string;
    organizerEmail: string;
    organizerName?: string;
    city: string;
    venue: string;
    pitches: string[];
    startDate: string; // yyyy-mm-dd
    endDate: string;
    reopenedAt?: string;
    bannerUrl?: string;
    logoUrl?: string;
    /** Look of broadcast, spectator and tournament pages: 'crimson' is the red Champions-night theme. */
    theme?: 'default' | 'crimson';
    /** Shown in the broadcast marquee instead of results when set. */
    sponsors?: { name: string; logoUrl: string }[];
    status: TournamentStatus;
    categories: FutsalCategory[];
    scorerPasscode: string;
    currency: string;
    /** Rankings tier id from lib/pointsSystems (local, fip_bronze...). */
    tier: string;
    squadLockAt?: string;
    schedule: ScheduleSettings;
    /** Organiser's pick per category; falls back to most Player of the Match awards. */
    bestPlayer?: Record<string, string>;
    createdAt: string;
}

export interface SquadPlayer {
    id: string;
    name: string;
    number?: number;
    position?: Position;
    phone?: string;
    email?: string;
    uid?: string;
    /** 1–99 set by the team's captain; otherwise the card rating comes from match stats. */
    rating?: number;
}

export type TeamStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface FutsalTeam {
    id: string;
    tournamentId: string;
    categoryId: string;
    name: string;
    shortName: string;
    color: string;
    logoUrl?: string;
    captainUid?: string;
    captainName: string;
    captainPhone?: string;
    captainEmail?: string;
    players: SquadPlayer[];
    status: TeamStatus;
    groupId?: string;
    seed?: number;
    registeredAt: string;
}

export type Side = 'home' | 'away';
export type Stage = 'LEAGUE' | 'GROUP' | 'R64' | 'R32' | 'R16' | 'QF' | 'SF' | 'F' | '3P' | 'QUAL' | 'EL1' | 'EL2';

/** Where a knockout slot's team comes from before it's known. */
export type SlotSource =
    | { type: 'group'; group: string; pos: number }
    | { type: 'league'; pos: number }
    | { type: 'winner'; matchId: string }
    | { type: 'loser'; matchId: string }
    | { type: 'seed'; seed: number };

export type EventType =
    | 'GOAL' | 'OWN_GOAL' | 'FOUL' | 'YELLOW' | 'RED' | 'TIMEOUT' | 'SUB'
    | 'PEN_SCORED' | 'PEN_MISSED' | 'PERIOD_START' | 'PERIOD_END';

export type GoalType = 'volley' | 'tap_in' | 'header' | 'long_shot' | 'penalty' | 'free_kick';

export interface FutsalEvent {
    id: string;
    type: EventType;
    /** The team the event belongs to (the scorer's team for an own goal). */
    side: Side;
    playerId?: string;
    assistId?: string;
    inId?: string;
    outId?: string;
    period: number;
    /** Clock time in the period, in ms. */
    ms: number;
    at: number;
    auto?: boolean; // a red issued by a second yellow
    goalType?: GoalType;
}

export type PeriodState = 'PRE' | 'PLAYING' | 'PAUSED' | 'BREAK' | 'SHOOTOUT' | 'ENDED';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';
export type DecidedBy = 'regular' | 'extra_time' | 'golden_goal' | 'penalties' | 'forfeit' | 'mercy';

export interface Lineup { players: string[]; gk?: string }

export interface FutsalMatch {
    id: string;
    tournamentId: string;
    categoryId: string;
    stage: Stage;
    group?: string;
    round: number;
    matchNo: number;
    homeId?: string;
    awayId?: string;
    homeFrom?: SlotSource;
    awayFrom?: SlotSource;
    pitch?: string;
    startAt?: string; // ISO
    status: MatchStatus;
    period: number;
    periodState: PeriodState;
    clock: { elapsedMs: number; runningSince?: number | null };
    events: FutsalEvent[];
    lineups?: { home?: Lineup; away?: Lineup };
    winnerId?: string | null;
    decidedBy?: DecidedBy;
    forfeitBy?: Side;
    motm?: string;
    /** Optional referee ratings after full time, 1–5 per player id. */
    ratings?: Record<string, number>;
    updatedAt?: number;
}
