/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), browsing-topics=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            // Camera/mic are consumed via getUserMedia (not <iframe>), so no
            // frame-src needed. MediaPipe loads its WASM bundle from jsdelivr
            // and model assets from Google Storage.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://storage.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
              "img-src 'self' blob: data: https://*.supabase.co https://cdn.jsdelivr.net https://unpkg.com",
              "media-src 'self' blob:",
              "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net https://unpkg.com https://storage.googleapis.com",
              "worker-src 'self' blob:",
              "font-src 'self' https://cdn.jsdelivr.net https://unpkg.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
