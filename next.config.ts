import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fully static client SPA (data comes from the separate Hono API over HTTP),
  // so we export to static HTML. This produces ZERO serverless functions, which
  // keeps the deployment under Vercel's Hobby 12-function limit. Any dynamic
  // detail views read their id from the query string (e.g. /accounts/view?id=).
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
