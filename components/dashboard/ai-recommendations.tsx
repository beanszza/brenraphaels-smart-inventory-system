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

export function ProcurementRecommendationCard({
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

  const count = procurementRecommendations.length;
  const highCount = procurementRecommendations.filter((r) => r.urgency === "High").length;
  const headline =
    highCount > 0
      ? `${count} reorder ${count === 1 ? "suggestion" : "suggestions"}, ${highCount} high urgency.`
      : `${count} reorder ${count === 1 ? "suggestion" : "suggestions"} based on stock and usage.`;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div>
        <p className="type-caption font-medium text-ink-muted">
          Procurement Recommendations
        </p>
        <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
          {headline}
        </h3>
      </div>

      <div className="space-y-3.5 flex-1">
        {procurementRecommendations.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="type-table-id tabular-nums whitespace-nowrap text-primary">
                  {rec.id}
                </span>
                <span className="type-body-secondary font-semibold text-ink truncate">
                  {rec.item}
                </span>
              </div>
              <p className="type-caption text-ink-muted mt-0.5 leading-relaxed">
                {rec.reason} · <span className="text-ink-secondary">{rec.supplier}</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
              <span className="type-body-secondary font-semibold tabular-nums text-ink whitespace-nowrap">
                {rec.recommendedQty.toLocaleString()}{" "}
                <span className="font-normal text-ink-muted">{rec.unit}</span>
              </span>
              <UrgencyBadge level={rec.urgency} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InventoryForecastCard({
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
  const urgentCount = sorted.filter((fc) => fc.urgency !== "Low").length;
  const headline =
    urgentCount > 0
      ? `${urgentCount} ${urgentCount === 1 ? "item" : "items"} projected to run low in 30 days.`
      : `${sorted.length} tracked ${sorted.length === 1 ? "item" : "items"} covered for 30-day demand.`;

  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col justify-between h-full gap-4">
      <div>
        <p className="type-caption font-medium text-ink-muted">
          Inventory Demand Forecast
        </p>
        <h3 className="type-card-title text-ink mt-0.5 tracking-tight">
          {headline}
        </h3>
      </div>

      <div className="space-y-3.5 flex-1">
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
            <div key={fc.sku} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="type-body-secondary font-semibold text-ink truncate">
                      {fc.item}
                    </span>
                    <span className="type-caption tabular-nums whitespace-nowrap text-ink-muted">
                      {fc.sku}
                    </span>
                  </div>
                  <p
                    className={`type-caption tabular-nums mt-0.5 ${
                      fc.urgency === "High" ? "text-status-red-fg" : "text-ink-muted"
                    }`}
                  >
                    {fc.currentStock.toLocaleString()} / {fc.forecastedDemand.toLocaleString()}{" "}
                    {fc.unit} · ~{fc.daysRemaining}d left
                  </p>
                </div>

                <div className="shrink-0 pt-0.5">
                  <UrgencyBadge level={fc.urgency} />
                </div>
              </div>

              <div className="h-2 w-full rounded-pill bg-status-gray-bg overflow-hidden">
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
      {procurement && (
        <div className={forecasts ? "min-w-0 xl:col-span-7" : "min-w-0 xl:col-span-12"}>
          <ProcurementRecommendationCard procurementRecommendations={procurement} />
        </div>
      )}
      {forecasts && (
        <div className={procurement ? "min-w-0 xl:col-span-5" : "min-w-0 xl:col-span-12"}>
          <InventoryForecastCard inventoryForecasts={forecasts} />
        </div>
      )}
    </div>
  );
}
