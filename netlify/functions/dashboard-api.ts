// netlify/functions/dashboard-api.ts
import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import {
  leads,
  calls,
  boats,
  ebayListings,
  sales,
  conversionExports,
  auditHistory,
  visitors,
  sessions,
  events
} from "../../db/schema.js";
import { runMigrations } from "../../db/migrate.js";
import { verifyDashboardAuth, sha256 } from "../../lib/attribution.js";
import { desc, eq, sql, and, gte, lte } from "drizzle-orm";

let migrated = false;

export default async (req: Request, context: Context) => {
  // 1. Enforce Authentication on All Methods
  const authHeader = req.headers.get("authorization") || req.headers.get("x-dashboard-key");
  if (!verifyDashboardAuth(authHeader)) {
    return new Response(JSON.stringify({ error: "Unauthorized access to internal dashboard" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!migrated) {
    try {
      await runMigrations();
      migrated = true;
    } catch (e) {
      console.warn("[dashboard-api] migration warning:", e);
    }
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  try {
    // ==========================================================
    // GET REQUESTS: Data retrieval & reporting
    // ==========================================================
    if (req.method === "GET") {
      // Overview / Metrics & ROAS
      if (action === "overview") {
        const [totalLeadsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(leads);
        const [totalCallsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(calls);
        const [totalBoatsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(boats);
        const [totalSalesRow] = await db.select({
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`coalesce(sum(${sales.saleAmount}), 0)::numeric`
        }).from(sales);

        // Breakdown by Marketing Source (Last non-direct & First touch)
        const bySource = await db.select({
          source: sql<string>`coalesce(nullif(${leads.lastTouchSource}, ''), nullif(${leads.firstTouchSource}, ''), 'direct')`,
          leadsCount: sql<number>`count(distinct ${leads.id})::int`,
          acceptedBoats: sql<number>`count(distinct ${boats.id})::int`,
          salesCount: sql<number>`count(distinct ${sales.id})::int`,
          grossRevenue: sql<number>`coalesce(sum(${sales.saleAmount}), 0)::numeric`
        })
        .from(leads)
        .leftJoin(boats, eq(boats.leadId, leads.id))
        .leftJoin(sales, eq(sales.boatId, boats.id))
        .groupBy(sql`coalesce(nullif(${leads.lastTouchSource}, ''), nullif(${leads.firstTouchSource}, ''), 'direct')`);

        return Response.json({
          metrics: {
            leads: Number(totalLeadsRow?.count || 0),
            calls: Number(totalCallsRow?.count || 0),
            acceptedDonations: Number(totalBoatsRow?.count || 0),
            soldBoats: Number(totalSalesRow?.count || 0),
            grossRevenue: Number(totalSalesRow?.revenue || 0),
            conversionRate: Number(totalLeadsRow?.count ? ((totalSalesRow?.count || 0) / totalLeadsRow.count * 100).toFixed(2) : 0)
          },
          sourceBreakdown: bySource
        });
      }

      // List Leads with Full Attribution Details
      if (action === "leads") {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
        const leadList = await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
        return Response.json({ leads: leadList });
      }

      // List Calls with Attribution
      if (action === "calls") {
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);
        const callList = await db.select().from(calls).orderBy(desc(calls.callTime)).limit(limit);
        return Response.json({ calls: callList });
      }

      // List Boats & Pipeline
      if (action === "boats") {
        const boatList = await db.select().from(boats).orderBy(desc(boats.acceptedDate));
        return Response.json({ boats: boatList });
      }

      // List eBay Listings
      if (action === "listings") {
        const listingList = await db.select().from(ebayListings).orderBy(desc(ebayListings.createdAt));
        return Response.json({ listings: listingList });
      }

      // List Sales
      if (action === "sales") {
        const saleList = await db.select().from(sales).orderBy(desc(sales.saleDate));
        return Response.json({ sales: saleList });
      }

      // List Conversions Queue for Google Ads Upload
      if (action === "conversions") {
        const convList = await db.select().from(conversionExports).orderBy(desc(conversionExports.conversionTime));
        return Response.json({ conversions: convList });
      }

      // List Audit History
      if (action === "audit") {
        const auditList = await db.select().from(auditHistory).orderBy(desc(auditHistory.createdAt)).limit(100);
        return Response.json({ audit: auditList });
      }
    }

    // ==========================================================
    // POST REQUESTS: Pipeline Actions & Attribution Corrections
    // ==========================================================
    if (req.method === "POST") {
      const body = await req.json();
      const actor = body.performed_by || "staff_user";

      // 1. Update Lead Status & Stage
      if (action === "update_lead_stage") {
        const { lead_id, stage, notes } = body;
        if (!lead_id || !stage) return new Response("Missing lead_id or stage", { status: 400 });
        
        const [existing] = await db.select().from(leads).where(eq(leads.id, Number(lead_id))).limit(1);
        if (!existing) return new Response("Lead not found", { status: 404 });

        const [updated] = await db.update(leads)
          .set({ stage, updatedAt: sql`now()` })
          .where(eq(leads.id, Number(lead_id)))
          .returning();

        // If stage updated to 'Qualified', auto-queue secondary Google Ads offline conversion
        if (stage === "Qualified") {
          const convId = `conv_qual_lead_${lead_id}`;
          await db.insert(conversionExports).values({
            conversionId: convId,
            conversionType: "Qualified_Lead",
            leadId: Number(lead_id),
            gclid: existing.gclid || "",
            gbraid: existing.gbraid || "",
            wbraid: existing.wbraid || "",
            conversionTime: new Date(),
            conversionValue: "0.0",
            currency: "USD",
            hashedEmail: sha256(existing.email),
            hashedPhone: sha256(existing.phone),
            exportStatus: "Pending"
          }).onConflictDoNothing();
        }

        // If stage updated to 'Donation Accepted', auto-queue primary Google Ads offline conversion
        if (stage === "Donation Accepted") {
          const convId = `conv_accept_lead_${lead_id}`;
          await db.insert(conversionExports).values({
            conversionId: convId,
            conversionType: "Donation_Accepted",
            leadId: Number(lead_id),
            gclid: existing.gclid || "",
            gbraid: existing.gbraid || "",
            wbraid: existing.wbraid || "",
            conversionTime: new Date(),
            conversionValue: "1.0",
            currency: "USD",
            hashedEmail: sha256(existing.email),
            hashedPhone: sha256(existing.phone),
            exportStatus: "Pending"
          }).onConflictDoNothing();
        }

        // Record in audit history
        await db.insert(auditHistory).values({
          entityType: "lead",
          entityId: String(lead_id),
          action: "change_stage",
          performedBy: actor,
          previousState: { stage: existing.stage },
          newState: { stage },
          notes: notes || ""
        });

        return Response.json({ success: true, lead: updated });
      }

      // 2. Connect Call to Lead & Update Call Status
      if (action === "connect_call") {
        const { call_id, lead_id, stage, notes } = body;
        if (!call_id) return new Response("Missing call_id", { status: 400 });

        const [existingCall] = await db.select().from(calls).where(eq(calls.id, Number(call_id))).limit(1);
        if (!existingCall) return new Response("Call not found", { status: 404 });

        const [updatedCall] = await db.update(calls).set({
          leadId: lead_id ? Number(lead_id) : existingCall.leadId,
          stage: stage || existingCall.stage,
          updatedAt: sql`now()`
        }).where(eq(calls.id, Number(call_id))).returning();

        if (stage === "Qualified" && existingCall.gclid) {
          const convId = `conv_qual_call_${call_id}`;
          await db.insert(conversionExports).values({
            conversionId: convId,
            conversionType: "Qualified_Lead",
            callId: Number(call_id),
            leadId: lead_id ? Number(lead_id) : null,
            gclid: existingCall.gclid || "",
            conversionTime: new Date(),
            conversionValue: "0.0",
            currency: "USD",
            hashedPhone: sha256(existingCall.callerNumber),
            exportStatus: "Pending"
          }).onConflictDoNothing();
        }

        await db.insert(auditHistory).values({
          entityType: "call",
          entityId: String(call_id),
          action: "connect_call",
          performedBy: actor,
          previousState: existingCall,
          newState: updatedCall,
          notes: notes || `Connected call ${call_id} to lead ${lead_id || 'none'}`
        });

        return Response.json({ success: true, call: updatedCall });
      }

      // 3. Manual Attribution Correction with Audit Trail
      if (action === "correct_attribution") {
        const { lead_id, last_touch_source, last_touch_medium, last_touch_campaign, gclid, notes } = body;
        if (!lead_id) return new Response("Missing lead_id", { status: 400 });

        const [existing] = await db.select().from(leads).where(eq(leads.id, Number(lead_id))).limit(1);
        if (!existing) return new Response("Lead not found", { status: 404 });

        const [updated] = await db.update(leads).set({
          lastTouchSource: last_touch_source ?? existing.lastTouchSource,
          lastTouchMedium: last_touch_medium ?? existing.lastTouchMedium,
          lastTouchCampaign: last_touch_campaign ?? existing.lastTouchCampaign,
          gclid: gclid ?? existing.gclid,
          updatedAt: sql`now()`
        }).where(eq(leads.id, Number(lead_id))).returning();

        await db.insert(auditHistory).values({
          entityType: "lead",
          entityId: String(lead_id),
          action: "update_attribution",
          performedBy: actor,
          previousState: {
            lastTouchSource: existing.lastTouchSource,
            lastTouchMedium: existing.lastTouchMedium,
            lastTouchCampaign: existing.lastTouchCampaign,
            gclid: existing.gclid
          },
          newState: {
            lastTouchSource: updated.lastTouchSource,
            lastTouchMedium: updated.lastTouchMedium,
            lastTouchCampaign: updated.lastTouchCampaign,
            gclid: updated.gclid
          },
          notes: notes || "Manual attribution correction"
        });

        return Response.json({ success: true, lead: updated });
      }

      // 4. Create or Edit Boat & Queue Primary Conversion
      if (action === "create_boat" || action === "edit_boat") {
        const { boat_id, lead_id, call_id, title, hin, year, make, model, length_ft, vessel_type, condition, location_city, location_state, status, notes } = body;
        
        if (action === "edit_boat") {
          if (!boat_id) return new Response("Missing boat_id for edit", { status: 400 });
          const [existingBoat] = await db.select().from(boats).where(eq(boats.id, Number(boat_id))).limit(1);
          if (!existingBoat) return new Response("Boat not found", { status: 404 });

          const [updatedBoat] = await db.update(boats).set({
            title: title ?? existingBoat.title,
            hin: hin ?? existingBoat.hin,
            year: year ? parseInt(year, 10) : existingBoat.year,
            make: make ?? existingBoat.make,
            model: model ?? existingBoat.model,
            lengthFt: length_ft ? String(length_ft) : existingBoat.lengthFt,
            vesselType: vessel_type ?? existingBoat.vesselType,
            condition: condition ?? existingBoat.condition,
            locationCity: location_city ?? existingBoat.locationCity,
            locationState: location_state ?? existingBoat.locationState,
            status: status ?? existingBoat.status,
            notes: notes ?? existingBoat.notes,
            updatedAt: sql`now()`
          }).where(eq(boats.id, Number(boat_id))).returning();

          await db.insert(auditHistory).values({
            entityType: "boat",
            entityId: String(boat_id),
            action: "edit_boat",
            performedBy: actor,
            previousState: existingBoat,
            newState: updatedBoat,
            notes: notes || "Updated boat details"
          });

          return Response.json({ success: true, boat: updatedBoat });
        }

        // Create Boat Path
        let visitorId = null;
        let leadObj: any = null;
        if (lead_id) {
          const [l] = await db.select().from(leads).where(eq(leads.id, Number(lead_id))).limit(1);
          if (l) { visitorId = l.visitorId; leadObj = l; }
        } else if (call_id) {
          const [c] = await db.select().from(calls).where(eq(calls.id, Number(call_id))).limit(1);
          if (c) visitorId = c.visitorId;
        }

        const [newBoat] = await db.insert(boats).values({
          leadId: lead_id ? Number(lead_id) : null,
          callId: call_id ? Number(call_id) : null,
          visitorId: visitorId || null,
          title: title || "Donated Boat",
          hin: hin || "",
          year: year ? parseInt(year, 10) : null,
          make: make || "",
          model: model || "",
          lengthFt: length_ft ? String(length_ft) : null,
          vesselType: vessel_type || "Powerboat",
          condition: condition || "Good",
          locationCity: location_city || "",
          locationState: location_state || "",
          status: "Donation Accepted",
          notes: notes || ""
        }).returning();

        if (lead_id) {
          await db.update(leads).set({ boatId: newBoat.id, stage: "Donation Accepted", updatedAt: sql`now()` }).where(eq(leads.id, Number(lead_id)));
          
          // Auto-queue primary Google Ads offline conversion on boat creation/acceptance
          const convId = `conv_accept_lead_${lead_id}`;
          await db.insert(conversionExports).values({
            conversionId: convId,
            conversionType: "Donation_Accepted",
            leadId: Number(lead_id),
            boatId: newBoat.id,
            gclid: leadObj?.gclid || "",
            gbraid: leadObj?.gbraid || "",
            wbraid: leadObj?.wbraid || "",
            conversionTime: new Date(),
            conversionValue: "1.0",
            currency: "USD",
            hashedEmail: leadObj?.email ? sha256(leadObj.email) : "",
            hashedPhone: leadObj?.phone ? sha256(leadObj.phone) : "",
            exportStatus: "Pending"
          }).onConflictDoNothing();
        }

        if (call_id) {
          await db.update(calls).set({ boatId: newBoat.id, stage: "Donation Accepted", updatedAt: sql`now()` }).where(eq(calls.id, Number(call_id)));
        }

        await db.insert(auditHistory).values({
          entityType: "boat",
          entityId: String(newBoat.id),
          action: "create_boat",
          performedBy: actor,
          newState: newBoat,
          notes: `Connected to lead ${lead_id || 'none'}, call ${call_id || 'none'}`
        });

        return Response.json({ success: true, boat: newBoat });
      }

      // 5. Create or Relist eBay Listing
      if (action === "add_ebay_listing") {
        const { boat_id, ebay_item_id, listing_url, auction_start_date, starting_price, is_relist } = body;
        if (!boat_id || !ebay_item_id) return new Response("Missing boat_id or ebay_item_id", { status: 400 });

        // Check existing listings for this boat to calculate relist count
        const priorListings = await db.select().from(ebayListings).where(eq(ebayListings.boatId, Number(boat_id)));
        const relistCount = priorListings.length;

        // If this is a relist, mark previous active listings as 'Relisted'
        if (is_relist || priorListings.length > 0) {
          await db.update(ebayListings)
            .set({ listingStatus: "Relisted", isFinalSale: false, updatedAt: sql`now()` })
            .where(and(eq(ebayListings.boatId, Number(boat_id)), eq(ebayListings.listingStatus, "Active")));
        }

        const [newListing] = await db.insert(ebayListings).values({
          boatId: Number(boat_id),
          ebayItemId: String(ebay_item_id).trim(),
          listingUrl: listing_url || `https://www.ebay.com/itm/${ebay_item_id}`,
          auctionStartDate: auction_start_date ? new Date(auction_start_date) : new Date(),
          listingStatus: "Active",
          isFinalSale: false,
          startingPrice: starting_price ? String(starting_price) : null,
          relistCount
        }).returning();

        // Update boat status to Listed
        await db.update(boats).set({ status: "Listed", updatedAt: sql`now()` }).where(eq(boats.id, Number(boat_id)));

        await db.insert(auditHistory).values({
          entityType: "listing",
          entityId: String(newListing.id),
          action: is_relist ? "relist_ebay" : "add_ebay_listing",
          performedBy: actor,
          newState: newListing,
          notes: `eBay Item ID ${ebay_item_id} (relist count: ${relistCount})`
        });

        return Response.json({ success: true, listing: newListing });
      }

      // 6. Record Final eBay Sale (Deduplicated — exactly ONE final sale per boat)
      if (action === "record_sale") {
        const { boat_id, listing_id, sale_amount, sale_date, buyer_payment_status, form_1098c_issued, notes } = body;
        if (!boat_id || !sale_amount) return new Response("Missing boat_id or sale_amount", { status: 400 });

        // Enforce: Prevent relists/duplicate listings from creating multiple sales
        const [existingSale] = await db.select().from(sales).where(eq(sales.boatId, Number(boat_id))).limit(1);
        if (existingSale) {
          return new Response(JSON.stringify({ error: "Sale already recorded for this boat", sale: existingSale }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const [boatRecord] = await db.select().from(boats).where(eq(boats.id, Number(boat_id))).limit(1);
        let leadRecord: any = null;
        if (boatRecord?.leadId) {
          const [l] = await db.select().from(leads).where(eq(leads.id, boatRecord.leadId)).limit(1);
          leadRecord = l;
        }

        // Mark winning listing as final sale
        if (listing_id) {
          await db.update(ebayListings)
            .set({ isFinalSale: true, listingStatus: "Sold", updatedAt: sql`now()` })
            .where(eq(ebayListings.id, Number(listing_id)));
        }

        const [newSale] = await db.insert(sales).values({
          boatId: Number(boat_id),
          listingId: listing_id ? Number(listing_id) : null,
          visitorId: boatRecord?.visitorId || null,
          leadId: boatRecord?.leadId || null,
          saleAmount: String(sale_amount),
          saleDate: sale_date ? new Date(sale_date) : new Date(),
          buyerPaymentStatus: buyer_payment_status || "Paid",
          form1098cIssued: Boolean(form_1098c_issued),
          notes: notes || ""
        }).returning();

        // Update boat status to Sold
        await db.update(boats).set({ status: "Sold", updatedAt: sql`now()` }).where(eq(boats.id, Number(boat_id)));
        if (boatRecord?.leadId) {
          await db.update(leads).set({ stage: "Sold", updatedAt: sql`now()` }).where(eq(leads.id, boatRecord.leadId));
        }

        // Auto-queue Value-based Boat_Sold conversion for Google Ads
        const convId = `conv_sale_boat_${boat_id}`;
        await db.insert(conversionExports).values({
          conversionId: convId,
          conversionType: "Boat_Sold",
          boatId: Number(boat_id),
          leadId: boatRecord?.leadId || null,
          saleId: newSale.id,
          gclid: leadRecord?.gclid || "",
          gbraid: leadRecord?.gbraid || "",
          wbraid: leadRecord?.wbraid || "",
          conversionTime: newSale.saleDate,
          conversionValue: String(sale_amount),
          currency: "USD",
          hashedEmail: leadRecord?.email ? sha256(leadRecord.email) : "",
          hashedPhone: leadRecord?.phone ? sha256(leadRecord.phone) : "",
          exportStatus: "Pending"
        }).onConflictDoNothing();

        await db.insert(auditHistory).values({
          entityType: "sale",
          entityId: String(newSale.id),
          action: "record_sale",
          performedBy: actor,
          newState: newSale,
          notes: `Recorded final sale of $${sale_amount} for boat ${boat_id}`
        });

        return Response.json({ success: true, sale: newSale });
      }
    }

    return new Response("Invalid action or method", { status: 400 });
  } catch (err: any) {
    console.error("[dashboard-api] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config: Config = {
  path: "/api/dashboard",
};
