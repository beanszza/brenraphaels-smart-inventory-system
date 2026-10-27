import { AuthScreen } from "@/components/auth/AuthScreen";
import { ContinueToPortal } from "@/components/auth/ContinueToPortal";
import { LOGIN_PATH } from "@/lib/portal/config";
import { safeReturnTo } from "@/lib/portal/return-to";

export const dynamic = "force-dynamic";

export default async function SigningInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  return (
    <AuthScreen title="Signing you in">
      <p>Taking you to the Bren Raphael&apos;s Portal. You&apos;ll come straight back here.</p>
      <ContinueToPortal href={`${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`} />
    </AuthScreen>
  );
}
