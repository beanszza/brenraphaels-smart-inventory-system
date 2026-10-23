"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";

import { Pencil } from "lucide-react";

export default function RecipeCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-6">

      <div className="flex items-start justify-between">

        <div>
          <div className="flex items-center gap-3">

            <h2 className="text-2xl font-bold text-foreground">
              Ube Halaya (500g Jar)
            </h2>

            <StatusBadge status="Active">Active</StatusBadge>
          </div>

          <p className="text-sm text-muted-foreground mt-2">
            Recipe No.: RCP-001
          </p>

          <p className="text-sm text-foreground mt-1">
            Output: 1 jar
          </p>
        </div>

        <button className="text-foreground">
          <Pencil size={18} />
        </button>
      </div>

      {/* INGREDIENTS */}
      <div className="mt-6">

        <h3 className="text-sm font-semibold text-foreground mb-4">
          Required Ingredients:
        </h3>

        <div className="grid grid-cols-3 gap-4">

          {[
            {
              name: "Ube (Purple Yam)",
              qty: "0.5 kg",
            },
            {
              name: "White Sugar",
              qty: "0.2 kg",
            },
            {
              name: "Condensed Milk",
              qty: "0.1 liters",
            },
          ].map((item) => (
            <div
              key={item.name}
              className="border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between">

                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {item.name}
                  </h4>

                  <p className="text-xs text-muted-foreground mt-1">
                    Raw Material
                  </p>
                </div>

                <span className="text-sm font-bold text-foreground">
                  {item.qty}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* NOTES */}
        <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-xl p-4">

          <p className="text-sm font-semibold text-foreground">
            Notes:
          </p>

          <p className="text-sm text-foreground mt-2">
            Traditional Ube Halaya recipe with premium ingredients.
          </p>
        </div>
      </div>
    </div>
  );
}