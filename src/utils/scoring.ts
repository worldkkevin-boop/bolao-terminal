export function calculateScore(guessHome: number, guessAway: number, realHome: number, realAway: number): number {
  // Placar Exato
  if (guessHome === realHome && guessAway === realAway) return 30;
  
  const guessDiff = guessHome - guessAway;
  const realDiff = realHome - realAway;
  
  const guessWinner = guessDiff > 0 ? 'home' : guessDiff < 0 ? 'away' : 'draw';
  const realWinner = realDiff > 0 ? 'home' : realDiff < 0 ? 'away' : 'draw';
  
  if (guessWinner === realWinner) {
    // Empate (não cravado)
    if (guessWinner === 'draw') return 18;
    
    // Acertou o Vencedor e os Gols do Time Vencedor
    const hitWinnerGoals = (realWinner === 'home' && guessHome === realHome) || (realWinner === 'away' && guessAway === realAway);
    if (hitWinnerGoals) return 18;
    
    // Acertou o Vencedor e o Saldo de Gols
    if (guessDiff === realDiff) return 15;
    
    // Acertou o Vencedor e os Gols do Time Perdedor
    const hitLoserGoals = (realWinner === 'home' && guessAway === realAway) || (realWinner === 'away' && guessHome === realHome);
    if (hitLoserGoals) return 12;
    
    // Apenas Vencedor
    return 4;
  }
  
  // Gols de um time certo (mesmo errando o vencedor)
  if (guessHome === realHome || guessAway === realAway) return 3;
  
  // Nenhum acerto
  return 0;
}
