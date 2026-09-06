// Thin insert helper for ad-hoc deferred work (e.g. a future "process this AI proposal
// batch" job). The three fixed periodic tasks in lib/jobs/registry.ts don't use this —
// /api/jobs/run decides directly whether each is due and runs it, then writes a Job row
// as an audit record. This exists so a later feature that needs genuine one-off
// scheduling (not just "run daily") has somewhere to enqueue into without inventing a
// second job table.
import { prisma } from "@/lib/db";
import type { JobType } from "@/generated/prisma/client";

export async function enqueueJob(
  type: JobType,
  opts: { userId?: string; payload?: unknown; scheduledFor?: Date } = {}
) {
  return prisma.job.create({
    data: {
      type,
      userId: opts.userId,
      payload: opts.payload !== undefined ? JSON.stringify(opts.payload) : undefined,
      scheduledFor: opts.scheduledFor ?? new Date(),
    },
  });
}
