import { join } from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting is its own Nx target (`nx lint web`), run by CI and the
  // pre-commit hook; no need to repeat it inside `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Minimal, self-contained server bundle for the Docker image. The tracing
  // root is the monorepo root, where node_modules lives.
  output: 'standalone',
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
};

export default nextConfig;
