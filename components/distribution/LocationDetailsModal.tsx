"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";

import React from "react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { LocationItem } from "./types";

interface LocationDetailsModalProps {
  location: LocationItem | null;
  onClose: () => void;
}

export default function LocationDetailsModal({
  location,
  onClose,
}: LocationDetailsModalProps) {
  if (!location) return null;

  return (
    <ModalWrapper open={!!location} title={`Location Details - ${location.name}`} onClose={onClose} size="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <StatusBadge status={location.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Location Name</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{location.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Facility Type</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{location.type}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Address</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{location.address || "N/A"}</p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="outline" onClick={onClose} className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-primary hover:text-primary-foreground transition-colors">
            Close
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
}
