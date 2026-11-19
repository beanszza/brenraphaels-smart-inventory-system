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
import { systems } from "./SidebarNav";

export function SidebarEnterpriseHeader({
  isMobile,
  navigate = (url) => {
    window.location.href = url;
  },
}: {
  isMobile: boolean;
  navigate?: (url: string) => void;
}) {
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
              className="w-80 bg-surface border border-border text-ink z-[99999] p-2 space-y-1 shadow-modal rounded-modal"
              align="start"
              side="bottom"
              sideOffset={8}
            >
              <DropdownMenuLabel className="type-caption font-semibold uppercase tracking-wider text-ink-muted px-3 py-1.5">
                Select Enterprise Module
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-divider" />
              {systems.map((sys) => {
                const SysIcon = sys.icon;
                return (
                  <DropdownMenuItem
                    key={sys.fullName}
                    onClick={() => {
                      if (sys.url) navigate(sys.url);
                    }}
                    className={`cursor-pointer type-body-secondary flex items-center justify-between p-2.5 rounded-control transition-all font-medium gap-3 ${
                      sys.active
                        ? "bg-tint-soft text-primary font-semibold"
                        : "bg-surface text-ink hover:bg-subtle"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                      <div
                        className={`size-10 rounded-inner flex items-center justify-center shrink-0 transition-colors ${
                          sys.active
                            ? "bg-ai text-on-brand shadow-none"
                            : "bg-subtle text-ink-secondary"
                        }`}
                      >
                        <SysIcon className="size-5 shrink-0" />
                      </div>
                      <div className="flex flex-col min-w-0 overflow-hidden flex-1 justify-center gap-0.5">
                        <span className="font-semibold type-body-secondary truncate leading-snug text-ink">
                          {sys.fullName}
                        </span>
                        <span className="type-caption text-ink-muted truncate leading-tight">
                          {sys.desc}
                        </span>
                      </div>
                    </div>
                    {sys.active && (
                      <div className="size-5 rounded-pill bg-ai text-on-brand flex items-center justify-center shrink-0 ml-1.5 shadow-none">
                        <Check className="size-3 stroke-[2.5]" />
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
