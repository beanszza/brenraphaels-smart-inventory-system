import { LOGOUT_PATH } from "@/lib/portal/config";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-xl font-bold">You don&apos;t have access to this page</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your account doesn&apos;t hold the Module this page belongs to. Ask an administrator
        to grant it, then sign in again.
      </p>
      <div className="flex items-center gap-4 text-sm font-medium">
        <form action={LOGOUT_PATH} method="post">
          <button type="submit" className="underline">Sign out</button>
        </form>
      </div>
    </main>
  );
}
