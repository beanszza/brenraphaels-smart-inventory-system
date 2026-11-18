"use client";

import React from "react";
import { ArrowRightLeft, Clock, Truck, CheckCircle } from "lucide-react";
import { DistributionStats } from "./types";
import { Card, CardContent } from "@/components/ui/card";

export default function DistributionSummaryCards({ stats }: { stats: DistributionStats }) {
  const cards = [
    { label: "Total Transfers", value: stats.total,     icon: ArrowRightLeft },
    { label: "Pending",         value: stats.pending,   icon: Clock },
    { label: "In Transit",      value: stats.inTransit, icon: Truck },
    { label: "Completed",       value: stats.completed, icon: CheckCircle },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map(({ label, value, icon: Icon }, i) => (
        <Card key={label} className={`border-divider rounded-panel ${i === 0 ? "bg-primary text-primary-foreground" : "bg-surface text-text-primary"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-control flex items-center justify-center shrink-0 ${i === 0 ? "bg-primary-foreground/15" : "bg-surface-hover"}`}>
              <Icon className={`w-4 h-4 ${i === 0 ? "text-primary-foreground" : "text-text-muted"}`} />
            </div>
            <div>
              <p className={`type-kpi font-semibold ${i === 0 ? "text-primary-foreground" : "text-text-primary"}`}>{value}</p>
              <p className={`type-caption ${i === 0 ? "text-primary-foreground/70" : "text-text-muted"}`}>{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
