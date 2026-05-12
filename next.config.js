const { execSync } = require('child_process')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  generateBuildId: async () => {
    return execSync('git rev-parse HEAD').toString().trim()
  },
}

module.exports = nextConfig
