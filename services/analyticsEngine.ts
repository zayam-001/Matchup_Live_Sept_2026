import { db } from '../services/storage';
import { collection, doc, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore';

export interface PointHistory {
  stateBefore: {
    pointsA: number;
    pointsB: number;
    gamesA: number;
    gamesB: number;
    setsA: number;
    setsB: number;
    server: string | null;
    goldenPoint: boolean;
  };
  action: {
    teamToAward?: 'teamA' | 'teamB';
    playerId?: string;
    type?: 'winner' | 'error' | 'point';
    finisher?: string;
  };
}

export const processMatchAnalytics = async (matchId: string, tournamentId: string, history: PointHistory[], players: { id: string, name: string }[], teamA: string, teamB: string) => {
  const analytics: Record<string, any> = {};

  // Initialize analytics for all players involved
  players.forEach(p => {
    analytics[p.id] = {
      player_id: p.id,
      match_id: matchId,
      tournament_id: tournamentId,
      calculated_at: new Date().toISOString(),
      
      // Raw stats
      points_won: 0,
      points_played: history.length,
      pressure_points_won: 0,
      pressure_points_faced: 0,
      winners: 0,
      errors: 0,
      break_points_saved: 0,
      break_points_faced: 0,
      break_points_won: 0,
      break_points_return_faced: 0,
      serving_points_won: 0,
      serving_points_total: 0,
      double_faults: 0,
      service_games: 0, // Approx
      deuce_points_won_serving: 0,
      deuce_points_total_serving: 0,
      aggressive_winners: 0,
      smash_attempts: 0,
      smash_winners: 0,
      vibora_attempts: 0,
      vibora_winners: 0,
      unforced_errors: 0,
      points_after_error_won: 0,
      error_points: 0,
      momentum_shifts: 0,
      first_points_won: 0,
      first_points_games_won: 0,
      current_streak: 0,
      max_streak: 0,
      shot_counts: {} as Record<string, { uses: number, wins: number }>,
      games_played: 0
    };
  });

  // Track state for streaks and context
  let currentGameWinnerTracker: Record<string, 'A'|'B'|null> = {}; // { "0-0": "A" }
  let currentGameFirstPointWinner: string | null = null;
  let inDeuce = false;

  history.forEach((point, i) => {
    const { action, stateBefore } = point;
    const isDeuce = stateBefore.pointsA >= 3 && stateBefore.pointsB >= 3 && stateBefore.pointsA === stateBefore.pointsB && !stateBefore.goldenPoint;
    const serverTeam = stateBefore.server ? players.find(p => p.id === stateBefore.server) ? (teamA.includes(stateBefore.server) ? 'teamA' : 'teamB') : null : null;
    
    // Identify point winner based on action
    const pointWinnerTeam = action.teamToAward;
    if (!pointWinnerTeam) return;
    
    const pointLoserTeam = pointWinnerTeam === 'teamA' ? 'teamB' : 'teamA';
    // Let's assume action.playerId is the one who won or made error
    const involvedPlayerId = action.playerId;

    // Award point to both players of the winning team
    players.forEach(p => {
      // For simplicity, determine team membership
      const pTeam = teamA.includes(p.id) ? 'teamA' : (teamB.includes(p.id) ? 'teamB' : null);
      if (!pTeam) return;

      const isWinner = pTeam === pointWinnerTeam;
      const isServer = stateBefore.server === p.id;
      const stats = analytics[p.id];

      if (isWinner) {
        stats.points_won++;
        stats.current_streak++;
        if (stats.current_streak > stats.max_streak) stats.max_streak = stats.current_streak;
      } else {
        stats.current_streak = 0;
      }

      // Clutch pressure points (Deuce, 40-30, 30-40, Tiebreak)
      const isPressure = isDeuce || stateBefore.goldenPoint || (stateBefore.pointsA === 3 && stateBefore.pointsB === 2) || (stateBefore.pointsB === 3 && stateBefore.pointsA === 2);
      if (isPressure) {
        stats.pressure_points_faced++;
        if (isWinner) stats.pressure_points_won++;
      }

      // Serve metrics
      if (isServer) {
        stats.serving_points_total++;
        if (isWinner) stats.serving_points_won++;
        
        if (isDeuce) {
          stats.deuce_points_total_serving++;
          if (isWinner) stats.deuce_points_won_serving++;
        }
      }

      // Break points 
      // Very naive break point logic: receiver is at 40 (3 points), server is less or Deuce-Adv
      const isBreakPoint = (pTeam !== serverTeam) && ((pointWinnerTeam === 'teamA' ? stateBefore.pointsA >= 3 : stateBefore.pointsB >= 3) && (pointWinnerTeam === 'teamA' ? stateBefore.pointsA > stateBefore.pointsB : stateBefore.pointsB > stateBefore.pointsA));
      if (isBreakPoint) {
        if (isServer) {
          stats.break_points_faced++;
          if (isWinner) stats.break_points_saved++;
        } else {
          stats.break_points_return_faced++;
          if (isWinner) stats.break_points_won++;
        }
      }

      // Tagged metrics
      if (involvedPlayerId === p.id) {
        if (action.type === 'winner') {
          stats.winners++;
          const aggShots = ["Smash", "Vibora", "Bandeja", "Passing Shot", "Lob Winner"];
          if (action.finisher && aggShots.includes(action.finisher)) {
            stats.aggressive_winners++;
            if (action.finisher === "Smash") stats.smash_winners++;
            if (action.finisher === "Vibora") stats.vibora_winners++;
          }
          
          if (action.finisher) {
            stats.shot_counts[action.finisher] = stats.shot_counts[action.finisher] || { uses: 0, wins: 0 };
            stats.shot_counts[action.finisher].uses++;
            stats.shot_counts[action.finisher].wins++;
          }
        } else if (action.type === 'error') {
          stats.errors++;
          const unforcedShots = ["Net Error", "Wide Error", "Long Error", "Double Fault"];
          if (action.finisher && unforcedShots.includes(action.finisher)) {
            stats.unforced_errors++;
          }
          if (action.finisher === "Double Fault") {
            stats.double_faults++;
          }
          stats.error_points++; // to track recovery rate later
        }

        // Shot attempts tracking
        if (action.finisher) {
          if (action.finisher === "Smash") stats.smash_attempts++;
          if (action.finisher === "Vibora") stats.vibora_attempts++;
          stats.shot_counts[action.finisher] = stats.shot_counts[action.finisher] || { uses: 0, wins: 0 };
          stats.shot_counts[action.finisher].uses++;
        }
      }

      // Track recovery rate
      if (i > 0) {
        const lastAction = history[i-1].action;
        if (lastAction.playerId === p.id && lastAction.type === 'error') {
           if (isWinner) stats.points_after_error_won++;
        }
      }
      
      // Momentum shift / First point logic 
      // Simplification: We just mark the first point of the game
      if (stateBefore.pointsA === 0 && stateBefore.pointsB === 0) {
          if (isWinner) stats.first_points_won++;
      }
    });

  });

  // Post process analytics and save
  const analyticsArray = Object.values(analytics).map(stats => {
    // A1. CLUTCH RATE
    // Using a simpler formula to map directly to the requirements: just % of pressure points won for now
    
    
    // A2. DOMINANCE SCORE (0-10)
    let dominance_score = stats.points_played > 0 ? (stats.points_won / stats.points_played) * 10 : 0;
    const errRate = stats.points_played - stats.points_won > 0 ? (stats.errors / (stats.points_played - stats.points_won)) * 100 : 0;
    
    if (errRate > 50) dominance_score -= 0.5;
    dominance_score = Math.min(Math.max(dominance_score, 0), 10);

    // A3, A4, A5, A6
    const winner_rate = stats.points_won > 0 ? (stats.winners / stats.points_won) * 100 : 0;
    const error_rate = errRate;
    const bp_save_rate = stats.break_points_faced > 0 ? (stats.break_points_saved / stats.break_points_faced) * 100 : 0;
    const bp_conversion = stats.break_points_return_faced > 0 ? (stats.break_points_won / stats.break_points_return_faced) * 100 : 0;

    // SECTION B
    const service_dominance = stats.serving_points_total > 0 ? (stats.serving_points_won / stats.serving_points_total) * 100 : 0;
    const double_fault_rate = stats.service_games > 0 ? stats.double_faults / stats.service_games : stats.double_faults; 
    const serve_escape_rate = stats.deuce_points_total_serving > 0 ? (stats.deuce_points_won_serving / stats.deuce_points_total_serving) * 100 : 0;

    // SECTION C
    const aggression_index = stats.points_won > 0 ? (stats.aggressive_winners / stats.points_won) * 100 : 0;
    const smash_efficiency = stats.smash_attempts > 0 ? (stats.smash_winners / stats.smash_attempts) * 100 : 0;
    const vibora_effectiveness = stats.vibora_attempts > 0 ? (stats.vibora_winners / stats.vibora_attempts) * 100 : 0;
    
    let signature_shot = 'None';
    let maxWinRate = 0;
    Object.entries(stats.shot_counts).forEach(([shot, data]: [string, any]) => {
      if (data.uses >= 1 && (data.wins / data.uses) * 100 > maxWinRate) {
        maxWinRate = (data.wins / data.uses) * 100;
        signature_shot = shot;
      }
    });

    // SECTION D
    const ue_rate = stats.points_played > 0 ? (stats.unforced_errors / stats.points_played) * 100 : 0;
    const ewr = stats.winners > 0 ? stats.errors / stats.winners : stats.errors;
    const recovery_rate = stats.error_points > 0 ? (stats.points_after_error_won / stats.error_points) * 100 : 0;

    return {
      player_id: stats.player_id,
      match_id: stats.match_id,
      tournament_id: stats.tournament_id,
      calculated_at: stats.calculated_at,
      
      dominance_score,
      winner_rate,
      error_rate,
      service_dominance,
      double_fault_rate,
      serve_escape_rate,
      aggression_index,
      smash_efficiency,
      vibora_effectiveness,
      signature_shot,
      ue_rate,
      ewr,
      recovery_rate,
      
      momentum_shift_rate: 0, // Placeholder
      first_point_effect: 0,
      points_win_pct: stats.points_played > 0 ? (stats.points_won / stats.points_played) * 100 : 0,
      tournament_label: 'Pending'
    };
  });

  // Save to match analytics DB
  for (const a of analyticsArray) {
    if (a && a.player_id && a.match_id && a.player_id !== 'undefined' && a.match_id !== 'undefined') {
      await setDoc(doc(db, 'player_analytics', `${a.player_id}_${a.match_id}`), a);
    }
  }
};
