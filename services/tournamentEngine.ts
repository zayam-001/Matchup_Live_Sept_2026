import { Tournament, 
  Team, 
  Match, 
  MatchStatus, 
  TournamentFormat, 
  TournamentCategory,
  ScoreState,
  MatchDependency } from '../types';

// ==================================================================
// 🛠️ TOURNAMENT ENGINE
// ==================================================================

/**
 * Utility to generate a unique ID
 */
const genId = () => Math.random().toString(36).substr(2, 9);

/**
 * Initial score state for new matches
 */
const initialScore: ScoreState = {
  p1Points: '0', 
  p2Points: '0', 
  p1Games: 0, 
  p2Games: 0, 
  p1Sets: 0, 
  p2Sets: 0,
  p1SetScores: [], 
  p2SetScores: [], 
  currentSet: 1, 
  isTiebreak: false, 
  history: [],
  timeline: []
};

/**
 * Formats: Single Elimination, Double Elimination, Round Robin, Americano
 */

export interface FixtureOptions {
  tournamentId: string;
  categoryId: string;
  teams: Team[];
  categoryConfig: TournamentCategory;
  venueId?: string;
  courts?: string[];
}

/**
 * CORE LOGIC: CATEGORY ISOLATION
 * Validates that all teams belong to the same category.
 */
export const validateCategoryConsistency = (teams: Team[], categoryId: string): boolean => {
  return teams.every(team => team.categoryId === categoryId);
};

/**
 * SINGLE ELIMINATION
 */
export const generateSingleElimination = (options: FixtureOptions): Match[] => {
  const { tournamentId, categoryId, teams, categoryConfig } = options;
  
  // Only use accepted teams
  const activeTeams = teams.filter(t => t.status === 'ACCEPTED');
  if (activeTeams.length < 2) return [];

  const matches: Match[] = [];
  const teamCount = activeTeams.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(teamCount)));
  const byes = nextPowerOf2 - teamCount;

  // Seeding
  const sortedTeams = [...activeTeams];
  // Simple seeding based on provided points if available
  sortedTeams.sort((a, b) => (b.points || 0) - (a.points || 0));

  const bracketTeams: (Team | null)[] = [...sortedTeams];
  for (let i = 0; i < byes; i++) bracketTeams.push(null);

  // Standard SE bracket seeding (1 vs 16, 8 vs 9, etc)
  const seededOrder: (Team | null)[] = [];
  const n = bracketTeams.length;
  
  const getSeededPairs = (numTeams: number): number[] => {
    if (numTeams === 2) return [1, 2];
    const prev = getSeededPairs(numTeams / 2);
    const res: number[] = [];
    for (const p of prev) {
      res.push(p);
      res.push(numTeams - p + 1);
    }
    return res;
  };

  const seedIndices = getSeededPairs(n);
  seedIndices.forEach(idx => {
    seededOrder.push(bracketTeams[idx - 1]);
  });

  // Round 1
  const r1Matches: Match[] = [];
  for (let i = 0; i < seededOrder.length; i += 2) {
    const t1 = seededOrder[i];
    const t2 = seededOrder[i + 1];
    
    const match: Match = {
      id: `m_se_${genId()}`,
      tournamentId,
      categoryId,
      team1Id: t1?.id || '',
      team2Id: t2?.id || '',
      status: MatchStatus.SCHEDULED,
      score: { ...initialScore },
      court: 'TBD',
      scheduledTime: new Date().toISOString(),
      round: 1,
      roundName: `Round of ${n}`,
      stage: 'BRACKET'
    };

    // Handle Byes
    if (!t1 || !t2) {
      const winner = t1 || t2;
      if (winner) {
        match.winnerTeamId = winner.id;
        match.status = MatchStatus.COMPLETED;
        match.roundName = 'Bye';
      }
    }
    r1Matches.push(match);
  }

  matches.push(...r1Matches);

  // Generate higher rounds placeholders
  let currentLevelMatches = r1Matches;
  let roundNum = 2;
  let remainingTeams = n / 2;

  while (remainingTeams > 1) {
    const nextLevelMatches: Match[] = [];
    for (let i = 0; i < currentLevelMatches.length; i += 2) {
      const m1 = currentLevelMatches[i];
      const m2 = currentLevelMatches[i + 1];
      
      const nextM: Match = {
        id: `m_se_${genId()}`,
        tournamentId,
        categoryId,
        team1Id: '',
        team2Id: '',
        status: MatchStatus.SCHEDULED,
        score: { ...initialScore },
        court: 'TBD',
        scheduledTime: new Date().toISOString(),
        round: roundNum,
        roundName: remainingTeams === 2 ? 'Semi-Final' : remainingTeams === 4 ? 'Quarter-Final' : `Round ${roundNum}`,
        stage: 'BRACKET',
        team1Dependency: { sourceType: 'MATCH_WINNER', sourceId: m1.id },
        team2Dependency: { sourceType: 'MATCH_WINNER', sourceId: m2.id }
      };

      currentLevelMatches[i].nextMatchId = nextM.id;
      currentLevelMatches[i + 1].nextMatchId = nextM.id;
      
      nextLevelMatches.push(nextM);
    }
    matches.push(...nextLevelMatches);
    currentLevelMatches = nextLevelMatches;
    remainingTeams /= 2;
    roundNum++;
  }

  // Final match
  if (currentLevelMatches.length === 1) {
    currentLevelMatches[0].roundName = 'Final';
  }

  return matches;
};

