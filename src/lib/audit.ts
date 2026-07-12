import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/client";

export async function logAudit(params: {
  householdId: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  action: AuditAction;
  diff?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      householdId: params.householdId,
      entityType: params.entityType,
      entityId: params.entityId,
      actorUserId: params.actorUserId,
      action: params.action,
      diff: params.diff ? JSON.parse(JSON.stringify(params.diff)) : undefined,
    },
  });
}

/** Latest audit entry per entityId, for "last edited by/when" display in list views. */
export async function latestAuditByEntity(entityType: string, entityIds: string[]) {
  const latest = new Map<string, { actorName: string; timestamp: Date }>();
  if (entityIds.length === 0) return latest;

  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId: { in: entityIds } },
    orderBy: { timestamp: "desc" },
    include: { actor: { select: { name: true, email: true } } },
  });

  for (const entry of entries) {
    if (!latest.has(entry.entityId)) {
      latest.set(entry.entityId, {
        actorName: entry.actor.name ?? entry.actor.email,
        timestamp: entry.timestamp,
      });
    }
  }
  return latest;
}
