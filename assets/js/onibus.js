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
  var passengerFields = document.getElementById('passenger-fields');
  var passengersFieldset = document.getElementById('passengers-fieldset');
  var stepHeading = document.getElementById('step-heading');
  var stepEyebrow = document.getElementById('step-eyebrow');
  var stepTitle = document.getElementById('form-title');
  var stepDescription = document.getElementById('step-description');
  var currentStep = 'cadastro';
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
  var confirmationPanel = document.getElementById('confirmation-panel');
  var confirmedAmount = document.getElementById('confirmed-amount');
  var confirmedCode = document.getElementById('confirmed-code');
  var confirmedPassengers = document.getElementById('confirmed-passengers');
  var confirmedChildren = document.getElementById('confirmed-children');
  var confirmedIssued = document.getElementById('confirmed-issued');
  var confirmedOrder = document.getElementById('confirmed-order');
  var stillHereDialog = document.getElementById('still-here-dialog');
  var stillHereContinue = document.getElementById('still-here-continue');
  var stillHereCancel = document.getElementById('still-here-cancel');
  var printConfirmation = document.getElementById('print-confirmation');
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

  // Cabeçalho por etapa: o texto acompanha o passo atual em vez de continuar
  // pedindo dados de passageiro quando a pessoa já está pagando ou já confirmou.
  var STEP_COPY = {
    cadastro: {
      eyebrow: 'Etapa 1 de 3 · Cadastro',
      title: 'Quem vai embarcar com você?',
      description: 'Comece pelo contato principal. Depois, informe o nome completo e o CPF de cada pessoa do grupo, incluindo você.'
    },
    pagamento: {
      eyebrow: 'Etapa 2 de 3 · Pagamento',
      title: 'Falta pouco: pague com Pix',
      description: 'Abra o app do seu banco e escaneie o QR Code, ou use o Pix Copia e Cola. A confirmação aparece aqui automaticamente.'
    },
    confirmacao: {
      eyebrow: 'Etapa 3 de 3 · Confirmação',
      title: 'Sua vaga está garantida',
      description: 'Pagamento confirmado e assentos reservados. Guarde o código da reserva — é ele que identifica seu grupo no embarque.'
    }
  };

  function setStep(step) {
    var copy = STEP_COPY[step];
    if (!copy) return;
    if (stepEyebrow) stepEyebrow.textContent = copy.eyebrow;
    if (stepTitle) stepTitle.textContent = copy.title;
    if (stepDescription) stepDescription.textContent = copy.description;
    // Expõe a etapa no DOM para estilizar sem depender da ordem dos elementos.
    if (stepHeading) stepHeading.dataset.step = step;
    currentStep = step;
    if (step === 'cadastro') syncStepDescription();
  }

  // No cadastro, a descrição depende do tamanho do grupo: com 1 passageiro o
  // bloco "Dados dos passageiros" não existe, então prometer "informe o CPF de
  // cada pessoa do grupo" descreve uma etapa que a pessoa não vai encontrar.
  function syncStepDescription() {
    if (!stepDescription || currentStep !== 'cadastro') return;
    var count = Math.max(1, Number(passengerCount.value) || 1);
    stepDescription.textContent = count === 1
      ? 'Você viaja sozinho(a): basta preencher seus dados de contato abaixo. Se mudar de ideia, aumente o tamanho do grupo.'
      : STEP_COPY.cadastro.description;
  }

  function readPassengerValues() {
    Array.prototype.slice.call(passengerFields.querySelectorAll('[data-passenger-position]')).forEach(function (field) {
      var position = field.dataset.passengerPosition;
      var wa = field.querySelector('[data-passenger-whatsapp]');
      savedPassengers[position] = {
        fullName: field.querySelector('[data-passenger-name]').value,
        cpf: field.querySelector('[data-passenger-cpf]').value,
        whatsapp: wa ? wa.value : ''
      };
    });
  }

  function renderPassengers() {
    readPassengerValues();
    var count = Math.max(1, Math.min(100, Number(passengerCount.value) || 1));
    passengerCount.value = count;
    passengerFields.replaceChildren();

    for (var position = 2; position <= count; position += 1) {
      var values = savedPassengers[position] || { fullName: '', cpf: '', whatsapp: '' };
      var wrapper = document.createElement('div');
      wrapper.className = 'bus-passenger';
      wrapper.dataset.passengerPosition = position;
      wrapper.innerHTML = '<div class="bus-passenger__title"><span>Passageiro ' + position + '</span><small>Nome e CPF obrigatórios</small></div>'
        + '<div class="bus-form__grid">'
        + '<div class="bus-field bus-field--wide"><label for="passenger-' + position + '-name">Nome completo do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-name" aria-label="Nome completo do passageiro ' + position + '" data-passenger-name type="text" autocomplete="off" minlength="3" required></div>'
        + '<div class="bus-field"><label for="passenger-' + position + '-cpf">CPF do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-cpf" aria-label="CPF do passageiro ' + position + '" data-passenger-cpf type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required></div>'
        // WhatsApp opcional: sem `required` e rotulado como opcional no próprio
        // label, para a pessoa não travar achando que precisa preencher.
        + '<div class="bus-field"><label for="passenger-' + position + '-whatsapp">WhatsApp do passageiro ' + position + ' <small>(opcional)</small></label>'
        + '<input id="passenger-' + position + '-whatsapp" aria-label="WhatsApp do passageiro ' + position + ' (opcional)" data-passenger-whatsapp type="tel" inputmode="tel" autocomplete="off" maxlength="15" placeholder="(11) 90000-0000"></div>'
        + '</div>';
      passengerFields.appendChild(wrapper);
      wrapper.querySelector('[data-passenger-name]').value = values.fullName || '';
      wrapper.querySelector('[data-passenger-cpf]').value = maskCpf(values.cpf || '');
      wrapper.querySelector('[data-passenger-cpf]').addEventListener('input', function (event) {
        event.currentTarget.value = maskCpf(event.currentTarget.value);
      });
      var waField = wrapper.querySelector('[data-passenger-whatsapp]');
      waField.value = maskWhatsapp(values.whatsapp || '');
      waField.addEventListener('input', function (event) {
        event.currentTarget.value = maskWhatsapp(event.currentTarget.value);
      });
    }

    var extra = count - 1;
    // Com 1 passageiro o bloco inteiro sai de cena: o contato principal já é o
    // passageiro 1, então um fieldset com um aviso de "você está sozinho" é
    // ruído. `hidden` remove da tela e da árvore de acessibilidade.
    if (passengersFieldset) {
      passengersFieldset.hidden = extra === 0;
    }
    syncStepDescription();
    updateSummary();
  }

  // Crianças de até 5 anos são ADICIONAIS ao grupo e não pagam: viajam no colo
  // de um pagante. Cada uma precisa de um colo disponível, então
  // `crianças <= pagantes`. Com 4 pagantes o máximo é 4 crianças (8 a bordo).
  //
  // O campo fica sempre visível: com 1 pagante ainda cabe 1 criança no colo.
  function syncChildrenLimit(count) {
    var maxChildren = Math.max(0, count);
    childrenCount.max = String(maxChildren);
    var current = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    var clamped = Math.min(current, maxChildren);
    if (String(clamped) !== childrenCount.value) childrenCount.value = clamped;
    childrenCount.disabled = false;
    return clamped;
  }

  function updateSummary() {
    var count = Math.max(1, Number(passengerCount.value) || 1);
    var children = syncChildrenLimit(count);
    // Todo o grupo informado paga; as crianças entram sem assento e sem custo.
    var paying = count;
    var amount = (paying * priceCents / 100).toFixed(2).replace('.', ',');
    summaryCount.textContent = displayCount(count + children, 'passageiro', 'passageiros');
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
    // Crianças não pagam e viajam no colo: cada uma precisa de um pagante.
    if (children > count) return invalid('As crianças de até 5 anos não podem passar do número de passageiros pagantes.', childrenCount);

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
      cpf: digits(primaryCpf.value),
      // O passageiro 1 É o contato principal, então o WhatsApp dele é o do
      // contato — enviado aqui também para que a lista de embarque tenha um
      // telefone por passageiro sem depender de join com bus_registrations.
      whatsapp: digits(primaryWhatsapp.value)
    }];
    for (var position = 2; position <= count; position += 1) {
      var waInput = document.getElementById('passenger-' + position + '-whatsapp');
      passengers.push({
        full_name: normalizeFullName(document.getElementById('passenger-' + position + '-name').value),
        cpf: digits(document.getElementById('passenger-' + position + '-cpf').value),
        whatsapp: waInput ? digits(waInput.value) : ''
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
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    function pad(value) { return value < 10 ? '0' + value : String(value); }
    return pad(minutes) + ':' + pad(seconds);
  }

  // Janela de atenção de 10 minutos, não a validade real do Pix.
  //
  // O código do Mercado Pago vale 24h (medido), mas "expira em 23h 59min" não
  // cria nenhum senso de urgência e o usuário abandona a aba com a vaga em
  // aberto. Contamos 10 minutos e, ao zerar, perguntamos se ele ainda está aí.
  //
  // O contador NÃO invalida nada: quem decide o estado da reserva é sempre o
  // servidor, via pollPaymentStatus(). Ao zerar, reconsultamos o servidor antes
  // de mostrar o aviso, para não alarmar quem já pagou nos últimos segundos.
  var ATTENTION_WINDOW_MS = 10 * 60 * 1000;
  var attentionDeadline = 0;

  function startExpiryCountdown(registrationId) {
    stopExpiryCountdown();
    attentionDeadline = Date.now() + ATTENTION_WINDOW_MS;

    function render() {
      var remaining = attentionDeadline - Date.now();
      if (remaining <= 0) {
        stopExpiryCountdown();
        pixExpiryCountdown.textContent = '00:00';
        pixExpiry.dataset.state = 'expired';
        // Pergunta ao servidor antes de alarmar: o pagamento pode ter caído
        // nos últimos segundos.
        pollPaymentStatus(registrationId, { onPending: openStillHereDialog });
        return;
      }
      pixExpiryCountdown.textContent = formatRemaining(remaining);
      pixExpiry.dataset.state = remaining < 2 * 60 * 1000 ? 'soon' : 'ok';
    }

    pixExpiry.hidden = false;
    render();
    expiryTimer = window.setInterval(render, 1000);
  }

  // Nomes vêm do que o próprio usuário acabou de digitar nesta sessão, não de
  // uma nova rota. Evita expor dados pessoais em GET /api/bus-registration-status,
  // que é consultado só com o UUID e continua devolvendo apenas o status.
  var confirmedSnapshot = null;

  function showConfirmation(data) {
    setStep('confirmacao');
    stopExpiryCountdown();
    closeStillHereDialog();
    window.clearTimeout(statusTimer);

    paymentPanel.hidden = true;
    confirmationPanel.hidden = false;

    var snap = confirmedSnapshot || {};
    confirmedAmount.textContent = snap.totalAmount ? 'R$ ' + String(snap.totalAmount).replace('.', ',') : '—';
    // Código curto e legível: o UUID inteiro não serve para ler no WhatsApp.
    confirmedCode.textContent = snap.registrationId
      ? String(snap.registrationId).split('-')[0].toUpperCase()
      : '—';

    if (confirmedOrder) {
      // Identificador da transação no provedor, para conferência no painel.
      confirmedOrder.textContent = snap.orderId || '—';
    }

    if (confirmedIssued) {
      // Data de emissão do comprovante, no fuso do usuário.
      confirmedIssued.textContent = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }

    confirmedPassengers.replaceChildren();
    (snap.passengers || []).forEach(function (name, index) {
      var item = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = name;
      var tag = document.createElement('small');
      tag.textContent = index === 0 ? 'Contato principal' : 'Passageiro ' + (index + 1);
      item.append(label, tag);
      confirmedPassengers.appendChild(item);
    });

    var kids = Number(snap.childrenCount || 0);
    if (kids > 0) {
      confirmedChildren.hidden = false;
      confirmedChildren.textContent = kids === 1
        ? '+ 1 criança de até 5 anos, no colo de um responsável (sem cobrança).'
        : '+ ' + kids + ' crianças de até 5 anos, no colo de um responsável (sem cobrança).';
    } else {
      confirmedChildren.hidden = true;
    }

    confirmationPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Move o foco para o título: leitores de tela anunciam a mudança de etapa.
    confirmationPanel.querySelector('#confirmed-title').setAttribute('tabindex', '-1');
    confirmationPanel.querySelector('#confirmed-title').focus({ preventScroll: true });
  }

  function openStillHereDialog() {
    if (!stillHereDialog || stillHereDialog.open) return;
    if (typeof stillHereDialog.showModal === 'function') {
      stillHereDialog.showModal();
    } else {
      stillHereDialog.setAttribute('open', '');
    }
  }

  function closeStillHereDialog() {
    if (!stillHereDialog || !stillHereDialog.open) return;
    if (typeof stillHereDialog.close === 'function') {
      stillHereDialog.close();
    } else {
      stillHereDialog.removeAttribute('open');
    }
  }

  function pollPaymentStatus(registrationId, options) {
    if (!registrationId) return;
    var onPending = options && options.onPending;
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
        showConfirmation(data);
        return;
      }
      if (['cancelled', 'refunded', 'payment_failed'].includes(data.status)) {
        paymentStatus.textContent = 'Este pagamento não está ativo. Entre em contato com a organização para receber orientação.';
        paymentPanel.dataset.paymentState = data.status;
        stopExpiryCountdown();
        return;
      }
      // Ainda pendente. Quando a janela de atenção zerou, é aqui que
      // perguntamos se a pessoa continua na página.
      if (onPending) {
        onPending();
        return;
      }
      statusTimer = window.setTimeout(function () { pollPaymentStatus(registrationId); }, 5000);
    }).catch(function () {
      statusTimer = window.setTimeout(function () { pollPaymentStatus(registrationId); }, 8000);
    });
  }

  function showPayment(payment) {
    activeRegistrationId = payment.registrationId;
    setStep('pagamento');
    // Guarda os nomes digitados agora para montar a confirmação depois, sem
    // precisar que o servidor devolva dados pessoais em uma consulta por UUID.
    confirmedSnapshot = {
      registrationId: payment.registrationId,
      orderId: payment.orderId,
      totalAmount: payment.totalAmount,
      childrenCount: Number(childrenCount.value || 0),
      passengers: getPayload().passengers.map(function (p) { return p.full_name; })
    };
    form.hidden = true;
    paymentPanel.hidden = false;
    pixQr.src = 'data:image/png;base64,' + payment.qrCodeBase64;
    pixCopyCode.value = payment.qrCode;
    if (payment.ticketUrl) {
      ticketLink.href = payment.ticketUrl;
      ticketLink.hidden = false;
    }
    paymentStatus.textContent = 'Aguardando pagamento. Não feche esta página até concluir a transferência.';
    startExpiryCountdown(payment.registrationId);
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

  // "Continuar pagamento": reabre a janela de 10 minutos e volta ao polling.
  if (stillHereContinue) {
    stillHereContinue.addEventListener('click', function () {
      closeStillHereDialog();
      startExpiryCountdown(activeRegistrationId);
      pollPaymentStatus(activeRegistrationId);
    });
  }

  // "Cancelar transação": só abandona a página. Não cancela nada no Mercado
  // Pago nem no banco — quem decide isso é o servidor, e a cobrança pode
  // continuar válida se a pessoa já tiver pagado.
  if (stillHereCancel) {
    stillHereCancel.addEventListener('click', function () {
      closeStillHereDialog();
      stopExpiryCountdown();
      window.clearTimeout(statusTimer);
      window.location.href = 'index.html';
    });
  }

  // Esc fecha o dialog nativo: tratamos como "continuar" para não deixar a
  // página parada sem contador nem polling.
  if (stillHereDialog) {
    stillHereDialog.addEventListener('close', function () {
      if (confirmationPanel && !confirmationPanel.hidden) return;
      if (!expiryTimer && activeRegistrationId) {
        startExpiryCountdown(activeRegistrationId);
        pollPaymentStatus(activeRegistrationId);
      }
    });
  }

  if (printConfirmation) {
    printConfirmation.addEventListener('click', function () { window.print(); });
  }
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

  setStep('cadastro');
  renderPassengers();
})();
