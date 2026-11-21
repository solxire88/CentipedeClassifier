import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Links shared before the landing page existed opened the classifier at "/".
  async redirects() {
    return [
      { source: "/", has: [{ type: "query", key: "load", value: "(?<load>.+)" }, { type: "query", key: "model", value: "(?<model>.+)" }], destination: "/classify?load=:load&model=:model", permanent: false },
      { source: "/", has: [{ type: "query", key: "load", value: "(?<load>.+)" }], destination: "/classify?load=:load", permanent: false },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
