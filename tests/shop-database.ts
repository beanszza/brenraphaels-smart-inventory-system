import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

/** Each suite owns a disposable real PostgreSQL cluster, never DATABASE_URL from .env. */
export async function startShopDatabase() {
  const bin = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
  const dir = mkdtempSync(path.join(tmpdir(), "ims-stock-test-"));
  const port = await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
  const run = (name: string, args: string[]) => execFileSync(path.join(bin, name), args, { stdio: "pipe" });
  run("initdb", ["-D", dir, "-A", "trust", "-U", "ims_test", "--no-sync"]);
  run("pg_ctl", ["-D", dir, "-l", path.join(dir, "server.log"), "-o", `-p ${port} -h 127.0.0.1 -k ${dir} -F`, "start"]);
  const url = `postgresql://ims_test@127.0.0.1:${port}/postgres`;
  const close = () => {
    run("pg_ctl", ["-D", dir, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
      env: { ...process.env, DATABASE_URL: url }, stdio: "pipe",
    });
  } catch (error) { close(); throw error; }
  run("psql", [url, "-v", "ON_ERROR_STOP=1", "-c", 'DROP TABLE "ShopStockLines", "ShopStockAuditOutbox", "ShopStockSnapshots"']);
  for (let i = 0; i < 2; i++) run("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", "prisma/sql/shop-stock.sql"]);
  return { url, close };
}
