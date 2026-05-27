'use client'

import { useState } from 'react'
import { buildScoreMatrix, pickTournamentPalpites } from '@/utils/hedgeMath'

export default function TournamentMode({ lambdaHome, lambdaAway }: { lambdaHome: number, lambdaAway: number }) {
  const [mode, setMode] = useState('BALANCED')
  
  const matrix = buildScoreMatrix(lambdaHome, lambdaAway, 4)
  const { primary, hedge, zebra } = pickTournamentPalpites(matrix, lambdaHome, lambdaAway, mode)

  return (
    <div className="bg-[#12151b] border border-[#8b5cf6]/40 p-6 rounded-xl mt-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#8b5cf6]"></div>
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[#8b5cf6] font-bold tracking-widest text-[10px] uppercase">🏆 TOURNAMENT ENGINE v3.0</h3>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        <button onClick={() => setMode('SAFE')} className={`text-[10px] tracking-wider py-2 border ${mode === 'SAFE' ? 'bg-[#00d68f] text-black font-bold border-[#00d68f]' : 'border-[#2a3140] text-[#8b94a8] hover:border-[#00d68f]'}`}>DEFESA</button>
        <button onClick={() => setMode('BALANCED')} className={`text-[10px] tracking-wider py-2 border ${mode === 'BALANCED' ? 'bg-[#00c2ff] text-black font-bold border-[#00c2ff]' : 'border-[#2a3140] text-[#8b94a8] hover:border-[#00c2ff]'}`}>BAL</button>
        <button onClick={() => setMode('AGGRESSIVE')} className={`text-[10px] tracking-wider py-2 border ${mode === 'AGGRESSIVE' ? 'bg-[#ffb547] text-black font-bold border-[#ffb547]' : 'border-[#2a3140] text-[#8b94a8] hover:border-[#ffb547]'}`}>ATAQUE</button>
        <button onClick={() => setMode('DESPERATE')} className={`text-[10px] tracking-wider py-2 border ${mode === 'DESPERATE' ? 'bg-[#ff3d57] text-white font-bold border-[#ff3d57]' : 'border-[#2a3140] text-[#8b94a8] hover:border-[#ff3d57]'}`}>ALL-IN</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-[#00d68f] p-4 rounded bg-[#08090b]">
          <div className="text-[10px] tracking-widest text-[#00d68f] mb-2 uppercase">Kevin (Primário)</div>
          <div className="text-3xl font-bold text-white mb-1">{primary.h} x {primary.a}</div>
          <div className="text-xs text-[#5d6678]">Tournament EV: {primary.tev.toFixed(2)}</div>
          <div className="text-[10px] text-[#8b94a8]">Pop: {(primary.pop * 100).toFixed(1)}%</div>
        </div>

        <div className="border border-[#ffb547] p-4 rounded bg-[#08090b]">
          <div className="text-[10px] tracking-widest text-[#ffb547] mb-2 uppercase">Gaby (Hedge)</div>
          <div className="text-3xl font-bold text-white mb-1">{hedge.h} x {hedge.a}</div>
          <div className="text-xs text-[#5d6678]">Tournament EV: {hedge.tev.toFixed(2)}</div>
          <div className="text-[10px] text-[#8b94a8]">Pop: {(hedge.pop * 100).toFixed(1)}%</div>
        </div>

        <div className="border border-[#8b5cf6] p-4 rounded bg-[#08090b]">
          <div className="text-[10px] tracking-widest text-[#8b5cf6] mb-2 uppercase">Zebra (Cisne Negro)</div>
          <div className="text-3xl font-bold text-white mb-1">{zebra.h} x {zebra.a}</div>
          <div className="text-xs text-[#5d6678]">Tournament EV: {zebra.tev.toFixed(2)}</div>
          <div className="text-[10px] text-[#8b94a8]">Pop: {(zebra.pop * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}
