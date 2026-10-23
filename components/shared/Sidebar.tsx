"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useMounted } from "@/hooks/use-mounted";
import { visibleNavGroups } from "./SidebarNav";
import type { Module } from "@/lib/portal/config";
import type { Staff } from "@/lib/portal/client";
import { SidebarProfileFooter } from "./SidebarProfileFooter";
import { SidebarNavSkeleton } from "./SidebarNavSkeleton";
import { SidebarEnterpriseHeader } from "./SidebarEnterpriseHeader";

export function Sidebar({ modules, staff }: { modules: Module[]; staff: Staff }) {
  const pathname = usePathname();
  const { open, openMobile, setOpenMobile, toggleSidebar, isMobile } = useSidebar();
  const mounted = useMounted();
  const groups = visibleNavGroups(modules);
  const isOpen = isMobile ? openMobile : open;

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (mounted && !isOpen) return null;

  return (
    <>
      {isMobile && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[55] animate-in fade-in duration-200"
        />
      )}
      <aside className="fixed left-0 top-0 h-full w-(--sidebar-width) flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground z-[60] transition-all duration-300 shadow-xl md:shadow-none animate-in slide-in-from-left duration-300">
        <SidebarEnterpriseHeader isMobile={isMobile} />

        <SidebarContent className="px-3 py-4 overflow-y-auto">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              {!mounted ? (
                <SidebarNavSkeleton rows={groups.reduce((n, g) => n + g.items.length, 0)} />
              ) : (
                <SidebarMenu className="gap-0.5">
                  {groups.map((group, index) => (
                    <React.Fragment key={group.label}>
                      <li
                        aria-hidden
                        className={`pb-1.5 pl-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground list-none ${
                          index === 0 ? "pt-1" : "pt-[18px]"
                        }`}
                      >
                        {group.label}
                      </li>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive =
                          item.href === "/"
                            ? pathname === "/"
                            : pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className="h-auto w-full flex items-center gap-3 px-2.5 py-[9px] rounded-lg text-[15px] font-medium text-sidebar-foreground transition-colors data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
                            >
                              <Link href={item.href} onClick={handleNavClick}>
                                <ItemIcon className="size-[18px] shrink-0" />
                                <span>{item.name}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="py-3.5 pl-4 pr-3 border-t border-sidebar-border">
          <SidebarProfileFooter staff={staff} />
        </SidebarFooter>

        <SidebarRail />
      </aside>
    </>
  );
}
