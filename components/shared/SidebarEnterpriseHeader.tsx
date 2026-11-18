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
    <SidebarHeader className="h-24 justify-center py-0 pl-3.5 pr-2.5 border-b border-divider">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center p-2.5 rounded-card bg-switcher hover:bg-subtle cursor-pointer transition-colors group gap-3">
                <h1 className="sr-only">Bren Raphael&apos;s Inventory Management System</h1>
                <BrandLockup system="IMS" className="min-w-0 flex-1" />
                <ChevronsUpDown className="size-4 text-ink-muted shrink-0 group-hover:text-ink transition-colors" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-72 sm:w-80 bg-surface border border-border text-ink z-[99999] p-2 space-y-1 shadow-modal rounded-inner"
              align="start"
              side="bottom"
              sideOffset={6}
            >
              <DropdownMenuLabel className="type-nav-group text-ink-muted px-3 py-1.5">
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
                        ? "bg-tint-selected text-primary font-semibold"
                        : "hover:bg-subtle hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                      <div
                        className={`size-8 rounded-control flex items-center justify-center shrink-0 transition-colors ${
                          sys.active
                            ? "bg-primary text-on-brand shadow-none"
                            : "bg-subtle text-ink-muted"
                        }`}
                      >
                        <SysIcon className="size-4 shrink-0" />
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
                      <div className="size-5 rounded-pill bg-primary text-on-brand flex items-center justify-center shrink-0 ml-2 shadow-none">
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
