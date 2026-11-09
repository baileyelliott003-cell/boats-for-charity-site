import { boatIntakeDetails } from "./boat-intake.js";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, leads, sessions, visitors } from "../db/schema.js";
import { getRuntimeEnv } from "./runtime-env.js";
import { sha256Value } from "./security.js";
import { WebsiteAcknowledgmentOutbox, deliverWebsiteAcknowledgment, type AckMessage } from "./acknowledgment-outbox.js";

export const websiteAcknowledgments = new WebsiteAcknowledgmentOutbox(db);
export const acknowledgmentConfiguration = () => ({
  key: getRuntimeEnv("RESEND_API_KEY"),
  from: getRuntimeEnv("FROM_EMAIL") || "Boats for Charity <no-reply@boatsforcharity.org>",
  paused: getRuntimeEnv("WEBSITE_ACK_PAUSED") === "true",
});

const TRACKING_ID_PATTERN = /^(?:bfc_)?(?:vid|sid)_[a-z0-9_-]{6,92}$/i;

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, maxLength) : "";
}

function trackingId(value: unknown): string {
  const normalized = text(value, 100);
  return TRACKING_ID_PATTERN.test(normalized) ? normalized : "";
}

function deterministicSubmissionId(submission: Record<string, any>, data: Record<string, any>): string {
  const stablePayload = JSON.stringify({
    form_name: submission.form_name || data["form-name"] || "",
    created_at: submission.created_at || submission.createdAt || "",
    data,
  });
  return `netlify_fallback_${sha256Value(stablePayload)}`;
}

export interface NormalizedSubmission {
  netlifySubmissionId: string;
  formName: string;
  visitorId: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  boatDetails: string;
  pageContext: string;
  firstTouchSource: string;
  firstTouchMedium: string;
  firstTouchCampaign: string;
  firstTouchLandingPage: string;
  lastTouchSource: string;
  lastTouchMedium: string;
  lastTouchCampaign: string;
  lastTouchTerm: string;
  lastTouchContent: string;
  lastLandingPage: string;
  lastReferrer: string;
  gclid: string;
  gbraid: string;
  wbraid: string;
  msclkid: string;
  gaClientId: string;
  rawFormData: Record<string, any>;
}

export function normalizeNetlifySubmission(rawBody: string): NormalizedSubmission {
  let payload: any = {};
  try {
    payload = typeof rawBody === "string" ? JSON.parse(rawBody || "{}") : rawBody;
  } catch {
    payload = {};
  }
  
  // Netlify Forms event payload format: { payload: { id: ..., form_name: ..., data: { ... } } } OR direct { id: ..., data: { ... } }
  const submission = payload?.payload || payload;
  if (!submission || typeof submission !== "object") throw new Error("Invalid Netlify submission");
  const data = submission.data || submission.human_fields || submission.ordered_human_fields?.reduce((acc: any, f: any) => ({ ...acc, [f.name]: f.value }), {}) || {};
  if (!data || typeof data !== "object") throw new Error("Invalid Netlify form data");
  const formName = text(submission.form_name || data["form-name"] || submission.name || "donationForm", 100);
  const netlifySubmissionId = text(submission.id || data.id || submission.number, 200) || deterministicSubmissionId(submission, data);
  const visitorId = trackingId(data.visitor_id);
  const sessionId = visitorId ? trackingId(data.session_id) : "";
  return {
    netlifySubmissionId,
    formName,
    visitorId,
    sessionId,
    firstName: text(data.first_name || data.name || data["First Name"], 150),
    lastName: text(data.last_name || data["Last Name"], 150),
    email: text(data.email || data["Email"], 320).toLowerCase(),
    phone: text(data.phone || data["Phone"], 50),
    smsConsent: data.sms_consent === true || data.sms_consent === "true" || data.sms_consent === "yes" || data["SMS Consent"] === "yes",
    boatDetails: boatIntakeDetails(data),
    pageContext: text(data.page_context || data["Page Context"], 500),
    firstTouchSource: text(data.first_touch_source, 150),
    firstTouchMedium: text(data.first_touch_medium, 150),
    firstTouchCampaign: text(data.first_touch_campaign, 150),
    firstTouchLandingPage: text(data.first_touch_landing_page, 500),
    lastTouchSource: text(data.last_touch_source || data.utm_source || "direct", 150),
    lastTouchMedium: text(data.last_touch_medium || data.utm_medium, 150),
    lastTouchCampaign: text(data.last_touch_campaign || data.utm_campaign, 150),
    lastTouchTerm: text(data.last_touch_term || data.utm_term, 150),
    lastTouchContent: text(data.last_touch_content || data.utm_content, 150),
    lastLandingPage: text(data.last_landing_page || "/", 500),
    lastReferrer: text(data.last_referrer, 500),
    gclid: text(data.gclid, 200),
    gbraid: text(data.gbraid, 150),
    wbraid: text(data.wbraid, 150),
    msclkid: text(data.msclkid, 150),
    gaClientId: text(data.ga_client_id, 100),
    rawFormData: data,
  };
}

