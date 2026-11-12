import type { BatchLifecycleSummaryData } from "@/app/actions/production/batch-detail";

export async function downloadProductionBatchPdf(data: BatchLifecycleSummaryData) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });

  const fmtDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : "—";

  const fmtDateTime = (d?: string | null) =>
    d
      ? new Date(d).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  // 1. Company Header (Top Left)
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

  // Document Title & Batch Number (Top Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("PRODUCTION BATCH REPORT", 196, 20, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(20, 20, 20);
  doc.text(data.batchNumber || `BATCH-${data.batchId}`, 196, 26, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`STATUS: ${(data.status || "IN PRODUCTION").toUpperCase()}`, 196, 32, { align: "right" });

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(14, 38, 196, 38);

  // 2. Product & Production Request Overview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text("1. PRODUCTION REQUEST & PRODUCT DETAILS", 14, 45);

  autoTable(doc, {
    startY: 48,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    headStyles: { fillColor: [242, 242, 242], textColor: [20, 20, 20], fontStyle: "bold" },
    body: [
      ["Request No.", data.request.reqNumber, "Product", `${data.productName} (${data.variant})`],
      ["Recipe", data.recipeName, "Target Output", `${data.request.targetQuantity} ${data.yieldUom}`],
      ["Requested By", data.request.requestedBy, "Approved By", data.request.approvedBy || "—"],
      ["Required Date", fmtDate(data.request.requiredDate), "Priority", data.request.priority],
    ],
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      1: { cellWidth: 59 },
      2: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      3: { cellWidth: 59 },
    },
    margin: { left: 14, right: 14 },
  });

  // 3. Material Issuance & Consumed Lots
  let y = (doc as any).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(
    `2. MATERIAL ISSUANCE (${data.issuance.issuanceNumber}) — Issued By: ${data.issuance.issuedBy} (${fmtDateTime(data.issuance.issuedAt)})`,
    14,
    y
  );

  autoTable(doc, {
    startY: y + 3,
    theme: "grid",
    styles: { fontSize: 7.8, cellPadding: 2, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    headStyles: { fillColor: [242, 242, 242], textColor: [20, 20, 20], fontStyle: "bold" },
    head: [["Ingredient", "Lot Code", "Required Qty", "Used Qty", "QR Verified"]],
    body:
      data.issuance.materials.length > 0
        ? data.issuance.materials.map((m) => [
            m.itemName,
            m.lotCode,
            `${m.requiredQuantity} ${m.uomAbbr}`,
            `${m.quantityUsed} ${m.uomAbbr}`,
            m.verifiedByScan ? "Verified" : "Bypassed / Manual",
          ])
        : [["No material consumption records", "—", "—", "—", "—"]],
    margin: { left: 14, right: 14 },
  });

  // 4. Production Tracking (Cooking Stages)
  y = (doc as any).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(
    `3. PRODUCTION TRACKING — Cook: ${data.production.assignedCook} | Started: ${fmtDateTime(data.production.startedAt)}`,
    14,
    y
  );

  autoTable(doc, {
    startY: y + 3,
    theme: "grid",
    styles: { fontSize: 7.8, cellPadding: 2, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    headStyles: { fillColor: [242, 242, 242], textColor: [20, 20, 20], fontStyle: "bold" },
    head: [["Stage", "End Time", "Completed By", "Notes"]],
    body:
      data.production.stages.length > 0
        ? data.production.stages.map((s) => [s.stage, s.endTime, s.completedBy, s.notes || "—"])
        : [[`Current Stage: ${data.currentStage}`, "—", data.production.assignedCook, "No stage logs recorded"]],
    margin: { left: 14, right: 14 },
  });

  // 5. Packaging & Finished Goods Lot
  y = (doc as any).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("4. PACKAGING & FINISHED GOODS LOT", 14, y);

  autoTable(doc, {
    startY: y + 3,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    body: [
      ["FG Lot Code", (data.packaging.fgLotCode || "").replace(/^FG-/i, "") || "—", "FG Lot Status", data.packaging.fgLotStatus],
      ["Packed Quantity", `${data.packaging.finalQuantity} ${data.yieldUom}`, "Yield %", `${data.packaging.yieldPercentage.toFixed(1)}%`],
      ["Packaged By", data.packaging.packagedBy, "Packaged At", fmtDateTime(data.packaging.packagedAt)],
      ["Expiry Date", fmtDate(data.packaging.expiryDate), "", ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      1: { cellWidth: 59 },
      2: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      3: { cellWidth: 59 },
    },
    margin: { left: 14, right: 14 },
  });

  // 6. QA Inspection & Stock-In
  y = (doc as any).lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("5. QUALITY ASSURANCE & STOCK-IN", 14, y);

  const qaRows = data.qa
    ? [
        ["QA Inspection No.", data.qa.inspectionNumber, "QA Status", data.qa.status],
        ["Inspector", data.qa.inspectorName, "Inspection Date", fmtDateTime(data.qa.inspectionDate)],
        ["Accepted Qty", `${data.qa.totalAcceptedQuantity} ${data.yieldUom}`, "Rejected Qty", `${data.qa.totalRejectedQuantity} ${data.yieldUom}`],
        ["Loss Report No.", data.qa.lossReportNumber || "None", "Remarks", data.qa.remarks || data.qa.acceptedReason || "—"],
      ]
    : [["QA Inspection", "Pending / Not Yet Inspected", "Stock-In", "Pending"]];

  if (data.stockIn) {
    qaRows.push([
      "Stock-In Location",
      data.stockIn.locationName,
      "Stocked In Qty",
      `${data.stockIn.quantity} ${data.yieldUom} (${fmtDateTime(data.stockIn.postedAt)})`,
    ]);
  }

  autoTable(doc, {
    startY: y + 3,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    body: qaRows,
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      1: { cellWidth: 59 },
      2: { fontStyle: "bold", fillColor: [248, 248, 248], cellWidth: 32 },
      3: { cellWidth: 59 },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated on ${fmtDateTime(new Date().toISOString())} | Page ${i} of ${pageCount}`,
      14,
      287
    );
  }

  doc.save(`${data.batchNumber || `BATCH-${data.batchId}`}-Report.pdf`);
}