/**
 * ROUND ROBIN
 */
export const generateRoundRobin = (options: FixtureOptions): Match[] => {
  const { tournamentId, categoryId, teams, categoryConfig } = options;
  const activeTeams = teams.filter(t => t.status === 'ACCEPTED');
  if (activeTeams.length < 2) return [];

  const matches: Match[] = [];
  const teamIds = activeTeams.map(t => t.id);
  
  // Basic RR: Every team plays every other team
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      matches.push({
        id: `m_rr_${genId()}`,
        tournamentId,
        categoryId,
        team1Id: teamIds[i],
        team2Id: teamIds[j],
        status: MatchStatus.SCHEDULED,
        score: { ...initialScore },
        court: 'TBD',
        scheduledTime: new Date().toISOString(),
        round: 1,
        roundName: 'Round Robin',
        stage: 'GROUP'
      });

      // Handle Double Round Robin
      if (categoryConfig.rrType === 'DOUBLE') {
        matches.push({
          id: `m_rr_${genId()}`,
          tournamentId,
          categoryId,
          team1Id: teamIds[j],
          team2Id: teamIds[i],
          status: MatchStatus.SCHEDULED,
          score: { ...initialScore },
          court: 'TBD',
          scheduledTime: new Date().toISOString(),
          round: 2,
          roundName: 'Round Robin (Reverse)',
          stage: 'GROUP'
        });
      }
    }
  }

  return matches;
};

/**
 * AMERICANO
 * Format: Rotating partners, individual points.
 * For N players, each player plays with every other player once.
 * N must be divisible by 4 for standard Americano logic or use ghost players.
 */
