import mediaManager from '@/services/media-manager.service'

export default function AudioPlayer({ src, className }: { src: string; className?: string }) {
  return (
    <audio
      controls
      playsInline
      className={className}
      src={src}
      onClick={(e) => e.stopPropagation()}
      onPlay={(event) => {
        mediaManager.play(event.currentTarget)
      }}
    />
  )
}
