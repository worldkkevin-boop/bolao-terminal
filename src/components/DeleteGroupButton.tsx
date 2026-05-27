'use client'

import { useState } from 'react'
import { deleteGroup } from '@/app/groups/[id]/actions'

export default function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    await deleteGroup(groupId)
    // redirect() é chamado pela action — esse ponto só é atingido em caso de erro
    setLoading(false)
    setConfirming(false)
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-[#ff3d57] border border-[#ff3d57]/50 px-2 py-1 hover:bg-[#ff3d57] hover:text-white transition"
      >
        Excluir Bolão
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-[#1f1215] border border-[#ff3d57]/50 px-3 py-1.5 rounded">
      <span className="text-xs text-[#ff3d57] font-bold">Tem certeza?</span>
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="text-[10px] font-bold px-3 py-1 bg-[#ff3d57] text-white rounded hover:bg-red-400 transition disabled:opacity-50"
      >
        {loading ? 'Excluindo...' : 'Sim, excluir'}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={loading}
        className="text-[10px] font-bold px-3 py-1 border border-[#2a3140] text-[#8b94a8] rounded hover:border-white hover:text-white transition"
      >
        Cancelar
      </button>
    </div>
  )
}
