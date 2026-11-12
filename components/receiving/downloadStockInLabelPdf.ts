export interface StockInLabelPdfInput {
  canvasId: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerCode: string;
  grnNumber: string;
  itemName: string;
  quantityToStock: number | string;
  purchaseUomName: string;
  supplierName?: string;
  lotCode: string;
  expiryDate?: string | null;
  fallbackFileId?: string | number;
}

/**
 * Generates and downloads an individual printable Stock-In QR traceability label PDF.
 */
export async function downloadStockInLabelPdf(label: StockInLabelPdfInput) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as unknown as { default: typeof jspdfModule.jsPDF }).default;

  const doc = new jsPDF({
    format: [110, 68],
    orientation: "landscape",
    unit: "mm",
  });

  // Card border
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.5);
  doc.roundedRect(3, 3, 104, 62, 2.5, 2.5);

  // Header
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(label.headerTitle || "BREN RAPHAEL'S", 7, 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(95, 95, 95);
  doc.text(label.headerSubtitle || "RECEIVING LOT TRACEABILITY TAG", 7, 13.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text(label.headerCode || label.lotCode || "—", 103, 9.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`GRN: ${label.grnNumber || "—"}`, 103, 13.5, { align: "right" });

  // Header divider
  doc.setDrawColor(35, 35, 35);
  doc.setLineWidth(0.4);
  doc.line(7, 16.5, 103, 16.5);

  // QR Box
  doc.setDrawColor(215, 215, 215);
  doc.setLineWidth(0.3);
  doc.roundedRect(7, 19.5, 26, 26, 1.5, 1.5);

  const canvasEl =
    typeof document !== "undefined"
      ? (document.getElementById(label.canvasId) as HTMLCanvasElement | null)
      : null;

  if (canvasEl && typeof canvasEl.toDataURL === "function") {
    const qrDataUrl = canvasEl.toDataURL("image/png");
    doc.addImage(qrDataUrl, "PNG", 8.5, 21, 23, 23);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text("QR Code", 20, 33, { align: "center" });
  }

  // Right details column
  const detailsX = 37;
  const maxDetailsWidth = 65;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  const nameLines = (doc.splitTextToSize(label.itemName || "Unnamed Supply", maxDetailsWidth) as string[]).slice(0, 2);
  doc.text(nameLines, detailsX, 24);

  const detailsAfterNameY = 24 + nameLines.length * 4.5 + 1.5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 95, 95);
  doc.text("Quantity:", detailsX, detailsAfterNameY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`${label.quantityToStock} ${label.purchaseUomName}`, detailsX + 13.5, detailsAfterNameY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 95, 95);
  doc.text("Supplier:", detailsX, detailsAfterNameY + 5);
  doc.setTextColor(20, 20, 20);
  const supplierLines = (doc.splitTextToSize(label.supplierName || "—", maxDetailsWidth - 14) as string[]).slice(0, 2);
  doc.text(supplierLines, detailsX + 13.5, detailsAfterNameY + 5);

  // Footer divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(7, 49.5, 103, 49.5);

  // Footer metadata: Lot Number & Expiry Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.text("LOT NUMBER", 7, 54);
  doc.text("EXPIRY DATE", 103, 54, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(label.lotCode || "—", 7, 59);

  const formattedExpiry = label.expiryDate
    ? new Date(label.expiryDate).toLocaleDateString()
    : "N/A";
  doc.text(formattedExpiry, 103, 59, { align: "right" });

  const safeFileSlug = String(label.lotCode || label.fallbackFileId || "item").replace(/[\\/:*?"<>|]/g, "-");
  doc.save(`Label-${safeFileSlug}.pdf`);
}

