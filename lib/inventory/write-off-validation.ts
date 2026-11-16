export const SWO_MAX_ITEMS = 5;
export const SWO_MAX_PHOTOS_PER_ITEM = 5;
export const SWO_REMARKS_MIN = 5;
export const SWO_REMARKS_MAX = 500;
export const SWO_OTHER_MIN = 3;
export const SWO_OTHER_MAX = 100;
export const SWO_GENERAL_REMARKS_MAX = 1000;
export const SWO_ACTION_NOTE_MAX = 500;

export const SWO_REASONS = [
  "Expired",
  "Damaged",
  "Spoiled",
  "Defective",
  "Contaminated",
  "Quality Rejection",
  "Pest Infestation",
  "Lost / Missing",
  "Theft",
  "Recalled",
  "Other",
] as const;

export type SwoReasonChoice = (typeof SWO_REASONS)[number];

export const SWO_DISPOSITIONS = [
  "Disposal / Destruction",
  "Return to Supplier",
  "Rework / Reprocessing",
  "Donation",
  "Animal Feed / Composting",
  "Other",
] as const;

export type SwoDispositionChoice = (typeof SWO_DISPOSITIONS)[number];

export const SWO_STATUSES = [
  "Pending Approval",
  "Approved",
  "Removed",
  "Rejected",
  "Cancelled",
] as const;

export type SwoStatus = (typeof SWO_STATUSES)[number];

const COUNT_UOM_KEYWORDS = [
  "pc",
  "pcs",
  "piece",
  "pieces",
  "pack",
  "packs",
  "box",
  "boxes",
  "jar",
  "jars",
  "bottle",
  "bottles",
  "can",
  "cans",
  "unit",
  "units",
  "bag",
  "bags",
  "roll",
  "rolls",
  "tray",
  "trays",
  "tub",
  "tubs",
  "container",
  "containers",
];

export function isCountUom(uomName?: string | null): boolean {
  if (!uomName) return false;
  const norm = uomName.trim().toLowerCase();
  return COUNT_UOM_KEYWORDS.includes(norm);
}

export function hasMoreThanThreeDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return true;
  const str = String(value);
  const dot = str.indexOf(".");
  if (dot === -1) return false;
  return str.slice(dot + 1).length > 3;
}

export interface SwoLotInput {
  lotId: number;
  quantity: number;
  reason: string;
  reasonOther?: string | null;
  disposition: string;
  dispositionOther?: string | null;
  remarks: string;
}

export interface SwoItemInput {
  itemType: string;
  itemId: number;
  productId?: number | null;
  lots: SwoLotInput[];
}

export interface SwoCreateInput {
  generalRemarks?: string | null;
  items: SwoItemInput[];
}

export interface LotAvailabilityMap {
  [lotId: number]: {
    availableQuantity: number;
    uomName: string;
    lotCode: string;
    itemId: number;
    productId?: number | null;
  };
}

export interface SwoValidationErrors {
  formError?: string;
  generalRemarks?: string;
  items: {
    [itemIndex: number]: {
      itemType?: string;
      itemId?: string;
      lotsError?: string;
      lots: {
        [lotIndex: number]: {
          lotId?: string;
          quantity?: string;
          reason?: string;
          reasonOther?: string;
          disposition?: string;
          dispositionOther?: string;
          remarks?: string;
        };
      };
    };
  };
}

export function hasAnySwoErrors(errors: SwoValidationErrors): boolean {
  if (errors.formError || errors.generalRemarks) return true;
  for (const itemErr of Object.values(errors.items)) {
    if (itemErr.itemType || itemErr.itemId || itemErr.lotsError) return true;
    for (const lotErr of Object.values(itemErr.lots)) {
      if (
        lotErr.lotId ||
        lotErr.quantity ||
        lotErr.reason ||
        lotErr.reasonOther ||
        lotErr.disposition ||
        lotErr.dispositionOther ||
        lotErr.remarks
      ) {
        return true;
      }
    }
  }
  return false;
}

export function firstSwoErrorMessage(errors: SwoValidationErrors): string | null {
  if (errors.formError) return errors.formError;
  if (errors.generalRemarks) return errors.generalRemarks;
  for (const [idxStr, itemErr] of Object.entries(errors.items)) {
    const itemNum = Number(idxStr) + 1;
    if (itemErr.itemType) return `Item ${itemNum}: ${itemErr.itemType}`;
    if (itemErr.itemId) return `Item ${itemNum}: ${itemErr.itemId}`;
    if (itemErr.lotsError) return `Item ${itemNum}: ${itemErr.lotsError}`;
    for (const [lotIdxStr, lotErr] of Object.entries(itemErr.lots)) {
      const lotNum = Number(lotIdxStr) + 1;
      const msg =
        lotErr.lotId ||
        lotErr.quantity ||
        lotErr.reason ||
        lotErr.reasonOther ||
        lotErr.disposition ||
        lotErr.dispositionOther ||
        lotErr.remarks;
      if (msg) return `Item ${itemNum}, Lot ${lotNum}: ${msg}`;
    }
  }
  return null;
}

