import { ScoreState } from "../types";

const POINTS = ['0', '15', '30', '40'];

export const getEffectiveEvents = (history: string[]): string[] => {
  const validIndices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    const ev = history[i];
    if (ev.startsWith('UNDO')) {
      if (validIndices.length > 0) {
        validIndices.pop();
      }
    } else if (ev.startsWith('REMOVE')) {
      const parts = ev.split('|');
      const team = parts[1]; // T1 or T2
      let targetIdx = -1;
      for (let j = validIndices.length - 1; j >= 0; j--) {
        const checkEv = history[validIndices[j]];
        if (checkEv.startsWith('START_SET')) {
          break;
        }
        if (checkEv.startsWith(team)) {
          targetIdx = j;
          break;
        }
      }
      if (targetIdx !== -1) {
        validIndices.splice(targetIdx, 1);
      }
    } else {
      validIndices.push(i);
    }
  }
  return validIndices.map(i => history[i]);
};

export const recomputeScore = (history: string[] = []): ScoreState => {
  const state: ScoreState = {
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
    history: history, // Preserve the full history array
  };
  
  // Custom properties used during generation
  let isSuperTiebreak = false;
  let isSetCompleted = false;

  const effectiveHistory = getEffectiveEvents(history);

  for (let i = 0; i < effectiveHistory.length; i++) {
    const event = effectiveHistory[i];

    if (event.startsWith('START_SET_NORMAL')) {
      state.p1Games = 0;
      state.p2Games = 0;
      state.p1Points = '0';
      state.p2Points = '0';
      state.currentSet++;
      state.isTiebreak = false;
      isSuperTiebreak = false;
      isSetCompleted = false;
      continue;
    }

    if (event.startsWith('START_SET_SUPER')) {
      state.p1Games = 0;
      state.p2Games = 0;
      state.p1Points = '0';
      state.p2Points = '0';
      state.currentSet++;
      state.isTiebreak = false;
      isSuperTiebreak = true;
      isSetCompleted = false;
      continue;
    }

    if (isSetCompleted) {
      continue; // Ignore points if set is completed and no new set started
    }

    let team = null;
    if (event.startsWith('T1')) team = 1;
    else if (event.startsWith('T2')) team = 2;
    else if (event.startsWith('point|')) {
      const parts = event.split('|');
      if (parts[2] === 'p1' || parts[2] === 'p2') team = 1;
      else if (parts[2] === 'p3' || parts[2] === 'p4') team = 2;
      else if (parts[3] === 'teamA') team = 1;
      else if (parts[3] === 'teamB') team = 2;
    }

    if (!team) continue;

    const pPoints = team === 1 ? 'p1Points' : 'p2Points';
    const oPoints = team === 1 ? 'p2Points' : 'p1Points';
    const pGames = team === 1 ? 'p1Games' : 'p2Games';
    const oGames = team === 1 ? 'p2Games' : 'p1Games';
    const pSets = team === 1 ? 'p1Sets' : 'p2Sets';

    if (isSuperTiebreak) {
      // Super tiebreak: race to 10 points, win by 2
      let pScore = parseInt(state[pPoints] || '0') || 0;
      let oScore = parseInt(state[oPoints] || '0') || 0;
      pScore++;
      state[pPoints] = pScore.toString();

      if (pScore >= 10 && pScore - oScore >= 2) {
         state.p1SetScores.push(team === 1 ? pScore : oScore);
         state.p2SetScores.push(team === 2 ? pScore : oScore);
         // Often the 'games' field is left as the super tiebreaker score so the UI shows it correctly.
         state[pGames] = pScore;
         state[oGames] = oScore;
         state[pSets]++;
         isSetCompleted = true;
      }
      continue;
    }

    if (state.isTiebreak) {
      // Normal tiebreak: race to 7 points, win by 2
      let pScore = parseInt(state[pPoints]);
      let oScore = parseInt(state[oPoints]);
      pScore++;
      state[pPoints] = pScore.toString();
      
      if (pScore >= 7 && pScore - oScore >= 2) {
        state[pGames]++;
        state.p1SetScores.push(state.p1Games);
        state.p2SetScores.push(state.p2Games);
        state[pSets]++;
        isSetCompleted = true;
      }
      continue;
    }

    // Normal game logic
    const currentP = state[pPoints];
    const currentO = state[oPoints];

    if (currentP === '40') {
      if (currentO === '40') {
        state[pPoints] = 'AD';
      } else if (currentO === 'AD') {
        state[oPoints] = '40';
      } else {
        // Win game
        state.p1Points = '0';
        state.p2Points = '0';
        state[pGames]++;

        // Check if won set
        if ((state[pGames] === 6 && state[oGames] <= 4) || state[pGames] === 7) {
          state.p1SetScores.push(state.p1Games);
          state.p2SetScores.push(state.p2Games);
          state[pSets]++;
          isSetCompleted = true;
        } else if (state[pGames] === 6 && state[oGames] === 6) {
          state.isTiebreak = true;
          state.p1Points = '0';
          state.p2Points = '0';
        }
      }
    } else if (currentP === 'AD') {
      // Win game
      state.p1Points = '0';
      state.p2Points = '0';
      state[pGames]++;

      if ((state[pGames] === 6 && state[oGames] <= 4) || state[pGames] === 7) {
          state.p1SetScores.push(state.p1Games);
          state.p2SetScores.push(state.p2Games);
          state[pSets]++;
          isSetCompleted = true;
      } else if (state[pGames] === 6 && state[oGames] === 6) {
          state.isTiebreak = true;
          state.p1Points = '0';
          state.p2Points = '0';
      }
    } else {
      const idx = POINTS.indexOf(currentP);
      state[pPoints] = POINTS[idx + 1];
    }
  }

  // Inject computed properties for the UI
  return {
    ...state,
    _isSetCompleted: isSetCompleted,
    _isSuperTiebreak: isSuperTiebreak
  } as any;
};

export const addPoint = (currentScore: ScoreState, team: 1 | 2, playerIdx?: 1 | 2, eventTag?: string): ScoreState => {
  const history = [...(currentScore.history || [])];
  const ts = Date.now();
  let eventStr = `T${team}|${ts}|${playerIdx || 1}`;
  if (eventTag) {
      eventStr += `|${eventTag}`;
  }
  history.push(eventStr);
  return recomputeScore(history);
};

export const removePoint = (currentScore: ScoreState, team: 1 | 2): ScoreState => {
  const history = [...(currentScore.history || [])];
  const ts = Date.now();
  history.push(`REMOVE|T${team}|${ts}`);
  return recomputeScore(history);
};

export const undoLastEvent = (currentScore: ScoreState): ScoreState => {
  const history = [...(currentScore.history || [])];
  const ts = Date.now();
  history.push(`UNDO|${ts}`);
  return recomputeScore(history);
};

export const startNewSet = (currentScore: ScoreState, mode: 'normal' | 'super_tiebreaker'): ScoreState => {
  const history = [...(currentScore.history || [])];
  const ts = Date.now();
  if (mode === 'super_tiebreaker') {
     history.push(`START_SET_SUPER|${ts}`);
  } else {
     history.push(`START_SET_NORMAL|${ts}`);
  }
  return recomputeScore(history);
};