export const generateAmericano = (options: FixtureOptions): Match[] => {
  const { tournamentId, categoryId, teams } = options;
  const activeTeams = teams.filter(t => t.status === 'ACCEPTED');
  if (activeTeams.length < 4) return [];

  const players = activeTeams.map(t => ({ id: t.id, name: t.name }));
  // Pad with BYE players if not divisible by 4
  while (players.length % 4 !== 0) {
      players.push({ id: `BYE_${players.length}`, name: 'BYE' });
  }

  const matches: Match[] = [];
  const n = players.length;
  const pivot = players[0];
  let rotators = players.slice(1);
  let matchCounter = 1;

  for (let r = 0; r < rotators.length; r++) {
      const pairs: Array<[typeof pivot, typeof pivot]> = [];
      pairs.push([pivot, rotators[0]]);
      for (let i = 1; i <= Math.floor(rotators.length / 2); i++) {
          pairs.push([rotators[i], rotators[rotators.length - i]]);
      }

      // Shuffle pairs to randomize opponents
      pairs.sort(() => Math.random() - 0.5);

      for (let i = 0; i < pairs.length; i += 2) {
          if (i + 1 < pairs.length) {
              const pair1 = pairs[i];
              const pair2 = pairs[i + 1];
              
              // If everyone in this match is a BYE (rare but possible with lots of padding), skip
              if (pair1.every(p => p.id.startsWith('BYE')) && pair2.every(p => p.id.startsWith('BYE'))) {
                  continue;
              }

              matches.push({
                  id: `m_americano_${genId()}`,
                  tournamentId,
                  categoryId,
                  team1Id: `americano_temp_team_${matchCounter}_1`,
                  team2Id: `americano_temp_team_${matchCounter}_2`,
                  team1PlayerIds: [pair1[0].id, pair1[1].id].filter(id => !id.startsWith('BYE')),
                  team2PlayerIds: [pair2[0].id, pair2[1].id].filter(id => !id.startsWith('BYE')),
                  team1Name: pair1.map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                  team2Name: pair2.map(p => p.name).filter(n => n !== 'BYE').join(' & '),
                  status: MatchStatus.SCHEDULED,
                  score: { ...initialScore },
                  court: 'TBD',
                  scheduledTime: new Date().toISOString(),
                  round: r + 1,
                  roundName: `Round ${r + 1}`,
                  stage: 'GROUP'
              });
              matchCounter++;
          }
      }

      // Rotate
      const first = rotators.shift();
      if (first) rotators.push(first);
  }

  return matches;
};

