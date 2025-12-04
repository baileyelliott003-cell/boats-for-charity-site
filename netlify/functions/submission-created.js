// Netlify Function: Auto-reply to form submissions
// Trigger: runs automatically on every Netlify Forms submission
// Docs: https://docs.netlify.com/forms/setup/#form-submission-notifications

export async function handler(event) {
  try {
    const payload = JSON.parse(event.body); // Netlify submission payload
    const data = payload && payload.payload && payload.payload.data ? payload.payload.data : {};
    const formName = payload && payload.payload ? payload.payload.form_name : "";
    const donorEmail = (data.email || "").trim();

    // Only respond to our specific form
    if (formName !== "donationForm" || !donorEmail) {
      return { statusCode: 200, body: "No action (not donationForm or missing email)" };
    }

    // Compose email
    const subject = "We received your boat donation information — Boats for Charity";
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin:0 0 8px;color:#0b243b">Thank you for your submission</h2>
        <p>We received your boat donation information and will reach out shortly. If you need help now, call <a href="tel:+15034068631">503-406-8631</a>.</p>
        <p style="margin:16px 0 0">— Boats for Charity<br><em>Turning Boats into Blessings</em></p>
      </div>
    `;

    // Send via Resend API
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL || "Boats for Charity <no-reply@boatsforcharity.org>";
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — skipping auto-reply.");
      return { statusCode: 200, body: "Missing RESEND_API_KEY" };
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: donorEmail,
        subject,
        html
      })
    });

    const result = await resp.text();
    if (!resp.ok) {
      console.error("Resend error:", result);
      return { statusCode: 500, body: "Email send failed" };
    }

    return { statusCode: 200, body: "Auto-reply sent" };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: "Server error" };
  }
}
