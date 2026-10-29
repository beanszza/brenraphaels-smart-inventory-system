import { NextRequest } from "next/server";
import { POST as handlePosLocationsSync } from "@/app/api/pos/locations/sync/route";

export async function POST(req: NextRequest) {
  return handlePosLocationsSync(req);
}
