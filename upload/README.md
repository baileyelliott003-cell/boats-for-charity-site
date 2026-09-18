# Boats for Charity photo upload

Standalone page for https://boatsforcharity.org/upload (Netlify may canonicalize to /upload/).
Only files within upload/ are added. No shared CSS, existing pages, routes, navigation, dependencies, or functions are changed.

## What it collects

Required first_name, last_name, phone, boat_details; optional email and notes.
Up to 20 photos in separately named photo_01 through photo_20 fields. upload_id is a UUID included in every filename and the submission record. photo_manifest maps original filenames to stored filenames. photo_count gives the expected count. page_context is boat-photo-upload. This permits matching on phone/name plus boat details; no donor reference number is required.

All photos and contact information are sent in one multipart request to a distinct Netlify form named boatPhotoUpload. The browser keeps selected photos after a failed or unconfirmed request; retry retains upload_id so duplicates can be recognized. This does not automatically deduplicate Netlify submissions or match/create HubSpot records.

JPEG/PNG/WebP and browser-decodable HEIC images are converted to JPEG, resized to at most 2000 pixels on the long edge, and reduced further as needed to fit 280 KB/photo. Browser-unsupported HEIC/HEIF originals can be included without previews, within the 6 MB total photo limit. Conversion removes metadata from converted images; original HEIC files may retain metadata. Only photos are requested; this is not a confidential-document portal. Netlify upload URLs can be accessed by anyone with the URL.

## Required Netlify setup before launch

1. Enable Forms > Enable form detection if it is not already enabled. The form is in static HTML and must be detected on a deployment.
2. Review this branch using the existing site's deploy-preview process. Do NOT deploy this folder by itself over the production site: Netlify deployments replace the site's entire deployed file set.
3. Verify the new form boatPhotoUpload appears in Forms and has all donor metadata and 20 file fields.
4. Set RESEND_API_KEY and FROM_EMAIL in Netlify runtime environment variables. The photo-upload-notification event function emails info.boatsforcharity@gmail.com with donor details and remote photo attachments when Netlify verifies a photo upload. A separate standard Netlify notification is optional and would produce an additional link-only email.
5. Submit a real end-to-end sample on the preview, check the verified/spam lists, count and open every photo, and confirm the inbox receives the name, phone, boat details, and photo links. The Resend notification includes attachments plus the original links. Explicit attachment rejection falls back to a clearly labeled link-only notification. Local browser testing cannot verify this.
6. Check existing plan/usage limits in Netlify. No additional upload vendor is needed, but Netlify usage may be billable under the account's plan.
7. Before merging, review the existing build behavior described below and confirm the preview works. After an authorized production merge, verify /upload and /upload/ and send one production test.

## Existing build behavior to review

netlify.toml runs npm test, whose first step is scripts/batch-inject.mjs. That existing script normalizes analytics across all public HTML files. Running it in an isolated copy changed 241 existing files, independent of this feature. None of those generated changes are included in this branch. The new page may also receive existing analytics from that build. This PR does not change that script or the Netlify build command. Do not assume a production deployment leaves every existing output byte unchanged simply because this PR adds only upload/ files. Compare production output or agree a separate build adjustment before publishing if exact output preservation is required.

The existing submission-created function processes forms into the site's lead database. It may create a new lead row for this upload form, with its own form_name and raw form data. This patch does not change that function or claim automatic donor/boat linking. Review that behavior during the preview test. The existing email acknowledgment function only handles donationForm and boatValuation, so it does not send this form's donor an email acknowledgment.

## Validation

See PR description for completed checks. Test request failures, retry, duplicate filenames, corrupt images, HEIC on an actual iPhone, and large selections. Local tests mock Netlify POST responses; live form registration, storage, spam handling, and email delivery require the Netlify setup above.

## References

- https://docs.netlify.com/manage/forms/setup/
- https://docs.netlify.com/manage/forms/notifications/
- https://docs.netlify.com/manage/forms/usage-and-billing/

## Attachment notification implementation

netlify/functions/photo-upload-notification.ts subscribes to Netlify's signed formSubmitted event independently of submission-created. It filters on page_context=boat-photo-upload, validates the UUID and 1–20 photo count, and invokes lib/photo-upload-email.ts. Existing intake, database and donor acknowledgment code is unchanged. Resend downloads remote attachments via its documented path parameter; our function never downloads donor-supplied URLs. Invalid/missing file URLs are flagged in the email instead of silently claiming every photo was attached.

The recipient is fixed to info.boatsforcharity@gmail.com. Sender and API key come only from runtime settings. No API keys appear in the page or repository. Transient network/429/5xx failures have bounded retries with a stable content-derived Resend idempotency key; Resend retains keys for 24 hours. Only explicit attachment rejection triggers link fallback. Provider/configuration failures are thrown for visibility in function logs. No claim of a durable delivery queue or guaranteed platform retries is made. Historical submissions are not automatically resent. A real new submission must verify deployed event behavior and inbox delivery.

Run focused tests with node --test tests/photo-upload-email.test.mjs. Tests use a mocked email provider and cover routing, donor/photo association, configuration, unsafe URL formats, missing photos, idempotency, transient retries, fallback, and hard failures.
