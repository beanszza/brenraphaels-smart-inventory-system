export interface RequisitionLifecycleReportData {
  requisition: {
    prId: number;
    prNumber: string;
    department: string;
    requestedBy: string;
    requestDate: string | Date;
    requiredDate: string | Date;
    status: string;
    priority: string;
    purpose: string;
    notes?: string | null;
    adminNotes?: string | null;
    items: Array<{
      itemName: string;
      itemCode: string;
      uomName: string;
      requestedQuantity: number;
    }>;
  };
  purchaseOrders: Array<{
    poId: number;
    poNumber: string;
    supplierName: string;
    status: string;
    paymentType: string;
    orderDate: string;
    expectedArrivalDate: string;
    totalAmount: number;
    requestedBy: string;
    items: Array<{ itemName: string; quantity: number; uom: string; totalPrice: number }>;
  }>;
  deliveries: Array<{
    deliveryId: number;
    deliveryNumber: string;
    poNumber: string;
    supplierName: string;
    locationName: string;
    status: string;
    scheduledDate: string;
    dispatchedDate: string | null;
    actualArrivalDate: string | null;
    carrier: string;
    trackingNumber: string;
    driverName: string;
    receivedBy: string;
    items: Array<{ itemName: string; declaredQuantity: number; uom: string }>;
  }>;
  goodsReceipts: Array<{
    grnId: number;
    grnNumber: string;
    poNumber: string;
    deliveryNumber: string;
    locationName: string;
    status: string;
    receivedDate: string;
    receivedBy: string;
    items: Array<{
      itemName: string;
      orderedQuantity: number;
      declaredQuantity: number | null;
      deliveredQuantity: number;
      varianceQuantity: number;
      varianceType: string;
      uom: string;
    }>;
  }>;
  qualityInspections: Array<{
    inspectionNumber: string;
    grnNumber: string;
    inspectorName: string;
    status: string;
    inspectionDate: string;
    completedAt: string | null;
    totalReceived: number;
    totalAccepted: number;
    totalRejected: number;
    overallNotes: string;
    items: Array<{
      itemName: string;
      deliveredQuantity: number;
      acceptedQuantity: number;
      rejectedQuantity: number;
      concessionQuantity: number;
      defectReason: string;
    }>;
  }>;
  discrepancies: Array<{
    discrepancyNumber: string;
    discrepancyType: string;
    grnNumber: string;
    poNumber: string;
    itemName: string;
    discrepancyQuantity: number;
    status: string;
    resolutionType: string;
    resolutionNotes: string;
    resolvedBy: string;
    resolvedAt: string | null;
  }>;
  lossReports: Array<{
    lossReportNumber: string;
    itemName: string;
    lostQuantity: number;
    uom: string;
    reason: string;
    isAcknowledged: boolean;
    acknowledgedBy: string;
    createdAt: string;
  }>;
  returns: Array<{
    rtvNumber: string;
    supplierName: string;
    itemName: string;
    returnedQuantity: number;
    reason: string;
    status: string;
    dispatchedDate: string | null;
  }>;
  stockIns: Array<{
    stockInNumber: string;
    grnNumber: string;
    status: string;
    createdBy: string;
    committedBy: string;
    committedAt: string | null;
    lines: Array<{
      itemName: string;
      quantityToStock: number;
      uom: string;
      lotCode: string;
      locationName: string;
      unitCost: number;
      expiryDate: string | null;
      committedToInventory: boolean;
    }>;
  }>;
}

