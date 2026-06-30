import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Bake the app version + git short SHA into the build so the landing footer can
// show "vX.Y.Z · <sha>" - a quick visual of exactly which build is loaded
// (version alone rarely changes; the SHA distinguishes every commit). Computed
// at config-load time, so `next dev`, `next build`, and the Docker build all
// capture the current HEAD. Falls back gracefully when git/package.json is
// unavailable (e.g. a stripped deployment).
let buildSha = 'dev'
try {
  buildSha = execSync('git rev-parse --short HEAD').toString().trim() || 'dev'
} catch {
  buildSha = 'unknown'
}

let appVersion = '0.0.0'
try {
  appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version
} catch {
  appVersion = '0.0.0'
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Renamed from experimental.serverComponentsExternalPackages -> stable top-level in Next 15.
  serverExternalPackages: ['mammoth'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
}

export default nextConfig
