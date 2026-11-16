/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Linting is its own Nx target (`nx lint web`), run by CI and the
  // pre-commit hook; no need to repeat it inside `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Minimal, self-contained server bundle for the Docker image.
  output: 'standalone',
};

export default nextConfig;
