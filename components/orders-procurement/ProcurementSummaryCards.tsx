"use client";

import React from "react";
import { ShoppingCart, Clock, CheckCircle, PackageCheck } from "lucide-react";
import { Order } from "./types";
import { Card, CardContent } from "@/components/ui/card";

export default function ProcurementSummaryCards({ orders }: { orders: Order[] }) {
  const total = orders.length;
  const pending = orders.filter((o) => o.status === "Pending").length;
  const arrived = orders.filter((o) => o.status === "Arrived").length;
  const completed = orders.filter((o) => o.status === "Completed").length;

  const cards = [
    { label: "Total Orders",       value: total,     icon: ShoppingCart },
    { label: "Pending Orders",     value: pending,   icon: Clock },
    { label: "Arrived / Inspected",value: arrived,   icon: PackageCheck },
    { label: "Completed",          value: completed, icon: CheckCircle },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map(({ label, value, icon: Icon }, i) => (
        <Card key={label} className={`rounded-card border-divider ${i === 0 ? "bg-foreground" : ""}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-control flex items-center justify-center shrink-0 ${i === 0 ? "bg-background/15" : "bg-muted"}`}>
              <Icon className={`w-4 h-4 ${i === 0 ? "text-background" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className={`type-stat-value ${i === 0 ? "text-background" : "text-foreground"}`}>{value}</p>
              <p className={`type-caption ${i === 0 ? "text-background/70" : "text-muted-foreground"}`}>{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
