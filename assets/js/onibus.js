(function initBusPaymentPage() {
  'use strict';

  var form = document.getElementById('bus-form');
  if (!form) return;

  var primaryName = document.getElementById('primary-name');
  var primaryCpf = document.getElementById('primary-cpf');
  var primaryAge = document.getElementById('primary-age');
  var primaryEmail = document.getElementById('primary-email');
  var primaryWhatsapp = document.getElementById('primary-whatsapp');
  var passengerCount = document.getElementById('passenger-count');
  var childrenCount = document.getElementById('children-count');
  var childrenHint = document.getElementById('children-hint');
  var passengerFields = document.getElementById('passenger-fields');
  var childrenFields = document.getElementById('children-fields');
  var passengersFieldset = document.getElementById('passengers-fieldset');
  var passengersNote = document.getElementById('passengers-note');
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
  var confirmedGroup = document.getElementById('confirmed-group');
  var confirmedGroupName = document.getElementById('confirmed-group-name');
  var confirmedGroupBadge = document.getElementById('confirmed-group-badge');
  var confirmedIssued = document.getElementById('confirmed-issued');
  var confirmedOrder = document.getElementById('confirmed-order');
  var stillHereDialog = document.getElementById('still-here-dialog');
  var stillHereContinue = document.getElementById('still-here-continue');
  var stillHereCancel = document.getElementById('still-here-cancel');
  var printConfirmation = document.getElementById('print-confirmation');
  var priceCents = 12000;
  var savedPassengers = {};
  var savedChildren = {};
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
    var kids = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    stepDescription.textContent = (count === 1 && kids === 0)
      ? 'Você viaja sozinho(a): basta preencher seus dados de contato abaixo. Se mudar de ideia, aumente o tamanho do grupo.'
      : STEP_COPY.cadastro.description;
  }

  function readPassengerValues() {
    if (passengerFields) {
      Array.prototype.slice.call(passengerFields.querySelectorAll('[data-passenger-position]')).forEach(function (field) {
        var position = field.dataset.passengerPosition;
        var wa = field.querySelector('[data-passenger-whatsapp]');
        var email = field.querySelector('[data-passenger-email]');
        var age = field.querySelector('[data-passenger-age]');
        savedPassengers[position] = {
          fullName: field.querySelector('[data-passenger-name]').value,
          cpf: field.querySelector('[data-passenger-cpf]').value,
          age: age ? age.value : 'adult',
          whatsapp: wa ? wa.value : '',
          email: email ? email.value : ''
        };
      });
    }

    if (childrenFields) {
      Array.prototype.slice.call(childrenFields.querySelectorAll('[data-child-position]')).forEach(function (field) {
        var position = field.dataset.childPosition;
        savedChildren[position] = {
          fullName: field.querySelector('[data-child-name]').value,
          cpf: field.querySelector('[data-child-cpf]').value
        };
      });
    }
  }

  function getAdultPayingCount() {
    var count = Math.max(1, Math.min(100, Number(passengerCount.value) || 1));
    var adults = 0;
    if (!primaryAge || primaryAge.value !== 'minor') {
      adults++;
    }
    for (var pos = 2; pos <= count; pos++) {
      var pField = document.getElementById('passenger-' + pos + '-age');
      var ageVal = pField ? pField.value : (savedPassengers[pos] ? savedPassengers[pos].age : 'adult');
      if (ageVal !== 'minor') {
        adults++;
      }
    }
    return adults;
  }

  function renderChildren() {
    if (!childrenFields) return;
    var kids = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    childrenFields.replaceChildren();

    for (var idx = 1; idx <= kids; idx++) {
      var values = savedChildren[idx] || { fullName: '', cpf: '' };
      var wrapper = document.createElement('div');
      wrapper.className = 'bus-passenger bus-passenger--child';
      wrapper.dataset.childPosition = idx;
      wrapper.innerHTML = '<div class="bus-passenger__title"><span>Criança de colo ' + idx + ' (até 5 anos)</span><small class="bus-passenger__tag">No colo · Sem cobrança</small></div>'
        + '<div class="bus-form__grid">'
        + '<div class="bus-field bus-field--wide"><label for="child-' + idx + '-name">Nome completo da criança ' + idx + ' <b aria-hidden="true">*</b></label>'
        + '<input id="child-' + idx + '-name" aria-label="Nome completo da criança ' + idx + '" data-child-name type="text" autocomplete="off" minlength="3" required></div>'
        + '<div class="bus-field bus-field--wide"><label for="child-' + idx + '-cpf">CPF da criança ' + idx + ' <b aria-hidden="true">*</b></label>'
        + '<input id="child-' + idx + '-cpf" aria-label="CPF da criança ' + idx + '" data-child-cpf type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required>'
        + '<small class="bus-field__hint">O CPF de menores é obrigatório para emissão da apólice e lista de embarque.</small></div>'
        + '</div>';
      childrenFields.appendChild(wrapper);
      wrapper.querySelector('[data-child-name]').value = values.fullName || '';
      wrapper.querySelector('[data-child-cpf]').value = maskCpf(values.cpf || '');
      wrapper.querySelector('[data-child-cpf]').addEventListener('input', function (event) {
        event.currentTarget.value = maskCpf(event.currentTarget.value);
      });
    }
  }

  function renderPassengers() {
    readPassengerValues();
    var count = Math.max(1, Math.min(100, Number(passengerCount.value) || 1));
    passengerCount.value = count;
    passengerFields.replaceChildren();

    for (var position = 2; position <= count; position += 1) {
      var values = savedPassengers[position] || { fullName: '', cpf: '', age: 'adult', whatsapp: '', email: '' };
      var wrapper = document.createElement('div');
      wrapper.className = 'bus-passenger';
      wrapper.dataset.passengerPosition = position;
      wrapper.innerHTML = '<div class="bus-passenger__title"><span>Passageiro ' + position + '</span><small>Nome, CPF e faixa etária obrigatórios</small></div>'
        + '<div class="bus-form__grid">'
        + '<div class="bus-field bus-field--wide"><label for="passenger-' + position + '-name">Nome completo do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-name" aria-label="Nome completo do passageiro ' + position + '" data-passenger-name type="text" autocomplete="off" minlength="3" required></div>'
        + '<div class="bus-field"><label for="passenger-' + position + '-cpf">CPF do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<input id="passenger-' + position + '-cpf" aria-label="CPF do passageiro ' + position + '" data-passenger-cpf type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" required></div>'
        + '<div class="bus-field"><label for="passenger-' + position + '-age">Faixa etária do passageiro ' + position + ' <b aria-hidden="true">*</b></label>'
        + '<select id="passenger-' + position + '-age" aria-label="Faixa etária do passageiro ' + position + '" data-passenger-age required>'
        + '<option value="adult"' + (values.age === 'minor' ? '' : ' selected') + '>18 anos ou mais</option>'
        + '<option value="minor"' + (values.age === 'minor' ? ' selected' : '') + '>6 a 17 anos</option>'
        + '</select></div>'
        // WhatsApp opcional: sem `required` e rotulado como opcional no próprio
        // label, para a pessoa não travar achando que precisa preencher.
        + '<div class="bus-field"><label for="passenger-' + position + '-whatsapp">WhatsApp do passageiro ' + position + ' <small>(opcional)</small></label>'
        + '<input id="passenger-' + position + '-whatsapp" aria-label="WhatsApp do passageiro ' + position + ' (opcional)" data-passenger-whatsapp type="tel" inputmode="tel" autocomplete="off" maxlength="15" placeholder="(11) 90000-0000"></div>'
        // E-mail opcional do passageiro adicional.
        + '<div class="bus-field bus-field--wide"><label for="passenger-' + position + '-email">E-mail do passageiro ' + position + ' <small>(opcional)</small></label>'
        + '<input id="passenger-' + position + '-email" aria-label="E-mail do passageiro ' + position + ' (opcional)" data-passenger-email type="email" autocomplete="email"></div>'
        + '</div>';
      passengerFields.appendChild(wrapper);
      wrapper.querySelector('[data-passenger-name]').value = values.fullName || '';
      wrapper.querySelector('[data-passenger-cpf]').value = maskCpf(values.cpf || '');
      wrapper.querySelector('[data-passenger-cpf]').addEventListener('input', function (event) {
        event.currentTarget.value = maskCpf(event.currentTarget.value);
      });
      wrapper.querySelector('[data-passenger-age]').addEventListener('change', function () {
        readPassengerValues();
        updateSummary();
      });
      var waField = wrapper.querySelector('[data-passenger-whatsapp]');
      waField.value = maskWhatsapp(values.whatsapp || '');
      waField.addEventListener('input', function (event) {
        event.currentTarget.value = maskWhatsapp(event.currentTarget.value);
      });
      var emailField = wrapper.querySelector('[data-passenger-email]');
      emailField.value = values.email || '';
    }

    renderChildren();

    var extra = count - 1;
    var kids = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    // Exibe o fieldset se houver passageiros adicionais ou crianças de colo.
    if (passengersFieldset) {
      passengersFieldset.hidden = (extra === 0 && kids === 0);
    }
    if (passengersNote) {
      if (extra > 0 && kids > 0) {
        passengersNote.textContent = 'Preencha os dados dos demais passageiros e das crianças de colo abaixo.';
      } else if (kids > 0) {
        passengersNote.textContent = 'Preencha os dados da criança de até 5 anos (colo) abaixo.';
      } else {
        passengersNote.textContent = 'O passageiro 1 é o contato principal. Preencha os demais campos abaixo.';
      }
    }
    syncStepDescription();
    updateSummary();
  }

  // Crianças de até 5 anos são ADICIONAIS ao grupo e não pagam: viajam no colo
  // de um pagante de 18 anos ou mais. Pagantes de 6 a 17 anos NÃO podem levar
  // crianças de colo. Logo, máximo de crianças = total de pagantes adultos (18+).
  function syncChildrenLimit(count) {
    var adultCount = getAdultPayingCount();
    childrenCount.max = String(adultCount);
    var current = Math.max(0, Math.floor(Number(childrenCount.value) || 0));
    var clamped = Math.min(current, adultCount);
    if (String(clamped) !== childrenCount.value) childrenCount.value = clamped;

    if (adultCount === 0) {
      childrenCount.disabled = true;
      if (childrenHint) {
        childrenHint.textContent = 'Crianças de colo só podem viajar acompanhadas por um pagante de 18 anos ou mais.';
      }
    } else {
      childrenCount.disabled = false;
      if (childrenHint) {
        childrenHint.textContent = 'Viajam no colo de um pagante de 18 anos ou mais (máximo de 1 por adulto, ' + adultCount + ' disponível' + (adultCount === 1 ? '' : 'is') + '). Sem cobrança.';
      }
    }
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

    var seenCpfs = {};
    seenCpfs[digits(primaryCpf.value)] = primaryCpf;

    var adultCount = (primaryAge && primaryAge.value === 'minor') ? 0 : 1;

    for (var position = 2; position <= count; position += 1) {
      var nameField = document.getElementById('passenger-' + position + '-name');
      var cpfField = document.getElementById('passenger-' + position + '-cpf');
      var ageField = document.getElementById('passenger-' + position + '-age');
      var emailField = document.getElementById('passenger-' + position + '-email');
      if (!nameField || normalizeFullName(nameField.value).split(' ').length < 2) {
        return invalid('Preencha os dados do passageiro ' + position + '.', nameField);
      }
      if (!cpfField || !validCpf(cpfField.value)) {
        return invalid('Informe um CPF válido para o passageiro ' + position + '.', cpfField);
      }
      var cpfD = digits(cpfField.value);
      if (seenCpfs[cpfD]) {
        return invalid('Não repita o CPF de um passageiro.', cpfField);
      }
      seenCpfs[cpfD] = cpfField;

      if (ageField && ageField.value !== 'minor') {
        adultCount++;
      }

      if (emailField && emailField.value.trim() !== '' && !emailField.validity.valid) {
        return invalid('Informe um e-mail válido para o passageiro ' + position + '.', emailField);
      }
    }

    // Regra de crianças de colo (0 a 5 anos):
    if (children > 0) {
      if (adultCount === 0) {
        return invalid('Crianças de colo só podem viajar acompanhadas por um pagante de 18 anos ou mais.', childrenCount);
      }
      if (children > adultCount) {
        return invalid('As crianças de até 5 anos não podem passar do número de pagantes maiores de 18 anos.', childrenCount);
      }
      for (var idx = 1; idx <= children; idx++) {
        var childNameField = document.getElementById('child-' + idx + '-name');
        var childCpfField = document.getElementById('child-' + idx + '-cpf');
        if (!childNameField || normalizeFullName(childNameField.value).split(' ').length < 2) {
          return invalid('Preencha o nome completo da criança ' + idx + '.', childNameField);
        }
        if (!childCpfField || !validCpf(childCpfField.value)) {
          return invalid('Informe um CPF válido para a criança ' + idx + '.', childCpfField);
        }
        var cCpfD = digits(childCpfField.value);
        if (seenCpfs[cCpfD]) {
          return invalid('Não repita o CPF de um passageiro ou criança.', childCpfField);
        }
        seenCpfs[cCpfD] = childCpfField;
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
    var kids = Number(childrenCount.value || 0);
    var passengers = [{
      full_name: normalizeFullName(primaryName.value),
      cpf: digits(primaryCpf.value),
      // O passageiro 1 é o contato principal, então o WhatsApp e o E-mail são os do contato.
      whatsapp: digits(primaryWhatsapp.value),
      email: primaryEmail.value.trim(),
      age_group: primaryAge ? primaryAge.value : 'adult',
      is_minor: primaryAge ? primaryAge.value === 'minor' : false
    }];
    for (var position = 2; position <= count; position += 1) {
      var waInput = document.getElementById('passenger-' + position + '-whatsapp');
      var emailInput = document.getElementById('passenger-' + position + '-email');
      var ageInput = document.getElementById('passenger-' + position + '-age');
      passengers.push({
        full_name: normalizeFullName(document.getElementById('passenger-' + position + '-name').value),
        cpf: digits(document.getElementById('passenger-' + position + '-cpf').value),
        whatsapp: waInput ? digits(waInput.value) : '',
        email: emailInput ? emailInput.value.trim() : '',
        age_group: ageInput ? ageInput.value : 'adult',
        is_minor: ageInput ? ageInput.value === 'minor' : false
      });
    }

    var children = [];
    for (var i = 1; i <= kids; i++) {
      var cNameInput = document.getElementById('child-' + i + '-name');
      var cCpfInput = document.getElementById('child-' + i + '-cpf');
      if (cNameInput && cCpfInput) {
        children.push({
          position: count + i,
          full_name: normalizeFullName(cNameInput.value),
          cpf: digits(cCpfInput.value)
        });
      }
    }

    return {
      contact: {
        full_name: normalizeFullName(primaryName.value),
        cpf: digits(primaryCpf.value),
        email: primaryEmail.value.trim(),
        whatsapp: digits(primaryWhatsapp.value),
        age_group: primaryAge ? primaryAge.value : 'adult',
        is_minor: primaryAge ? primaryAge.value === 'minor' : false
      },
      passenger_count: count,
      children_count: kids,
      passengers: passengers,
      children: children
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

  function fitGroupName() {
    if (!confirmedGroupName || !confirmedGroupBadge || confirmedGroupBadge.hidden) return;
    var containerWidth = confirmedGroupBadge.clientWidth || (confirmedGroupBadge.parentElement ? confirmedGroupBadge.parentElement.clientWidth : 0);
    if (!containerWidth || containerWidth <= 0) return;

    // Inicia no tamanho máximo de 4rem para medição de transbordamento
    confirmedGroupName.style.fontSize = '4rem';
    var textWidth = confirmedGroupName.scrollWidth;

    if (textWidth > containerWidth) {
      var ratio = containerWidth / textWidth;
      var newRem = Math.max(1.1, Math.min(4.0, 4.0 * ratio * 0.96));
      confirmedGroupName.style.fontSize = newRem.toFixed(2) + 'rem';
    }
  }

  window.addEventListener('resize', fitGroupName, { passive: true });

  function showConfirmation(data) {
    setStep('confirmacao');
    setConfirmedData(confirmedSnapshot, data);
  }

  function setConfirmedData(confirmedSnapshot, data) {
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
    (snap.passengers || []).forEach(function (passenger, index) {
      // Compatibilidade: snapshots antigos guardavam apenas a string do nome.
      var name = typeof passenger === 'string' ? passenger : passenger.name;
      var phone = typeof passenger === 'string' ? '' : (passenger.whatsapp || '');
      var isMinor = typeof passenger === 'object' && passenger.is_minor;

      var item = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = name;
      var tag = document.createElement('small');
      var papel = index === 0 ? 'Contato principal' : 'Passageiro ' + (index + 1);
      if (isMinor) {
        papel += ' · 6 a 17 anos';
      }
      tag.textContent = phone ? papel + ' · ' + maskWhatsapp(phone) : papel;
      item.append(label, tag);
      confirmedPassengers.appendChild(item);
    });

    (snap.children || []).forEach(function (child, index) {
      var item = document.createElement('li');
      var label = document.createElement('span');
      label.textContent = child.name;
      var tag = document.createElement('small');
      tag.textContent = 'Criança de colo ' + (index + 1) + ' (até 5 anos) · CPF: ' + maskCpf(child.cpf || '') + ' · Sem cobrança';
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

    // Exibe o bloco do grupo exclusivo apenas se houver um nome de grupo definido no servidor.
    // Reservas individuais nao possuem grupo (groupName e null ou vazio), mantendo o bloco oculto.
    var gName = data && typeof data.groupName === 'string' ? data.groupName.trim() : '';
    if (confirmedGroupName) {
      confirmedGroupName.textContent = gName;
    }
    if (confirmedGroupBadge) {
      confirmedGroupBadge.hidden = gName.length === 0;
      if (gName.length > 0) {
        requestAnimationFrame(fitGroupName);
      }
    }
    if (confirmedGroup) {
      confirmedGroup.hidden = gName.length === 0;
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
      if (typeof onPending === 'function') onPending();
      statusTimer = window.setTimeout(function () {
        pollPaymentStatus(registrationId);
      }, 3000);
    }).catch(function () {
      statusTimer = window.setTimeout(function () {
        pollPaymentStatus(registrationId);
      }, 5000);
    });
  }

  function showPayment(payment) {
    activeRegistrationId = payment.registrationId;
    setStep('pagamento');

    var payload = getPayload();
    // Guarda os dados para montar o comprovante na confirmação sem
    // precisar que o servidor devolva dados pessoais em uma consulta por UUID.
    confirmedSnapshot = {
      registrationId: payment.registrationId,
      orderId: payment.orderId,
      totalAmount: payment.totalAmount,
      childrenCount: Number(childrenCount.value || 0),
      // Nome e telefone: a organização usa o comprovante como referência de
      // contato do grupo, então o telefone de quem informou vai junto.
      passengers: payload.passengers.map(function (p) {
        return { name: p.full_name, whatsapp: p.whatsapp || '', is_minor: p.is_minor };
      }),
      children: payload.children.map(function (c) {
        return { name: c.full_name, cpf: c.cpf };
      })
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
  if (primaryAge) {
    primaryAge.addEventListener('change', function () {
      readPassengerValues();
      updateSummary();
    });
  }
  passengerCount.addEventListener('input', renderPassengers);
  childrenCount.addEventListener('input', function () {
    renderPassengers();
  });
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

  // ──────────────────────────────────────────────
  // Hero: Cartão de embarque holográfico 3D (Overdrive)
  // ──────────────────────────────────────────────
  (function () {
    var ticket = document.getElementById('heroTicket');
    if (!ticket) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    var hero = ticket.closest('.bus-hero') || ticket;
    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;
    var sheenX = 50;
    var sheenY = 50;
    var isHovered = false;
    var rafId = null;

    function update() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      ticket.style.setProperty('--tilt-x', currentX.toFixed(2) + 'deg');
      ticket.style.setProperty('--tilt-y', currentY.toFixed(2) + 'deg');
      ticket.style.setProperty('--sheen-x', sheenX.toFixed(1) + '%');
      ticket.style.setProperty('--sheen-y', sheenY.toFixed(1) + '%');

      if (isHovered || Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        rafId = requestAnimationFrame(update);
      } else {
        ticket.style.setProperty('--tilt-x', '0deg');
        ticket.style.setProperty('--tilt-y', '0deg');
        rafId = null;
      }
    }

    hero.addEventListener('pointermove', function (e) {
      var rect = ticket.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      var dx = (e.clientX - centerX) / (window.innerWidth / 2);
      var dy = (e.clientY - centerY) / (window.innerHeight / 2);

      targetY = Math.max(-14, Math.min(14, dx * 14));
      targetX = Math.max(-12, Math.min(12, -dy * 12));

      var localX = ((e.clientX - rect.left) / rect.width) * 100;
      var localY = ((e.clientY - rect.top) / rect.height) * 100;
      sheenX = Math.max(0, Math.min(100, localX));
      sheenY = Math.max(0, Math.min(100, localY));

      if (!rafId) {
        isHovered = true;
        rafId = requestAnimationFrame(update);
      }
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      isHovered = false;
      targetX = 0;
      targetY = 0;
      if (!rafId) rafId = requestAnimationFrame(update);
    });
  })();

})();
