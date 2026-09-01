// netlify/functions/admin-dashboard.ts
import type { Config, Context } from "@netlify/functions";
import { authorizeAdminRequest } from "../../lib/admin-auth.js";
import { escapeHtml } from "../../lib/dashboard-view.js";

/**
 * Protected Server-Rendered Staff Dashboard for Lead, Call, Boat, Listing & Sales Management
 * Uses a server-side session cookie without exposing credentials to browser code.
 */
export default async (req: Request, context: Context) => {
  const authorization = await authorizeAdminRequest(req);
  if (!authorization.authorized) {
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
    <form id="loginForm" method="POST" action="/api/admin-login">
      <input type="password" name="password" autocomplete="current-password" placeholder="Enter Staff Password" required autofocus>
      <button type="submit">Unlock Portal</button>
      <p id="loginError" role="alert" style="color:#b91c1c;margin-top:12px;"></p>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('loginError');
      error.textContent = '';
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: form.elements.password.value })
      });
      form.elements.password.value = '';
      if (response.ok) {
        window.location.replace('/admin/dashboard');
        return;
      }
      error.textContent = response.status === 429 ? 'Too many attempts. Please wait and try again.' : 'Unable to sign in.';
    });
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "cache-control": "no-store" }
      }
    );
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Attribution &amp; Sales Management Portal | Boats for Charity</title>
  <link rel="stylesheet" href="/styles.v142.css">
  <style>
    :root { --navy: #0b243b; --teal: #22a6a1; --bg: #f8fafc; --card: #ffffff; }
    body { background: var(--bg); color: #111827; margin: 0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; }
    .dash-header { background: var(--navy); color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .dash-header h1 { margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
    .dash-container { max-width: 1500px; margin: 24px auto; padding: 0 20px; }
    
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .metric-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .metric-card .label { font-size: 0.82rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-card .val { font-size: 1.8rem; font-weight: 800; color: var(--navy); margin-top: 4px; }
    
    .tab-bar { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap; }
    .tab-btn { padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; border: 0; background: transparent; color: #64748b; }
    .tab-btn.active { background: var(--teal); color: #fff; }
    
    .section-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
    .section-box h2 { font-size: 1.15rem; color: var(--navy); margin: 0 0 16px; display: flex; align-items: center; justify-content: space-between; }
    
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; text-align: left; }
    th { background: #f1f5f9; padding: 12px 14px; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:hover { background: #f8fafc; }
    
    .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; }
    .badge-new { background: #dbeafe; color: #1e40af; }
    .badge-contacted { background: #e0e7ff; color: #4338ca; }
    .badge-qualified { background: #fef08a; color: #854d0e; }
    .badge-accepted { background: #dcfce7; color: #166534; }
    .badge-listed { background: #ffedd5; color: #9a3412; }
    .badge-sold { background: #ccfbf1; color: #0f766e; }
    
    .btn-sm { padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; font-weight: 700; cursor: pointer; border: 1px solid #d1d5db; background: #fff; text-decoration: none; display: inline-block; }
    .btn-sm.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
    .btn-sm.action { background: #0b243b; color: #fff; border-color: #0b243b; }
    .source-tag { font-family: monospace; font-size: 0.82rem; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    
    .filter-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .filter-bar input, .filter-bar select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; }
    
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; z-index: 100; padding: 20px; }
    .modal-card { background: #fff; border-radius: 12px; padding: 24px; width: 100%; max-width: 550px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
    .modal-card h3 { margin: 0 0 16px; color: var(--navy); }
    .modal-card label { display: block; font-weight: 700; margin-top: 10px; font-size: 0.88rem; color: #374151; }
    .modal-card input, .modal-card select, .modal-card textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .modal-actions { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; }
  </style>
</head>
<body>
  <header class="dash-header">
    <h1>🚤 Boats for Charity — Pipeline &amp; Attribution Hub</h1>
    <div style="display: flex; gap: 10px;">
      <button class="btn-sm primary" onclick="exportConversionsSecure()">📥 Export Google Ads CSV</button>
      <a href="/admin/dashboard" class="btn-sm">🔄 Refresh</a>
      <button class="btn-sm" onclick="logout()">Sign Out</button>
    </div>
  </header>

  <main class="dash-container">
    <!-- KPI Overview Cards -->
    <div class="metrics-grid">
      <div class="metric-card"><div class="label">Verified Form Leads</div><div class="val" id="m-leads">...</div></div>
      <div class="metric-card"><div class="label">Tracked Calls</div><div class="val" id="m-calls">...</div></div>
      <div class="metric-card"><div class="label">Accepted Donations</div><div class="val" id="m-accepted">...</div></div>
      <div class="metric-card"><div class="label">Boats Sold (eBay)</div><div class="val" id="m-sold">...</div></div>
      <div class="metric-card"><div class="label">Gross Revenue</div><div class="val" id="m-rev" style="color: #059669;">...</div></div>
      <div class="metric-card"><div class="label">Lead-to-Sale CVR</div><div class="val" id="m-cvr">...</div></div>
    </div>

    <!-- Google Ads Data Manager Live Integration Status Panel -->
    <div class="section-box" style="border-left: 4px solid var(--teal);">
      <h2>
        <span>📊 Google Ads Data Manager Integration Status</span>
        <span id="gads-config-badge" class="badge badge-new">Checking Feed...</span>
      </h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px;">
        <div><strong>Feed URL (HTTPS):</strong><br><code class="source-tag">/api/google-ads-conversions-feed.csv</code></div>
        <div><strong>Authentication:</strong><br><span style="color:#1e40af; font-weight:700;">HTTP Basic Auth (Protected)</span></div>
        <div><strong>Eligible Conversions:</strong><br><span id="gads-eligible-count" style="color:#059669; font-weight:800; font-size:1.1rem;">...</span></div>
        <div><strong>Missing GCLID / Match Data:</strong><br><span id="gads-missing-gclid" style="color:#64748b; font-weight:700;">...</span></div>
      </div>
      <div id="gads-details-box" style="background:#f8fafc; padding:12px 16px; border-radius:8px; font-size:0.88rem; color:#475569;">
        Loading Google Ads integration telemetry...
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-bar">
      <button class="tab-btn active" onclick="switchTab('leadsTab', this)">📋 Leads &amp; Intake</button>
      <button class="tab-btn" onclick="switchTab('callsTab', this)">📞 Phone Calls</button>
      <button class="tab-btn" onclick="switchTab('boatsTab', this)">⛵ Boats &amp; Pipeline</button>
      <button class="tab-btn" onclick="switchTab('sourcesTab', this)">📈 Marketing Attribution</button>
      <button class="tab-btn" onclick="switchTab('auditTab', this)">🛡️ Audit Trail</button>
    </div>

    <!-- Tab 1: Leads -->
    <div id="leadsTab" class="section-box">
      <h2>
        <span>Verified Form Leads</span>
      </h2>
      <div class="filter-bar">
        <input type="text" id="leadSearch" placeholder="Search name, email, phone, boat details..." onkeyup="filterLeads()" style="min-width:280px;">
        <select id="stageFilter" onchange="filterLeads()">
          <option value="">All Stages</option>
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
              <th>First Touch</th>
              <th>Last Touch</th>
              <th>GCLID</th>
              <th>SMS</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="leadsTbody"><tr><td colspan="8">Loading leads...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 2: Calls -->
    <div id="callsTab" class="section-box" style="display:none;">
      <h2>Tracked Phone Calls (WhatConverts &amp; Quo)</h2>
      <div style="overflow-x: auto;">
        <table id="callsTable">
          <thead>
            <tr>
              <th>ID / Time</th>
              <th>Caller Number</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Attribution Source</th>
              <th>GCLID</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="callsTbody"><tr><td colspan="8">Loading calls...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 3: Boats & Pipeline -->
    <div id="boatsTab" class="section-box" style="display:none;">
      <h2>
        <span>Accepted Vessels &amp; eBay Pipeline</span>
        <button class="btn-sm primary" onclick="openCreateBoatModal()">+ Add Accepted Boat</button>
      </h2>
      <div style="overflow-x: auto;">
        <table id="boatsTable">
          <thead>
            <tr>
              <th>Boat ID</th>
              <th>Vessel Info</th>
              <th>HIN</th>
              <th>Location</th>
              <th>Status</th>
              <th>Accepted Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="boatsTbody"><tr><td colspan="7">Loading vessels...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 4: Marketing Sources -->
    <div id="sourcesTab" class="section-box" style="display:none;">
      <h2>Channel &amp; Campaign Performance Breakdown</h2>
      <div style="overflow-x: auto;">
        <table id="sourceTable">
          <thead>
            <tr>
              <th>Marketing Source</th>
              <th>Leads</th>
              <th>Accepted Donations</th>
              <th>Final Sales</th>
              <th>Gross Revenue</th>
              <th>Conversion Rate</th>
            </tr>
          </thead>
          <tbody><tr><td colspan="6">Loading channel stats...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Tab 5: Audit Trail -->
    <div id="auditTab" class="section-box" style="display:none;">
      <h2>Attribution Corrections &amp; Stage Audit History</h2>
      <div style="overflow-x: auto;">
        <table id="auditTable">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="auditTbody"><tr><td colspan="5">Loading audit trail...</td></tr></tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- MODAL: Edit Boat / Record Sale / eBay Relist / Attribution Correction -->
  <div id="modalWrap" class="modal" style="display:none;">
    <div class="modal-card" id="modalContent">
      <!-- Injected dynamically -->
    </div>
  </div>

  <script>
    function getCookie(name) {
      const prefix = name + '=';
      const value = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
      return value ? decodeURIComponent(value.slice(prefix.length)) : '';
    }
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': getCookie('bfc_admin_csrf') };
    let allLeads = [];
    let allCalls = [];
    let allBoats = [];

    ${escapeHtml.toString()}

    function switchTab(tabId, btn) {
      ['leadsTab', 'callsTab', 'boatsTab', 'sourcesTab', 'auditTab'].forEach(t => {
        document.getElementById(t).style.display = (t === tabId ? 'block' : 'none');
      });
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    async function loadData() {
      // Overview
      try {
        const res = await fetch('/api/dashboard?action=overview', { headers });
        if (res.ok) {
          const data = await res.json();
          document.getElementById('m-leads').textContent = data.metrics.leads;
          document.getElementById('m-calls').textContent = data.metrics.calls;
          document.getElementById('m-accepted').textContent = data.metrics.acceptedDonations;
          document.getElementById('m-sold').textContent = data.metrics.soldBoats;
          document.getElementById('m-rev').textContent = '$' + Number(data.metrics.grossRevenue).toLocaleString();
          document.getElementById('m-cvr').textContent = data.metrics.conversionRate + '%';

          const tbody = document.querySelector('#sourceTable tbody');
          tbody.innerHTML = data.sourceBreakdown.map(s => {
            const cvr = s.leadsCount ? ((s.salesCount / s.leadsCount) * 100).toFixed(1) + '%' : '0%';
            return '<tr>' +
              '<td><strong>' + escapeHtml(s.source || 'direct') + '</strong></td>' +
              '<td>' + s.leadsCount + '</td>' +
              '<td>' + s.acceptedBoats + '</td>' +
              '<td>' + s.salesCount + '</td>' +
              '<td>$' + Number(s.grossRevenue).toLocaleString() + '</td>' +
              '<td>' + cvr + '</td>' +
            '</tr>';
          }).join('');
        }
      } catch (e) { console.error(e); }

      // Google Ads Integration Status
      try {
        const res = await fetch('/api/dashboard?action=google_ads_status', { headers });
        if (res.ok) {
          const data = await res.json();
          const feed = data.feed;
          
          const badge = document.getElementById('gads-config-badge');
          if (feed.isConfigured) {
            badge.className = 'badge badge-accepted';
            badge.textContent = 'Basic Auth Configured';
          } else {
            badge.className = 'badge badge-listed';
            badge.textContent = 'Env Vars Pending';
          }
          
          document.getElementById('gads-eligible-count').textContent = feed.eligibleConversionsCount + ' queued (60d window)';
          document.getElementById('gads-missing-gclid').textContent = feed.missingGclidCount + ' without GCLID (using Enhanced hash)';
          
          let details = '<strong>Queued by Action:</strong> ' +
            'Donation_Accepted: ' + (feed.countsByType['Donation_Accepted'] || 0) + ' | ' +
            'Qualified_Lead: ' + (feed.countsByType['Qualified_Lead'] || 0) + ' | ' +
            'Boat_Sold: ' + (feed.countsByType['Boat_Sold'] || 0) + '<br>';
            
          if (feed.lastQueuedConversion) {
            details += '<strong>Last Queued Event:</strong> ' + escapeHtml(feed.lastQueuedConversion.type) + ' (' + new Date(feed.lastQueuedConversion.time).toLocaleDateString() + ') — Order ID: ' + escapeHtml(feed.lastQueuedConversion.id);
          } else {
            details += 'No offline conversion events queued yet.';
          }
          document.getElementById('gads-details-box').innerHTML = details;
        }
      } catch (e) { console.error(e); }

      // Leads
      try {
        const res = await fetch('/api/dashboard?action=leads', { headers });
        if (res.ok) {
          const data = await res.json();
          allLeads = data.leads || [];
          renderLeads(allLeads);
        }
      } catch (e) { console.error(e); }

      // Calls
      try {
        const res = await fetch('/api/dashboard?action=calls', { headers });
        if (res.ok) {
          const data = await res.json();
          allCalls = data.calls || [];
          renderCalls(allCalls);
        }
      } catch (e) { console.error(e); }

      // Boats
      try {
        const res = await fetch('/api/dashboard?action=boats', { headers });
        if (res.ok) {
          const data = await res.json();
          allBoats = data.boats || [];
          renderBoats(allBoats);
        }
      } catch (e) { console.error(e); }

      // Audit
      try {
        const res = await fetch('/api/dashboard?action=audit', { headers });
        if (res.ok) {
          const data = await res.json();
          renderAudit(data.audit || []);
        }
      } catch (e) { console.error(e); }
    }

    function renderLeads(leads) {
      const tbody = document.getElementById('leadsTbody');
      if (!leads.length) { tbody.innerHTML = '<tr><td colspan="8">No lead records found.</td></tr>'; return; }
      tbody.innerHTML = leads.map(l => {
        const date = new Date(l.createdAt).toLocaleDateString() + ' ' + new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const name = (l.firstName + ' ' + l.lastName).trim() || 'Anonymous';
        const contact = l.email || l.phone || 'No contact';
        const gclid = l.gclid ? '<span class="source-tag" title="' + escapeHtml(l.gclid) + '">' + escapeHtml(l.gclid.slice(0, 10)) + '...</span>' : '<span style="color:#94a3b8">none</span>';
        const sms = l.smsConsent ? '<span style="color:#166534;font-weight:700;">✔ Yes</span>' : '<span style="color:#64748b;">No</span>';
        
        let bClass = 'badge-new';
        if (l.stage === 'Contacted') bClass = 'badge-contacted';
        if (l.stage === 'Qualified') bClass = 'badge-qualified';
        if (l.stage === 'Donation Accepted') bClass = 'badge-accepted';
        if (l.stage === 'Listed') bClass = 'badge-listed';
        if (l.stage === 'Sold') bClass = 'badge-sold';

        return '<tr>' +
          '<td>#' + l.id + '<br><small style="color:#64748b;">' + date + '</small></td>' +
          '<td><strong>' + escapeHtml(name) + '</strong><br><small>' + escapeHtml(contact) + '</small></td>' +
          '<td><span class="source-tag">' + escapeHtml(l.firstTouchSource || 'direct') + '</span></td>' +
          '<td><span class="source-tag">' + escapeHtml(l.lastTouchSource || l.firstTouchSource || 'direct') + '</span></td>' +
          '<td>' + gclid + '</td>' +
          '<td>' + sms + '</td>' +
          '<td><span class="badge ' + bClass + '">' + escapeHtml(l.stage) + '</span></td>' +
          '<td>' +
            '<select class="btn-sm" onchange="updateLeadStage(' + l.id + ', this.value)">' +
              '<option value="">Change Stage...</option>' +
              '<option value="Contacted">Contacted</option>' +
              '<option value="Qualified">Qualified</option>' +
              '<option value="Donation Accepted">Donation Accepted</option>' +
              '<option value="Listed">Listed</option>' +
              '<option value="Sold">Sold</option>' +
            '</select> ' +
            '<button class="btn-sm" onclick="openAttributionModal(' + l.id + ')">✏️ Attr</button> ' +
            (!l.boatId ? '<button class="btn-sm action" onclick="openCreateBoatForLead(' + l.id + ')">+ Boat</button>' : '<span style="color:#166534;font-size:0.8rem;font-weight:700;">✔ Boat #' + l.boatId + '</span>') +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function renderCalls(calls) {
      const tbody = document.getElementById('callsTbody');
      if (!calls.length) { tbody.innerHTML = '<tr><td colspan="8">No call records found.</td></tr>'; return; }
      tbody.innerHTML = calls.map(c => {
        const date = new Date(c.callTime).toLocaleDateString() + ' ' + new Date(c.callTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const gclid = c.gclid ? '<span class="source-tag">' + escapeHtml(c.gclid.slice(0, 10)) + '...</span>' : '<span style="color:#94a3b8">none</span>';
        return '<tr>' +
          '<td>#' + c.id + '<br><small style="color:#64748b;">' + date + '</small></td>' +
          '<td><strong>' + escapeHtml(c.callerNumber || 'Anonymous') + '</strong></td>' +
          '<td>' + c.callDurationSeconds + 's</td>' +
          '<td>' + escapeHtml(c.callStatus) + '</td>' +
          '<td><span class="source-tag">' + escapeHtml(c.source || 'phone') + '</span></td>' +
          '<td>' + gclid + '</td>' +
          '<td><span class="badge badge-new">' + escapeHtml(c.stage) + '</span></td>' +
          '<td>' +
            '<button class="btn-sm action" onclick="openConnectCallModal(' + c.id + ')">Connect to Lead</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function renderBoats(boats) {
      const tbody = document.getElementById('boatsTbody');
      if (!boats.length) { tbody.innerHTML = '<tr><td colspan="7">No accepted vessel records found.</td></tr>'; return; }
      tbody.innerHTML = boats.map(b => {
        const date = new Date(b.acceptedDate).toLocaleDateString();
        return '<tr>' +
          '<td>#' + b.id + '</td>' +
          '<td><strong>' + escapeHtml(b.title) + '</strong><br><small>' + escapeHtml(b.vesselType) + ' (' + escapeHtml(b.condition) + ')</small></td>' +
          '<td><code>' + escapeHtml(b.hin || 'N/A') + '</code></td>' +
          '<td>' + escapeHtml(b.locationCity + (b.locationState ? ', ' + b.locationState : '')) + '</td>' +
          '<td><span class="badge badge-accepted">' + escapeHtml(b.status) + '</span></td>' +
          '<td>' + date + '</td>' +
          '<td>' +
            '<button class="btn-sm" onclick="openEditBoatModal(' + b.id + ')">Edit</button> ' +
            '<button class="btn-sm action" onclick="openAddListingModal(' + b.id + ')">+ eBay Relist</button> ' +
            '<button class="btn-sm primary" onclick="openRecordSaleModal(' + b.id + ')">💰 Record Sale</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function renderAudit(audit) {
      const tbody = document.getElementById('auditTbody');
      if (!audit.length) { tbody.innerHTML = '<tr><td colspan="5">No audit history entries found.</td></tr>'; return; }
      tbody.innerHTML = audit.map(a => {
        const date = new Date(a.createdAt).toLocaleString();
        return '<tr>' +
          '<td><small>' + date + '</small></td>' +
          '<td><strong>' + escapeHtml(a.entityType) + ' #' + escapeHtml(a.entityId) + '</strong></td>' +
          '<td><code>' + escapeHtml(a.action) + '</code></td>' +
          '<td>' + escapeHtml(a.performedBy) + '</td>' +
          '<td>' + escapeHtml(a.notes || JSON.stringify(a.newState || {})) + '</td>' +
        '</tr>';
      }).join('');
    }

    function filterLeads() {
      const q = document.getElementById('leadSearch').value.toLowerCase();
      const st = document.getElementById('stageFilter').value;
      const filtered = allLeads.filter(l => {
        const str = (l.firstName + ' ' + l.lastName + ' ' + l.email + ' ' + l.phone + ' ' + l.boatDetails).toLowerCase();
        return (!q || str.includes(q)) && (!st || l.stage === st);
      });
      renderLeads(filtered);
    }

    async function updateLeadStage(leadId, stage) {
      if (!stage) return;
      const res = await fetch('/api/dashboard?action=update_lead_stage', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lead_id: leadId, stage })
      });
      if (res.ok) { loadData(); }
      else { alert('Failed to update stage'); }
    }

    // MODAL HANDLERS
    function closeModal() {
      document.getElementById('modalWrap').style.display = 'none';
    }

    function openAttributionModal(leadId) {
      const lead = allLeads.find(l => l.id === leadId);
      if (!lead) return;
      const content = document.getElementById('modalContent');
      content.innerHTML = '<h3>Edit Attribution for Lead #' + lead.id + '</h3>' +
        '<form onsubmit="submitAttributionEdit(event, ' + lead.id + ')">' +
          '<label>Last Touch Source</label><input type="text" id="m_source" value="' + escapeHtml(lead.lastTouchSource || '') + '">' +
          '<label>Last Touch Medium</label><input type="text" id="m_medium" value="' + escapeHtml(lead.lastTouchMedium || '') + '">' +
          '<label>Last Touch Campaign</label><input type="text" id="m_campaign" value="' + escapeHtml(lead.lastTouchCampaign || '') + '">' +
          '<label>Google Click ID (GCLID)</label><input type="text" id="m_gclid" value="' + escapeHtml(lead.gclid || '') + '">' +
          '<label>Correction Reason</label><textarea id="m_notes" placeholder="Reason for manual change"></textarea>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-sm" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn-sm primary">Save Changes</button>' +
          '</div>' +
        '</form>';
      document.getElementById('modalWrap').style.display = 'grid';
    }

    async function submitAttributionEdit(e, leadId) {
      e.preventDefault();
      const res = await fetch('/api/dashboard?action=correct_attribution', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lead_id: leadId,
          last_touch_source: document.getElementById('m_source').value,
          last_touch_medium: document.getElementById('m_medium').value,
          last_touch_campaign: document.getElementById('m_campaign').value,
          gclid: document.getElementById('m_gclid').value,
          notes: document.getElementById('m_notes').value
        })
      });
      if (res.ok) { closeModal(); loadData(); } else { alert('Failed to update attribution'); }
    }

    function openConnectCallModal(callId) {
      const call = allCalls.find(c => c.id === callId);
      if (!call) return;
      const content = document.getElementById('modalContent');
      content.innerHTML = '<h3>Connect Call #' + call.id + ' (' + escapeHtml(call.callerNumber) + ')</h3>' +
        '<form onsubmit="submitConnectCall(event, ' + call.id + ')">' +
          '<label>Link to Lead ID (optional)</label><input type="number" id="c_lead_id" placeholder="e.g. 101">' +
          '<label>Update Call Status / Stage</label>' +
          '<select id="c_stage">' +
            '<option value="New">New</option>' +
            '<option value="Qualified">Qualified</option>' +
            '<option value="Donation Accepted">Donation Accepted</option>' +
            '<option value="Closed Lost">Closed Lost</option>' +
          '</select>' +
          '<label>Notes</label><textarea id="c_notes"></textarea>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-sm" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn-sm primary">Save &amp; Link</button>' +
          '</div>' +
        '</form>';
      document.getElementById('modalWrap').style.display = 'grid';
    }

    async function submitConnectCall(e, callId) {
      e.preventDefault();
      const res = await fetch('/api/dashboard?action=connect_call', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          call_id: callId,
          lead_id: document.getElementById('c_lead_id').value || null,
          stage: document.getElementById('c_stage').value,
          notes: document.getElementById('c_notes').value
        })
      });
      if (res.ok) { closeModal(); loadData(); } else { alert('Failed to connect call'); }
    }

    function openCreateBoatForLead(leadId) {
      const lead = allLeads.find(l => l.id === leadId);
      openBoatModal({ lead_id: leadId, title: lead ? lead.boatDetails || 'Donated Boat' : 'Donated Boat' });
    }

    function openCreateBoatModal() {
      openBoatModal({});
    }

    function openBoatModal(init) {
      const content = document.getElementById('modalContent');
      content.innerHTML = '<h3>' + (init.boat_id ? 'Edit Boat #' + init.boat_id : 'Add Accepted Vessel') + '</h3>' +
        '<form onsubmit="submitBoatModal(event, ' + (init.boat_id || 'null') + ')">' +
          (init.lead_id ? '<input type="hidden" id="b_lead_id" value="' + init.lead_id + '">' : '') +
          '<label>Vessel Title / Name</label><input type="text" id="b_title" value="' + escapeHtml(init.title || '') + '" required>' +
          '<label>Hull Identification Number (HIN)</label><input type="text" id="b_hin" value="' + escapeHtml(init.hin || '') + '">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
            '<div><label>Year</label><input type="number" id="b_year" value="' + (init.year || '') + '"></div>' +
            '<div><label>Length (ft)</label><input type="number" id="b_length" value="' + (init.lengthFt || '') + '"></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
            '<div><label>City</label><input type="text" id="b_city" value="' + escapeHtml(init.locationCity || '') + '"></div>' +
            '<div><label>State</label><input type="text" id="b_state" value="' + escapeHtml(init.locationState || '') + '"></div>' +
          '</div>' +
          '<label>Status</label>' +
          '<select id="b_status">' +
            '<option ' + (init.status === 'Donation Accepted' ? 'selected' : '') + '>Donation Accepted</option>' +
            '<option ' + (init.status === 'Listed' ? 'selected' : '') + '>Listed</option>' +
            '<option ' + (init.status === 'Sold' ? 'selected' : '') + '>Sold</option>' +
          '</select>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-sm" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn-sm primary">Save Vessel</button>' +
          '</div>' +
        '</form>';
      document.getElementById('modalWrap').style.display = 'grid';
    }

    function openEditBoatModal(boatId) {
      const boat = allBoats.find(b => b.id === boatId);
      if (boat) openBoatModal({ ...boat, boat_id: boat.id });
    }

    async function submitBoatModal(e, boatId) {
      e.preventDefault();
      const action = boatId ? 'edit_boat' : 'create_boat';
      const leadInput = document.getElementById('b_lead_id');
      const res = await fetch('/api/dashboard?action=' + action, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boat_id: boatId,
          lead_id: leadInput ? Number(leadInput.value) : null,
          title: document.getElementById('b_title').value,
          hin: document.getElementById('b_hin').value,
          year: document.getElementById('b_year').value || null,
          length_ft: document.getElementById('b_length').value || null,
          location_city: document.getElementById('b_city').value,
          location_state: document.getElementById('b_state').value,
          status: document.getElementById('b_status').value
        })
      });
      if (res.ok) { closeModal(); loadData(); } else { alert('Failed to save vessel'); }
    }

    function openAddListingModal(boatId) {
      const content = document.getElementById('modalContent');
      content.innerHTML = '<h3>Add or Relist eBay Listing (Boat #' + boatId + ')</h3>' +
        '<form onsubmit="submitAddListing(event, ' + boatId + ')">' +
          '<label>eBay Item ID</label><input type="text" id="l_item_id" placeholder="e.g. 123456789012" required>' +
          '<label>Starting / List Price ($)</label><input type="number" id="l_price" placeholder="e.g. 2500">' +
          '<label><input type="checkbox" id="l_is_relist" checked> Mark prior active listings as Relisted</label>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-sm" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn-sm primary">Save eBay Listing</button>' +
          '</div>' +
        '</form>';
      document.getElementById('modalWrap').style.display = 'grid';
    }

    async function submitAddListing(e, boatId) {
      e.preventDefault();
      const res = await fetch('/api/dashboard?action=add_ebay_listing', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boat_id: boatId,
          ebay_item_id: document.getElementById('l_item_id').value,
          starting_price: document.getElementById('l_price').value || null,
          is_relist: document.getElementById('l_is_relist').checked
        })
      });
      if (res.ok) { closeModal(); loadData(); } else { alert('Failed to add listing'); }
    }

    function openRecordSaleModal(boatId) {
      const content = document.getElementById('modalContent');
      content.innerHTML = '<h3>Record Final Sale for Boat #' + boatId + '</h3>' +
        '<p style="color:#b91c1c;font-size:0.85rem;">Note: Exactly ONE sale can be recorded per boat (deduplicated against relists).</p>' +
        '<form onsubmit="submitRecordSale(event, ' + boatId + ')">' +
          '<label>Final Gross Sale Amount ($)</label><input type="number" id="s_amount" step="0.01" placeholder="e.g. 4500.00" required>' +
          '<label>Sale Date</label><input type="date" id="s_date" value="' + new Date().toISOString().slice(0, 10) + '">' +
          '<label><input type="checkbox" id="s_1098c" checked> IRS Form 1098-C Issued</label>' +
          '<label>Notes</label><textarea id="s_notes"></textarea>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-sm" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn-sm primary">Record Final Sale</button>' +
          '</div>' +
        '</form>';
      document.getElementById('modalWrap').style.display = 'grid';
    }

    async function submitRecordSale(e, boatId) {
      e.preventDefault();
      const res = await fetch('/api/dashboard?action=record_sale', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          boat_id: boatId,
          sale_amount: document.getElementById('s_amount').value,
          sale_date: document.getElementById('s_date').value,
          form_1098c_issued: document.getElementById('s_1098c').checked,
          notes: document.getElementById('s_notes').value
        })
      });
      if (res.ok) { closeModal(); loadData(); } else { const d = await res.json(); alert(d.error || 'Failed to record sale'); }
    }

    // SECURE GOOGLE ADS CSV EXPORT
    async function exportConversionsSecure() {
      try {
        const res = await fetch('/api/export-conversions?format=csv', { headers });
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'google_ads_conversions_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        alert('Failed to export conversions: ' + err.message);
      }
    }

    async function logout() {
      await fetch('/api/admin-logout', { method: 'POST', headers, credentials: 'same-origin' });
      window.location.replace('/admin/dashboard');
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
