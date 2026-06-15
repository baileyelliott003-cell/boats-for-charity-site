// Standalone donate-button click tracking.
// Included on every page that has a "Donate" call-to-action but does NOT load
// the full homepage bundle (script.v122.js already tracks the homepage CTAs).
// Sends a lightweight, fire-and-forget beacon to a Netlify Function so the team
// can count how many times each donate button is clicked. Tracking is written
// so it can never block navigation or break the page.
(function () {
  function trackDonateClick(source) {
    try {
      var payload = JSON.stringify({ source: source, path: location.pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/track-donate',
          new Blob([payload], { type: 'application/json' })
        );
      } else {
        fetch('/api/track-donate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {
      /* tracking must never break the page */
    }
  }

  // A donate CTA is either an anchor to the donation form (#donate / /#donate)
  // or a link to the donate-a-boat landing page.
  function isDonateLink(href) {
    if (!href) return false;
    return /#donate$/.test(href) || /\/donate-a-boat(\.html)?$/.test(href);
  }

  function init() {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      (function (el) {
        if (!isDonateLink(el.getAttribute('href'))) return;
        el.addEventListener('click', function () {
          var label =
            el.getAttribute('data-track') ||
            el.getAttribute('aria-label') ||
            (el.textContent || '').trim().slice(0, 60) ||
            'donate';
          trackDonateClick(label);
        });
      })(links[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
