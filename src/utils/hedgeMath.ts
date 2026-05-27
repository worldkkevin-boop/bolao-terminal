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
