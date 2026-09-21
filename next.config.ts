import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/computo-aac",
  trailingSlash: true,
  images: { unoptimized: true },
  // Preserve the existing build policy: known unrelated type errors are tracked separately.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
