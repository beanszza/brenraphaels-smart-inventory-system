"use client";

import React, { useRef } from "react";
import { Printer, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseOrderPO } from "../types";

interface PurchaseOrderPrintDocumentProps {
  po: PurchaseOrderPO | null;
  onClose: () => void;
}

export function PurchaseOrderPrintDocument({ po, onClose }: PurchaseOrderPrintDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!po) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = po.orderDate
    ? new Date(po.orderDate).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });

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

  const isApproved = po.status === "Approved" || po.status === "Ordered" || po.status === "Partially Delivered" || po.status === "Delivered";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      {/* Container Card */}
      <div className="relative w-full max-w-4xl bg-card rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 print:hidden">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Purchase Order Document Preview
            </h2>
            <p className="text-xs text-muted-foreground">
              Official document format for {po.poNumber}. Printable and downloadable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" /> Close
            </Button>
          </div>
        </div>

        {/* Scrollable Printable Page Area */}
        <div className="overflow-y-auto p-6 md:p-10 flex justify-center bg-muted/20">
          
          {/* Printable Sheet (Standard A4/Letter ratio) */}
          <div
            ref={printRef}
            className="w-full max-w-[760px] bg-white text-black p-8 md:p-12 shadow-md border border-neutral-300 font-sans text-xs leading-relaxed print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white print:text-black"
          >
            {/* Header: Company Name Left, Document Number Right */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b border-neutral-900 pb-4 mb-4 gap-4">
              <div>
                <h1 className="text-lg md:text-xl font-black uppercase tracking-wide text-neutral-900">
                  Bren Raphael&apos;s Ube Jam &amp; Halaya
                </h1>
                <p className="text-[11px] text-neutral-700 mt-1 leading-snug">
                  Block 14 Lot1A, Marigman St., San Roque,<br />
                  Antipolo, 1870 Rizal<br />
                  Contact: (02) 8650-1234 | info@brenraphaels.com
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                  DOCUMENT NO.
                </div>
                <div className="text-base md:text-lg font-mono font-black text-neutral-900 mt-0.5">
                  {po.poNumber}
                </div>
                <div className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border border-neutral-400 bg-neutral-100 text-neutral-800">
                  STATUS: {po.status}
                </div>
              </div>
            </div>

            {/* Vendor / Supplier & Order Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-neutral-900 mb-5 text-[11px]">
              {/* Left Column: Supplier Info */}
              <div className="space-y-1">
                <div>
                  <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                    VENDOR / SUPPLIER
                  </span>
                  <span className="font-black text-neutral-900 text-xs uppercase">
                    {po.supplierName || "—"}
                  </span>
                </div>
                {po.supplierAddress && (
                  <div>
                    <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                      ADDRESS
                    </span>
                    <span className="text-neutral-800">
                      {po.supplierAddress}
                    </span>
                  </div>
                )}
                {(po.supplierContactPerson || po.supplierEmail) && (
                  <div>
                    <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                      ATTENTION / CONTACT
                    </span>
                    <span className="text-neutral-800">
                      {po.supplierContactPerson ? `${po.supplierContactPerson} ` : ""}
                      {po.supplierEmail ? `(${po.supplierEmail})` : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Date, Time & Requisition Reference */}
              <div className="space-y-1 sm:text-right">
                <div>
                  <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                    DATE / TIME
                  </span>
                  <span className="font-medium text-neutral-900">
                    {formattedDate} &bull; {formattedTime}
                  </span>
                </div>
                {po.prNumber && (
                  <div>
                    <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                      PURCHASE REQUISITION REFERENCE
                    </span>
                    <span className="font-mono font-bold text-neutral-900 text-xs">
                      {po.prNumber}
                    </span>
                  </div>
                )}
                {po.expectedArrivalDate && (
                  <div>
                    <span className="font-bold text-neutral-600 uppercase tracking-wider text-[10px] block">
                      EXPECTED ARRIVAL DATE
                    </span>
                    <span className="font-medium text-neutral-800">
                      {new Date(po.expectedArrivalDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Table of Particulars (Matching Brigino Hospital format) */}
            <div className="mb-6">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-neutral-900 text-[10px] font-black uppercase tracking-wider text-neutral-900">
                    <th className="py-2.5 pr-4 text-left">PARTICULARS</th>
                    <th className="py-2.5 px-3 text-center">QUANTITY</th>
                    <th className="py-2.5 px-3 text-right">UNIT PRICE</th>
                    <th className="py-2.5 pl-3 text-right">AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {po.items && po.items.length > 0 ? (
                    po.items.map((item, idx) => {
                      const unitPrice = item.unitPrice || (item.poItemQuantity > 0 ? item.totalPrice / item.poItemQuantity : 0);
                      const hasPrice = unitPrice > 0;
                      return (
                        <tr key={idx} className="align-top">
                          <td className="py-3 pr-4 font-semibold text-neutral-900 uppercase">
                            {item.itemName}
                            <span className="block text-[10px] font-normal text-neutral-500 normal-case">
                              Unit of Measure: {item.purchaseUomName || "Unit"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-neutral-900">
                            {Number(item.poItemQuantity).toLocaleString()} {item.purchaseUomName || ""}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-neutral-800">
                            {hasPrice ? `₱${unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Pending Confirmation"}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-bold text-neutral-900">
                            {item.totalPrice > 0 ? `₱${Number(item.totalPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-neutral-500 italic">
                        No order items specified.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Amount Due (Solid horizontal bar) */}
            <div className="border-t-2 border-b-2 border-neutral-900 py-3 mb-8 flex justify-between items-center">
              <span className="text-xs md:text-sm font-black uppercase tracking-wider text-neutral-900">
                TOTAL AMOUNT DUE
              </span>
              <span className="text-base md:text-xl font-mono font-black text-neutral-900">
                {po.totalAmount > 0
                  ? `₱${Number(po.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : (isApproved ? "₱0.00" : "Pending Confirmation")}
              </span>
            </div>

            {/* Signatures & Approvals Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-[11px]">
              <div>
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px] block mb-1">
                  PREPARED BY (INVENTORY MANAGEMENT)
                </span>
                <div className="font-black text-neutral-900 uppercase pt-2 border-t border-neutral-400">
                  {po.requestedBy || "Vince Neil Madeja"}
                </div>
                <div className="text-[10px] text-neutral-500">
                  Inventory Manager &bull; Bren Raphael&apos;s Ube Jam &amp; Halaya
                </div>
              </div>

              <div>
                <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px] block mb-1">
                  APPROVED BY (AUTHORIZED SUPPLIER REPRESENTATIVE)
                </span>
                <div className="font-black text-neutral-900 uppercase pt-2 border-t border-neutral-400">
                  {po.supplierApprovedBy || "______________________________________"}
                </div>
                <div className="text-[10px] text-neutral-500 flex justify-between">
                  <span>Authorized Representative</span>
                  <span>
                    Date: {po.supplierApprovedDate ? new Date(po.supplierApprovedDate).toLocaleDateString("en-US") : "_______________"}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Footer Note */}
            <div className="mt-8 pt-4 border-t border-dashed border-neutral-300 text-[10px] text-neutral-400 text-center uppercase tracking-wider">
              This is an official procurement document generated by Bren Raphael&apos;s Inventory Management System.
            </div>
          </div>
        </div>
      </div>

      {/* Print-specific style rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Make the printable content visible and centered */
          div[ref="printRef"], div:has(> div[ref="printRef"]) {
            visibility: visible;
          }
          /* Standard print layout */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}

