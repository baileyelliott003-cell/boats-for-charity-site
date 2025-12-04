
Boats for Charity — Auto-Reply Setup (Netlify Forms)
====================================================

This build includes an automatic email reply to donors using a Netlify Function
that triggers on each new form submission.

Files added:
- netlify/functions/submission-created.js
- netlify.toml

How it works:
- When someone submits the "donationForm", Netlify invokes submission-created.js.
- The function reads the donor's email (the "email" field) and sends a thank-you email
  via the Resend email API.

Quick setup (5 minutes):
1) Create a free account at https://resend.com/ and get your API key.
2) In Netlify → Site settings → Environment variables, add:
   - RESEND_API_KEY = your_api_key_here
   - FROM_EMAIL = Boats for Charity <no-reply@boatsforcharity.org>   (optional; can be any verified sender)
3) Deploy this folder to your existing Netlify site (Sites → Your site → Deploys → drag the unzipped folder).
4) Submit the form on your site to test. You should receive an email at the address you entered.

Notes:
- This function only sends for form submissions where form_name === "donationForm" and an "email" field exists.
- If you prefer SendGrid or Postmark, I can swap the function to use those instead. Just tell me which one.
- If you're not using a custom domain yet, the FROM_EMAIL can be a verified sender in Resend (e.g., hello@yourdomain.com).
