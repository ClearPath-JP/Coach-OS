import 'server-only'
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client'

/**
 * Remotion Lambda helpers (server-only). Kicks off a captioned-clip render on AWS
 * Lambda and polls its progress. AWS creds come from REMOTION_AWS_ACCESS_KEY_ID /
 * REMOTION_AWS_SECRET_ACCESS_KEY (Remotion reads these from the environment).
 * The function + site are provisioned out-of-band via `npx remotion lambda ...`.
 * Docs: https://www.remotion.dev/docs/lambda/rendermediaonlambda
 */

export type RenderCaption = { text: string; startMs: number; endMs: number }

export type RenderInput = {
  mp4Url: string
  trimStartSec: number
  trimEndSec: number | null
  captions: RenderCaption[]
  captionStyle: 'tiktok' | 'minimal' | 'none'
}

function cfg() {
  const region = process.env.REMOTION_APP_REGION
  const functionName = process.env.REMOTION_APP_FUNCTION_NAME
  const serveUrl = process.env.REMOTION_APP_SERVE_URL
  if (!region || !functionName || !serveUrl) {
    throw new Error('Remotion Lambda not configured (REMOTION_APP_REGION / _FUNCTION_NAME / _SERVE_URL)')
  }
  // region is an AwsRegion union; cast via the call signature to avoid importing it.
  return { region: region as Parameters<typeof renderMediaOnLambda>[0]['region'], functionName, serveUrl }
}

export function remotionConfigured(): boolean {
  return Boolean(
    process.env.REMOTION_APP_REGION &&
      process.env.REMOTION_APP_FUNCTION_NAME &&
      process.env.REMOTION_APP_SERVE_URL &&
      process.env.REMOTION_AWS_ACCESS_KEY_ID &&
      process.env.REMOTION_AWS_SECRET_ACCESS_KEY
  )
}

/** Start a render on Lambda. Returns immediately with the render id + bucket. */
export async function startCaptionedRender(input: RenderInput): Promise<{ renderId: string; bucketName: string }> {
  const { region, functionName, serveUrl } = cfg()
  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: 'CaptionedClip',
    inputProps: input,
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    // New AWS accounts cap Lambda concurrency at 10; Remotion fans a render out
    // across many functions and trips "Rate Exceeded". A high framesPerLambda keeps
    // a short clip on 1–2 functions. Lower this once the AWS quota is raised
    // (`npx remotion lambda quotas increase`) for faster renders of long clips.
    framesPerLambda: 1000,
    downloadBehavior: { type: 'download', fileName: 'kindo-clip.mp4' },
  })
  return { renderId, bucketName }
}

export type TimelineRenderInput = {
  clips: {
    mp4Url: string
    inSec: number
    outSec: number
    crop: { x: number; y: number; w: number; h: number } | null
    captionsOn: boolean
  }[]
  captions: { text: string; startMs: number; endMs: number }[]
  captionStyle: 'tiktok' | 'minimal' | 'karaoke' | 'none'
  audio?: { musicUrl: string | null; voiceoverUrl: string | null; volumes: { clip: number; music: number; voiceover: number } }
}

/** Start a multi-clip timeline render on Lambda. Returns immediately with the render id + bucket. */
export async function startTimelineRender(input: TimelineRenderInput): Promise<{ renderId: string; bucketName: string }> {
  const { region, functionName, serveUrl } = cfg()
  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: 'TimelineVideo',
    inputProps: input,
    codec: 'h264',
    imageFormat: 'jpeg',
    privacy: 'public',
    framesPerLambda: 1000,
    downloadBehavior: { type: 'download', fileName: 'kindo-reel.mp4' },
  })
  return { renderId, bucketName }
}

export type RenderStatus = { done: boolean; progress: number; outputUrl: string | null; error: string | null }

/** Poll a render's progress. `progress` is 0..1. */
export async function getCaptionedRenderStatus(renderId: string, bucketName: string): Promise<RenderStatus> {
  const { region, functionName } = cfg()
  const p = await getRenderProgress({ renderId, bucketName, functionName, region })
  return {
    done: p.done,
    progress: p.overallProgress ?? 0,
    outputUrl: p.outputFile ?? null,
    error: p.fatalErrorEncountered ? (p.errors?.[0]?.message ?? 'Render failed') : null,
  }
}
