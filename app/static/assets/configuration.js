(() => {
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: #${id}`);
    return el;
  }

  const els = {
    conn: $('cfgConn'),
    user: $('cfgUser'),
    err: $('cfgErr'),

    notifyCard: document.getElementById('cfgNotifyCard'),
    notifyForm: document.getElementById('cfgNotifyForm'),
    notifyErr: document.getElementById('cfgNotifyErr'),
    notifyMsg: document.getElementById('cfgNotifyMsg'),
    slackWebhook: document.getElementById('cfgSlackWebhook'),
    slackChannel: document.getElementById('cfgSlackChannel'),
    slackSeverity: document.getElementById('cfgSlackSeverity'),
    slackCooldown: document.getElementById('cfgSlackCooldown'),
    slackTestBtn: document.getElementById('cfgSlackTestBtn'),
    smtpHost: document.getElementById('cfgSmtpHost'),
    smtpPort: document.getElementById('cfgSmtpPort'),
    smtpUsername: document.getElementById('cfgSmtpUsername'),
    smtpPassword: document.getElementById('cfgSmtpPassword'),
    smtpFrom: document.getElementById('cfgSmtpFrom'),
    smtpUseTls: document.getElementById('cfgSmtpUseTls'),
    alertEmailTo: document.getElementById('cfgAlertEmailTo'),
    emailSeverity: document.getElementById('cfgEmailSeverity'),
    emailCooldown: document.getElementById('cfgEmailCooldown'),
    emailTestBtn: document.getElementById('cfgEmailTestBtn'),
    notifySaveBtn: document.getElementById('cfgNotifySaveBtn'),
    testAllBtn: document.getElementById('cfgTestAllBtn'),

    teamsWebhook: document.getElementById('cfgTeamsWebhook'),
    teamsSeverity: document.getElementById('cfgTeamsSeverity'),
    teamsCooldown: document.getElementById('cfgTeamsCooldown'),
    teamsTestBtn: document.getElementById('cfgTeamsTestBtn'),

    discordWebhook: document.getElementById('cfgDiscordWebhook'),
    discordSeverity: document.getElementById('cfgDiscordSeverity'),
    discordCooldown: document.getElementById('cfgDiscordCooldown'),
    discordTestBtn: document.getElementById('cfgDiscordTestBtn'),

    pagerdutyRoutingKey: document.getElementById('cfgPagerdutyRoutingKey'),
    pagerdutySeverity: document.getElementById('cfgPagerdutySeverity'),
    pagerdutyCooldown: document.getElementById('cfgPagerdutyCooldown'),
    pagerdutyTestBtn: document.getElementById('cfgPagerdutyTestBtn'),

    sideNav: document.getElementById('sideNav'),
    sideSearch: document.getElementById('sideSearch'),
  };

  function setErr(msg) {
    if (!msg) {
      els.err.style.display = 'none';
      els.err.textContent = '';
      return;
    }
    els.err.style.display = '';
    els.err.textContent = String(msg);
  }

  async function fetchJson(url, opts) {
    const r = await fetch(url, opts);
    if (r.status === 401) {
      try {
        location.href = '/login';
      } catch (_) {
        // ignore
      }
      throw new Error('Not authenticated');
    }
    let data = null;
    try {
      data = await r.json();
    } catch (_) {
      data = null;
    }
    if (!r.ok) {
      const msg = data && data.detail ? String(data.detail) : `HTTP ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt == null ? '—' : String(txt);
  }

  function setNotifyErr(msg) {
    if (!els.notifyErr) return;
    if (!msg) {
      els.notifyErr.style.display = 'none';
      els.notifyErr.textContent = '';
      return;
    }
    els.notifyErr.style.display = '';
    els.notifyErr.textContent = String(msg);
  }

  function setNotifyMsg(msg) {
    if (!els.notifyMsg) return;
    if (!msg) {
      els.notifyMsg.style.display = 'none';
      els.notifyMsg.textContent = '';
      return;
    }
    els.notifyMsg.style.display = '';
    els.notifyMsg.textContent = String(msg);
  }

  function fillNotifyForm(cfg) {
    if (!cfg) return;
    els.slackWebhook.value = cfg.slack_webhook_url || '';
    els.slackChannel.value = cfg.slack_channel || '';
    els.slackSeverity.value = cfg.slack_alert_min_severity || 'crit';
    els.slackCooldown.value = cfg.slack_alert_cooldown_seconds ?? 600;
    els.smtpHost.value = cfg.smtp_host || '';
    els.smtpPort.value = cfg.smtp_port ?? 587;
    els.smtpUsername.value = cfg.smtp_username || '';
    els.smtpPassword.value = '';
    els.smtpPassword.placeholder = cfg.smtp_password ? '(unchanged — currently set)' : '(not set)';
    els.smtpFrom.value = cfg.smtp_from_addr || '';
    els.smtpUseTls.value = cfg.smtp_use_tls ? '1' : '0';
    els.alertEmailTo.value = cfg.alert_email_to || '';
    els.emailSeverity.value = cfg.email_alert_min_severity || 'crit';
    els.emailCooldown.value = cfg.email_alert_cooldown_seconds ?? 600;

    els.teamsWebhook.value = cfg.teams_webhook_url || '';
    els.teamsSeverity.value = cfg.teams_alert_min_severity || 'crit';
    els.teamsCooldown.value = cfg.teams_alert_cooldown_seconds ?? 600;

    els.discordWebhook.value = cfg.discord_webhook_url || '';
    els.discordSeverity.value = cfg.discord_alert_min_severity || 'crit';
    els.discordCooldown.value = cfg.discord_alert_cooldown_seconds ?? 600;

    els.pagerdutyRoutingKey.value = '';
    els.pagerdutyRoutingKey.placeholder = cfg.pagerduty_routing_key ? '(unchanged — currently set)' : '(not set)';
    els.pagerdutySeverity.value = cfg.pagerduty_alert_min_severity || 'crit';
    els.pagerdutyCooldown.value = cfg.pagerduty_alert_cooldown_seconds ?? 600;
  }

  async function loadNotifyConfig() {
    const cfg = await fetchJson('/api/admin/notifications/config');
    fillNotifyForm(cfg);
  }

  async function saveNotifyConfig(e) {
    e.preventDefault();
    setNotifyErr('');
    setNotifyMsg('');
    const body = {
      slack_webhook_url: els.slackWebhook.value.trim(),
      slack_channel: els.slackChannel.value.trim(),
      slack_alert_min_severity: els.slackSeverity.value,
      slack_alert_cooldown_seconds: parseInt(els.slackCooldown.value, 10) || 0,
      smtp_host: els.smtpHost.value.trim(),
      smtp_port: parseInt(els.smtpPort.value, 10) || 587,
      smtp_username: els.smtpUsername.value.trim(),
      smtp_use_tls: els.smtpUseTls.value === '1',
      smtp_from_addr: els.smtpFrom.value.trim(),
      alert_email_to: els.alertEmailTo.value.trim(),
      email_alert_min_severity: els.emailSeverity.value,
      email_alert_cooldown_seconds: parseInt(els.emailCooldown.value, 10) || 0,
      teams_webhook_url: els.teamsWebhook.value.trim(),
      teams_alert_min_severity: els.teamsSeverity.value,
      teams_alert_cooldown_seconds: parseInt(els.teamsCooldown.value, 10) || 0,
      discord_webhook_url: els.discordWebhook.value.trim(),
      discord_alert_min_severity: els.discordSeverity.value,
      discord_alert_cooldown_seconds: parseInt(els.discordCooldown.value, 10) || 0,
      pagerduty_alert_min_severity: els.pagerdutySeverity.value,
      pagerduty_alert_cooldown_seconds: parseInt(els.pagerdutyCooldown.value, 10) || 0,
    };
    // Only send secrets if the user typed a new value.
    if (els.smtpPassword.value) body.smtp_password = els.smtpPassword.value;
    if (els.pagerdutyRoutingKey.value) body.pagerduty_routing_key = els.pagerdutyRoutingKey.value;

    try {
      const cfg = await fetchJson('/api/admin/notifications/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      fillNotifyForm(cfg);
      setNotifyMsg('Saved.');
    } catch (err) {
      setNotifyErr(err && err.message ? err.message : 'Failed to save notification settings');
    }
  }

  async function sendTestNotification(url, btn, label) {
    setNotifyErr('');
    setNotifyMsg('');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setNotifyMsg(`${label} sent.`);
    } catch (err) {
      setNotifyErr(err && err.message ? err.message : `Failed to send ${label.toLowerCase()}`);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function testAllChannels() {
    setNotifyErr('');
    setNotifyMsg('');
    const btn = els.testAllBtn;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const data = await fetchJson('/api/admin/notifications/test-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const parts = Object.entries(data.results || {}).map(
        ([channel, r]) => `${channel}: ${r.sent ? 'ok' : 'failed'}`
      );
      setNotifyMsg(parts.length ? `Test results — ${parts.join(', ')}` : 'No channels configured.');
    } catch (err) {
      setNotifyErr(err && err.message ? err.message : 'Failed to test channels');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function setupNotifyForm() {
    if (els.notifyForm) els.notifyForm.addEventListener('submit', saveNotifyConfig);
    if (els.slackTestBtn) {
      els.slackTestBtn.addEventListener('click', () =>
        sendTestNotification('/api/admin/notifications/slack-test', els.slackTestBtn, 'Slack test message')
      );
    }
    if (els.emailTestBtn) {
      els.emailTestBtn.addEventListener('click', () =>
        sendTestNotification('/api/admin/notifications/email-test', els.emailTestBtn, 'Test email')
      );
    }
    if (els.teamsTestBtn) {
      els.teamsTestBtn.addEventListener('click', () =>
        sendTestNotification('/api/admin/notifications/teams-test', els.teamsTestBtn, 'Teams test message')
      );
    }
    if (els.discordTestBtn) {
      els.discordTestBtn.addEventListener('click', () =>
        sendTestNotification('/api/admin/notifications/discord-test', els.discordTestBtn, 'Discord test message')
      );
    }
    if (els.pagerdutyTestBtn) {
      els.pagerdutyTestBtn.addEventListener('click', () =>
        sendTestNotification('/api/admin/notifications/pagerduty-test', els.pagerdutyTestBtn, 'PagerDuty test alert')
      );
    }
    if (els.testAllBtn) {
      els.testAllBtn.addEventListener('click', testAllChannels);
    }
  }

  function setupSidebarSearch() {
    if (!els.sideSearch || !els.sideNav) return;
    els.sideSearch.addEventListener('input', () => {
      const q = (els.sideSearch.value || '').trim().toLowerCase();
      const items = els.sideNav.querySelectorAll('.sideItem');
      for (const it of items) {
        const label = (it.getAttribute('data-label') || it.textContent || '').toLowerCase();
        it.style.display = !q || label.includes(q) ? '' : 'none';
      }
      const groups = els.sideNav.querySelectorAll('.sideGroup');
      for (const g of groups) {
        const anyVisible = Array.from(g.querySelectorAll('.sideItem')).some((a) => a.style.display !== 'none');
        g.style.display = anyVisible ? '' : 'none';
      }
    });
  }

  async function init() {
    els.conn.textContent = 'loading…';
    setupSidebarSearch();
    setupNotifyForm();

    try {
      const me = await fetchJson('/api/me');

      setText(els.user, me && me.username ? me.username : '—');

      if (els.notifyCard) {
        if (me && me.role === 'admin') {
          els.notifyCard.style.display = '';
          await loadNotifyConfig();
        } else {
          setErr('Admin access required to manage alert notifications.');
        }
      }

      els.conn.textContent = 'ready';
    } catch (e) {
      els.conn.textContent = 'error';
      setErr(e && e.message ? e.message : 'Failed to load configuration');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
