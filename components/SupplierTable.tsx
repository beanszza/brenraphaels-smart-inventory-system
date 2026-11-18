"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";

import { Pencil, Plus, Star } from "lucide-react";

const suppliers = [
  {
    id: 1,
    name: "Manila Fresh Produce",
    contact: "Juan Dela Cruz",
    email: "juan@manila.ph",
    phone: "+63 917 123 4567",
    rating: 4.8,
    onTime: "95%",
    leadTime: "2 days",
    status: "Active",
  },
  {
    id: 2,
    name: "Baguio Ube Traders",
    contact: "Maria Santos",
    email: "maria@ube.ph",
    phone: "+63 918 888 2222",
    rating: 4.9,
    onTime: "98%",
    leadTime: "3 days",
    status: "Active",
  },
];

export default function SupplierTable() {
  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden">

      <div className="p-6 flex items-center justify-between border-b border-divider">

        <div>
          <h2 className="type-page-title text-ink">
            Supplier Management
          </h2>

          <p className="type-body text-ink-muted mt-1">
            Manage supplier relationships
          </p>
        </div>

        <button className="bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2.5 rounded-control type-label-button flex items-center gap-2 cursor-pointer shadow-xs">
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">

          <thead>
            <tr className="table-head-row">

              <th className="table-th text-left px-6 py-2.5">
                SUPPLIER NAME
              </th>

              <th className="table-th text-left px-6 py-2.5">
                CONTACT PERSON
              </th>

              <th className="table-th text-left px-6 py-2.5">
                CONTACT DETAILS
              </th>

              <th className="table-th text-left px-6 py-2.5">
                RATING
              </th>

              <th className="table-th text-left px-6 py-2.5">
                ON-TIME RATE
              </th>

              <th className="table-th text-left px-6 py-2.5">
                AVG LEAD TIME
              </th>

              <th className="table-th text-left px-6 py-2.5">
                STATUS
              </th>

              <th className="table-th text-left px-6 py-2.5">
                ACTIONS
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {suppliers.map((supplier) => (
              <tr
                key={supplier.id}
                className="table-row"
              >
                <td className="table-td px-6 py-3 font-semibold text-ink">
                  {supplier.name}
                </td>

                <td className="table-td px-6 py-3 text-ink">
                  {supplier.contact}
                </td>

                <td className="table-td px-6 py-3">
                  <div className="type-body text-ink">
                    {supplier.email}
                  </div>

                  <div className="type-caption text-ink-muted mt-1">
                    {supplier.phone}
                  </div>
                </td>

                <td className="table-td px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Star
                      size={15}
                      className="text-ink fill-ink"
                    />

                    <span className="type-body text-ink">
                      {supplier.rating}
                    </span>
                  </div>
                </td>

                <td className="table-td px-6 py-3 font-semibold text-ink tabular-nums">
                  {supplier.onTime}
                </td>

                <td className="table-td px-6 py-3 text-ink">
                  {supplier.leadTime}
                </td>

                <td className="table-td px-6 py-3">
                  <StatusBadge status={supplier.status} />
                </td>

                <td className="table-td px-6 py-3">
                  <button className="text-ink hover:text-ink-muted cursor-pointer">
                    <Pencil size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}