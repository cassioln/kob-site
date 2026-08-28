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
  var activePayment = null;
  var confirmedSnapshot = null;
  var CHECKOUT_STORAGE_KEY = 'kob-checkout-state-v1';

  // Lista de passageiros adicionais [{ id, ageGroup, fullName, cpf, whatsapp, email }]
  var addedPassengers = [];
  var pendingNewPassenger = { ageGroup: '', fullName: '', cpf: '', whatsapp: '', email: '' };

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  var personNameConnectors = {
    de: true, da: true, do: true, das: true, dos: true, e: true
  };
  var brazilianDdds = new Set([
    '11', '12', '13', '14', '15', '16', '17', '18', '19',
    '21', '22', '24', '27', '28',
    '31', '32', '33', '34', '35', '37', '38',
    '41', '42', '43', '44', '45', '46', '47', '48', '49',
    '51', '53', '54', '55',
    '61', '62', '63', '64', '65', '66', '67', '68', '69',
    '71', '73', '74', '75', '77', '79',
    '81', '82', '83', '84', '85', '86', '87', '88', '89',
    '91', '92', '93', '94', '95', '96', '97', '98', '99'
  ]);

  function maskCpf(value) {
    var valueDigits = digits(value).slice(0, 11);
    if (valueDigits.length > 9) return valueDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    if (valueDigits.length > 6) return valueDigits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    if (valueDigits.length > 3) return valueDigits.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    return valueDigits;
  }

  function maskWhatsapp(value) {
    var rawDigits = digits(value).slice(0, 13);
    var valueDigits = rawDigits.startsWith('55') && (rawDigits.length === 12 || rawDigits.length === 13)
      ? rawDigits.slice(2)
      : rawDigits.slice(0, 11);
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

  function isValidBrazilianPhoneDigits(national) {
    if (!/^\d+$/.test(national) || !brazilianDdds.has(national.slice(0, 2))) return false;
    var subscriber = national.slice(2);
    if (/^(\d)\1+$/.test(subscriber)) return false;
    if (national.length === 10) return /^[2-59]\d{7}$/.test(subscriber);
    if (national.length === 11) return /^9\d{8}$/.test(subscriber);
    return false;
  }

  function normalizeWhatsappDigits(value) {
    var all = digits(value);
    var national = all.startsWith('55') && (all.length === 12 || all.length === 13)
      ? all.slice(2)
      : all;
    return isValidBrazilianPhoneDigits(national) ? national : '';
  }

  function normalizeFullName(value) {
    var normalized = String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    return normalized.split(' ').map(function (token, index) {
      if (index > 0 && personNameConnectors[token]) return token;
      return token.split(/([-'])/u).map(function (part) {
        if (part === '-' || part === "'") return part;
        return part ? part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1) : part;
      }).join('');
    }).join(' ');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLocaleLowerCase('pt-BR');
  }

  var langAttr = (document.documentElement.lang || 'pt-BR').toLowerCase();
  var langKey = langAttr.startsWith('es') ? 'es' : (langAttr.startsWith('en') ? 'en' : 'pt');

  var I18N_BUS = {
    pt: {
      passenger: 'passageiro',
      passengers: 'passageiros',
      primaryContact: 'Contato Principal',
      primaryContactUpper: 'CONTATO PRINCIPAL',
      passengerUpper: 'PASSAGEIRO',
      childAgeUpper: '0 A 5 ANOS',
      minorAgeUpper: '6 A 17 ANOS',
      adultAgeUpper: '18 ANOS OU MAIS',
      notInformed: 'Não informado',
      removePassengerTitle: 'Remover passageiro',
      removePassengerConfirm: 'Tem certeza que deseja remover o passageiro <strong>{name}</strong> do grupo?',
      removeAdultWarning: '<strong>Atenção:</strong> Ao remover este adulto, não haverá responsáveis suficientes para todas as crianças de colo (0 a 5 anos) no grupo. Remova primeiro uma das crianças de colo antes de remover este adulto.',
      ageAlertChildLimit: '<strong>Atenção:</strong> Cada criança de 0 a 5 anos precisa viajar no colo de um adulto (18+). No momento, todas as vagas de colo já possuem responsável. Adicione primeiro mais um adulto (18+) ao grupo antes de adicionar outra criança de colo.',
      ageAlertSelect: 'Selecione a faixa etária da pessoa para continuar.',
      fieldAlertFullName: 'Informe o nome completo (nome e sobrenome).',
      fieldAlertCpf: 'Informe um CPF válido.',
      fieldAlertCpfPrimary: 'Este CPF já pertence ao contato principal da reserva.',
      fieldAlertCpfDuplicate: 'Este CPF já foi adicionado a outro passageiro do grupo.',
      fieldAlertWa: 'Informe um WhatsApp válido com DDD ou deixe o campo em branco.',
      fieldAlertEmail: 'Informe um e-mail válido ou deixe o campo em branco.',
      ageLabels: {
        child: '0 a 5 anos (Criança de colo · Cortesia)',
        minor: '6 a 17 anos (Menor pagante)',
        adult: '18 anos ou mais (Adulto pagante)'
      },
      stepCopy: {
        cadastro: {
          eyebrow: 'Cadastro',
          title: 'Quem vai embarcar com você?',
          description: 'Comece pelo contato principal. Depois, informe o nome completo e o CPF de cada pessoa do grupo, incluindo você.'
        },
        pagamento: {
          eyebrow: 'Pagamento · aguardando confirmação',
          title: 'Pague para confirmar sua reserva',
          description: 'Abra o app do seu banco e escaneie o QR Code, ou use o Pix Copia e Cola. Depois, aguarde a confirmação nesta página.'
        },
        confirmacao: {
          eyebrow: 'Reserva confirmada',
          title: 'Pagamento confirmado. Sua reserva está registrada.',
          description: 'Sua reserva foi registrada. Guarde o código da reserva — é ele que identifica seu grupo no embarque.'
        }
      },
      stepInfo: {
        1: {
          eyebrow: 'Etapa 1 de 3 · Contato',
          title: 'Quem é o responsável pela reserva?',
          description: 'Informe os dados de quem ficará responsável pela reserva e pelo pagamento. Essa pessoa deve ter 18 anos ou mais.'
        },
        2: {
          eyebrow: 'Etapa 2 de 3 · Passageiros',
          title: 'Quem vai embarcar com você?',
          description: 'Marque que vai sozinho(a) ou adicione cada pessoa que embarcará com você.'
        },
        3: {
          eyebrow: 'Etapa 3 de 3 · Revisão',
          title: 'Revise os dados antes do Pix',
          description: 'Confira a rota, os passageiros e o total. Depois, aceite os termos para gerar o Pix.'
        }
      },
      validation: {
        primaryName: 'Informe o nome completo do contato principal.',
        primaryCpf: 'Informe um CPF válido para o contato principal.',
        primaryBirth: 'Informe uma data de nascimento válida (DD/MM/AAAA) para o contato principal.',
        primaryAge18: 'O contato principal / responsável financeiro deve ter 18 anos ou mais.',
        primaryWa: 'Informe um WhatsApp válido com DDD.',
        primaryEmail: 'Informe um e-mail válido.',
        step2SoloOrGroup: 'Marque “Vou sozinho(a)” ou adicione pelo menos uma pessoa ao grupo para continuar.',
        step3Terms: 'Leia e aceite as condições para continuar.',
        submitting: 'Gerando seu Pix com segurança…',
        submitErrorDefault: 'Não foi possível gerar o Pix. Tente novamente.'
      },
      pix: {
        resuming: 'Retomando a consulta do pagamento…',
        copiedSuccess: 'Código copiado! <span aria-hidden="true">✓</span>',
        copiedStatus: 'Código Pix copiado. Agora é só colar no app do seu banco.',
        copyManual: 'Selecione e copie o código Pix manualmente.',
        inactivePayment: 'Este pagamento não está ativo. Fale com a organização antes de tentar uma nova reserva.',
        statusUnavailable: 'Não conseguimos consultar o pagamento agora. Tentaremos novamente em instantes.',
        awaiting: 'Aguardando pagamento. Depois de pagar, aguarde a confirmação nesta página.'
      },
      confirmation: {
        dateLocale: 'pt-BR',
        childTag: 'Criança de colo {num} (até 5 anos) · Cortesia',
        childNote1: '+ 1 criança de até 5 anos, no colo de um responsável (sem cobrança).',
        childNotePlural: '+ {count} crianças de até 5 anos, no colo de um responsável (sem cobrança).'
      }
    },
    en: {
      passenger: 'passenger',
      passengers: 'passengers',
      primaryContact: 'Primary Contact',
      primaryContactUpper: 'PRIMARY CONTACT',
      passengerUpper: 'PASSENGER',
      childAgeUpper: '0 TO 5 YEARS',
      minorAgeUpper: '6 TO 17 YEARS',
      adultAgeUpper: '18 YEARS OR OLDER',
      notInformed: 'Not provided',
      removePassengerTitle: 'Remove passenger',
      removePassengerConfirm: 'Are you sure you want to remove <strong>{name}</strong> from the group?',
      removeAdultWarning: '<strong>Warning:</strong> Removing this adult leaves insufficient supervisors for lap infants (0-5 yrs). Please remove a lap infant first.',
      ageAlertChildLimit: '<strong>Notice:</strong> Each child aged 0 to 5 travels on the lap of a paying adult (18+). All lap slots are currently occupied. Please add another adult (18+) first.',
      ageAlertSelect: 'Please select an age group to proceed.',
      fieldAlertFullName: 'Please enter the full name (first and last name).',
      fieldAlertCpf: 'Please enter a valid CPF / ID number.',
      fieldAlertCpfPrimary: 'This CPF / ID already belongs to the primary contact.',
      fieldAlertCpfDuplicate: 'This CPF / ID has already been added to another passenger in your group.',
      fieldAlertWa: 'Please enter a valid WhatsApp number with area code or leave it blank.',
      fieldAlertEmail: 'Please enter a valid email address or leave it blank.',
      ageLabels: {
        child: '0 to 5 years (Lap infant · Free)',
        minor: '6 to 17 years (Paying minor)',
        adult: '18 years or older (Paying adult)'
      },
      stepCopy: {
        cadastro: {
          eyebrow: 'Registration',
          title: 'Who is boarding with you?',
          description: 'Start with the primary contact. Then enter the full name and CPF / ID of each group member, including yourself.'
        },
        pagamento: {
          eyebrow: 'Payment · awaiting confirmation',
          title: 'Pay to confirm your booking',
          description: 'Open your banking app and scan the QR Code, or copy & paste the Pix code. Then wait on this page for confirmation.'
        },
        confirmacao: {
          eyebrow: 'Booking confirmed',
          title: 'Payment confirmed. Your booking is registered.',
          description: 'Your booking has been registered. Keep your booking code — it identifies your group at boarding.'
        }
      },
      stepInfo: {
        1: {
          eyebrow: 'Step 1 of 3 · Contact',
          title: 'Who is responsible for the booking?',
          description: 'Enter the details of the person managing the reservation and payment. Must be 18 or older.'
        },
        2: {
          eyebrow: 'Step 2 of 3 · Passengers',
          title: 'Who is boarding with you?',
          description: 'Select solo travel or add each person joining your group.'
        },
        3: {
          eyebrow: 'Step 3 of 3 · Review',
          title: 'Review your details before payment',
          description: 'Check route, passengers and total. Then accept the terms to generate Pix payment.'
        }
      },
      validation: {
        primaryName: 'Please enter the full name of the primary contact.',
        primaryCpf: 'Please enter a valid CPF / ID for the primary contact.',
        primaryBirth: 'Please enter a valid date of birth (DD/MM/YYYY) for the primary contact.',
        primaryAge18: 'The primary contact must be 18 years of age or older.',
        primaryWa: 'Please enter a valid WhatsApp number with area code.',
        primaryEmail: 'Please enter a valid email address.',
        step2SoloOrGroup: 'Check “Traveling solo” or add at least one person to your group to continue.',
        step3Terms: 'Please read and accept the conditions to proceed.',
        submitting: 'Generating your Pix payment securely…',
        submitErrorDefault: 'Could not generate Pix payment. Please try again.'
      },
      pix: {
        resuming: 'Resuming payment status check…',
        copiedSuccess: 'Code copied! <span aria-hidden="true">✓</span>',
        copiedStatus: 'Pix code copied. Now paste it into your banking app.',
        copyManual: 'Please select and copy the Pix code manually.',
        inactivePayment: 'This payment is no longer active. Please contact the organizers before trying a new booking.',
        statusUnavailable: 'Could not check payment status right now. We will retry in a moment.',
        awaiting: 'Awaiting payment. After paying, please wait on this page for automatic confirmation.'
      },
      confirmation: {
        dateLocale: 'en-US',
        childTag: 'Lap infant {num} (up to 5 yrs) · Free',
        childNote1: '+ 1 child up to 5 yrs on an adult’s lap (no extra fee).',
        childNotePlural: '+ {count} children up to 5 yrs on an adult’s lap (no extra fee).'
      }
    },
    es: {
      passenger: 'pasajero',
      passengers: 'pasajeros',
      primaryContact: 'Contacto Principal',
      primaryContactUpper: 'CONTACTO PRINCIPAL',
      passengerUpper: 'PASAJERO',
      childAgeUpper: '0 A 5 AÑOS',
      minorAgeUpper: '6 A 17 AÑOS',
      adultAgeUpper: '18 AÑOS O MÁS',
      notInformed: 'No informado',
      removePassengerTitle: 'Eliminar pasajero',
      removePassengerConfirm: '¿Estás seguro de que deseas eliminar a <strong>{name}</strong> del grupo?',
      removeAdultWarning: '<strong>Atención:</strong> Al eliminar este adulto, no habrá suficientes acompañantes para los niños de falda (0 a 5 años). Elimina primero a un niño de falda.',
      ageAlertChildLimit: '<strong>Atención:</strong> Cada niño de 0 a 5 años debe viajar en la falda de un adulto (18+). En este momento todos los cupos de falda están ocupados. Añade primero a otro adulto (18+) al grupo.',
      ageAlertSelect: 'Selecciona el rango de edad para continuar.',
      fieldAlertFullName: 'Ingresa el nombre completo (nombre y apellido).',
      fieldAlertCpf: 'Ingresa un CPF / documento válido.',
      fieldAlertCpfPrimary: 'Este CPF / documento ya pertenece al contacto principal de la reserva.',
      fieldAlertCpfDuplicate: 'Este CPF / documento ya fue añadido a otro pasajero del grupo.',
      fieldAlertWa: 'Ingresa un WhatsApp válido con código de área o deja el campo vacío.',
      fieldAlertEmail: 'Ingresa un e-mail válido o deja el campo vacío.',
      ageLabels: {
        child: '0 a 5 años (Niño en falda · Cortesía)',
        minor: '6 a 17 años (Menor pagante)',
        adult: '18 anos o más (Adulto pagante)'
      },
      stepCopy: {
        cadastro: {
          eyebrow: 'Registro',
          title: '¿Quién viajará contigo?',
          description: 'Comienza con el contacto principal. Luego ingresa el nombre completo y CPF / documento de cada persona del grupo, incluyéndote a ti.'
        },
        pagamento: {
          eyebrow: 'Pago · esperando confirmación',
          title: 'Paga para confirmar tu reserva',
          description: 'Abre la app de tu banco y escanea el código QR, o usa el Pix Copiar y Pegar. Luego espera la confirmación en esta página.'
        },
        confirmacao: {
          eyebrow: 'Reserva confirmada',
          title: 'Pago confirmado. Tu reserva está registrada.',
          description: 'Tu reserva ha sido registrada. Guarda el código de reserva — es el que identifica a tu grupo en el embarque.'
        }
      },
      stepInfo: {
        1: {
          eyebrow: 'Paso 1 de 3 · Contacto',
          title: '¿Quién es el responsable de la reserva?',
          description: 'Ingresa los datos de la persona responsable de la reserva y del pago. Debe tener 18 años o más.'
        },
        2: {
          eyebrow: 'Paso 2 de 3 · Pasajeros',
          title: '¿Quién viajará contigo?',
          description: 'Indica si viajas solo(a) o añade a cada persona que abordará contigo.'
        },
        3: {
          eyebrow: 'Paso 3 de 3 · Revisión',
          title: 'Revisa los datos antes del pago',
          description: 'Verifica la ruta, los pasajeros y el total. Luego acepta los términos para generar el pago Pix.'
        }
      },
      validation: {
        primaryName: 'Ingresa el nombre completo del contacto principal.',
        primaryCpf: 'Ingresa un CPF / documento válido para el contacto principal.',
        primaryBirth: 'Ingresa una fecha de nacimiento válida (DD/MM/AAAA) para el contacto principal.',
        primaryAge18: 'El contacto principal / responsable financiero debe tener 18 años o más.',
        primaryWa: 'Ingresa un WhatsApp válido con código de área.',
        primaryEmail: 'Ingresa un e-mail válido.',
        step2SoloOrGroup: 'Marca “Viajo solo(a)” o añade al menos a una persona al grupo para continuar.',
        step3Terms: 'Lee y acepta los términos para continuar.',
        submitting: 'Generando tu pago Pix con total seguridad…',
        submitErrorDefault: 'No fue posible generar el Pix. Inténtalo de nuevo.'
      },
      pix: {
        resuming: 'Reanudando la verificación del pago…',
        copiedSuccess: '¡Código copiado! <span aria-hidden="true">✓</span>',
        copiedStatus: 'Código Pix copiado. Ahora pégalo en la app de tu banco.',
        copyManual: 'Selecciona y copia el código Pix manualmente.',
        inactivePayment: 'Este pago no está activo. Habla con la organización antes de intentar una nueva reserva.',
        statusUnavailable: 'No pudimos verificar el pago ahora. Lo reintentaremos en unos instantes.',
        awaiting: 'Esperando el pago. Luego de pagar, espera la confirmación automática en esta página.'
      },
      confirmation: {
        dateLocale: 'es-ES',
        childTag: 'Niño en falda {num} (hasta 5 años) · Cortesía',
        childNote1: '+ 1 niño de hasta 5 años en la falda de un responsable (sin costo).',
        childNotePlural: '+ {count} niños de hasta 5 años en la falda de un responsable (sin costo).'
      }
    }
  };

  var t = I18N_BUS[langKey] || I18N_BUS.pt;

  function displayUppercase(value) {
    return String(value || '').toLocaleUpperCase(t.confirmation.dateLocale || 'pt-BR');
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
    if (summaryCount) summaryCount.textContent = displayCount(totalP, t.passenger, t.passengers);
    if (summaryPaying) summaryPaying.textContent = displayCount(paying, t.passenger, t.passengers);
    if (total) {
      var prevText = total.textContent;
      var newText = 'R$ ' + amount;
      if (prevText !== newText) {
        total.textContent = newText;
        total.classList.remove('is-updating');
        void total.offsetWidth; // Força reflow para reiniciar animação de pulso
        total.classList.add('is-updating');
      }
    }
  }

  function setStep(step) {
    var copy = t.stepCopy[step];
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
    var currentInfo = t.stepInfo[currentWizardStep] || t.stepInfo[1];
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
      var pName = normalizeFullName(primaryName.value) || t.primaryContactUpper;
      var pCpf = maskCpf(primaryCpf.value) || '—';
      var pWa = primaryWhatsapp ? digits(primaryWhatsapp.value) : '';
      var pEmail = primaryEmail ? normalizeEmail(primaryEmail.value) : '';

      var pNameEl = document.getElementById('primary-summary-name');
      if (pNameEl) pNameEl.textContent = displayUppercase(pName);

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
          pEmailEl.textContent = normalizeEmail(pEmail);
          pEmailWrap.hidden = false;
        } else {
          pEmailWrap.hidden = true;
        }
      }
    }

    addedPassengers.forEach(function (p, index) {
      var pNum = index + 2;
      var roleText = t.adultAgeUpper;
      if (p.ageGroup === 'child') {
        roleText = t.childAgeUpper;
      } else if (p.ageGroup === 'minor') {
        roleText = t.minorAgeUpper;
      }

      var card = document.createElement('div');
      card.className = 'bus-passenger bus-passenger--added' + (p.ageGroup === 'child' ? ' bus-passenger--child' : '');
      card.dataset.passengerId = p.id;

      var detailsHtml = '';
      if (p.ageGroup === 'child') {
        detailsHtml = '<div class="bus-passenger__child-layout">' +
          '<img src="/assets/images/brand/meeple-baby.webp" alt="Criança (0 a 5 anos)" class="bus-passenger__meeple-img" width="48" height="48" loading="lazy">' +
          '<div class="bus-passenger__child-data">' +
          '<span>Nome: <strong>' + escapeHtml(displayUppercase(p.fullName)) + '</strong></span>' +
          '<span>CPF / ID: <strong>' + maskCpf(p.cpf) + '</strong></span>' +
          '</div>' +
          '</div>';
      } else {
        detailsHtml = '<span>Nome: <strong>' + escapeHtml(displayUppercase(p.fullName)) + '</strong></span>' +
          '<span>CPF / ID: <strong>' + maskCpf(p.cpf) + '</strong></span>';
        if (p.whatsapp) {
          detailsHtml += '<span>WhatsApp: <strong>' + maskWhatsapp(p.whatsapp) + '</strong></span>';
        }
        if (p.email) {
          detailsHtml += '<span>E-mail: <strong>' + escapeHtml(normalizeEmail(p.email)) + '</strong></span>';
        }
      }

      card.innerHTML = '<div class="bus-passenger__header">' +
        '<div class="bus-passenger__header-title">' +
        '<span class="bus-passenger__header-num">' + t.passengerUpper + ' ' + pNum + '</span>' +
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
        substepAgeAlert.textContent = t.ageAlertSelect;
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
          substepAgeAlert.innerHTML = t.ageAlertChildLimit;
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
        substepFieldsAlert.textContent = t.fieldAlertFullName;
        substepFieldsAlert.hidden = false;
      }
      if (newPName) newPName.focus();
      return;
    }

    var cpfVal = newPCpf ? newPCpf.value : '';
    if (!validCpf(cpfVal)) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = t.fieldAlertCpf;
        substepFieldsAlert.hidden = false;
      }
      if (newPCpf) newPCpf.focus();
      return;
    }

    var cpfD = digits(cpfVal);
    if (cpfD === digits(primaryCpf.value)) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = t.fieldAlertCpfPrimary;
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
        substepFieldsAlert.textContent = t.fieldAlertCpfDuplicate;
        substepFieldsAlert.hidden = false;
      }
      if (newPCpf) newPCpf.focus();
      return;
    }

    var waRaw = newPWhatsapp ? newPWhatsapp.value : '';
    var waVal = waRaw.trim() ? normalizeWhatsappDigits(waRaw) : '';
    if (waRaw.trim() && !waVal) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = t.fieldAlertWa;
        substepFieldsAlert.hidden = false;
      }
      if (newPWhatsapp) newPWhatsapp.focus();
      return;
    }

    var emailVal = newPEmail ? normalizeEmail(newPEmail.value) : '';
    if (emailVal && !newPEmail.validity.valid) {
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = t.fieldAlertEmail;
        substepFieldsAlert.hidden = false;
      }
      if (newPEmail) newPEmail.focus();
      return;
    }

    pendingNewPassenger.fullName = name;
    pendingNewPassenger.cpf = cpfD;
    pendingNewPassenger.whatsapp = waVal;
    pendingNewPassenger.email = emailVal;

    if (reviewPersonAge) reviewPersonAge.textContent = t.ageLabels[pendingNewPassenger.ageGroup] || '—';
    if (reviewPersonName) reviewPersonName.textContent = displayUppercase(pendingNewPassenger.fullName);
    if (reviewPersonCpf) reviewPersonCpf.textContent = maskCpf(pendingNewPassenger.cpf);

    if (pendingNewPassenger.ageGroup === 'child') {
      if (reviewPersonWaRow) reviewPersonWaRow.hidden = true;
      if (reviewPersonEmailRow) reviewPersonEmailRow.hidden = true;
    } else {
      if (reviewPersonWaRow) {
        reviewPersonWaRow.hidden = false;
        if (reviewPersonWhatsapp) reviewPersonWhatsapp.textContent = pendingNewPassenger.whatsapp ? maskWhatsapp(pendingNewPassenger.whatsapp) : t.notInformed;
      }
      if (reviewPersonEmailRow) {
        reviewPersonEmailRow.hidden = false;
        if (reviewPersonEmail) reviewPersonEmail.textContent = pendingNewPassenger.email ? normalizeEmail(pendingNewPassenger.email) : t.notInformed;
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
      removeDialogText.innerHTML = t.removePassengerConfirm.replace('{name}', escapeHtml(p.fullName));
    }

    if (removeDialogWarning) {
      if (p.ageGroup === 'adult') {
        var remainingAdults = 1 + addedPassengers.filter(function (x) { return x.ageGroup === 'adult' && x.id !== passengerId; }).length;
        var currentChildren = getChildrenCount();
        if (currentChildren > remainingAdults) {
          removeDialogWarning.innerHTML = t.removeAdultWarning;
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
    p1Item.innerHTML = '<span class="bus-review-card__item-name">1. ' + (escapeHtml(displayUppercase(normalizeFullName(primaryName.value))) || t.primaryContactUpper) + '</span>' +
      '<span class="bus-review-card__item-details"><small class="bus-passenger__tag bus-passenger__tag--primary">' + t.primaryContact + '</small></span>';
    reviewPassengersList.appendChild(p1Item);

    // Passageiros Adicionais
    addedPassengers.forEach(function (p, index) {
      var pNum = index + 2;
      var item = document.createElement('li');
      item.className = 'bus-review-card__item';
      var tagHtml = '';
      if (p.ageGroup === 'child') {
        tagHtml = '<small class="bus-passenger__tag">' + (t.ageLabels.child.split('(')[0].trim()) + '</small>';
      } else if (p.ageGroup === 'minor') {
        tagHtml = '<small class="bus-passenger__tag bus-passenger__tag--minor">' + (t.ageLabels.minor.split('(')[0].trim()) + '</small>';
      } else {
        tagHtml = '<small class="bus-passenger__tag bus-passenger__tag--adult">' + (t.ageLabels.adult.split('(')[0].trim()) + '</small>';
      }

      item.innerHTML = '<span class="bus-review-card__item-name">' + pNum + '. ' + escapeHtml(displayUppercase(p.fullName)) + '</span>' +
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
    if (name.split(' ').length < 2) return invalid(t.validation.primaryName, primaryName);
    if (!validCpf(primaryCpf.value)) return invalid(t.validation.primaryCpf, primaryCpf);
    var birthParsed = primaryBirth ? parseBirthDate(primaryBirth.value) : null;
    if (!birthParsed) return invalid(t.validation.primaryBirth, primaryBirth);
    if (birthParsed.age < 18) return invalid(t.validation.primaryAge18, primaryBirth);
    if (!normalizeWhatsappDigits(primaryWhatsapp.value)) {
      return invalid(t.validation.primaryWa, primaryWhatsapp);
    }
    if (!primaryEmail.validity.valid) return invalid(t.validation.primaryEmail, primaryEmail);
    setStatus('', false);
    return true;
  }

  function validateStep2() {
    clearInvalid();
    if (!soloTraveler.checked && addedPassengers.length === 0) {
      return invalid(t.validation.step2SoloOrGroup, soloTraveler);
    }
    setStatus('', false);
    return true;
  }

  function validateStep3() {
    clearInvalid();
    var terms = document.getElementById('bus-terms');
    if (!terms || !terms.checked) {
      setStatus(t.validation.step3Terms, true);
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
      whatsapp: normalizeWhatsappDigits(primaryWhatsapp.value),
      email: normalizeEmail(primaryEmail.value),
      age_group: 'adult',
      is_minor: false
    }];

    payingPassengers.forEach(function (p) {
      passengers.push({
        full_name: normalizeFullName(p.fullName),
        cpf: digits(p.cpf),
        whatsapp: p.whatsapp ? normalizeWhatsappDigits(p.whatsapp) : '',
        email: normalizeEmail(p.email || ''),
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
        email: normalizeEmail(primaryEmail.value),
        whatsapp: normalizeWhatsappDigits(primaryWhatsapp.value),
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

  function persistCheckoutState() {
    if (!activeRegistrationId || !confirmedSnapshot) return;

    try {
      sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        registrationId: activeRegistrationId,
        orderId: confirmedSnapshot.orderId || '',
        totalAmount: confirmedSnapshot.totalAmount || '',
        payment: activePayment ? {
          qrCode: activePayment.qrCode || '',
          qrCodeBase64: activePayment.qrCodeBase64 || '',
          ticketUrl: activePayment.ticketUrl || ''
        } : null,
        snapshot: confirmedSnapshot,
        savedAt: Date.now()
      }));
    } catch (_error) {
      // A private browsing policy or a full sessionStorage must not block Pix.
    }
  }

  function readCheckoutState() {
    try {
      var raw = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (!raw) return null;
      var saved = JSON.parse(raw);
      if (!saved || !saved.registrationId || !saved.snapshot) return null;
      // A stale tab should not unexpectedly reopen an old checkout days later.
      if (saved.savedAt && Date.now() - Number(saved.savedAt) > 24 * 60 * 60 * 1000) {
        sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
        return null;
      }
      return saved;
    } catch (_error) {
      return null;
    }
  }

  function restoreCheckoutState() {
    var saved = readCheckoutState();
    if (!saved) return;

    activeRegistrationId = saved.registrationId;
    confirmedSnapshot = saved.snapshot;
    activePayment = saved.payment || null;
    setStep('pagamento');
    form.hidden = true;
    paymentPanel.hidden = false;

    if (activePayment && activePayment.qrCodeBase64) {
      pixQr.src = 'data:image/png;base64,' + activePayment.qrCodeBase64;
    }
    if (activePayment && activePayment.qrCode) {
      pixCopyCode.value = activePayment.qrCode;
    }
    if (activePayment && activePayment.ticketUrl) {
      ticketLink.href = activePayment.ticketUrl;
      ticketLink.hidden = false;
    }

    paymentStatus.textContent = t.pix.resuming;
    startExpiryCountdown(activeRegistrationId);
    pollPaymentStatus(activeRegistrationId);
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
      confirmedIssued.textContent = new Date().toLocaleString(t.confirmation.dateLocale || 'pt-BR', {
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
      var papel = index === 0 ? t.primaryContact : t.passenger + ' ' + (index + 1);
      if (isMinor) {
        papel += ' · ' + t.minorAgeUpper;
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
      tag.textContent = t.confirmation.childTag.replace('{num}', String(index + 1));
      item.append(label, tag);
      confirmedPassengers.appendChild(item);
    });

    var kids = Number(snap.childrenCount || 0);
    if (kids > 0) {
      confirmedChildren.hidden = false;
      confirmedChildren.textContent = kids === 1
        ? t.confirmation.childNote1
        : t.confirmation.childNotePlural.replace('{count}', String(kids));
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
    persistCheckoutState();
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
        paymentStatus.textContent = t.pix.inactivePayment;
        paymentPanel.dataset.paymentState = data.status;
        stopExpiryCountdown();
        return;
      }
      if (typeof onPending === 'function') onPending();
      statusTimer = window.setTimeout(function () {
        pollPaymentStatus(registrationId, options);
      }, 3000);
    }).catch(function () {
      paymentStatus.textContent = t.pix.statusUnavailable;
      statusTimer = window.setTimeout(function () {
        pollPaymentStatus(registrationId, options);
      }, 5000);
    });
  }

  function showPayment(payment) {
    activeRegistrationId = payment.registrationId;
    activePayment = payment;
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
        return { name: c.full_name };
      })
    };
    persistCheckoutState();
    form.hidden = true;
    paymentPanel.hidden = false;
    pixQr.src = 'data:image/png;base64,' + payment.qrCodeBase64;
    pixCopyCode.value = payment.qrCode;
    if (payment.ticketUrl) {
      ticketLink.href = payment.ticketUrl;
      ticketLink.hidden = false;
    }
    paymentStatus.textContent = t.pix.awaiting;
    startExpiryCountdown(payment.registrationId);
    pollPaymentStatus(payment.registrationId);
    paymentPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitForm(event) {
    event.preventDefault();
    if (!validateForm()) return;

    submit.disabled = true;
    setStatus(t.validation.submitting, false);
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
      if (!response.ok) throw new Error(data.error || t.validation.submitErrorDefault);
      showPayment(data);
    } catch (error) {
      setStatus(error.message || t.validation.submitErrorDefault, true);
      submit.disabled = false;
    }
  }

  // Mascaras nos inputs do Contato Principal
  primaryCpf.addEventListener('input', function (event) { event.currentTarget.value = maskCpf(event.currentTarget.value); });
  if (primaryEmail) {
    primaryEmail.addEventListener('input', function (event) { event.currentTarget.value = normalizeEmail(event.currentTarget.value); });
  }
  if (primaryBirth) {
    primaryBirth.addEventListener('input', function (event) { event.currentTarget.value = maskDate(event.currentTarget.value); });
  }
  primaryWhatsapp.addEventListener('input', function (event) { event.currentTarget.value = maskWhatsapp(event.currentTarget.value); });
  primaryWhatsapp.addEventListener('blur', function () {
    if (normalizeWhatsappDigits(primaryWhatsapp.value)) {
      primaryWhatsapp.removeAttribute('aria-invalid');
      return;
    }
    primaryWhatsapp.setAttribute('aria-invalid', 'true');
    setStatus(t.validation.primaryWa, true);
  });

  // Mascaras nos inputs do Mini Multi-step
  if (newPCpf) {
    newPCpf.addEventListener('input', function (event) { event.currentTarget.value = maskCpf(event.currentTarget.value); });
  }
  if (newPWhatsapp) {
    newPWhatsapp.addEventListener('input', function (event) { event.currentTarget.value = maskWhatsapp(event.currentTarget.value); });
    newPWhatsapp.addEventListener('blur', function () {
      if (!newPWhatsapp.value.trim() || normalizeWhatsappDigits(newPWhatsapp.value)) {
        newPWhatsapp.removeAttribute('aria-invalid');
        return;
      }
      newPWhatsapp.setAttribute('aria-invalid', 'true');
      if (substepFieldsAlert) {
        substepFieldsAlert.textContent = t.fieldAlertWa;
        substepFieldsAlert.hidden = false;
      }
    });
  }
  if (newPEmail) {
    newPEmail.addEventListener('input', function (event) { event.currentTarget.value = normalizeEmail(event.currentTarget.value); });
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
      window.location.href = 'https://kriativosonboard.com.br/';
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
      var originalHTML = copyPix.innerHTML;
      try {
        await navigator.clipboard.writeText(pixCopyCode.value);
        copyPix.classList.add('is-copied');
        copyPix.innerHTML = t.pix.copiedSuccess;
        setTimeout(function () {
          copyPix.classList.remove('is-copied');
          copyPix.innerHTML = originalHTML;
        }, 2200);
        paymentStatus.textContent = t.pix.copiedStatus;
      } catch (_error) {
        pixCopyCode.focus();
        pixCopyCode.select();
        paymentStatus.textContent = t.pix.copyManual;
      }
    });
  }

  setStep('cadastro');
  setWizardStep(1);
  syncGroupModeState();
  restoreCheckoutState();

  // Hero: Efeito de perspectiva sutil na ilustração do ônibus (Editorial Craft)
  (function () {
    var visual = document.getElementById('heroVisual');
    if (!visual) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    var artWrap = visual.querySelector('.bus-hero__art-wrap') || visual;
    var hero = visual.closest('.bus-hero') || visual;
    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;
    var isHovered = false;
    var rafId = null;

    function update() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      artWrap.style.setProperty('--tilt-x', currentX.toFixed(2) + 'deg');
      artWrap.style.setProperty('--tilt-y', currentY.toFixed(2) + 'deg');

      if (isHovered || Math.abs(targetX - currentX) > 0.04 || Math.abs(targetY - currentY) > 0.04) {
        rafId = requestAnimationFrame(update);
      } else {
        artWrap.style.setProperty('--tilt-x', '0deg');
        artWrap.style.setProperty('--tilt-y', '0deg');
        rafId = null;
      }
    }

    hero.addEventListener('pointermove', function (e) {
      var rect = visual.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      var dx = (e.clientX - centerX) / (window.innerWidth / 2);
      var dy = (e.clientY - centerY) / (window.innerHeight / 2);

      targetY = Math.max(-6, Math.min(6, dx * 6));
      targetX = Math.max(-5, Math.min(5, -dy * 5));

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

  /* Modal do Ponto de Encontro (Barra Funda): iframe sob demanda em dialog nativo */
  (function meetingMap() {
    var dialog = document.getElementById('meetingMapModal');
    var openBtn = document.getElementById('meetingMapOpen');
    var closeBtn = document.getElementById('meetingMapClose');
    var frame = document.getElementById('meetingMapFrame');
    if (!dialog || !openBtn || !closeBtn || !frame || typeof dialog.showModal !== 'function') {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var stage = dialog.querySelector('.map-modal__stage');
    var source = frame.dataset.src;
    frame.addEventListener('load', function () {
      if (frame.src && frame.src !== 'about:blank' && stage) stage.classList.remove('is-loading');
    });

    openBtn.addEventListener('click', function () {
      if (stage) stage.classList.add('is-loading');
      frame.src = source;
      dialog.showModal();
    });

    closeBtn.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      frame.src = 'about:blank';
      if (stage) stage.classList.remove('is-loading');
      openBtn.focus();
    });
  })();

  // Câmbio de moedas para visitantes internacionais (USD/EUR para BRL)
  (function initCurrencyRates() {
    var rateEls = document.querySelectorAll('[data-currency-rate]');
    if (!rateEls.length) return;

    var CACHE_KEY = 'kob_fx_rates_v1';
    var cached = null;
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Date.now() - parsed.t < 3600000) cached = parsed.data;
      }
    } catch (e) {}

    function applyRates(rates) {
      rateEls.forEach(function (el) {
        var cur = el.getAttribute('data-currency-rate');
        if (rates && rates[cur]) {
          var val = parseFloat(rates[cur]);
          if (!isNaN(val) && val > 0) {
            el.textContent = 'R$ ' + val.toFixed(2).replace('.', ',');
          }
        }
      });
    }

    if (cached) {
      applyRates(cached);
      return;
    }

    if (typeof fetch === 'function') {
      fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL')
        .then(function (res) {
          if (!res.ok) throw new Error('FX API status ' + res.status);
          return res.json();
        })
        .then(function (data) {
          var rates = {};
          if (data.USDBRL && data.USDBRL.bid) rates.USD = data.USDBRL.bid;
          if (data.EURBRL && data.EURBRL.bid) rates.EUR = data.EURBRL.bid;
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: rates }));
          } catch (e) {}
          applyRates(rates);
        })
        .catch(function () {
          // Mantém valores de referência estáticos
        });
    }
  })();

  // Persistência da preferência manual de idioma
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.lang-switch__btn');
    if (!btn) return;
    var hreflang = btn.getAttribute('hreflang') || '';
    if (hreflang.toLowerCase().indexOf('pt') !== -1) {
      try { localStorage.setItem('kob_lang_pref', 'pt'); } catch (err) {}
    } else if (hreflang.toLowerCase().indexOf('en') !== -1) {
      try { localStorage.setItem('kob_lang_pref', 'en'); } catch (err) {}
    } else if (hreflang.toLowerCase().indexOf('es') !== -1) {
      try { localStorage.setItem('kob_lang_pref', 'es'); } catch (err) {}
    }
  });

})();
