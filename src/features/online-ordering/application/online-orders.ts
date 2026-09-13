import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/features/auth/infrastructure/server/auth-middleware";
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from "@/features/tenancy/application/require-tenant-membership";
import { paginationRange, type PaginatedResult } from "@/shared/lib/pagination";
import { createRequestSupabaseClient } from "@/shared/lib/supabase/server/create-server-client";

import {
  canAdvanceOnlineOrder,
  type OnlineOrderStatus,
} from "../domain/order-status";
const readInput = z.object({
  tenantId: z.string().uuid(),
  venueId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export interface OnlineOrderSummary {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  channel: string;
  status: string;
  total_cents: number;
  requested_for: string | null;
  created_at: string;
}
const statusInput = readInput.extend({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "accepted",
    "preparing",
    "ready",
    "completed",
    "cancelled",
  ]),
});
export const listOnlineOrders = createServerFn({ method: "GET" })
  .middleware([
    authMiddleware,
    tenantMembershipMiddleware,
    operationalTenantMiddleware,
  ])
  .validator(readInput)
  .handler(
    async ({ context, data }): Promise<PaginatedResult<OnlineOrderSummary>> => {
      const range = paginationRange(data);
      const {
        data: orders,
        error,
        count,
      } = await createRequestSupabaseClient(
        context.tenantMembership.accessToken,
      )
        .from("online_orders")
        .select(
          "id, customer_name, customer_phone, channel, status, total_cents, requested_for, created_at",
          { count: "exact" },
        )
        .eq("tenant_id", data.tenantId)
        .eq("venue_id", data.venueId)
        .in("status", [
          "pending",
          "accepted",
          "preparing",
          "ready",
          "completed",
        ])
        .order("requested_for")
        .range(range.from, range.to);
      if (error) throw new Error(`online_orders_load_failed:${error.code}`);
      const total = count ?? 0;
      return {
        items: (orders ?? []) as OnlineOrderSummary[],
        page: data.page,
        pageSize: data.pageSize,
        total,
        hasMore: range.to + 1 < total,
      };
    },
  );
export const updateOnlineOrderStatus = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    tenantMembershipMiddleware,
    operationalTenantMiddleware,
  ])
  .validator(statusInput)
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    );
    const { data: order, error: loadError } = await supabase
      .from("online_orders")
      .select("status")
      .eq("id", data.orderId)
      .eq("tenant_id", data.tenantId)
      .eq("venue_id", data.venueId)
      .single();
    if (loadError)
      throw new Error(`online_order_load_failed:${loadError.code}`);
    if (!canAdvanceOnlineOrder(order.status as OnlineOrderStatus, data.status))
      throw new Error("online_order_invalid_transition");
    const { error } = await supabase
      .from("online_orders")
      .update({ status: data.status })
      .eq("id", data.orderId)
      .eq("tenant_id", data.tenantId)
      .eq("venue_id", data.venueId);
    if (error) throw new Error(`online_order_status_failed:${error.code}`);
    return { saved: true };
  });
