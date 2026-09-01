/**
 * Boats for Charity — First-Party Attribution & Privacy-Safe Interaction Tracker
 * 
 * Features:
 * 1. Persistent Anonymous Visitor ID (bfc_vid in localStorage + Cookie)
 * 2. 30-Minute Inactivity Session ID (bfc_sid in sessionStorage / Cookie)
 * 3. First-Touch & Last-Non-Direct Marketing Attribution
 * 4. Captures UTMs, GCLID, GBRAID, WBRAID, MSCLKID, Referrer, Landing Page
 * 5. Safely extracts GA4 client_id if present
 * 6. Automatically populates all Netlify intake forms with hidden fields
 * 7. Tracks: page_view, donation_form_view, form_start, form_submit_attempt, phone_click
 * 8. Zero PII transmission to GA4 or Microsoft Clarity
 * 9. Safe WhatConverts DNI integration hook (falls back to Quo 855-557-3703)
 */

(function () {
  'use strict';

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var VISITOR_COOKIE_NAME = 'bfc_vid';
  var SESSION_COOKIE_NAME = 'bfc_sid';
  var SESSION_TS_NAME = 'bfc_sts';
  var FIRST_TOUCH_KEY = 'bfc_ft';
  var LAST_TOUCH_KEY = 'bfc_lt';

  // Generate safe random UUID
  function generateId(prefix) {
    var d = Date.now().toString(36);
    var r = Math.random().toString(36).substring(2, 10);
    return (prefix || 'bfc') + '_' + d + '_' + r;
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  // 1. Get or Create Visitor ID (Persistent)
  function getVisitorId() {
    var vid = null;
    try {
      vid = localStorage.getItem(VISITOR_COOKIE_NAME);
    } catch (e) {}
    if (!vid) {
      vid = getCookie(VISITOR_COOKIE_NAME);
    }
    if (!vid) {
      vid = generateId('vid');
    }
    try {
      localStorage.setItem(VISITOR_COOKIE_NAME, vid);
    } catch (e) {}
    setCookie(VISITOR_COOKIE_NAME, vid, 730); // 2 years
    return vid;
  }

  // 2. Get or Rotate Session ID (30 min inactivity window)
  function getSessionId() {
    var now = Date.now();
    var sid = null;
    var lastActive = 0;

    try {
      sid = sessionStorage.getItem(SESSION_COOKIE_NAME);
      lastActive = parseInt(localStorage.getItem(SESSION_TS_NAME) || '0', 10);
    } catch (e) {}

    if (!sid) {
      sid = getCookie(SESSION_COOKIE_NAME);
    }

    // Rotate session if inactive > 30 mins
    if (!sid || !lastActive || (now - lastActive > SESSION_TIMEOUT_MS)) {
      sid = generateId('sid');
    }

    try {
      sessionStorage.setItem(SESSION_COOKIE_NAME, sid);
      localStorage.setItem(SESSION_TS_NAME, now.toString());
    } catch (e) {}
    setCookie(SESSION_COOKIE_NAME, sid, 1); // 1 day cookie fallback
    return sid;
  }

  // Parse URL marketing parameters
  function parseParams() {
    var params = new URLSearchParams(window.location.search);
    var ref = document.referrer || '';
    var refDomain = '';
    try {
      if (ref) {
        var refUrl = new URL(ref);
        refDomain = refUrl.hostname.replace(/^www\./, '');
      }
    } catch (e) {}

    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
      gclid: params.get('gclid') || '',
      gbraid: params.get('gbraid') || '',
      wbraid: params.get('wbraid') || '',
      msclkid: params.get('msclkid') || '',
      landing_page: window.location.pathname + window.location.search,
      referrer: ref,
      referring_domain: refDomain,
      timestamp: new Date().toISOString()
    };
  }

  // Extract GA4 Client ID if available in cookies (_ga)
  function getGaClientId() {
    var gaCookie = getCookie('_ga');
    if (gaCookie) {
      var parts = gaCookie.split('.');
      if (parts.length >= 4) {
        return parts[2] + '.' + parts[3];
      }
    }
    return '';
  }

  // 3. Attribution Management (First Touch vs Last Non-Direct)
  var currentTouch = parseParams();
  var isMarketingTraffic = Boolean(
    currentTouch.utm_source || 
    currentTouch.gclid || 
    currentTouch.gbraid || 
    currentTouch.wbraid || 
    currentTouch.msclkid || 
    (currentTouch.referring_domain && currentTouch.referring_domain !== window.location.hostname.replace(/^www\./, ''))
  );

  // First touch
  var firstTouch = null;
  try {
    var ftRaw = localStorage.getItem(FIRST_TOUCH_KEY);
    if (ftRaw) firstTouch = JSON.parse(ftRaw);
  } catch (e) {}
  if (!firstTouch) {
    firstTouch = currentTouch;
    try {
      localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
    } catch (e) {}
  }

  // Last non-direct touch
  var lastTouch = null;
  try {
    var ltRaw = localStorage.getItem(LAST_TOUCH_KEY);
    if (ltRaw) lastTouch = JSON.parse(ltRaw);
  } catch (e) {}
  if (isMarketingTraffic || !lastTouch) {
    lastTouch = currentTouch;
    try {
      localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(lastTouch));
    } catch (e) {}
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();

  // 4. Send Server-Side Event (navigator.sendBeacon with fetch fallback)
  function sendEvent(eventName, metadata) {
    var payload = {
      visitor_id: visitorId,
      session_id: sessionId,
      event_name: eventName,
      page_path: window.location.pathname,
      source: currentTouch.utm_source || (document.referrer ? 'referrer' : 'direct'),
      ga_client_id: getGaClientId(),
      metadata: metadata || {},
      touch: currentTouch
    };

    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track-event', body);
    } else {
      fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  }

  // 5. Populate Form Hidden Fields Dynamically
  function injectHiddenFields(form) {
    if (!form || form.dataset.attributionAttached) return;
    form.dataset.attributionAttached = 'true';

    var gaId = getGaClientId();
    var fields = {
      visitor_id: visitorId,
      session_id: sessionId,
      first_touch_source: (firstTouch && firstTouch.utm_source) || '',
      first_touch_medium: (firstTouch && firstTouch.utm_medium) || '',
      first_touch_campaign: (firstTouch && firstTouch.utm_campaign) || '',
      first_touch_landing_page: (firstTouch && firstTouch.landing_page) || '',
      last_touch_source: (lastTouch && lastTouch.utm_source) || '',
      last_touch_medium: (lastTouch && lastTouch.utm_medium) || '',
      last_touch_campaign: (lastTouch && lastTouch.utm_campaign) || '',
      last_touch_term: (lastTouch && lastTouch.utm_term) || '',
      last_touch_content: (lastTouch && lastTouch.utm_content) || '',
      last_landing_page: (lastTouch && lastTouch.landing_page) || '',
      last_referrer: (lastTouch && lastTouch.referrer) || '',
      gclid: currentTouch.gclid || (lastTouch && lastTouch.gclid) || (firstTouch && firstTouch.gclid) || '',
      gbraid: currentTouch.gbraid || (lastTouch && lastTouch.gbraid) || '',
      wbraid: currentTouch.wbraid || (lastTouch && lastTouch.wbraid) || '',
      msclkid: currentTouch.msclkid || (lastTouch && lastTouch.msclkid) || '',
      ga_client_id: gaId
    };

    Object.keys(fields).forEach(function (name) {
      var input = form.querySelector('input[name="' + name + '"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
      }
      input.value = fields[name] || '';
    });
  }

  // 6. Bind DOM Events
  document.addEventListener('DOMContentLoaded', function () {
    // Record page view event
    sendEvent('page_view', { title: document.title });

    // Populate existing forms
    var forms = document.querySelectorAll('form[name="donationForm"], form#donationForm, form[name="boatValuation"], form#valForm');
    forms.forEach(function (form) {
      injectHiddenFields(form);
      sendEvent('donation_form_view', { form_name: form.getAttribute('name') || form.id });

      // Track form start
      var hasStarted = false;
      form.addEventListener('input', function () {
        if (!hasStarted) {
          hasStarted = true;
          sendEvent('form_start', { form_name: form.getAttribute('name') || form.id });
        }
      });

      // Track form submit attempt
      form.addEventListener('submit', function () {
        // Refresh ga_client_id just before sending
        var gaInput = form.querySelector('input[name="ga_client_id"]');
        if (gaInput) gaInput.value = getGaClientId();
        sendEvent('form_submit_attempt', { form_name: form.getAttribute('name') || form.id });
      });
    });

    // Track Phone link clicks
    var phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    phoneLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        sendEvent('phone_click', {
          href: link.getAttribute('href'),
          text: link.textContent.trim()
        });
      });
    });

    // 7. Dynamic Number Insertion Hook (WhatConverts safe integration)
    // Keeps 855-557-3703 as fallback. If WhatConverts is loaded, swaps dynamically.
    if (window._whatconverts && typeof window._whatconverts.push === 'function') {
      window._whatconverts.push(['set_custom_field', 'visitor_id', visitorId]);
      window._whatconverts.push(['set_custom_field', 'session_id', sessionId]);
    }
  });

  // Expose safe global helper
  window.BFC_TRACKER = {
    getVisitorId: function () { return visitorId; },
    getSessionId: function () { return sessionId; },
    sendEvent: sendEvent,
    injectHiddenFields: injectHiddenFields
  };
})();
