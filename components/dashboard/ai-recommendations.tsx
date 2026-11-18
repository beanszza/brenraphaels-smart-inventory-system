"use client";

import type {
  ProcurementRecommendation as ProcurementRec,
  InventoryForecast,
  Urgency,
} from "@/lib/dashboard/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyChart } from "./EmptyChart";

const URGENCY_VARIANT: Record<Urgency, NonNullable<BadgeProps["variant"]>> = {
  High: "destructive",
  Medium: "warning",
  Low: "success",
};

function UrgencyBadge({ level }: { level: Urgency }) {
  return <Badge variant={URGENCY_VARIANT[level]}>{level}</Badge>;
}

function ProcurementRecommendationCard({
  procurementRecommendations,
}: {
  procurementRecommendations: ProcurementRec[];
}) {
  if (!procurementRecommendations.length) {
    return (
      <EmptyChart
        title="Procurement Recommendations"
        subtitle="Suggested reorders based on stock levels, open orders, and usage"
        message="All active items are above their reorder thresholds."
      />
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col">
      <div className="mb-4">
        <h3 className="type-card-title text-ink">
          Procurement Recommendations
        </h3>
        <p className="type-caption text-ink-muted mt-0.5">
          {procurementRecommendations.length} reorder suggestions based on stock levels, open orders, and usage
        </p>
      </div>

      <div className="overflow-x-auto rounded-inner border border-border">
        <table className="w-full text-left">
          <thead>
            <tr className="table-head-row">
              <th className="table-th px-3.5 py-2.5">
                Item &amp; Basis
              </th>
              <th className="table-th px-3.5 py-2.5">
                Preferred Supplier
              </th>
              <th className="table-th px-3.5 py-2.5 whitespace-nowrap text-right">
                Order Qty
              </th>
              <th className="table-th px-3.5 py-2.5 whitespace-nowrap text-center">
                Urgency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {procurementRecommendations.map((rec) => (
              <tr key={rec.id} className="table-row">
                <td className="table-td px-3.5 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <span className="type-body font-semibold text-ink">
                      {rec.item}
                    </span>
                    <span className="type-caption tabular-nums text-ink-muted">
                      {rec.id}
                    </span>
                  </div>
                  <p className="type-caption text-ink-muted mt-0.5 leading-relaxed">
                    {rec.reason}
                  </p>
                </td>
                <td className="table-td px-3.5 py-3 align-top text-ink-muted max-w-[180px]">
                  <span className="block truncate" title={rec.supplier}>
                    {rec.supplier}
                  </span>
                </td>
                <td className="table-td px-3.5 py-3 align-top text-right type-table-cell font-semibold tabular-nums text-ink whitespace-nowrap">
                  {rec.recommendedQty.toLocaleString()}{" "}
                  <span className="font-normal text-ink-muted">
                    {rec.unit}
                  </span>
                </td>
                <td className="table-td px-3.5 py-3 align-top text-center whitespace-nowrap">
                  <UrgencyBadge level={rec.urgency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InventoryForecastCard({
  inventoryForecasts,
}: {
  inventoryForecasts: InventoryForecast[];
}) {
  if (!inventoryForecasts.length) {
    return (
      <EmptyChart
        title="Inventory Demand Forecast"
        subtitle="30-day stock projection from recent consumption velocity"
        message="No production consumption recorded yet to project from."
      />
    );
  }

  const sorted = [...inventoryForecasts].sort(
    (a, b) => a.daysRemaining - b.daysRemaining,
  );

  return (
    <div className="rounded-card border border-border bg-surface p-5 sm:p-6 flex flex-col">
      <div className="mb-4">
        <h3 className="type-card-title text-ink">
          Inventory Demand Forecast
        </h3>
        <p className="type-caption text-ink-muted mt-0.5">
          30-day projection from production consumption · sorted by days remaining
        </p>
      </div>

      <div className="space-y-3">
        {sorted.map((fc) => {
          const fillPct = Math.min(
            100,
            fc.forecastedDemand > 0
              ? Math.round((fc.currentStock / fc.forecastedDemand) * 100)
              : 100,
          );
          const barClass =
            fc.urgency === "High"
              ? "bg-destructive"
              : fc.urgency === "Medium"
                ? "bg-warning"
                : "bg-success";

          return (
            <div
              key={fc.sku}
              className="rounded-inner border border-border bg-subtle p-3.5 hover:bg-switcher transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="type-caption font-semibold text-ink truncate">
                      {fc.item}
                    </span>
                    <span className="type-caption tabular-nums text-ink-muted shrink-0">
                      {fc.sku}
                    </span>
                  </div>
                  <p className="type-caption text-ink-muted mt-0.5">
                    {fillPct}% of 30-day projected demand covered
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <p className="type-caption font-semibold tabular-nums text-ink">
                      {fc.currentStock.toLocaleString()}{" "}
                      <span className="font-normal text-ink-muted">
                        / {fc.forecastedDemand.toLocaleString()} {fc.unit}
                      </span>
                    </p>
                    <p className="type-caption font-medium tabular-nums text-ink-muted">
                      ~{fc.daysRemaining}d remaining
                    </p>
                  </div>
                  <UrgencyBadge level={fc.urgency} />
                </div>
              </div>

              <div className="h-2 bg-subtle rounded-pill overflow-hidden">
                <div
                  className={`h-full rounded-pill transition-all duration-300 ${barClass}`}
                  style={{ width: `${Math.max(fillPct > 0 ? 4 : 0, fillPct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AiRecommendations({
  procurement,
  forecasts,
}: {
  procurement: ProcurementRec[] | null;
  forecasts: InventoryForecast[] | null;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {procurement && (
        <ProcurementRecommendationCard procurementRecommendations={procurement} />
      )}
      {forecasts && <InventoryForecastCard inventoryForecasts={forecasts} />}
    </div>
  );
}
