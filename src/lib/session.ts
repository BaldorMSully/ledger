import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authoritative session check — hits the database via Auth.js's "database" session
 * strategy. Call this (or requireHousehold below) at the top of every Server Action and
 * protected Server Component; proxy.ts's check is optimistic only, not a real boundary.
 */
export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return session;
});

const SHARED_HOUSEHOLD_NAME = "Household";

/**
 * This app is designed to serve exactly one household. The first allowlisted person to
 * sign in creates it; anyone else who signs in (necessarily the other allowlisted email,
 * since sign-in itself is gated by ALLOWED_HOUSEHOLD_EMAILS) joins the same one.
 */
export const requireHousehold = cache(async () => {
  const session = await requireSession();
  const userId = session.user.id;

  const existingMembership = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: true },
  });
  if (existingMembership) {
    return { session, household: existingMembership.household, userId };
  }

  // Serializable + ordered so two concurrent first sign-ins can't each create a
  // household (one aborts on the serialization conflict and retries into the existing
  // row). Household has no unique column to lean on, so isolation is the guard here.
  const getOrCreateHousehold = () =>
    prisma.$transaction(
      async (tx) => {
        const existing = await tx.household.findFirst({
          orderBy: { createdAt: "asc" },
        });
        return (
          existing ??
          tx.household.create({ data: { name: SHARED_HOUSEHOLD_NAME } })
        );
      },
      { isolationLevel: "Serializable" }
    );

  let household;
  try {
    household = await getOrCreateHousehold();
  } catch {
    household = await getOrCreateHousehold();
  }

  // Upsert so a double-submit can't trip the (householdId, userId) unique constraint.
  const membership = await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId } },
    create: { householdId: household.id, userId },
    update: {},
    include: { household: true },
  });

  return { session, household: membership.household, userId };
});
