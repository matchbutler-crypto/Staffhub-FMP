/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`
  },
}

module.exports = nextConfig
