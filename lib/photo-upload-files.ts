import { getRuntimeEnv } from './runtime-env.js';
import { photoUrl } from './photo-upload-email.js';

type Data = Record<string, unknown>;
const fieldNames = (data: Data) => Array.from({length: Number(data.photo_count)}, (_, i) => `photo_${String(i+1).padStart(2,'0')}`);
const complete = (data: Data) => fieldNames(data).every(key => photoUrl(data[key]));

/** Resolve saved file URLs when Netlify's event contains only filenames. */
export async function resolvePhotoUploadFiles(data: Data, deps: {
  env?: (key: string) => string | undefined;
  fetch?: typeof fetch;
} = {}): Promise<Data> {
  if (data.page_context !== 'boat-photo-upload') return data;
  const count = Number(data.photo_count);
  if (!Number.isInteger(count) || count < 1 || count > 20 ||
      typeof data.upload_id !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.upload_id)) {
    throw new Error('Invalid photo lookup reference or count');
  }
  if (complete(data)) return data;
  const env = deps.env ?? getRuntimeEnv;
  const token = env('NETLIFY_FORMS_BACKFILL_TOKEN') || env('NETLIFY_API_TOKEN') || env('NETLIFY_AUTH_TOKEN') || env('NETLIFY_TOKEN');
  const site = env('NETLIFY_SITE_ID') || env('SITE_ID');
  if (!token) throw new Error('PHOTO_LOOKUP_TOKEN_MISSING: configure NETLIFY_FORMS_BACKFILL_TOKEN for Functions and redeploy');
  if (!site) throw new Error('PHOTO_LOOKUP_SITE_MISSING: configure NETLIFY_SITE_ID');
  const request = deps.fetch ?? fetch;
  async function get(path: string) {
    const response = await request(`https://api.netlify.com/api/v1/${path}`, {
      headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(7000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`PHOTO_LOOKUP_API_ERROR: ${response.status}`);
    return response;
  }
  const forms = await (await get(`sites/${encodeURIComponent(site)}/forms`)).json();
  if (!Array.isArray(forms)) throw new Error('PHOTO_LOOKUP_INVALID_FORMS');
  const form = forms.find(f => f.name === 'boatPhotoUpload');
  if (!form?.id) throw new Error('PHOTO_LOOKUP_FORM_NOT_FOUND');
  // Page only this site's upload form, never a global account submission list.
  for (let page = 1; page <= 5; page++) {
    const response = await get(`forms/${encodeURIComponent(form.id)}/submissions?per_page=100&page=${page}`);
    const submissions = await response.json();
    if (!Array.isArray(submissions)) throw new Error('PHOTO_LOOKUP_INVALID_SUBMISSIONS');
    const matches = submissions.filter(sub => sub.data?.upload_id === data.upload_id &&
      ['first_name','last_name','phone','boat_details','photo_count'].every(key => String(sub.data[key] ?? '') === String(data[key] ?? '')));
    for (const match of matches) {
      const resolved = {...data};
      for (const key of fieldNames(data)) {
        const url = photoUrl(match.data[key]);
        // The uploader names every file with this reference and photo number.
        // This prevents a reused reference from silently selecting another batch.
        const number = key.slice(-2);
        if (url && new URL(url).pathname.split('/').pop()?.startsWith(`${data.upload_id}-${number}.`)) resolved[key] = url;
      }
      if (complete(resolved)) return resolved;
    }
    if (!/rel="?next"?/.test(response.headers.get('link') || '')) break;
  }
  throw new Error('PHOTO_LOOKUP_NOT_READY: saved submission with matching photo URLs was not found');
}
