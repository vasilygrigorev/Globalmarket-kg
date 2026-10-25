(() => {
  "use strict";

  const measurementId = "G-9KZK8Y4S7K";
  const adsDestinationIds = ["AW-18474068233", "AW-18473846742"];
  const wholesaleLeadDestinations = [
    "AW-18473846742/i7tRCJa62pwdENaPgulE",
    "AW-18474068233/UR-oCOSq7oQdEInSj-lE",
  ];
  const storageKey = "gmk_google_consent_v1";
  let analyticsConfigured = false;

  function readConsent() {
    try { return localStorage.getItem(storageKey) || ""; } catch (_) { return ""; }
  }

  function writeConsent(value) {
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    document.cookie = `gmk_google_consent=${value}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  }

  function enableAnalytics() {
    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    if (analyticsConfigured) return;
    analyticsConfigured = true;
    window.gtag("config", measurementId, {
      anonymize_ip: true,
      allow_google_signals: true,
      allow_ad_personalization_signals: true,
      send_page_view: true,
    });
    adsDestinationIds.forEach((destinationId) => {
      window.gtag("config", destinationId, {
        allow_google_signals: true,
        allow_ad_personalization_signals: true,
      });
    });
  }

  function setConsent(value) {
    writeConsent(value);
    document.querySelectorAll(".gmk-consent").forEach((node) => { node.hidden = true; });
    if (value === "granted") {
      enableAnalytics();
      return;
    }
    window.gtag("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }

  window.gmkSetGoogleConsent = setConsent;
  window.gmkAnalyticsEvent = (name, params) => {
    if (readConsent() !== "granted") return;
    enableAnalytics();
    window.gtag("event", name, params || {});
  };

  window.gmkWholesaleLeadConversion = () => {
    if (readConsent() !== "granted") return;
    enableAnalytics();
    wholesaleLeadDestinations.forEach((destination) => {
      window.gtag("event", "conversion", {
        send_to: destination,
        value: 1,
        currency: "USD",
      });
    });
  };

  function productIdFrom(node) {
    if (!node || !node.dataset) return "";
    return node.dataset.add || node.dataset.modalAdd || node.dataset.freshAdd ||
      node.dataset.recentAdd || node.dataset.productLink || node.dataset.openProduct ||
      node.dataset.quickOrder || node.dataset.askProduct || node.dataset.shareProduct || "";
  }

  document.addEventListener("click", (event) => {
    const consentButton = event.target.closest("[data-consent]");
    if (consentButton) {
      setConsent(consentButton.dataset.consent);
      return;
    }
    const action = event.target.closest("[data-add],[data-modal-add],[data-fresh-add],[data-recent-add],[data-product-link],[data-open-product],[data-quick-order],[data-ask-product],[data-share-product],[data-wholesale-entry],#checkoutLink,#modalCheckoutLink");
    if (!action) return;
    const itemId = productIdFrom(action);
    const common = itemId ? { item_id: itemId } : {};
    if (action.matches("[data-add],[data-modal-add],[data-fresh-add],[data-recent-add]")) {
      window.gmkAnalyticsEvent("add_to_cart", common);
    } else if (action.matches("[data-product-link],[data-open-product]")) {
      window.gmkAnalyticsEvent("select_item", common);
    } else if (action.matches("#checkoutLink,#modalCheckoutLink")) {
      window.gmkAnalyticsEvent("begin_checkout");
    } else if (action.matches("[data-quick-order]")) {
      window.gmkAnalyticsEvent("generate_lead", { ...common, method: "quick_order_whatsapp" });
    } else if (action.matches("[data-ask-product]")) {
      window.gmkAnalyticsEvent("contact", { ...common, method: "product_whatsapp" });
    } else if (action.matches("[data-share-product]")) {
      window.gmkAnalyticsEvent("share", { ...common, method: "product_share" });
    } else if (action.matches("[data-wholesale-entry]")) {
      window.gmkAnalyticsEvent("select_content", {
        content_type: "wholesale_landing",
        item_id: "/opt/",
      });
    }
  }, true);

  document.addEventListener("submit", (event) => {
    if (event.target && event.target.id === "checkoutForm") {
      window.gmkAnalyticsEvent("checkout_submitted", { method: "site_checkout" });
    }
  }, true);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const init = args[1] || {};
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      const method = String(init.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
      if (method === "POST" && url.pathname === "/api/orders") {
        const result = await response.clone().json().catch(() => ({}));
        const submitted = response.ok && result && result.ok === true;
        window.gmkAnalyticsEvent(submitted ? "order_submitted" : "order_submit_failed", {
          order_code: submitted ? String(result.order_number || result.code || "") : "",
          transport: "site_api",
        });
      }
      if (method === "POST" && url.pathname === "/api/auth/request-otp") {
        window.gmkAnalyticsEvent(response.ok ? "sms_code_requested" : "sms_code_request_failed");
      }
      if (method === "POST" && url.pathname === "/api/auth/verify-otp") {
        window.gmkAnalyticsEvent(
          response.ok ? "login" : "sms_login_failed",
          response.ok ? { method: "sms" } : {},
        );
      }
    } catch (_) {}
    return response;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const consent = readConsent();
    if (consent === "granted") enableAnalytics();
    document.querySelectorAll(".gmk-consent").forEach((node) => {
      node.hidden = consent === "granted" || consent === "denied";
    });
  });
})();
