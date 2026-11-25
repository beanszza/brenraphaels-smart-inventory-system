"use client";

import React from "react";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { useVisibleSystems } from "./use-visible-systems";

export function SidebarEnterpriseHeader({
  isMobile,
  navigate = (url) => {
    window.location.href = url;
  },
}: {
  isMobile: boolean;
  navigate?: (url: string) => void;
}) {
  const visibleSystems = useVisibleSystems();
  return (
    <SidebarHeader className="h-20 justify-center py-2 px-3 border-b border-divider">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center p-1.5 rounded-control hover:bg-subtle cursor-pointer transition-colors group gap-2.5">
                <h1 className="sr-only">Bren Raphael&apos;s Inventory Management System</h1>
                <BrandLockup system="IMS" className="min-w-0 flex-1" />
                <ChevronsUpDown className="size-4 text-ink-muted shrink-0 group-hover:text-ink transition-colors" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-80 bg-surface border border-border text-ink z-[99999] p-1.5 space-y-0.5 shadow-modal rounded-card"
              align="start"
              side="bottom"
              sideOffset={6}
            >
              <DropdownMenuLabel className="type-nav-group text-ink-muted px-2.5 py-1.5">
                Select Enterprise Module
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="-mx-1.5 my-1 bg-divider" />
              {visibleSystems.map((sys) => {
                const SysIcon = sys.icon;
                return (
                  <DropdownMenuItem
                    key={sys.fullName}
                    onClick={() => {
                      if (sys.url) navigate(sys.url);
                    }}
                    className={`cursor-pointer h-auto type-body-secondary flex items-center justify-between px-2.5 py-2 rounded-control transition-all font-medium gap-2.5 ${
                      sys.active
                        ? "bg-tint-soft text-primary font-semibold"
                        : "bg-surface text-ink hover:bg-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
                      <div
                        className={`size-8 rounded-control flex items-center justify-center shrink-0 transition-colors ${
                          sys.active
                            ? "bg-ai text-on-brand shadow-none"
                            : "bg-subtle text-ink-secondary"
                        }`}
                      >
                        <SysIcon className="size-4 shrink-0" />
                      </div>
                      <div className="flex flex-col min-w-0 overflow-hidden flex-1 justify-center gap-0.5">
                        <span className="font-semibold type-body-secondary truncate leading-tight text-ink">
                          {sys.fullName}
                        </span>
                        <span className="type-caption text-ink-muted truncate leading-tight">
                          {sys.desc}
                        </span>
                      </div>
                    </div>
                    {sys.active && (
                      <div className="size-4.5 rounded-pill bg-ai text-on-brand flex items-center justify-center shrink-0 ml-1 shadow-none">
                        <Check className="size-2.5 stroke-[2.5]" />
                      </div>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isMobile && (
          <SidebarTrigger
            className="text-ink-muted hover:text-ink size-8 rounded-control shrink-0 cursor-pointer"
            title="Close Sidebar"
          >
            <X className="size-5" />
          </SidebarTrigger>
        )}
      </div>
    </SidebarHeader>
  );
}
