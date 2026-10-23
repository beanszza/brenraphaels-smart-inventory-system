"use client";

import { OrdersSkeleton } from "@/components/orders-procurement/OrdersSkeleton";

import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ReportFilterBar from "@/components/pages/ReportFilterBar";
import InventoryReportView from "@/components/pages/InventoryReportView";
import ProcurementReportView from "@/components/pages/ProcurementReportView";
import ProductionReportView from "@/components/pages/ProductionReportView";
import SupplierReportView from "@/components/pages/SupplierReportView";
import SupplierOrdersModal from "@/components/pages/SupplierOrdersModal";
import DistributionReportView from "@/components/pages/DistributionReportView";
import { exportReportCSV } from "@/components/reports/exportReportCSV";

export default function ViewReports({ initialTab, initialData, initialDates }: { initialTab: string; initialData: any; initialDates: { start: string; end: string } }) {
  const router = useRouter();
  const data = initialData;
  const [loading, startNavigation] = useTransition();


  const [filterMode, setFilterMode] = useState<"all" | "specific" | "range">(initialDates.start || initialDates.end ? "range" : "all");
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [specificDate, setSpecificDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedSupplierModal, setSelectedSupplierModal] = useState<any>(null);

  const fetchData = () => {
    const params = new URLSearchParams({ tab: initialTab });
    if (filterMode === "specific" && specificDate) {
      params.set("startDate", specificDate); params.set("endDate", specificDate);
    } else if (filterMode === "range") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    startNavigation(() => router.push(`/reports?${params}`));
  };

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterMode, specificDate, startDate, endDate, selectedSupplierFilter, initialTab]);

  const handleResetFilters = () => {
    setFilterMode("all"); setStartDate(""); setEndDate(""); setSpecificDate("");
    setSearchQuery(""); setSelectedSupplierFilter("all"); setCurrentPage(1); startNavigation(() => router.push(`/reports?tab=${initialTab}`));
  };

  const getBackPath = () => {
    switch (initialTab) {
      case "inventory": return "/inventory";
      case "procurement": return "/orders-procurement";
      case "production": return "/production-quality";
      case "supplier": return "/resources-suppliers";
      case "distribution": return "/distribution";
      default: return "/";
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-background p-2 sm:p-4 transition-colors font-sans text-foreground">
      <div className="w-full max-w-full space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="outline" onClick={() => router.push(getBackPath())} className="mb-2 h-9 px-3 text-xs font-semibold rounded-lg border-border bg-card hover:bg-muted text-foreground transition-colors shadow-sm">
              Back to System
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground capitalize">
              {initialTab} Performance Report
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Comprehensive analytics, fulfillment rates, and historical logs
            </p>
          </div>
        </div>

        <ReportFilterBar
          initialTab={initialTab} filterMode={filterMode} setFilterMode={setFilterMode}
          startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          specificDate={specificDate} setSpecificDate={setSpecificDate} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          selectedSupplierFilter={selectedSupplierFilter} setSelectedSupplierFilter={setSelectedSupplierFilter}
          allSuppliers={data?.vendorScorecard || []} onApplyFilters={fetchData} onResetFilters={handleResetFilters}
          onExportCSV={() => exportReportCSV(initialTab, data)}
        />

        {loading ? (
          <OrdersSkeleton />
        ) : (
          <div className="space-y-6">
            {initialTab === "inventory" && <InventoryReportView data={data} searchQuery={searchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
            {initialTab === "procurement" && <ProcurementReportView data={data} searchQuery={searchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
            {initialTab === "production" && <ProductionReportView data={data} searchQuery={searchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
            {initialTab === "supplier" && <SupplierReportView data={data} searchQuery={searchQuery} selectedSupplierFilter={selectedSupplierFilter} currentPage={currentPage} setCurrentPage={setCurrentPage} onOpenOrdersModal={(s: any) => setSelectedSupplierModal(s)} />}
            {initialTab === "distribution" && <DistributionReportView data={data} searchQuery={searchQuery} currentPage={currentPage} setCurrentPage={setCurrentPage} />}
          </div>
        )}

        {selectedSupplierModal && (
          <SupplierOrdersModal selectedSupplierModal={selectedSupplierModal} onClose={() => setSelectedSupplierModal(null)} />
        )}
      </div>
    </div>
  );
}
