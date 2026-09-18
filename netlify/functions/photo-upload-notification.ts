import type { FormSubmittedEvent } from '@netlify/functions';
import { sendPhotoUploadEmail } from '../../lib/photo-upload-email.js';

// Netlify verifies event signatures before invoking this event-only handler.
// Separate from the existing submission-created hook, so database errors cannot
// prevent upload notifications and existing donor acknowledgment logic is unchanged.
export default {
  async formSubmitted(event: FormSubmittedEvent) {
    await sendPhotoUploadEmail(event.data);
  },
};
