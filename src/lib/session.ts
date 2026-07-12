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

  const household =
    (await prisma.household.findFirst()) ??
    (await prisma.household.create({ data: { name: SHARED_HOUSEHOLD_NAME } }));

  const membership = await prisma.householdMember.create({
    data: { householdId: household.id, userId },
    include: { household: true },
  });

  return { session, household: membership.household, userId };
});
