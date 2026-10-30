export interface GrnExportItem {
  itemId: number;
  itemName: string;
  itemCode?: string;
  categoryName?: string;
  purchaseUomName?: string;
  declaredQuantity?: number | string | null;
  deliveredQuantity?: number | string | null;
  acceptedQuantity?: number | string | null;
  rejectedQuantity?: number | string | null;
  acceptedReason?: string;
  defectReason?: string;
  supplierLotCode?: string;
  expiryDate?: string | null;
  notes?: string;
}

export interface GrnExportData {
  grnNumber: string;
  deliveryNumber?: string;
  poNumber?: string;
  supplierName?: string;
  carrier?: string;
  deliveryNoteNumber?: string;
  receivedDate?: string | Date;
  status?: string;
  receivedBy?: string;
  inspectorName?: string;
  notes?: string;
  items: GrnExportItem[];
}

export async function downloadGrnReportPdf(data: GrnExportData) {
  try {
    const jspdfModule = await import("jspdf");
    const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule as any).default || autoTableModule;

    const doc = new jsPDF({ format: "a4", orientation: "portrait" });

    const fmtDate = (d?: string | Date | null) =>
      d
        ? new Date(d).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          })
        : "—";

    const reportDate = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    const reportTime = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

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

    // Document Title & Number (Top Right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("GOODS RECEIPT NOTE", 196, 20, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(data.grnNumber || "GRN-REPORT", 196, 26, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`STATUS: ${(data.status || "POSTED").toUpperCase()}`, 196, 32, { align: "right" });

    // Top Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, 38, 196, 38);

    // 2. Vendor / Supplier & Receiving Reference Details (Left & Right Columns)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("VENDOR / SUPPLIER:", 14, 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text((data.supplierName || "—").toUpperCase(), 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Receiving Hub: Factory / Central Commissary", 14, 55.5);
    doc.text(`Carrier / Vehicle: ${data.carrier || "Supplier Fleet"}`, 14, 60);
    doc.text(`Delivery Note / DR: ${data.deliveryNoteNumber || data.deliveryNumber || "—"}`, 14, 64.5);

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("RECEIVING & PO REFERENCE:", 196, 45, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(`DELIVERY: ${data.deliveryNumber || "—"}`, 196, 50, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Purchase Order: ${data.poNumber || "—"}`, 196, 55.5, { align: "right" });
    doc.text(`Received Date: ${fmtDate(data.receivedDate || new Date())}`, 196, 60, { align: "right" });
    doc.text(`Report Generated: ${reportDate} ${reportTime}`, 196, 64.5, { align: "right" });

    const infoBottomY = 70;

    // Section Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, infoBottomY, 196, infoBottomY);

    // 3. Arrived & Inspected Items Table
    const tableData = (data.items || []).map((item, idx) => {
      const supplyNo = item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`;
      const declaredQty = Number(item.declaredQuantity ?? item.deliveredQuantity ?? 0).toLocaleString();
      const deliveredQty = Number(item.deliveredQuantity ?? 0).toLocaleString();
      const acceptedQty = Number(item.acceptedQuantity ?? item.deliveredQuantity ?? 0).toLocaleString();
      const rejectedQty = Number(item.rejectedQuantity ?? 0).toLocaleString();

      const reasons = [
        Number(item.acceptedQuantity ?? 0) > 0 && item.acceptedReason ? `Good: ${item.acceptedReason}` : "",
        Number(item.rejectedQuantity ?? 0) > 0 && item.defectReason ? `Bad: ${item.defectReason}` : "",
        item.notes || "",
      ].filter(Boolean).join(" | ");

      return [
        String(idx + 1),
        supplyNo,
        item.itemName || "—",
        item.purchaseUomName || "Unit",
        declaredQty,
        deliveredQty,
        acceptedQty,
        rejectedQty,
        reasons || "Meets Standard",
      ];
    });

    autoTable(doc, {
      startY: infoBottomY + 4,
      head: [["#", "SUPPLY NO.", "PARTICULARS", "UOM", "DECLARED", "RECEIVED", "GOOD", "BAD", "STATUS / REASON"]],
      body: tableData,
      theme: "plain",
      styles: {
        fontSize: 8,
        cellPadding: 3.5,
        textColor: [30, 30, 30],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        textColor: [10, 10, 10],
        fontStyle: "bold",
        fontSize: 8,
        lineColor: [30, 30, 30],
        lineWidth: 0.6,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 26, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 46, halign: "left" },
        3: { cellWidth: 16, halign: "left" },
        4: { cellWidth: 16, halign: "right" },
        5: { cellWidth: 16, halign: "right" },
        6: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [16, 120, 60] },
        7: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [180, 20, 20] },
        8: { cellWidth: 20, halign: "left" },
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 4;

    // 4. Totals Summary Line
    const totalDelivered = (data.items || []).reduce(
      (sum, it) => sum + (Number(it.deliveredQuantity) || 0),
      0
    );
    const totalAccepted = (data.items || []).reduce(
      (sum, it) => sum + (Number(it.acceptedQuantity ?? it.deliveredQuantity) || 0),
      0
    );
    const totalRejected = (data.items || []).reduce(
      (sum, it) => sum + (Number(it.rejectedQuantity) || 0),
      0
    );

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, currentY, 196, currentY);

    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text("TOTAL RECEIVING & QUALITY ASSURANCE SUMMARY", 14, currentY);

    doc.setFontSize(9.5);
    doc.text(
      `Received: ${totalDelivered.toLocaleString()} | Accepted: ${totalAccepted.toLocaleString()} | Rejected: ${totalRejected.toLocaleString()}`,
      196,
      currentY,
      { align: "right" }
    );

    currentY += 4;
    doc.line(14, currentY, 196, currentY);

    // Notes Box if present
    if (data.notes) {
      currentY += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("RECEIVING REMARKS:", 14, currentY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(data.notes, 14, currentY + 4);
      currentY += 10;
    }

    // 5. Signatures Section
    currentY += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text("RECEIVED & INSPECTED BY (QUALITY ASSURANCE & RECEIVING):", 14, currentY);
    doc.text("DELIVERED BY (SUPPLIER / CARRIER REPRESENTATIVE):", 115, currentY);

    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text((data.receivedBy || data.inspectorName || "QUALITY ASSURANCE SPECIALIST").toUpperCase(), 14, currentY);
    doc.text((data.carrier || data.supplierName || "AUTHORIZED CARRIER / REPRESENTATIVE").toUpperCase(), 115, currentY);

    currentY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Date Inspected: ${fmtDate(data.receivedDate || new Date())}`,
      14,
      currentY
    );
    doc.text(`Ref: ${data.poNumber || "—"} | ${data.deliveryNumber || "—"}`, 115, currentY);

    // Document Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This is an official Goods Receipt Note generated by Bren Raphael's Inventory Management System.",
      105,
      282,
      { align: "center" }
    );

    doc.save(`GoodsReceiptNote-${data.grnNumber || "Report"}.pdf`);
  } catch (error) {
    console.error("Failed to generate Goods Receipt Note PDF:", error);
    window.print();
  }
}
