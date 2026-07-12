import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold">Ledger</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        Shared household finance tracker
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
