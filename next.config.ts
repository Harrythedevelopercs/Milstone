import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
