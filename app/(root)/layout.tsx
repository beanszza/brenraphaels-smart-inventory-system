import { headers } from "next/headers";
import { RootShell } from "@/components/shared/RootShell";
import { requireShell } from "@/lib/portal/staff";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-return-to") ?? "/";
  const { modules } = await requireShell(pathname);
  return <RootShell modules={modules}>{children}</RootShell>;
}
