/** Serializable shapes the Dashboard widgets render. Every figure comes from the IMS database. */
export type Urgency = "High" | "Medium" | "Low";

export type Kpi = { value: number; unit: string; /** Month-over-month change in percent; null when there is no earlier period to compare. */ trend: number | null };

export type DashboardKpis = {
  activeInventory: Kpi | null;
  lowStockAlerts: Kpi | null;
  productionBatches: Kpi | null;
  activeSuppliers: Kpi | null;
};

export type CategorySlice = { name: string; value: number; color: string };
export type ProcurementMonth = { month: string; orders: number; valueK: number };
export type QualitySlice = { name: string; value: number; color: string };
export type SupplierScore = { supplier: string; avgLeadDays: number; onTimeRate: number; defectRate: number };
export type BranchFlow = { branch: string; transfers: number; received: number };

export type ProcurementRecommendation = {
  id: string;
  item: string;
  supplier: string;
  recommendedQty: number;
  unit: string;
  urgency: Urgency;
  reason: string;
};

export type InventoryForecast = {
  sku: string;
  item: string;
  currentStock: number;
  unit: string;
  forecastedDemand: number;
  daysRemaining: number;
  urgency: Urgency;
};

/** A section is null when the signed-in Staff does not hold the Module that owns its data. */
export type DashboardAnalytics = {
  generatedAt: string;
  kpis: DashboardKpis;
  inventoryDistribution: CategorySlice[] | null;
  procurementTrend: ProcurementMonth[] | null;
  productionQuality: QualitySlice[] | null;
  supplierPerformance: SupplierScore[] | null;
  distribution: BranchFlow[] | null;
  procurementRecommendations: ProcurementRecommendation[] | null;
  inventoryForecasts: InventoryForecast[] | null;
};

