import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Tell Next.js the monorepo root so file-tracing works correctly with
  // the shared lockfile at the repo root.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // In development the Next.js dev server proxies /api/* and /socket.io/*
  // to the local Fastify instance. In production nginx handles the same
  // proxying at the EC2 / Vercel edge layer, so no rewrites are needed there.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return []
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
    return [
      { source: '/api/:path*',      destination: `${api}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${api}/socket.io/:path*` },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
    ],
  },

  // Produce a self-contained build when deploying to Docker on EC2.
  // Set OUTPUT=standalone in the environment to enable; omit for Vercel.
  ...(process.env.OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
}

export default nextConfig
