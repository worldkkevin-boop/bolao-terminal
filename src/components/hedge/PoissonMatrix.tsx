'use client'

import { useState } from 'react'
import { buildScoreMatrix, aggregateOutcomes, expectedValue } from '@/utils/hedgeMath'
import TournamentMode from './TournamentMode'

export default function PoissonMatrix() {
  const [lambdaHome, setLambdaHome] = useState<number>(1.4)
  const [lambdaAway, setLambdaAway] = useState<number>(1.2)

  const matrix = buildScoreMatrix(lambdaHome, lambdaAway, 4)
  const outcomes = aggregateOutcomes(matrix)
  
  // Achar o palpite de maior EV
  let bestEV = 0
  let bestGuess = { h: 0, a: 0 }
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const ev = expectedValue(i, j, matrix)
      if (ev > bestEV) {
        bestEV = ev
        bestGuess = { h: i, a: j }
      }
    }
  }

  return (
    <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded-xl">
      <div className="flex gap-4 mb-6">
        <div>
          <label className="text-[10px] tracking-widest text-[#5d6678] block mb-1">λ CASA</label>
          <input 
            type="number" step="0.1" 
            value={lambdaHome} onChange={e => setLambdaHome(Number(e.target.value))}
            className="bg-[#08090b] border border-[#2a3140] text-white px-3 py-2 rounded text-sm w-24"
          />
        </div>
        <div>
          <label className="text-[10px] tracking-widest text-[#5d6678] block mb-1">λ FORA</label>
          <input 
            type="number" step="0.1" 
            value={lambdaAway} onChange={e => setLambdaAway(Number(e.target.value))}
            className="bg-[#08090b] border border-[#2a3140] text-white px-3 py-2 rounded text-sm w-24"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-center text-sm">
        <div className="bg-[#1f242e] p-3 rounded">
          <div className="text-[10px] text-[#00c2ff] tracking-widest mb-1">CASA</div>
          <div className="font-bold text-white">{(outcomes.home * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-[#1f242e] p-3 rounded">
          <div className="text-[10px] text-[#8b94a8] tracking-widest mb-1">EMPATE</div>
          <div className="font-bold text-white">{(outcomes.draw * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-[#1f242e] p-3 rounded">
          <div className="text-[10px] text-[#ff3d57] tracking-widest mb-1">FORA</div>
          <div className="font-bold text-white">{(outcomes.away * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[10px] tracking-widest text-[#00d68f] mb-2 uppercase">Palpite Matemático Ideal (Máximo EV)</div>
        <div className="text-xl font-bold text-white">
          {bestGuess.h} x {bestGuess.a} <span className="text-sm text-[#8b94a8] font-normal ml-2">({bestEV.toFixed(2)} pts esperados)</span>
        </div>
      </div>

      <TournamentMode lambdaHome={lambdaHome} lambdaAway={lambdaAway} />
    </div>
  )
}
