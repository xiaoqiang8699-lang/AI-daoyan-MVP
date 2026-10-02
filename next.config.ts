import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["192.168.0.121"],
  devIndicators: false,
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
};
export default nextConfig;
