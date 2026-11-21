"use client";
import { ProductionSkeleton } from "./ProductionSkeleton";
import { listIssuances as productionListIssuances } from "@/app/actions/production/issuances";
import { actionResponse } from "@/lib/resources/action-response";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Eye, QrCode, CheckCircle2, ArrowRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/shared/SearchInput";
import Pagination from "@/components/Pagination";
import { toast } from "sonner";
import { MaterialIssuanceDTO } from "./types";
import MaterialIssuanceModal from "./MaterialIssuanceModal";

interface MaterialIssuanceTabProps {
  initialRows: MaterialIssuanceDTO[];
  initialIssuanceId?: number | null;
}

export default function MaterialIssuanceTab({ initialRows, initialIssuanceId }: MaterialIssuanceTabProps) {
  const [issuances, setIssuances] = useState<MaterialIssuanceDTO[]>(initialRows);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".action-menu-container")) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Modal state
  const [selectedIssuanceId, setSelectedIssuanceId] = useState<number | null>(initialIssuanceId ?? null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(Boolean(initialIssuanceId));

  const fetchIssuances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await actionResponse(productionListIssuances());
      if (res.data?.success && Array.isArray(res.data.data)) {
        setIssuances(res.data.data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load material issuances.");
    } finally {
      setLoading(false);
    }
  }, []);


  const handleOpenScanner = (issuanceId: number) => {
    setSelectedIssuanceId(issuanceId);
    setIsModalOpen(true);
  };

  // Pagination
  const pageSize = 10;
  const q = searchQuery.trim().toLowerCase();
  const filteredIssuances = issuances.filter(r => (statusFilter === "All" || r.status === statusFilter)
    && (!q || `${r.issuanceNumber} ${r.reqNumber} ${r.productName}`.toLowerCase().includes(q)));
  const totalCount = filteredIssuances.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedIssuances = filteredIssuances.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 animate-page-in">
      {/* Header */}
      <div>
        <h2 className="type-page-title text-ink">Material Issuances</h2>
        <p className="mt-1 type-body text-ink-muted">
          Verify allocated lot codes via physical barcode/QR code scan and release raw materials to the production floor.
        </p>
      </div>

      {/* Standalone Filters & Search Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="h-[38px] w-full sm:w-auto sm:min-w-[220px] rounded-control border border-input bg-surface px-3 type-body text-ink shadow-none focus:ring-1 focus:ring-ring">
            <span className="truncate">
              <span className="text-ink-muted font-normal mr-1.5">Status:</span>
              <span className="font-medium text-ink">
                <SelectValue placeholder="All Statuses" />
              </span>
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            sideOffset={4}
            avoidCollisions={false}
            className="min-w-[220px] max-h-72"
          >
            <SelectItem value="All">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending Scan</SelectItem>
            <SelectItem value="Scanning">Scanning</SelectItem>
            <SelectItem value="Issued">Issued</SelectItem>
          </SelectContent>
        </Select>

        <SearchInput
          containerClassName="flex-none w-full sm:w-[300px] h-[38px]"
          placeholder="Search issuance, request, or item..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Padded Table Card */}
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr className="border-b border-divider">
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap min-w-[160px]">Issuance Number</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Request Number</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Product</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Recipe</th>
                <th className="pb-2.5 pt-1 pr-6 type-table-header text-ink-muted text-right whitespace-nowrap">Target Output</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Status</th>
                <th className="pb-2.5 pt-1 pr-4 type-table-header text-ink-muted text-left whitespace-nowrap">Issued Date</th>
                <th className="w-16 pb-2.5 pt-1 pl-4 type-table-header text-ink-muted text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                    <ProductionSkeleton />
                  </td>
                </tr>
              ) : paginatedIssuances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center type-body text-ink-muted">
                    No material issuances found. Once a production request is approved, initialize issuance to scan supplies.
                  </td>
                </tr>
              ) : (
                paginatedIssuances.map((iss) => {
                  const isDone = iss.status === "Issued";

                  return (
                    <tr
                      key={iss.issuanceId}
                      onClick={() => handleOpenScanner(iss.issuanceId)}
                      className="group hover:bg-page transition-colors cursor-pointer"
                    >
                      <td className="py-3 pr-4 type-body font-medium text-primary whitespace-nowrap tabular-nums min-w-[160px]">
                        {iss.issuanceNumber}
                      </td>

                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap tabular-nums">
                        {iss.reqNumber}
                      </td>

                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {iss.productName}
                      </td>

                      <td className="py-3 pr-4 type-body text-ink-muted whitespace-nowrap">
                        {iss.recipeName}
                      </td>

                      <td className="py-3 pr-6 type-body font-medium text-ink text-right whitespace-nowrap tabular-nums">
                        {iss.requestQuantity}
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap">
                        <StatusBadge status={iss.status} />
                      </td>

                      <td className="py-3 pr-4 type-body text-ink whitespace-nowrap">
                        {iss.issuedAt ? new Date(iss.issuedAt).toLocaleDateString() : "—"}
                      </td>

                      {/* Actions (Three Dots Menu) */}
                      <td className="w-16 py-3 pl-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer focus:outline-none"
                              title="Actions"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {!isDone && (
                              <DropdownMenuItem
                                onClick={() => handleOpenScanner(iss.issuanceId)}
                                className="cursor-pointer type-body-secondary font-medium"
                              >
                                <QrCode size={14} className="shrink-0" />
                                <span>Scan Materials</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleOpenScanner(iss.issuanceId)}
                              className="cursor-pointer type-body-secondary"
                            >
                              <Eye size={14} className="shrink-0" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          embedded
        />
      </div>

      {/* Material Issuance Modal */}
      <MaterialIssuanceModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedIssuanceId(null);
        }}
        issuanceId={selectedIssuanceId}
        onSuccess={fetchIssuances}
      />
    </div>
  );
}
