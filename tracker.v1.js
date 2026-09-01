/**
 * Boats for Charity — First-Party Attribution & Privacy-Safe Interaction Tracker
 * 
 * Features:
 * 1. Persistent Anonymous Visitor ID (bfc_vid in localStorage + Cookie)
 * 2. 30-Minute Inactivity Session ID (bfc_sid in sessionStorage / Cookie)
 * 3. Multi-Touch Model: First-Touch (preserves original landing/source) & Last-Non-Direct Attribution
 * 4. Captures UTMs, GCLID, GBRAID, WBRAID, MSCLKID, Referrer, Landing Page
 * 5. Safely extracts GA4 client_id if present
 * 6. Automatically populates all Netlify intake forms with hidden fields (donationForm, boatValuation, boatValuationIntent, etc.)
 * 7. Tracks: page_view, donation_form_view, form_start, form_submit_attempt, phone_click
 * 8. Zero PII transmission to GA4 or Microsoft Clarity (Anonymous Identify only)
 * 9. Safe WhatConverts DNI integration hook with Quo 855-557-3703 fallback
 */

(function () {
  'use strict';

  if (window.__BFC_TRACKER_INITIALIZED__) return;
  window.__BFC_TRACKER_INITIALIZED__ = true;

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var VISITOR_COOKIE_NAME = 'bfc_vid';
  var SESSION_COOKIE_NAME = 'bfc_sid';
  var SESSION_TS_NAME = 'bfc_sts';
  var FIRST_TOUCH_KEY = 'bfc_ft';
  var LAST_TOUCH_KEY = 'bfc_lt';

  // Generate safe random UUID
  function generateId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return (prefix || 'bfc') + '_' + window.crypto.randomUUID().replace(/-/g, '');
    }
    var bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
      return (prefix || 'bfc') + '_' + Array.prototype.map.call(bytes, function (value) {
        return value.toString(16).padStart(2, '0');
      }).join('');
    }
    return (prefix || 'bfc') + '_' + Date.now().toString(36);
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

  // 1. Get or Create Visitor ID (Persistent across all sessions/pages)
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

    var source = params.get('utm_source') || '';
    var medium = params.get('utm_medium') || '';
    if (!source && (params.get('gclid') || params.get('gbraid') || params.get('wbraid'))) source = 'google';
    if (!source && params.get('msclkid')) source = 'bing';
    if (!medium && source && (params.get('gclid') || params.get('gbraid') || params.get('wbraid') || params.get('msclkid'))) medium = 'cpc';
    if (!source && refDomain && refDomain !== window.location.hostname.replace(/^www\./, '')) {
      source = refDomain;
      medium = 'referral';
    }
    if (!source) source = 'direct';
    if (!medium) medium = '(none)';

    return {
      utm_source: source,
      utm_medium: medium,
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
    currentTouch.utm_source !== 'direct' ||
    currentTouch.gclid || 
    currentTouch.gbraid || 
    currentTouch.wbraid || 
    currentTouch.msclkid || 
    (currentTouch.referring_domain && currentTouch.referring_domain !== window.location.hostname.replace(/^www\./, ''))
  );

  // First touch: PRESERVES THE TRUE INITIAL LANDING PAGE & SOURCE
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

  // 4. Anonymous Clarity Identify & Privacy-Safe GA4 Integration
  try {
    if (typeof window.clarity === 'function') {
      // Anonymous session identification — STRICTLY NO PII
      window.clarity('identify', visitorId, sessionId, currentTouch.landing_page, firstTouch.utm_source || 'direct');
    }
  } catch (e) {}

  try {
    if (typeof window.gtag === 'function') {
      // Set first-party non-PII dimension
      window.gtag('set', 'user_properties', {
        visitor_id: visitorId,
        first_touch_source: firstTouch.utm_source || 'direct'
      });
    }
  } catch (e) {}

  // 5. Send Server-Side Event (navigator.sendBeacon with fetch fallback)
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
      navigator.sendBeacon('/api/track-event', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    }
  }

  // 6. Populate Form Hidden Fields Dynamically across all forms
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

  function normalizeLeadEmail(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function normalizeLeadPhone(value) {
    var raw = String(value || '').trim();
    var digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
    if ((raw.charAt(0) === '+' || raw.slice(0, 2) === '00') && digits.length >= 8 && digits.length <= 15) return '+' + digits;
    return '';
  }

  function sha256(value) {
    if (!value || !window.crypto || !window.crypto.subtle || typeof TextEncoder !== 'function') return Promise.resolve('');
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    }).catch(function () { return ''; });
  }

  function setEnhancedLeadData(form) {
    return Promise.resolve().then(function () {
      if (typeof window.gtag !== 'function') return;
      var emailField = form.querySelector('input[type="email"], input[name="email"]');
      var phoneField = form.querySelector('input[type="tel"], input[name="phone"]');
      var email = normalizeLeadEmail(emailField && emailField.value);
      var phone = normalizeLeadPhone(phoneField && phoneField.value);
      return Promise.all([sha256(email), sha256(phone)]).then(function (hashes) {
        var userData = {};
        if (hashes[0]) userData.sha256_email_address = hashes[0];
        if (hashes[1]) userData.sha256_phone_number = hashes[1];
        if (Object.keys(userData).length) window.gtag('set', 'user_data', userData);
      });
    }).catch(function () {});
  }

  function restoreFailedSubmission(form, submitButton, wasDisabled) {
    delete form.dataset.bfcSubmitting;
    if (submitButton) submitButton.disabled = wasDisabled;
  }

  function completeNativeSubmission(form, submitButton, wasDisabled) {
    try {
      HTMLFormElement.prototype.submit.call(form);
    } catch (error) {
      restoreFailedSubmission(form, submitButton, wasDisabled);
    }
  }

  function handleValidSubmission(form, formName, event) {
    if (event.defaultPrevented) return;
    if (typeof form.checkValidity === 'function' && !form.checkValidity()) return;
    if (form.dataset.bfcSubmitting === 'true') {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    form.dataset.bfcSubmitting = 'true';
    var submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    var wasDisabled = Boolean(submitButton && submitButton.disabled);
    if (submitButton) submitButton.disabled = true;

    var gaInput = form.querySelector('input[name="ga_client_id"]');
    if (gaInput) gaInput.value = getGaClientId();
    sendEvent('form_submit_attempt', { form_name: formName });

    setEnhancedLeadData(form).then(function () {
      completeNativeSubmission(form, submitButton, wasDisabled);
    }, function () {
      completeNativeSubmission(form, submitButton, wasDisabled);
    });
  }

  // 7. Bind DOM Events
  function initTracker() {
    // Record page view event
    sendEvent('page_view', { title: document.title });

    // Populate all existing intake and intent forms
    var forms = document.querySelectorAll('form[name="donationForm"], form#donationForm, form[name="boatValuation"], form#valForm, form[name="boatValuationIntent"], form#intentForm, form[data-netlify="true"]');
    forms.forEach(function (form) {
      injectHiddenFields(form);
      var formName = form.getAttribute('name') || form.id || 'form';
      sendEvent('donation_form_view', { form_name: formName });

      // Track form start
      var hasStarted = false;
      form.addEventListener('input', function () {
        if (!hasStarted) {
          hasStarted = true;
          sendEvent('form_start', { form_name: formName });
        }
      });

      // Track form submit attempt
      form.addEventListener('submit', function (event) {
        handleValidSubmission(form, formName, event);
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

    // 8. Dynamic Number Insertion Hook (WhatConverts safe integration)
    // Keeps 855-557-3703 as fallback. If WhatConverts is loaded, swaps dynamically.
    if (window._whatconverts && typeof window._whatconverts.push === 'function') {
      window._whatconverts.push(['set_custom_field', 'visitor_id', visitorId]);
      window._whatconverts.push(['set_custom_field', 'session_id', sessionId]);
      window._whatconverts.push(['set_custom_field', 'first_touch_source', firstTouch.utm_source || 'direct']);
      window._whatconverts.push(['set_custom_field', 'first_touch_landing_page', firstTouch.landing_page || '/']);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracker);
  } else {
    initTracker();
  }

  // Expose safe global helper
  window.BFC_TRACKER = {
    getVisitorId: function () { return visitorId; },
    getSessionId: function () { return sessionId; },
    getFirstTouch: function () { return firstTouch; },
    getLastTouch: function () { return lastTouch; },
    sendEvent: sendEvent,
    injectHiddenFields: injectHiddenFields,
    setEnhancedLeadData: setEnhancedLeadData
  };
})();
