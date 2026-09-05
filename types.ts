export enum TournamentFormat {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  DOUBLE_ELIMINATION = 'DOUBLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
  GROUP_TO_KNOCKOUT = 'GROUP_TO_KNOCKOUT',
  AMERICANO = 'AMERICANO',
  MEXICANO = 'MEXICANO'
}

export enum RoundRobinType {
  SINGLE = 'SINGLE', // Play once
  DOUBLE = 'DOUBLE', // Play twice
  GROUP_SINGLE = 'GROUP_SINGLE', // Divide into groups, play once
  GROUP_DOUBLE = 'GROUP_DOUBLE'  // Divide into groups, play twice
}

export enum SkillLevel {
  NEWCOMER = 'NEWCOMER',
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  PROFESSIONAL = 'PROFESSIONAL',
  OPEN = 'OPEN'
}

export enum MatchStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum SponsorTier {
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  TITLE = 'TITLE'
}

export interface Sponsor {
  id: string;
  name: string;
  logo: string; // Base64
  tier: SponsorTier;
}

export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  setsWon: number;
  eloRating: number;
}

export interface User {
  id: string;
  fullName: string;
  name?: string; // Alias for fullName
  phone: string;
  email?: string;
  photoUrl?: string;
  role: 'player' | 'organizer' | 'superadmin';
  stats: PlayerStats;
  firstMiniTournamentUsed: boolean;
  promoCode: string | null;
  promoPoints: number;
  referredBy: string | null;
  createdAt: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  cnic?: string;
  photoUrl?: string;
  skillLevel: SkillLevel;
  registeredAt: string;
  isAvailable?: boolean;
}

export interface Player {
  id?: string; // Reference to PlayerProfile if registered
  name: string;
  phone: string;
  email: string;
  cnic?: string;
  photoUrl?: string;
  verified: boolean;
}

export interface Squad {
  id: string;
  ownerId: string; // ID of the PlayerProfile who owns this squad
  name: string;
  partner: Player; // Snapshot of the partner's details
  avatarUrl?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  player1: Player;
  player2: Player;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'REPLACED' | string;
  registeredAt: string;
  groupId?: string; 
  categoryId?: string; // Track which category this team belongs to
  categoryName?: string;
  category?: string;
  // Stats
  matchesPlayed?: number;
  wins?: number; 
  losses?: number; 
  points?: number;
  setsWon?: number;
  setsLost?: number;
  gamesWon?: number;
  gamesLost?: number;
  gamesPlayed?: number;
  gd?: number;
  gwp?: number;
  pointsScored?: number;
  pointsConceded?: number;
  pointDifferential?: number;
  ties?: number;
  missedMatchPoints?: number;
  knockoutStage?: 'CHAMPION' | 'RUNNER_UP' | 'SEMI_FINALIST' | 'QUARTER_FINALIST' | '' | string;
  knockoutWeight?: number;
  fipPpfPoints?: number;
}

export interface MatchEvent {
  id: string;
  timestamp: string;
  type: 'POINT_SCORED' | 'UNDO' | 'SET_COMPLETED' | 'TIEBREAK_STARTED' | 'MATCH_WON';
  description: string;
  teamId?: string; // Which team the event pertains to if applicable
  scoreSnapshot: {
    p1Points: string;
    p2Points: string;
    p1Games: number;
    p2Games: number;
    p1Sets: number;
    p2Sets: number;
  }
}

export interface ScoreState {
  p1Points: string;
  p2Points: string;
  p1Games: number;
  p2Games: number;
  p1Sets: number;
  p2Sets: number;
  p1SetScores: number[]; // History of sets: [6, 4, 2]
  p2SetScores: number[]; // History of sets: [4, 6, 6]
  currentSet: number;
  isTiebreak: boolean;
  history: string[];
  timeline?: MatchEvent[];
  _isSetCompleted?: boolean;
  _isSuperTiebreak?: boolean;
  
  // New Live Scoring State
  rawPointsA?: number;
  rawPointsB?: number;
  server?: string | null;
  goldenPoint?: boolean;
}

export interface MatchDependency {
  sourceType: 'MATCH_WINNER' | 'MATCH_LOSER' | 'GROUP_RANK';
  sourceId: string; // Match ID or Group ID (e.g., "A")
  rank?: number; // For Group rank (e.g., 1 for 1st place)
}

export interface SchedulingSlot {
  date: string; // ISO Date YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface AutoScheduleConfig {
  slots: SchedulingSlot[];
  matchDuration: number; // in minutes
  bufferTime: number; // in minutes
  courts: string[];
  useSeeding: boolean;
  categoryId?: string | null;
}

export interface MatchRating {
  raterPlayerId: string;
  ratedPlayerId: string;
  stars: number;
  tags: string[]; // e.g., 'smash', 'defense', 'positioning', 'teamwork', 'serve'
}

export interface Match {
  activeOverlay?: 'scoreboard' | 'team_vs_team' | 'player_profiles' | 'winner_result';
  id: string;
  tournamentId: string;
  categoryId?: string; // Track which category this match belongs to
  team1Id?: string;
  team2Id?: string;
  team1Name?: string;
  team2Name?: string;
  team1PlayerNames?: string;
  team2PlayerNames?: string;
  team1PlayerIds?: string[];
  team2PlayerIds?: string[];
  stage?: string;
  group?: string; 
  round: number; 
  roundName: string;
  court?: string | null; // Legacy/Display
  courtId?: string | null;
  courtName?: string | null;
  scheduledCourtId?: string | null;
  scheduledStartTime?: string | null;
  actualCourtId?: string | null;
  courtOverrideBy?: string | null;
  courtOverrideAt?: string | null;
  conflictAcknowledged?: boolean | null;
  auditLogs?: any[];
  obsEnabled?: boolean;
  obsUrl?: string | null;
  refereeId?: string | null;
  startedAt?: string | null;
  scheduledTime: string;
  status: MatchStatus;
  score: ScoreState;
  winnerTeamId?: string;
  resolutionType?: 'normal' | 'early_termination' | 'disqualified' | 'technical';
  refereeNotes?: string[];
  ratings?: MatchRating[];
  
