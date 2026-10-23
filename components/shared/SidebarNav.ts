import {
  LayoutDashboard,
  Warehouse,
  ShoppingCart,
  Boxes,
  Building2,
  Truck,
  LayoutGrid,
  Users2,
  CreditCard,
  PackageCheck,
  GitBranch,
  ClipboardList,
  BarChart3,
  Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Module } from "@/lib/portal/config";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  /** The Module Staff must hold to open this item. */
  module?: Module;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SystemItem {
  fullName: string;
  desc: string;
  icon: LucideIcon;
  active: boolean;
  url?: string;
  /** The Enterprise Portal, which shows the returning card while it opens. */
  portal?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { name: "Dashboard",            href: "/",                    icon: LayoutDashboard, module: "Dashboard" },
      { name: "Resources & Suppliers", href: "/resources-suppliers", icon: Warehouse, module: "Resources & Suppliers" },
      { name: "Orders & Procurement", href: "/orders-procurement",  icon: ShoppingCart, module: "Orders & Procurement" },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Goods Receiving",      href: "/goods-receiving",     icon: PackageCheck, module: "Goods Receiving" },
      { name: "Inventory",            href: "/inventory",           icon: Boxes, module: "Inventory" },
      { name: "Production & Quality", href: "/production-quality",  icon: Building2, module: "Production & Quality" },
      { name: "Stock Transfer",       href: "/stock-transfer",      icon: Truck, module: "Stock Transfer" },
    ],
  },
];

/** Sidebar groups limited to the Modules the Staff member holds; empty groups are dropped. */
export function visibleNavGroups(modules: readonly Module[]): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.module && modules.includes(item.module)),
    }))
    .filter((group) => group.items.length > 0);
}

/** Pages that are reachable but not in the sidebar still belong to one Module. */
const unlistedRoutes: Record<string, Module> = {
  "/cycle-counts": "Inventory",
  "/traceability": "Inventory",
  "/valuation": "Inventory",
  "/mrp": "Orders & Procurement",
  "/reports": "Orders & Procurement",
  "/distribution": "Stock Transfer",
  "/distribution-analytics": "Dashboard",
};

/** The Module that owns a page address, or undefined so callers deny by default. */
export function moduleForPath(pathname: string): Module | undefined {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (path === "/") return "Dashboard";
  const owns = (href: string) => path === href || path.startsWith(`${href}/`);
  const listed = mainNavItems.find((item) => item.href !== "/" && owns(item.href));
  if (listed) return listed.module;
  const unlistedHref = Object.keys(unlistedRoutes).find(owns);
  return unlistedHref ? unlistedRoutes[unlistedHref] : undefined;
}

/** Flat list of all nav items for breadcrumb lookups */
export const mainNavItems: NavItem[] = navGroups.flatMap((g) => g.items);

export const systems: SystemItem[] = [
  {
    fullName: "Enterprise Portal",
    desc: "All systems hub & app launcher",
    icon: LayoutGrid,
    active: false,
    portal: true,
    url: process.env.NEXT_PUBLIC_HOST_URL ?? "https://localhost:3000/",
  },
  {
    fullName: "Customer Relationship Management",
    desc: "Contact profiles, tickets & marketing",
    icon: Building2,
    active: false,
    url: process.env.NEXT_PUBLIC_CRMS_URL ?? "https://localhost:3005/",
  },
  {
    fullName: "Human Resource Management",
    desc: "Staff directory & payroll",
    icon: Users2,
    active: false,
    url: process.env.NEXT_PUBLIC_HRMS_URL ?? "https://localhost:3001/",
  },
  {
    fullName: "E-Commerce Storefront",
    desc: "Online orders & products",
    icon: ShoppingCart,
    active: false,
    url: process.env.NEXT_PUBLIC_OOS_URL ?? "https://localhost:3004/",
  },
  {
    fullName: "Point of Sale",
    desc: "Retail & register checkout",
    icon: CreditCard,
    active: false,
    url: process.env.NEXT_PUBLIC_POS_URL ?? "https://localhost:3002/",
  },
  {
    fullName: "Inventory Management",
    desc: "Inventory & logistics",
    icon: Truck,
    active: true,
  },
];
