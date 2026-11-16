import type { StockWriteOffDto } from "./types";

export async function downloadStockWriteOffPdf(swo: StockWriteOffDto) {
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

    // 1. Company Header (Top Left - Matches Delivery / PO / PR Reports)
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
    doc.text("STOCK WRITE-OFF REPORT", 196, 20, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(swo.swoNumber, 196, 26, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`STATUS: ${swo.status.toUpperCase()}`, 196, 32, { align: "right" });

    // Top Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, 38, 196, 38);

    // 2. Write-Off Details (Left & Right Columns)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("WRITE-OFF INFORMATION:", 14, 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text((swo.requestedByName || swo.requestedBy || "—").toUpperCase(), 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Requested By: ${swo.requestedByName || swo.requestedBy}`, 14, 55.5);
    doc.text(`Request Date: ${fmtDate(swo.requestedAt)}`, 14, 60);
    if (swo.approvedByName || swo.approvedBy) {
      doc.text(`Approved By: ${swo.approvedByName || swo.approvedBy} (${fmtDate(swo.approvedAt)})`, 14, 64.5);
    }
    if (swo.removedByName || swo.removedBy) {
      doc.text(`Removed By: ${swo.removedByName || swo.removedBy} (${fmtDate(swo.removedAt)})`, 14, 69);
    }

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DOCUMENT REFERENCE:", 196, 45, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(swo.swoNumber, 196, 50, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Items: ${swo.items.length}`, 196, 55.5, { align: "right" });
    doc.text(`Report Generated: ${reportDate} ${reportTime}`, 196, 60, { align: "right" });
    if (swo.generalRemarks) {
      doc.text(`Remarks: ${swo.generalRemarks.slice(0, 45)}`, 196, 64.5, { align: "right" });
    }

    const infoBottomY = swo.removedByName ? 74 : 70;

    // Section Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, infoBottomY, 196, infoBottomY);

    // 3. Written-Off Items Table (NO Price, NO Cost, NO Total Value)
    const tableData: string[][] = [];
    let rowIdx = 1;
    let totalQty = 0;

    for (const item of swo.items) {
      const isFinishedGood =
        (item.itemType || "").toLowerCase().includes("finished") || Boolean(item.variantName);
      const name = item.variantName ? `${item.itemName} — ${item.variantName}` : item.itemName;

      for (const line of item.lines) {
        totalQty += Number(line.quantity || 0);
        const reason =
          line.reason === "Other" && line.reasonOther ? `Other: ${line.reasonOther}` : line.reason;
        const disposition =
          line.disposition === "Other" && line.dispositionOther
            ? `Other: ${line.dispositionOther}`
            : line.disposition;

        tableData.push([
          String(rowIdx++),
          name,
          item.itemType,
          line.lotCode,
          item.hasExpiry && line.expiryDate ? fmtDate(line.expiryDate) : "—",
          isFinishedGood ? `${line.quantity}` : `${line.quantity} ${item.uomName}`,
          reason,
          disposition,
        ]);
      }
    }

    autoTable(doc, {
      startY: infoBottomY + 4,
      head: [
        [
          "#",
          "ITEM NAME",
          "CATEGORY",
          "BATCH / LOT NO.",
          "EXPIRY DATE",
          "AFFECTED QTY",
          "REASON",
          "DISPOSITION",
        ],
      ],
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
        1: { cellWidth: 42, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 24, halign: "left" },
        3: { cellWidth: 32, halign: "left", fontStyle: "bold" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 22, halign: "right", fontStyle: "bold" },
        6: { cellWidth: 24, halign: "left" },
        7: { cellWidth: 24, halign: "left" },
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 4;

    // 4. Total Quantity Summary (NO Total Value!)
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, currentY, 196, currentY);

    currentY += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text("TOTAL WRITTEN-OFF QUANTITY", 14, currentY);

    doc.setFontSize(10.5);
    doc.text(`${totalQty.toLocaleString()} unit(s)`, 196, currentY, { align: "right" });

    currentY += 4;
    doc.line(14, currentY, 196, currentY);

    // 5. Signatures Section (Matches Official Report Template)
    if (currentY + 38 > 275) {
      doc.addPage();
      currentY = 25;
    } else {
      currentY += 12;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("REQUESTED BY:", 14, currentY);
    doc.text("APPROVED BY:", 80, currentY);
    doc.text("REMOVED FROM INVENTORY BY:", 145, currentY);

    currentY += 15;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);
    doc.line(14, currentY, 68, currentY);
    doc.line(80, currentY, 134, currentY);
    doc.line(145, currentY, 196, currentY);

    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    doc.text(swo.requestedByName || swo.requestedBy || "Inventory Personnel", 14, currentY);
    doc.text(swo.approvedByName || swo.approvedBy || "Operations Manager / Admin", 80, currentY);
    doc.text(swo.removedByName || swo.removedBy || "Inventory Manager", 145, currentY);

    currentY += 4;
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(fmtDate(swo.requestedAt), 14, currentY);
    doc.text(swo.approvedAt ? fmtDate(swo.approvedAt) : "—", 80, currentY);
    doc.text(swo.removedAt ? fmtDate(swo.removedAt) : "—", 145, currentY);

    // Footer on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 130);
      doc.text(
        `Bren Raphael's IMS — Stock Write-Off Document ${swo.swoNumber} | Page ${i} of ${pageCount}`,
        14,
        288
      );
    }

    doc.save(`${swo.swoNumber}_Report.pdf`);
  } catch (error) {
    console.error("Failed to generate Stock Write-Off PDF report:", error);
  }
}
