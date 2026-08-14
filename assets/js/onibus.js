(function initBusPaymentPage() {
  'use strict';

  var form = document.getElementById('bus-form');
  if (!form) return;

  var primaryName = document.getElementById('primary-name');
  var primaryCpf = document.getElementById('primary-cpf');
  var primaryEmail = document.getElementById('primary-email');
  var primaryWhatsapp = document.getElementById('primary-whatsapp');
  var passengerCount = document.getElementById('passenger-count');
  var childrenCount = document.getElementById('children-count');
  var childrenField = document.getElementById('children-field');
  var passengerFields = document.getElementById('passenger-fields');
  var total = document.getElementById('bus-total');
  var summaryCount = document.getElementById('bus-summary-count');
  var summaryPaying = document.getElementById('bus-summary-paying');
  var status = document.getElementById('bus-form-status');
  var submit = form.querySelector('button[type="submit"]');
  var paymentPanel = document.getElementById('payment-panel');
  var pixQr = document.getElementById('pix-qr');
  var pixCopyCode = document.getElementById('pix-copy-code');
  var copyPix = document.getElementById('copy-pix');
  var ticketLink = document.getElementById('pix-ticket-link');
  var paymentStatus = document.getElementById('payment-status');
  var pixExpiry = document.getElementById('pix-expiry');
  var pixExpiryCountdown = document.getElementById('pix-expiry-countdown');
  var priceCents = 12000;
  var savedPassengers = {};
  var statusTimer = null;
  var expiryTimer = null;
  var activeRegistrationId = null;

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function maskCpf(value) {
    var valueDigits = digits(value).slice(0, 11);
    if (valueDigits.length > 9) return valueDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    if (valueDigits.length > 6) return valueDigits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    if (valueDigits.length > 3) return valueDigits.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    return valueDigits;
  }

  function maskWhatsapp(value) {
    var valueDigits = digits(value).slice(0, 11);
    if (valueDigits.length > 10) return valueDigits.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
    if (valueDigits.length > 6) return valueDigits.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    if (valueDigits.length > 2) return valueDigits.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    return valueDigits;
  }

  function validCpf(value) {
    var cpf = digits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    var sum = 0;
    for (var i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
    var remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== Number(cpf[9])) return false;
    sum = 0;
    for (var j = 0; j < 10; j += 1) sum += Number(cpf[j]) * (11 - j);
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    return remainder === Number(cpf[10]);
  }

  function normalizeFullName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function displayCount(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : plural);
  }

  function readPassengerValues() {
    Array.prototype.slice.call(passengerFields.querySelectorAll('[data-passenger-position]')).forEach(function (field) {
      var position = field.dataset.passengerPosition;
      savedPassengers[position] = {
        fullName: field.querySelector('[data-passenger-name]').value,
        cpf: field.querySelector('[data-passenger-cpf]').value
      };
    });
  }

  function renderPassengers() {
    readPassengerValues();
    var count = Math.max(1, Math.min(100, Number(passengerCount.value) || 1));
    passengerCount.value = count;
    passengerFields.replaceChildren();

    for (var position = 2; position <= count; position += 1) {
      var values = savedPassengers[position] || { fullName: '', cpf: '' };
      var wrapper = document.createElement('div');
      wrapper.className = 'bus-passenger';
      wrapper.dataset.passengerPosition = position;
      wrapper.innerHTML = '<div class="bus-passenger__title"><span>Passageiro ' + position + '</span><small>Nome e CPF obrigatórios</small></div>'
        + '<div class="bus-form__grid">'
        + '<div class="bus-field bus-field--wide"><label for="passenger-' + position + '-name">Nome completo do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-name" aria-label="Nome completo do passageiro ' + position + '" data-passenger-name type="text" autocomplete="off" minlength="3" required></div>'
        + '<div class="bus-field"><label for="passenger-' + position + '-cpf">CPF do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-cpf" aria-label="CPF do passageiro ' + position + '" data-passenger-cpf type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required></div>'
        + '</div>';
      passengerFields.appendChild(wrapper);
      wrapper.querySelector('[data-passenger-name]').value = values.fullName || '';
      wrapper.querySelector('[data-passenger-cpf]').value = maskCpf(values.cpf || '');
      wrapper.querySelector('[data-passenger-cpf]').addEventListener('input', function (event) {
        event.currentTarget.value = maskCpf(event.currentTarget.value);
      });
    }

    var extra = count - 1;
    if (extra === 0) {
      passengerFields.innerHTML = '<p class="bus-fieldset__note">Você está viajando sozinho(a). O contato principal já é o passageiro 1.</p>';
    }
    updateSummary();
  }

  // Cada criança viaja no colo de um responsável, então precisa de um pagante
  // para si: crianças <= pagantes. Como pagantes = total - crianças, o limite
  // resolve para floor(total / 2). Ex.: 2 pessoas -> 1 criança; 5 -> 2.
  //
  // Abaixo de 2 pessoas não existe colo disponível, então o campo é escondido
  // em vez de ficar visível e travado em zero.
  function syncChildrenLimit(count) {
    var maxChildren = Math.floor(count / 2);
    var showField = count >= 2;

    if (childrenField) childrenField.hidden = !showField;

    childrenCount.max = String(maxChildren);
    var current = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    var clamped = Math.min(current, maxChildren);
    if (String(clamped) !== childrenCount.value) childrenCount.value = clamped;
    childrenCount.disabled = maxChildren === 0;
    return clamped;
  }

  function updateSummary() {
    var count = Math.max(1, Number(passengerCount.value) || 1);
    var children = syncChildrenLimit(count);
    var paying = Math.max(0, count - children);
    var amount = (paying * priceCents / 100).toFixed(2).replace('.', ',');
    summaryCount.textContent = displayCount(count, 'passageiro', 'passageiros');
    summaryPaying.textContent = displayCount(paying, 'passageiro', 'passageiros');
    total.textContent = 'R$ ' + amount;
  }

  function setStatus(message, isError) {
    status.textContent = message || '';
    status.dataset.state = isError ? 'error' : 'info';
  }

  function invalid(message, field) {
    setStatus(message, true);
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
    return false;
  }

  function clearInvalid() {
    Array.prototype.slice.call(form.querySelectorAll('[aria-invalid="true"]')).forEach(function (field) {
      field.removeAttribute('aria-invalid');
    });
  }

  function validateForm() {
    clearInvalid();
    var name = normalizeFullName(primaryName.value);
    if (name.split(' ').length < 2) return invalid('Informe o nome completo do contato principal.', primaryName);
    if (!validCpf(primaryCpf.value)) return invalid('Informe um CPF válido para o contato principal.', primaryCpf);
    if (!primaryEmail.validity.valid) return invalid('Informe um e-mail válido.', primaryEmail);
    if (digits(primaryWhatsapp.value).length !== 11) return invalid('Informe um WhatsApp válido com DDD.', primaryWhatsapp);

    var count = Number(passengerCount.value);
    var children = Number(childrenCount.value || 0);
    if (!Number.isInteger(count) || count < 1 || count > 100) return invalid('Informe entre 1 e 100 passageiros.', passengerCount);
    if (!Number.isInteger(children) || children < 0) return invalid('Quantidade de crianças inválida.', childrenCount);
    // Cada criança viaja no colo de um responsável: crianças <= pagantes.
    if (children > count - children) return invalid('Cada criança precisa de um passageiro pagante como responsável.', childrenCount);

    for (var position = 2; position <= count; position += 1) {
      var nameField = document.getElementById('passenger-' + position + '-name');
      var cpfField = document.getElementById('passenger-' + position + '-cpf');
      if (!nameField || normalizeFullName(nameField.value).split(' ').length < 2) {
        return invalid('Preencha os dados do passageiro ' + position + '.', nameField);
      }
      if (!cpfField || !validCpf(cpfField.value)) {
        return invalid('Informe um CPF válido para o passageiro ' + position + '.', cpfField);
      }
    }

    var terms = document.getElementById('bus-terms');
    if (!terms.checked) {
      setStatus('Leia e aceite as condições para continuar.', true);
      terms.focus();
      return false;
    }
    return true;
  }

  function getPayload() {
    var count = Number(passengerCount.value);
    var passengers = [{
      full_name: normalizeFullName(primaryName.value),
      cpf: digits(primaryCpf.value)
    }];
    for (var position = 2; position <= count; position += 1) {
      passengers.push({
        full_name: normalizeFullName(document.getElementById('passenger-' + position + '-name').value),
        cpf: digits(document.getElementById('passenger-' + position + '-cpf').value)
      });
    }
    return {
      contact: {
        full_name: normalizeFullName(primaryName.value),
        cpf: digits(primaryCpf.value),
        email: primaryEmail.value.trim(),
        whatsapp: digits(primaryWhatsapp.value)
      },
      passenger_count: count,
      children_count: Number(childrenCount.value || 0),
      passengers: passengers
    };
  }

  function createIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'kob-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function stopExpiryCountdown() {
    window.clearInterval(expiryTimer);
    expiryTimer = null;
  }

  function formatRemaining(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    function pad(value) { return value < 10 ? '0' + value : String(value); }
    if (hours > 0) return hours + 'h ' + pad(minutes) + 'min';
    if (minutes > 0) return minutes + 'min ' + pad(seconds) + 's';
    return seconds + 's';
  }

  // O Pix do Mercado Pago expira (medido: 24h após a criação). Sem isso o
  // usuário fica olhando um QR morto sem entender por que nada acontece.
  //
  // O countdown é apenas informativo: NUNCA confirma nem invalida a reserva por
  // conta própria. Quem decide o estado é sempre o servidor, via polling em
  // pollPaymentStatus(); aqui só exibimos tempo restante e, ao zerar, pedimos
  // uma nova consulta para o servidor dizer o que aconteceu de fato.
  function startExpiryCountdown(expiresAt, registrationId) {
    stopExpiryCountdown();
    if (!expiresAt) return;

    var deadline = new Date(expiresAt).getTime();
    if (!deadline || Number.isNaN(deadline)) return;

    function render() {
      var remaining = deadline - Date.now();
      if (remaining <= 0) {
        stopExpiryCountdown();
        pixExpiryCountdown.textContent = 'expirado';
        pixExpiry.dataset.state = 'expired';
        // Não decidimos nada localmente: perguntamos ao servidor.
        pollPaymentStatus(registrationId);
        return;
      }
      pixExpiryCountdown.textContent = formatRemaining(remaining);
      pixExpiry.dataset.state = remaining < 60 * 60 * 1000 ? 'soon' : 'ok';
    }

    pixExpiry.hidden = false;
    render();
    expiryTimer = window.setInterval(render, 1000);
  }

  function pollPaymentStatus(registrationId) {
    if (!registrationId) return;
    window.clearTimeout(statusTimer);
    fetch('/api/bus-registration-status?id=' + encodeURIComponent(registrationId), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('status-unavailable');
      return response.json();
    }).then(function (data) {
      if (data.status === 'confirmed') {
        paymentStatus.textContent = 'Pagamento identificado! Sua vaga está confirmada.';
        paymentPanel.dataset.paymentState = 'confirmed';
        // Pago: a validade do QR deixa de importar.
        stopExpiryCountdown();
        pixExpiry.hidden = true;
        return;
      }
      if (['cancelled', 'refunded', 'payment_failed'].includes(data.status)) {
        paymentStatus.textContent = 'Este pagamento não está ativo. Entre em contato com a organização para receber orientação.';
        paymentPanel.dataset.paymentState = data.status;
        stopExpiryCountdown();
        return;
      }
      statusTimer = window.setTimeout(function () { pollPaymentStatus(registrationId); }, 5000);
    }).catch(function () {
      statusTimer = window.setTimeout(function () { pollPaymentStatus(registrationId); }, 8000);
    });
  }

  function showPayment(payment) {
    activeRegistrationId = payment.registrationId;
    form.hidden = true;
    paymentPanel.hidden = false;
    pixQr.src = 'data:image/png;base64,' + payment.qrCodeBase64;
    pixCopyCode.value = payment.qrCode;
    if (payment.ticketUrl) {
      ticketLink.href = payment.ticketUrl;
      ticketLink.hidden = false;
    }
    paymentStatus.textContent = 'Aguardando pagamento. Não feche esta página até concluir a transferência.';
    startExpiryCountdown(payment.expiresAt, payment.registrationId);
    pollPaymentStatus(payment.registrationId);
    paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!validateForm()) return;

    submit.disabled = true;
    setStatus('Gerando seu Pix com segurança…', false);
    try {
      var response = await fetch('/api/create-pix-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey()
        },
        body: JSON.stringify(getPayload())
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o Pix.');
      showPayment(data);
    } catch (error) {
      setStatus(error.message || 'Não foi possível gerar o Pix. Tente novamente.', true);
      submit.disabled = false;
    }
  }

  primaryCpf.addEventListener('input', function (event) { event.currentTarget.value = maskCpf(event.currentTarget.value); });
  primaryWhatsapp.addEventListener('input', function (event) { event.currentTarget.value = maskWhatsapp(event.currentTarget.value); });
  passengerCount.addEventListener('input', renderPassengers);
  childrenCount.addEventListener('input', updateSummary);
  form.addEventListener('submit', submitForm);
  copyPix.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(pixCopyCode.value);
      paymentStatus.textContent = 'Código Pix copiado. Agora é só colar no app do seu banco.';
    } catch (_error) {
      pixCopyCode.focus();
      pixCopyCode.select();
      paymentStatus.textContent = 'Selecione e copie o código Pix manualmente.';
    }
  });

  renderPassengers();
})();
