"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  User,
  Activity,
  Copy,
  Check,
  FileText,
  Layers,
  Building2,
  PackageCheck,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
} from "lucide-react";
import { LogEntry } from "@/components/pages/AuditLogsTable";

interface AuditLogDetailsModalProps {
  log: LogEntry | null;
  open: boolean;
  onClose: () => void;
}

export function getActivityIcon(activity: string) {
  const lower = activity.toLowerCase();
  if (lower.includes("registered") || lower.includes("onboarded") || lower.includes("created")) {
    return <CheckCircle2 size={15} className="text-foreground" />;
  }
  if (lower.includes("inactive") || lower.includes("removed") || lower.includes("deducted")) {
    return <MinusCircle size={15} className="text-foreground" />;
  }
  if (lower.includes("restock") || lower.includes("received")) {
    return <PackageCheck size={15} className="text-foreground" />;
  }
  if (lower.includes("recipe") || lower.includes("bom")) {
    return <Layers size={15} className="text-foreground" />;
  }
  if (lower.includes("supplier") || lower.includes("vendor")) {
    return <Building2 size={15} className="text-foreground" />;
  }
  if (lower.includes("stock added")) {
    return <PlusCircle size={15} className="text-foreground" />;
  }
  return <Activity size={15} className="text-foreground" />;
}

export default function AuditLogDetailsModal({
  log,
  open,
  onClose,
}: AuditLogDetailsModalProps) {
  const [copied, setCopied] = useState(false);

  if (!log) return null;

  const rawEntity = log.entityName || "";
  const parts = rawEntity.includes(" | ")
    ? rawEntity.split(" | ").map((p) => p.trim())
    : [rawEntity];

  const primaryTarget = parts[0] || "—";
  const detailItems = parts.slice(1).map((part) => {
    if (part.includes(": ")) {
      const [label, ...valParts] = part.split(": ");
      return { label: label.trim(), value: valParts.join(": ").trim() };
    }
    return { label: "Details", value: part };
  });

  const handleCopyRaw = () => {
    const text = `Log No: ${log.id || "N/A"}\nActivity: ${log.activity}\nTarget: ${log.entityName}\nDate: ${log.timestamp}\nUser: ${log.user}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border border-border rounded-2xl shadow-xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border bg-muted/30">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 border-border bg-card text-foreground font-semibold">
                {log.id || "AUD-LOG"}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Clock size={13} className="text-muted-foreground" />
                <span>{log.timestamp}</span>
              </div>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground tracking-tight pt-1">
              Audit Log Event Details
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Comprehensive event record and metadata captured in the supply audit trail.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Action & Activity Section */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity size={13} className="text-foreground" /> Action &amp; Event
              </span>
            </div>
            <div className="flex items-start gap-3 pt-1">
              <div className="mt-0.5 p-2 rounded-lg bg-muted border border-border shrink-0">
                {getActivityIcon(log.activity)}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {log.activity}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User size={13} className="text-foreground" />
                  <span>Performed by: <strong className="text-foreground font-medium">{log.user || "System Operator"}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Target Entity Section */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers size={13} className="text-foreground" /> Target Entity
            </span>
            <div>
              <h4 className="text-base font-bold text-foreground">
                {primaryTarget}
              </h4>
            </div>

            {/* Parsed Attributes */}
            {detailItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border">
                {detailItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-border bg-muted/40 space-y-0.5"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </span>
                    <p className="text-xs font-semibold text-foreground break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Event String */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText size={12} className="text-foreground" /> Full Recorded Entry
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyRaw}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-foreground" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </Button>
            </div>
            <p className="font-mono text-xs text-muted-foreground bg-card p-3 rounded-lg border border-border break-words leading-relaxed select-all">
              {rawEntity}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-border bg-muted/20 flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-border bg-card px-5 py-2 text-xs font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
