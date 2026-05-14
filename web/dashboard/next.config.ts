import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root so the monorepo's outer lockfile doesn't
  // confuse Turbopack's auto-detection.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
