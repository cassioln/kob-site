/* Painel de gestão de reservas — transporte fretado.
 *
 * A interface não altera pagamentos nem dados de passageiros. As ações de Frota
 * alteram apenas a alocação operacional, sempre por endpoints autenticados.
 *
 * Sem dependências externas — o site é estático e publicado por FTP, então
 * adicionar bundler ou biblioteca de planilha só para exportar não se paga.
 */
(function () {
  'use strict';

  var API = 'api/bus-admin-data';
  var API_RECONCILE = 'api/bus-admin-reconcile';
  var API_LISTA = 'api/bus-manifest';
  var API_AUTO_BALANCE = 'api/bus-fleet-auto-balance';
  var API_VIP_CREATE = 'api/bus-vip-create';
  var API_VIP_DELETE = 'api/bus-vip-delete';
  var MEEPLE_PATH_D = 'M256 54.99c-27 0-46.418 14.287-57.633 32.23-10.03 16.047-14.203 34.66-15.017 50.962-30.608 15.135-64.515 30.394-91.815 45.994-14.32 8.183-26.805 16.414-36.203 25.26C45.934 218.28 39 228.24 39 239.99c0 5 2.44 9.075 5.19 12.065 2.754 2.99 6.054 5.312 9.812 7.48 7.515 4.336 16.99 7.95 27.412 11.076 15.483 4.646 32.823 8.1 47.9 9.577-14.996 25.84-34.953 49.574-52.447 72.315C56.65 378.785 39 403.99 39 431.99c0 4-.044 7.123.31 10.26.355 3.137 1.256 7.053 4.41 10.156 3.155 3.104 7.017 3.938 10.163 4.28 3.146.345 6.315.304 10.38.304h111.542c8.097 0 14.026.492 20.125-3.43 6.1-3.92 8.324-9.275 12.67-17.275l.088-.16.08-.166s9.723-19.77 21.324-39.388c5.8-9.808 12.097-19.576 17.574-26.498 2.74-3.46 5.304-6.204 7.15-7.754.564-.472.82-.56 1.184-.76.363.2.62.288 1.184.76 1.846 1.55 4.41 4.294 7.15 7.754 5.477 6.922 11.774 16.69 17.574 26.498 11.6 19.618 21.324 39.387 21.324 39.387l.08.165.088.16c4.346 8 6.55 13.323 12.61 17.254 6.058 3.93 11.974 3.45 19.957 3.45H448c4 0 7.12.043 10.244-.304 3.123-.347 6.998-1.21 10.12-4.332 3.12-3.122 3.984-6.997 4.33-10.12.348-3.122.306-6.244.306-10.244 0-28-17.65-53.205-37.867-79.488-17.493-22.74-37.45-46.474-52.447-72.315 15.077-1.478 32.417-4.93 47.9-9.576 10.422-3.125 19.897-6.74 27.412-11.075 3.758-2.168 7.058-4.49 9.81-7.48 2.753-2.99 5.192-7.065 5.192-12.065 0-11.75-6.934-21.71-16.332-30.554-9.398-8.846-21.883-17.077-36.203-25.26-27.3-15.6-61.207-30.86-91.815-45.994-.814-16.3-4.988-34.915-15.017-50.96C302.418 69.276 283 54.99 256 54.99z';

  var isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  );

  var el = {
    carregando: document.getElementById('estado-carregando'),
    estadoLogin: document.getElementById('estado-login'),
    loginForm: document.getElementById('form-login'),
    tokenInput: document.getElementById('token-input'),
    erroLogin: document.getElementById('erro-login'),
    botaoSair: document.getElementById('botao-sair'),
    erro: document.getElementById('estado-erro'),
    erroDetalhe: document.getElementById('erro-detalhe'),
    vazio: document.getElementById('estado-vazio'),
    dados: document.getElementById('painel-dados'),
    corpo: document.getElementById('tabela-corpo'),
    semResultado: document.getElementById('sem-resultado'),
    busca: document.getElementById('busca'),
    contagem: document.getElementById('contagem'),
    atualizadoEm: document.getElementById('atualizado-em'),
    recarregar: document.getElementById('recarregar'),
    tentarNovamente: document.getElementById('tentar-novamente'),
    limparBusca: document.getElementById('limpar-busca'),
    exportar: document.getElementById('exportar-excel'),
    baixarLista: document.getElementById('baixar-lista'),
    rTotal: document.getElementById('r-total'),
    rTotalNota: document.getElementById('r-total-nota'),
    rReservas: document.getElementById('r-reservas'),
    rPendentes: document.getElementById('r-pendentes'),
    rReceita: document.getElementById('r-receita'),
    rSemTelefone: document.getElementById('r-sem-telefone'),
    filtroOnibus: document.getElementById('filtro-onibus'),
    abas: document.querySelectorAll('.painel-abas__botao'),
    conteudosAba: document.querySelectorAll('.painel-aba-conteudo'),
    frotaContainer: document.getElementById('frota-onibus-container'),
    otimizarDistribuicao: document.getElementById('otimizar-distribuicao'),
    frotaOtimizacao: document.getElementById('frota-otimizacao'),
    frotaOtimizacaoResumo: document.getElementById('frota-otimizacao-resumo'),
    frotaOtimizacaoMovimentos: document.getElementById('frota-otimizacao-movimentos'),
    frotaOtimizacaoEspera: document.getElementById('frota-otimizacao-espera'),
    frotaOtimizacaoCancelar: document.getElementById('frota-otimizacao-cancelar'),
    frotaOtimizacaoAplicar: document.getElementById('frota-otimizacao-aplicar'),
    frotaSemOnibus: document.getElementById('frota-sem-onibus'),
    frotaSemOnibusLista: document.querySelector('#frota-sem-onibus .frota-sem-onibus__lista'),
    vipAdicionar: document.getElementById('adicionar-vip'),
    vipDialog: document.getElementById('painel-vip-dialog'),
    vipForm: document.getElementById('form-vip'),
    vipFormularios: document.getElementById('vip-formularios'),
    vipFormErro: document.getElementById('vip-form-erro'),
    vipCancelar: document.getElementById('vip-cancelar'),
    vipAdicionarOutro: document.getElementById('vip-adicionar-outro'),
    vipConfirmar: document.getElementById('vip-confirmar'),
    alertaDialog: document.getElementById('painel-alerta-dialog'),
    dialogTitulo: document.getElementById('painel-dialog-titulo'),
    dialogMensagem: document.getElementById('painel-dialog-mensagem'),
    dialogIcone: document.getElementById('painel-dialog-icone'),
    dialogFechar: document.getElementById('painel-dialog-fechar'),
    dialogConfirmar: document.getElementById('painel-dialog-confirmar')
  };

  var estado = {
    reservas: [],
    filtro: 'todas',
    filtroOnibus: 'todos',
    busca: '',
    token: '',
    frota: null,
    frotaBalancePreview: null,
    vipDrafts: [],
    vipEnviando: false,
    reconciliandoPendencias: false
  };

  // Número do grupo atualmente realçado. Guardado fora do handler para o
  // mouseover poder sair cedo quando o cursor apenas anda entre linhas da MESMA
  // reserva: sem isso, cada célula percorrida repintaria o grupo inteiro.
  var grupoRealcado = null;
  var frotaCardsCompactos = {};

  // ---- utilidades ---------------------------------------------------------

  function mostrarAlertaModal(titulo, mensagem, tipo) {
    tipo = tipo || 'erro';
    var dialog = el.alertaDialog || document.getElementById('painel-alerta-dialog');
    if (!dialog) {
      alert((titulo ? titulo + ': ' : '') + mensagem);
      return;
    }

    var tituloEl = el.dialogTitulo || document.getElementById('painel-dialog-titulo');
    var msgEl = el.dialogMensagem || document.getElementById('painel-dialog-mensagem');
    var iconeEl = el.dialogIcone || document.getElementById('painel-dialog-icone');
    var btnFechar = el.dialogFechar || document.getElementById('painel-dialog-fechar');
    var btnConfirmar = el.dialogConfirmar || document.getElementById('painel-dialog-confirmar');

    if (tituloEl) tituloEl.textContent = titulo || 'Aviso';
    if (msgEl) msgEl.textContent = mensagem || '';

    if (iconeEl) {
      iconeEl.className = 'bus-dialog__badge-icone bus-dialog__badge-icone--' + (tipo === 'ok' ? 'ok' : (tipo === 'aviso' ? 'aviso' : 'erro'));
      if (tipo === 'ok') {
        iconeEl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      } else if (tipo === 'aviso') {
        iconeEl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
      } else {
        iconeEl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      }
    }

    if (btnFechar) {
      btnFechar.textContent = 'Entendido';
      btnFechar.onclick = function () {
        dialog.close();
      };
    }
    if (btnConfirmar) {
      btnConfirmar.hidden = true;
      btnConfirmar.onclick = null;
    }

    // Fechar ao clicar no backdrop
    dialog.onclick = function (e) {
      if (e.target === dialog) {
        dialog.close();
      }
    };

    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
      } catch (err) {
        dialog.setAttribute('open', '');
      }
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function mostrarConfirmacaoModal(titulo, mensagem, rotuloConfirmar) {
    var dialog = el.alertaDialog || document.getElementById('painel-alerta-dialog');
    if (!dialog) return Promise.resolve(window.confirm((titulo ? titulo + ': ' : '') + mensagem));

    var tituloEl = el.dialogTitulo || document.getElementById('painel-dialog-titulo');
    var msgEl = el.dialogMensagem || document.getElementById('painel-dialog-mensagem');
    var iconeEl = el.dialogIcone || document.getElementById('painel-dialog-icone');
    var btnFechar = el.dialogFechar || document.getElementById('painel-dialog-fechar');
    var btnConfirmar = el.dialogConfirmar || document.getElementById('painel-dialog-confirmar');

    if (tituloEl) tituloEl.textContent = titulo || 'Confirmar ação';
    if (msgEl) msgEl.textContent = mensagem || '';
    if (iconeEl) {
      iconeEl.className = 'bus-dialog__badge-icone bus-dialog__badge-icone--aviso';
      iconeEl.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }

    return new Promise(function (resolve) {
      var resolvido = false;
      var encerrar = function (resultado) {
        if (resolvido) return;
        resolvido = true;
        if (btnConfirmar) btnConfirmar.hidden = true;
        if (btnFechar) btnFechar.textContent = 'Entendido';
        if (dialog.open) dialog.close();
        resolve(resultado);
      };

      if (btnFechar) {
        btnFechar.textContent = 'Cancelar';
        btnFechar.onclick = function () { encerrar(false); };
      }
      if (btnConfirmar) {
        btnConfirmar.hidden = false;
        btnConfirmar.textContent = rotuloConfirmar || 'Confirmar';
        btnConfirmar.onclick = function () { encerrar(true); };
      }
      dialog.onclick = function (e) {
        if (e.target === dialog) encerrar(false);
      };
      dialog.oncancel = function (e) {
        e.preventDefault();
        encerrar(false);
      };

      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch (err) {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
    });
  }

  function mostrar(secao) {
    [el.carregando, el.estadoLogin, el.erro, el.dados].forEach(function (s) {
      if (s) s.hidden = s !== secao;
    });
    if (el.vazio) {
      el.vazio.hidden = secao === el.dados
        ? estado.reservas.length > 0
        : secao !== el.vazio;
    }
    if (el.botaoSair) {
      el.botaoSair.hidden = (secao !== el.dados && secao !== el.vazio);
    }
  }

  function plural(n, singular, pluralForma) {
    return n + ' ' + (n === 1 ? singular : pluralForma);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatarCpf(cpf) {
    var digitos = String(cpf || '').replace(/\D/g, '').slice(0, 11);
    if (digitos.length > 9) {
      return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    }
    if (digitos.length > 6) {
      return digitos.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    }
    if (digitos.length > 3) {
      return digitos.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    return digitos;
  }

  function formatarWhatsapp(whatsapp) {
    var brutos = String(whatsapp || '').replace(/\D/g, '').slice(0, 13);
    var digitos = brutos.startsWith('55') && (brutos.length === 12 || brutos.length === 13)
      ? brutos.slice(2)
      : brutos.slice(0, 11);
    if (digitos.length > 10) {
      return digitos.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
    }
    if (digitos.length > 6) {
      return digitos.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    }
    if (digitos.length > 2) {
      return digitos.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    }
    return digitos;
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

  function isValidBrazilianPhoneDigits(national) {
    if (!/^\d+$/.test(national) || !brazilianDdds.has(national.slice(0, 2))) return false;
    var subscriber = national.slice(2);
    if (/^(\d)\1+$/.test(subscriber)) return false;
    if (national.length === 10) return /^[2-5]\d{7}$/.test(subscriber);
    if (national.length === 11) return /^9\d{8}$/.test(subscriber);
    return false;
  }

  function normalizarWhatsapp(whatsapp) {
    var todos = String(whatsapp || '').replace(/\D/g, '');
    var nacional = todos.startsWith('55') && (todos.length === 12 || todos.length === 13)
      ? todos.slice(2)
      : todos;
    return isValidBrazilianPhoneDigits(nacional) ? nacional : '';
  }

  function normalizarNomeCompleto(nome) {
    var normalizado = String(nome || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    return normalizado.split(' ').map(function (token, index) {
      if (index > 0 && personNameConnectors[token]) return token;
      return token.split(/([-'])/u).map(function (parte) {
        if (parte === '-' || parte === "'") return parte;
        return parte ? parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1) : parte;
      }).join('');
    }).join(' ');
  }

  function normalizarEmail(email) {
    return String(email || '').trim().toLocaleLowerCase('pt-BR');
  }

  function emailValido(email) {
    var valor = normalizarEmail(email);
    return valor.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  function criarLinkWhatsapp(telefone, nome) {
    var nacional = normalizarWhatsapp(telefone);
    if (!nacional) return null;

    var link = document.createElement('a');
    link.className = 'tabela__whatsapp-link';
    link.href = 'https://api.whatsapp.com/send?phone=55' + nacional;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Conversar com ' + (nome || 'passageiro') + ' pelo WhatsApp');

    var icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icone.setAttribute('viewBox', '0 0 24 24');
    icone.setAttribute('aria-hidden', 'true');
    var circulo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    circulo.setAttribute('d', 'M20.5 3.5A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.34.13 11.91c0 2.1.55 4.15 1.59 5.96L.03 24l6.27-1.64a11.9 11.9 0 0 0 5.75 1.46h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.16-3.47-8.41Zm-8.45 18.3h-.01a9.88 9.88 0 0 1-5.03-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.87 9.87 0 1 1 8.36 4.61Zm5.42-7.39c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-1.76-.88-2.91-1.57-4.07-3.55-.31-.53.31-.49.89-1.63.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.1 4.49 1.9.82 2.64.89 3.58.75.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z');
    icone.appendChild(circulo);
    var texto = document.createElement('span');
    texto.textContent = formatarWhatsapp(telefone);
    link.append(icone, texto);
    return link;
  }

  function badge(rotulo, tom) {
    var span = document.createElement('span');
    span.className = 'etiqueta etiqueta--' + tom;
    span.textContent = rotulo;
    return span;
  }

  function meepleDaReserva(reserva) {
    var pagantes = Number(reserva && reserva.pagantes || 0);
    var criancas = Number(reserva && reserva.criancas || 0);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var isGrupo = pagantes > 1 || criancas > 0;

    svg.setAttribute('viewBox', '0 0 512 512');
    svg.setAttribute('class', 'tabela__meeple ' + (reserva && reserva.is_vip
      ? 'tabela__meeple--vip'
      : (isGrupo ? 'tabela__meeple--grupo' : 'tabela__meeple--solo')));
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', MEEPLE_PATH_D);
    svg.appendChild(path);
    return svg;
  }

  function renderizarFiltroOnibus() {
    if (!el.filtroOnibus) return;
    var numeros = {};
    var frota = estado.frota && Array.isArray(estado.frota.onibus) ? estado.frota.onibus : [];
    frota.forEach(function (onibus) {
      var numero = Number(onibus.numero);
      if (Number.isInteger(numero) && numero > 0) numeros[numero] = true;
    });
    estado.reservas.forEach(function (reserva) {
      if (reserva.bus_number !== null && reserva.bus_number !== undefined) {
        var numero = Number(reserva.bus_number);
        if (Number.isInteger(numero) && numero > 0) numeros[numero] = true;
      }
    });

    var opcoes = [{ value: 'todos', label: 'Todos os ônibus' }];
    Object.keys(numeros).map(Number).sort(function (a, b) { return a - b; }).forEach(function (numero) {
      opcoes.push({ value: String(numero), label: 'Ônibus ' + numero });
    });
    opcoes.push({ value: 'sem-onibus', label: 'Sem ônibus confirmado' });

    var valores = opcoes.map(function (opcao) { return opcao.value; });
    if (valores.indexOf(estado.filtroOnibus) === -1) estado.filtroOnibus = 'todos';
    el.filtroOnibus.replaceChildren();
    opcoes.forEach(function (opcao) {
      var option = document.createElement('option');
      option.value = opcao.value;
      option.textContent = opcao.label;
      option.selected = opcao.value === estado.filtroOnibus;
      el.filtroOnibus.appendChild(option);
    });
  }

  // ---- montagem da tabela ------------------------------------------------

  /**
   * Achata reservas em linhas de passageiro, que é o formato útil na
   * conferência: quem está na porta do ônibus procura UMA pessoa, não um grupo.
   */
  function linhasVisiveis() {
    var termo = estado.busca.trim().toLowerCase();
    var linhas = [];

    estado.reservas.forEach(function (reserva) {
      if (estado.filtro !== 'todas' && reserva.status_chave !== estado.filtro) return;
      if (estado.filtroOnibus !== 'todos') {
        var semOnibus = reserva.bus_number === null || reserva.bus_number === undefined;
        if (estado.filtroOnibus === 'sem-onibus' ? !semOnibus : Number(reserva.bus_number) !== Number(estado.filtroOnibus)) return;
      }

      var passageiros = reserva.passageiros.length
        ? reserva.passageiros
        // Reserva sem passageiro gravado ainda: mostra o contato, para a linha
        // não desaparecer da conferência.
        : [{
          posicao: 1, nome: reserva.contato, cpf: reserva.contato_cpf,
          whatsapp: reserva.contato_whatsapp, responsavel: true, nova_reserva: null
        }];

      passageiros.forEach(function (p, i) {
        if (termo) {
          var alvo = [
            reserva.code, reserva.contato, reserva.email, reserva.contato_whatsapp,
            reserva.contato_cpf, p.nome, p.cpf || '', p.whatsapp || '',
            reserva.order_id || '', reserva.status_rotulo, reserva.grupo || ''
          ].join(' ').toLowerCase();
          if (alvo.indexOf(termo) === -1) return;
        }
        linhas.push({ reserva: reserva, passageiro: p, primeiroDoGrupo: i === 0 });
      });
    });

    return linhas;
  }

  function renderizar() {
    var linhas = linhasVisiveis();
    el.corpo.replaceChildren();

    // Contador de grupo, para o realce ao passar o mouse cobrir a RESERVA inteira
    // e não só a linha sob o cursor: quem confere decide sobre o grupo todo (uma
    // família embarca junta), então o destaque precisa acompanhar essa unidade.
    //
    // Uso um contador em vez do código da reserva porque o código exibido é um
    // prefixo de 8 caracteres do UUID: dois prefixos iguais acenderiam dois
    // grupos distintos ao mesmo tempo.
    var grupoAtual = 0;

    linhas.forEach(function (linha) {
      var r = linha.reserva;
      var p = linha.passageiro;
      var primeiro = linha.primeiroDoGrupo;
      if (primeiro) grupoAtual++;
      var tr = document.createElement('tr');
      if (r.is_vip) tr.classList.add('tabela__linha--vip');
      if (primeiro) tr.dataset.grupoInicio = 'true';
      tr.dataset.grupo = String(grupoAtual);

      function celula(rotulo, conteudo, classe) {
        var td = document.createElement('td');
        td.dataset.rotulo = rotulo;
        if (classe) td.className = classe;
        if (conteudo == null || conteudo === '') {
          td.textContent = '';
        } else if (typeof conteudo === 'string') {
          td.textContent = conteudo;
        } else {
          td.appendChild(conteudo);
        }
        tr.appendChild(td);
        return td;
      }

      // Reserva, Grupo, Status e Pago em aparecem SO na primeira linha do grupo
      // para evitar duplicar informacoes visuais identicas.
      if (primeiro) {
        var blocoReserva = document.createElement('div');
        blocoReserva.className = 'tabela__bloco-reserva';

        var reservaSpan = document.createElement('span');
        reservaSpan.className = 'tabela__codigo';
        reservaSpan.textContent = '#' + r.code;
        blocoReserva.appendChild(reservaSpan);

        var totalPessoas = (r.pagantes || 0) + (r.criancas || 0);
        // Exibe a contagem de integrantes abaixo do codigo apenas se for maior que 1,
        // pois em reservas individuais a informacao e redundante.
        if (totalPessoas > 1) {
          var qtdDiv = document.createElement('div');
          qtdDiv.className = 'tabela__qtd-reserva';
          var textoQtd;
          if (r.criancas > 0) {
            textoQtd = (r.pagantes || 0) + ' + ' + r.criancas + ' colo';
          } else {
            textoQtd = (r.pagantes === 1 ? '1 pessoa' : r.pagantes + ' pessoas');
          }
          qtdDiv.textContent = textoQtd;
          blocoReserva.appendChild(qtdDiv);
        }

        celula('Reserva', blocoReserva);
      } else {
        celula('Reserva', '');
      }

      // Passageiro: meeple identifica o responsável pela reserva; os demais
      // passageiros continuam com marcadores discretos para preservar a leitura.
      var nomeWrap = document.createElement('div');
      var linhaNome = document.createElement('div');
      var pos = document.createElement('span');
      pos.className = 'tabela__posicao';
      // Uma reserva recebe apenas um meeple, sem repetir o ícone para cada
      // integrante. Grupos ficam roxos; reservas individuais ficam azuis.
      if (p.responsavel) {
        pos.classList.add('tabela__posicao--responsavel');
        pos.replaceChildren(meepleDaReserva(r));
        pos.setAttribute('title', 'Contato responsável pela reserva');
      } else if (p.crianca_colo) {
        pos.textContent = '•';
        pos.setAttribute('title', 'Criança de até 5 anos (colo)');
      } else {
        pos.textContent = '–';
        pos.setAttribute('aria-hidden', 'true');
      }
      var nome = document.createElement('span');
      nome.className = 'tabela__nome';
      nome.textContent = ' ' + p.nome;
      linhaNome.append(pos, nome);

      if (p.responsavel) {
        var apenasLeitor = document.createElement('span');
        apenasLeitor.className = 'sr-only';
        apenasLeitor.textContent = ' (contato responsável pela reserva)';
        linhaNome.appendChild(apenasLeitor);
      }
      nomeWrap.appendChild(linhaNome);

      // Faixa etária abaixo do nome dos passageiros extras em letra pequena e discreta
      if (!p.responsavel) {
        var faixaDiv = document.createElement('div');
        faixaDiv.className = 'tabela__faixa-passageiro';
        var textoFaixa = '18 anos ou mais';
        if (p.crianca_colo) {
          textoFaixa = '0 a 5 anos (colo)';
        } else if (p.menor) {
          textoFaixa = '6 a 17 anos';
        }
        faixaDiv.textContent = textoFaixa;
        nomeWrap.appendChild(faixaDiv);
      }

      if (p.nova_reserva) {
        var aviso = document.createElement('div');
        aviso.className = 'tabela__nova-reserva';
        var icone = document.createElement('span');
        icone.className = 'tabela__nova-reserva__icone';
        icone.setAttribute('aria-hidden', 'true');
        icone.textContent = '↻';
        var texto = document.createElement('span');
        texto.append(document.createTextNode('Nova reserva: '));
        var cod = document.createElement('code');
        cod.textContent = p.nova_reserva.code;
        texto.appendChild(cod);
        aviso.append(icone, texto, badge(p.nova_reserva.rotulo, p.nova_reserva.tom));
        // Título explica o motivo para quem passa o mouse, sem depender de
        // tooltip customizado (que não funciona por teclado nem em toque).
        aviso.title = 'Este passageiro aparece em uma reserva mais recente ('
          + p.nova_reserva.code + ' · ' + p.nova_reserva.rotulo + ').';
        nomeWrap.appendChild(aviso);
      }
      celula('Passageiro', nomeWrap);

      if (p.whatsapp) {
        var linkWhatsapp = criarLinkWhatsapp(p.whatsapp, p.nome || r.contato);
        if (linkWhatsapp) {
          celula('WhatsApp', linkWhatsapp, 'tabela__tel');
        } else {
          celula('WhatsApp', p.whatsapp, 'tabela__tel');
        }
      } else {
        var telefoneAusente = p.crianca_colo ? 'N/A' : 'Não informado';
        celula('WhatsApp', telefoneAusente, 'tabela__tel tabela__tel--vazio');
      }

      celula('CPF', p.cpf || '—', 'tabela__cpf');

      // O nome do grupo substitui a antiga contagem de pessoas e e exibido apenas na
      // primeira linha da reserva para manter o alinhamento visual do grupo.
      var nomeGrupo = (primeiro && r.grupo) ? r.grupo : '';
      celula('Grupo', nomeGrupo, 'tabela__grupo');

      var nomeOnibus = '';
      if (primeiro) {
        nomeOnibus = r.bus_number ? 'BUS ' + r.bus_number : '—';
      }
      celula('Ônibus', nomeOnibus, 'tabela__onibus');

      celula('Status', primeiro ? badge(r.status_rotulo, r.status_tom) : null);

      if (primeiro && !r.is_vip) {
        var blocoPagamento = document.createElement('div');
        blocoPagamento.className = 'tabela__pagamento';

        var dataPagamento = document.createElement('span');
        dataPagamento.textContent = r.pago_em || '—';
        blocoPagamento.appendChild(dataPagamento);

        if (r.criado_em) {
          var criadoEm = document.createElement('span');
          criadoEm.className = 'tabela__secundario tabela__pagamento-criado';
          criadoEm.textContent = 'Criado em: ' + r.criado_em;
          blocoPagamento.appendChild(criadoEm);
        }

        celula('Pago em', blocoPagamento, 'tabela__num');
      } else {
        celula('Pago em', '', 'tabela__num');
      }

      el.corpo.appendChild(tr);
    });

    // O corpo da tabela é recriado inteiro a cada render, então o grupo realçado
    // antes morreu junto com as linhas antigas. Zerar o estado evita que o
    // próximo mouseover no MESMO número de grupo seja descartado pelo
    // curto-circuito de `realcarGrupo`.
    grupoRealcado = null;

    var vazioPorBusca = linhas.length === 0 && estado.reservas.length > 0;
    el.semResultado.hidden = !vazioPorBusca;

    var grupos = {};
    linhas.forEach(function (l) { grupos[l.reserva.code] = true; });
    var totalVips = estado.reservas.filter(function (reserva) { return reserva.is_vip; }).length;
    var resumoVips = totalVips > 0
      ? ' · ' + plural(totalVips, 'reserva VIP cadastrada', 'reservas VIP cadastradas')
      : '';
    el.contagem.textContent = linhas.length
      ? plural(linhas.length, 'passageiro', 'passageiros') + ' em '
      + plural(Object.keys(grupos).length, 'reserva', 'reservas') + resumoVips
      : resumoVips;
  }

  function renderizarResumo(resumo) {
    el.rTotal.textContent = resumo.total_a_bordo;
    el.rTotalNota.textContent = plural(resumo.pagantes, 'pagante', 'pagantes')
      + ' + ' + plural(resumo.criancas_no_colo, 'criança no colo', 'crianças no colo');
    el.rReservas.textContent = resumo.reservas_pagas;
    var pend = [];
    if (resumo.reservas_pendentes > 0) pend.push(resumo.reservas_pendentes + ' aguardando');
    if (resumo.reservas_falha > 0) pend.push(resumo.reservas_falha + ' cancelada(s)/falha');
    el.rPendentes.textContent = pend.length ? pend.join(' · ') : 'nada pendente';
    var rec = resumo.receita !== undefined ? resumo.receita : (resumo.receita_centavos ? (resumo.receita_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00');
    el.rReceita.textContent = 'R$ ' + rec;
    el.rSemTelefone.textContent = resumo.sem_telefone;
  }

  // Objeto temporário para rastrear o que está sendo arrastado e validar vagas em tempo real
  var itemArrastando = null;

  // ---- renderização frota ------------------------------------------------

  function assentosDaReserva(reserva) {
    if (!reserva) return 0;
    var assentos = reserva.assentos !== undefined ? reserva.assentos : reserva.pagantes;
    return Math.max(0, Number(assentos || 0));
  }

  function assentosOcupadosDoOnibus(onibus) {
    if (!onibus) return 0;
    return Math.max(0, Number(onibus.assentos_ocupados !== undefined
      ? onibus.assentos_ocupados
      : (onibus.ocupados || 0)));
  }

  function renderizarFrota() {
    if (!estado.frota || !Array.isArray(estado.frota.onibus)) return;
    var onibusList = estado.frota.onibus;
    el.frotaContainer.replaceChildren();

    var maxL = Number(estado.frota.capacidade || 46);
    var minL = Number(estado.frota.minimo || 40);

    // Renderiza cada onibus como uma linha horizontal completa (veículo)
    onibusList.forEach(function (info) {
      var busNum = Number(info.numero || 1);
      var ocupados = assentosOcupadosDoOnibus(info);
      var vagasRestantes = info.vagas_livres !== undefined
        ? Math.max(0, Number(info.vagas_livres || 0))
        : Math.max(0, maxL - ocupados);
      var vipsNoBus = Number(info.vip_inclusos || 0);

      var card = document.createElement('div');
      card.className = 'onibus-card';
      card.dataset.bus = busNum;

      // Eventos de drag and drop na dropzone com validação dinâmica de vagas
      card.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        if (!itemArrastando) return;

        var assentosDoItem = itemArrastando.assentos || 1;
        var mesmoOnibus = (itemArrastando.origemBus === busNum);

        if (mesmoOnibus) {
          card.classList.add('drag-over');
          card.classList.remove('drag-error');
          ev.dataTransfer.dropEffect = 'move';
        } else if (vagasRestantes < assentosDoItem) {
          card.classList.add('drag-error');
          card.classList.remove('drag-over');
          ev.dataTransfer.dropEffect = 'none';
        } else {
          card.classList.add('drag-over');
          card.classList.remove('drag-error');
          ev.dataTransfer.dropEffect = 'move';
        }
      });

      card.addEventListener('dragleave', function (ev) {
        if (ev.relatedTarget && card.contains(ev.relatedTarget)) return;
        card.classList.remove('drag-over');
        card.classList.remove('drag-error');
      });

      card.addEventListener('drop', function (ev) {
        ev.preventDefault();
        card.classList.remove('drag-over');
        card.classList.remove('drag-error');
        var rId = ev.dataTransfer.getData('text/plain');
        if (!rId) return;

        if (itemArrastando && itemArrastando.origemBus !== busNum) {
          var assentosDoItem = itemArrastando.assentos || 1;
          if (vagasRestantes < assentosDoItem) {
            var vagasRestantesMsg = Math.max(0, maxL - ocupados);
            var pessoasDoItem = itemArrastando.pessoas || assentosDoItem;
            mostrarAlertaModal('Ônibus Lotado', 'O Ônibus ' + busNum + ' não tem vagas suficientes (' + (vagasRestantesMsg === 1 ? '1 vaga restante' : vagasRestantesMsg + ' vagas restantes') + ') para acomodar este grupo de ' + (pessoasDoItem === 1 ? '1 pessoa' : pessoasDoItem + ' pessoas') + ' (' + assentosDoItem + (assentosDoItem === 1 ? ' assento).' : ' assentos).'), 'erro');
            return;
          }
        }

        moverParaOnibus(rId, busNum);
      });

      // --- HEADER DO ÔNIBUS ---
      var header = document.createElement('div');
      header.className = 'onibus-card__header';

      // Esquerda: Título acima + Grid de mini-cards com iconografia ocupando o espaço livre
      var headerLeft = document.createElement('div');
      headerLeft.className = 'onibus-card__header-left';

      var titulo = document.createElement('h3');
      titulo.className = 'onibus-card__titulo';
      titulo.textContent = 'BUS ' + busNum;

      var statsGrid = document.createElement('div');
      statsGrid.className = 'onibus-card__stats-grid';

      var numOcupadosFormat = ocupados < 10 ? '0' + ocupados : String(ocupados);
      var statusTexto = ocupados >= maxL ? 'LOTADO' : (info.fechado || ocupados >= minL ? 'COTA ATINGIDA' : 'EM ABERTO');

      // Card 1: Status
      var cardStatus = document.createElement('div');
      cardStatus.className = 'onibus-card__stat-card onibus-card__stat-card--status';
      if (ocupados >= maxL) {
        cardStatus.classList.add('is-lotado');
      } else if (info.fechado || ocupados >= minL) {
        cardStatus.classList.add('is-contratado');
      } else {
        cardStatus.classList.add('is-aberto');
      }
      cardStatus.innerHTML = '<span class="onibus-card__stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="15" rx="3"></rect><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle><line x1="3" y1="9" x2="21" y2="9"></line><line x1="12" y1="3" x2="12" y2="9"></line></svg></span>'
        + '<div class="onibus-card__stat-content"><span class="onibus-card__stat-label">Status</span><strong class="onibus-card__stat-value"><span class="onibus-card__stat-tag">[' + numOcupadosFormat + '/' + maxL + ']</span><span>' + statusTexto + '</span></strong></div>';

      // Card 2: Lotação / Passageiros
      var cardLotacao = document.createElement('div');
      cardLotacao.className = 'onibus-card__stat-card';
      var percOcupacao = Math.round((ocupados / maxL) * 100);
      cardLotacao.innerHTML = '<span class="onibus-card__stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></span>'
        + '<div class="onibus-card__stat-content"><span class="onibus-card__stat-label">Assentos</span><strong class="onibus-card__stat-value"><span>' + ocupados + ' de ' + maxL + '</span><small>(' + percOcupacao + '%)</small></strong></div>';

      // Card 3: Vagas Livres (Ícone oficial da Poltrona do anexo)
      var cardVagas = document.createElement('div');
      cardVagas.className = 'onibus-card__stat-card' + (vagasRestantes > 0 ? ' onibus-card__stat-card--livre' : '');
      var iconePoltronaSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3a1.5 1.5 0 0 1 3 0v7.5c0 1.2.8 2 2 2h6.5a2 2 0 0 1 0 4h-8.5c-2.5 0-4.5-1.8-4.5-4.5V4.5A1.5 1.5 0 0 1 6 3z"></path><path d="M8 11.5h7a1 1 0 0 1 0 2H8"></path><path d="M7 19.5v2.5"></path><path d="M15 19.5v2.5"></path></svg>';
      cardVagas.innerHTML = '<span class="onibus-card__stat-icon">' + iconePoltronaSVG + '</span>'
        + '<div class="onibus-card__stat-content"><span class="onibus-card__stat-label">Vagas</span><strong class="onibus-card__stat-value">' + (vagasRestantes === 0 ? 'Lotado' : '<span>' + vagasRestantes + (vagasRestantes === 1 ? ' vaga' : ' vagas') + '</span><small>livres</small>') + '</strong></div>';

      // Card 4: VIPs Organização (Estrela SVG grande e dourada)
      var cardVip = document.createElement('div');
      cardVip.className = 'onibus-card__stat-card onibus-card__stat-card--vip';
      var iconeEstrelaSVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
      cardVip.innerHTML = '<span class="onibus-card__stat-icon">' + iconeEstrelaSVG + '</span>'
        + '<div class="onibus-card__stat-content"><span class="onibus-card__stat-label">VIPs Org.</span><strong class="onibus-card__stat-value"><span>' + (vipsNoBus > 0 ? vipsNoBus + (vipsNoBus === 1 ? ' lugar' : ' lugares') : '0 lugares') + '</span><small>' + (vipsNoBus > 0 ? 'reservados' : 'livres') + '</small></strong></div>';

      statsGrid.append(cardStatus, cardLotacao, cardVagas, cardVip);

      headerLeft.append(titulo, statsGrid);

      // Centro: mapa artístico detalhado de assentos do ônibus (46 lugares)
      var headerCenter = document.createElement('div');
      headerCenter.className = 'onibus-card__header-center';

      var mapaOcupacao = document.createElement('div');
      mapaOcupacao.className = 'ocupacao-mapa onibus-arte-mapa';
      mapaOcupacao.setAttribute('aria-label', 'Mapa de assentos do ônibus ' + busNum);

      var chassi = document.createElement('div');
      chassi.className = 'onibus-arte-mapa__chassi';

      // Retrovisores exteriores
      var retrovisorTop = document.createElement('span');
      retrovisorTop.className = 'onibus-arte-mapa__retrovisor top';
      var retrovisorBottom = document.createElement('span');
      retrovisorBottom.className = 'onibus-arte-mapa__retrovisor bottom';

      // Rodas / Caixas de roda
      var rodaDiantTop = document.createElement('span');
      rodaDiantTop.className = 'onibus-arte-mapa__roda roda--diant-top';
      var rodaTrasTop = document.createElement('span');
      rodaTrasTop.className = 'onibus-arte-mapa__roda roda--tras-top';
      var rodaDiantBottom = document.createElement('span');
      rodaDiantBottom.className = 'onibus-arte-mapa__roda roda--diant-bot';
      var rodaTrasBottom = document.createElement('span');
      rodaTrasBottom.className = 'onibus-arte-mapa__roda roda--tras-bot';

      var fileira1 = [45, 41, 37, 33, 29, 25, 21, 17, 13, 9, 5, 1];
      var fileira2 = [46, 42, 38, 34, 30, 26, 22, 18, 14, 10, 6, 2];
      var fileira3 = [44, 40, 36, 32, 28, 24, 20, 16, 12, 8, 4];
      var fileira4 = [43, 39, 35, 31, 27, 23, 19, 15, 11, 7, 3];

      function criarPoltrona(num) {
        var poltrona = document.createElement('span');
        poltrona.className = 'onibus-poltrona';
        var isExtra = num > minL;
        var numStr = num < 10 ? '0' + num : '' + num;

        if (isExtra) poltrona.classList.add('onibus-poltrona--extra');

        if (num <= vipsNoBus) {
          // Assentos VIP da organização nos primeiros números disponíveis
          poltrona.classList.add('is-ocupada', 'onibus-poltrona--vip');
          poltrona.textContent = '★';
          poltrona.title = 'Poltrona ' + numStr + ' ★ VIP da Organização';
        } else if (num <= ocupados) {
          poltrona.classList.add('is-ocupada');
          poltrona.textContent = numStr;
          poltrona.title = 'Poltrona ' + numStr + (isExtra ? ' (Assento extra flexível)' : ' (Cota mínima 1-40)');
        } else {
          poltrona.textContent = numStr;
          poltrona.title = 'Poltrona ' + numStr + (isExtra ? ' (Assento extra livre)' : ' (Livre)');
        }

        return poltrona;
      }

      var gradeAssentos = document.createElement('div');
      gradeAssentos.className = 'onibus-arte-mapa__grade';

      var blocoSuperior = document.createElement('div');
      blocoSuperior.className = 'onibus-arte-mapa__bloco';
      var r1 = document.createElement('div');
      r1.className = 'onibus-arte-mapa__linha';
      fileira1.forEach(function (n) { r1.appendChild(criarPoltrona(n)); });
      var r2 = document.createElement('div');
      r2.className = 'onibus-arte-mapa__linha';
      fileira2.forEach(function (n) { r2.appendChild(criarPoltrona(n)); });
      blocoSuperior.append(r1, r2);

      var corredor = document.createElement('div');
      corredor.className = 'onibus-arte-mapa__corredor';
      corredor.setAttribute('aria-hidden', 'true');

      var blocoInferior = document.createElement('div');
      blocoInferior.className = 'onibus-arte-mapa__bloco';
      var r3 = document.createElement('div');
      r3.className = 'onibus-arte-mapa__linha onibus-arte-mapa__linha--recuo';
      fileira3.forEach(function (n) { r3.appendChild(criarPoltrona(n)); });
      var r4 = document.createElement('div');
      r4.className = 'onibus-arte-mapa__linha onibus-arte-mapa__linha--recuo';
      fileira4.forEach(function (n) { r4.appendChild(criarPoltrona(n)); });
      blocoInferior.append(r3, r4);

      gradeAssentos.append(blocoSuperior, corredor, blocoInferior);

      var cabine = document.createElement('div');
      cabine.className = 'onibus-arte-mapa__cabine';
      cabine.innerHTML = '<div class="onibus-arte-mapa__volante" title="Cabine do motorista"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><circle cx="12" cy="12" r="3"></circle></svg></div><div class="onibus-arte-mapa__farol-grupo"><span class="onibus-arte-mapa__farol top"></span><span class="onibus-arte-mapa__farol top-aux"></span><span class="onibus-arte-mapa__farol bottom-aux"></span><span class="onibus-arte-mapa__farol bottom"></span></div>';

      chassi.append(retrovisorTop, retrovisorBottom, rodaTrasTop, rodaDiantTop, rodaTrasBottom, rodaDiantBottom, gradeAssentos, cabine);

      // Legenda vertical ocupando a mesma altura do ônibus com fonte ampliada
      var legenda = document.createElement('div');
      legenda.className = 'onibus-arte-mapa__legenda onibus-arte-mapa__legenda--vertical';
      var textoVip = vipsNoBus > 0
        ? vipsNoBus + (vipsNoBus === 1 ? ' vaga reservada' : ' vagas reservadas')
        : 'Nenhuma vaga reservada';

      var legendaHTML = '<div class="onibus-arte-mapa__legenda-item"><span class="onibus-arte-mapa__legenda-cor onibus-arte-mapa__legenda-cor--vip">★</span> <div class="onibus-arte-mapa__legenda-texto"><strong>VIP da Organização</strong><span>' + textoVip + '</span></div></div>'
        + '<div class="onibus-arte-mapa__legenda-item"><span class="onibus-arte-mapa__legenda-cor onibus-arte-mapa__legenda-cor--base"></span> <div class="onibus-arte-mapa__legenda-texto"><strong>Cota Mínima</strong><span>1 a 40 lugares</span></div></div>'
        + '<div class="onibus-arte-mapa__legenda-item"><span class="onibus-arte-mapa__legenda-cor onibus-arte-mapa__legenda-cor--extra"></span> <div class="onibus-arte-mapa__legenda-texto"><strong>Assentos Extras</strong><span>41 a 46 lugares</span></div></div>'
        + '<div class="onibus-arte-mapa__legenda-item"><span class="onibus-arte-mapa__legenda-cor onibus-arte-mapa__legenda-cor--livre"></span> <div class="onibus-arte-mapa__legenda-texto"><strong>Disponíveis</strong><span>' + vagasRestantes + ' ' + (vagasRestantes === 1 ? 'vaga livre' : 'vagas livres') + '</span></div></div>';
      legenda.innerHTML = legendaHTML;

      mapaOcupacao.append(chassi, legenda);
      headerCenter.appendChild(mapaOcupacao);

      header.append(headerLeft, headerCenter);

      // Corpo simples do ônibus: mantém os grupos inteiros e o arraste manual,
      // sem transformar a tarefa de despacho em uma planta decorativa.
      var corpoOnibus = document.createElement('div');
      corpoOnibus.className = 'onibus-card__corpo';
      corpoOnibus.id = 'onibus-corpo-' + busNum;

      var botaoVista = document.createElement('button');
      botaoVista.type = 'button';
      botaoVista.className = 'onibus-card__vista-toggle';
      botaoVista.setAttribute('aria-controls', corpoOnibus.id);
      botaoVista.title = frotaCardsCompactos[busNum] ? 'Expandir detalhes do Ônibus ' + busNum : 'Recolher detalhes do Ônibus ' + busNum;

      function atualizarBotaoVista() {
        var compacto = Boolean(frotaCardsCompactos[busNum]);
        card.classList.toggle('onibus-card--compacto', compacto);
        botaoVista.setAttribute('aria-expanded', compacto ? 'false' : 'true');
        botaoVista.setAttribute('aria-label', compacto ? 'Expandir detalhes do Ônibus ' + busNum : 'Recolher detalhes do Ônibus ' + busNum);
        botaoVista.title = compacto ? 'Expandir detalhes do Ônibus ' + busNum : 'Recolher detalhes do Ônibus ' + busNum;
        botaoVista.innerHTML = (compacto
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"></path></svg><span>Expandir</span>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg><span>Recolher</span>');
      }

      botaoVista.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        frotaCardsCompactos[busNum] = !frotaCardsCompactos[busNum];
        atualizarBotaoVista();
      });
      atualizarBotaoVista();
      var tituloLinha = document.createElement('div');
      tituloLinha.className = 'onibus-card__titulo-linha';
      tituloLinha.append(botaoVista, titulo);
      headerLeft.insertBefore(tituloLinha, statsGrid);

      var assentosGrid = document.createElement('div');
      assentosGrid.className = 'onibus-planta__assentos-grid';

      if (info.reservas && info.reservas.length) {
        info.reservas.forEach(function (r) {
          var item = document.createElement('div');
          item.className = 'grupo-item' + (r.is_vip ? ' grupo-item--vip' : '');
          item.draggable = true;
          item.dataset.reserva = r.id;

          item.addEventListener('dragstart', function (ev) {
            ev.dataTransfer.setData('text/plain', r.id);
            itemArrastando = {
              id: r.id,
              assentos: Math.max(1, assentosDaReserva(r)),
              pessoas: Math.max(1, Number(r.total || r.pagantes || 1)),
              origemBus: busNum
            };
            item.classList.add('dragging');
          });
          item.addEventListener('dragend', function () {
            itemArrastando = null;
            item.classList.remove('dragging');
            document.querySelectorAll('.onibus-card').forEach(function (c) {
              c.classList.remove('drag-over', 'drag-error');
            });
          });

          // Topo do card: Nome do Grupo / Responsável + Código
          var itemTop = document.createElement('div');
          itemTop.className = 'grupo-item__top';

          var tituloGrupo = document.createElement('div');
          tituloGrupo.className = 'grupo-item__titulo';
          if (r.is_vip) {
            var nomeVip = r.responsavel || 'Reserva VIP';
            tituloGrupo.textContent = nomeVip;
            tituloGrupo.title = nomeVip;
          } else if (r.grupo) {
            tituloGrupo.textContent = r.grupo;
            tituloGrupo.title = r.grupo;
          } else {
            tituloGrupo.textContent = r.responsavel;
            tituloGrupo.title = r.responsavel;
          }

          var tituloGrupoWrap = document.createElement('div');
          tituloGrupoWrap.className = 'grupo-item__titulo-wrap';

          var infoId = 'grupo-info-' + String(r.id || busNum).replace(/[^a-zA-Z0-9_-]/g, '-');
          var infoTrigger = document.createElement('button');
          infoTrigger.type = 'button';
          infoTrigger.className = 'grupo-item__info-trigger';
          if (r.is_vip) infoTrigger.classList.add('grupo-item__info-trigger--vip');
          infoTrigger.setAttribute('aria-label', 'Ver informações do grupo');
          infoTrigger.setAttribute('aria-describedby', infoId);
          infoTrigger.title = 'Ver informações do grupo';
          infoTrigger.innerHTML = r.is_vip
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="none"></path></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none"></circle><circle cx="12" cy="8" r="1.6" fill="currentColor" stroke="none"></circle><rect x="10.3" y="11" width="3.4" height="7" rx="1.7" fill="currentColor" stroke="none"></rect></svg>';
          infoTrigger.addEventListener('mousedown', function (ev) {
            ev.stopPropagation();
          });

          var codeTag = document.createElement('button');
          codeTag.type = 'button';
          codeTag.className = 'grupo-item__code';
          var codigoReserva = r.code || 'RESERVA';
          codeTag.setAttribute('aria-label', 'Copiar número da reserva ' + codigoReserva);
          codeTag.title = 'Copiar número da reserva';
          codeTag.dataset.copyHint = 'Clique para copiar';
          codeTag.innerHTML = '<span>#' + codigoReserva + '</span>';
          codeTag.addEventListener('mousedown', function (ev) {
            ev.stopPropagation();
          });
          codeTag.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();

            var confirmarCopia = function () {
              codeTag.classList.add('is-copiado');
              codeTag.setAttribute('aria-label', 'Número da reserva copiado');
              codeTag.title = 'Número copiado';
              codeTag.dataset.copyHint = 'Copiado';
              window.setTimeout(function () {
                codeTag.classList.remove('is-copiado');
                codeTag.setAttribute('aria-label', 'Copiar número da reserva ' + codigoReserva);
                codeTag.title = 'Copiar número da reserva';
                codeTag.dataset.copyHint = 'Clique para copiar';
              }, 1600);
            };

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
              navigator.clipboard.writeText(codigoReserva).then(confirmarCopia).catch(function () {});
              return;
            }

            var campoTemporario = document.createElement('textarea');
            campoTemporario.value = codigoReserva;
            campoTemporario.setAttribute('readonly', '');
            campoTemporario.style.position = 'fixed';
            campoTemporario.style.opacity = '0';
            document.body.appendChild(campoTemporario);
            campoTemporario.select();
            try {
              if (document.execCommand('copy')) confirmarCopia();
            } finally {
              campoTemporario.remove();
            }
          });
          tituloGrupoWrap.append(infoTrigger, tituloGrupo);
          itemTop.append(tituloGrupoWrap, codeTag);
          if (r.is_vip && !String(r.id || '').startsWith('vip_')) {
            var removerVip = document.createElement('button');
            removerVip.type = 'button';
            removerVip.className = 'grupo-item__vip-remover';
            removerVip.setAttribute('aria-label', 'Remover reserva VIP de ' + (r.responsavel || 'VIP'));
            removerVip.title = 'Remover reserva VIP';
            removerVip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';
            removerVip.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
            removerVip.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              removerReservaVip(r);
            });
            itemTop.appendChild(removerVip);
          }
          item.appendChild(itemTop);

          // Rodapé do card: Representação Visual por Meeples + Seletor Mover
          var itemBottom = document.createElement('div');
          itemBottom.className = 'grupo-item__bottom';

          var meeplePathD = 'M256 54.99c-27 0-46.418 14.287-57.633 32.23-10.03 16.047-14.203 34.66-15.017 50.962-30.608 15.135-64.515 30.394-91.815 45.994-14.32 8.183-26.805 16.414-36.203 25.26C45.934 218.28 39 228.24 39 239.99c0 5 2.44 9.075 5.19 12.065 2.754 2.99 6.054 5.312 9.812 7.48 7.515 4.336 16.99 7.95 27.412 11.076 15.483 4.646 32.823 8.1 47.9 9.577-14.996 25.84-34.953 49.574-52.447 72.315C56.65 378.785 39 403.99 39 431.99c0 4-.044 7.123.31 10.26.355 3.137 1.256 7.053 4.41 10.156 3.155 3.104 7.017 3.938 10.163 4.28 3.146.345 6.315.304 10.38.304h111.542c8.097 0 14.026.492 20.125-3.43 6.1-3.92 8.324-9.275 12.67-17.275l.088-.16.08-.166s9.723-19.77 21.324-39.388c5.8-9.808 12.097-19.576 17.574-26.498 2.74-3.46 5.304-6.204 7.15-7.754.564-.472.82-.56 1.184-.76.363.2.62.288 1.184.76 1.846 1.55 4.41 4.294 7.15 7.754 5.477 6.922 11.774 16.69 17.574 26.498 11.6 19.618 21.324 39.387 21.324 39.387l.08.165.088.16c4.346 8 6.55 13.323 12.61 17.254 6.058 3.93 11.974 3.45 19.957 3.45H448c4 0 7.12.043 10.244-.304 3.123-.347 6.998-1.21 10.12-4.332 3.12-3.122 3.984-6.997 4.33-10.12.348-3.122.306-6.244.306-10.244 0-28-17.65-53.205-37.867-79.488-17.493-22.74-37.45-46.474-52.447-72.315 15.077-1.478 32.417-4.93 47.9-9.576 10.422-3.125 19.897-6.74 27.412-11.075 3.758-2.168 7.058-4.49 9.81-7.48 2.753-2.99 5.192-7.065 5.192-12.065 0-11.75-6.934-21.71-16.332-30.554-9.398-8.846-21.883-17.077-36.203-25.26-27.3-15.6-61.207-30.86-91.815-45.994-.814-16.3-4.988-34.915-15.017-50.96C302.418 69.276 283 54.99 256 54.99z';

          var meepleAdultoSVG = '<svg viewBox="0 0 512 512" width="20" height="20" class="meeple-svg meeple-svg--adult" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';
          var meepleCriancaSVG = '<svg viewBox="0 0 512 512" width="14" height="14" class="meeple-svg meeple-svg--child" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';

          var meepleVipSVG = '<svg viewBox="0 0 512 512" width="20" height="20" class="meeple-svg meeple-svg--vip" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';

          var meeplesContainer = document.createElement('div');
          meeplesContainer.className = 'grupo-item__meeples';

          if (r.is_vip) {
            meeplesContainer.classList.add('grupo-item__meeples--vip');
            meeplesContainer.title = '1 Lugar VIP da Organização';
            meeplesContainer.innerHTML = meepleVipSVG;
          } else {
            var numPagantes = Number(r.pagantes || r.total || 1);
            var numColo = Number(r.criancas || 0);

            if (numPagantes === 1 && numColo === 0) {
              meeplesContainer.classList.add('grupo-item__meeples--solo');
            }

            var textoDesc = numPagantes === 1 ? '1 pagante' : numPagantes + ' pagantes';
            if (numColo > 0) {
              textoDesc += ' + ' + (numColo === 1 ? '1 criança de colo' : numColo + ' crianças de colo');
            }
            meeplesContainer.title = textoDesc;

            var totalIntegrantes = numPagantes + numColo;
            if (totalIntegrantes >= 7) {
              meeplesContainer.classList.add('grupo-item__meeples--compacta');
            } else if (totalIntegrantes >= 4) {
              meeplesContainer.classList.add('grupo-item__meeples--compacta-mobile');
            }

            var htmlMeeples = '<span class="grupo-item__meeples-individual"><span class="grupo-item__meeples-grupo grupo-item__meeples-grupo--adultos">';
            for (var mi = 0; mi < numPagantes; mi++) {
              htmlMeeples += meepleAdultoSVG;
            }
            htmlMeeples += '</span>';

            if (numColo > 0) {
              htmlMeeples += '<span class="grupo-item__meeples-sep">+</span><span class="grupo-item__meeples-grupo grupo-item__meeples-grupo--criancas">';
              for (var ci = 0; ci < numColo; ci++) {
                htmlMeeples += meepleCriancaSVG;
              }
              htmlMeeples += '</span>';
            }

            htmlMeeples += '</span>';

            var htmlCompacto = '<span class="grupo-item__meeples-compacto">'
              + '<span class="grupo-item__meeples-grupo grupo-item__meeples-grupo--adultos"><strong class="grupo-item__meeples-contagem">' + numPagantes + '</strong>' + meepleAdultoSVG + '</span>';
            if (numColo > 0) {
              htmlCompacto += '<span class="grupo-item__meeples-sep">+</span><span class="grupo-item__meeples-grupo grupo-item__meeples-grupo--criancas"><strong class="grupo-item__meeples-contagem">' + numColo + '</strong>' + meepleCriancaSVG + '</span>';
            }
            htmlCompacto += '</span>';

            meeplesContainer.innerHTML = htmlMeeples + htmlCompacto;
          }

          // Menu de movimentação: opções visuais para ônibus e fila de espera.
          var moverMenu = document.createElement('details');
          moverMenu.className = 'grupo-item__mover';

          var moverTrigger = document.createElement('summary');
          moverTrigger.className = 'grupo-item__mover-trigger';
          moverTrigger.title = 'Mover para outro ônibus';
          moverTrigger.setAttribute('aria-label', 'Mover para outro ônibus');
          moverTrigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"></rect><path d="M7 18v2M17 18v2M3 10h18"></path><circle cx="7" cy="15" r="1"></circle><circle cx="17" cy="15" r="1"></circle></svg><span>Mover</span><svg class="grupo-item__mover-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
          moverMenu.appendChild(moverTrigger);

          var moverOpcoes = document.createElement('div');
          moverOpcoes.className = 'grupo-item__mover-opcoes';
          moverOpcoes.setAttribute('role', 'listbox');
          moverOpcoes.setAttribute('aria-label', 'Destinos disponíveis');

          function adicionarOpcaoMover(valor, titulo, detalhe, tipo) {
            var opcao = document.createElement('button');
            opcao.type = 'button';
            opcao.className = 'grupo-item__mover-opcao grupo-item__mover-opcao--' + tipo;
            opcao.setAttribute('role', 'option');
            var detalheHtml = detalhe ? '<small>' + detalhe + '</small>' : '';
            opcao.innerHTML = (tipo === 'espera'
              ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4z"></path><path d="m4 7 4 5h8l4-5M8 12h8"></path></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="13" rx="2"></rect><path d="M3 10h18M7 18v2M17 18v2"></path></svg>')
              + '<span class="grupo-item__mover-opcao-copy"><strong>' + titulo + '</strong>' + detalheHtml + '</span>';
            opcao.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              moverMenu.open = false;
              if (valor === null) {
                moverParaOnibus(r.id, null);
                return;
              }

              var novoBus = Number(valor);
              var destInfo = onibusList.find(function (o) { return Number(o.numero) === novoBus; });
              var ocupadosDest = assentosOcupadosDoOnibus(destInfo);
              var vagasDest = destInfo && destInfo.vagas_livres !== undefined
                ? Math.max(0, Number(destInfo.vagas_livres || 0))
                : Math.max(0, maxL - ocupadosDest);
              var assentosDoItem = Math.max(1, assentosDaReserva(r));
              if (vagasDest < assentosDoItem) {
                var vagasRestantesMsg = vagasDest;
                var pessoasDoItem = Math.max(1, Number(r.total || r.pagantes || 1));
                mostrarAlertaModal('Ônibus Lotado', 'O Ônibus ' + novoBus + ' não tem vagas suficientes (' + (vagasRestantesMsg === 1 ? '1 vaga restante' : vagasRestantesMsg + ' vagas restantes') + ') para acomodar este grupo de ' + (pessoasDoItem === 1 ? '1 pessoa' : pessoasDoItem + ' pessoas') + ' (' + assentosDoItem + (assentosDoItem === 1 ? ' assento).' : ' assentos).'), 'erro');
                return;
              }
              moverParaOnibus(r.id, novoBus);
            });
            moverOpcoes.appendChild(opcao);
          }

          onibusList.forEach(function (outro) {
            var numOutro = Number(outro.numero);
            if (numOutro !== busNum) {
              var vagasLivresOutro = outro.vagas_livres !== undefined
                ? Math.max(0, Number(outro.vagas_livres || 0))
                : Math.max(0, maxL - assentosOcupadosDoOnibus(outro));
              adicionarOpcaoMover(numOutro, 'Ônibus ' + numOutro, vagasLivresOutro + (vagasLivresOutro === 1 ? ' vaga livre' : ' vagas livres'), 'onibus');
            }
          });

          adicionarOpcaoMover(
            null,
            'Sem ônibus confirmado',
            r.is_vip ? '' : 'Enviar para a fila de espera',
            'espera'
          );

          moverMenu.appendChild(moverOpcoes);
          moverMenu.addEventListener('toggle', function () {
            item.classList.toggle('grupo-item--menu-aberto', moverMenu.open);
          });
          moverMenu.addEventListener('focusout', function (ev) {
            var proximoFoco = ev.relatedTarget;
            if (!proximoFoco || !moverMenu.contains(proximoFoco)) {
              moverMenu.open = false;
            }
          });
          moverTrigger.addEventListener('click', function () {
            document.querySelectorAll('.grupo-item__mover[open]').forEach(function (aberto) {
              if (aberto !== moverMenu) aberto.open = false;
            });
          });
          moverMenu.addEventListener('mousedown', function (ev) {
            ev.stopPropagation();
          });

          itemBottom.append(meeplesContainer, moverMenu);
          item.appendChild(itemBottom);

          // Tooltip com Informações Extras no Hover
          var tooltip = document.createElement('div');
          tooltip.className = 'grupo-item__tooltip';
          tooltip.id = infoId;
          tooltip.setAttribute('role', 'tooltip');
          if (r.is_vip) {
            tooltip.innerHTML = '<div class="grupo-item__tooltip-resp">' + escapeHtml(r.responsavel || 'Reserva VIP') + '</div><div class="grupo-item__tooltip-pax">1 vaga reservada para a equipe</div>';
          } else {
            var nomeResp = r.responsavel || r.grupo || 'Participante';
            var htmlTooltip = '<div class="grupo-item__tooltip-resp"><strong>Contato principal:</strong> ' + escapeHtml(nomeResp) + '</div>';

            var listaPassageiros = Array.isArray(r.passageiros) ? r.passageiros : [];
            // Filtra passageiros além do responsável (posicao >= 2 ou índice >= 1)
            var demaisPassageiros = listaPassageiros.filter(function (pax, idx) {
              if (typeof pax === 'object' && pax !== null) {
                return !pax.responsavel && (pax.posicao ? pax.posicao >= 2 : idx >= 1);
              }
              return idx >= 1;
            });

            if (demaisPassageiros.length > 0) {
              htmlTooltip += '<div class="grupo-item__tooltip-pax-titulo"><strong>Passageiros:</strong></div>';
              htmlTooltip += '<ul class="grupo-item__tooltip-lista">';
              demaisPassageiros.forEach(function (pax, i) {
                var numPos = (typeof pax === 'object' && pax && pax.posicao) ? pax.posicao : (i + 2);
                var nomePax = typeof pax === 'string' ? pax : (pax.nome || 'Passageiro');
                var faixaPax = (typeof pax === 'object' && pax && pax.faixa) ? pax.faixa : (pax.crianca_colo ? '0 a 5 anos' : (pax.menor ? '6 a 17 anos' : '18 anos ou mais'));
                htmlTooltip += '<li class="grupo-item__tooltip-item">' + numPos + ' - ' + escapeHtml(nomePax) + ' | <span class="grupo-item__tooltip-faixa">' + escapeHtml(faixaPax) + '</span></li>';
              });
              htmlTooltip += '</ul>';
            }

            var dataPagto = r.pago_em || r.criado_em;
            if (dataPagto) {
              htmlTooltip += '<div class="grupo-item__tooltip-pagamento"><strong>Confirmação de pagamento:</strong> ' + escapeHtml(dataPagto) + '</div>';
            }

            tooltip.innerHTML = htmlTooltip;
          }
          tituloGrupoWrap.appendChild(tooltip);

          assentosGrid.appendChild(item);
        });

        // Bloco de Vagas Livres se ainda houver vagas disponíveis no ônibus
        if (vagasRestantes > 0) {
          var slotLivres = document.createElement('div');
          slotLivres.className = 'onibus-vagas-livres-slot';
          slotLivres.innerHTML = `
            <div class="onibus-vagas-livres-icone" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 18v-5a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5"></path>
                <path d="M5 15h14M7 18v2M17 18v2"></path>
              </svg>
            </div>
            <div class="onibus-vagas-livres-info">
              <strong>` + (vagasRestantes === 1 ? '1 Assento Livre' : vagasRestantes + ' Assentos Livres') + `</strong>
              <span>Espaço disponível neste ônibus. Arraste grupos ou use a opção "Mover…" para alocar pessoas aqui.</span>
            </div>
          `;
          assentosGrid.appendChild(slotLivres);
        }
      } else {
        var vazioHint = document.createElement('div');
        vazioHint.className = 'onibus-planta__vazio';
        vazioHint.textContent = maxL + ' vagas livres. Arraste grupos para cá ou use a opção "Mover…" para alocar pessoas neste ônibus.';
        assentosGrid.appendChild(vazioHint);
      }

      corpoOnibus.appendChild(assentosGrid);
      card.append(header, corpoOnibus);

      el.frotaContainer.appendChild(card);
    });

    // Card Horizontal para Adicionar Ônibus Vazio
    var nextBusNum = onibusList.length > 0 ? Math.max.apply(null, onibusList.map(function (o) { return Number(o.numero); })) + 1 : 1;
    var btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.className = 'onibus-card onibus-card--adicionar';
    btnAdd.innerHTML = `
      <div class="onibus-card--adicionar-icone">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </div>
      <div class="onibus-card--adicionar-texto">
        <h4 class="onibus-card--adicionar-titulo">Adicionar Ônibus Vazio à Frota (Ônibus ` + nextBusNum + `)</h4>
        <p class="onibus-card--adicionar-desc">Cria uma nova cabine para balancear grupos e organizar os assentos da viagem.</p>
      </div>
    `;
    btnAdd.onclick = function () {
      var novoBusNum = onibusList.length > 0 ? Math.max.apply(null, onibusList.map(function (o) { return Number(o.numero); })) + 1 : 1;
      onibusList.push({ numero: novoBusNum, ocupados: 0, vip_inclusos: 0, reservas: [] });
      renderizarFrota();
    };
    el.frotaContainer.appendChild(btnAdd);

    renderizarSemOnibusConfirmado();
  }

  function encontrarReserva(reservaId) {
    return estado.reservas.find(function (reserva) {
      return String(reserva.id) === String(reservaId);
    }) || null;
  }

  function rotuloGrupo(reservaId) {
    var reserva = encontrarReserva(reservaId);
    if (!reserva) return 'Reserva ' + String(reservaId).slice(0, 8);
    return reserva.grupo || reserva.contato || ('Reserva ' + String(reservaId).slice(0, 8));
  }

  function tamanhoReservaConhecida(reservaId, fallback) {
    var reserva = encontrarReserva(reservaId);
    if (!reserva) return Number(fallback || 0);
    return Number(reserva.pagantes || 0) + Number(reserva.criancas || 0);
  }

  function criarLinhaBalanceamento(move) {
    var linha = document.createElement('div');
    linha.className = 'frota-otimizacao__movimento';

    var reserva = encontrarReserva(move.registration_id);
    var nomeGrupo = (reserva && reserva.grupo) ? reserva.grupo : ('Reserva #' + (reserva && reserva.code ? reserva.code : String(move.registration_id).slice(0, 8)));
    var nomeContato = (reserva && reserva.contato) ? reserva.contato : 'Não informado';

    var numPagantes = reserva ? Number(reserva.pagantes || 1) : Number(move.size || 1);
    var numCriancas = reserva ? Number(reserva.criancas || 0) : 0;
    var textoPessoas = numPagantes === 1 ? '1 pessoa' : numPagantes + ' pessoas';
    if (numCriancas > 0) {
      textoPessoas += ' + ' + (numCriancas === 1 ? '1 criança de colo' : numCriancas + ' crianças de colo');
    }

    var dataPagto = reserva ? (reserva.pago_em || reserva.criado_em) : null;

    var origem = move.from_bus === null ? 'Sem ônibus' : 'Ônibus ' + move.from_bus;
    var destino = move.to_bus === null ? 'Sem ônibus confirmado' : 'Ônibus ' + move.to_bus;

    // --- Linha Superior / Header do Card ---
    var topRow = document.createElement('div');
    topRow.className = 'frota-otimizacao__movimento-top';

    var infoLeft = document.createElement('div');
    infoLeft.className = 'frota-otimizacao__movimento-info-left';
    infoLeft.innerHTML = '<strong class="frota-otimizacao__movimento-grupo">' + escapeHtml(nomeGrupo) + '</strong>'
      + '<span class="frota-otimizacao__movimento-sep">|</span>'
      + '<span class="frota-otimizacao__movimento-contato"><span class="frota-otimizacao__movimento-contato-label">Contato principal:</span> ' + escapeHtml(nomeContato) + '</span>'
      + '<span class="frota-otimizacao__movimento-sep">|</span>'
      + '<span class="frota-otimizacao__movimento-qtd">' + escapeHtml(textoPessoas) + '</span>';

    var rightSide = document.createElement('div');
    rightSide.className = 'frota-otimizacao__movimento-right';

    if (dataPagto) {
      var pagtoTag = document.createElement('span');
      pagtoTag.className = 'frota-otimizacao__movimento-pagamento';
      pagtoTag.textContent = 'pagamento aprovado ' + dataPagto;
      rightSide.appendChild(pagtoTag);
    }

    var rotaBadge = document.createElement('span');
    rotaBadge.className = 'frota-otimizacao__movimento-rota';
    rotaBadge.innerHTML = '<span class="frota-otimizacao__rota-origem">' + escapeHtml(origem) + '</span> <span class="frota-otimizacao__rota-seta">→</span> <span class="frota-otimizacao__rota-destino">' + escapeHtml(destino) + '</span>';
    rightSide.appendChild(rotaBadge);

    topRow.append(infoLeft, rightSide);

    // --- Linha Inferior / Nomes dos Passageiros ---
    var bottomRow = document.createElement('div');
    bottomRow.className = 'frota-otimizacao__movimento-passageiros';

    var listaPax = reserva && Array.isArray(reserva.passageiros) && reserva.passageiros.length > 0
      ? reserva.passageiros
      : [{ nome: nomeContato }];

    var nomesFormatados = listaPax.map(function (p) {
      var n = typeof p === 'string' ? p : p.nome;
      var f = typeof p === 'object' && p.faixa ? ' (' + p.faixa + ')' : '';
      return escapeHtml(n + f);
    }).join(' <span class="frota-otimizacao__movimento-pax-sep">|</span> ');

    bottomRow.innerHTML = '<span class="frota-otimizacao__movimento-pax-label">Passageiros:</span> <span class="frota-otimizacao__movimento-pax-lista">' + nomesFormatados + '</span>';

    linha.append(topRow, bottomRow);
    return linha;
  }

  function renderizarBalancePreview(plan) {
    if (!el.frotaOtimizacao || !plan) return;

    el.frotaOtimizacao.hidden = false;
    el.frotaOtimizacaoMovimentos.replaceChildren();
    el.frotaOtimizacaoEspera.replaceChildren();

    var atualFechados = Number(plan.current && plan.current.closed || 0);
    var previstoFechados = Number(plan.proposed && plan.proposed.closed || 0);
    var espera = Array.isArray(plan.waiting) ? plan.waiting : [];
    var movimentos = Array.isArray(plan.moves) ? plan.moves : [];
    el.frotaOtimizacaoResumo.textContent = 'Agora: ' + atualFechados
      + (atualFechados === 1 ? ' ônibus fechado' : ' ônibus fechados')
      + ' · Depois: ' + previstoFechados
      + (previstoFechados === 1 ? ' ônibus fechado' : ' ônibus fechados')
      + ' · ' + espera.length + (espera.length === 1 ? ' grupo em espera' : ' grupos em espera');

    var tituloMovimentos = document.createElement('h4');
    tituloMovimentos.textContent = movimentos.length
      ? 'Movimentações (' + movimentos.length + ')'
      : 'Nenhuma movimentação necessária';
    el.frotaOtimizacaoMovimentos.appendChild(tituloMovimentos);

    if (movimentos.length) {
      var listaMovimentos = document.createElement('div');
      listaMovimentos.className = 'frota-otimizacao__lista';
      movimentos.forEach(function (move) {
        listaMovimentos.appendChild(criarLinhaBalanceamento(move));
      });
      el.frotaOtimizacaoMovimentos.appendChild(listaMovimentos);
    } else {
      var vazio = document.createElement('p');
      vazio.className = 'frota-otimizacao__vazio';
      vazio.textContent = 'A distribuição atual já é a melhor encontrada pelas regras da Frota.';
      el.frotaOtimizacaoMovimentos.appendChild(vazio);
    }

    var tituloEspera = document.createElement('h4');
    tituloEspera.textContent = espera.length
      ? 'Sem ônibus confirmado (' + espera.length + ')'
      : 'Sem grupos aguardando ônibus';
    el.frotaOtimizacaoEspera.appendChild(tituloEspera);
    if (espera.length) {
      var listaEspera = document.createElement('ul');
      listaEspera.className = 'frota-otimizacao__espera-lista';
      espera.forEach(function (id) {
        var item = document.createElement('li');
        item.textContent = rotuloGrupo(id) + ' · pagamento aprovado';
        listaEspera.appendChild(item);
      });
      el.frotaOtimizacaoEspera.appendChild(listaEspera);
    }

    el.frotaOtimizacaoAplicar.disabled = movimentos.length === 0;
  }

  function solicitarBalance() {
    if (!estado.token || !el.otimizarDistribuicao) return;
    el.otimizarDistribuicao.disabled = true;
    el.otimizarDistribuicao.setAttribute('aria-busy', 'true');
    el.otimizarDistribuicao.textContent = 'Calculando…';

    fetch(API_AUTO_BALANCE + '?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: {
        'X-Admin-Token': estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'preview' })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) throw new Error(data.error || 'Não foi possível calcular a distribuição.');
        return data;
      });
    }).then(function (data) {
      estado.frotaBalancePreview = data.plan || null;
      renderizarBalancePreview(estado.frotaBalancePreview);
    }).catch(function (err) {
      mostrarAlertaModal('Não foi possível otimizar a Frota', err.message, 'erro');
    }).finally(function () {
      el.otimizarDistribuicao.disabled = false;
      el.otimizarDistribuicao.removeAttribute('aria-busy');
      el.otimizarDistribuicao.textContent = 'Otimizar distribuição';
    });
  }

  function aplicarBalance() {
    var preview = estado.frotaBalancePreview;
    if (!estado.token || !preview || !preview.signature) return;

    el.frotaOtimizacaoAplicar.disabled = true;
    el.frotaOtimizacaoAplicar.setAttribute('aria-busy', 'true');
    el.frotaOtimizacaoAplicar.textContent = 'Aplicando…';

    fetch(API_AUTO_BALANCE + '?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: {
        'X-Admin-Token': estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'apply', signature: preview.signature })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) {
          var erro = new Error(data.error || 'Não foi possível aplicar a distribuição.');
          erro.status = resp.status;
          throw erro;
        }
        return data;
      });
    }).then(function (data) {
      var plan = data.plan || preview;
      estado.frotaBalancePreview = null;
      el.frotaOtimizacao.hidden = true;
      mostrarAlertaModal(
        'Distribuição aplicada',
        plan.proposed.closed + (plan.proposed.closed === 1 ? ' ônibus fechado.' : ' ônibus fechados.'),
        'ok'
      );
      carregar();
    }).catch(function (err) {
      estado.frotaBalancePreview = null;
      el.frotaOtimizacao.hidden = true;
      if (err.status === 409) {
        mostrarAlertaModal('Prévia desatualizada', err.message, 'aviso');
        carregar();
        return;
      }
      mostrarAlertaModal('Não foi possível aplicar a distribuição', err.message, 'erro');
    }).finally(function () {
      el.frotaOtimizacaoAplicar.removeAttribute('aria-busy');
      el.frotaOtimizacaoAplicar.textContent = 'Aplicar distribuição';
    });
  }

  function renderizarSemOnibusConfirmado() {
    if (!el.frotaSemOnibus || !el.frotaSemOnibusLista) return;
    var espera = estado.frota && Array.isArray(estado.frota.sem_onibus_confirmado)
      ? estado.frota.sem_onibus_confirmado
      : [];
    el.frotaSemOnibusLista.replaceChildren();
    el.frotaSemOnibus.hidden = espera.length === 0;
    if (!espera.length) return;
    var capacidade = Number(estado.frota.capacidade || 46);

    espera.forEach(function (item) {
      var linha = document.createElement('div');
      linha.className = 'frota-sem-onibus__item';

      // --- Linha Superior / Header do Card ---
      var topRow = document.createElement('div');
      topRow.className = 'frota-sem-onibus__top';

      var infoLeft = document.createElement('div');
      infoLeft.className = 'frota-sem-onibus__info-left';

      var nomeGrupo = item.grupo || ('Reserva #' + item.code);
      var nomeContato = item.contato || 'Não informado';
      var nomeGrupoClasse = 'frota-sem-onibus__nome-grupo' + (item.is_vip ? ' frota-sem-onibus__nome-grupo--vip' : '');
      var marcaVip = item.is_vip ? '★ ' : '';

      var numPagantes = Number(item.pagantes || item.total || 1);
      var numCriancas = Number(item.criancas || 0);
      var textoPessoas = numPagantes === 1 ? '1 pessoa' : numPagantes + ' pessoas';
      if (numCriancas > 0) {
        textoPessoas += ' + ' + (numCriancas === 1 ? '1 criança de colo' : numCriancas + ' crianças de colo');
      }

      infoLeft.innerHTML = '<strong class="' + nomeGrupoClasse + '">' + marcaVip + escapeHtml(nomeGrupo) + '</strong>'
        + '<span class="frota-sem-onibus__sep">|</span>'
        + '<span class="frota-sem-onibus__contato"><span class="frota-sem-onibus__contato-label">Contato principal:</span> ' + escapeHtml(nomeContato) + '</span>'
        + '<span class="frota-sem-onibus__sep">|</span>'
        + '<span class="frota-sem-onibus__qtd">' + escapeHtml(textoPessoas) + '</span>';

      var rightSide = document.createElement('div');
      rightSide.className = 'frota-sem-onibus__right';

      if (item.pago_em) {
        var pagtoTag = document.createElement('span');
        pagtoTag.className = 'frota-sem-onibus__pagamento';
        pagtoTag.textContent = 'pagamento aprovado ' + item.pago_em;
        rightSide.appendChild(pagtoTag);
      }

      var select = document.createElement('select');
      select.className = 'grupo-item__select-mover frota-sem-onibus__select';
      select.setAttribute('aria-label', 'Alocar ' + (item.grupo || item.contato || item.code));
      var padrao = document.createElement('option');
      padrao.value = '';
      padrao.textContent = 'Alocar em…';
      padrao.disabled = true;
      padrao.selected = true;
      select.appendChild(padrao);
      (estado.frota.onibus || []).forEach(function (onibus) {
        var option = document.createElement('option');
        option.value = onibus.numero;
        var vagasOnibus = onibus.vagas_livres !== undefined
          ? Math.max(0, Number(onibus.vagas_livres || 0))
          : Math.max(0, capacidade - assentosOcupadosDoOnibus(onibus));
        option.textContent = 'Ônibus ' + onibus.numero + ' (' + vagasOnibus + (vagasOnibus === 1 ? ' vaga)' : ' vagas)');
        option.disabled = vagasOnibus < Math.max(1, Number(item.pagantes || 0));
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        if (!this.value) return;
        var destino = Number(this.value);
        this.disabled = true;
        moverParaOnibus(item.id, destino);
      });
      rightSide.appendChild(select);

      if (item.is_vip && !String(item.id || '').startsWith('vip_')) {
        var removerEspera = document.createElement('button');
        removerEspera.type = 'button';
        removerEspera.className = 'frota-sem-onibus__remover-vip';
        removerEspera.setAttribute('aria-label', 'Remover reserva VIP de ' + (item.contato || 'VIP'));
        removerEspera.title = 'Remover reserva VIP';
        removerEspera.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>';
        removerEspera.addEventListener('click', function () { removerReservaVip(item); });
        rightSide.appendChild(removerEspera);
      }

      topRow.append(infoLeft, rightSide);

      // --- Linha Inferior / Nomes dos Passageiros ---
      var bottomRow = document.createElement('div');
      bottomRow.className = 'frota-sem-onibus__passageiros';

      var listaPax = Array.isArray(item.passageiros) && item.passageiros.length > 0
        ? item.passageiros
        : [{ nome: nomeContato }];

      var nomesFormatados = listaPax.map(function (p) {
        var n = typeof p === 'string' ? p : p.nome;
        var f = typeof p === 'object' && p.faixa ? ' (' + p.faixa + ')' : '';
        return escapeHtml(n + f);
      }).join(' <span class="frota-sem-onibus__pax-sep">|</span> ');

      bottomRow.innerHTML = '<span class="frota-sem-onibus__pax-label">Passageiros:</span> <span class="frota-sem-onibus__pax-lista">' + nomesFormatados + '</span>';

      linha.append(topRow, bottomRow);
      el.frotaSemOnibusLista.appendChild(linha);
    });
  }

  function removerReservaVip(reserva) {
    var nome = reserva && reserva.responsavel ? reserva.responsavel : 'esta pessoa';
    mostrarConfirmacaoModal(
      'Remover reserva VIP?',
      'A reserva VIP de ' + nome + ' será removida da frota e da tabela de controle.',
      'Remover VIP'
    ).then(function (confirmado) {
      if (!confirmado || !estado.token) return;
      el.frotaContainer.style.opacity = '0.5';
      fetch(API_VIP_DELETE + '?token=' + encodeURIComponent(estado.token), {
        method: 'POST',
        headers: {
          'X-Admin-Token': estado.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ registration_id: reserva.id })
      }).then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) throw new Error(data.error || 'Erro ao remover reserva VIP');
          return data;
        });
      }).then(function () {
        carregar();
      }).catch(function (err) {
        mostrarAlertaModal('Não foi possível remover a reserva VIP', err.message, 'erro');
      }).finally(function () {
        el.frotaContainer.style.opacity = '1';
      });
    });
  }

  function moverParaOnibus(reservaId, destinoBusNum) {
    if (!estado.token) return;
    el.frotaContainer.style.opacity = '0.5';
    fetch('api/bus-fleet-assign?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: {
        'X-Admin-Token': estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        registration_id: reservaId,
        bus_number: destinoBusNum
      })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) throw new Error(data.error || 'Erro ao mover passageiros');
        return data;
      });
    }).then(function () {
      // Recarrega tudo para manter as totalizacoes sincronizadas
      carregar();
    }).catch(function (err) {
      mostrarAlertaModal('Não foi possível mover passageiros', err.message, 'erro');
    }).finally(function () {
      el.frotaContainer.style.opacity = '1';
    });
  }

  function novoVipRascunho() {
    return { full_name: '', cpf: '', whatsapp: '', email: '', bus_number: '' };
  }

  function erroVipForm(mensagem) {
    if (!el.vipFormErro) return;
    el.vipFormErro.textContent = mensagem || '';
    el.vipFormErro.hidden = !mensagem;
  }

  function validarCampoVip(index, campo, input) {
    var valor = String(input ? input.value : estado.vipDrafts[index][campo] || '').trim();
    var invalido = false;
    if (campo === 'whatsapp') {
      invalido = valor !== '' && !normalizarWhatsapp(valor);
    } else if (campo === 'email') {
      invalido = valor !== '' && !emailValido(valor);
    }

    if (input) {
      if (invalido) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    return !invalido;
  }

  function renderizarFormulariosVip(focarIndice) {
    if (!el.vipFormularios) return;
    el.vipFormularios.replaceChildren();
    var onibus = estado.frota && Array.isArray(estado.frota.onibus) ? estado.frota.onibus : [];

    estado.vipDrafts.forEach(function (draft, index) {
      var fieldset = document.createElement('fieldset');
      fieldset.className = 'vip-formulario';
      fieldset.setAttribute('aria-label', 'Dados do VIP ' + (index + 1));
      var header = document.createElement('div');
      header.className = 'vip-formulario__cabecalho';
      var legend = document.createElement('span');
      legend.className = 'vip-formulario__numero';
      legend.textContent = 'VIP ' + (index + 1);
      header.appendChild(legend);

      if (estado.vipDrafts.length > 1) {
        var remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'vip-formulario__remover';
        remover.textContent = 'Remover formulário';
        remover.addEventListener('click', function () {
          estado.vipDrafts.splice(index, 1);
          renderizarFormulariosVip(Math.max(0, index - 1));
        });
        header.appendChild(remover);
      }
      fieldset.appendChild(header);

      var grid = document.createElement('div');
      grid.className = 'vip-formulario__grid';
      var campos = [
        { key: 'full_name', label: 'Nome *', type: 'text', autocomplete: 'name', cls: 'vip-formulario__campo--nome' },
        { key: 'cpf', label: 'CPF *', type: 'text', autocomplete: 'off', cls: '' },
        { key: 'whatsapp', label: 'WhatsApp', type: 'tel', autocomplete: 'tel', cls: '' },
        { key: 'email', label: 'E-mail', type: 'email', autocomplete: 'email', cls: '' }
      ];

      campos.forEach(function (campo) {
        var wrapper = document.createElement('div');
        wrapper.className = 'vip-formulario__campo' + (campo.cls ? ' ' + campo.cls : '');
        var label = document.createElement('label');
        var id = 'vip-' + index + '-' + campo.key;
        label.setAttribute('for', id);
        label.textContent = campo.label;
        var input = document.createElement('input');
        input.id = id;
        input.type = campo.type;
        input.autocomplete = campo.autocomplete;
        input.value = campo.key === 'cpf'
          ? formatarCpf(draft[campo.key])
          : (campo.key === 'whatsapp' ? formatarWhatsapp(draft[campo.key]) : (draft[campo.key] || ''));
        if (campo.key === 'whatsapp') {
          input.inputMode = 'tel';
          input.maxLength = 15;
          input.placeholder = '(11) 90000-0000';
        }
        input.dataset.vipIndex = String(index);
        input.dataset.vipField = campo.key;
        input.addEventListener('input', function () {
          var valor = campo.key === 'cpf'
            ? formatarCpf(input.value)
            : (campo.key === 'whatsapp'
              ? formatarWhatsapp(input.value)
              : (campo.key === 'email' ? normalizarEmail(input.value) : input.value));
          input.value = valor;
          estado.vipDrafts[index][campo.key] = valor;
          if (campo.key === 'whatsapp' || campo.key === 'email') {
            validarCampoVip(index, campo.key, input);
          } else {
            input.removeAttribute('aria-invalid');
          }
          erroVipForm('');
        });
        input.addEventListener('blur', function () {
          if (campo.key === 'whatsapp' && !validarCampoVip(index, campo.key, input)) {
            erroVipForm('Informe um WhatsApp válido com DDD ou deixe o campo em branco.');
          } else if (campo.key === 'email' && !validarCampoVip(index, campo.key, input)) {
            erroVipForm('Informe um e-mail válido ou deixe o campo em branco.');
          }
        });
        wrapper.append(label, input);
        grid.appendChild(wrapper);
      });

      var busWrapper = document.createElement('div');
      busWrapper.className = 'vip-formulario__campo vip-formulario__campo--onibus';
      var busLabel = document.createElement('label');
      var busId = 'vip-' + index + '-bus_number';
      busLabel.setAttribute('for', busId);
      busLabel.textContent = 'Ônibus *';
      var select = document.createElement('select');
      select.id = busId;
      select.dataset.vipIndex = String(index);
      select.dataset.vipField = 'bus_number';
      var waiting = document.createElement('option');
      waiting.value = '';
      waiting.textContent = 'Sem ônibus confirmado';
      select.appendChild(waiting);
      onibus.forEach(function (info) {
        var number = Number(info.numero);
        var free = info.vagas_livres !== undefined
          ? Math.max(0, Number(info.vagas_livres || 0))
          : Math.max(0, Number(estado.frota.capacidade || 46) - assentosOcupadosDoOnibus(info));
        var option = document.createElement('option');
        option.value = String(number);
        option.textContent = 'Ônibus ' + number + ' (' + free + (free === 1 ? ' vaga livre)' : ' vagas livres)');
        option.disabled = free < 1;
        select.appendChild(option);
      });
      select.value = draft.bus_number || '';
      select.addEventListener('change', function () {
        estado.vipDrafts[index].bus_number = select.value;
        erroVipForm('');
      });
      busWrapper.append(busLabel, select);
      grid.appendChild(busWrapper);
      fieldset.appendChild(grid);
      el.vipFormularios.appendChild(fieldset);
    });

    if (typeof focarIndice === 'number') {
      var foco = document.getElementById('vip-' + focarIndice + '-full_name');
      if (foco) window.setTimeout(function () { foco.focus(); }, 0);
    }
  }

  function abrirDialogVip() {
    if (!el.vipDialog) return;
    estado.vipDrafts = [novoVipRascunho()];
    estado.vipEnviando = false;
    erroVipForm('');
    if (el.vipConfirmar) {
      el.vipConfirmar.disabled = false;
      el.vipConfirmar.removeAttribute('aria-busy');
      el.vipConfirmar.textContent = 'Confirmar reservas VIP';
    }
    renderizarFormulariosVip(0);
    if (typeof el.vipDialog.showModal === 'function') {
      try {
        el.vipDialog.showModal();
      } catch (err) {
        el.vipDialog.setAttribute('open', '');
      }
    } else {
      el.vipDialog.setAttribute('open', '');
    }
  }

  function confirmarVips(evento) {
    evento.preventDefault();
    if (estado.vipEnviando || !estado.token) return;
    var invalid = null;
    estado.vipDrafts.forEach(function (draft, index) {
      ['full_name', 'cpf'].forEach(function (field) {
        if (invalid || String(draft[field] || '').trim() !== '') return;
        invalid = { index: index, field: field };
      });
      if (!invalid && String(draft.whatsapp || '').trim() !== '' && !normalizarWhatsapp(draft.whatsapp)) {
        invalid = { index: index, field: 'whatsapp', message: 'Informe um WhatsApp válido com DDD ou deixe o campo em branco.' };
      }
      if (!invalid && String(draft.email || '').trim() !== '' && !emailValido(draft.email)) {
        invalid = { index: index, field: 'email', message: 'Informe um e-mail válido ou deixe o campo em branco.' };
      }
    });
    if (invalid) {
      var mensagem = invalid.message || 'Preencha Nome e CPF em todos os formulários VIP.';
      erroVipForm(mensagem);
      var invalidInput = document.getElementById('vip-' + invalid.index + '-' + invalid.field);
      if (invalidInput) {
        invalidInput.setAttribute('aria-invalid', 'true');
        invalidInput.focus();
      }
      return;
    }

    estado.vipEnviando = true;
    erroVipForm('');
    if (el.vipConfirmar) {
      el.vipConfirmar.disabled = true;
      el.vipConfirmar.setAttribute('aria-busy', 'true');
      el.vipConfirmar.textContent = 'Salvando…';
    }

    var payload = estado.vipDrafts.map(function (draft) {
      return {
        full_name: normalizarNomeCompleto(draft.full_name),
        cpf: draft.cpf.trim(),
        whatsapp: normalizarWhatsapp(draft.whatsapp),
        email: normalizarEmail(draft.email),
        bus_number: draft.bus_number === '' ? null : Number(draft.bus_number)
      };
    });

    fetch(API_VIP_CREATE + '?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: {
        'X-Admin-Token': estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ vips: payload })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) throw new Error(data.error || 'Não foi possível salvar as reservas VIP.');
        return data;
      });
    }).then(function () {
      if (el.vipDialog.open) el.vipDialog.close();
      estado.vipDrafts = [];
      carregar();
    }).catch(function (err) {
      estado.vipEnviando = false;
      if (el.vipConfirmar) {
        el.vipConfirmar.disabled = false;
        el.vipConfirmar.removeAttribute('aria-busy');
        el.vipConfirmar.textContent = 'Confirmar reservas VIP';
      }
      erroVipForm(err.message);
    });
  }

  // ---- exportação Excel ---------------------------------------------------

  /**
   * Exporta o que está na tela em .xlsx, gerado no servidor.
   *
   * O arquivo é montado em PHP porque .xlsx é um ZIP com vários XMLs dentro:
   * fazer isso no navegador exigiria uma biblioteca de ZIP, e o servidor já tem
   * ZipArchive. O navegador só dispara o download com o filtro atual.
   */
  function exportarExcel() {
    var url = 'api/bus-admin-xlsx?token=' + encodeURIComponent(estado.token)
      + '&filtro=' + encodeURIComponent(estado.filtro);
    if (estado.filtroOnibus !== 'todos') {
      url += '&onibus=' + encodeURIComponent(estado.filtroOnibus);
    }
    if (estado.busca.trim()) {
      url += '&busca=' + encodeURIComponent(estado.busca.trim());
    }
    window.location.href = url;
  }

  // ---- carregamento ------------------------------------------------------

  function reconciliarPendencias() {
    if (!estado.token || estado.reconciliandoPendencias) return;

    estado.reconciliandoPendencias = true;
    fetch(API_RECONCILE + '?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: { 'X-Admin-Token': estado.token }
    })
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (resultado) {
        if (Number(resultado.updated) > 0) {
          estado.reconciliandoPendencias = false;
          carregar();
        }
      })
      .catch(function () {
        // A tabela já foi exibida. Uma falha temporária nesta proteção não deve
        // esconder os dados nem invalidar a sessão administrativa.
      })
      .finally(function () {
        estado.reconciliandoPendencias = false;
      });
  }

  function carregar() {
    if (!estado.token) {
      mostrar(el.estadoLogin);
      return;
    }

    estado.frotaBalancePreview = null;
    if (el.frotaOtimizacao) el.frotaOtimizacao.hidden = true;

    el.recarregar.setAttribute('aria-busy', 'true');

    fetch(API + '?token=' + encodeURIComponent(estado.token), { cache: 'no-store' })
      .then(function (resp) {
        if (resp.status === 404) {
          var e = new Error('token');
          e.semAcesso = true;
          throw e;
        }
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (dados) {
        estado.reservas = dados.reservas || [];
        estado.frota = dados.frota || null;
        renderizarFiltroOnibus();
        renderizarResumo(dados.resumo);

        el.baixarLista.href = API_LISTA + '?token=' + encodeURIComponent(estado.token);
        el.atualizadoEm.textContent = new Date().toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        renderizar();
        renderizarFrota();
        mostrar(el.dados);
        reconciliarPendencias();
      })
      .catch(function (erro) {
        if (erro && erro.semAcesso) {
          if (!isLocalhost) {
            estado.token = '';
            localStorage.removeItem('kob_admin_token');
            if (el.erroLogin) el.erroLogin.hidden = false;
            mostrar(el.estadoLogin);
            return;
          }
        }
        el.erroDetalhe.textContent = 'Detalhe técnico: ' + erro.message;
        mostrar(el.erro);
      })
      .finally(function () {
        el.recarregar.removeAttribute('aria-busy');
      });
  }

  // ---- eventos -----------------------------------------------------------

  el.abas.forEach(function (botao) {
    botao.addEventListener('click', function () {
      var alvo = botao.dataset.aba;
      el.abas.forEach(function (b) { b.classList.remove('ativo'); });
      botao.classList.add('ativo');

      el.conteudosAba.forEach(function (c) {
        if (c.id === 'aba-' + alvo) {
          c.hidden = false;
          c.classList.add('ativa');
        } else {
          c.hidden = true;
          c.classList.remove('ativa');
        }
      });
    });
  });

  if (el.vipAdicionar) {
    el.vipAdicionar.addEventListener('click', abrirDialogVip);
  }

  if (el.vipCancelar && el.vipDialog) {
    el.vipCancelar.addEventListener('click', function () {
      if (!estado.vipEnviando) el.vipDialog.close();
    });
  }

  if (el.vipAdicionarOutro) {
    el.vipAdicionarOutro.addEventListener('click', function () {
      if (estado.vipEnviando) return;
      estado.vipDrafts.push(novoVipRascunho());
      renderizarFormulariosVip(estado.vipDrafts.length - 1);
    });
  }

  if (el.vipForm) {
    el.vipForm.addEventListener('submit', confirmarVips);
  }

  if (el.vipDialog) {
    el.vipDialog.addEventListener('click', function (event) {
      if (event.target === el.vipDialog && !estado.vipEnviando) el.vipDialog.close();
    });
  }

  if (el.otimizarDistribuicao) {
    el.otimizarDistribuicao.addEventListener('click', solicitarBalance);
  }

  if (el.frotaOtimizacaoCancelar) {
    el.frotaOtimizacaoCancelar.addEventListener('click', function () {
      estado.frotaBalancePreview = null;
      if (el.frotaOtimizacao) el.frotaOtimizacao.hidden = true;
    });
  }

  if (el.frotaOtimizacaoAplicar) {
    el.frotaOtimizacaoAplicar.addEventListener('click', aplicarBalance);
  }

  el.busca.addEventListener('input', function (ev) {
    estado.busca = ev.currentTarget.value;
    renderizar();
  });

  el.limparBusca.addEventListener('click', function () {
    estado.busca = '';
    el.busca.value = '';
    el.busca.focus();
    renderizar();
  });

  if (el.filtroOnibus) {
    el.filtroOnibus.addEventListener('change', function () {
      estado.filtroOnibus = el.filtroOnibus.value;
      renderizar();
    });
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-filtro]')).forEach(function (botao) {
    botao.addEventListener('click', function () {
      estado.filtro = botao.dataset.filtro;
      document.querySelectorAll('[data-filtro]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === botao));
      });
      renderizar();
    });
  });

  el.recarregar.addEventListener('click', carregar);
  el.tentarNovamente.addEventListener('click', carregar);
  el.exportar.addEventListener('click', exportarExcel);

  document.addEventListener('click', function (ev) {
    document.querySelectorAll('.grupo-item__mover[open]').forEach(function (menu) {
      if (!menu.contains(ev.target)) menu.open = false;
    });
  });

  // Realce por RESERVA, não por linha. Feito em JS e não com `tr:hover` puro
  // porque CSS não tem seletor de irmão anterior: `:hover` numa linha do meio do
  // grupo não consegue alcançar as linhas de cima.
  //
  // Delegação no <tbody>: o corpo é recriado a cada render, e listener por linha
  // teria de ser religado toda vez (e vazaria se alguém esquecesse de remover).
  function realcarGrupo(numero) {
    if (numero === grupoRealcado) return;   // cursor andando dentro do mesmo grupo
    if (grupoRealcado !== null) {
      el.corpo.querySelectorAll('tr[data-grupo="' + grupoRealcado + '"]')
        .forEach(function (tr) { tr.classList.remove('is-realcada'); });
    }
    if (numero !== null) {
      el.corpo.querySelectorAll('tr[data-grupo="' + numero + '"]')
        .forEach(function (tr) { tr.classList.add('is-realcada'); });
    }
    grupoRealcado = numero;
  }

  el.corpo.addEventListener('mouseover', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr[data-grupo]') : null;
    realcarGrupo(tr ? tr.dataset.grupo : null);
  });

  // mouseleave no <tbody> em vez de mouseout por linha: mouseout dispara a cada
  // troca de célula, e apagaria o realce no meio da leitura.
  el.corpo.addEventListener('mouseleave', function () {
    realcarGrupo(null);
  });

  // Teclado: quem navega por Tab também precisa ver o grupo, senão o recurso
  // existe só para quem usa mouse. focusin/focusout borbulham, ao contrário de
  // focus/blur, então funcionam com delegação.
  el.corpo.addEventListener('focusin', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr[data-grupo]') : null;
    if (tr) realcarGrupo(tr.dataset.grupo);
  });

  // Lógica de Login
  if (el.loginForm) {
    el.loginForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      estado.token = el.tokenInput.value.trim();
      if (estado.token) {
        el.erroLogin.hidden = true;
        localStorage.setItem('kob_admin_token', estado.token);
        mostrar(el.carregando);
        carregar();
      }
    });
  }

  if (el.botaoSair) {
    el.botaoSair.addEventListener('click', function () {
      estado.token = '';
      localStorage.removeItem('kob_admin_token');
      if (el.tokenInput) el.tokenInput.value = '';
      mostrar(el.estadoLogin);
    });
  }

  // O token fica salvo no navegador. Permite ler da URL como fallback.
  estado.token = localStorage.getItem('kob_admin_token') || '';
  if (!estado.token) {
    var params = new URLSearchParams(window.location.search);
    estado.token = params.get('token') || '';
    if (estado.token) {
      localStorage.setItem('kob_admin_token', estado.token);
      if (window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }

  // Em localhost, preenche token padrão automaticamente se estiver vazio
  if (!estado.token && isLocalhost) {
    estado.token = 'dev-token';
    localStorage.setItem('kob_admin_token', estado.token);
  }

  if (!estado.token) {
    mostrar(el.estadoLogin);
  } else {
    carregar();
  }
})();
