import { describe, it, expect } from "vitest";
import {
  validateSwoInput,
  hasAnySwoErrors,
  firstSwoErrorMessage,
  SWO_MAX_ITEMS,
  type LotAvailabilityMap,
} from "@/lib/inventory/write-off-validation";

const sampleLotMap: LotAvailabilityMap = {
  101: {
    availableQuantity: 50,
    uomName: "kg",
    lotCode: "LOT-UBE-001",
    itemId: 10,
  },
  102: {
    availableQuantity: 25.5,
    uomName: "kg",
    lotCode: "LOT-UBE-002",
    itemId: 10,
  },
  201: {
    availableQuantity: 100,
    uomName: "pcs",
    lotCode: "LOT-JAR-001",
    itemId: 20,
  },
};

describe("Stock Write-Off Input Validation", () => {
  it("accepts a valid request with multiple lots for an item", () => {
    const errors = validateSwoInput(
      {
        generalRemarks: "Monthly expired & damaged write-off",
        items: [
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 101,
                quantity: 20,
                reason: "Expired",
                disposition: "Disposal / Destruction",
                remarks: "Past expiration date on packaging",
              },
              {
                lotId: 102,
                quantity: 10.5,
                reason: "Damaged",
                disposition: "Animal Feed / Composting",
                remarks: "Torn sack during storage handling",
              },
            ],
          },
        ],
      },
      sampleLotMap
    );

    expect(hasAnySwoErrors(errors)).toBe(false);
    expect(firstSwoErrorMessage(errors)).toBeNull();
  });

  it("rejects affected quantity exceeding available lot quantity (e.g. lot has 50, input 60)", () => {
    const errors = validateSwoInput(
      {
        items: [
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 101,
                quantity: 60,
                reason: "Expired",
                disposition: "Disposal / Destruction",
                remarks: "Expired batch in warehouse",
              },
            ],
          },
        ],
      },
      sampleLotMap
    );

    expect(hasAnySwoErrors(errors)).toBe(true);
    expect(errors.items[0].lots[0].quantity).toContain("Exceeds available quantity (50 kg)");
  });

  it("rejects more than 5 items in a single request", () => {
    const sixItems = Array.from({ length: SWO_MAX_ITEMS + 1 }, (_, idx) => ({
      itemType: "Raw Materials",
      itemId: idx + 1,
      lots: [
        {
          lotId: idx + 500,
          quantity: 1,
          reason: "Damaged",
          disposition: "Disposal / Destruction",
          remarks: "Damaged container",
        },
      ],
    }));

    const errors = validateSwoInput({ items: sixItems });
    expect(hasAnySwoErrors(errors)).toBe(true);
    expect(errors.formError).toContain(`at most ${SWO_MAX_ITEMS} items`);
  });

  it("rejects duplicate items across item cards and duplicate lots", () => {
    const errors = validateSwoInput(
      {
        items: [
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 101,
                quantity: 5,
                reason: "Damaged",
                disposition: "Disposal / Destruction",
                remarks: "Water damage on outer bag",
              },
              {
                lotId: 101,
                quantity: 5,
                reason: "Damaged",
                disposition: "Disposal / Destruction",
                remarks: "Duplicate lot selection",
              },
            ],
          },
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 102,
                quantity: 5,
                reason: "Spoiled",
                disposition: "Disposal / Destruction",
                remarks: "Spoiled lot",
              },
            ],
          },
        ],
      },
      sampleLotMap
    );

    expect(hasAnySwoErrors(errors)).toBe(true);
    expect(errors.items[0].lots[1].lotId).toContain("already selected");
    expect(errors.items[1].itemId).toContain("already added");
  });

  it("enforces whole numbers for count units (pcs) and max 3 decimals for weight units", () => {
    const errors = validateSwoInput(
      {
        items: [
          {
            itemType: "Tools and Supplies",
            itemId: 20,
            lots: [
              {
                lotId: 201,
                quantity: 3.5,
                reason: "Defective",
                disposition: "Return to Supplier",
                remarks: "Cracked glass jars",
              },
            ],
          },
        ],
      },
      sampleLotMap
    );

    expect(hasAnySwoErrors(errors)).toBe(true);
    expect(errors.items[0].lots[0].quantity).toContain("whole number");
  });

  it("requires custom text when 'Other' is selected for reason or disposition", () => {
    const errors = validateSwoInput(
      {
        items: [
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 101,
                quantity: 5,
                reason: "Other",
                reasonOther: "",
                disposition: "Other",
                dispositionOther: "ab",
                remarks: "Special write-off case",
              },
            ],
          },
        ],
      },
      sampleLotMap
    );

    expect(hasAnySwoErrors(errors)).toBe(true);
    expect(errors.items[0].lots[0].reasonOther).toBeDefined();
    expect(errors.items[0].lots[0].dispositionOther).toBeDefined();
  });
});
