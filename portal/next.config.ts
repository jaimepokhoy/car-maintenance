import path from 'node:path';

import type { NextConfig } from 'next';

// The portal imports the app's pure domain code from ../src/domain (see
// lib/domain.ts). Turbopack only compiles files inside its root, so the root
// is the repo, not this folder. Dependencies still come from portal/node_modules.
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
