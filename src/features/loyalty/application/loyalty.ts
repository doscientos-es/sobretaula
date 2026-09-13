import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { authMiddleware } from "@/features/auth/infrastructure/server/auth-middleware";
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from "@/features/tenancy/application/require-tenant-membership";
import { paginationRange, type PaginatedResult } from "@/shared/lib/pagination";
import { createRequestSupabaseClient } from "@/shared/lib/supabase/server/create-server-client";

const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const;
const base = z.object({ tenantId: z.string().uuid() });
const listInput = base.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export interface LoyaltyGuest {
  id: string;
  name: string;
  contact: string;
  points: number;
  lifetimePoints: number;
}

export const listLoyaltyGuests = createServerFn({ method: "GET" })
  .middleware(middleware)
  .validator(listInput)
  .handler(
    async ({ context, data }): Promise<PaginatedResult<LoyaltyGuest>> => {
      const range = paginationRange(data);
      const supabase = createRequestSupabaseClient(
        context.tenantMembership.accessToken,
      );
      const {
        data: rows,
        error,
        count,
      } = await supabase
        .from("loyalty_accounts")
        .select(
          "guest_id, points, lifetime_points, guests(full_name, email, phone)",
          {
            count: "exact",
          },
        )
        .eq("tenant_id", data.tenantId)
        .order("points", { ascending: false })
        .range(range.from, range.to);
      if (error) throw new Error(`loyalty_load_failed:${error.code}`);
      const items = (rows ?? []).map((row) => {
        const guest = row.guests as unknown as {
          full_name?: string;
          email?: string | null;
          phone?: string | null;
        } | null;
        return {
          id: row.guest_id,
          name: guest?.full_name ?? "Cliente",
          contact: guest?.email ?? guest?.phone ?? "Sin contacto",
          points: Number(row.points),
          lifetimePoints: Number(row.lifetime_points),
        };
      }) satisfies LoyaltyGuest[];
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

export const adjustLoyaltyPoints = createServerFn({ method: "POST" })
  .middleware(middleware)
  .validator(
    base.extend({
      guestId: z.string().uuid(),
      points: z.number().int().min(-100000).max(100000),
      reason: z.string().trim().min(1).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!["owner", "manager"].includes(context.tenantMembership.role))
      throw new Response("Forbidden", { status: 403 });
    const supabase = createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    );
    const { error } = await supabase.rpc("adjust_loyalty_points", {
      p_tenant_id: data.tenantId,
      p_guest_id: data.guestId,
      p_points: data.points,
      p_reason: data.reason,
    });
    if (error) throw new Error(`loyalty_adjust_failed:${error.code}`);
    return { saved: true };
  });

export const redeemLoyaltyPoints = createServerFn({ method: "POST" })
  .middleware(middleware)
  .validator(
    base.extend({
      guestId: z.string().uuid(),
      points: z.number().int().positive().max(100000),
      reward: z.string().trim().min(1).max(200),
    }),
  )
  .handler(async ({ context, data }) => {
    const { error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    ).rpc("redeem_loyalty_points", {
      p_tenant_id: data.tenantId,
      p_guest_id: data.guestId,
      p_points: data.points,
      p_reward: data.reward,
    });
    if (error) throw new Error(`loyalty_redeem_failed:${error.code}`);
    return { saved: true };
  });
