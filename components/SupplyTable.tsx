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
          <h2 className="text-2xl font-bold text-foreground">
            Supply List
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            Raw materials and tools inventory
          </p>
        </div>

        <button
          className="
            flex items-center gap-2
            bg-primary hover:bg-primary/90
            text-white
            px-4 py-3
            rounded-xl
            text-sm font-semibold
          "
        >
          <Plus size={18} />
          Add New Supply
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">
            Total Items
          </p>

          <h3 className="text-4xl font-bold text-foreground mt-2">
            14
          </h3>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">
            Raw Materials
          </p>

          <h3 className="text-4xl font-bold text-foreground mt-2">
            9
          </h3>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground">
            Tools
          </p>

          <h3 className="text-4xl font-bold text-foreground mt-2">
            5
          </h3>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* FILTER */}
        <div className="p-5 border-b border-border flex items-center gap-3">

          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
            All
          </button>

          <button className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium">
            Raw Materials
          </button>

          <button className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium">
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

            <thead>
              <tr className="border-b border-border">

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  ITEM NO.
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  NAME
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  CATEGORY
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  UNIT
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  MIN STOCK
                </th>

                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                  ACTIONS
                </th>
              </tr>
            </thead>

            <tbody>
              {supplies.map((item, idx) => (
                <tr
                  key={item.id}
                  className="border-b border-border"
                >
                  <td className="px-6 py-5 text-sm text-foreground">
                    {idx + 1}
                  </td>

                  <td className="px-6 py-5 text-sm font-medium text-foreground">
                    {item.name}
                  </td>

                  <td className="px-6 py-5">
                    <span className="bg-blue-100 text-foreground px-3 py-1 rounded-lg text-xs font-semibold">
                      {item.category}
                    </span>
                  </td>

                  <td className="px-6 py-5 text-sm text-foreground">
                    {item.unit}
                  </td>

                  <td className="px-6 py-5 text-sm text-foreground">
                    {item.minStock}
                  </td>

                  <td className="px-6 py-5">
                    <button className="flex items-center gap-2 text-foreground font-medium text-sm">
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