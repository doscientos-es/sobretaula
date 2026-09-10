import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/features/auth/infrastructure/server/auth-middleware";
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from "@/features/tenancy/application/require-tenant-membership";
import { createRequestSupabaseClient } from "@/shared/lib/supabase/server/create-server-client";

import { findSeatingConflicts, seatingCapacity } from "../domain/service-board";
import { loadServiceBoard } from "../infrastructure/server/service-board-repository";
import {
  requireWaitlistEditor,
  seatWaitlistEntryInput,
  waitlistEntryInput,
  waitlistEntryReference,
} from "./service-schema";

/** Registers a party waiting at the door, with the guest record when it is given. */
export const addToWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(waitlistEntryInput)
  .handler(async ({ context, data }) => {
    requireWaitlistEditor(context.tenantMembership.role);
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken);
    let guestId: string | null = null;
    if (data.guestName || data.guestPhone) {
      const existing = data.guestPhone
        ? await supabase
            .from("guests")
            .select("id")
            .eq("tenant_id", data.tenantId)
            .eq("phone", data.guestPhone)
            .maybeSingle()
        : { data: null, error: null };
      if (existing.error)
        throw new Error(`waitlist_guest_lookup_failed:${existing.error.code}`);
      const { data: guest, error: guestError } = existing.data
        ? { data: existing.data, error: null }
        : await supabase
            .from("guests")
            .insert({
              full_name: data.guestName ?? "Sin nombre",
              phone: data.guestPhone ?? null,
              tenant_id: data.tenantId,
            })
            .select("id")
            .single();
      if (guestError || !guest)
        throw new Error(`waitlist_guest_create_failed:${guestError?.code ?? "unknown"}`);
      guestId = guest.id as string;
    }

    const { data: entry, error } = await supabase
      .from("waitlist")
      .insert({
        estimated_wait_minutes: data.estimatedWaitMinutes,
        guest_id: guestId,
        party_size: data.partySize,
        requested_for: new Date().toISOString(),
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
      .select("id")
      .single();
    if (error || !entry) throw new Error(`waitlist_create_failed:${error?.code ?? "unknown"}`);

    return { waitlistEntryId: entry.id as string };
  });

export const removeFromWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(waitlistEntryReference)
  .handler(async ({ context, data }) => {
    requireWaitlistEditor(context.tenantMembership.role);
    const { error } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
      .from("waitlist")
      .delete()
      .eq("id", data.waitlistEntryId)
      .eq("tenant_id", data.tenantId)
      .eq("venue_id", data.venueId);
    if (error) throw new Error(`waitlist_delete_failed:${error.code}`);

    return { waitlistEntryId: data.waitlistEntryId };
  });

/**
 * Seats a waiting party: the session is what frees the entry, so the row is only
 * removed once the tables are really taken.
 */
export const seatWaitlistEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(seatWaitlistEntryInput)
  .handler(async ({ context, data }) => {
    requireWaitlistEditor(context.tenantMembership.role);
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken);
    const { data: entry, error: entryError } = await supabase
      .from("waitlist")
      .select("id, party_size")
      .eq("id", data.waitlistEntryId)
      .eq("tenant_id", data.tenantId)
      .eq("venue_id", data.venueId)
      .single();
    if (entryError || !entry) throw new Response("Not found", { status: 404 });

    const board = await loadServiceBoard(supabase, {
      now: new Date(),
      tenantId: data.tenantId,
      venueId: data.venueId,
    });
    if (findSeatingConflicts(board.tables, data.tableIds).length > 0)
      throw new Response("Table occupied", { status: 409 });
    if (seatingCapacity(board.tables, data.tableIds) < (entry.party_size as number))
      throw new Response("Not enough seats", { status: 422 });

    const { data: session, error } = await supabase
      .from("table_sessions")
      .insert({
        covers: entry.party_size,
        opened_by: context.tenantMembership.userId,
        status: "open",
        table_ids: data.tableIds,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
      })
      .select("id")
      .single();
    if (error || !session)
      throw new Error(`table_session_create_failed:${error?.code ?? "unknown"}`);

    const { error: deleteError } = await supabase
      .from("waitlist")
      .delete()
      .eq("id", entry.id)
      .eq("tenant_id", data.tenantId);
    if (deleteError) throw new Error(`waitlist_delete_failed:${deleteError.code}`);

    return { sessionId: session.id as string };
  });