/**
 * Validates a Stock Write-Off creation payload on both client and server.
 * When `lotMap` is provided, checks each lot's available (unreserved, non-pending) quantity
 * and ownership against the selected item/variant.
 */
export function validateSwoInput(
  input: SwoCreateInput,
  lotMap?: LotAvailabilityMap
): SwoValidationErrors {
  const errors: SwoValidationErrors = { items: {} };

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    errors.formError = "Add at least one inventory item to write off.";
    return errors;
  }

  if (input.items.length > SWO_MAX_ITEMS) {
    errors.formError = `You can write off at most ${SWO_MAX_ITEMS} items in a single request.`;
  }

  const genRemarks = (input.generalRemarks ?? "").trim();
  if (genRemarks.length > SWO_GENERAL_REMARKS_MAX) {
    errors.generalRemarks = `General remarks cannot exceed ${SWO_GENERAL_REMARKS_MAX} characters.`;
  }

  // Track unique lot IDs across the entire request (same item can be added across cards, but lots must be unique)
  const seenLotIds = new Set<number>();

  input.items.forEach((item, itemIdx) => {
    const itemErr: SwoValidationErrors["items"][number] = { lots: {} };
    errors.items[itemIdx] = itemErr;

    const itemType = (item.itemType ?? "").trim();
    if (!itemType) {
      itemErr.itemType = "Select an item type.";
    }

    const itemId = Number(item.itemId);
    const productId = item.productId ? Number(item.productId) : null;
    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
      itemErr.itemId = "Select an inventory item.";
    }

    if (!Array.isArray(item.lots) || item.lots.length === 0) {
      itemErr.lotsError = "Add at least one batch / lot to write off for this item.";
      return;
    }

    item.lots.forEach((lot, lotIdx) => {
      const lotErr: SwoValidationErrors["items"][number]["lots"][number] = {};
      itemErr.lots[lotIdx] = lotErr;

      const lotId = Number(lot.lotId);
      const lotInfo = lotMap && Number.isSafeInteger(lotId) && lotId > 0 ? lotMap[lotId] : undefined;

      if (!Number.isSafeInteger(lotId) || lotId <= 0) {
        lotErr.lotId = "Select a batch / lot number.";
      } else if (seenLotIds.has(lotId)) {
        lotErr.lotId = "This batch / lot is already selected in this request.";
      } else {
        seenLotIds.add(lotId);
        if (lotMap && !lotInfo) {
          lotErr.lotId = "Selected batch / lot is no longer available.";
        } else if (lotInfo && itemId > 0 && lotInfo.itemId !== itemId) {
          lotErr.lotId = "Selected batch / lot does not belong to the chosen item.";
        }
      }

      const qty = Number(lot.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        lotErr.quantity = "Enter an affected quantity greater than 0.";
      } else if (hasMoreThanThreeDecimals(qty)) {
        lotErr.quantity = "Quantity can have at most 3 decimal places.";
      } else if (lotInfo) {
        if (isCountUom(lotInfo.uomName) && !Number.isInteger(qty)) {
          lotErr.quantity = `Quantity for ${lotInfo.uomName} must be a whole number.`;
        } else if (qty > lotInfo.availableQuantity + 1e-9) {
          lotErr.quantity = `Exceeds available quantity (${lotInfo.availableQuantity} ${lotInfo.uomName}).`;
        }
      }

      const reason = (lot.reason ?? "").trim();
      if (!reason || !(SWO_REASONS as readonly string[]).includes(reason)) {
        lotErr.reason = "Select a write-off reason.";
      } else if (reason === "Other") {
        const other = (lot.reasonOther ?? "").trim();
        if (other.length < SWO_OTHER_MIN) {
          lotErr.reasonOther = `Please specify the reason (at least ${SWO_OTHER_MIN} characters).`;
        } else if (other.length > SWO_OTHER_MAX) {
          lotErr.reasonOther = `Specified reason cannot exceed ${SWO_OTHER_MAX} characters.`;
        }
      }

      const disposition = (lot.disposition ?? "").trim();
      if (!disposition || !(SWO_DISPOSITIONS as readonly string[]).includes(disposition)) {
        lotErr.disposition = "Select a disposition method.";
      } else if (disposition === "Other") {
        const other = (lot.dispositionOther ?? "").trim();
        if (other.length < SWO_OTHER_MIN) {
          lotErr.dispositionOther = `Please specify the disposition method (at least ${SWO_OTHER_MIN} characters).`;
        } else if (other.length > SWO_OTHER_MAX) {
          lotErr.dispositionOther = `Specified disposition cannot exceed ${SWO_OTHER_MAX} characters.`;
        }
      }

      const remarks = (lot.remarks ?? "").trim();
      if (!remarks) {
        lotErr.remarks = "Item remarks are required.";
      } else if (remarks.length < SWO_REMARKS_MIN) {
        lotErr.remarks = `Describe the condition in at least ${SWO_REMARKS_MIN} characters.`;
      } else if (remarks.length > SWO_REMARKS_MAX) {
        lotErr.remarks = `Item remarks cannot exceed ${SWO_REMARKS_MAX} characters.`;
      }
    });
  });

  return errors;
}
