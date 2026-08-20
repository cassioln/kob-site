(function initBusPaymentPage() {
  'use strict';

  var form = document.getElementById('bus-form');
  if (!form) return;

  var primaryName = document.getElementById('primary-name');
  var primaryCpf = document.getElementById('primary-cpf');
  var primaryBirth = document.getElementById('primary-birth');
  var primaryEmail = document.getElementById('primary-email');
  var primaryWhatsapp = document.getElementById('primary-whatsapp');

  // Elementos da Etapa 2 (Grupo e Passageiros)
  var soloTraveler = document.getElementById('solo-traveler');
  var soloTravelerLabel = document.querySelector('.bus-solo-checkbox');
  var groupDivider = document.querySelector('.bus-group-divider');
  var btnOpenAddPassenger = document.getElementById('btn-open-add-passenger');
  var groupMainView = document.getElementById('group-main-view');
  var groupPassengersContainer = document.getElementById('group-passengers-container');
  var primarySummaryCard = document.getElementById('primary-summary-card');
  var primarySummaryText = document.getElementById('primary-summary-text');
  var addedPassengersList = document.getElementById('added-passengers-list');
  var btnGroupNext = document.getElementById('btn-group-next');

  // Mini Multi-step Form (Adição de Pessoa)
  var addPassengerPanel = document.getElementById('add-passenger-panel');
  var btnCancelAddPassenger = document.getElementById('btn-cancel-add-passenger');
  var substepAge = document.getElementById('substep-age');
  var substepFields = document.getElementById('substep-fields');
  var substepConfirm = document.getElementById('substep-confirm');
  var newPassengerAge = document.getElementById('new-passenger-age');
  var substepAgeAlert = document.getElementById('substep-age-alert');
  var btnSubstepAgeNext = document.getElementById('btn-substep-age-next');
  var newPName = document.getElementById('new-p-name');
  var newPCpf = document.getElementById('new-p-cpf');
  var newPWaWrapper = document.getElementById('new-p-wa-wrapper');
  var newPWhatsapp = document.getElementById('new-p-whatsapp');
  var newPEmailWrapper = document.getElementById('new-p-email-wrapper');
  var newPEmail = document.getElementById('new-p-email');
  var substepFieldsAlert = document.getElementById('substep-fields-alert');
  var btnSubstepFieldsBack = document.getElementById('btn-substep-fields-back');
  var btnSubstepFieldsNext = document.getElementById('btn-substep-fields-next');
  var reviewPersonAge = document.getElementById('review-person-age');
  var reviewPersonName = document.getElementById('review-person-name');
  var reviewPersonCpf = document.getElementById('review-person-cpf');
  var reviewPersonWaRow = document.getElementById('review-person-wa-row');
  var reviewPersonWhatsapp = document.getElementById('review-person-whatsapp');
  var reviewPersonEmailRow = document.getElementById('review-person-email-row');
  var reviewPersonEmail = document.getElementById('review-person-email');
  var btnSubstepConfirmEdit = document.getElementById('btn-substep-confirm-edit');
  var btnSubstepConfirmSave = document.getElementById('btn-substep-confirm-save');

  // Modal de Remoção de Passageiro
  var removePassengerDialog = document.getElementById('remove-passenger-dialog');
  var removeDialogText = document.getElementById('remove-dialog-text');
  var removeDialogWarning = document.getElementById('remove-dialog-warning');
  var btnCancelRemovePassenger = document.getElementById('btn-cancel-remove-passenger');
  var btnConfirmRemovePassenger = document.getElementById('btn-confirm-remove-passenger');
  var passengerToRemoveId = null;

  // Elementos da Etapa 3 (Revisão)
  var reviewPassengersList = document.getElementById('review-passengers-list');
  var reviewPayingCount = document.getElementById('review-paying-count');
  var reviewPayingSubtotal = document.getElementById('review-paying-subtotal');
  var reviewChildrenRow = document.getElementById('review-children-row');
  var reviewChildrenCount = document.getElementById('review-children-count');
  var reviewTotalAmount = document.getElementById('review-total-amount');

  // Cabeçalho e Painéis
  var stepHeading = document.getElementById('step-heading');
  var stepEyebrow = document.getElementById('step-eyebrow');
  var stepTitle = document.getElementById('form-title');
  var stepDescription = document.getElementById('step-description');
  var stepper = document.getElementById('bus-stepper');
  var stepperBar = document.getElementById('bus-stepper-bar');
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

  // Estado
  var currentStep = 'cadastro';
  var currentWizardStep = 1;
  var priceCents = 12000;
  var statusTimer = null;
  var expiryTimer = null;
  var activeRegistrationId = null;
  var confirmedSnapshot = null;

  // Lista de passageiros adicionais [{ id, ageGroup, fullName, cpf, whatsapp, email }]
  var addedPassengers = [];
  var pendingNewPassenger = { ageGroup: '', fullName: '', cpf: '', whatsapp: '', email: '' };

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

  function maskDate(value) {
    var valueDigits = digits(value).slice(0, 8);
    if (valueDigits.length > 4) return valueDigits.replace(/(\d{2})(\d{2})(\d{1,4})/, '$1/$2/$3');
    if (valueDigits.length > 2) return valueDigits.replace(/(\d{2})(\d{1,2})/, '$1/$2');
    return valueDigits;
  }

  function parseBirthDate(value) {
    var val = String(value || '').trim();
    var d, m, y;
    var brMatch = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    var isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (brMatch) {
      d = Number(brMatch[1]);
      m = Number(brMatch[2]);
      y = Number(brMatch[3]);
    } else if (isoMatch) {
      y = Number(isoMatch[1]);
      m = Number(isoMatch[2]);
      d = Number(isoMatch[3]);
    } else {
      return null;
    }
    var currentYear = new Date().getFullYear();
    if (y < 1900 || y > currentYear || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== (m - 1) || dt.getDate() !== d) return null;
    var today = new Date();
    var age = today.getFullYear() - y;
    var monthDiff = today.getMonth() - (m - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
      age--;
    }
    var iso = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    return { age: age, iso: iso };
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getAdultCount() {
    // Contato principal é sempre 18+ (validado no step 1) + adicionais adultos
    var adultExtras = addedPassengers.filter(function (p) { return p.ageGroup === 'adult'; }).length;
    return 1 + adultExtras;
  }

  function getChildrenCount() {
    return addedPassengers.filter(function (p) { return p.ageGroup === 'child'; }).length;
  }

  function getPayingCount() {
    // Titular + adicionais maiores de 6 anos (adult ou minor)
    var payingExtras = addedPassengers.filter(function (p) { return p.ageGroup !== 'child'; }).length;
    return 1 + payingExtras;
  }

  function getTotalPassengersCount() {
    return 1 + addedPassengers.length;
  }

  function updateSummary() {
    var totalP = getTotalPassengersCount();
    var paying = getPayingCount();
    var amount = (paying * priceCents / 100).toFixed(2).replace('.', ',');
    if (summaryCount) summaryCount.textContent = displayCount(totalP, 'passageiro', 'passageiros');
    if (summaryPaying) summaryPaying.textContent = displayCount(paying, 'passageiro', 'passageiros');
    if (total) total.textContent = 'R$ ' + amount;
  }

  // Cabeçalho por etapa global
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
    if (stepHeading) stepHeading.dataset.step = step;
    currentStep = step;

    if (step === 'cadastro') {
      if (stepper) stepper.hidden = false;
      updateWizardHeaderCopy();
    } else {
      if (stepper) stepper.hidden = true;
      if (stepEyebrow) stepEyebrow.textContent = copy.eyebrow;
      if (stepTitle) stepTitle.textContent = copy.title;
      if (stepDescription) stepDescription.textContent = copy.description;
    }
  }

  function updateWizardHeaderCopy() {
    if (!stepHeading || currentStep !== 'cadastro') return;
    var stepInfo = {
      1: {
        eyebrow: 'Etapa 1 de 3 · Contato Principal',
        title: 'Quem é o responsável pela reserva?',
        description: 'Comece informando os dados do contato principal. Esta pessoa será o responsável financeiro e o canal oficial do grupo.'
      },
      2: {
        eyebrow: 'Etapa 2 de 3 · Grupo & Passageiros',
        title: 'Quem vai embarcar com você?',
        description: 'Informe se você viajará sozinho(a) ou adicione as pessoas que irão com você na viagem.'
      },
      3: {
        eyebrow: 'Etapa 3 de 3 · Revisão do Pedido',
        title: 'Revise os dados antes do Pix',
        description: 'Confira as informações da viagem e dos passageiros antes de gerar o código de pagamento.'
      }
    };

    var currentInfo = stepInfo[currentWizardStep] || stepInfo[1];
    if (stepEyebrow) stepEyebrow.textContent = currentInfo.eyebrow;
    if (stepTitle) stepTitle.textContent = currentInfo.title;
    if (stepDescription) stepDescription.textContent = currentInfo.description;
  }

  function updateStepperUI() {
    if (!stepper) return;
    var stepItems = stepper.querySelectorAll('.bus-stepper__item');
    var percentage = 33;
    if (currentWizardStep === 2) percentage = 66;
    if (currentWizardStep === 3) percentage = 100;

    if (stepperBar) {
      stepperBar.style.width = percentage + '%';
    }

    stepItems.forEach(function (item) {
      var stepNum = Number(item.getAttribute('data-step-target'));
      item.classList.remove('is-active', 'is-completed');
      item.removeAttribute('aria-current');

      if (stepNum === currentWizardStep) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'step');
      } else if (stepNum < currentWizardStep) {
        item.classList.add('is-completed');
      }
    });
  }

  function syncGroupModeState() {
    if (!soloTraveler || !btnOpenAddPassenger) return;

    if (addedPassengers.length > 0) {
      soloTraveler.checked = false;
      soloTraveler.disabled = true;
      if (soloTravelerLabel) soloTravelerLabel.hidden = true;
      if (groupDivider) groupDivider.hidden = true;
      btnOpenAddPassenger.disabled = false;
      if (groupPassengersContainer) groupPassengersContainer.hidden = false;
    } else {
      if (soloTravelerLabel) soloTravelerLabel.hidden = false;
      if (groupDivider) groupDivider.hidden = false;
      soloTraveler.disabled = false;
      if (soloTraveler.checked) {
        btnOpenAddPassenger.disabled = true;
      } else {
        btnOpenAddPassenger.disabled = false;
      }
      if (groupPassengersContainer) groupPassengersContainer.hidden = true;
    }
    updateSummary();
  }

  function renderAddedPassengers() {
    if (!addedPassengersList) return;
    addedPassengersList.replaceChildren();

    if (primarySummaryCard && primaryName && primaryCpf) {
      var pName = normalizeFullName(primaryName.value) || 'CONTATO PRINCIPAL';
      var pCpf = maskCpf(primaryCpf.value) || '—';
      var pWa = primaryWhatsapp ? digits(primaryWhatsapp.value) : '';
      var pEmail = primaryEmail ? primaryEmail.value.trim() : '';

      var pNameEl = document.getElementById('primary-summary-name');
      if (pNameEl) pNameEl.textContent = pName;

      var pCpfEl = document.getElementById('primary-summary-cpf');
      if (pCpfEl) pCpfEl.textContent = pCpf;

      var pWaWrap = document.getElementById('primary-summary-wa-wrap');
      var pWaEl = document.getElementById('primary-summary-whatsapp');
      if (pWaWrap && pWaEl) {
        if (pWa) {
          pWaEl.textContent = maskWhatsapp(pWa);
          pWaWrap.hidden = false;
        } else {
          pWaWrap.hidden = true;
        }
      }

      var pEmailWrap = document.getElementById('primary-summary-email-wrap');
      var pEmailEl = document.getElementById('primary-summary-email');
      if (pEmailWrap && pEmailEl) {
        if (pEmail) {
          pEmailEl.textContent = pEmail;
          pEmailWrap.hidden = false;
        } else {
          pEmailWrap.hidden = true;
        }
      }
    }

    addedPassengers.forEach(function (p, index) {
      var pNum = index + 2;
      var roleText = '18 ANOS OU MAIS';
      if (p.ageGroup === 'child') {
        roleText = '0 A 5 ANOS';
      } else if (p.ageGroup === 'minor') {
        roleText = '6 A 17 ANOS';
      }

      var card = document.createElement('div');
      card.className = 'bus-passenger bus-passenger--added' + (p.ageGroup === 'child' ? ' bus-passenger--child' : '');
      card.dataset.passengerId = p.id;

      var detailsHtml = '';
      if (p.ageGroup === 'child') {
        detailsHtml = '<div class="bus-passenger__child-layout">' +
          '<img src="assets/images/brand/meeple-baby.webp" alt="Criança de colo (0 a 5 anos)" class="bus-passenger__meeple-img" width="48" height="48" loading="lazy">' +
          '<div class="bus-passenger__child-data">' +
          '<span>Nome: <strong>' + escapeHtml(p.fullName) + '</strong></span>' +
          '<span>CPF: <strong>' + maskCpf(p.cpf) + '</strong></span>' +
          '</div>' +
          '</div>';
      } else {
        detailsHtml = '<span>Nome: <strong>' + escapeHtml(p.fullName) + '</strong></span>' +
          '<span>CPF: <strong>' + maskCpf(p.cpf) + '</strong></span>';
        if (p.whatsapp) {
          detailsHtml += '<span>WhatsApp: <strong>' + maskWhatsapp(p.whatsapp) + '</strong></span>';
        }
        if (p.email) {
          detailsHtml += '<span>E-mail: <strong>' + escapeHtml(p.email) + '</strong></span>';
        }
      }

      card.innerHTML = '<div class="bus-passenger__header">' +
        '<div class="bus-passenger__header-title">' +
        '<span class="bus-passenger__header-num">PASSAGEIRO ' + pNum + '</span>' +
        '<span class="bus-passenger__pipe">|</span>' +
        '<span class="bus-passenger__category">' + roleText + '</span>' +
        '</div>' +
        '<button type="button" class="bus-passenger__btn-remove" data-action="remove-passenger" data-passenger-id="' + p.id + '" aria-label="Remover passageiro ' + escapeHtml(p.fullName) + '" title="Remover passageiro">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<line x1="5" y1="12" x2="19" y2="12"></line>' +
        '</svg>' +
        '</button>' +
        '</div>' +
        '<div class="bus-passenger__added-details' + (p.ageGroup === 'child' ? ' bus-passenger__added-details--child' : '') + '">' +
        detailsHtml +
        '</div>';

      addedPassengersList.appendChild(card);
    });

    syncGroupModeState();
  }

  function showSubstep(substepNum) {
    if (substepAge) substepAge.hidden = (substepNum !== 1);
    if (substepFields) substepFields.hidden = (substepNum !== 2);
    if (substepConfirm) substepConfirm.hidden = (substepNum !== 3);
  }

  function openAddPassengerFlow() {
    if (soloTraveler && soloTraveler.checked) return;
    pendingNewPassenger = { ageGroup: '', fullName: '', cpf: '', whatsapp: '', email: '' };
    if (newPassengerAge) newPassengerAge.value = '';
    if (newPName) newPName.value = '';
    if (newPCpf) newPCpf.value = '';
    if (newPWhatsapp) newPWhatsapp.value = '';
    if (newPEmail) newPEmail.value = '';
    if (substepAgeAlert) substepAgeAlert.hidden = true;
    if (substepFieldsAlert) substepFieldsAlert.hidden = true;

    if (groupMainView) groupMainView.hidden = true;
    if (addPassengerPanel) addPassengerPanel.hidden = false;
    showSubstep(1);
    if (newPassengerAge) newPassengerAge.focus();
  }

  function closeAddPassengerFlow() {
    if (addPassengerPanel) addPassengerPanel.hidden = true;
    if (groupMainView) groupMainView.hidden = false;
    syncGroupModeState();
  }

  function advanceSubstepAge() {
    if (substepAgeAlert) substepAgeAlert.hidden = true;
    var selectedAge = newPassengerAge ? newPassengerAge.value : '';
    if (!selectedAge) {
      if (substepAgeAlert) {
        substepAgeAlert.textContent = 'Selecione a faixa etária da pessoa para continuar.';
        substepAgeAlert.hidden = false;
      }
      if (newPassengerAge) newPassengerAge.focus();
      return;
    }

    if (selectedAge === 'child') {
      var availableAdults = getAdultCount();
      var currentChildren = getChildrenCount();
      if (currentChildren >= availableAdults) {
        if (substepAgeAlert) {
          substepAgeAlert.innerHTML = '<strong>Atenção:</strong> Cada criança de 0 a 5 anos precisa viajar no colo de um adulto (18+). No momento, todas as vagas de colo já possuem responsável. Adicione primeiro mais um adulto (18+) ao grupo antes de adicionar outra criança de colo.';
          substepAgeAlert.hidden = false;
        }
        return;
      }
    }

    pendingNewPassenger.ageGroup = selectedAge;

    if (selectedAge === 'child') {
      if (newPWaWrapper) newPWaWrapper.hidden = true;
      if (newPEmailWrapper) newPEmailWrapper.hidden = true;
      if (newPWhatsapp) newPWhatsapp.value = '';
      if (newPEmail) newPEmail.value = '';
    } else {
      if (newPWaWrapper) newPWaWrapper.hidden = false;
      if (newPEmailWrapper) newPEmailWrapper.hidden = false;
    }

    showSubstep(2);
    if (newPName) newPName.focus();
  }

  function advanceSubstepFields() {
    if (substepFieldsAlert) substepFieldsAlert.hidden = true;
    var name = normalizeFullName(newPName ? newPName.value : '');
    if (name.split(' ').length < 2) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Informe o nome completo (nome e sobrenome).';
        substepFieldsAlert.hidden = false;
      }
      if (newPName) newPName.focus();
      return;
    }

    var cpfVal = newPCpf ? newPCpf.value : '';
    if (!validCpf(cpfVal)) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Informe um CPF válido.';
        substepFieldsAlert.hidden = false;
      }
      if (newPCpf) newPCpf.focus();
      return;
    }

    var cpfD = digits(cpfVal);
    if (cpfD === digits(primaryCpf.value)) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Este CPF já pertence ao contato principal da reserva.';
        substepFieldsAlert.hidden = false;
      }
      if (newPCpf) newPCpf.focus();
      return;
    }

    var duplicatePassenger = addedPassengers.some(function (p) {
      return digits(p.cpf) === cpfD;
    });
    if (duplicatePassenger) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Este CPF já foi adicionado a outro passageiro do grupo.';
        substepFieldsAlert.hidden = false;
      }
      if (newPCpf) newPCpf.focus();
      return;
    }

    var waVal = newPWhatsapp ? digits(newPWhatsapp.value) : '';
    if (waVal && waVal.length !== 11) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Informe um WhatsApp válido com DDD (11 dígitos) ou deixe o campo em branco.';
        substepFieldsAlert.hidden = false;
      }
      if (newPWhatsapp) newPWhatsapp.focus();
      return;
    }

    var emailVal = newPEmail ? newPEmail.value.trim() : '';
    if (emailVal && !newPEmail.validity.valid) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = 'Informe um e-mail válido ou deixe o campo em branco.';
        substepFieldsAlert.hidden = false;
      }
      if (newPEmail) newPEmail.focus();
      return;
    }

    pendingNewPassenger.fullName = name;
    pendingNewPassenger.cpf = cpfD;
    pendingNewPassenger.whatsapp = waVal;
    pendingNewPassenger.email = emailVal;

    var ageLabels = {
      child: '0 a 5 anos (Criança de colo · Cortesia)',
      minor: '6 a 17 anos (Menor pagante)',
      adult: '18 anos ou mais (Adulto pagante)'
    };
    if (reviewPersonAge) reviewPersonAge.textContent = ageLabels[pendingNewPassenger.ageGroup] || '—';
    if (reviewPersonName) reviewPersonName.textContent = pendingNewPassenger.fullName;
    if (reviewPersonCpf) reviewPersonCpf.textContent = maskCpf(pendingNewPassenger.cpf);

    if (pendingNewPassenger.ageGroup === 'child') {
      if (reviewPersonWaRow) reviewPersonWaRow.hidden = true;
      if (reviewPersonEmailRow) reviewPersonEmailRow.hidden = true;
    } else {
      if (reviewPersonWaRow) {
        reviewPersonWaRow.hidden = false;
        if (reviewPersonWhatsapp) reviewPersonWhatsapp.textContent = pendingNewPassenger.whatsapp ? maskWhatsapp(pendingNewPassenger.whatsapp) : 'Não informado';
      }
      if (reviewPersonEmailRow) {
        reviewPersonEmailRow.hidden = false;
        if (reviewPersonEmail) reviewPersonEmail.textContent = pendingNewPassenger.email || 'Não informado';
      }
    }

    showSubstep(3);
  }

  function savePendingPassenger() {
    addedPassengers.push({
      id: 'p_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      ageGroup: pendingNewPassenger.ageGroup,
      fullName: pendingNewPassenger.fullName,
      cpf: pendingNewPassenger.cpf,
      whatsapp: pendingNewPassenger.whatsapp,
      email: pendingNewPassenger.email
    });

    closeAddPassengerFlow();
    renderAddedPassengers();
  }

  function openRemovePassengerDialog(passengerId) {
    var p = addedPassengers.find(function (item) { return item.id === passengerId; });
    if (!p) return;

    passengerToRemoveId = passengerId;
    if (removeDialogText) {
      removeDialogText.innerHTML = 'Tem certeza que deseja remover o passageiro <strong>' + escapeHtml(p.fullName) + '</strong> do grupo?';
    }

    if (removeDialogWarning) {
      if (p.ageGroup === 'adult') {
        var remainingAdults = 1 + addedPassengers.filter(function (x) { return x.ageGroup === 'adult' && x.id !== passengerId; }).length;
        var currentChildren = getChildrenCount();
        if (currentChildren > remainingAdults) {
          removeDialogWarning.innerHTML = '<strong>Atenção:</strong> Ao remover este adulto, não haverá responsáveis suficientes para todas as crianças de colo (0 a 5 anos) no grupo. Remova primeiro uma das crianças de colo antes de remover este adulto.';
          removeDialogWarning.hidden = false;
          if (btnConfirmRemovePassenger) btnConfirmRemovePassenger.disabled = true;
        } else {
          removeDialogWarning.hidden = true;
          if (btnConfirmRemovePassenger) btnConfirmRemovePassenger.disabled = false;
        }
      } else {
        removeDialogWarning.hidden = true;
        if (btnConfirmRemovePassenger) btnConfirmRemovePassenger.disabled = false;
      }
    }

    if (removePassengerDialog && typeof removePassengerDialog.showModal === 'function') {
      removePassengerDialog.showModal();
    }
  }

  function confirmRemovePassenger() {
    if (!passengerToRemoveId) return;
    addedPassengers = addedPassengers.filter(function (p) {
      return p.id !== passengerToRemoveId;
    });
    passengerToRemoveId = null;
    if (removePassengerDialog && typeof removePassengerDialog.close === 'function') {
      removePassengerDialog.close();
    }
    renderAddedPassengers();
  }

  function renderReviewCard() {
    if (!reviewPassengersList) return;
    var paying = getPayingCount();
    var kids = getChildrenCount();
    var totalCents = paying * priceCents;
    var totalFormatted = 'R$ ' + (totalCents / 100).toFixed(2).replace('.', ',');

    if (reviewPayingCount) reviewPayingCount.textContent = String(paying);
    if (reviewPayingSubtotal) reviewPayingSubtotal.textContent = totalFormatted;
    if (reviewTotalAmount) reviewTotalAmount.textContent = totalFormatted;

    if (reviewChildrenRow) {
      if (kids > 0) {
        reviewChildrenRow.hidden = false;
        if (reviewChildrenCount) reviewChildrenCount.textContent = String(kids);
      } else {
        reviewChildrenRow.hidden = true;
      }
    }

    reviewPassengersList.replaceChildren();

    // Passageiro 1 (Contato Principal)
    var p1Item = document.createElement('li');
    p1Item.className = 'bus-review-card__item';
    p1Item.innerHTML = '<span class="bus-review-card__item-name">1. ' + (escapeHtml(normalizeFullName(primaryName.value)) || 'Contato Principal') + '</span>' +
      '<span class="bus-review-card__item-details"><small class="bus-passenger__tag bus-passenger__tag--primary">Contato Principal</small></span>';
    reviewPassengersList.appendChild(p1Item);

    // Passageiros Adicionais
    addedPassengers.forEach(function (p, index) {
      var pNum = index + 2;
      var item = document.createElement('li');
      item.className = 'bus-review-card__item';
      var tagHtml = '';
      if (p.ageGroup === 'child') {
        tagHtml = '<small class="bus-passenger__tag">0 a 5 anos</small>';
      } else if (p.ageGroup === 'minor') {
        tagHtml = '<small class="bus-passenger__tag bus-passenger__tag--minor">6 a 17 anos</small>';
      } else {
        tagHtml = '<small class="bus-passenger__tag bus-passenger__tag--adult">18 anos ou mais</small>';
      }

      item.innerHTML = '<span class="bus-review-card__item-name">' + pNum + '. ' + escapeHtml(p.fullName) + '</span>' +
        '<span class="bus-review-card__item-details">' + tagHtml + '</span>';
      reviewPassengersList.appendChild(item);
    });
  }

  function setWizardStep(step, shouldScroll) {
    currentWizardStep = Math.max(1, Math.min(3, step));

    var steps = form.querySelectorAll('[data-wizard-step]');
    steps.forEach(function (el) {
      var sNum = Number(el.getAttribute('data-wizard-step'));
      if (sNum === currentWizardStep) {
        el.hidden = false;
        el.classList.add('is-active');
      } else {
        el.hidden = true;
        el.classList.remove('is-active');
      }
    });

    if (currentWizardStep === 2) {
      renderAddedPassengers();
    }

    if (currentWizardStep === 3) {
      renderReviewCard();
    }

    updateStepperUI();
    updateWizardHeaderCopy();

    if (shouldScroll) {
      var heading = document.getElementById('step-heading');
      if (heading) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
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

  function validateStep1() {
    clearInvalid();
    var name = normalizeFullName(primaryName.value);
    if (name.split(' ').length < 2) return invalid('Informe o nome completo do contato principal.', primaryName);
    if (!validCpf(primaryCpf.value)) return invalid('Informe um CPF válido para o contato principal.', primaryCpf);
    var birthParsed = primaryBirth ? parseBirthDate(primaryBirth.value) : null;
    if (!birthParsed) return invalid('Informe uma data de nascimento válida (DD/MM/AAAA) para o contato principal.', primaryBirth);
    if (birthParsed.age < 18) return invalid('O contato principal / responsável financeiro deve ter 18 anos ou mais.', primaryBirth);
    if (digits(primaryWhatsapp.value).length !== 11) return invalid('Informe um WhatsApp válido com DDD.', primaryWhatsapp);
    if (!primaryEmail.validity.valid) return invalid('Informe um e-mail válido.', primaryEmail);
    setStatus('', false);
    return true;
  }

  function validateStep2() {
    clearInvalid();
    if (!soloTraveler.checked && addedPassengers.length === 0) {
      return invalid('Selecione "Vou Sozinho" ou adicione pessoas ao grupo para continuar.', soloTraveler);
    }
    setStatus('', false);
    return true;
  }

  function validateStep3() {
    clearInvalid();
    var terms = document.getElementById('bus-terms');
    if (!terms || !terms.checked) {
      setStatus('Leia e aceite as condições para continuar.', true);
      if (terms) terms.focus();
      return false;
    }
    setStatus('', false);
    return true;
  }

  function validateForm() {
    if (!validateStep1()) {
      setWizardStep(1, true);
      return false;
    }
    if (!validateStep2()) {
      setWizardStep(2, true);
      return false;
    }
    if (!validateStep3()) {
      setWizardStep(3, true);
      return false;
    }
    return true;
  }

  function getPayload() {
    var birthParsed = primaryBirth ? parseBirthDate(primaryBirth.value) : null;
    var payingPassengers = addedPassengers.filter(function (p) { return p.ageGroup !== 'child'; });
    var childPassengers = addedPassengers.filter(function (p) { return p.ageGroup === 'child'; });

    var passengers = [{
      full_name: normalizeFullName(primaryName.value),
      cpf: digits(primaryCpf.value),
      birth_date: birthParsed ? birthParsed.iso : '',
      whatsapp: digits(primaryWhatsapp.value),
      email: primaryEmail.value.trim(),
      age_group: 'adult',
      is_minor: false
    }];

    payingPassengers.forEach(function (p) {
      passengers.push({
        full_name: normalizeFullName(p.fullName),
        cpf: digits(p.cpf),
        whatsapp: digits(p.whatsapp),
        email: (p.email || '').trim(),
        age_group: p.ageGroup,
        is_minor: p.ageGroup === 'minor'
      });
    });

    var children = [];
    childPassengers.forEach(function (c, idx) {
      children.push({
        position: passengers.length + idx + 1,
        full_name: normalizeFullName(c.fullName),
        cpf: digits(c.cpf)
      });
    });

    return {
      contact: {
        full_name: normalizeFullName(primaryName.value),
        cpf: digits(primaryCpf.value),
        birth_date: birthParsed ? birthParsed.iso : '',
        email: primaryEmail.value.trim(),
        whatsapp: digits(primaryWhatsapp.value),
        age_group: 'adult',
        is_minor: false
      },
      passenger_count: passengers.length,
      children_count: children.length,
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

  function fitGroupName() {
    if (!confirmedGroupName || !confirmedGroupBadge || confirmedGroupBadge.hidden) return;
    var containerWidth = confirmedGroupBadge.clientWidth || (confirmedGroupBadge.parentElement ? confirmedGroupBadge.parentElement.clientWidth : 0);
    if (!containerWidth || containerWidth <= 0) return;

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
    confirmedCode.textContent = snap.registrationId
      ? String(snap.registrationId).split('-')[0].toUpperCase()
      : '—';

    if (confirmedOrder) {
      confirmedOrder.textContent = snap.orderId || '—';
    }

    if (confirmedIssued) {
      confirmedIssued.textContent = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }

    confirmedPassengers.replaceChildren();
    (snap.passengers || []).forEach(function (passenger, index) {
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
      tag.textContent = 'Criança de colo ' + (index + 1) + ' (até 5 anos) · Cortesia';
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
    var titleEl = confirmationPanel.querySelector('#confirmed-title');
    if (titleEl) {
      titleEl.setAttribute('tabindex', '-1');
      titleEl.focus({ preventScroll: true });
    }
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
    confirmedSnapshot = {
      registrationId: payment.registrationId,
      orderId: payment.orderId,
      totalAmount: payment.totalAmount,
      childrenCount: payload.children_count,
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

  // Mascaras nos inputs do Contato Principal
  primaryCpf.addEventListener('input', function (event) { event.currentTarget.value = maskCpf(event.currentTarget.value); });
  if (primaryBirth) {
    primaryBirth.addEventListener('input', function (event) { event.currentTarget.value = maskDate(event.currentTarget.value); });
  }
  primaryWhatsapp.addEventListener('input', function (event) { event.currentTarget.value = maskWhatsapp(event.currentTarget.value); });

  // Mascaras nos inputs do Mini Multi-step
  if (newPCpf) {
    newPCpf.addEventListener('input', function (event) { event.currentTarget.value = maskCpf(event.currentTarget.value); });
  }
  if (newPWhatsapp) {
    newPWhatsapp.addEventListener('input', function (event) { event.currentTarget.value = maskWhatsapp(event.currentTarget.value); });
  }

  // Interacoes da Etapa 2
  if (soloTraveler) {
    soloTraveler.addEventListener('change', syncGroupModeState);
  }
  if (btnOpenAddPassenger) {
    btnOpenAddPassenger.addEventListener('click', openAddPassengerFlow);
  }
  if (btnCancelAddPassenger) {
    btnCancelAddPassenger.addEventListener('click', closeAddPassengerFlow);
  }
  if (btnSubstepAgeNext) {
    btnSubstepAgeNext.addEventListener('click', advanceSubstepAge);
  }
  if (btnSubstepFieldsBack) {
    btnSubstepFieldsBack.addEventListener('click', function () { showSubstep(1); });
  }
  if (btnSubstepFieldsNext) {
    btnSubstepFieldsNext.addEventListener('click', advanceSubstepFields);
  }
  if (btnSubstepConfirmEdit) {
    btnSubstepConfirmEdit.addEventListener('click', function () { showSubstep(2); });
  }
  if (btnSubstepConfirmSave) {
    btnSubstepConfirmSave.addEventListener('click', savePendingPassenger);
  }

  // Modal de Remocao
  if (btnCancelRemovePassenger) {
    btnCancelRemovePassenger.addEventListener('click', function () {
      if (removePassengerDialog && typeof removePassengerDialog.close === 'function') {
        removePassengerDialog.close();
      }
    });
  }
  if (btnConfirmRemovePassenger) {
    btnConfirmRemovePassenger.addEventListener('click', confirmRemovePassenger);
  }

  // Delegacao de cliques do formulario (Acoes de navegacao e remocao)
  form.addEventListener('click', function (event) {
    var removeBtn = event.target.closest('[data-action="remove-passenger"]');
    if (removeBtn) {
      event.preventDefault();
      var pId = removeBtn.getAttribute('data-passenger-id');
      if (pId) openRemovePassengerDialog(pId);
      return;
    }

    var nextBtn = event.target.closest('[data-action="next-step"]');
    if (nextBtn) {
      event.preventDefault();
      var currentStepEl = nextBtn.closest('[data-wizard-step]');
      var sNum = currentStepEl ? Number(currentStepEl.getAttribute('data-wizard-step')) : currentWizardStep;
      if (sNum === 1) {
        if (validateStep1()) setWizardStep(2, true);
      } else if (sNum === 2) {
        if (validateStep2()) setWizardStep(3, true);
      }
      return;
    }

    var prevBtn = event.target.closest('[data-action="prev-step"]');
    if (prevBtn) {
      event.preventDefault();
      var currentStepEl = prevBtn.closest('[data-wizard-step]');
      var sNum = currentStepEl ? Number(currentStepEl.getAttribute('data-wizard-step')) : currentWizardStep;
      if (sNum === 2) {
        setWizardStep(1, true);
      } else if (sNum === 3) {
        setWizardStep(2, true);
      }
      return;
    }
  });

  // Navegacao por clique nos passos do Stepper
  if (stepper) {
    stepper.addEventListener('click', function (event) {
      var item = event.target.closest('.bus-stepper__item');
      if (!item) return;
      var targetStep = Number(item.getAttribute('data-step-target'));
      if (!targetStep || targetStep === currentWizardStep) return;
      if (targetStep < currentWizardStep) {
        setWizardStep(targetStep, true);
      } else if (targetStep === 2 && validateStep1()) {
        setWizardStep(2, true);
      } else if (targetStep === 3 && validateStep1() && validateStep2()) {
        setWizardStep(3, true);
      }
    });
  }

  form.addEventListener('submit', submitForm);

  if (stillHereContinue) {
    stillHereContinue.addEventListener('click', function () {
      closeStillHereDialog();
      startExpiryCountdown(activeRegistrationId);
      pollPaymentStatus(activeRegistrationId);
    });
  }

  if (stillHereCancel) {
    stillHereCancel.addEventListener('click', function () {
      closeStillHereDialog();
      stopExpiryCountdown();
      window.clearTimeout(statusTimer);
      window.location.href = 'index.html';
    });
  }

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

  if (copyPix) {
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
  }

  setStep('cadastro');
  setWizardStep(1);
  syncGroupModeState();

  // Hero: Cartão de embarque holográfico 3D (Overdrive)
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
