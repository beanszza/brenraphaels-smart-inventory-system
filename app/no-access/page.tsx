import { AuthScreen } from "@/components/auth/AuthScreen";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function NoAccessPage() {
  return (
    <AuthScreen title="You don't have access to this page" actions={<SignOutButton />}>
      <p>
        Your account doesn&apos;t hold the Module this page belongs to. Ask an administrator to
        grant it, then sign in again.
      </p>
    </AuthScreen>
  );
}
