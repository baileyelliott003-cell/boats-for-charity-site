import type { FormSubmittedEvent } from '@netlify/functions';
import { sendPhotoUploadEmail } from '../../lib/photo-upload-email.js';
import { resolvePhotoUploadFiles } from '../../lib/photo-upload-files.js';

export default {
  async formSubmitted(event: FormSubmittedEvent) {
    if (event.data.page_context !== 'boat-photo-upload') return;
    let data: Record<string, unknown> = event.data;
    try {
      data = await resolvePhotoUploadFiles(event.data);
    } catch (error) {
      // Preserve the donor notification even if file lookup needs configuration.
      // Emit an actionable code without logging credentials, URLs or donor data.
      const detail = error instanceof Error && error.message.startsWith('PHOTO_LOOKUP_') ? error.message : 'PHOTO_LOOKUP_FAILED';
      console.error('[photo-upload-notification]', detail);
    }
    await sendPhotoUploadEmail(data);
  },
};
