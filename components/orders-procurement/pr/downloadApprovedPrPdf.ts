import type { PurchaseRequisition } from "../types";
import { normalizePrPriority } from "@/lib/orders/requisition-lifecycle";

const fmtDate = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

/**
 * Generates and downloads a clean Approved Purchase Requisition PDF document.
 */
export async function downloadApprovedPrPdf(pr: PurchaseRequisition) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as unknown as { default: typeof jspdfModule.jsPDF }).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const priority = normalizePrPriority(pr.priority);
  const requestedBy =
    pr.requestedBy && pr.requestedBy !== "Unauthenticated"
      ? pr.requestedBy
      : "Inventory Manager";

  // Header — Company Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(24, 24, 27);
  doc.text("BREN RAPHAEL'S UBE JAM & HALAYA", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(113, 113, 122);
  doc.text("Approved Purchase Requisition", 14, 25.5);
  doc.text(`Exported: ${new Date().toLocaleString("en-US")}`, 14, 30);

  // Header — PR Number & Status (right-aligned)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text("PURCHASE REQUISITION NO.", 196, 20, { align: "right" });

  doc.setFontSize(13);
  doc.setTextColor(91, 42, 134);
  doc.text(pr.prNumber, 196, 26, { align: "right" });

  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text(
    `STATUS: ${pr.status.toUpperCase()}  |  PRIORITY: ${priority.toUpperCase()}`,
    196,
    31,
    { align: "right" }
  );

  // Divider line
  doc.setDrawColor(230, 225, 238);
  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);

  // Section 1: Requisition Details
  let y = 43;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(91, 42, 134);
  doc.text("REQUISITION DETAILS", 14, y);
  y += 4;

  const detailRows: string[][] = [
    ["Purchase Requisition No.", pr.prNumber, "Status", pr.status],
    ["Request Date", fmtDate(pr.requestDate), "Required Date", fmtDate(pr.requiredDate)],
    ["Requested By", requestedBy, "Department", pr.department || "Inventory"],
    ["Purpose", pr.purpose || pr.requestType || "Stock Replenishment", "Priority", priority],
  ];

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [24, 24, 27], lineColor: [230, 225, 238] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [250, 250, 250], textColor: [82, 82, 91], cellWidth: 42 },
      1: { cellWidth: 49 },
      2: { fontStyle: "bold", fillColor: [250, 250, 250], textColor: [82, 82, 91], cellWidth: 36 },
      3: { cellWidth: 55 },
    },
    body: detailRows,
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 9;

  // Section 2: Requested Items
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(91, 42, 134);
  doc.text(`REQUESTED ITEMS (${pr.items?.length || 0})`, 14, y);
  y += 4;

  const itemsBody =
    pr.items && pr.items.length > 0
      ? pr.items.map((item, idx) => [
          String(idx + 1),
          item.itemName || "—",
          item.itemCode || `SPL-${item.itemId}`,
          item.uomName || "Unit",
          Number(item.actualInventory || 0).toLocaleString(),
          Number(item.requestedQuantity || 0).toLocaleString(),
        ])
      : [["—", "No items listed", "—", "—", "—", "—"]];

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [24, 24, 27] },
    headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    head: [["#", "Supply Name", "Supply No.", "Unit", "Actual Inv.", "Qty (To Order)"]],
    body: itemsBody,
  });

  y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 9;

  // Section 3: Notes (if present)
  if (pr.notes && pr.notes.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(91, 42, 134);
    doc.text("NOTES", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [24, 24, 27], lineColor: [230, 225, 238] },
      body: [[pr.notes.trim()]],
    });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `Total items requested: ${pr.items?.length || 0} item(s)  •  Bren Raphael's Inventory Management System`,
    14,
    pageHeight - 12
  );

  doc.save(`${pr.prNumber}.pdf`);
}
