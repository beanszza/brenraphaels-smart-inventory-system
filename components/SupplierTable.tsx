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
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      <div className="p-6 flex items-center justify-between border-b border-border">

        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Supplier Management
          </h2>

          <p className="text-sm text-muted-foreground mt-1">
            Manage supplier relationships
          </p>
        </div>

        <button className="bg-primary hover:bg-primary/90 text-white px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Plus size={18} />
          Add Supplier
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">

          <thead>
            <tr className="border-b border-border">

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                SUPPLIER NAME
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                CONTACT PERSON
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                CONTACT DETAILS
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                RATING
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                ON-TIME RATE
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                AVG LEAD TIME
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                STATUS
              </th>

              <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground">
                ACTIONS
              </th>
            </tr>
          </thead>

          <tbody>
            {suppliers.map((supplier) => (
              <tr
                key={supplier.id}
                className="border-b border-border"
              >
                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {supplier.name}
                </td>

                <td className="px-6 py-5 text-sm text-foreground">
                  {supplier.contact}
                </td>

                <td className="px-6 py-5">
                  <div className="text-sm text-foreground">
                    {supplier.email}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">
                    {supplier.phone}
                  </div>
                </td>

                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <Star
                      size={15}
                      className="text-foreground fill-foreground"
                    />

                    <span className="text-sm text-foreground">
                      {supplier.rating}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {supplier.onTime}
                </td>

                <td className="px-6 py-5 text-sm text-foreground">
                  {supplier.leadTime}
                </td>

                <td className="px-6 py-5">
                  <StatusBadge status={supplier.status} />
                </td>

                <td className="px-6 py-5">
                  <button className="text-foreground">
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