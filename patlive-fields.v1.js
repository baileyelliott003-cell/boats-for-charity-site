// Device time zone, not IP location or the boat's pickup location.
(() => {
  function fill(form) {
    const campaign = form.querySelector('[name="campaign_id"]');
    const zone = form.querySelector('[name="time_zone"]');
    if (campaign) campaign.value = 'YQHYVVOD';
    if (!zone) return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      zone.value = typeof detected === 'string' && detected ? detected : 'Not detected';
    } catch { zone.value = 'Not detected'; }
  }
  function init() {
    document.querySelectorAll('form[name="donationForm"]').forEach(form => {
      fill(form);
      form.addEventListener('submit', () => fill(form), true);
      form.addEventListener('formdata', event => {
        fill(form);
        event.formData.set('campaign_id', 'YQHYVVOD');
        event.formData.set('time_zone', form.querySelector('[name="time_zone"]').value);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
