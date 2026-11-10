import { useState } from 'react'
import { cn, initials } from '../../lib/utils'

const palettes = [
  ['#e9f8c4', '#3d5a00'],
  ['#ffe1d6', '#8a2f0b'],
  ['#dfe4ff', '#26318c'],
  ['#f8dcf0', '#7c1d62'],
  ['#d6f3ea', '#0d5a42'],
  ['#fff0c2', '#6e4d00'],
  ['#e5ddff', '#47228f'],
]

function paletteFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return palettes[Math.abs(hash) % palettes.length]
}

type AvatarProps = {
  src?: string | null
  name: string
  seed?: string
  size?: number
  className?: string
}

export function Avatar({ src, name, seed, size = 36, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const [bg, fg] = paletteFor(seed ?? name)
  const showImage = src && !failed

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none',
        className,
      )}
      style={{ width: size, height: size, background: showImage ? undefined : bg, color: fg, fontSize: size * 0.38 }}
      aria-hidden={!name}
    >
      {showImage ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span className="tracking-tight">{initials(name)}</span>
      )}
    </span>
  )
}
