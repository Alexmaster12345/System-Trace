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
    };
    // Only send the password if the user typed a new one.
    if (els.smtpPassword.value) body.smtp_password = els.smtpPassword.value;

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