const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const fmtMoney = (n: number) =>
  `PHP ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function downloadRequisitionReportPdf(report: RequisitionLifecycleReportData) {
  const jspdfModule = await import("jspdf");
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = (autoTableModule as any).default || autoTableModule;

  const doc = new jsPDF({ format: "a4", orientation: "portrait" });
  const { requisition: pr } = report;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text("BREN RAPHAEL'S UBE JAM & HALAYA", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("End-to-End Procurement Lifecycle Report", 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 14, 29.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("PURCHASE REQUISITION NO:", 196, 20, { align: "right" });
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(pr.prNumber, 196, 26, { align: "right" });
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(`STATUS: ${pr.status.toUpperCase()} | PRIORITY: ${pr.priority.toUpperCase()}`, 196, 31.5, { align: "right" });

  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);

  let y = 41;
  const ensureSpace = (needed = 28) => {
    if (y + needed > 278) {
      doc.addPage();
      y = 18;
    }
  };
  const sectionTitle = (title: string) => {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(91, 42, 134);
    doc.text(title, 14, y);
    y += 4;
  };
  const nextY = () => ((doc as any).lastAutoTable?.finalY ?? y) + 7;

  // Section 1: PR Summary & Items
  sectionTitle("1. PURCHASE REQUISITION DETAILS");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [243, 240, 248], textColor: [30, 30, 30], fontStyle: "bold" },
    head: [["Field", "Details", "Field", "Details"]],
    body: [
      ["Requested By", pr.requestedBy || "—", "Department", pr.department || "Inventory"],
      ["Request Date", fmtDate(pr.requestDate), "Required Date", fmtDate(pr.requiredDate)],
      ["Purpose", pr.purpose || "—", "Priority", pr.priority || "Medium"],
      ...(pr.notes ? [["Notes", pr.notes, "Status", pr.status]] : []),
    ],
  });
  y = nextY();

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
    head: [["Supply Code", "Item Name", "UOM", "Requested Qty"]],
    body: pr.items.map((i) => [i.itemCode, i.itemName, i.uomName, String(i.requestedQuantity)]),
  });
  y = nextY();

  // Section 2: Ordering (Purchase Orders)
  sectionTitle("2. ORDERING — PURCHASE ORDERS");
  if (report.purchaseOrders.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text("No Purchase Orders recorded.", 14, y + 2);
    y += 9;
  } else {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["PO No.", "Supplier", "Order Date", "Status", "Items Ordered", "Total Amount"]],
      body: report.purchaseOrders.map((po) => [
        po.poNumber,
        po.supplierName || "—",
        fmtDate(po.orderDate),
        po.status,
        po.items.map((it) => `${it.itemName}: ${it.quantity} ${it.uom}`).join("; "),
        fmtMoney(po.totalAmount),
      ]),
    });
    y = nextY();
  }

  // Section 3: Deliveries
  sectionTitle("3. DELIVERY LOGISTICS");
  if (report.deliveries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text("No Deliveries recorded.", 14, y + 2);
    y += 9;
  } else {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["Delivery No.", "PO Ref", "Status", "Dispatched", "Arrived", "Items Declared"]],
      body: report.deliveries.map((d) => [
        d.deliveryNumber,
        d.poNumber,
        d.status,
        fmtDate(d.dispatchedDate),
        fmtDate(d.actualArrivalDate),
        d.items.map((it) => `${it.itemName}: ${it.declaredQuantity} ${it.uom}`).join("; "),
      ]),
    });
    y = nextY();
  }

  // Section 4: Receiving, QA, Discrepancies, Loss Reports & Returns
  sectionTitle("4. RECEIVING & QUALITY ASSURANCE");
  if (report.goodsReceipts.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["GRN No.", "Delivery Ref", "Received Date", "Received By", "Status", "Line Summary"]],
      body: report.goodsReceipts.map((g) => [
        g.grnNumber,
        g.deliveryNumber || "—",
        fmtDate(g.receivedDate),
        g.receivedBy || "—",
        g.status,
        g.items
          .map((gi) => `${gi.itemName}: ${gi.deliveredQuantity} ${gi.uom} (${gi.varianceType}${gi.varianceQuantity ? ` ${gi.varianceQuantity}` : ""})`)
          .join("; "),
      ]),
    });
    y = nextY();
  }

  if (report.qualityInspections.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["QA Inspection", "GRN Ref", "Inspector", "Status", "Accepted / Rejected", "Completed"]],
      body: report.qualityInspections.map((q) => [
        q.inspectionNumber,
        q.grnNumber,
        q.inspectorName || "—",
        q.status,
        `${q.totalAccepted} accepted / ${q.totalRejected} rejected`,
        fmtDate(q.completedAt),
      ]),
    });
    y = nextY();
  }

  if (report.discrepancies.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["Discrepancy", "Type", "Item", "Qty", "Resolution", "Status"]],
      body: report.discrepancies.map((d) => [
        d.discrepancyNumber,
        d.discrepancyType,
        d.itemName,
        String(d.discrepancyQuantity),
        d.resolutionType ? `${d.resolutionType}${d.resolutionNotes ? ` (${d.resolutionNotes})` : ""}` : "—",
        d.status,
      ]),
    });
    y = nextY();
  }

  if (report.lossReports.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["Loss Report", "Item", "Lost Qty", "Reason", "Acknowledged"]],
      body: report.lossReports.map((l) => [
        l.lossReportNumber,
        l.itemName,
        `${l.lostQuantity} ${l.uom}`,
        l.reason,
        l.isAcknowledged ? `Yes (${l.acknowledgedBy || "Admin"})` : "No",
      ]),
    });
    y = nextY();
  }

  if (report.returns.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["RTV No.", "Supplier", "Item", "Qty Returned", "Reason", "Status"]],
      body: report.returns.map((r) => [
        r.rtvNumber,
        r.supplierName,
        r.itemName,
        String(r.returnedQuantity),
        r.reason,
        r.status,
      ]),
    });
    y = nextY();
  }

  // Section 5: Inventory Stock-In
  sectionTitle("5. INVENTORY STOCK-IN & LOTS");
  if (report.stockIns.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text("No Inventory Stock-Ins recorded.", 14, y + 2);
    y += 9;
  } else {
    const stockRows = report.stockIns.flatMap((s) =>
      s.lines.map((sl) => [
        s.stockInNumber,
        s.grnNumber,
        sl.itemName,
        sl.lotCode,
        `${sl.quantityToStock} ${sl.uom}`,
        sl.locationName || "—",
        fmtDate(s.committedAt),
        s.status,
      ])
    );
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [91, 42, 134], textColor: [255, 255, 255] },
      head: [["Stock-In No.", "GRN Ref", "Item", "Lot Code", "Stocked Qty", "Location", "Committed", "Status"]],
      body: stockRows,
    });
  }

  doc.save(`${pr.prNumber}-Lifecycle-Report.pdf`);
}

