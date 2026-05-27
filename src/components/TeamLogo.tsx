import Image from 'next/image'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface TeamLogoProps {
  teamId: number
  teamName: string
  size?: Size
}

export default function TeamLogo({ teamId, teamName, size = 'md' }: TeamLogoProps) {
  const dimensions: Record<Size, number> = {
    sm: 24,
    md: 40,
    lg: 64,
    xl: 96,
  }

  const s = dimensions[size]
  const fallback = teamName.substring(0, 2).toUpperCase()

  return (
    <div 
      className="relative flex items-center justify-center shrink-0 rounded-full bg-[#2a3140] text-white"
      style={{ width: s, height: s }}
      title={teamName}
    >
      {/* Fallback caso a imagem falhe (fica por baixo) */}
      <span className="absolute font-bold text-xs">{fallback}</span>
      
      <Image
        src={`https://media.api-sports.io/football/teams/${teamId}.png`}
        alt={teamName}
        width={s}
        height={s}
        loading="lazy"
        unoptimized={true}
        // Se a imagem falhar, a cor do texto herda transparente (esconde o alt) e a gente torce pro browser não zoar muito o bg-white
        className="relative z-10 rounded-full bg-white p-1 object-contain w-full h-full text-transparent"
      />
    </div>
  )
}
