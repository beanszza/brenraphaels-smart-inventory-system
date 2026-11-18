"use client";

import { procurement } from "@/lib/orders/client";
import { requisitionSupplies } from "@/app/actions/orders/screens";
import { actionResponse } from "@/lib/resources/action-response";



import React, { useState } from "react";
import { toast } from "sonner";
import {
  Calculator, Play, Plus, Trash2, Package, AlertCircle, ShoppingCart, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface PlannedRun {
  recipeId: string;
  recipeName: string;
  batchCount: number;
}

interface MrpRequirement {
  itemId: number;
  itemName: string;
  categoryName: string;
  uomName: string;
  grossRequirement: number;
  onHandQty: number;
  onOrderQty: number;
  netRequirement: number;
  urgency: "Critical" | "High" | "Normal" | "None";
  preferredSupplier: string;
  estimatedCost: number;
  reorderPoint: number;
}

interface Recipe {
  recipeId: number;
  recipeName: string;
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  return <StatusBadge status={urgency} />;
}

export default function ViewMrp({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const [error, setError] = useState("");
  const [horizon, setHorizon] = useState("30");
  const [plannedRuns, setPlannedRuns] = useState<PlannedRun[]>([]);
  const [results, setResults] = useState<MrpRequirement[] | null>(null);
  const [loading, setLoading] = useState(false);
  const recipes = initialRecipes;

  const [showPrModal, setShowPrModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MrpRequirement | null>(null);
  const [prSaving, setPrSaving] = useState(false);
  const [newRun, setNewRun] = useState({ recipeId: "", batchCount: "1" });

  const addPlannedRun = () => {
    if (!newRun.recipeId) return;
    const recipe = recipes.find((r) => String(r.recipeId) === newRun.recipeId);
    if (!recipe) return;
    setPlannedRuns((prev) => [
      ...prev,
      { recipeId: newRun.recipeId, recipeName: recipe.recipeName, batchCount: parseInt(newRun.batchCount) || 1 },
    ]);
    setNewRun({ recipeId: "", batchCount: "1" });
  };

  const removeRun = (idx: number) => setPlannedRuns((p) => p.filter((_, i) => i !== idx));

  const runMrp = async () => {
    setError("");
    setLoading(true);
    setResults(null);
    try {
      const body = {
        planningHorizonDays: parseInt(horizon) || 30,
        plannedBatches: plannedRuns.map((r) => ({
          recipeId: parseInt(r.recipeId),
          batchCount: r.batchCount,
        })),
      };
      const res = await procurement.planMrp(body);
      if (res.data?.success && res.data.data) {
        const raw = res.data.data?.requirements || res.data.data || [];
        setResults(raw.map((r: any) => ({
          itemId: r.itemId,
          itemName: r.itemName || "—",
          categoryName: r.categoryName || "—",
          uomName: r.uomName || "Unit",
          grossRequirement: r.grossRequirement || 0,
          onHandQty: r.onHandQty || 0,
          onOrderQty: r.onOrderQty || 0,
          netRequirement: r.netRequirement || 0,
          urgency: r.urgency || (r.netRequirement > 0 ? "Normal" : "None"),
          preferredSupplier: r.preferredSupplier || "—",
          estimatedCost: r.estimatedCost || 0,
          reorderPoint: r.reorderPoint || 0,
        })));
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Planning could not be completed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePR = async () => {
    if (!selectedItem) return;
    setPrSaving(true);
    try {
      setError("");
      const supplies = (await actionResponse(requisitionSupplies())).data.data;
      const supply = supplies.find((s: { itemId: number }) => s.itemId === selectedItem.itemId);
      if (!supply) throw new Error("This supply is no longer available. Run planning again.");
      await procurement.createRequisition({
        department: "Inventory", requestType: "Stock Replenishment", priority: "Medium",
        notes: `Generated from MRP (${horizon}d horizon)`,
        items: [{ itemId: selectedItem.itemId, requestedQuantity: selectedItem.netRequirement,
          purchaseUomId: supply.purchaseUomId }],
      });
      toast.success("Draft requisition created. Review it in Orders & Procurement before submitting.");
      setShowPrModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The requisition could not be created.");
    } finally {
      setPrSaving(false);
    }
  };

  const needsReorder = results ? results.filter((r) => r.netRequirement > 0) : [];
  const critical = results ? results.filter((r) => r.urgency === "Critical").length : 0;

  return (
    <div className="w-full min-h-full py-7 px-4 sm:px-6 md:px-8 space-y-6 animate-page-in">
      <PageHeader
        title="MRP Planning"
        description="Material requirements planning — calculate gross/net requirements and generate reorder suggestions"
      />

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {/* Planning Inputs */}
      <Card className="border-divider bg-surface rounded-panel">
        <CardHeader className="pb-3 border-b border-divider">
          <CardTitle className="type-card-title text-text-primary flex items-center gap-2">
            <Calculator className="w-4 h-4 text-text-muted" />
            Planning Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="type-caption font-semibold text-text-primary">Planning Horizon (days)</Label>
              <Input
                type="number"
                className="h-9 type-input bg-surface border-divider text-text-primary"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                min="1"
                max="365"
              />
            </div>
          </div>

          <Separator className="bg-divider" />
          <div className="space-y-2">
            <p className="type-overline font-semibold text-text-muted uppercase tracking-wider">Planned Production Runs</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="type-caption font-semibold text-text-primary">Recipe</Label>
                <Select
                  value={newRun.recipeId}
                  onValueChange={(v) => setNewRun((p) => ({ ...p, recipeId: v }))}
                >
                  <SelectTrigger className="h-9 type-input bg-surface border-divider text-text-primary">
                    <SelectValue placeholder="Select recipe..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-divider text-text-primary">
                    {recipes.length === 0
                      ? <SelectItem value="none" disabled>No recipes loaded yet</SelectItem>
                      : recipes.map((r) => (
                          <SelectItem key={r.recipeId} value={String(r.recipeId)}>{r.recipeName}</SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="type-caption font-semibold text-text-primary">Batches</Label>
                <Input
                  type="number"
                  className="h-9 type-input bg-surface border-divider text-text-primary"
                  value={newRun.batchCount}
                  onChange={(e) => setNewRun((p) => ({ ...p, batchCount: e.target.value }))}
                  min="1"
                />
              </div>
              <Button size="sm" variant="outline" onClick={addPlannedRun} className="gap-1.5 h-9 type-button font-semibold rounded-control border-divider bg-surface hover:bg-surface-hover text-text-primary">
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            {plannedRuns.length > 0 && (
              <div className="space-y-1 mt-2">
                {plannedRuns.map((run, i) => (
                  <div key={i} className="flex items-center justify-between bg-surface-hover rounded-control px-3 py-2 type-caption">
                    <span className="font-semibold text-text-primary">{run.recipeName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted">{run.batchCount} batch{run.batchCount > 1 ? "es" : ""}</span>
                      <button onClick={() => removeRun(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={runMrp} disabled={loading} className="gap-1.5 type-button font-semibold rounded-control bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm">
              {loading ? <><Clock className="w-4 h-4 animate-pulse" />Running...</>
                : <><Play className="w-4 h-4" />Run MRP Plan</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </CardContent>
        </Card>
      )}

      {!loading && results === null && (
        <EmptyState
          icon={Calculator}
          title="Run MRP to see requirements"
          description="Configure a planning horizon, optionally add planned production runs, then click Run MRP Plan."
        />
      )}

      {!loading && results !== null && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Items",   value: results.length,        icon: Package },
              { label: "Need Reorder",  value: needsReorder.length,   icon: ShoppingCart },
              { label: "Critical",      value: critical,              icon: AlertCircle },
              { label: "Est. Cost",     value: `₱${needsReorder.reduce((s, r) => s + r.estimatedCost, 0).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`, icon: Calculator },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-divider bg-surface rounded-panel">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-control bg-surface-hover flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="type-kpi font-semibold text-text-primary">{value}</p>
                    <p className="type-caption text-text-muted">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No material requirements"
              description="All items have sufficient stock for the planning horizon and planned batches."
            />
          ) : (
            <Card className="border-divider bg-surface rounded-panel">
              <CardHeader className="pb-3 border-b border-divider">
                <CardTitle className="type-card-title text-text-primary">Material Requirements</CardTitle>
              </CardHeader>
              <Table className="border-collapse">
                <TableHeader>
                  <TableRow className="border-divider bg-surface-hover">
                    <TableHead className="type-table-header text-text-muted">Item</TableHead>
                    <TableHead className="type-table-header text-text-muted text-right">Gross Req.</TableHead>
                    <TableHead className="type-table-header text-text-muted text-right">On-Hand</TableHead>
                    <TableHead className="type-table-header text-text-muted text-right">On-Order</TableHead>
                    <TableHead className="type-table-header text-text-muted text-right">Net Req.</TableHead>
                    <TableHead className="type-table-header text-text-muted">Urgency</TableHead>
                    <TableHead className="type-table-header text-text-muted">Preferred Supplier</TableHead>
                    <TableHead className="type-table-header text-text-muted text-right">Est. Cost</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-divider">
                  {results.map((req) => (
                    <TableRow key={req.itemId} className="border-divider type-table-cell hover:bg-surface-hover/60 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-text-primary">{req.itemName}</p>
                          <p className="type-caption text-text-muted">{req.uomName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-text-primary">{req.grossRequirement.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-text-primary">{req.onHandQty.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums text-text-primary">{req.onOrderQty.toLocaleString()}</TableCell>
                      <TableCell className={`text-right tabular-nums font-semibold ${req.netRequirement > 0 ? "text-text-primary" : "text-text-muted"}`}>
                        {req.netRequirement.toLocaleString()}
                      </TableCell>
                      <TableCell><UrgencyBadge urgency={req.urgency} /></TableCell>
                      <TableCell className="text-text-muted">{req.preferredSupplier}</TableCell>
                      <TableCell className="text-right tabular-nums font-mono type-table-cell text-text-primary">
                        {req.estimatedCost > 0
                          ? `₱${req.estimatedCost.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"
                        }
                      </TableCell>
                      <TableCell>
                        {req.netRequirement > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="type-button h-7 gap-1 rounded-control border-divider bg-surface hover:bg-surface-hover text-text-primary"
                            onClick={() => { setSelectedItem(req); setShowPrModal(true); }}
                          >
                            <ShoppingCart className="w-3 h-3" />
                            Create PR
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Create PR Dialog */}
      <ActionConfirmModal
        open={showPrModal && !!selectedItem}
        title="Create Purchase Requisition"
        subtitle={
          selectedItem
            ? `Item: ${selectedItem.itemName} • Net Req: ${selectedItem.netRequirement.toLocaleString()} ${selectedItem.uomName}`
            : undefined
        }
        description={
          selectedItem
            ? `Are you sure you want to create a draft Purchase Requisition for ${selectedItem.netRequirement.toLocaleString()} ${selectedItem.uomName} of ${selectedItem.itemName}?`
            : ""
        }
        confirmLabel="Confirm & Create PR"
        submitting={prSaving}
        onCancel={() => setShowPrModal(false)}
        onConfirm={handleCreatePR}
      >
        {selectedItem && (
          <div className="p-3 bg-surface-hover border border-divider rounded-control space-y-1.5 type-caption">
            <div className="flex justify-between">
              <span className="text-text-muted">Preferred Supplier</span>
              <span className="font-semibold text-text-primary">{selectedItem.preferredSupplier}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Estimated Cost</span>
              <span className="font-mono font-semibold text-text-primary">
                ₱{selectedItem.estimatedCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {error && <p role="alert" className="type-caption text-destructive pt-1">{error}</p>}
          </div>
        )}
      </ActionConfirmModal>
    </div>
  );
}
