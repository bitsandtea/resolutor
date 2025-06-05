/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    FLOW_ACCOUNT_ADDRESS: process.env.FLOW_ACCOUNT_ADDRESS,
    FLOW_PRIVATE_KEY: process.env.FLOW_PRIVATE_KEY,
    FLOW_PRIVATE_KEY_INDEX: process.env.FLOW_PRIVATE_KEY_INDEX,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    WEB3_STORAGE_TOKEN: process.env.WEB3_STORAGE_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

module.exports = nextConfig;
