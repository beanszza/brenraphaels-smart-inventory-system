"use client";

import { StatusBadge } from "@/components/shared/StatusBadge";

import React from "react";
import { Button } from "@/components/ui/button";
import ModalWrapper from "@/components/resources-suppliers/ModalWrapper";
import { ModalCloseButton } from "@/components/shared/ModalCloseContext";
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
    <ModalWrapper open={!!location} title={`Location Details - ${location.name}`} onClose={onClose} size="max-w-[480px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-divider">
          <StatusBadge status={location.status} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="type-caption text-text-muted">Location Name</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{location.name}</p>
          </div>
          <div>
            <p className="type-caption text-text-muted">Facility Type</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{location.type}</p>
          </div>
          <div className="col-span-2">
            <p className="type-caption text-text-muted">Address</p>
            <p className="type-body font-semibold text-text-primary mt-0.5">{location.address || "N/A"}</p>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-divider">
          <ModalCloseButton variant="outline" fallbackOnClose={onClose} className="rounded-control border border-divider bg-surface px-5 py-2.5 type-button font-semibold text-text-primary hover:bg-surface-hover transition-colors">
            Close
          </ModalCloseButton>
        </div>
      </div>
    </ModalWrapper>
  );
}
