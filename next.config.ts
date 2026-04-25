import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/Matrix",
  assetPrefix: "/Matrix",
  trailingSlash: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: "/Matrix",
    NEXT_PUBLIC_DEFAULT_HOMESERVER: "https://matrix.example.com",
  },
  serverExternalPackages: ["matrix-js-sdk", "@matrix-org/matrix-sdk-crypto-wasm"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; connect-src 'self' https://matrix.example.com; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https: data:; media-src 'self' blob: https:; font-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
