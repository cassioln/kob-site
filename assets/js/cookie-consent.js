(function initKOBCookieConsent() {
  'use strict';

  if (window.KOBCookieConsent && window.KOBCookieConsent.initialized) return;

  var STORAGE_KEY = 'cookie_consent_status';
  var PREFERENCES_KEY = 'cookie_consent_preferences';
  var COOKIE_MAX_AGE = 31536000;
  var SERVICE_GA4 = 'google-analytics-4';
  var banner = document.querySelector('[data-cookie-consent]');

  if (!banner) return;

  var acceptButton = banner.querySelector('[data-cookie-action="accept"]');
  var denyButton = banner.querySelector('[data-cookie-action="deny"]');
  var saveButton = banner.querySelector('[data-cookie-action="save"]');
  var customizeButton = banner.querySelector('[data-cookie-customize]');
  var customizeLabel = customizeButton ? customizeButton.querySelector('span') : null;
  var preferencesPanel = banner.querySelector('[data-cookie-panel]');
  var preferencesTitle = banner.querySelector('[data-cookie-preferences-title]');
  var analyticsCategoryToggle = banner.querySelector('[data-cookie-category="analytics"]');
  var analyticsCategoryStatus = banner.querySelector('[data-cookie-category-status="analytics"]');
  var analyticsServiceToggles = Array.prototype.slice.call(banner.querySelectorAll('[data-cookie-service]'));
  var title = banner.querySelector('[data-cookie-title]');
  var statusMessage = document.getElementById('cookie-consent-status');
  var preferenceTriggers = Array.prototype.slice.call(document.querySelectorAll('[data-cookie-preferences]'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSubmitting = false;
  var closeTimer = null;
  var lastTrigger = null;

  function normalizeStatus(value) {
    return value === 'accepted' || value === 'denied' ? value : null;
  }

  function readCookieStatus() {
    var escapedKey = STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var match = document.cookie.match(new RegExp('(?:^|;\\s*)' + escapedKey + '=([^;]*)'));
    return match ? normalizeStatus(decodeURIComponent(match[1])) : null;
  }

  function readLocalStatus() {
    try {
      return normalizeStatus(window.localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      return null;
    }
  }

  function normalizeServices(saved, status) {
    var fallback = status === 'accepted';
    var savedServices = saved && saved.services;
    var ga4 = savedServices && typeof savedServices[SERVICE_GA4] === 'boolean'
      ? savedServices[SERVICE_GA4]
      : saved && typeof saved.analytics === 'boolean'
        ? saved.analytics
        : fallback;

    var services = {};
    services[SERVICE_GA4] = ga4;
    return services;
  }

  function buildConsentState(status, updatedAt, services) {
    var normalized = normalizeStatus(status);
    var normalizedServices = normalizeServices({ services: services }, normalized);
    var analytics = normalizedServices[SERVICE_GA4] === true;

    return {
      status: normalized ? (analytics ? 'accepted' : 'denied') : null,
      necessary: true,
      analytics: analytics,
      marketing: false,
      services: normalizedServices,
      updatedAt: updatedAt || null,
      version: 2
    };
  }

  function readSavedPreferences(status) {
    try {
      var saved = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY));
      if (!saved || saved.status !== status || saved.necessary !== true) return null;
      return buildConsentState(status, saved.updatedAt, normalizeServices(saved, status));
    } catch (error) {
      return null;
    }
  }

  function getConsentState() {
    var status = readLocalStatus() || readCookieStatus();
    if (!status) return buildConsentState(null, null, null);
    return readSavedPreferences(status) || buildConsentState(status, null, null);
  }

  function writeConsentCookie(status) {
    var attributes = '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax';
    if (window.location.protocol === 'https:') attributes += '; Secure';
    document.cookie = STORAGE_KEY + '=' + encodeURIComponent(status) + attributes;
  }

  function setConsentState(status, services) {
    var normalized = normalizeStatus(status);
    if (!normalized) throw new Error('Estado de consentimento inválido.');

    var state = buildConsentState(normalized, new Date().toISOString(), services);

    try {
      window.localStorage.setItem(STORAGE_KEY, state.status);
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state));
    } catch (error) {
      // O cookie próprio mantém a escolha quando o armazenamento local está indisponível.
    }

    try {
      writeConsentCookie(state.status);
    } catch (error) {
      // A interface continua funcional mesmo quando todo armazenamento está bloqueado.
    }

    return state;
  }

  function pushConsentAcceptedEvent() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'cookie_consent_accepted'
    });
  }

  function pushConsentDeniedEvent() {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'cookie_consent_denied'
    });
  }

  function pushPreferencesUpdatedEvent(state, source) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'cookie_preferences_updated',
      cookie_consent_source: source,
      cookie_consent_necessary: true,
      cookie_consent_analytics: state.analytics,
      cookie_consent_marketing: false,
      cookie_consent_service_google_analytics_4: state.services[SERVICE_GA4]
    });
  }

  function pushConsentRestoredEvent(state) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'cookie_consent_restored',
      cookie_consent_status: state.status,
      cookie_consent_analytics: state.analytics,
      cookie_consent_marketing: false,
      cookie_consent_service_google_analytics_4: state.services[SERVICE_GA4]
    });
  }

  function queueConsentRestoredEvent(state) {
    var pushed = false;

    function restoreConsent() {
      if (pushed) return;
      pushed = true;
      pushConsentRestoredEvent(state);
    }

    if (window.__kobGtmQueued) {
      restoreConsent();
      return;
    }
    window.addEventListener('kob:gtm-queued', restoreConsent, { once: true });
  }

  function announce(message) {
    if (statusMessage) statusMessage.textContent = message;
  }

  function setButtonsDisabled(disabled) {
    [acceptButton, denyButton, saveButton, customizeButton].forEach(function (button) {
      if (button) button.disabled = disabled;
    });

    if (analyticsCategoryToggle) analyticsCategoryToggle.disabled = disabled;
    analyticsServiceToggles.forEach(function (toggle) {
      toggle.disabled = disabled;
    });

    banner.setAttribute('aria-busy', disabled ? 'true' : 'false');
  }

  function getAnalyticsServicesSelection() {
    var services = {};
    analyticsServiceToggles.forEach(function (toggle) {
      services[toggle.dataset.cookieService] = toggle.checked;
    });
    if (typeof services[SERVICE_GA4] !== 'boolean') services[SERVICE_GA4] = false;
    return services;
  }

  function updateAnalyticsCategoryFromServices() {
    if (!analyticsCategoryToggle) return;

    var selectedCount = analyticsServiceToggles.filter(function (toggle) {
      return toggle.checked;
    }).length;
    var total = analyticsServiceToggles.length;

    analyticsCategoryToggle.checked = total > 0 && selectedCount === total;
    analyticsCategoryToggle.indeterminate = selectedCount > 0 && selectedCount < total;

    if (!analyticsCategoryStatus) return;
    if (analyticsCategoryToggle.indeterminate) {
      analyticsCategoryStatus.textContent = 'Opcional · parcialmente ativa';
    } else if (analyticsCategoryToggle.checked) {
      analyticsCategoryStatus.textContent = 'Opcional · ativada';
    } else {
      analyticsCategoryStatus.textContent = 'Opcional · desativada';
    }
  }

  function syncControlsFromState(state) {
    analyticsServiceToggles.forEach(function (toggle) {
      var serviceValue = state.services && typeof state.services[toggle.dataset.cookieService] === 'boolean'
        ? state.services[toggle.dataset.cookieService]
        : state.analytics;
      toggle.checked = serviceValue;
    });
    updateAnalyticsCategoryFromServices();
  }

  function setPreferencesExpanded(expanded, focusTitle) {
    if (!preferencesPanel || !customizeButton) return;

    preferencesPanel.hidden = !expanded;
    customizeButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    banner.dataset.preferencesState = expanded ? 'open' : 'closed';
    if (customizeLabel) customizeLabel.textContent = expanded ? 'Voltar ao resumo' : 'Personalizar cookies';

    if (expanded) syncControlsFromState(getConsentState());
    if (expanded && focusTitle && preferencesTitle) {
      window.requestAnimationFrame(function () {
        preferencesTitle.focus({ preventScroll: true });
      });
    }
  }

  function finishClose(restoreFocus) {
    banner.hidden = true;
    setPreferencesExpanded(false, false);
    isSubmitting = false;
    setButtonsDisabled(false);

    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function closeCookieBanner(options) {
    var settings = options || {};
    window.clearTimeout(closeTimer);
    banner.dataset.state = 'closed';
    banner.setAttribute('aria-hidden', 'true');
    closeTimer = window.setTimeout(function () {
      finishClose(settings.restoreFocus !== false);
    }, reduceMotion ? 0 : 280);
  }

  function openCookiePreferences(options) {
    var settings = options || {};
    window.clearTimeout(closeTimer);
    isSubmitting = false;
    setButtonsDisabled(false);
    syncControlsFromState(getConsentState());
    setPreferencesExpanded(settings.expanded === true, false);
    banner.hidden = false;
    banner.removeAttribute('aria-hidden');

    window.requestAnimationFrame(function () {
      banner.dataset.state = 'open';
      if (settings.focus !== false) {
        var focusTarget = settings.expanded === true && preferencesTitle ? preferencesTitle : title;
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      }
    });
  }

  function commitConsent(analyticsAllowed, source) {
    if (isSubmitting) return;
    isSubmitting = true;
    setButtonsDisabled(true);

    var previousState = getConsentState();
    var services = getAnalyticsServicesSelection();
    services[SERVICE_GA4] = analyticsAllowed;
    var state = setConsentState(analyticsAllowed ? 'accepted' : 'denied', services);

    if (previousState.status !== state.status) {
      if (state.status === 'accepted') pushConsentAcceptedEvent();
      else pushConsentDeniedEvent();
    }

    pushPreferencesUpdatedEvent(state, source);

    if (source === 'custom') {
      announce(state.analytics
        ? 'Preferências salvas. Google Analytics 4 foi autorizado.'
        : 'Preferências salvas. Apenas cookies necessários serão usados.');
    } else if (state.analytics) {
      announce(previousState.status === 'accepted'
        ? 'Sua preferência por cookies de análise foi mantida.'
        : 'Cookies de análise aceitos. Sua preferência foi salva.');
    } else {
      announce(previousState.status === 'denied'
        ? 'Sua preferência por apenas cookies necessários foi mantida.'
        : 'Apenas cookies necessários serão usados. Sua preferência foi salva.');
    }

    closeCookieBanner();
  }

  function acceptConsent() {
    commitConsent(true, 'accept-all-analytics');
  }

  function denyConsent() {
    commitConsent(false, 'essential-only');
  }

  function saveCustomPreferences() {
    var services = getAnalyticsServicesSelection();
    commitConsent(services[SERVICE_GA4] === true, 'custom');
  }

  if (acceptButton) acceptButton.addEventListener('click', acceptConsent);
  if (denyButton) denyButton.addEventListener('click', denyConsent);
  if (saveButton) saveButton.addEventListener('click', saveCustomPreferences);

  if (customizeButton) {
    customizeButton.addEventListener('click', function () {
      var expanded = customizeButton.getAttribute('aria-expanded') !== 'true';
      setPreferencesExpanded(expanded, false);
    });
  }

  if (analyticsCategoryToggle) {
    analyticsCategoryToggle.addEventListener('change', function () {
      analyticsCategoryToggle.indeterminate = false;
      analyticsServiceToggles.forEach(function (toggle) {
        toggle.checked = analyticsCategoryToggle.checked;
      });
      updateAnalyticsCategoryFromServices();
    });
  }

  analyticsServiceToggles.forEach(function (toggle) {
    toggle.addEventListener('change', updateAnalyticsCategoryFromServices);
  });

  preferenceTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      lastTrigger = event.currentTarget;
      openCookiePreferences({ focus: true, expanded: true });
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || banner.hidden || banner.dataset.state !== 'open') return;
    event.preventDefault();

    if (banner.dataset.preferencesState === 'open') {
      setPreferencesExpanded(false, false);
      if (customizeButton) customizeButton.focus();
      return;
    }

    if (getConsentState().status) {
      announce('Preferência de cookies mantida.');
      closeCookieBanner();
    } else {
      denyConsent();
    }
  });

  window.KOBCookieConsent = {
    initialized: true,
    getConsentState: getConsentState,
    setConsentState: setConsentState,
    acceptConsent: acceptConsent,
    denyConsent: denyConsent,
    openCookiePreferences: function () {
      lastTrigger = document.activeElement;
      openCookiePreferences({ focus: true, expanded: true });
    },
    closeCookieBanner: closeCookieBanner,
    pushConsentAcceptedEvent: pushConsentAcceptedEvent
  };

  var initialState = getConsentState();
  if (initialState.status === 'accepted') {
    banner.hidden = true;
    queueConsentRestoredEvent(initialState);
  } else if (initialState.status === 'denied') {
    banner.hidden = true;
  } else {
    openCookiePreferences({ focus: false, expanded: false });
  }
})();
