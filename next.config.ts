import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Single deployment: the client-SPA pages prerender as static content (0
  // functions) and the Hono API is mounted as one Vercel Function via the
  // /api catch-all route, keeping us well under Vercel's Hobby 12-function cap.
  images: { unoptimized: true },
};

export default nextConfig;
