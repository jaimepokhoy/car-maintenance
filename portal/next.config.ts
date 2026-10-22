import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The repo root has its own lockfile (the Expo app); the portal is a separate app.
  turbopack: { root: __dirname },
};

export default nextConfig;
