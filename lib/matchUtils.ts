export const deriveWinner = (sets: {team1: number, team2: number}[]): "team1" | "team2" | "draw" => {
  const team1SetsWon = sets.filter(s => s.team1 > s.team2).length;
  const team2SetsWon = sets.filter(s => s.team2 > s.team1).length;
  if (team1SetsWon > team2SetsWon) return "team1";
  if (team2SetsWon > team1SetsWon) return "team2";
  return "draw";
};

export const freshStanding = (teamId: string, teamName: string) => ({
  teamId, 
  teamName,
  played: 0, 
  wins: 0, 
  losses: 0, 
  draws: 0,
  setsWon: 0, 
  setsLost: 0, 
  points: 0,
  gamesWon: 0,
  gamesLost: 0
});
