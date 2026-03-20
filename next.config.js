/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent dev output from clobbering build output (avoids corrupted
  // `.next/server/*manifest.json` leading to 404 + “missing required error components”).
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
};

module.exports = nextConfig;
