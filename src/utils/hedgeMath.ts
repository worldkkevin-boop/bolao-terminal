// Lógica Matemática do Hedge Engine migrada do HTML Legado

export const POINTS = {
  exact:       30,
  winnerGoals: 18,
  winnerDiff:  15,
  draw:        18,
  winnerLoser: 12,
  winner:       4,
  oneTeam:      3,
};

// ==========================================
// 1. POISSON DISTRIBUTION
// ==========================================
export function poissonPMF(lambda: number, k: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

export function buildScoreMatrix(lambdaHome: number, lambdaAway: number, max = 4): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i <= max; i++) {
    const row: number[] = [];
    for (let j = 0; j <= max; j++) {
      row.push(poissonPMF(lambdaHome, i) * poissonPMF(lambdaAway, j));
    }
    matrix.push(row);
  }
  return matrix;
}

export function aggregateOutcomes(matrix: number[][]) {
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      if (i > j) home += matrix[i][j];
      else if (i === j) draw += matrix[i][j];
      else away += matrix[i][j];
    }
  }
  return { home, draw, away };
}

// ==========================================
// 2. EXPECTED VALUE (EV) CALCULATION
// ==========================================
export function scoreGuess(guessH: number, guessA: number, realH: number, realA: number): number {
  if (guessH === realH && guessA === realA) return POINTS.exact;

  const guessWinner = guessH > guessA ? 'H' : guessH < guessA ? 'A' : 'D';
  const realWinner  = realH  > realA  ? 'H' : realH  < realA  ? 'A' : 'D';

  if (guessWinner === 'D' && realWinner === 'D') return POINTS.draw;

  if (guessWinner !== realWinner) {
    if (guessH === realH || guessA === realA) return POINTS.oneTeam;
    return 0;
  }

  const guessWinnerGoals = guessWinner === 'H' ? guessH : guessA;
  const realWinnerGoals  = realWinner  === 'H' ? realH  : realA;
  if (guessWinnerGoals === realWinnerGoals) return POINTS.winnerGoals;

  const guessDiff = guessH - guessA;
  const realDiff  = realH  - realA;
  if (guessDiff === realDiff) return POINTS.winnerDiff;

  const guessLoserGoals = guessWinner === 'H' ? guessA : guessH;
  const realLoserGoals  = realWinner  === 'H' ? realA  : realH;
  if (guessLoserGoals === realLoserGoals) return POINTS.winnerLoser;

  return POINTS.winner;
}

export function expectedValue(guessH: number, guessA: number, matrix: number[][]): number {
  let ev = 0;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      ev += matrix[i][j] * scoreGuess(guessH, guessA, i, j);
    }
  }
  return ev;
}

// ==========================================
// 3. TOURNAMENT ENGINE (HEDGE & POPULARITY)
// ==========================================

export function popularPalpiteWeight(h: number, a: number, lambdaHome: number, lambdaAway: number): number {
  const diff = h - a;
  const total = h + a;
  const favoriteIsHome = lambdaHome > lambdaAway;
  const favIsBy = Math.abs(lambdaHome - lambdaAway);

  let weight = 1.0;

  // 1. Placares "templates"
  const templates = ['1-0','2-0','2-1','1-1','3-1','3-0','0-0','0-1','1-2','0-2'];
  if (templates.includes(`${h}-${a}`)) weight *= 2.2;

  // 2. Viés do favorito
  if (favoriteIsHome && diff > 0) weight *= 1.6;
  else if (!favoriteIsHome && diff < 0) weight *= 1.6;

  // 3. Diferença popular: 1 ou 2 gols
  if (Math.abs(diff) === 1) weight *= 1.4;
  else if (Math.abs(diff) === 2) weight *= 1.2;
  else if (Math.abs(diff) >= 4) weight *= 0.15; 

  // 4. Empates de placar alto
  if (h === a && total >= 4) weight *= 0.1;
  if (h === a && total === 3) weight *= 0.2; 

  // 5. Total de gols popular: 2-4
  if (total >= 2 && total <= 4) weight *= 1.3;
  else if (total === 0) weight *= 0.5;
  else if (total >= 6) weight *= 0.1;

  // 6. Jogo desigual (ninguém vai na zebra)
  if (favIsBy > 0.8) {
    if (favoriteIsHome && diff < 0) weight *= 0.2;
    if (!favoriteIsHome && diff > 0) weight *= 0.2;
  }

  return weight;
}

export function buildPopularityMatrix(matrix: number[][], lambdaHome: number, lambdaAway: number): number[][] {
  const size = matrix.length;
  const pop: number[][] = [];
  let total = 0;
  for (let i = 0; i < size; i++) {
    const row: number[] = [];
    for (let j = 0; j < size; j++) {
      const w = matrix[i][j] * popularPalpiteWeight(i, j, lambdaHome, lambdaAway);
      row.push(w);
      total += w;
    }
    pop.push(row);
  }
  for (let i = 0; i < size; i++)
    for (let j = 0; j < size; j++)
      pop[i][j] /= total;
  return pop;
}

export function tournamentEV(h: number, a: number, matrix: number[][], popMatrix: number[][], penalty: number): number {
  const baseEV = expectedValue(h, a, matrix);
  const popularity = popMatrix[h][a];
  // Penaliza se for muito popular
  const adjustment = Math.pow(1 - popularity, penalty * 5);
  return baseEV * adjustment;
}

export function pickTournamentPalpites(matrix: number[][], lambdaHome: number, lambdaAway: number, mode = 'BALANCED') {
  // Configs
  const penalties: any = { SAFE: 0.5, BALANCED: 1.0, AGGRESSIVE: 1.8, DESPERATE: 2.5 };
  const minDists: any = { SAFE: 1, BALANCED: 2, AGGRESSIVE: 3, DESPERATE: 4 };
  
  const penalty = penalties[mode] || 1.0;
  const zebraMinDist = minDists[mode] || 2;
  
  const popMatrix = buildPopularityMatrix(matrix, lambdaHome, lambdaAway);
  
  const candidates = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      candidates.push({
        h: i, a: j,
        ev: expectedValue(i, j, matrix),
        tev: tournamentEV(i, j, matrix, popMatrix, penalty),
        pop: popMatrix[i][j],
        zone: i > j ? 'H' : i < j ? 'A' : 'D'
      });
    }
  }
  
  // Sort by Tournament EV (desc)
  candidates.sort((a, b) => b.tev - a.tev);
  
  const popSorted = [...candidates].sort((a, b) => b.pop - a.pop);
  const p70 = popSorted[Math.floor(candidates.length * 0.3)].pop;
  const p50 = popSorted[Math.floor(candidates.length * 0.5)].pop;
  
  let primary = candidates.find(c => c.pop <= p70) || candidates[0];
  
  let hedge = candidates.find(c => 
    c.pop <= p70 && 
    (Math.abs(c.h - primary.h) + Math.abs(c.a - primary.a)) >= 1
  ) || candidates[1];
  
  let zebra = candidates.find(c => 
    c.pop <= p50 && 
    c.zone !== primary.zone &&
    (Math.abs(c.h - primary.h) + Math.abs(c.a - primary.a)) >= zebraMinDist
  ) || candidates[candidates.length - 1];

  return { primary, hedge, zebra };
}
