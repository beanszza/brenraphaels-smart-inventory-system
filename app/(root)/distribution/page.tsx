"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DistributionPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/stock-transfer");
  }, [router]);

  return null;
}
