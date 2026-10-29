"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getPurchaseOrderForAck, submitSupplierAcknowledgment } from "@/lib/supplier-ack/actions";
import { PurchaseOrderPO } from "@/components/orders-procurement/types";
import { downloadPurchaseOrderPdf } from "@/components/orders-procurement/po/downloadPurchaseOrderPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function SupplierAckContent() {
  const searchParams = useSearchParams();
  const poNumber = searchParams.get("poNumber") || "";

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PurchaseOrderPO | null>(null);
  const [loadError, setLoadError] = useState<string>("");

  // Form states
  const [itemRows, setItemRows] = useState<
    { itemId: number; itemName: string; uom: string; requestedQty: number; accommodatedQty: string; unitPrice: string }[]
  >([]);
  const [supplierApprovedBy, setSupplierApprovedBy] = useState("");
  const [supplierApprovedDate, setSupplierApprovedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!poNumber) {
      setLoadError("No Purchase Order number provided in URL.");
      setLoading(false);
      return;
    }

    async function loadOrder() {
      setLoading(true);
      setLoadError("");
      const res = await getPurchaseOrderForAck(poNumber);
      if (res.success && res.data) {
        const dto: any = res.data;
        const mappedPo: PurchaseOrderPO = {
          ...dto,
          prId: dto.prId ?? undefined,
          orderDate: dto.orderDate ? new Date(dto.orderDate).toISOString() : new Date().toISOString(),
          expectedArrivalDate: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate).toISOString() : "",
          items: (dto.items || []).map((i: any) => ({
            ...i,
            purchaseUomName: i.purchaseUomName ?? undefined,
          })),
        };
        setPo(mappedPo);
        setSupplierApprovedBy(dto.supplierApprovedBy || dto.supplierContactPerson || "");
        if (res.data.expectedArrivalDate) {
          setExpectedArrivalDate(new Date(res.data.expectedArrivalDate).toISOString().split("T")[0]);
        }
        if (res.data.adminNotes) {
          setNotes(res.data.adminNotes);
        }
        setItemRows(
          res.data.items.map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            uom: item.purchaseUomName || "Unit",
            requestedQty: Number(item.poItemQuantity),
            accommodatedQty: String(item.poItemQuantity),
            unitPrice: item.unitPrice ? String(item.unitPrice) : "",
          }))
        );
      } else {
        setLoadError(res.message || "Could not find Purchase Order.");
      }
      setLoading(false);
    }

    loadOrder();
  }, [poNumber]);

  // Grand total calculation
  const grandTotal = useMemo(() => {
    return itemRows.reduce((sum, row) => {
      const q = parseFloat(row.accommodatedQty) || 0;
      const p = parseFloat(row.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  }, [itemRows]);

  const handleUpdateRow = (index: number, field: "accommodatedQty" | "unitPrice", val: string) => {
    const clean = val.replace(/[-+e]/gi, "");
    setItemRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: clean };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!supplierApprovedBy.trim()) {
      setFormError("Please enter the name of the Authorized Approver / Supplier Representative.");
      return;
    }
    if (!supplierApprovedDate) {
      setFormError("Please select the confirmation date.");
      return;
    }

    const invalidRow = itemRows.find((r) => {
      const q = parseFloat(r.accommodatedQty);
      return isNaN(q) || q < 0;
    });
    if (invalidRow) {
      setFormError(`Please enter a valid accommodated quantity for ${invalidRow.itemName}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitSupplierAcknowledgment(poNumber, {
        supplierApprovedBy,
        supplierApprovedDate,
        expectedArrivalDate: expectedArrivalDate || undefined,
        notes,
        items: itemRows.map((r) => ({
          itemId: r.itemId,
          confirmedQuantity: parseFloat(r.accommodatedQty) || 0,
          unitPrice: parseFloat(r.unitPrice) || 0,
        })),
      });

      if (res.success) {
        setSubmitted(true);
      } else {
        setFormError(res.message || "Failed to submit acknowledgment.");
      }
    } catch (err: any) {
      setFormError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!po) return;
    setDownloading(true);
    try {
      await downloadPurchaseOrderPdf(po);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md w-full shadow-sm">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-foreground">Loading Purchase Order...</p>
          <p className="text-xs text-muted-foreground mt-1">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (loadError || !po) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center max-w-md w-full shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-base font-bold text-foreground">Purchase Order Not Found</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{loadError}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-emerald-500/30 p-8 text-center max-w-lg w-full shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Acknowledgment Submitted!</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Thank you, <strong>{supplierApprovedBy}</strong>. Your confirmation, accommodated quantities, and quoted pricing for{" "}
              <strong className="text-foreground">{po.poNumber}</strong> have been recorded and sent to Bren Raphael&apos;s Ube Jam &amp; Halaya.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-muted/30 border border-border text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PO Number:</span>
              <span className="font-mono font-bold text-foreground">{po.poNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Supplier:</span>
              <span className="font-semibold text-foreground">{po.supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmed Total Amount:</span>
              <span className="font-mono font-bold text-foreground">
                ₱{grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={downloading}
              onClick={handleDownloadPdf}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer w-full sm:w-auto"
            >
              {downloading ? "Downloading..." : "Download Official Purchase Order Document"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Company Header */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
            <div>
              <h1 className="text-lg font-bold text-foreground uppercase tracking-wide">
                Bren Raphael&apos;s Ube Jam &amp; Halaya
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Block 14 Lot 1A, Marigman St., San Roque, Antipolo, 1870 Rizal
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Purchase Order
              </span>
              <span className="font-mono text-base font-bold text-primary">{po.poNumber}</span>
            </div>
          </div>

          <div className="mt-4 pt-2">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Supplier Order Acknowledgment &amp; Pricing Confirmation
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Please review the particulars requested below. Enter your accommodated quantities, unit pricing, authorized approver name, and confirmation date.
            </p>
          </div>
        </div>

        {/* PO Reference Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border p-4">
            <span className="text-[11px] font-medium text-muted-foreground block">Supplier / Vendor</span>
            <span className="text-xs font-bold text-foreground mt-1 block">{po.supplierName}</span>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <span className="text-[11px] font-medium text-muted-foreground block">Order Date</span>
            <span className="text-xs font-semibold text-foreground mt-1 block">
              {new Date(po.orderDate).toLocaleDateString()}
            </span>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <span className="text-[11px] font-medium text-muted-foreground block">Requisition Reference</span>
            <span className="text-xs font-mono font-bold text-foreground mt-1 block">{po.prNumber || "—"}</span>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <span className="text-[11px] font-medium text-muted-foreground block">Requested By</span>
            <span className="text-xs font-semibold text-foreground mt-1 block">{po.requestedBy || "IMS"}</span>
          </div>
        </div>

        {/* Order Particulars Confirmation Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Order Particulars &amp; Accommodation
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={handleDownloadPdf}
                className="rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                {downloading ? "Downloading..." : "View Official Document (PDF)"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Particulars</th>
                    <th className="px-4 py-3 text-left font-bold">Unit</th>
                    <th className="px-4 py-3 text-center font-bold">Requested Qty</th>
                    <th className="px-4 py-3 text-right font-bold w-36">Accommodated Qty</th>
                    <th className="px-4 py-3 text-right font-bold w-36">Unit Price (₱)</th>
                    <th className="px-4 py-3 text-right font-bold w-36">Subtotal (₱)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itemRows.map((row, idx) => {
                    const q = parseFloat(row.accommodatedQty) || 0;
                    const p = parseFloat(row.unitPrice) || 0;
                    const subtotal = q * p;
                    return (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground uppercase">{row.itemName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.uom}</td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-muted-foreground">
                          {row.requestedQty}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={row.accommodatedQty}
                            onChange={(e) => handleUpdateRow(idx, "accommodatedQty", e.target.value)}
                            className="h-8 w-28 ml-auto text-right font-mono font-bold text-xs bg-card border-border"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={row.unitPrice}
                            onChange={(e) => handleUpdateRow(idx, "unitPrice", e.target.value)}
                            className="h-8 w-28 ml-auto text-right font-mono font-bold text-xs bg-card border-border"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          ₱{subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="flex justify-end pt-2">
              <div className="bg-muted/40 border border-border rounded-xl px-5 py-3 text-right min-w-[240px]">
                <span className="text-[11px] font-semibold text-muted-foreground block uppercase">
                  Total Order Amount Due
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
                  ₱{grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Confirmation Inputs */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Authorized Confirmation &amp; Delivery Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Authorized Approver / Supplier Representative <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Maria Santos (Sales Manager)"
                  value={supplierApprovedBy}
                  onChange={(e) => setSupplierApprovedBy(e.target.value)}
                  className="h-10 text-xs bg-card border-border font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Confirmation Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={supplierApprovedDate}
                  onChange={(e) => setSupplierApprovedDate(e.target.value)}
                  className="h-10 text-xs bg-card border-border font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Committed / Expected Arrival Date
                </label>
                <Input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(e) => setExpectedArrivalDate(e.target.value)}
                  className="h-10 text-xs bg-card border-border font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Supplier Confirmation Notes / Delivery Terms
                </label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Delivery batching, payment terms, or remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-card border-border resize-none"
                />
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive font-medium">
              {formError}
            </div>
          )}

          {/* Submit Action */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-primary text-primary-foreground px-8 py-3 text-sm font-semibold hover:bg-primary/85 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Submitting Acknowledgment..." : "Submit Acknowledgment to Bren Raphael's"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SupplierAcknowledgmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <SupplierAckContent />
    </Suspense>
  );
}
