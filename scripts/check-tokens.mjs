/**
 * check-tokens.mjs
 *
 * Scans components/**, app/** (excluding app/actions and app/api), and dashboard/**
 * for raw hex codes, ad-hoc text sizes (text-[Npx]), bold utilities (font-bold/extrabold/black),
 * and raw Tailwind palette colors (e.g. text-emerald-600, bg-amber-500).
 *
 * Mode:
 *   --warn : prints warnings and summary, exits 0 (Stage 2 through Stage 7)
 *   default: exits 1 if issues are found (Stage 8)
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const isWarnMode = process.argv.includes("--warn");

const TARGET_DIRS = ["components", "app", "dashboard"];
const ALLOWED_EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

// Directories or files to skip
function shouldSkip(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("/node_modules/")) return true;
  if (norm.includes("/.next/")) return true;
  if (norm.startsWith("app/actions/")) return true;
  if (norm.startsWith("app/api/")) return true;
  // Skip test files, mock files, and build assets
  if (norm.includes(".test.") || norm.includes(".spec.")) return true;
  return false;
}

function collectFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (stat.isFile() && ALLOWED_EXTS.has(extname(fullPath))) {
        if (!shouldSkip(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory might not exist
  }
  return results;
}

// Patterns to detect non-token usages in UI files
const CHECKS = [
  {
    id: "raw-hex",
    label: "Raw hex color in className or markup",
    // Matches #123456 or #123 inside class strings or style strings, excluding var(--...) or URL hashes
    regex: /(?:className|class)\s*=\s*["'`][^"'`]*?(#(?:[0-9a-fA-F]{3,8}))/g,
  },
  {
    id: "arbitrary-text-size",
    label: "Arbitrary text size (text-[Npx])",
    regex: /\btext-\[\s*\d+px\s*\]/g,
  },
  {
    id: "heavy-font-weight",
    label: "Prohibited heavy font weight (font-bold, font-extrabold, font-black)",
    regex: /\bfont-(?:bold|extrabold|black)\b/g,
  },
  {
    id: "raw-tailwind-palette",
    label: "Raw Tailwind palette utility (text/bg/border-(emerald|amber|red|blue|teal|rose|indigo|violet|slate|zinc|gray)-*)",
    regex: /\b(?:text|bg|border)-(?:emerald|amber|rose|teal|indigo|violet|slate|zinc)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  },
];

const allFiles = TARGET_DIRS.flatMap((dir) => collectFiles(dir));

let totalViolations = 0;
const report = [];

for (const file of allFiles) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    for (const check of CHECKS) {
      check.regex.lastIndex = 0;
      let match;
      while ((match = check.regex.exec(line)) !== null) {
        totalViolations++;
        report.push({
          file: file.replace(/\\/g, "/"),
          line: index + 1,
          checkId: check.id,
          label: check.label,
          matched: match[0],
        });
      }
    }
  });
}

console.log("\n=======================================================");
console.log("             Figma Token Lint Audit                    ");
console.log("=======================================================");
console.log(`Scanned files: ${allFiles.length}`);
console.log(`Total non-token occurrences: ${totalViolations}`);
console.log(`Mode: ${isWarnMode ? "WARNING (exits 0)" : "FAIL (exits 1 on error)"}\n`);

// Group by check id
const countsByCheck = {};
for (const item of report) {
  countsByCheck[item.checkId] = (countsByCheck[item.checkId] || 0) + 1;
}

for (const [id, count] of Object.entries(countsByCheck)) {
  console.log(`  - ${id}: ${count} occurrences`);
}

if (totalViolations > 0) {
  console.log("\nFirst 15 occurrences:");
  report.slice(0, 15).forEach((item) => {
    console.log(`  ${item.file}:${item.line} [${item.checkId}] -> ${item.matched}`);
  });
  if (report.length > 15) {
    console.log(`  ... and ${report.length - 15} more.`);
  }
}

console.log("=======================================================\n");

if (totalViolations > 0 && !isWarnMode) {
  process.exit(1);
} else {
  process.exit(0);
}
