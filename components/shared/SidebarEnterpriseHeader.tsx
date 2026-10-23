"use client";

import React from "react";
import Image from "next/image";
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
    <SidebarHeader className="h-24 justify-center py-0 pl-3.5 pr-2.5 border-b border-sidebar-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center p-1 rounded-xl hover:bg-sidebar-accent cursor-pointer transition-colors group gap-[11px]">
                <Image
                  src="/images/bren-raphaels-logo.svg"
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className="size-11 shrink-0 rounded-[10px]"
                />
                <div className="flex flex-col min-w-0 gap-1.5 pr-1">
                  <h1 className="text-xl font-bold text-sidebar-accent-foreground truncate leading-none">
                    Bren Raphael&apos;s
                  </h1>
                  <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-[3px] rounded-md truncate w-fit inline-block">
                    Inventory Mgmt.
                  </span>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-sidebar-foreground transition-colors" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-72 sm:w-80 bg-popover border border-border text-popover-foreground z-[99999] p-2 space-y-1 shadow-xl rounded-xl"
              align="start"
              side="bottom"
              sideOffset={6}
            >
              <DropdownMenuLabel className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider px-3 py-1.5">
                Select Enterprise Module
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-border" />
              {systems.map((sys) => {
                const SysIcon = sys.icon;
                return (
                  <DropdownMenuItem
                    key={sys.fullName}
                    onClick={() => {
                      if (sys.url) navigate(sys.url);
                    }}
                    className={`cursor-pointer text-xs flex items-center justify-between p-2.5 rounded-lg transition-all font-medium gap-3 ${
                      sys.active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          sys.active
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <SysIcon className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="flex flex-col min-w-0 overflow-hidden flex-1 justify-center gap-0.5">
                        <span className="font-semibold text-xs truncate leading-snug text-foreground">
                          {sys.fullName}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate leading-tight">
                          {sys.desc}
                        </span>
                      </div>
                    </div>
                    {sys.active && (
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 ml-2 shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
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
            className="text-muted-foreground hover:text-sidebar-foreground h-8 w-8 rounded-lg shrink-0 cursor-pointer"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </SidebarTrigger>
        )}
      </div>
    </SidebarHeader>
  );
}
