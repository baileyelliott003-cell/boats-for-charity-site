import { sql } from 'drizzle-orm';
import { ACK_CONTRACT, acknowledgmentSourceHash, acknowledgmentMessageHash } from './acknowledgment-outbox.js';
import { sha256Value, timingSafeEqualText } from './security.js';

export const WEBSITE_CONTACT_HISTORY_CONTRACT = 'exact-submission-website-contact-history-v1';
export const WEBSITE_HISTORY_READ_ORIGIN='https://boatsforcharity.org';
const historyActions=new Set(['website-history-connection','submission-contact-history','submission-contact-history-by-controls']);
export function websiteHistoryTokenAuthorization(request:Request,expectedHash:string|undefined) {
  const url=new URL(request.url),action=url.searchParams.get('action'),authorization=request.headers.get('authorization');
  const attempted=!!authorization&&(historyActions.has(action||'')||/^Bearer bfc_hist_/.test(authorization));
  if(!attempted)return null;
  const match=/^Bearer (bfc_hist_[A-Za-z0-9_-]{43})$/.exec(authorization||'');
  const method=action==='submission-contact-history-by-controls'?'POST':'GET';
  const authorized=url.origin===WEBSITE_HISTORY_READ_ORIGIN&&historyActions.has(action||'')&&request.method===method&&!!match&&typeof expectedHash==='string'&&/^[a-f0-9]{64}$/.test(expectedHash)&&timingSafeEqualText(sha256Value(match[1]),expectedHash);
  return{authorized,status:authorized?200:401,error:authorized?'':'Authentication required',scope:'website_contact_history_read_only'};
}
const sourceFields = [
  ['campaign','campaign_id'],['time zone','time_zone'],['page context','page_context'],
  ['first name','first_name'],['last name','last_name'],['email','email'],['phone','phone'],
  ['boat year','boat_year'],['boat make model','boat_make_model'],['boat length','boat_length'],
  ['boat location','boat_location'],['boat condition','boat_condition'],['boat ownership','boat_ownership'],
  ['boat timeline','boat_timeline'],['boat trailer','boat_trailer'],['sms consent','sms_consent'],['boat details','boat_details'],
];
const exactValue=(v:unknown)=>typeof v==='string'?v.replaceAll('\r\n','\n').trim():v===undefined?'':null;
// Matching contact details alone never links a notification to a submission.
// Every supported original notification control, including empty fields, must
// match one and only one complete saved submission. Duplicate events stay held.
export async function resolveWebsiteSubmission(database:{execute:(query:any)=>Promise<any>}, controls:Record<string,string>) {
  const keys=Object.keys(controls||{}).sort(),expected=sourceFields.map(([label])=>label).sort();
  if(JSON.stringify(keys)!==JSON.stringify(expected)||Object.values(controls).some(v=>typeof v!=='string'||v.length>16000)||! /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(controls.email)) throw Error('WEBSITE_HISTORY_COMPLETE_CONTROLS');
  const rowsResult=await database.execute(sql`SELECT netlify_submission_id,form_name,raw_form_data FROM leads WHERE lower(email)=${controls.email.toLowerCase()} ORDER BY id LIMIT 101`);
  const rows=Array.isArray(rowsResult)?rowsResult:rowsResult?.rows;
  if(!Array.isArray(rows))throw Error('WEBSITE_HISTORY_DATABASE_RESPONSE');
  const base={contract:'complete-notification-submission-binding-v1',identityVerified:false,communicationPermissionGranted:false,localCaseBindingVerified:false};
  if(rows.length>100)return{...base,state:'requires_review',reason:'candidate_history_overflow'};
  const matches=rows.filter((r:any)=>r.form_name==='donationForm'&&r.raw_form_data&&sourceFields.every(([label,key])=>exactValue(r.raw_form_data[key])===exactValue(controls[label])));
  if(matches.length!==1)return{...base,state:'requires_review',reason:matches.length?'ambiguous_full_source_match':'no_full_source_match',matchingSubmissions:matches.length};
  return{...base,state:'unique_full_source_match',submissionId:matches[0].netlify_submission_id,matchedControlCount:sourceFields.length,scope:'One complete currently stored submission matches all supported original notification controls. No legal identity, other boat, ongoing contact permission or historical-event uniqueness is inferred. Reconcile again before dispatch.'};
}

