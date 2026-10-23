import { safeReturnTo } from "@/lib/portal/return-to";

export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <h1 className="text-xl font-bold">Sign-in is temporarily unavailable</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        We couldn&apos;t check your access right now. Try again in a moment.
      </p>
      {/* A full navigation, so the access check runs again. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href={returnTo} className="text-sm font-medium underline">Try again</a>
    </main>
  );
}
