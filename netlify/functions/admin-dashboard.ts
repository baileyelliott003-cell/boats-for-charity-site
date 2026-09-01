// netlify/functions/admin-dashboard.ts
import type { Config, Context } from "@netlify/functions";
import { verifyDashboardAuth } from "../../lib/attribution.js";

/**
 * Protected Server-Rendered Staff Dashboard for Lead & Sales Management
 */
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const keyFromQuery = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization") || (keyFromQuery ? `Bearer ${keyFromQuery}` : null);

  // Require authentication to access the portal
  if (!verifyDashboardAuth(authHeader)) {
    return new Response(
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Staff Portal Authentication | Boats for Charity</title>
  <link rel="stylesheet" href="/styles.v142.css">
  <style>
    body { background: #0b243b; color: #fff; display: grid; place-items: center; min-height: 100vh; margin: 0; font-family: system-ui, sans-serif; }
    .login-card { background: #fff; color: #111827; padding: 32px; border-radius: 16px; width: 100%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center; }
    .login-card h1 { color: #0b243b; font-size: 1.4rem; margin: 0 0 8px; }
    .login-card input { width: 100%; box-sizing: border-box; padding: 12px; margin: 16px 0; border: 2px solid #d1d5db; border-radius: 8px; font-size: 1rem; }
    .login-card button { width: 100%; padding: 12px; font-weight: 700; background: #22a6a1; color: #fff; border: 0; border-radius: 8px; cursor: pointer; font-size: 1rem; }
    .login-card p { font-size: 0.85rem; color: #64748b; margin: 0 0 16px; }
  </style>
</head>
<body>
  <div class="login-card">
    <img src="/assets/logo.png" alt="Boats for Charity" style="max-height: 48px; margin: 0 auto 16px; display: block;">
    <h1>Staff Attribution Portal</h1>
    <p>Protected internal access for donation tracking & sales.</p>
    <form method="GET" action="/admin/dashboard">
      <input type="password" name="key" placeholder="Enter Staff Access Key" required autofocus>
      <button type="submit">Unlock Portal</button>
    </form>
  </div>
</body>
</html>`,
      {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8", "cache-control": "no-store" }
      }
    );
  }

  const safeKey = (keyFromQuery || "").trim();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Attribution & Sales Dashboard | Boats for Charity</title>
  <link rel="stylesheet" href="/styles.v142.css">
  <style>
    :root { --navy: #0b243b; --teal: #22a6a1; --bg: #f8fafc; --card: #ffffff; }
    body { background: var(--bg); color: #111827; margin: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    .dash-header { background: var(--navy); color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .dash-header h1 { margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
    .dash-container { max-width: 1400px; margin: 24px auto; padding: 0 20px; }
    
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .metric-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .metric-card .label { font-size: 0.82rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-card .val { font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 4px; }
    
    .section-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .section-box h2 { font-size: 1.15rem; color: var(--navy); margin: 0 0 16px; display: flex; align-items: center; justify-content: space-between; }
    
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; text-align: left; }
    th { background: #f1f5f9; padding: 12px 14px; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:hover { background: #f8fafc; }
    
    .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; }
    .badge-new { background: #dbeafe; color: #1e40af; }
    .badge-accepted { background: #dcfce7; color: #166534; }
    .badge-listed { background: #fef9c3; color: #854d0e; }
    .badge-sold { background: #ccfbf1; color: #0f766e; }
    
    .btn-sm { padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; font-weight: 700; cursor: pointer; border: 1px solid #d1d5db; background: #fff; }
    .btn-sm.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
    .source-tag { font-family: monospace; font-size: 0.82rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    
    .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-bar input, .filter-bar select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header class="dash-header">
    <h1>🚤 Boats for Charity — Attribution &amp; Revenue Pipeline</h1>
    <div>
      <button class="btn-sm primary" onclick="exportConversions()">📥 Export Google Ads CSV</button>
      <a href="/admin/dashboard?key=${encodeURIComponent(safeKey)}" class="btn-sm">🔄 Refresh</a>
    </div>
  </header>

  <main class="dash-container">
    <!-- KPI Overview Cards -->
    <div class="metrics-grid">
      <div class="metric-card"><div class="label">Verified Form Leads</div><div class="val" id="m-leads">...</div></div>
      <div class="metric-card"><div class="label">Tracked Phone Calls</div><div class="val" id="m-calls">...</div></div>
      <div class="metric-card"><div class="label">Accepted Donations</div><div class="val" id="m-accepted">...</div></div>
      <div class="metric-card"><div class="label">Boats Sold (eBay)</div><div class="val" id="m-sold">...</div></div>
      <div class="metric-card"><div class="label">Gross Revenue</div><div class="val" id="m-rev" style="color: #059669;">...</div></div>
      <div class="metric-card"><div class="label">Conversion Rate</div><div class="val" id="m-cvr">...</div></div>
    </div>

    <!-- Marketing Source Breakdown -->
    <div class="section-box">
      <h2>📊 Marketing Channel &amp; Campaign Performance</h2>
      <div style="overflow-x: auto;">
        <table id="sourceTable">
          <thead>
            <tr>
              <th>Marketing Source / Channel</th>
              <th>Leads</th>
              <th>Accepted Donations</th>
              <th>Final Sales</th>
              <th>Gross Sale Revenue</th>
              <th>Lead-to-Sale CVR</th>
            </tr>
          </thead>
          <tbody><tr><td colspan="6">Loading channel attribution...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Pipeline & Leads Table -->
    <div class="section-box">
      <h2>
        <span>📋 Verified Leads &amp; Attribution Details</span>
      </h2>
      <div class="filter-bar">
        <input type="text" id="leadSearch" placeholder="Search by name, email, phone, city..." onkeyup="filterLeads()">
        <select id="stageFilter" onchange="filterLeads()">
          <option value="">All Pipeline Stages</option>
          <option>New</option>
          <option>Contacted</option>
          <option>Qualified</option>
          <option>Donation Accepted</option>
          <option>Listed</option>
          <option>Sold</option>
        </select>
      </div>
      <div style="overflow-x: auto;">
        <table id="leadsTable">
          <thead>
            <tr>
              <th>ID / Date</th>
              <th>Donor</th>
              <th>First Touch Source</th>
              <th>Last Non-Direct Touch</th>
              <th>GCLID / Ad Click ID</th>
              <th>SMS Consent</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="leadsTbody"><tr><td colspan="8">Loading lead records...</td></tr></tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    const AUTH_KEY = ${JSON.stringify(safeKey)};
    const headers = { 'Authorization': 'Bearer ' + AUTH_KEY, 'Content-Type': 'application/json' };
    let allLeads = [];

    async function loadData() {
      try {
        const res = await fetch('/api/dashboard?action=overview', { headers });
        if (!res.ok) throw new Error('Failed to load overview');
        const data = await res.json();
        
        document.getElementById('m-leads').textContent = data.metrics.leads;
        document.getElementById('m-calls').textContent = data.metrics.calls;
        document.getElementById('m-accepted').textContent = data.metrics.acceptedDonations;
        document.getElementById('m-sold').textContent = data.metrics.soldBoats;
        document.getElementById('m-rev').textContent = '$' + Number(data.metrics.grossRevenue).toLocaleString();
        document.getElementById('m-cvr').textContent = data.metrics.conversionRate + '%';

        // Render source table
        const tbody = document.querySelector('#sourceTable tbody');
        tbody.innerHTML = data.sourceBreakdown.map(s => {
          const cvr = s.leadsCount ? ((s.salesCount / s.leadsCount) * 100).toFixed(1) + '%' : '0%';
          return '<tr>' +
            '<td><strong>' + (s.source || 'direct') + '</strong></td>' +
            '<td>' + s.leadsCount + '</td>' +
            '<td>' + s.acceptedBoats + '</td>' +
            '<td>' + s.salesCount + '</td>' +
            '<td>$' + Number(s.grossRevenue).toLocaleString() + '</td>' +
            '<td>' + cvr + '</td>' +
          '</tr>';
        }).join('');
      } catch (err) {
        console.error(err);
      }

      try {
        const res = await fetch('/api/dashboard?action=leads', { headers });
        if (!res.ok) throw new Error('Failed to load leads');
        const data = await res.json();
        allLeads = data.leads;
        renderLeads(allLeads);
      } catch (err) {
        console.error(err);
      }
    }

    function renderLeads(leads) {
      const tbody = document.getElementById('leadsTbody');
      if (!leads.length) {
        tbody.innerHTML = '<tr><td colspan="8">No lead records found.</td></tr>';
        return;
      }
      tbody.innerHTML = leads.map(l => {
        const date = new Date(l.createdAt).toLocaleDateString() + ' ' + new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = (l.firstName + ' ' + l.lastName).trim() || 'Anonymous';
        const contact = l.email ? l.email : (l.phone || 'No phone');
        const gclid = l.gclid ? '<span class="source-tag" title="' + l.gclid + '">' + l.gclid.slice(0, 12) + '...</span>' : '<span style="color:#94a3b8">none</span>';
        const sms = l.smsConsent ? '<span style="color:#166534;font-weight:700;">✓ Yes</span>' : '<span style="color:#64748b;">No</span>';
        
        let badgeClass = 'badge-new';
        if (l.stage === 'Donation Accepted') badgeClass = 'badge-accepted';
        if (l.stage === 'Listed') badgeClass = 'badge-listed';
        if (l.stage === 'Sold') badgeClass = 'badge-sold';

        return '<tr>' +
          '<td>#' + l.id + '<br><small style="color:#64748b">' + date + '</small></td>' +
          '<td><strong>' + name + '</strong><br><small>' + contact + '</small></td>' +
          '<td><span class="source-tag">' + (l.firstTouchSource || 'direct') + '</span></td>' +
          '<td><span class="source-tag">' + (l.lastTouchSource || l.firstTouchSource || 'direct') + '</span></td>' +
          '<td>' + gclid + '</td>' +
          '<td>' + sms + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + l.stage + '</span></td>' +
          '<td>' +
            '<select class="btn-sm" onchange="updateStage(' + l.id + ', this.value)">' +
              '<option value="">Update Stage...</option>' +
              '<option value="Contacted">Contacted</option>' +
              '<option value="Qualified">Qualified</option>' +
              '<option value="Donation Accepted">Donation Accepted</option>' +
              '<option value="Listed">Listed</option>' +
              '<option value="Sold">Sold</option>' +
            '</select>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function filterLeads() {
      const q = document.getElementById('leadSearch').value.toLowerCase();
      const st = document.getElementById('stageFilter').value;
      const filtered = allLeads.filter(l => {
        const str = (l.firstName + ' ' + l.lastName + ' ' + l.email + ' ' + l.phone + ' ' + l.boatDetails).toLowerCase();
        const matchQ = !q || str.includes(q);
        const matchSt = !st || l.stage === st;
        return matchQ && matchSt;
      });
      renderLeads(filtered);
    }

    async function updateStage(leadId, stage) {
      if (!stage) return;
      if (!confirm('Update lead #' + leadId + ' stage to ' + stage + '?')) return;
      const res = await fetch('/api/dashboard?action=update_lead_stage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lead_id: leadId, stage })
      });
      if (res.ok) {
        alert('Stage updated.');
        loadData();
      } else {
        alert('Failed to update stage.');
      }
    }

    function exportConversions() {
      window.location.href = '/api/export-conversions?format=csv&key=' + encodeURIComponent(AUTH_KEY);
    }

    loadData();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
};

export const config: Config = {
  path: "/admin/dashboard",
};
