import { AuthScreen, primaryActionClass } from "@/components/auth/AuthScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { safeReturnTo } from "@/lib/portal/return-to";

export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  return (
    <AuthScreen
      title="Sign-in is temporarily unavailable"
      actions={
        <>
          {/* A full navigation, so the access check runs again. */}
          <a href={returnTo} className={primaryActionClass}>Try again</a>
          <SignOutButton />
        </>
      }
    >
      <p>We couldn&apos;t check your access right now. Try again in a moment.</p>
    </AuthScreen>
  );
}