export const generateNextMexicanoRound = (tournamentId: string, categoryId: string | undefined, teams: Team[], currentMatches: Match[]): Match[] => {
    // 1. Determine current round
    const maxRound = currentMatches.reduce((max, m) => Math.max(max, m.round || 1), 0);
    const nextRound = maxRound + 1;

    // 2. Filter teams
    const activeTeams = teams.filter(t => t.status === 'ACCEPTED');
    if (activeTeams.length < 4) return [];

    let players = activeTeams.map(t => ({ id: t.id, name: t.name, points: t.points || 0, gwp: t.gwp || 0 }));
    // 3. Sort by points (or GWP as fallback) descending
    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.gwp - a.gwp;
    });

    // Pad with BYEs if necessary
    while (players.length % 4 !== 0) {
        players.push({ id: `BYE_${players.length}`, name: 'BYE', points: -999, gwp: 0 });
    }

    const matches: Match[] = [];
    let matchCounter = 1;

    for (let i = 0; i < players.length; i += 4) {
        // pairings for Mexicano (1&4 vs 2&3 for most competitive intra-group)
        // or 1&3 vs 2&4. Let's do 1&3 vs 2&4 as standard balanced.
        const p1 = players[i];
        const p2 = players[i + 1];
        const p3 = players[i + 2];
        const p4 = players[i + 3];

        matches.push({
            id: `m_mexicano_r${nextRound}_${genId()}`,
            tournamentId,
            categoryId,
            team1Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_1`,
            team2Id: `mexicano_temp_team_r${nextRound}_${matchCounter}_2`,
            team1PlayerIds: [p1.id, p3.id].filter(id => !id.startsWith('BYE')),
            team2PlayerIds: [p2.id, p4.id].filter(id => !id.startsWith('BYE')),
            team1Name: [p1, p3].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            team2Name: [p2, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
            status: MatchStatus.SCHEDULED,
            score: { ...initialScore },
            court: 'TBD',
            scheduledTime: new Date().toISOString(),
            round: nextRound,
            roundName: `Round ${nextRound}`,
            stage: 'GROUP'
        });
        matchCounter++;
    }

    return matches;
};

export const generateMexicano = (options: FixtureOptions): Match[] => {
  const { tournamentId, categoryId, teams } = options;
  const activeTeams = teams.filter(t => t.status === 'ACCEPTED');
  if (activeTeams.length < 4) return [];

  const players = activeTeams.map(t => ({ id: t.id, name: t.name }));
  while (players.length % 4 !== 0) {
      players.push({ id: `BYE_${players.length}`, name: 'BYE' });
  }

  // Mexicano: First round is random. Subsequent rounds are generated based on leaderboard.
  // We'll generate only Round 1 here.
  const matches: Match[] = [];
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  let matchCounter = 1;

  for (let i = 0; i < shuffledPlayers.length; i += 4) {
      const p1 = shuffledPlayers[i];
      const p2 = shuffledPlayers[i + 1];
      const p3 = shuffledPlayers[i + 2];
      const p4 = shuffledPlayers[i + 3];

      matches.push({
          id: `m_mexicano_${genId()}`,
          tournamentId,
          categoryId,
          team1Id: `mexicano_temp_team_${matchCounter}_1`,
          team2Id: `mexicano_temp_team_${matchCounter}_2`,
          team1PlayerIds: [p1.id, p2.id].filter(id => !id.startsWith('BYE')),
          team2PlayerIds: [p3.id, p4.id].filter(id => !id.startsWith('BYE')),
          team1Name: [p1, p2].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
          team2Name: [p3, p4].map(p => p.name).filter(n => n !== 'BYE').join(' & '),
          status: MatchStatus.SCHEDULED,
          score: { ...initialScore },
          court: 'TBD',
          scheduledTime: new Date().toISOString(),
          round: 1,
          roundName: `Round 1`,
          stage: 'GROUP'
      });
      matchCounter++;
  }

  return matches;
};

/**
 * AUTO SCHEDULER ENGINE
 */
export interface ScheduleConfig {
  slots: {
    date: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
  }[];
  courts: string[]; // List of court IDs available for this category
  matchDuration: number; // minutes
  bufferTime: number; // minutes
}

export const autoScheduler = (matches: Match[], config: ScheduleConfig): Match[] => {
  if (matches.length === 0 || config.slots.length === 0 || config.courts.length === 0) return matches;

  const scheduledMatches = [...matches];
  const { slots, courts, matchDuration, bufferTime } = config;
  const totalSlotTime = matchDuration + bufferTime;

  // Sort matches by round to ensure dependencies are handled (mostly for SE)
  scheduledMatches.sort((a, b) => (a.round || 0) - (b.round || 0));

  // Build a timeline for each court
  const courtTimelines: Record<string, number> = {}; // CourtID -> Next available timestamp
  
  let currentSlotIdx = 0;
  let currentMatchIdx = 0;

  while (currentMatchIdx < scheduledMatches.length && currentSlotIdx < slots.length) {
    const slot = slots[currentSlotIdx];
    const slotStart = new Date(`${slot.date}T${slot.startTime}`).getTime();
    const slotEnd = new Date(`${slot.date}T${slot.endTime}`).getTime();

    // Reset court timelines for new slot if they are earlier than slot start
    courts.forEach(courtId => {
      if (!courtTimelines[courtId] || courtTimelines[courtId] < slotStart) {
        courtTimelines[courtId] = slotStart;
      }
    });

    let matchesScheduledInThisSlot = false;
    
    // Try to fill this slot
    do {
      matchesScheduledInThisSlot = false;
      
      // Find the first court that has enough time left in the slot
      const availableCourt = courts.find(courtId => {
        return courtTimelines[courtId] + totalSlotTime * 60000 <= slotEnd;
      });

      if (availableCourt && currentMatchIdx < scheduledMatches.length) {
        const match = scheduledMatches[currentMatchIdx];
        
        // Check if dependencies are met (for SE brackets)
        // Note: Simple scheduler doesn't strictly check if previous round is finish, 
        // but it puts later rounds later in time.
        
        match.scheduledTime = new Date(courtTimelines[availableCourt]).toISOString();
        match.court = availableCourt;
        
        courtTimelines[availableCourt] += totalSlotTime * 60000;
        currentMatchIdx++;
        matchesScheduledInThisSlot = true;
      }
    } while (matchesScheduledInThisSlot && currentMatchIdx < scheduledMatches.length);

    currentSlotIdx++;
  }

  if (currentMatchIdx < scheduledMatches.length) {
    console.warn(`Could only schedule ${currentMatchIdx} out of ${scheduledMatches.length} matches. Overflow detected.`);
  }

  return scheduledMatches;
};
