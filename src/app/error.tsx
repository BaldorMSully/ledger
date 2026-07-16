"use client";

// Root error boundary — without one, any uncaught server error (a bad form value that
// slipped validation, a DB hiccup) renders Next's unstyled crash page. Server-side
// error messages are digest-masked in production, so keep the copy generic.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
      >
        Try again
      </button>
    </div>
  );
}
