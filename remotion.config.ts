// Remotion config — used by `npx remotion studio` and `npx remotion lambda sites create`.
// Does not affect the Next.js app (Next never imports the remotion/ folder).
import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setConcurrency(1)
