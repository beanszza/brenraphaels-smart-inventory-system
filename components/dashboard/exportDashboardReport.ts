"use client";

import type { DashboardAnalytics } from "@/lib/dashboard/types";

function escapeHtml(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? "" : String(val);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPeriodLabel(analytics: DashboardAnalytics): string {
  if (analytics.dateRange) {
    const { from, to, label } = analytics.dateRange;
    return label ? `${label} (${from} to ${to})` : `${from} to ${to}`;
  }
  return "Live Snapshot (Present)";
}

function formatGeneratedMeta(iso: string): { date: string; time: string; stamp: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "—", time: "", stamp: "export" };
  }
  return {
    date: d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    stamp: iso.slice(0, 10),
  };
}

/**
 * Downloads a styled Microsoft Excel workbook (.xls) modeled on the Bren Raphael's
 * PO / PR PDF report format: company header block, spaced columns, borders, and
 * brand-purple section headers.
 */
export function downloadDashboardExcel(analytics: DashboardAnalytics) {
  const meta = formatGeneratedMeta(analytics.generatedAt);
  const periodText = formatPeriodLabel(analytics);

  const sections: string[] = [];

  const renderSection = (
    title: string,
    headers: { label: string; align?: "left" | "right" | "center" }[],
    rows: (string | number | null | undefined)[][],
  ) => {
    const colSpan = headers.length;
    const headerRow = headers
      .map(
        (h) =>
          `<th style="background-color:#5B2A86;color:#FFFFFF;font-weight:600;padding:8px 12px;border:1px solid #4A226E;text-align:${h.align ?? "left"};font-size:11pt;">${escapeHtml(h.label)}</th>`,
      )
      .join("");

    const bodyRows = rows.length
      ? rows
          .map((cells, rIdx) => {
            const bg = rIdx % 2 === 1 ? "#F7F3FB" : "#FFFFFF";
            const tds = cells
              .map((cell, cIdx) => {
                const align = headers[cIdx]?.align ?? "left";
                return `<td style="background-color:${bg};color:#18181B;padding:7px 12px;border:1px solid #D4D4D8;text-align:${align};font-size:10.5pt;vertical-align:top;">${escapeHtml(cell)}</td>`;
              })
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${colSpan}" style="background-color:#FAFAFA;color:#71717A;padding:8px 12px;border:1px solid #D4D4D8;font-style:italic;">No records available for this period.</td></tr>`;

    sections.push(`
      <tr><td colspan="6" style="height:14px;border:none;"></td></tr>
      <tr><td colspan="${colSpan}" style="background-color:#EFE8F7;color:#2A0F3F;font-weight:600;padding:8px 12px;border:1px solid #D4D4D8;font-size:11.5pt;letter-spacing:0.3px;">${escapeHtml(title)}</td></tr>
      <tr>${headerRow}</tr>
      ${bodyRows}
    `);
  };

  // 1. Key Metrics
  const kpiRows: (string | number)[][] = [];
  if (analytics.kpis.activeInventory) {
    kpiRows.push(["Active Inventory", analytics.kpis.activeInventory.value, analytics.kpis.activeInventory.unit, "Current live count"]);
  }
  if (analytics.kpis.lowStockAlerts) {
    kpiRows.push(["Low Stock Alerts", analytics.kpis.lowStockAlerts.value, analytics.kpis.lowStockAlerts.unit, "Items at or below minimum"]);
  }
  if (analytics.kpis.productionBatches) {
    const t = analytics.kpis.productionBatches.trend;
    kpiRows.push([
      "Production Batches",
      analytics.kpis.productionBatches.value,
      analytics.kpis.productionBatches.unit,
      t === null ? "No prior period comparison" : `${t >= 0 ? "+" : ""}${t}% vs prior period`,
    ]);
  }
  if (analytics.kpis.activeSuppliers) {
    kpiRows.push(["Active Suppliers", analytics.kpis.activeSuppliers.value, analytics.kpis.activeSuppliers.unit, "Registered vendor partners"]);
  }
  if (kpiRows.length) {
    renderSection(
      "1. KEY PERFORMANCE INDICATORS",
      [
        { label: "Metric" },
        { label: "Value", align: "right" },
        { label: "Unit" },
        { label: "Notes" },
      ],
      kpiRows,
    );
  }

  // 2. Procurement Trend
  if (analytics.procurementTrend) {
    renderSection(
      "2. PROCUREMENT TREND",
      [
        { label: "Period" },
        { label: "Purchase Orders", align: "right" },
        { label: "Order Value (PHP K)", align: "right" },
      ],
      analytics.procurementTrend.map((m) => [m.month, m.orders, `PHP ${m.valueK.toLocaleString()}K`]),
    );
  }

  // 3. Procurement Recommendations
  if (analytics.procurementRecommendations) {
    renderSection(
      "3. PROCUREMENT RECOMMENDATIONS",
      [
        { label: "Item Code" },
        { label: "Item Name" },
        { label: "Preferred Supplier" },
        { label: "Order Qty", align: "right" },
        { label: "Urgency", align: "center" },
        { label: "Basis / Reason" },
      ],
      analytics.procurementRecommendations.map((r) => [
        r.id,
        r.item,
        r.supplier,
        `${r.recommendedQty.toLocaleString()} ${r.unit}`,
        r.urgency,
        r.reason,
      ]),
    );
  }

  // 4. Inventory Demand Forecast
  if (analytics.inventoryForecasts) {
    renderSection(
      "4. INVENTORY DEMAND FORECAST (30-DAY PROJECTION)",
      [
        { label: "SKU" },
        { label: "Item Name" },
        { label: "Current Stock", align: "right" },
        { label: "30-Day Demand", align: "right" },
        { label: "Days Left", align: "right" },
        { label: "Urgency", align: "center" },
      ],
      analytics.inventoryForecasts.map((f) => [
        f.sku,
        f.item,
        `${f.currentStock.toLocaleString()} ${f.unit}`,
        `${f.forecastedDemand.toLocaleString()} ${f.unit}`,
        `~${f.daysRemaining}d`,
        f.urgency,
      ]),
    );
  }

  // 5. Supplier Performance
  if (analytics.supplierPerformance) {
    renderSection(
      "5. SUPPLIER PERFORMANCE",
      [
        { label: "Supplier" },
        { label: "On-Time Rate", align: "right" },
        { label: "Avg Lead Time", align: "right" },
        { label: "Defect Rate", align: "right" },
      ],
      analytics.supplierPerformance.map((s) => [
        s.supplier,
        `${s.onTimeRate}%`,
        `${s.avgLeadDays}d`,
        `${s.defectRate}%`,
      ]),
    );
  }

  // 6. Inventory Distribution
  if (analytics.inventoryDistribution) {
    const total = analytics.inventoryDistribution.reduce((sum, c) => sum + c.value, 0) || 1;
    renderSection(
      "6. INVENTORY DISTRIBUTION BY CATEGORY",
      [
        { label: "Category" },
        { label: "Active Items", align: "right" },
        { label: "Share", align: "right" },
      ],
      analytics.inventoryDistribution.map((c) => [
        c.name,
        c.value,
        `${Math.round((c.value / total) * 100)}%`,
      ]),
    );
  }

  // 7. Production Quality
  if (analytics.productionQuality) {
    const total = analytics.productionQuality.reduce((sum, q) => sum + q.value, 0) || 1;
    renderSection(
      "7. PRODUCTION QUALITY OUTCOMES",
      [
        { label: "Outcome" },
        { label: "Batches", align: "right" },
        { label: "Share", align: "right" },
      ],
      analytics.productionQuality.map((q) => [
        q.name,
        q.value,
        `${Math.round((q.value / total) * 100)}%`,
      ]),
    );
  }

  // 8. Distribution Analytics
  if (analytics.distribution) {
    renderSection(
      "8. DISTRIBUTION ANALYTICS BY BRANCH",
      [
        { label: "Branch / Destination" },
        { label: "Received", align: "right" },
        { label: "Total Transfers", align: "right" },
      ],
      analytics.distribution.map((d) => [d.branch, d.received, d.transfers]),
    );
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #18181B; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col style="width:200px;" />
      <col style="width:220px;" />
      <col style="width:200px;" />
      <col style="width:150px;" />
      <col style="width:110px;" />
      <col style="width:320px;" />
    </colgroup>
    <tr>
      <td colspan="4" style="font-size:15pt;font-weight:700;color:#18181B;padding:6px 12px;border:none;">BREN RAPHAEL'S UBE JAM &amp; HALAYA</td>
      <td colspan="2" style="font-size:11pt;font-weight:700;color:#5B2A86;text-align:right;padding:6px 12px;border:none;">DASHBOARD ANALYTICS REPORT</td>
    </tr>
    <tr>
      <td colspan="4" style="font-size:9.5pt;color:#52525B;padding:2px 12px;border:none;">Block 14 Lot1A, Marigman St., San Roque, Antipolo, 1870 Rizal</td>
      <td colspan="2" style="font-size:9.5pt;color:#18181B;text-align:right;padding:2px 12px;border:none;"><strong>Period:</strong> ${escapeHtml(periodText)}</td>
    </tr>
    <tr>
      <td colspan="4" style="font-size:9.5pt;color:#52525B;padding:2px 12px 10px 12px;border-bottom:2px solid #18181B;">Contact: (02) 8650-1234 | info@brenraphaels.com</td>
      <td colspan="2" style="font-size:9.5pt;color:#52525B;text-align:right;padding:2px 12px 10px 12px;border-bottom:2px solid #18181B;">Generated: ${escapeHtml(meta.date)} ${escapeHtml(meta.time)}</td>
    </tr>
    ${sections.join("")}
  </table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF", html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const suffix = analytics.dateRange
    ? `${analytics.dateRange.from}_to_${analytics.dateRange.to}`
    : meta.stamp;
  const link = document.createElement("a");
  link.href = url;
  link.download = `bren-raphaels-dashboard-${suffix}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a formatted A4 PDF report matching the Bren Raphael's PO / PR PDF header and tables.
 */
export async function downloadDashboardPdf(analytics: DashboardAnalytics) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const meta = formatGeneratedMeta(analytics.generatedAt);
  const periodText = formatPeriodLabel(analytics);

  // Company Header (matches PO / PR PDF)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("BREN RAPHAEL'S UBE JAM & HALAYA", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Block 14 Lot1A, Marigman St., San Roque,", 14, 25);
  doc.text("Antipolo, 1870 Rizal", 14, 29);
  doc.text("Contact: (02) 8650-1234 | info@brenraphaels.com", 14, 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(91, 42, 134);
  doc.text("DASHBOARD ANALYTICS REPORT", 196, 20, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(periodText, 196, 26, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${meta.date} ${meta.time}`, 196, 32, { align: "right" });

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(14, 38, 196, 38);

  let cursorY = 44;

  const addTable = (title: string, head: string[], body: (string | number)[][]) => {
    if (cursorY > 255) {
      doc.addPage();
      cursorY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(42, 15, 63);
    doc.text(title, 14, cursorY);

    autoTable(doc, {
      startY: cursorY + 3,
      head: [head],
      body: body.length ? body : [["No records available for this period.", ...Array(head.length - 1).fill("")]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [220, 220, 226], lineWidth: 0.25 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 243, 251] },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY + 20) + 10;
  };

  const kpiRows: (string | number)[][] = [];
  if (analytics.kpis.activeInventory) kpiRows.push(["Active Inventory", analytics.kpis.activeInventory.value, analytics.kpis.activeInventory.unit]);
  if (analytics.kpis.lowStockAlerts) kpiRows.push(["Low Stock Alerts", analytics.kpis.lowStockAlerts.value, analytics.kpis.lowStockAlerts.unit]);
  if (analytics.kpis.productionBatches) kpiRows.push(["Production Batches", analytics.kpis.productionBatches.value, analytics.kpis.productionBatches.unit]);
  if (analytics.kpis.activeSuppliers) kpiRows.push(["Active Suppliers", analytics.kpis.activeSuppliers.value, analytics.kpis.activeSuppliers.unit]);
  if (kpiRows.length) addTable("KEY PERFORMANCE INDICATORS", ["Metric", "Value", "Unit"], kpiRows);

  if (analytics.procurementTrend) {
    addTable(
      "PROCUREMENT TREND",
      ["Period", "Purchase Orders", "Order Value (PHP K)"],
      analytics.procurementTrend.map((m) => [m.month, m.orders, `PHP ${m.valueK.toLocaleString()}K`]),
    );
  }

  if (analytics.procurementRecommendations) {
    addTable(
      "PROCUREMENT RECOMMENDATIONS",
      ["Code", "Item", "Supplier", "Order Qty", "Urgency"],
      analytics.procurementRecommendations.map((r) => [r.id, r.item, r.supplier, `${r.recommendedQty} ${r.unit}`, r.urgency]),
    );
  }

  if (analytics.inventoryForecasts) {
    addTable(
      "INVENTORY DEMAND FORECAST",
      ["SKU", "Item", "Current Stock", "30-Day Demand", "Days Left", "Urgency"],
      analytics.inventoryForecasts.map((f) => [f.sku, f.item, `${f.currentStock} ${f.unit}`, `${f.forecastedDemand} ${f.unit}`, `~${f.daysRemaining}d`, f.urgency]),
    );
  }

  if (analytics.supplierPerformance) {
    addTable(
      "SUPPLIER PERFORMANCE",
      ["Supplier", "On-Time Rate", "Avg Lead Time", "Defect Rate"],
      analytics.supplierPerformance.map((s) => [s.supplier, `${s.onTimeRate}%`, `${s.avgLeadDays}d`, `${s.defectRate}%`]),
    );
  }

  if (analytics.inventoryDistribution) {
    const total = analytics.inventoryDistribution.reduce((s, c) => s + c.value, 0) || 1;
    addTable(
      "INVENTORY DISTRIBUTION",
      ["Category", "Active Items", "Share"],
      analytics.inventoryDistribution.map((c) => [c.name, c.value, `${Math.round((c.value / total) * 100)}%`]),
    );
  }

  if (analytics.productionQuality) {
    const total = analytics.productionQuality.reduce((s, q) => s + q.value, 0) || 1;
    addTable(
      "PRODUCTION QUALITY",
      ["Outcome", "Batches", "Share"],
      analytics.productionQuality.map((q) => [q.name, q.value, `${Math.round((q.value / total) * 100)}%`]),
    );
  }

  if (analytics.distribution) {
    addTable(
      "DISTRIBUTION ANALYTICS",
      ["Branch", "Received", "Transfers"],
      analytics.distribution.map((d) => [d.branch, d.received, d.transfers]),
    );
  }

  const suffix = analytics.dateRange
    ? `${analytics.dateRange.from}_to_${analytics.dateRange.to}`
    : meta.stamp;
  doc.save(`bren-raphaels-dashboard-${suffix}.pdf`);
}
