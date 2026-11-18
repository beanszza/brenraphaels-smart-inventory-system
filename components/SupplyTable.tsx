"use client";

import { Pencil, Plus } from "lucide-react";
import { SearchInput } from "@/components/shared/SearchInput";

type SupplyItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  minStock: number;
};

const supplies: SupplyItem[] = [
  {
    id: 1,
    name: "Ube (Purple Yam)",
    category: "Raw Materials",
    unit: "kg",
    minStock: 100,
  },
  {
    id: 2,
    name: "White Sugar",
    category: "Raw Materials",
    unit: "kg",
    minStock: 50,
  },
  {
    id: 3,
    name: "Brown Sugar",
    category: "Raw Materials",
    unit: "kg",
    minStock: 30,
  },
  {
    id: 4,
    name: "Condensed Milk",
    category: "Raw Materials",
    unit: "liters",
    minStock: 20,
  },
  {
    id: 5,
    name: "Mixing Bowl",
    category: "Tools",
    unit: "pcs",
    minStock: 5,
  },
];

export default function SupplyTable() {
  return (
    <div className="flex flex-col gap-6">

      {/* TOP */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="type-page-title text-text-primary">
            Supply List
          </h2>

          <p className="type-body text-text-muted mt-1">
            Raw materials and tools inventory
          </p>
        </div>

        <button
          className="
            flex items-center gap-2
            bg-button-primary hover:bg-button-primary-hover
            text-button-primary-foreground
            px-4 py-3
            rounded-control
            type-label-button
          "
        >
          <Plus size={18} />
          Add New Supply
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">

        <div className="bg-surface border border-divider rounded-card p-5 shadow-card">
          <p className="type-caption text-text-muted">
            Total Items
          </p>

          <h3 className="type-stat-value text-text-primary mt-2">
            14
          </h3>
        </div>

        <div className="bg-surface border border-divider rounded-card p-5 shadow-card">
          <p className="type-caption text-text-muted">
            Raw Materials
          </p>

          <h3 className="type-stat-value text-text-primary mt-2">
            9
          </h3>
        </div>

        <div className="bg-surface border border-divider rounded-card p-5 shadow-card">
          <p className="type-caption text-text-muted">
            Tools
          </p>

          <h3 className="type-stat-value text-text-primary mt-2">
            5
          </h3>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-surface border border-divider rounded-card overflow-hidden shadow-card">

        {/* FILTER */}
        <div className="p-5 border-b border-divider flex items-center gap-3">

          <button className="bg-button-primary text-button-primary-foreground px-4 py-2 rounded-control type-label-button">
            All
          </button>

          <button className="border border-divider text-text-primary hover:bg-hover px-4 py-2 rounded-control type-label-button">
            Raw Materials
          </button>

          <button className="border border-divider text-text-primary hover:bg-hover px-4 py-2 rounded-control type-label-button">
            Tools
          </button>

          <SearchInput
            containerClassName="ml-auto w-[300px] flex-none"
            placeholder="Search supplies..."
          />
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full">

            <thead className="border-b border-divider bg-surface-muted table-head-row">
              <tr>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  ITEM NO.
                </th>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  NAME
                </th>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  CATEGORY
                </th>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  UNIT
                </th>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  MIN STOCK
                </th>

                <th className="text-left px-6 py-4 table-th text-text-muted uppercase">
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-divider">
              {supplies.map((item, idx) => (
                <tr
                  key={item.id}
                  className="table-row hover:bg-hover transition-colors"
                >
                  <td className="px-6 py-5 table-td text-text-primary">
                    {idx + 1}
                  </td>

                  <td className="px-6 py-5 table-td font-medium text-text-primary">
                    {item.name}
                  </td>

                  <td className="px-6 py-5 table-td">
                    <span className="bg-surface-muted text-text-primary border border-divider px-3 py-1 rounded-pill type-caption font-semibold">
                      {item.category}
                    </span>
                  </td>

                  <td className="px-6 py-5 table-td text-text-primary">
                    {item.unit}
                  </td>

                  <td className="px-6 py-5 table-td text-text-primary">
                    {item.minStock}
                  </td>

                  <td className="px-6 py-5 table-td">
                    <button className="flex items-center gap-2 text-text-primary hover:text-accent font-medium type-body">
                      <Pencil size={16} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>
    </div>
  );
}