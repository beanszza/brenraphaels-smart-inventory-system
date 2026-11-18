"use client";

import React from "react";
import { Recipe } from "./types";

export default function RecipeSummaryCards({ recipes }: { recipes: Recipe[] }) {
  const activeCount = recipes.filter((r) => r.isActive).length;
  const inactiveCount = recipes.filter((r) => !r.isActive).length;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card border border-divider bg-surface p-5 shadow-card">
        <p className="type-caption font-semibold text-text-muted">Total Recipes</p>
        <h3 className="mt-1 type-stat-value text-text-primary">{recipes.length}</h3>
      </div>
      <div className="rounded-card border border-divider bg-surface p-5 shadow-card">
        <p className="type-caption font-semibold text-text-muted">Active Recipes</p>
        <h3 className="mt-1 type-stat-value text-text-primary">{activeCount}</h3>
      </div>
      <div className="rounded-card border border-divider bg-surface p-5 shadow-card">
        <p className="type-caption font-semibold text-text-muted">Inactive Recipes</p>
        <h3 className="mt-1 type-stat-value text-text-primary">{inactiveCount}</h3>
      </div>
    </div>
  );
}
