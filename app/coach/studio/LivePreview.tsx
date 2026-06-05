'use client'
import { Player } from '@remotion/player'
import { TimelineVideo, type TimelineVideoProps } from '@/remotion/TimelineVideo'

export function LivePreview({ inputProps, durationInFrames }: { inputProps: TimelineVideoProps; durationInFrames: number }) {
  if (durationInFrames < 1) {
    return <div className="flex aspect-[9/16] w-full max-w-[280px] items-center justify-center rounded-xl border border-white/10 text-sm opacity-60">Add a clip to preview</div>
  }
  return (
    <div className="w-full max-w-[280px]">
      <Player
        component={TimelineVideo}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        fps={30}
        compositionWidth={1080}
        compositionHeight={1920}
        style={{ width: '100%', borderRadius: 12, overflow: 'hidden', aspectRatio: '9 / 16' }}
        controls
        acknowledgeRemotionLicense
      />
    </div>
  )
}
