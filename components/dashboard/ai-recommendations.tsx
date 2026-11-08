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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">
          Procurement Recommendations
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {procurementRecommendations.length} reorder suggestions based on stock levels, open orders, and usage
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3.5 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">
                Item &amp; Basis
              </th>
              <th className="px-3.5 py-2.5 font-bold text-muted-foreground uppercase tracking-wider">
                Preferred Supplier
              </th>
              <th className="px-3.5 py-2.5 font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap text-right">
                Order Qty
              </th>
              <th className="px-3.5 py-2.5 font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap text-center">
                Urgency
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {procurementRecommendations.map((rec) => (
              <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3.5 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {rec.item}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {rec.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {rec.reason}
                  </p>
                </td>
                <td className="px-3.5 py-3 align-top text-muted-foreground max-w-[180px]">
                  <span className="block truncate" title={rec.supplier}>
                    {rec.supplier}
                  </span>
                </td>
                <td className="px-3.5 py-3 align-top text-right font-bold tabular-nums text-foreground whitespace-nowrap">
                  {rec.recommendedQty.toLocaleString()}{" "}
                  <span className="font-normal text-muted-foreground">
                    {rec.unit}
                  </span>
                </td>
                <td className="px-3.5 py-3 align-top text-center whitespace-nowrap">
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
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">
          Inventory Demand Forecast
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
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
              className="rounded-xl border border-border bg-muted/20 p-3.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {fc.item}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {fc.sku}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fillPct}% of 30-day projected demand covered
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold tabular-nums text-foreground">
                      {fc.currentStock.toLocaleString()}{" "}
                      <span className="font-normal text-muted-foreground">
                        / {fc.forecastedDemand.toLocaleString()} {fc.unit}
                      </span>
                    </p>
                    <p className="text-[11px] font-medium tabular-nums text-muted-foreground">
                      ~{fc.daysRemaining}d remaining
                    </p>
                  </div>
                  <UrgencyBadge level={fc.urgency} />
                </div>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barClass}`}
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