export interface NetlifySubmissionRepository {
  createLead(submission: NormalizedSubmission, options?: { acknowledgment?: AckMessage }): Promise<{ created: boolean; leadId: number; acknowledgmentId?: string }>;
  recordVerifiedLead(submission: NormalizedSubmission, leadId: number): Promise<void>;
}

export const postgresNetlifySubmissionRepository: NetlifySubmissionRepository = {
  async createLead(submission, options) {
    return db.transaction(async (transaction) => {
      if (submission.visitorId) {
        await transaction.insert(visitors).values({
          id: submission.visitorId,
          firstTouchSource: submission.firstTouchSource,
          firstTouchMedium: submission.firstTouchMedium,
          firstTouchCampaign: submission.firstTouchCampaign,
          firstLandingPage: submission.firstTouchLandingPage,
          gaClientId: submission.gaClientId,
        }).onConflictDoUpdate({
          target: visitors.id,
          set: { lastSeenAt: sql`now()`, updatedAt: sql`now()` },
        });
      }
      if (submission.visitorId && submission.sessionId) {
        await transaction.insert(sessions).values({
          id: submission.sessionId,
          visitorId: submission.visitorId,
          landingPage: submission.lastLandingPage,
          referrer: submission.lastReferrer,
          utmSource: submission.lastTouchSource,
          utmMedium: submission.lastTouchMedium,
          utmCampaign: submission.lastTouchCampaign,
          utmTerm: submission.lastTouchTerm,
          utmContent: submission.lastTouchContent,
          gclid: submission.gclid,
          gbraid: submission.gbraid,
          wbraid: submission.wbraid,
          msclkid: submission.msclkid,
        }).onConflictDoUpdate({ target: sessions.id, set: { lastActivityAt: sql`now()` } });
      }
      const [created] = await transaction.insert(leads).values({
        ...submission,
        visitorId: submission.visitorId || null,
        sessionId: submission.sessionId || null,
        stage: "New",
      }).onConflictDoNothing({ target: leads.netlifySubmissionId }).returning({ id: leads.id });
      if (created) {
        const acknowledgmentId = options?.acknowledgment ? await websiteAcknowledgments.prepare(transaction, submission, created.id, true, options.acknowledgment) : undefined;
        return { created: true, leadId: created.id, acknowledgmentId };
      }
      const [existing] = await transaction.select({ id: leads.id }).from(leads)
        .where(sql`${leads.netlifySubmissionId} = ${submission.netlifySubmissionId}`).limit(1);
      if (!existing) throw new Error("Unable to resolve existing lead");
      const acknowledgmentId = options?.acknowledgment ? await websiteAcknowledgments.prepare(transaction, submission, existing.id, false, options.acknowledgment) : undefined;
      return { created: false, leadId: existing.id, acknowledgmentId };
    });
  },
  async recordVerifiedLead(submission, leadId) {
    if (!submission.visitorId) return;
    await db.insert(events).values({
      visitorId: submission.visitorId,
      sessionId: submission.sessionId || null,
      eventName: "verified_lead",
      pagePath: submission.lastLandingPage || "/",
      source: submission.lastTouchSource || "direct",
      metadata: { lead_id: leadId, form_name: submission.formName },
    });
  },
};

