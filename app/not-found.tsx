import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 text-ink">
      <div className="flex max-w-2xl flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-pill bg-subtle">
          <FileQuestion className="size-8 text-ink-muted" />
        </div>
        <h1 className="mb-2 type-page-title text-ink">404</h1>
        <p className="mb-8 type-body text-ink-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild variant="default" size="lg">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
