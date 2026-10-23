import { headers } from "next/headers";
import { RootShell } from "@/components/shared/RootShell";
import { requireShell } from "@/lib/portal/staff";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Without the proxy's header the page is unknown, so no Module owns it and access is denied.
  const pathname = (await headers()).get("x-return-to") ?? "";
  const { modules } = await requireShell(pathname);
  return <RootShell modules={modules}>{children}</RootShell>;
}
