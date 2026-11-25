import { NextResponse } from "next/server";
import { accessibleSystems } from "@/lib/portal/systems";

export const dynamic = "force-dynamic";

/** The Systems this person may open, for the module switcher. `null` means unknown. */
export async function GET(request: Request) {
  return NextResponse.json({ systems: await accessibleSystems(request.url) }, { headers: { "cache-control": "no-store" } });
}
