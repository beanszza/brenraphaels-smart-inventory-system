import { Delivery } from "../types";

export async function downloadDeliveryReportPdf(delivery: Delivery) {
  try {
    const jspdfModule = await import("jspdf");
    const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule as any).default || autoTableModule;

    const doc = new jsPDF({ format: "a4", orientation: "portrait" });

    const fmtDate = (d?: string) =>
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
    doc.text("DELIVERY ARRIVAL REPORT", 196, 20, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(delivery.deliveryNumber || "DLV-REPORT", 196, 26, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`STATUS: ${(delivery.status || "ARRIVED").toUpperCase()}`, 196, 32, { align: "right" });

    // Top Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, 38, 196, 38);

    // 2. Supplier & Delivery Details (Left & Right Columns)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("VENDOR / SUPPLIER:", 14, 45);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text((delivery.supplierName || "—").toUpperCase(), 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Destination: ${delivery.receivingLocationName || "Commissary (Receiving Bay)"}`, 14, 55.5);
    doc.text(`Payment Terms: ${delivery.paymentType || "Payable"}`, 14, 60);
    doc.text(`Received By: ${delivery.receivedBy || "Vince Neil Madeja"}`, 14, 64.5);

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("PURCHASE ORDER REF:", 196, 45, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text(delivery.poNumber || "—", 196, 50, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Scheduled Date: ${fmtDate(delivery.scheduledDate)}`, 196, 55.5, { align: "right" });
    doc.text(`Actual Arrival Date: ${fmtDate(delivery.actualArrivalDate || new Date().toISOString())}`, 196, 60, {
      align: "right",
    });
    doc.text(`Report Generated: ${reportDate} ${reportTime}`, 196, 64.5, { align: "right" });

    const infoBottomY = 70;

    // Section Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, infoBottomY, 196, infoBottomY);

    // 3. Arrived Items Table
    const tableData = (delivery.items || []).map((item, idx) => {
      const supplyNo = item.itemCode || `SPL-${String(item.itemId || idx + 1).padStart(4, "0")}`;
      const poQty = Number(item.poOrderedQuantity || item.declaredQuantity || 0).toLocaleString();
      const arrivedQty = Number(item.declaredQuantity || 0).toLocaleString();
      return [
        String(idx + 1),
        supplyNo,
        item.itemName || "—",
        item.purchaseUomName || "Unit",
        poQty,
        arrivedQty,
      ];
    });

    autoTable(doc, {
      startY: infoBottomY + 4,
      head: [["#", "SUPPLY NO.", "PARTICULARS", "UOM", "PO QTY", "ARRIVED QTY"]],
      body: tableData,
      theme: "plain",
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        textColor: [30, 30, 30],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        textColor: [10, 10, 10],
        fontStyle: "bold",
        fontSize: 8.5,
        lineColor: [30, 30, 30],
        lineWidth: 0.6,
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 30, halign: "left", fontStyle: "bold" },
        2: { cellWidth: 68, halign: "left" },
        3: { cellWidth: 22, halign: "left" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 4;

    // 4. Total Shipment Quantity Summary
    const totalShipmentQty = (delivery.items || []).reduce(
      (sum, it) => sum + (Number(it.declaredQuantity) || 0),
      0
    );

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, currentY, 196, currentY);

    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text("TOTAL ARRIVED SHIPMENT QUANTITY", 14, currentY);

    doc.setFontSize(11);
    doc.text(`${totalShipmentQty.toLocaleString()} item unit(s)`, 196, currentY, { align: "right" });

    currentY += 4;
    doc.line(14, currentY, 196, currentY);

    // 5. Signatures Section
    currentY += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text("RECEIVED & CONFIRMED BY (INVENTORY MANAGEMENT):", 14, currentY);
    doc.text("DELIVERED BY (SUPPLIER / CARRIER REPRESENTATIVE):", 115, currentY);

    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text((delivery.receivedBy || "VINCE NEIL MADEJA").toUpperCase(), 14, currentY);
    doc.text((delivery.supplierName || "AUTHORIZED REPRESENTATIVE").toUpperCase(), 115, currentY);

    currentY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Date Received: ${fmtDate(delivery.actualArrivalDate || new Date().toISOString())}`,
      14,
      currentY
    );
    doc.text(`Ref: ${delivery.poNumber || "—"} | ${delivery.deliveryNumber}`, 115, currentY);

    // Document Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This is an official Delivery Arrival Report generated by Bren Raphael's Inventory Management System.",
      105,
      282,
      { align: "center" }
    );

    doc.save(`Delivery-Report-${delivery.deliveryNumber || "Arrival"}.pdf`);
  } catch (error) {
    console.error("Failed to generate Delivery Report PDF:", error);
    window.print();
  }
}

