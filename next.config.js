const nextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'icons.duckduckgo.com',
      },
    ],
  },
}

module.exports = nextConfig
