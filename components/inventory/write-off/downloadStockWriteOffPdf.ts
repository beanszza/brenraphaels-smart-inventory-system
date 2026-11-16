import type { StockWriteOffDto } from "./types";

const fmtDate = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtMoney = (n: number) =>
  `PHP ${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function downloadStockWriteOffPdf(swo: StockWriteOffDto) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });

  // Company Header (same style as PR / PO reports)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("BREN RAPHAEL'S UBE JAM & HALAYA", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("Stock Write-Off Summary Report", 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 14, 29.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("STOCK WRITE-OFF NO:", 196, 20, { align: "right" });
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(swo.swoNumber, 196, 26, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`STATUS: ${swo.status.toUpperCase()}`, 196, 31.5, { align: "right" });

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);

  let y = 41;
  const ensureSpace = (needed = 28) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 18;
    }
  };
  const sectionTitle = (title: string) => {
    ensureSpace(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(91, 42, 134);
    doc.text(title, 14, y);
    y += 4;
  };
  const nextY = () => ((doc as any).lastAutoTable?.finalY ?? y) + 7;

  // Section 1: Write-Off Overview
  sectionTitle("1. STOCK WRITE-OFF INFORMATION");

  const totalLotLines = swo.items.reduce((acc, it) => acc + it.lines.length, 0);
  const infoRows: string[][] = [
    ["Write-Off Number", swo.swoNumber, "Status", swo.status],
    [
      "Requested By",
      swo.requestedByName || swo.requestedBy || "—",
      "Request Date",
      fmtDateTime(swo.requestedAt),
    ],
    [
      "Items Count",
      `${swo.items.length} item(s) / ${totalLotLines} lot line(s)`,
      "Total Write-Off Value",
      fmtMoney(swo.totalValue),
    ],
  ];

  if (swo.approvedByName || swo.approvedBy) {
    infoRows.push([
      "Approved By",
      swo.approvedByName || swo.approvedBy || "—",
      "Approved Date",
      fmtDateTime(swo.approvedAt),
    ]);
  }
  if (swo.removedByName || swo.removedBy) {
    infoRows.push([
      "Removed From Inventory By",
      swo.removedByName || swo.removedBy || "—",
      "Removed Date",
      fmtDateTime(swo.removedAt),
    ]);
  }
  if (swo.rejectedByName || swo.rejectedBy) {
    infoRows.push([
      "Rejected By",
      swo.rejectedByName || swo.rejectedBy || "—",
      "Rejected Date",
      fmtDateTime(swo.rejectedAt),
    ]);
  }
  if (swo.cancelledByName || swo.cancelledBy) {
    infoRows.push([
      "Cancelled By",
      swo.cancelledByName || swo.cancelledBy || "—",
      "Cancelled Date",
      fmtDateTime(swo.cancelledAt),
    ]);
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [243, 240, 248], textColor: [30, 30, 30], fontStyle: "bold" },
    head: [["Field", "Details", "Field", "Details"]],
    body: infoRows,
  });
  y = nextY();

  // Section 2: Items & Lot Breakdown
  sectionTitle("2. WRITE-OFF ITEMS & BATCH / LOT DETAILS");

  const lineRows: string[][] = [];
  swo.items.forEach((item, idx) => {
    const itemDisplay = item.variantName
      ? `${item.itemName} (${item.variantName})`
      : item.itemName;
    item.lines.forEach((line) => {
      const reasonDisplay =
        line.reason === "Other" && line.reasonOther
          ? `Other: ${line.reasonOther}`
          : line.reason;
      const dispDisplay =
        line.disposition === "Other" && line.dispositionOther
          ? `Other: ${line.dispositionOther}`
          : line.disposition;
      const expiryDisplay = item.hasExpiry ? fmtDate(line.expiryDate) : "N/A";
      lineRows.push([
        String(idx + 1),
        `${itemDisplay}\n[${item.itemType}]`,
        line.lotCode,
        expiryDisplay,
        `${line.quantity.toLocaleString()} ${item.uomName}`,
        fmtMoney(line.unitCost),
        fmtMoney(line.lineValue),
        reasonDisplay,
        dispDisplay,
        line.remarks || "—",
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255], fontStyle: "bold" },
    head: [
      [
        "#",
        "Item & Type",
        "Batch / Lot",
        "Expiry",
        "Affected Qty",
        "Unit Cost",
        "Line Value",
        "Reason",
        "Disposition",
        "Condition / Remarks",
      ],
    ],
    body: lineRows,
    foot: [
      [
        "",
        "TOTAL WRITE-OFF VALUE",
        "",
        "",
        "",
        "",
        fmtMoney(swo.totalValue),
        "",
        "",
        "",
      ],
    ],
    footStyles: { fillColor: [243, 240, 248], textColor: [20, 20, 20], fontStyle: "bold" },
  });
  y = nextY();

  // Section 3: Remarks & Admin Feedback
  if (swo.generalRemarks || swo.approvalNotes || swo.rejectionReason || swo.cancelReason) {
    sectionTitle("3. REMARKS & REVIEW NOTES");
    const noteRows: string[][] = [];
    if (swo.generalRemarks) {
      noteRows.push(["General Remarks", swo.generalRemarks]);
    }
    if (swo.approvalNotes) {
      noteRows.push(["Admin Approval Notes", swo.approvalNotes]);
    }
    if (swo.rejectionReason) {
      noteRows.push(["Rejection Reason", swo.rejectionReason]);
    }
    if (swo.cancelReason) {
      noteRows.push(["Cancellation Reason", swo.cancelReason]);
    }
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [243, 240, 248], textColor: [30, 30, 30], fontStyle: "bold" },
      head: [["Note Type", "Details"]],
      body: noteRows,
    });
    y = nextY();
  }

  // Signature Block
  ensureSpace(35);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);

  doc.line(14, y + 12, 68, y + 12);
  doc.text("Requested By:", 14, y + 17);
  doc.setFont("helvetica", "normal");
  doc.text(swo.requestedByName || swo.requestedBy || "Inventory Manager", 14, y + 22);

  doc.setFont("helvetica", "bold");
  doc.line(78, y + 12, 132, y + 12);
  doc.text("Reviewed / Approved By:", 78, y + 17);
  doc.setFont("helvetica", "normal");
  doc.text(
    swo.approvedByName || swo.rejectedByName || swo.approvedBy || "Administrator",
    78,
    y + 22
  );

  doc.setFont("helvetica", "bold");
  doc.line(142, y + 12, 196, y + 12);
  doc.text("Removed From Inventory By:", 142, y + 17);
  doc.setFont("helvetica", "normal");
  doc.text(swo.removedByName || swo.removedBy || "—", 142, y + 22);

  doc.save(`${swo.swoNumber}-Stock-Write-Off-Report.pdf`);
}
