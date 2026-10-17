import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pg",
    "pg-types",
    "pg-pool",
    "pg-protocol",
    "pg-connection-string",
    "pgpass",
    "postgres-array",
    "postgres-bytea",
    "postgres-date",
    "postgres-interval",
  ],
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://neondb_owner:npg_baVm3rz1LYpg@ep-falling-block-axoykj3b-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require",
    AUTH_SECRET:
      process.env.AUTH_SECRET ||
      "/k61dCV/sZHWk/+qSz9vKNeL9kf3xV100wKZ5NfJcIY=",
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "true",
    AUTH_URL:
      process.env.AUTH_URL ||
      "https://main.d3tum10bqcbo66.amplifyapp.com",
  },
  async redirects() {
    return [
      // "Transactions Board" and "Transactions" were consolidated into one
      // nav item ("Transactions", at /transactions, showing the unified
      // board) -- keep old links/bookmarks to the board working.
      {
        source: "/transactions-board",
        destination: "/transactions",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
