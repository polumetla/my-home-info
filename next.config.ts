import type { NextConfig } from "next";

/**
 * Hosting: Vercel hobby tier is $0 for personal projects and runs this stack well.
 * For GoDaddy-style static hosting only, set NEXT_STATIC_EXPORT=true and uncomment
 * `output: "export"`. That disables API routes and server features—fine for early CMS-as-files.
 *
 * Mobile (Capacitor / Cordova): simplest path is a native shell that loads your HTTPS site in a WebView (one codebase). For offline-first, use static export + client data only.
 */
const nextConfig: NextConfig = {
  // output: process.env.NEXT_STATIC_EXPORT === "true" ? "export" : undefined,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/school", destination: "/schools", permanent: true },
      { source: "/property", destination: "/homes", permanent: true },
    ];
  },
};

export default nextConfig;
