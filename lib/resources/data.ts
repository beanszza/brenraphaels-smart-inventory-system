import type { SupplyItem, Supplier, Recipe, FinishedProduct, UomOption } from "@/components/resources-suppliers/types";
import type { SupplyCategory } from "@/components/resources-suppliers/SupplyModal";

export type ResourcesData = {
  supplies: SupplyItem[];
  suppliers: Supplier[];
  recipes: Recipe[];
  products: FinishedProduct[];
  categories: SupplyCategory[];
  units: UomOption[];
};