  // Progression Logic
  nextMatchId?: string; // Where the winner goes
  loserNextMatchId?: string; // Where the loser goes (Double Elim)
  
  // Dependency (How do teams get HERE?)
  team1Dependency?: MatchDependency;
  team2Dependency?: MatchDependency;

  // Broadcast State
  activeBroadcastEvent?: BroadcastEvent;
}

export interface BroadcastEvent {
  id: string;
  type: 'SCORE_UPDATE' | 'TOMBSTONE' | 'VIOLATOR' | 'MATCH_INTRO' | 'MATCH_END';
  message?: string; // For Tombstone/Violator
  subMessage?: string;
  teamId?: string; // If relevant to a specific team
  duration?: number; // How long to show (ms)
  timestamp: number;
}

export interface Venue {
  id: string;
  name: string;
  location: string;
  city?: string;
  address?: string;
  courts?: number;
  contactEmail?: string;
  contactPhone?: string;
  onboardedBy: string;
  createdAt: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface Court {
  id: string;
  venueId: string;
  courtName: string;
  qrToken: string;
  adminQrToken: string;
  createdAt: string;
}

export interface Organizer {
  id: string;
  teamName: string;
  members: string[]; // userIds
  onboardedBy: string;
  createdAt: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface TournamentCategory {
  id: string;
  name: string; // e.g., "Beginner", "Intermediate", "Pro"
  skillLevel: SkillLevel;
  maxTeams: number;
  entryFee: number;
  prizeMoney: number;
  bannerUrl?: string;
  venueId?: string;
  courtId?: string;
  courts?: string[];
  format: TournamentFormat;
  rrType?: RoundRobinType;
  groupSize?: number;
  // New scheduling fields
  slotDuration?: number; // in minutes
  bufferTime?: number; // in minutes
  advanceCount?: number; // for group stage advancement
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  rrType?: RoundRobinType; 
  groupSize?: number; 
  skillLevel: SkillLevel;
  maxTeams: number;
  entryFee: number;
  currency: string; 
  venueId: string;
  courtId: string;
  organizerId: string;
  organizerEmail?: string;
  adminTag?: string;
  venue?: string;
  city?: string;
  sport?: string;
  organizer?: string;
  organizerLogo?: string; // New field for brand logo
  prizeMoney: number;
  refereePasscode: string;
  courts: string[]; 
  registrationDeadline: string;
  startDate?: string;
  endDate?: string;
  teams: Team[];
  matches: Match[];
  categories?: TournamentCategory[]; // New field for multi-category support
  isMultiCategory?: boolean;
  multipleVenues?: boolean;
  venueIds?: string[];
  sponsors?: Sponsor[]; 
  bannerUrl?: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'RETIRED';
  slug?: string;
  createdAt: string;
  slotDuration?: number;
  bufferTime?: number;
}

export interface GlobalState {
  tournaments: Tournament[];
  currentTournamentId: string | null;
}

export interface QuickSessionPlayer {
  userId: string;
  fullName: string;
}

export interface QuickSessionMatch {
  matchId: string;
  player1: string;
  player2: string;
  score: ScoreState;
  timestamp: string;
}

export interface QuickplaySession {
  id: string;
  courtId: string;
  venueId: string;
  type: 'casual' | 'mini-tournament';
  hostUserId: string;
  players: QuickSessionPlayer[];
  matches: QuickSessionMatch[];
  status: 'active' | 'completed';
  paid: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface PromoCode {
  id: string; // the code itself
  ownerId: string;
  totalUses: number;
  uniqueSignUps: string[];
  pointsEarned: number;
  createdAt: string;
}

export interface GlobalStats {
  totalMatches: number;
  totalPlayers: number;
  totalCourts: number;
}

export interface QuickMatch {
  id: string;
  team1Name: string;
  team2Name: string;
  score: ScoreState;
  status: MatchStatus;
  winner?: 1 | 2;
}

export interface QuickSession {
  id: string;
  creatorEmail: string;
  mode: 'casual' | 'tournament';
  players: string[]; // Names of players or teams
  matches: QuickMatch[];
  status: 'active' | 'completed';
  createdAt: string;
}

export interface OnboardedPlayer {
  id: string; // unique slug e.g. name__email__phone
  name: string;
  email: string;
  phone: string;
  cnic?: string;
  photoUrl?: string;
  verified: boolean;
  tournaments: {
    tournamentId: string;
    tournamentName: string;
    teamId: string;
    teamName: string;
    partnerName: string;
    registeredAt: string;
    status: string;
  }[];
  lastUpdated: string;
}

export interface OnboardedTeam {
  id: string; // tournamentId_teamId
  teamId: string;
  name: string;
  tournamentId: string;
  tournamentName: string;
  player1: Player;
  player2: Player;
  status: string;
  registeredAt: string;
  categoryId?: string;
  groupId?: string;
  stats?: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    points: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    gamesPlayed: number;
  };
  lastUpdated: string;
}