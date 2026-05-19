/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Renamed from experimental.serverComponentsExternalPackages → stable top-level in Next 15.
  serverExternalPackages: ['mammoth'],
}

export default nextConfig
