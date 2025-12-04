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
      const required = ['name','email','phone','boat','location'];
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
