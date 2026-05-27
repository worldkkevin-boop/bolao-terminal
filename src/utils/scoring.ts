export type ScoreCategory = 'EXATO' | 'VENCEDOR_GOLS' | 'EMPATE' | 'VENCEDOR_SALDO' | 'VENCEDOR_GOLS_PERDEDOR' | 'VENCEDOR' | 'GOLS_PARCIAL' | 'ERROU';

export interface DetailedScore {
  points: number;
  category: ScoreCategory;
}

export function calculateScoreDetailed(guessHome: number, guessAway: number, realHome: number, realAway: number): DetailedScore {
  // Placar Exato
  if (guessHome === realHome && guessAway === realAway) return { points: 30, category: 'EXATO' };
  
  const guessDiff = guessHome - guessAway;
  const realDiff = realHome - realAway;
  
  const guessWinner = guessDiff > 0 ? 'home' : guessDiff < 0 ? 'away' : 'draw';
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'draw';
  
  if (guessWinner === realWinner) {
    // Empate (não cravado)
    if (guessWinner === 'draw') return { points: 18, category: 'EMPATE' };
    
    // Acertou o Vencedor e os Gols do Time Vencedor
    const hitWinnerGoals = (realWinner === 'home' && guessHome === realHome) || (realWinner === 'away' && guessAway === realAway);
    if (hitWinnerGoals) return { points: 18, category: 'VENCEDOR_GOLS' };
    
    // Acertou o Vencedor e o Saldo de Gols
    if (guessDiff === realDiff) return { points: 15, category: 'VENCEDOR_SALDO' };
    
    // Acertou o Vencedor e os Gols do Time Perdedor
    const hitLoserGoals = (realWinner === 'home' && guessAway === realAway) || (realWinner === 'away' && guessHome === realHome);
    if (hitLoserGoals) return { points: 12, category: 'VENCEDOR_GOLS_PERDEDOR' };
    
    // Apenas Vencedor
    return { points: 4, category: 'VENCEDOR' };
  }
  
  // Gols de um time certo (mesmo errando o vencedor)
  if (guessHome === realHome || guessAway === realAway) return { points: 3, category: 'GOLS_PARCIAL' };
  
  // Nenhum acerto
  return { points: 0, category: 'ERROU' };
}

export function calculateScore(guessHome: number, guessAway: number, realHome: number, realAway: number): number {
  return calculateScoreDetailed(guessHome, guessAway, realHome, realAway).points;
}
