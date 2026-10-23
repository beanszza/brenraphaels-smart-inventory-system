import type { NextRequest } from "next/server";
import { callback } from "@/lib/portal/handoff";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  return callback(request);
}
