import { Composition } from 'remotion'
import { CaptionedClip, type CaptionedClipProps } from './CaptionedClip'
import { TimelineVideo, type TimelineVideoProps } from './TimelineVideo'

const FPS = 30
const WIDTH = 1080
const HEIGHT = 1920 // vertical Reel/Short default

const defaultProps: CaptionedClipProps = {
  mp4Url: '',
  trimStartSec: 0,
  trimEndSec: 10,
  captions: [],
  captionStyle: 'tiktok',
}

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="CaptionedClip"
        component={CaptionedClip}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={({ props }: { props: CaptionedClipProps }) => {
          const start = Math.max(0, props.trimStartSec ?? 0)
          const end = props.trimEndSec ?? start + 10
          const seconds = Math.max(1, end - start)
          return { durationInFrames: Math.round(seconds * FPS), fps: FPS, width: WIDTH, height: HEIGHT }
        }}
      />
      <Composition
        id="TimelineVideo"
        component={TimelineVideo}
        durationInFrames={FPS * 10}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ clips: [], captions: [], captionStyle: 'tiktok' } as TimelineVideoProps}
        calculateMetadata={({ props }: { props: TimelineVideoProps }) => {
          const seconds = props.clips.reduce((s, c) => s + Math.max(0, c.outSec - c.inSec), 0)
          return { durationInFrames: Math.max(1, Math.round(seconds * FPS)), fps: FPS, width: WIDTH, height: HEIGHT }
        }}
      />
    </>
  )
}
