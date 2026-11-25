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
  Package,
  Wrench,
  SlidersHorizontal,
  ArrowLeftRight,
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
  /** When true, only Admin staff see this item in the sidebar. */
  adminOnly?: boolean;
  /** When true, only staff authorized for stock write-off (Admin and IMS Manager) see this item. */
  writeOffOnly?: boolean;
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
  /** The name the Portal knows this System by; the Enterprise Portal entry has none. */
  portalName?: string;
}

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { name: "Dashboard",            href: "/",                    icon: LayoutDashboard, module: "Dashboard" },
      { name: "Resources & Suppliers", href: "/resources-suppliers", icon: Warehouse, module: "Resources & Suppliers" },
      { name: "Recipe",               href: "/recipes",             icon: ClipboardList, module: "Resources & Suppliers", adminOnly: true },
      { name: "Orders & Procurement", href: "/orders-procurement",  icon: ShoppingCart, module: "Orders & Procurement" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { name: "Raw Materials",     href: "/inventory/raw-materials",     icon: Package,           module: "Inventory" },
      { name: "Tools",             href: "/inventory/tools",             icon: Wrench,            module: "Inventory" },
      { name: "Finished Products", href: "/inventory/finished-products", icon: PackageCheck,      module: "Inventory" },
      { name: "Stock Write-Off",   href: "/inventory/write-off",         icon: SlidersHorizontal, module: "Inventory", writeOffOnly: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Goods Receiving",      href: "/goods-receiving",     icon: PackageCheck, module: "Goods Receiving" },
      { name: "Production & Quality", href: "/production-quality",  icon: Building2, module: "Production & Quality" },
      { name: "Stock Transfer",       href: "/stock-transfer",      icon: Truck, module: "Stock Transfer" },
      { name: "Branch Requests",      href: "/branch-requests",     icon: ArrowLeftRight, module: "Stock Transfer" },
    ],
  },
];

/** Sidebar groups limited to the Modules the Staff member holds; empty groups are dropped. */
export function visibleNavGroups(
  modules: readonly Module[],
  isAdmin = false,
  canWriteOff = isAdmin
): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.module || !modules.includes(item.module)) return false;
        if (item.adminOnly && !isAdmin) return false;
        if (item.writeOffOnly && !canWriteOff) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Pages that are reachable but not in the sidebar still belong to one Module. */
const unlistedRoutes: Record<string, Module> = {
  "/inventory": "Inventory",
  "/cycle-counts": "Inventory",
  "/traceability": "Inventory",
  "/valuation": "Inventory",
  "/mrp": "Orders & Procurement",
  "/distribution": "Stock Transfer",
  "/distribution-analytics": "Stock Transfer",
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
    fullName: "Customer Relation and Ecommerce Ordering Management System",
    portalName: "CRMS",
    desc: "Customers, orders, tickets & feedback",
    icon: Building2,
    active: false,
    url: process.env.NEXT_PUBLIC_CRMS_URL ?? "https://localhost:3005/",
  },
  {
    fullName: "Human Resource Management System",
    portalName: "HRMS",
    desc: "Staff directory & payroll",
    icon: Users2,
    active: false,
    url: process.env.NEXT_PUBLIC_HRMS_URL ?? "https://localhost:3001/",
  },
  {
    fullName: "Point of Sale System",
    portalName: "POS",
    desc: "Retail & register checkout",
    icon: CreditCard,
    active: false,
    url: process.env.NEXT_PUBLIC_POS_URL ?? "https://localhost:3002/",
  },
  {
    fullName: "Inventory Management System",
    portalName: "IMS",
    desc: "Inventory & logistics",
    icon: Truck,
    active: true,
  },
];

/**
 * The switcher entries this person may open: the Enterprise Portal, the System already open,
 * and every System the Portal says an Admin granted them. When the Portal's answer is not known
 * (null) only those first two show, so nothing is offered that may be refused.
 */
export function visibleSystems<T extends { portalName?: string; active: boolean }>(
  all: readonly T[],
  allowed: readonly string[] | null,
): T[] {
  return all.filter(
    (sys) => !sys.portalName || sys.active || (allowed?.includes(sys.portalName) ?? false),
  );
}
