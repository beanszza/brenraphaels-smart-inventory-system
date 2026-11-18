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
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
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
    return <CheckCircle2 size={15} className="text-text-primary" />;
  }
  if (lower.includes("inactive") || lower.includes("removed") || lower.includes("deducted")) {
    return <MinusCircle size={15} className="text-text-primary" />;
  }
  if (lower.includes("restock") || lower.includes("received")) {
    return <PackageCheck size={15} className="text-text-primary" />;
  }
  if (lower.includes("recipe") || lower.includes("bom")) {
    return <Layers size={15} className="text-text-primary" />;
  }
  if (lower.includes("supplier") || lower.includes("vendor")) {
    return <Building2 size={15} className="text-text-primary" />;
  }
  if (lower.includes("stock added")) {
    return <PlusCircle size={15} className="text-text-primary" />;
  }
  return <Activity size={15} className="text-text-primary" />;
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
      <DialogContent className="max-w-[560px] p-0 !overflow-hidden bg-surface border border-divider rounded-panel shadow-modal">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-divider bg-surface-hover/30">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className="type-caption px-2.5 py-0.5 border-divider bg-surface text-text-primary font-semibold">
                {log.id || "AUD-LOG"}
              </Badge>
              <div className="flex items-center gap-1.5 type-caption text-text-muted">
                <Clock size={13} className="text-text-muted" />
                <span>{log.timestamp}</span>
              </div>
            </div>
            <DialogTitle className="type-section-title text-text-primary tracking-tight pt-1">
              Audit Log Event Details
            </DialogTitle>
            <DialogDescription className="type-caption text-text-muted">
              Comprehensive event record and metadata captured in the supply audit trail.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Action & Activity Section */}
          <div className="rounded-control border border-divider bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="type-overline uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Activity size={13} className="text-text-primary" /> Action &amp; Event
              </span>
            </div>
            <div className="flex items-start gap-3 pt-1">
              <div className="mt-0.5 p-2 rounded-control bg-surface-hover border border-divider shrink-0">
                {getActivityIcon(log.activity)}
              </div>
              <div className="space-y-1">
                <p className="type-body font-semibold text-text-primary leading-snug">
                  {log.activity}
                </p>
                <div className="flex items-center gap-1.5 type-caption text-text-muted">
                  <User size={13} className="text-text-primary" />
                  <span>Performed by: <strong className="text-text-primary font-medium">{log.user || "System Operator"}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Target Entity Section */}
          <div className="rounded-control border border-divider bg-surface p-4 space-y-3">
            <span className="type-overline uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Layers size={13} className="text-text-primary" /> Target Entity
            </span>
            <div>
              <h4 className="type-card-title text-text-primary">
                {primaryTarget}
              </h4>
            </div>

            {/* Parsed Attributes */}
            {detailItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-divider">
                {detailItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-control border border-divider bg-surface-hover/40 space-y-0.5"
                  >
                    <span className="type-overline uppercase tracking-wider text-text-muted">
                      {item.label}
                    </span>
                    <p className="type-caption font-semibold text-text-primary break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Event String */}
          <div className="rounded-control border border-divider bg-surface-hover/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="type-overline uppercase text-text-muted flex items-center gap-1.5">
                <FileText size={12} className="text-text-primary" /> Full Recorded Entry
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyRaw}
                className="h-7 px-2 type-caption text-text-muted hover:text-text-primary font-medium flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-text-primary" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </Button>
            </div>
            <p className="type-caption text-text-muted bg-surface p-3 rounded-control border border-divider break-words leading-relaxed select-all">
              {rawEntity}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-divider bg-surface-hover/20 flex justify-end">
          <ModalCloseButton
            variant="outline"
            fallbackOnClose={onClose}
            className="rounded-control border-divider bg-surface px-5 py-2 type-button font-semibold text-text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Close
          </ModalCloseButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
