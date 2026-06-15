import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All pages are dynamic (require auth + DB), skip static generation failures
  output: undefined,
};

export default nextConfig;
