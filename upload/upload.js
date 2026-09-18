(() => {
  'use strict';
  const form = document.getElementById('photo-form');
  const picker = document.getElementById('photos');
  const send = document.getElementById('send');
  const fields = document.getElementById('fields');
  const message = document.getElementById('message');
  const status = document.getElementById('selection-status');
  const list = document.getElementById('previews');
  const progressWrap = document.getElementById('progress-wrap');
  const progress = document.getElementById('progress');
  const maxBytes = 6_000_000; // Leave room below Netlify's 8 MB multipart request limit.
  let photos = [], busy = false, submitted = false;
  const newId = () => crypto.randomUUID();
  document.getElementById('upload-id').value = newId();
  function say(text, error = false) {
    message.textContent = text;
    message.className = error ? 'error' : '';
  }
  function render() {
    list.replaceChildren();
    photos.forEach((photo, index) => {
      const li = document.createElement('li');
      if (photo.preview) {
        const img = new Image(); img.src = photo.preview; img.alt = `Selected photo ${index + 1}`; li.append(img);
      } else {
        const placeholder = document.createElement('div'); placeholder.className = 'no-preview'; placeholder.textContent = 'iPhone photo'; li.append(placeholder);
      }
      const name = document.createElement('p'); name.textContent = photo.original; li.append(name);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${photo.original}`); remove.disabled = busy;
      remove.onclick = () => { if (photo.preview) URL.revokeObjectURL(photo.preview); photos.splice(index, 1); render(); }; li.append(remove); list.append(li);
    });
    status.textContent = photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} ready to send.` : 'No photos added yet.';
    send.disabled = busy || !photos.length;
    picker.disabled = busy;
  }
  async function prepare(file) {
    if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) || file.size === 0) throw new Error('Choose JPG, PNG, WebP, or iPhone HEIC photos.');
    if (file.size > 30_000_000) throw new Error('This photo is too large. Please choose a smaller copy.');
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      let scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      let blob;
      for (let attempt = 0; attempt < 6; attempt++) {
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
        if (!blob) throw new Error('Unable to prepare this photo.');
        if (blob.size <= 280_000) break;
        scale *= .78;
      }
      if (blob.size > 280_000) throw new Error('Please choose a smaller copy of this photo.');
      return {blob, extension:'jpg', preview:URL.createObjectURL(blob), original:file.name};
    } catch (error) {
      // Preserve HEIC originals when this browser cannot decode them; do not silently discard them.
      if (/\.(heic|heif)$/i.test(file.name) && file.size <= maxBytes) return {blob:file, extension:file.name.split('.').pop().toLowerCase(), preview:null, original:file.name};
      throw new Error(error instanceof Error ? error.message : 'This browser could not open the photo. Try a JPG copy or a screenshot.');
    } finally { URL.revokeObjectURL(url); }
  }
  picker.addEventListener('change', async () => {
    const incoming = Array.from(picker.files); picker.value = '';
    busy = true; render(); say('Preparing your photos…');
    const errors = [];
    try {
      for (const file of incoming) {
        if (photos.length >= 20) { errors.push('You can send 20 photos at a time. Extra photos were not added.'); break; }
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (photos.some(p => p.key === key)) continue;
        try {
          const photo = await prepare(file);
          if (photos.reduce((n,p) => n+p.blob.size, 0) + photo.blob.size > maxBytes) {
            if (photo.preview) URL.revokeObjectURL(photo.preview);
            throw new Error('These photos are too large to send together. Send the selected photos first, then add the rest in another submission.');
          }
          photos.push({...photo, key});
        } catch (error) { errors.push(`${file.name}: ${error.message}`); }
      }
    } finally { busy = false; render(); say(errors.join(' '), errors.length > 0); }
  });
  document.getElementById('phone').addEventListener('input', event => event.target.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || submitted) return;
    const phone = document.getElementById('phone');
    const digits = phone.value.replace(/\D/g, '');
    phone.setCustomValidity(digits.length >= 10 && digits.length <= 15 ? '' : 'Please enter a complete phone number, including area code.');
    if (!form.reportValidity()) return;
    if (!photos.length) { say('Please choose at least one photo.', true); return; }
    const data = new FormData(form);
    for (let i = 1; i <= 20; i++) data.delete(`photo_${String(i).padStart(2, '0')}`);
    const id = document.getElementById('upload-id').value;
    const manifest = [];
    photos.forEach((photo, index) => {
      const field = `photo_${String(index + 1).padStart(2, '0')}`;
      const filename = `${id}-${String(index+1).padStart(2,'0')}.${photo.extension}`;
      data.append(field, photo.blob, filename);
      manifest.push({field, filename, original:photo.original, bytes:photo.blob.size});
    });
    data.set('photo_count', String(photos.length)); data.set('photo_manifest', JSON.stringify(manifest));
    // Capture FormData before disabling controls, so donor fields remain in the request.
    busy = true; fields.disabled = true; render(); progress.value = 0; progressWrap.hidden = false; say('');
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open('POST', '/upload/'); xhr.timeout = 30000;
        xhr.upload.onprogress = event => { if (event.lengthComputable) progress.value = Math.round(event.loaded/event.total*100); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload was not confirmed. Your photos are still selected; please try again or call us.'));
        xhr.onerror = () => reject(new Error('We could not confirm the upload. Check your connection and try again. Your photos are still selected.'));
        xhr.ontimeout = () => reject(new Error('The upload took too long to confirm. Your photos are still selected. Try fewer photos or a stronger connection, or call us.'));
        xhr.send(data);
      });
      submitted = true; form.hidden = true;
      document.getElementById('receipt').textContent = `Reference: ${id}`;
      const success = document.getElementById('success'); success.hidden = false; success.focus();
    } catch(error) { say(error.message, true); message.focus(); }
    finally { busy = false; fields.disabled = false; progressWrap.hidden = true; render(); }
  });
  document.getElementById('more').onclick = () => {
    photos.forEach(photo => { if(photo.preview) URL.revokeObjectURL(photo.preview); });
    photos = []; submitted = false; document.getElementById('upload-id').value = newId();
    form.elements.notes.value = ''; say(''); render();
    document.getElementById('success').hidden = true; form.hidden = false; picker.focus();
  };
  window.addEventListener('beforeunload', event => { if ((photos.length && !submitted) || busy) { event.preventDefault(); event.returnValue = ''; } });
})();
