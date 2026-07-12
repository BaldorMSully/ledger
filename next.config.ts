import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the NAS's Docker deployment (small self-contained runtime,
  // no need for the full node_modules tree in the final image).
  output: "standalone",
};

export default nextConfig;
