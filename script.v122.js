// Netlify-friendly form submission + hamburger + toast
document.addEventListener('DOMContentLoaded', () => {
  // Toast on home if ?submitted=1
  const toast = document.getElementById('toast');
  const url = new URL(window.location.href);
  if (toast && url.searchParams.get('submitted') === '1') {
    toast.hidden = false;
    setTimeout(() => toast.hidden = true, 4500);
  }

  // Form: allow native Netlify submission
  const form = document.getElementById('donationForm');
  const msg = document.querySelector('.form-msg');
  if (form && form.hasAttribute('data-netlify')) {
    form.addEventListener('submit', (e) => {
      const required = ['first_name','last_name','phone'];
      for (const key of required) {
        const el = form.querySelector(`[name="${key}"]`);
        if (!el || !el.value) {
          e.preventDefault();
          if (msg) {
            msg.textContent = 'Please complete all required fields.';
            msg.style.color = '#b91c1c';
          }
          return;
        }
      }
      // No preventDefault — Netlify captures and redirects to /thanks.html
    });
  }

  // Donate button click tracking — sends a lightweight beacon to a Netlify
  // Function so we can count how many times each "Donate" CTA is clicked.
  function trackDonateClick(source) {
    try {
      const payload = JSON.stringify({ source: source, path: location.pathname });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track-donate', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/track-donate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) { /* tracking must never break the page */ }
  }

  const donateButtons = document.querySelectorAll('a[href="#donate"], a[href$="/#donate"]');
  donateButtons.forEach((el) => {
    el.addEventListener('click', () => {
      const label = el.dataset.track
        || el.getAttribute('aria-label')
        || (el.textContent || '').trim().slice(0, 60)
        || 'donate';
      trackDonateClick(label);
    });
  });

  // Hamburger toggle + desktop reset
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('primaryNav');
  function setDesktopState(){
    if (!nav) return;
    if (window.innerWidth > 640) {
      nav.removeAttribute('hidden');
      if (toggle) toggle.setAttribute('aria-expanded','true');
    } else {
      nav.setAttribute('hidden','');
      if (toggle) toggle.setAttribute('aria-expanded','false');
    }
  }
  setDesktopState();
  window.addEventListener('resize', () => {
    clearTimeout(window.__navResizeTimer);
    window.__navResizeTimer = setTimeout(setDesktopState, 150);
  });
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isHidden = nav.hasAttribute('hidden');
      if (isHidden) {
        nav.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded','true');
      } else {
        nav.setAttribute('hidden','');
        toggle.setAttribute('aria-expanded','false');
      }
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      if (window.innerWidth <= 640) {
        nav.setAttribute('hidden','');
        toggle.setAttribute('aria-expanded','false');
      }
    }));
  }
});
