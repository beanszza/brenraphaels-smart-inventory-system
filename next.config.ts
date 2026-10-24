import type { NextConfig } from "next";

// Maps PascalCase C# controller names (used by frontend-scms) to the
// kebab-case Next.js App Router paths in this app.
// Frontend calls e.g. /api/Items, /api/PurchaseOrders → rewrite to /api/items, /api/purchase-orders
const pascalToKebabAliases = [
  { pascal: "Inventory",              kebab: "inventory" },
  { pascal: "StockTransfers",         kebab: "stock-transfers" },
  { pascal: "CycleCounts",            kebab: "cycle-counts" },
  { pascal: "Traceability",           kebab: "traceability" },
  { pascal: "Valuation",              kebab: "valuation" },
  { pascal: "Lots",                   kebab: "inventory" }, // Lots are part of inventory
];

const nextConfig: NextConfig = {
  async rewrites() {
    const aliases = pascalToKebabAliases.flatMap(({ pascal, kebab }) => [
      // Exact match: /api/Items → /api/items
      {
        source: `/api/${pascal}`,
        destination: `/api/${kebab}`,
      },
      // With sub-path: /api/Items/:path* → /api/items/:path*
      {
        source: `/api/${pascal}/:path*`,
        destination: `/api/${kebab}/:path*`,
      },
    ]);

    return {
      beforeFiles: [
        // Strip legacy /api/scms/api/ or /api/scms/ prefix if called
        {
          source: "/api/scms/api/:path*",
          destination: "/api/:path*",
        },
        {
          source: "/api/scms/:path*",
          destination: "/api/:path*",
        },
        ...aliases,
      ],
    };
  },
};

export default nextConfig;
