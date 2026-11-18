import Image from "next/image";

import { cn } from "@/lib/utils";

const SYSTEM_NAMES = {
  CREOMS: "Customer Relation & Ecommerce Ordering Management System",
  HRMS: "Human Resource Management System",
  IMS: "Inventory Management System",
  POS: "Point of Sale System",
  "Enterprise Suite": "Enterprise Suite",
} as const;

export type BrandSystem = keyof typeof SYSTEM_NAMES;

/**
 * The Figma "Logo/Lockup": chef tile, "Bren Raphael's" and the system name beside it.
 * Light is for white backgrounds, Dark for purple backgrounds.
 */
export function BrandLockup({
  system,
  tone = "Light",
  className,
}: {
  system: BrandSystem;
  tone?: "Light" | "Dark";
  className?: string;
}) {
  const dark = tone === "Dark";

  return (
    <div className={cn("flex items-center gap-3 text-left", className)}>
      <div
        className={cn(
          "relative size-12 shrink-0 overflow-hidden rounded-inner bg-surface",
          !dark && "border border-brand-lockup-tile-border",
        )}
      >
        <Image
          src="/images/brand/logo-tile.png"
          alt=""
          fill
          sizes="48px"
          className="object-contain p-[3px]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] font-semibold">
        <p
          className={cn(
            "whitespace-nowrap font-brand type-wordmark leading-normal",
            dark ? "text-brand-lockup-wordmark-dark" : "text-brand-lockup-wordmark-light",
          )}
          style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1' }}
        >
          Bren Raphael&apos;s
        </p>
        <p
          className={cn(
            "type-brand-caption",
            dark ? "text-brand-lockup-caption-dark" : "text-brand-lockup-caption-light",
          )}
        >
          {SYSTEM_NAMES[system]}
        </p>
      </div>
    </div>
  );
}
