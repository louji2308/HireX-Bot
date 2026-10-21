import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // An unrelated lockfile lives in the parent directory; pin tracing to this project.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
