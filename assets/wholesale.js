(() => {
  const form = document.querySelector("#wholesalePublicForm");
  const status = document.querySelector("#wholesalePublicStatus");
  const previewNote = document.querySelector("#wholesalePreviewNote");
  if (!form || !status) return;

  const isProduction = window.location.hostname === "globalmarket.kg";
  const attributionStorageKey = "globalMarketAttribution";
  if (!isProduction && previewNote) previewNote.hidden = false;

  function compact(value, limit = 500) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, limit) : "";
  }

  function readStoredAttribution() {
    try {
      return JSON.parse(localStorage.getItem(attributionStorageKey) || "{}") || {};
    } catch (_) {
      return {};
    }
  }

  function trackAttribution() {
    const params = new URLSearchParams(window.location.search);
    const next = { ...readStoredAttribution() };
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid"];
    const now = new Date().toISOString();
    let changed = false;
    keys.forEach((key) => {
      const value = compact(params.get(key), 300);
      if (!value) return;
      next[key] = value;
      changed = true;
    });
    const referrer = compact(document.referrer);
    if (referrer && (!next.referrer || changed)) next.referrer = referrer;
    if (!next.landing_path) next.landing_path = `${window.location.pathname}${window.location.search}`;
    if (!next.first_seen_at) next.first_seen_at = now;
    next.last_seen_at = now;
    try { localStorage.setItem(attributionStorageKey, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  const attribution = trackAttribution();

  function track(name, params = {}) {
    if (typeof window.gmkAnalyticsEvent === "function") {
      window.gmkAnalyticsEvent(name, params);
    }
  }

  function setStatus(message, state = "") {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-wholesale-action]");
    if (!action) return;
    const actionName = action.dataset.wholesaleAction;
    if (actionName === "whatsapp") {
      track("contact", { method: "wholesale_whatsapp", lead_type: "wholesale" });
      return;
    }
    track("select_content", {
      content_type: "wholesale",
      item_id: actionName || "wholesale_action",
    });
  });

  let formStarted = false;
  form.addEventListener("input", () => {
    if (formStarted) return;
    formStarted = true;
    track("wholesale_application_started", { method: "site_form" });
  }, { once: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submit = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const payload = {
      shop_name: String(data.get("shop_name") || "").trim(),
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      address: String(data.get("address") || "").trim(),
      comment: String(data.get("comment") || "").trim(),
      attribution,
    };

    if (!isProduction) {
      setStatus("Форма заполнена правильно. В тестовой версии заявка не отправлена.", "success");
      return;
    }

    submit.disabled = true;
    setStatus("Отправляем заявку...");
    try {
      const response = await fetch("/api/wholesale-application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "request_failed");
      track("generate_lead", { method: "site_form", lead_type: "wholesale_application" });
      if (typeof window.gmkWholesaleLeadConversion === "function") {
        window.gmkWholesaleLeadConversion();
      }
      form.reset();
      setStatus("Заявка отправлена. Менеджер свяжется с вами.", "success");
    } catch {
      track("wholesale_application_failed", { method: "site_form" });
      setStatus("Не получилось отправить заявку. Напишите менеджеру в WhatsApp.", "error");
    } finally {
      submit.disabled = false;
    }
  });
})();
