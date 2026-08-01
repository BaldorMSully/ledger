"use server";

import { revalidatePath } from "next/cache";
import { requireHousehold } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function completeCheckIn() {
  const { household, userId } = await requireHousehold();
  const now = new Date();

  await prisma.household.update({
    where: { id: household.id },
    data: { lastCheckInCompletedAt: now },
  });

  await logAudit({
    householdId: household.id,
    entityType: "Household",
    entityId: household.id,
    actorUserId: userId,
    action: "update",
    diff: { lastCheckInCompletedAt: now },
  });

  revalidatePath("/");
  revalidatePath("/transactions");
}

export async function createHeadsUpNote(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Note text is required");

  const note = await prisma.headsUpNote.create({
    data: { householdId: household.id, body, createdBy: userId },
  });

  await logAudit({
    householdId: household.id,
    entityType: "HeadsUpNote",
    entityId: note.id,
    actorUserId: userId,
    action: "create",
    diff: { body },
  });

  revalidatePath("/");
}

export async function resolveHeadsUpNote(formData: FormData) {
  const { household, userId } = await requireHousehold();
  const noteId = String(formData.get("noteId") ?? "");

  const note = await prisma.headsUpNote.findFirst({
    where: { id: noteId, householdId: household.id },
  });
  if (!note) throw new Error("Note not found");

  await prisma.headsUpNote.update({
    where: { id: noteId },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  await logAudit({
    householdId: household.id,
    entityType: "HeadsUpNote",
    entityId: noteId,
    actorUserId: userId,
    action: "update",
    diff: { status: "resolved" },
  });

  revalidatePath("/");
}