export interface AcknowledgmentMessage {
  to: string;
  subject: string;
  html: string;
}

function acknowledgmentFor(submission: NormalizedSubmission): AcknowledgmentMessage | null {
  if (!submission.email || !["donationForm", "boatValuation"].includes(submission.formName)) return null;
  const isValuation = submission.formName === "boatValuation";
  return {
    to: submission.email,
    subject: isValuation
      ? "We received your boat valuation request — Boats for Charity"
      : "We received your boat donation information — Boats for Charity",
    html: isValuation
      ? `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827"><h2 style="margin:0 0 8px;color:#0b243b">Your boat valuation is being prepared</h2><p>Thanks! We received your boat information. Our team will review the details you provided along with available market information to prepare an estimated market range for your boat.</p><p>Please allow 1–2 business days to receive your valuation report. If you need help sooner, call <a href="tel:+18555573703">(855) 557-3703</a>.</p><p style="margin:16px 0 0">&mdash; Boats for Charity<br><em>Turning Boats into Blessings</em></p></div>`
      : `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827"><h2 style="margin:0 0 8px;color:#0b243b">Thank you for your submission</h2><p>We received your boat donation information and will reach out shortly. If you need help now, call <a href="tel:+18555573703">(855) 557-3703</a>.</p><p style="margin:16px 0 0">&mdash; Boats for Charity<br><em>Turning Boats into Blessings</em></p></div>`,
  };
}

export interface NetlifySubmissionDependencies {
  repository: NetlifySubmissionRepository;
  deliverAcknowledgment: (id: string) => Promise<{ state: string }>;
  configuration: typeof acknowledgmentConfiguration;
}

export function createNetlifySubmissionHandler(overrides: Partial<NetlifySubmissionDependencies> = {}) {
  const dependencies: NetlifySubmissionDependencies = {
    repository: postgresNetlifySubmissionRepository,
    deliverAcknowledgment: (id) => deliverWebsiteAcknowledgment(websiteAcknowledgments, id, { configuration: acknowledgmentConfiguration }),
    configuration: acknowledgmentConfiguration,
    ...overrides,
  };
  return async (event: { body?: string | null } | any) => {
    let submission: NormalizedSubmission;
    try {
      const raw = typeof event?.body === "string" ? event.body : JSON.stringify(event?.body || event || {});
      submission = normalizeNetlifySubmission(raw);
    } catch (err) {
      console.error("[submission-created] normalizeNetlifySubmission parsing error:", err);
      return { statusCode: 400, body: "Invalid submission" };
    }
    try {
      const acknowledgment = acknowledgmentFor(submission);
      const result = await dependencies.repository.createLead(submission, acknowledgment ? { acknowledgment: { from: dependencies.configuration().from, ...acknowledgment } } : undefined);
      const work = await Promise.allSettled([
        result.created ? dependencies.repository.recordVerifiedLead(submission, result.leadId) : Promise.resolve(),
        result.acknowledgmentId ? dependencies.deliverAcknowledgment(result.acknowledgmentId) : Promise.resolve({ state: 'not_applicable' }),
      ]);
      // Saving the donor's lead succeeds independently of a provider outage.
      // A failed delivery step is already durable and is exposed separately.
      const delivery = work[1];
      return { statusCode: 200, body: JSON.stringify({ [result.created ? 'created' : 'duplicate']: true, leadId: result.leadId, acknowledgment: delivery.status === 'fulfilled' ? delivery.value?.state : 'saved_requires_review' }) };
    } catch (error) {
      console.error("[submission-created] lead transaction failed; request can be retried");
      return { statusCode: 500, body: "Internal Server Error" };
    }
  };
}
