'use client'

import { useState } from 'react'

export default function CopyInviteButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback silencioso — clipboard pode não estar disponível em HTTP
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-[10px] font-bold tracking-wider px-3 py-1 border rounded transition-all font-mono ${
        copied
          ? 'border-[#00d68f] text-[#00d68f]'
          : 'border-[#2a3140] text-[#5d6678] hover:border-[#ffb547] hover:text-[#ffb547]'
      }`}
    >
      {copied ? '✓ COPIADO' : '🔗 COPIAR LINK'}
    </button>
  )
}
