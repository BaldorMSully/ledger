"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { dollarsToCents } from "@/lib/money";
import { parseMonthInput } from "@/lib/dates";

export async function createBucket(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim();
  const bucketGroup = String(formData.get("bucketGroup") ?? "").trim() || null;
  if (!name) throw new Error("Bucket name is required");

  const bucket = await prisma.bucket.create({
    data: { householdId: household.id, name, bucketGroup },
  });
  await logAudit({
    householdId: household.id,
    entityType: "Bucket",
    entityId: bucket.id,
    actorUserId: userId,
    action: "create",
    diff: { name, bucketGroup },
  });

  revalidatePath("/buckets");
  revalidatePath("/");
}

export async function archiveBucket(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const bucketId = String(formData.get("bucketId") ?? "");

  const bucket = await prisma.bucket.findFirst({
    where: { id: bucketId, householdId: household.id },
  });
  if (!bucket) throw new Error("Bucket not found");

  await prisma.bucket.update({
    where: { id: bucketId },
    data: { isActive: false },
  });
  await logAudit({
    householdId: household.id,
    entityType: "Bucket",
    entityId: bucketId,
    actorUserId: userId,
    action: "update",
    diff: { isActive: false },
  });

  revalidatePath("/buckets");
  revalidatePath("/");
}

export async function setAllocation(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const bucketId = String(formData.get("bucketId") ?? "");
  const monthValue = String(formData.get("month") ?? "");
  const amount = String(formData.get("amount") ?? "0");

  const bucket = await prisma.bucket.findFirst({
    where: { id: bucketId, householdId: household.id },
  });
  if (!bucket) throw new Error("Bucket not found");

  const month = parseMonthInput(monthValue);
  const allocatedAmountCents = dollarsToCents(amount);
  if (allocatedAmountCents < 0) {
    throw new Error("Allocation must not be negative");
  }

  const allocation = await prisma.bucketAllocation.upsert({
    where: { bucketId_month: { bucketId, month } },
    create: { bucketId, month, allocatedAmountCents },
    update: { allocatedAmountCents },
  });

  await logAudit({
    householdId: household.id,
    entityType: "BucketAllocation",
    entityId: allocation.id,
    actorUserId: userId,
    action: "update",
    diff: { month: monthValue, allocatedAmountCents },
  });

  revalidatePath("/buckets");
  revalidatePath("/");
}
