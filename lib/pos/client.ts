import { SyncProductDto, PosBranchLocationDto, PosTransferManifestDto } from "./types";

export function getPosApiBaseUrl(): string {
  const url = process.env.POS_API_BASE_URL || "https://api-pos-sb5g.onrender.com";
  return url.replace(/\/+$/, "");
}

export function getScmsServiceKey(): string {
  return (
    process.env.POS_API_KEY ||
    process.env.SCMS_SERVICE_KEY ||
    "a31ce48e7b36fdf1d5b7e2c8102ec27829af653baa1ebb0b865cb8be8e2e73a9"
  );
}

export function posRequestHeaders(additional?: Record<string, string>): HeadersInit {
  const key = getScmsServiceKey();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${key}`,
    "X-Service-Key": key,
    "X-Source-System": "SCMS",
    "X-Correlation-ID": crypto.randomUUID(),
    ...additional,
  };
}

/**
 * Resilient fetch wrapper with 60s timeout and exponential backoff retry.
 * Handles Render free-tier cold starts and transient network hiccups.
 * Does not retry client errors (400, 401, 404).
 */
async function posFetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  const delays = [1000, 2000, 4000];
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(url, {
        ...options,
        // 60-second timeout for Render free tier wakeups
        signal: AbortSignal.timeout(60000),
      });

      // Never retry 2xx or 4xx client errors (400, 401, etc.)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Retry on 5xx server errors if retry attempts remain
      if (attempt < retries) {
        const delay = delays[attempt] || 4000;
        attempt++;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      // Retry on network errors or timeouts if retry attempts remain
      if (attempt < retries) {
        const delay = delays[attempt] || 4000;
        attempt++;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Pushes product and variation catalog data to the Point-of-Sale (POS) system.
 * POST /api-pos/product-catalog/sync-product
 */
export async function syncProductToPos(
  dto: SyncProductDto
): Promise<{ success: boolean; message: string; data?: any }> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return { success: true, message: "Skipped POS sync in test environment." };
  }

  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}/api-pos/product-catalog/sync-product`;

  try {
    const res = await posFetchWithRetry(url, {
      method: "POST",
      headers: posRequestHeaders(),
      body: JSON.stringify(dto),
    });

    const responseText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { message: responseText };
    }

    if (!res.ok) {
      return {
        success: false,
        message:
          parsed?.message || `POS responded with HTTP ${res.status}: ${res.statusText}`,
        data: parsed,
      };
    }

    return {
      success: true,
      message: parsed?.message || "Product synced to POS successfully.",
      data: parsed?.data || parsed,
    };
  } catch (error: any) {
    console.error(`[POS-SYNC-ERROR] Failed to send product "${dto.productName}" to POS:`, error);
    return {
      success: false,
      message: error?.message || "Failed to reach POS service.",
    };
  }
}

/**
 * Attempts to fetch active store branch locations directly from the POS service.
 */
export async function fetchLocationsFromPos(): Promise<{
  success: boolean;
  locations?: PosBranchLocationDto[];
  message?: string;
}> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return { success: true, locations: [] };
  }

  const baseUrl = getPosApiBaseUrl();
  const candidateUrls = [
    `${baseUrl}/api-pos/branches`,
    `${baseUrl}/api-pos/locations`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await posFetchWithRetry(url, {
        method: "GET",
        headers: posRequestHeaders(),
      });

      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body?.branches)
          ? body.branches
          : Array.isArray(body?.locations)
          ? body.locations
          : null;

        if (list) {
          const locations: PosBranchLocationDto[] = list.map((b: any) => ({
            locationId: Number(b.locationId || b.branchId || b.id),
            locationName: String(b.locationName || b.branchName || b.name || "Branch"),
            locationType: "Branch",
            address: b.address || "",
            isActive: b.isActive ?? true,
          }));
          return { success: true, locations };
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return {
    success: false,
    message: "Could not retrieve branch list from POS endpoints.",
  };
}

/**
 * Posts an Advanced Shipping Notice (ASN) / Stock Transfer manifest to POS when SCMS dispatches goods.
 * POST /api-pos/transfers
 */
export async function dispatchTransferManifestToPos(
  dto: PosTransferManifestDto
): Promise<{ success: boolean; message: string; data?: any }> {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return { success: true, message: "Skipped POS transfer manifest post in test environment." };
  }

  const baseUrl = getPosApiBaseUrl();
  const url = `${baseUrl}/api-pos/transfers`;

  try {
    const res = await posFetchWithRetry(url, {
      method: "POST",
      headers: posRequestHeaders(),
      body: JSON.stringify(dto),
    });

    const responseText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { message: responseText };
    }

    if (!res.ok) {
      return {
        success: false,
        message: parsed?.message || `POS responded with HTTP ${res.status}: ${res.statusText}`,
        data: parsed,
      };
    }

    return {
      success: true,
      message: parsed?.message || "Transfer manifest successfully sent to POS.",
      data: parsed?.data || parsed,
    };
  } catch (error: any) {
    console.error(`[POS-TRANSFER-DISPATCH-ERROR] Failed to post transfer ${dto.transferId} to POS:`, error);
    return {
      success: false,
      message: error?.message || "Failed to reach POS transfer service.",
    };
  }
}
