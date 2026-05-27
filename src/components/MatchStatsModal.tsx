'use client'

import React, { useState } from 'react'

type MatchStatsModalProps = {
  matchId: number | string
}

export default function MatchStatsModal({ matchId }: MatchStatsModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-[10px] font-bold tracking-widest bg-[#12151b] border border-[#2a3140] text-[#8b94a8] hover:text-white hover:border-[#5d6678] transition px-3 py-1.5 rounded ml-2"
        title="Ver Escalações e Estatísticas"
      >
        📊 ESTATÍSTICAS
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#12151b] border border-[#2a3140] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative">
            <div className="flex justify-between items-center p-4 border-b border-[#1f242e] bg-[#08090b]">
              <h3 className="font-bold text-[#e6eaf2] tracking-widest text-sm">RAIO-X DA PARTIDA</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-[#8b94a8] hover:text-white text-xl p-1 leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {React.createElement('api-sports-widget', {
                'data-type': 'game',
                'data-game-id': matchId,
                'data-team-statistics': 'true',
                'data-player-statistics': 'true',
                'data-events': 'true',
                'data-quarters': 'true'
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