export async function readWebsiteContactHistoryForControls(database:{execute:(query:any)=>Promise<any>}, controls:Record<string,string>,now=Date.now()) {
  const binding=await resolveWebsiteSubmission(database,controls);
  if(binding.state!=='unique_full_source_match')return{state:'requires_review',binding,historyComplete:false};
  const history=await readWebsiteContactHistory(database,binding.submissionId!,now);
  if(!('source' in history)||!sourceFields.every(([label,key])=>exactValue(history.source.rawFormData[key])===exactValue(controls[label])))return{state:'requires_review',reason:'source_changed_during_read',historyComplete:false};
  const current=await resolveWebsiteSubmission(database,controls);
  if(current.state!=='unique_full_source_match'||current.submissionId!==binding.submissionId)return{state:'requires_review',reason:'submission_binding_changed_during_read',historyComplete:false};
  return{state:'source_bound_website_history',binding:current,history,historyComplete:history.historyComplete,localCaseBindingVerified:false};
}
// Invoked only after existing staff authorization. This helper runs one SELECT;
// it never creates schemas, claims an outbox item, or calls an email provider.
export async function readWebsiteContactHistory(database: {execute:(query:any)=>Promise<any>}, submissionId: string, now = Date.now()) {
  if (typeof submissionId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(submissionId) || !Number.isFinite(now)) throw Error('WEBSITE_HISTORY_SOURCE_ID');
  const result = await database.execute(sql`SELECT l.netlify_submission_id,l.form_name,l.email,l.phone,l.raw_form_data,
    o.id AS outbox_id,o.contract AS outbox_contract,o.source_hash,o.message_hash,o.message,o.state,o.blocked_reason,o.last_error_code,o.attempt_count,o.provider_id,o.request_started_at,o.accepted_at,o.created_at,o.updated_at,
    COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM
      (SELECT id,event,error_code,observed_at,observation FROM website_ack_events WHERE outbox_id=o.id ORDER BY id LIMIT 501) e),'[]'::jsonb) AS events
    FROM leads l LEFT JOIN website_ack_outbox o ON o.lead_id=l.id AND o.submission_id=l.netlify_submission_id
    WHERE l.netlify_submission_id=${submissionId} LIMIT 2`);
  const rows = Array.isArray(result) ? result : result?.rows;
  if (!Array.isArray(rows)) throw Error('WEBSITE_HISTORY_DATABASE_RESPONSE');
  const base = {contract:WEBSITE_CONTACT_HISTORY_CONTRACT,submissionId,checkedAt:new Date(now).toISOString(),providerRequests:0,customerMessagesSent:0,humanReceiptVerified:false,localCaseBindingVerified:false};
  if (!rows.length) return {...base,state:'submission_not_found',historyComplete:false,priorContactAbsent:false};
  if (rows.length !== 1) return {...base,state:'requires_review',reason:'ambiguous_submission',historyComplete:false};
  const row=rows[0], source={netlifySubmissionId:row.netlify_submission_id,formName:row.form_name,email:row.email,phone:row.phone,rawFormData:row.raw_form_data};
  if (Buffer.byteLength(JSON.stringify(source))>160000) return {...base,state:'requires_review',reason:'source_overflow',historyComplete:false};
  if (!row.outbox_id) return {...base,state:'acknowledgment_not_recorded',source,historyComplete:false,priorContactAbsent:false};
  if (!Array.isArray(row.events)||row.events.length>500) return {...base,state:'requires_review',reason:'event_history_overflow',historyComplete:false};
  try {
    if(row.outbox_contract!==ACK_CONTRACT||acknowledgmentSourceHash(source)!==row.source_hash||acknowledgmentMessageHash(row.message)!==row.message_hash) throw Error('source_or_message_changed');
  } catch { return {...base,state:'requires_review',reason:'source_or_message_changed',historyComplete:false}; }
  const acknowledgment={id:row.outbox_id,sourceHash:row.source_hash,messageHash:row.message_hash,message:row.message,state:row.state,blockedReason:row.blocked_reason,lastErrorCode:row.last_error_code,attemptCount:row.attempt_count,providerId:row.provider_id,requestStartedAt:row.request_started_at,acceptedAt:row.accepted_at,createdAt:row.created_at,updatedAt:row.updated_at,events:row.events};
  const evidence={...base,state:'recorded_website_history',source,acknowledgment,historyComplete:true,scope:'Complete saved acknowledgment intent and bounded saved event history for this exact submission only. Provider acceptance is not delivery or human receipt. No local case, contact identity, communication permission, other message history, or absence of earlier contact is established.'};
  if (Buffer.byteLength(JSON.stringify(evidence))>1000000) return {...base,state:'requires_review',reason:'history_payload_overflow',historyComplete:false};
  return evidence;
}
