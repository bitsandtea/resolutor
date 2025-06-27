/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    FLOW_ACCOUNT_ADDRESS: process.env.FLOW_ACCOUNT_ADDRESS || "",
    FLOW_PRIVATE_KEY: process.env.FLOW_PRIVATE_KEY || "",
    FLOW_PRIVATE_KEY_INDEX: process.env.FLOW_PRIVATE_KEY_INDEX || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    WEB3_STORAGE_TOKEN: process.env.WEB3_STORAGE_TOKEN || "",
    DATABASE_URL: process.env.DATABASE_URL || "",
  },
  experimental: {
    optimizeCss: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Suppress pino warnings in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Suppress pino-pretty warnings
    config.externals = config.externals || [];
    config.externals.push("pino-pretty");

    return config;
  },
};

module.exports = nextConfig;
