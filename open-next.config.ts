import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cast lets us set OpenNext's top-level `buildCommand`, which is not
// exposed by defineCloudflareConfig's typed surface in 1.19.x.  Without
// this, OpenNext's internal "Build Next.js app" step shells out to
// `npm run build` — and since our `npm run build` invokes OpenNext,
// it recurses indefinitely.  Pinning to `npx next build` runs the
// underlying Next build directly and breaks the loop.
const config = defineCloudflareConfig() as unknown as Record<string, unknown>;
config.buildCommand = "npx next build";

export default config as unknown as ReturnType<typeof defineCloudflareConfig>;
