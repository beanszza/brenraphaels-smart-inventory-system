"use client";

import React from "react";
import { Layers, Package, ShoppingBasket, Wrench } from "lucide-react";
import { SupplyItem } from "./types";
import { Card, CardContent } from "@/components/ui/card";

export default function SupplySummaryCards({ supplies }: { supplies: SupplyItem[] }) {
  const rawMaterialsCount = supplies.filter((i) => i.categoryName === "Raw Materials").length;
  const toolsSuppliesCount = supplies.filter(
    (i) => i.categoryName === "Tools and Supplies" || i.categoryName === "Tools & Supplies"
  ).length;
  const ingredientsCount = supplies.filter((i) => i.categoryName === "Ingredients").length;

  const cards = [
    { label: "Total Items", value: supplies.length, icon: Layers },
    { label: "Raw Materials", value: rawMaterialsCount, icon: Package },
    { label: "Ingredients", value: ingredientsCount, icon: ShoppingBasket },
    { label: "Tools & Supplies", value: toolsSuppliesCount, icon: Wrench },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="border-border bg-surface rounded-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-9 rounded-control flex items-center justify-center shrink-0 bg-subtle">
              <Icon className="size-4 text-ink-muted" />
            </div>
            <div>
              <p className="type-stat-value text-ink tabular-nums">{value}</p>
              <p className="type-caption text-ink-muted">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
