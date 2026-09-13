import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/features/auth/infrastructure/server/auth-middleware";
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from "@/features/tenancy/application/require-tenant-membership";
import { paginationRange, type PaginatedResult } from "@/shared/lib/pagination";
import { createRequestSupabaseClient } from "@/shared/lib/supabase/server/create-server-client";

const input = z.object({
  tenantId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export interface NotificationJobSummary {
  id: string;
  channel: string;
  type: string;
  status: string;
  attempts: number;
  scheduledFor: string;
  lastError: string | null;
}

export const getNotificationJobs = createServerFn({ method: "GET" })
  .middleware([
    authMiddleware,
    tenantMembershipMiddleware,
    operationalTenantMiddleware,
  ])
  .validator(input)
  .handler(
    async ({
      context,
      data,
    }): Promise<PaginatedResult<NotificationJobSummary>> => {
      const range = paginationRange(data);
      const supabase = createRequestSupabaseClient(
        context.tenantMembership.accessToken,
      );
      const {
        data: jobs,
        error,
        count,
      } = await supabase
        .from("reservation_notification_jobs")
        .select(
          "attempts, channel, id, last_error, scheduled_for, status, type",
          { count: "exact" },
        )
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (error) throw new Error(`notification_jobs_load_failed:${error.code}`);
      const items = (jobs ?? []).map((job) => ({
        id: job.id,
        channel: job.channel,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        scheduledFor: job.scheduled_for,
        lastError: job.last_error,
      }));
      const total = count ?? items.length;
      return {
        items,
        page: data.page,
        pageSize: data.pageSize,
        total,
        hasMore: data.page * data.pageSize < total,
      };
    },
  );

export const requeueNotificationJob = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    tenantMembershipMiddleware,
    operationalTenantMiddleware,
  ])
  .validator(
    z.object({ tenantId: z.string().uuid(), jobId: z.string().uuid() }),
  )
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    );
    const { data: requeued, error } = await supabase.rpc(
      "requeue_reservation_notification_job",
      {
        p_id: data.jobId,
        p_tenant_id: data.tenantId,
      },
    );
    if (error) throw new Error(`notification_job_requeue_failed:${error.code}`);
    return requeued === true;
  });
