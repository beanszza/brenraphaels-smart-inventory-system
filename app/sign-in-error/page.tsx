import { AuthScreen, primaryActionClass } from "@/components/auth/AuthScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LOGIN_PATH } from "@/lib/portal/config";

export const dynamic = "force-dynamic";

const REASONS = {
  failed: {
    title: "We couldn't sign you in",
    message: "The sign-in didn't complete. Try again from the start.",
  },
  unavailable: {
    title: "The Portal can't be reached",
    message: "We couldn't reach the Portal to finish signing you in. Try again in a moment.",
  },
  denied: {
    title: "You don't have access to IMS",
    message: "Your account doesn't hold any IMS Module. Ask an administrator to grant one, then sign in again.",
  },
} as const;

export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason;
  const { title, message } =
    reason && Object.hasOwn(REASONS, reason)
      ? REASONS[reason as keyof typeof REASONS]
      : REASONS.failed;
  return (
    <AuthScreen
      title={title}
      actions={
        <>
          {/* A full navigation: the login route sets a cookie and redirects off-site. */}
          <a href={LOGIN_PATH} className={primaryActionClass}>Try again</a>
          <SignOutButton />
        </>
      }
    >
      <p>{message}</p>
    </AuthScreen>
  );
}
