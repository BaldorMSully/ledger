import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function allowedEmails(): string[] {
  return (process.env.ALLOWED_HOUSEHOLD_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [Google],
  callbacks: {
    // This is the AUTHORITATIVE allowlist check — it runs on every sign-in attempt,
    // regardless of what proxy.ts's optimistic check or any UI state assumes.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return allowedEmails().includes(email);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
