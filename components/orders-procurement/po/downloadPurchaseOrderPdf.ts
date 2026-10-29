import { PurchaseOrderPO } from "../types";

export async function downloadPurchaseOrderPdf(po: PurchaseOrderPO) {
  try {
    const jspdfModule = await import("jspdf");
    const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default;
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule as any).default || autoTableModule;

    const doc = new jsPDF({ format: "a4", orientation: "portrait" });

    const formattedDate = po.orderDate
      ? new Date(po.orderDate).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-US");

    const formattedTime = po.orderDate
      ? new Date(po.orderDate).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

    const isApproved =
      po.status === "Approved" ||
      po.status === "Ordered" ||
      po.status === "Partially Delivered" ||
      po.status === "Delivered";

    // 1. Company Header (Brigino Layout: Top Left)
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

    // Document Number & Status (Top Right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("PURCHASE ORDER NO:", 196, 20, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(po.poNumber, 196, 26, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`STATUS: ${po.status.toUpperCase()}`, 196, 32, { align: "right" });

    // Top Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, 38, 196, 38);

    // 2. Vendor / Supplier Info (Left) & Date / PR Reference (Right)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("VENDOR / SUPPLIER:", 14, 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text((po.supplierName || "—").toUpperCase(), 14, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    let leftY = 55;
    if (po.supplierAddress) {
      doc.text(`Address: ${po.supplierAddress}`, 14, leftY);
      leftY += 4.5;
    }
    if (po.supplierContactPerson || po.supplierEmail) {
      const contact = [po.supplierContactPerson, po.supplierEmail].filter(Boolean).join(" - ");
      doc.text(`Attention: ${contact}`, 14, leftY);
      leftY += 4.5;
    }

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("DATE / TIME:", 196, 45, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`${formattedDate}  ${formattedTime}`, 196, 50, { align: "right" });

    if (po.prNumber) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("PURCHASE REQUISITION REF:", 196, 56, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text(po.prNumber, 196, 61, { align: "right" });
    }

    const infoBottomY = Math.max(leftY, 66);

    // Section Divider Line
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, infoBottomY, 196, infoBottomY);

    // 3. Table of PARTICULARS (Brigino Format)
    const tableData = (po.items || []).map((item) => {
      const unitPrice =
        item.unitPrice ||
        (item.poItemQuantity > 0 ? item.totalPrice / item.poItemQuantity : 0);
      const hasPrice = unitPrice > 0;
      const formattedUnitPrice = hasPrice
        ? `PHP ${unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "Pending Confirmation";
      const formattedLineTotal =
        item.totalPrice > 0
          ? `PHP ${Number(item.totalPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—";

      return [
        `${item.itemName}\n(Unit of Measure: ${item.purchaseUomName || "Unit"})`,
        `${Number(item.poItemQuantity).toLocaleString()} ${item.purchaseUomName || ""}`,
        formattedUnitPrice,
        formattedLineTotal,
      ];
    });

    autoTable(doc, {
      startY: infoBottomY + 4,
      head: [["PARTICULARS", "QUANTITY", "UNIT PRICE", "AMOUNT"]],
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
        0: { cellWidth: 80, halign: "left" },
        1: { cellWidth: 32, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 40, halign: "right" },
        3: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 4;

    // 4. TOTAL AMOUNT DUE Section
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.6);
    doc.line(14, currentY, 196, currentY);

    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text("TOTAL AMOUNT DUE", 14, currentY);

    const totalStr =
      po.totalAmount > 0
        ? `PHP ${Number(po.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : isApproved
        ? "PHP 0.00"
        : "Pending Confirmation";

    doc.setFontSize(12);
    doc.text(totalStr, 196, currentY, { align: "right" });

    currentY += 4;
    doc.line(14, currentY, 196, currentY);

    // 5. Signatures Section (Prepared by & Approved by)
    currentY += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text("PREPARED BY (INVENTORY MANAGEMENT):", 14, currentY);
    doc.text("APPROVED BY (AUTHORIZED SUPPLIER REPRESENTATIVE):", 115, currentY);

    currentY += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text((po.requestedBy || "VINCE NEIL MADEJA").toUpperCase(), 14, currentY);

    const approverName = po.supplierApprovedBy
      ? po.supplierApprovedBy.toUpperCase()
      : "____________________________________";
    doc.text(approverName, 115, currentY);

    currentY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Inventory Manager - Bren Raphael's Ube Jam & Halaya", 14, currentY);

    const approverDate = po.supplierApprovedDate
      ? new Date(po.supplierApprovedDate).toLocaleDateString("en-US")
      : "_______________";
    doc.text(`Authorized Representative  |  Date: ${approverDate}`, 115, currentY);

    // Document Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This is an official procurement document generated by Bren Raphael's Inventory Management System.",
      105,
      282,
      { align: "center" }
    );

    // Trigger instant download
    doc.save(`Purchase-Order-${po.poNumber}.pdf`);
  } catch (error) {
    console.error("Failed to generate Purchase Order PDF:", error);
    // Fallback: window.print()
    window.print();
  }
}
