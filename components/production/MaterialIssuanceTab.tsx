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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Material Issuances</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify allocated lot codes via physical barcode/QR code scan and release raw materials to the production floor.
        </p>
      </div>

      {/* Search and Status Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            containerClassName="min-w-0 flex-1"
            placeholder="Search by issuance #, request #, or product..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="flex items-center gap-sm shrink-0">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 min-w-[210px] w-auto rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-sm focus:ring-1 focus:ring-ring">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="min-w-[210px]">
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending Scan</SelectItem>
                <SelectItem value="Scanning">Scanning</SelectItem>
                <SelectItem value="Issued">Issued</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-border bg-muted/30">
            <tr className="text-left text-xs uppercase text-muted-foreground whitespace-nowrap">
              <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur-xs px-4 py-4 min-w-[160px] w-44 whitespace-nowrap border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">Issuance Number</th>
              <th className="px-4 py-4 whitespace-nowrap">Request Number</th>
              <th className="px-4 py-4">Product</th>
              <th className="px-4 py-4">Recipe</th>
              <th className="px-4 py-4 text-right">Target Output</th>
              <th className="px-4 py-4 text-center">Status</th>
              <th className="px-4 py-4">Issued Date</th>
              <th className="w-16 px-4 py-4 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                  <ProductionSkeleton />
                </td>
              </tr>
            ) : paginatedIssuances.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm font-normal text-muted-foreground">
                  No material issuances found. Once a production request is approved, initialize issuance to scan supplies.
                </td>
              </tr>
            ) : (
              paginatedIssuances.map((iss) => {
                const isDone = iss.status === "Issued";
                const isMenuOpen = openDropdownId === iss.issuanceId;

                return (
                  <tr
                    key={iss.issuanceId}
                    onClick={() => handleOpenScanner(iss.issuanceId)}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 px-4 py-4 text-sm font-semibold text-foreground whitespace-nowrap min-w-[160px] w-44 border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] transition-colors">
                      {iss.issuanceNumber}
                    </td>

                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {iss.reqNumber}
                    </td>

                    <td className="px-4 py-4 text-sm text-foreground whitespace-nowrap">
                      {iss.productName}
                    </td>

                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {iss.recipeName}
                    </td>

                    <td className="px-4 py-4 text-sm text-right font-semibold text-foreground whitespace-nowrap">
                      {iss.requestQuantity}
                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <StatusBadge status={iss.status} />
                    </td>

                    <td className="px-4 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {iss.issuedAt ? new Date(iss.issuedAt).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions (Three Dots Menu) */}
                    <td className="w-16 px-4 py-4 text-center relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none"
                              title="Actions"
                              aria-label="Actions"
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border border-border bg-card shadow-xl p-1.5 text-left z-[100]">
                            {!isDone && (
                              <DropdownMenuItem
                                onClick={() => handleOpenScanner(iss.issuanceId)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer rounded-lg transition-colors outline-none"
                              >
                                <QrCode size={14} className="shrink-0 text-muted-foreground" />
                                <span>Scan Materials</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleOpenScanner(iss.issuanceId)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer rounded-lg transition-colors outline-none"
                            >
                              <Eye size={14} className="shrink-0 text-muted-foreground" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setCurrentPage}
      />

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
