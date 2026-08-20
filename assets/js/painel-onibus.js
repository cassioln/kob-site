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
  var API_LISTA = 'api/bus-manifest';
  var API_AUTO_BALANCE = 'api/bus-fleet-auto-balance';

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
    vipInput: document.getElementById('vip-input'),
    vipSalvar: document.getElementById('salvar-vip'),
    alertaDialog: document.getElementById('painel-alerta-dialog'),
    dialogTitulo: document.getElementById('painel-dialog-titulo'),
    dialogMensagem: document.getElementById('painel-dialog-mensagem'),
    dialogIcone: document.getElementById('painel-dialog-icone'),
    dialogFechar: document.getElementById('painel-dialog-fechar')
  };

  var estado = {
    reservas: [],
    filtro: 'pago',
    busca: '',
    token: '',
    frota: null,
    frotaBalancePreview: null
  };

  // Número do grupo atualmente realçado. Guardado fora do handler para o
  // mouseover poder sair cedo quando o cursor apenas anda entre linhas da MESMA
  // reserva: sem isso, cada célula percorrida repintaria o grupo inteiro.
  var grupoRealcado = null;

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
      btnFechar.onclick = function () {
        dialog.close();
      };
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

  function mostrar(secao) {
    [el.carregando, el.estadoLogin, el.erro, el.vazio, el.dados].forEach(function (s) {
      if (s) s.hidden = s !== secao;
    });
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

  function badge(rotulo, tom) {
    var span = document.createElement('span');
    span.className = 'etiqueta etiqueta--' + tom;
    span.textContent = rotulo;
    return span;
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
        reservaSpan.textContent = r.code;
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

      // Passageiro: marcador de responsável, nome e aviso de nova reserva.
      var nomeWrap = document.createElement('div');
      var linhaNome = document.createElement('div');
      var pos = document.createElement('span');
      pos.className = 'tabela__posicao';
      // Numerar não ajudava a conferência: a ordem já é visual, e o número
      // competia com o nome. O que importa é UMA marca — quem é o responsável
      // pela reserva. Estrela para ele, travessão para os demais. O `title` e o
      // texto para leitor de tela existem porque símbolo sozinho não é lido.
      if (p.responsavel) {
        pos.classList.add('tabela__posicao--responsavel');
        pos.textContent = '★';
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

      celula('CPF', p.cpf || '—', 'tabela__cpf');

      if (p.whatsapp) {
        celula('WhatsApp', p.whatsapp, 'tabela__tel');
      } else {
        celula('WhatsApp', 'N/A', 'tabela__tel tabela__tel--vazio');
      }

      // O nome do grupo substitui a antiga contagem de pessoas e e exibido apenas na
      // primeira linha da reserva para manter o alinhamento visual do grupo.
      var nomeGrupo = (primeiro && r.grupo) ? r.grupo : '';
      celula('Grupo', nomeGrupo, 'tabela__grupo');

      var nomeOnibus = '';
      if (primeiro) {
        nomeOnibus = r.bus_number ? 'Ônibus ' + r.bus_number : '—';
      }
      celula('Ônibus', nomeOnibus, 'tabela__onibus');

      celula('Status', primeiro ? badge(r.status_rotulo, r.status_tom) : null);

      celula('Pago em', primeiro ? (r.pago_em || '—') : '', 'tabela__num');

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
    el.contagem.textContent = linhas.length
      ? plural(linhas.length, 'passageiro', 'passageiros') + ' em '
      + plural(Object.keys(grupos).length, 'reserva', 'reservas')
      : '';
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

  function renderizarFrota() {
    if (!estado.frota || !Array.isArray(estado.frota.onibus)) return;
    var onibusList = estado.frota.onibus;
    el.frotaContainer.replaceChildren();

    var maxL = Number(estado.frota.capacidade || 46);
    var minL = Number(estado.frota.minimo || 40);

    // Renderiza cada onibus como uma linha horizontal completa (veículo)
    onibusList.forEach(function (info) {
      var busNum = Number(info.numero || 1);
      var ocupados = Number(info.ocupados || 0);
      var vagasRestantes = Math.max(0, maxL - ocupados);
      var vipsNoBus = Number(info.vip_inclusos || 0);

      var card = document.createElement('div');
      card.className = 'onibus-card';
      card.dataset.bus = busNum;

      // Eventos de drag and drop na dropzone com validação dinâmica de vagas
      card.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        if (!itemArrastando) return;

        var totalDoItem = itemArrastando.total || 1;
        var mesmoOnibus = (itemArrastando.origemBus === busNum);

        if (mesmoOnibus) {
          card.classList.add('drag-over');
          card.classList.remove('drag-error');
          ev.dataTransfer.dropEffect = 'move';
        } else if (ocupados + totalDoItem > maxL) {
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
          var totalDoItem = itemArrastando.total || 1;
          if (ocupados + totalDoItem > maxL) {
            var vagasRestantesMsg = Math.max(0, maxL - ocupados);
            mostrarAlertaModal('Ônibus Lotado', 'O Ônibus ' + busNum + ' não tem vagas suficientes (' + (vagasRestantesMsg === 1 ? '1 vaga restante' : vagasRestantesMsg + ' vagas restantes') + ') para acomodar este grupo de ' + (totalDoItem === 1 ? '1 pessoa' : totalDoItem + ' pessoas') + '.', 'erro');
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
      titulo.textContent = 'Ônibus ' + busNum;

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
        + '<div class="onibus-card__stat-content"><span class="onibus-card__stat-label">Ocupação</span><strong class="onibus-card__stat-value"><span>' + ocupados + ' de ' + maxL + '</span><small>(' + percOcupacao + '%)</small></strong></div>';

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
            itemArrastando = { id: r.id, total: Number(r.total || 1), origemBus: busNum };
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
            tituloGrupo.innerHTML = '★ Lugar VIP da Organização';
          } else if (r.grupo) {
            tituloGrupo.textContent = r.grupo;
            tituloGrupo.title = r.grupo;
          } else {
            tituloGrupo.textContent = r.responsavel;
            tituloGrupo.title = r.responsavel;
          }

          var codeTag = document.createElement('span');
          codeTag.className = 'grupo-item__code';
          codeTag.textContent = '#' + (r.code || 'RESERVA');

          itemTop.append(tituloGrupo, codeTag);
          item.appendChild(itemTop);

          // Rodapé do card: Representação Visual por Meeples + Seletor Mover
          var itemBottom = document.createElement('div');
          itemBottom.className = 'grupo-item__bottom';

          var meeplePathD = 'M256 54.99c-27 0-46.418 14.287-57.633 32.23-10.03 16.047-14.203 34.66-15.017 50.962-30.608 15.135-64.515 30.394-91.815 45.994-14.32 8.183-26.805 16.414-36.203 25.26C45.934 218.28 39 228.24 39 239.99c0 5 2.44 9.075 5.19 12.065 2.754 2.99 6.054 5.312 9.812 7.48 7.515 4.336 16.99 7.95 27.412 11.076 15.483 4.646 32.823 8.1 47.9 9.577-14.996 25.84-34.953 49.574-52.447 72.315C56.65 378.785 39 403.99 39 431.99c0 4-.044 7.123.31 10.26.355 3.137 1.256 7.053 4.41 10.156 3.155 3.104 7.017 3.938 10.163 4.28 3.146.345 6.315.304 10.38.304h111.542c8.097 0 14.026.492 20.125-3.43 6.1-3.92 8.324-9.275 12.67-17.275l.088-.16.08-.166s9.723-19.77 21.324-39.388c5.8-9.808 12.097-19.576 17.574-26.498 2.74-3.46 5.304-6.204 7.15-7.754.564-.472.82-.56 1.184-.76.363.2.62.288 1.184.76 1.846 1.55 4.41 4.294 7.15 7.754 5.477 6.922 11.774 16.69 17.574 26.498 11.6 19.618 21.324 39.387 21.324 39.387l.08.165.088.16c4.346 8 6.55 13.323 12.61 17.254 6.058 3.93 11.974 3.45 19.957 3.45H448c4 0 7.12.043 10.244-.304 3.123-.347 6.998-1.21 10.12-4.332 3.12-3.122 3.984-6.997 4.33-10.12.348-3.122.306-6.244.306-10.244 0-28-17.65-53.205-37.867-79.488-17.493-22.74-37.45-46.474-52.447-72.315 15.077-1.478 32.417-4.93 47.9-9.576 10.422-3.125 19.897-6.74 27.412-11.075 3.758-2.168 7.058-4.49 9.81-7.48 2.753-2.99 5.192-7.065 5.192-12.065 0-11.75-6.934-21.71-16.332-30.554-9.398-8.846-21.883-17.077-36.203-25.26-27.3-15.6-61.207-30.86-91.815-45.994-.814-16.3-4.988-34.915-15.017-50.96C302.418 69.276 283 54.99 256 54.99z';

          var meepleAdultoSVG = '<svg viewBox="0 0 512 512" width="16" height="16" class="meeple-svg meeple-svg--adult" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';
          var meepleCriancaSVG = '<svg viewBox="0 0 512 512" width="11" height="11" class="meeple-svg meeple-svg--child" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';

          var meepleVipSVG = '<svg viewBox="0 0 512 512" width="18" height="18" class="meeple-svg meeple-svg--vip" focusable="false" aria-hidden="true"><path fill="currentColor" d="' + meeplePathD + '"></path></svg>';

          var meeplesContainer = document.createElement('div');
          meeplesContainer.className = 'grupo-item__meeples';

          if (r.is_vip) {
            meeplesContainer.classList.add('grupo-item__meeples--vip');
            meeplesContainer.title = '1 Lugar VIP da Organização';
            meeplesContainer.innerHTML = meepleVipSVG;
          } else {
            var numPagantes = Number(r.pagantes || r.total || 1);
            var numColo = Number(r.criancas || 0);

            var textoDesc = numPagantes === 1 ? '1 pagante' : numPagantes + ' pagantes';
            if (numColo > 0) {
              textoDesc += ' + ' + (numColo === 1 ? '1 criança de colo' : numColo + ' crianças de colo');
            }
            meeplesContainer.title = textoDesc;

            var htmlMeeples = '<span class="grupo-item__meeples-grupo grupo-item__meeples-grupo--adultos">';
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

            meeplesContainer.innerHTML = htmlMeeples;
          }

          // Seletor Mover para outro ônibus
          var selectMover = document.createElement('select');
          selectMover.className = 'grupo-item__select-mover';
          selectMover.title = 'Mover para outro ônibus';
          selectMover.setAttribute('aria-label', 'Mover para outro ônibus');

          var optPadrao = document.createElement('option');
          optPadrao.value = '';
          optPadrao.textContent = 'Mover…';
          optPadrao.disabled = true;
          optPadrao.selected = true;
          selectMover.appendChild(optPadrao);

          onibusList.forEach(function (outro) {
            var numOutro = Number(outro.numero);
            if (numOutro !== busNum) {
              var opt = document.createElement('option');
              opt.value = numOutro;
              var vagasLivresOutro = Math.max(0, maxL - Number(outro.ocupados || 0));
              opt.textContent = 'Ônibus ' + numOutro + ' (' + vagasLivresOutro + ' vagas)';
              selectMover.appendChild(opt);
            }
          });

          selectMover.addEventListener('change', function () {
            if (!this.value) return;
            var novoBus = Number(this.value);
            var destInfo = onibusList.find(function (o) { return Number(o.numero) === novoBus; });
            var ocupadosDest = destInfo ? Number(destInfo.ocupados || 0) : 0;
            var totalDoItem = Number(r.total || 1);
            if (ocupadosDest + totalDoItem > maxL) {
              var vagasRestantesMsg = Math.max(0, maxL - ocupadosDest);
              mostrarAlertaModal('Ônibus Lotado', 'O Ônibus ' + novoBus + ' não tem vagas suficientes (' + (vagasRestantesMsg === 1 ? '1 vaga restante' : vagasRestantesMsg + ' vagas restantes') + ') para acomodar este grupo de ' + (totalDoItem === 1 ? '1 pessoa' : totalDoItem + ' pessoas') + '.', 'erro');
              this.value = '';
              return;
            }
            moverParaOnibus(r.id, novoBus);
          });

          itemBottom.append(meeplesContainer, selectMover);
          item.appendChild(itemBottom);

          // Tooltip com Informações Extras no Hover
          var tooltip = document.createElement('div');
          tooltip.className = 'grupo-item__tooltip';
          if (r.is_vip) {
            tooltip.innerHTML = '<div class="grupo-item__tooltip-resp">★ Lugar VIP da Organização</div><div class="grupo-item__tooltip-pax">1 vaga reservada para a equipe</div>';
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
          item.appendChild(tooltip);

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

    // Config do VIP
    if (document.activeElement !== el.vipInput) {
      el.vipInput.value = estado.frota.vip_seats || 0;
      el.vipSalvar.disabled = true;
      el.vipSalvar.textContent = 'Salvar';
    }

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

      var numPagantes = Number(item.pagantes || item.total || 1);
      var numCriancas = Number(item.criancas || 0);
      var textoPessoas = numPagantes === 1 ? '1 pessoa' : numPagantes + ' pessoas';
      if (numCriancas > 0) {
        textoPessoas += ' + ' + (numCriancas === 1 ? '1 criança de colo' : numCriancas + ' crianças de colo');
      }

      infoLeft.innerHTML = '<strong class="frota-sem-onibus__nome-grupo">' + escapeHtml(nomeGrupo) + '</strong>'
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
        option.textContent = 'Ônibus ' + onibus.numero + ' (' + Math.max(0, capacidade - Number(onibus.ocupados || 0)) + ' vagas)';
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        if (!this.value) return;
        var destino = Number(this.value);
        this.disabled = true;
        moverParaOnibus(item.id, destino);
      });
      rightSide.appendChild(select);

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

  function salvarVips() {
    if (!estado.token) return;
    el.vipSalvar.disabled = true;
    el.vipSalvar.textContent = '...';
    fetch('api/bus-settings-update?token=' + encodeURIComponent(estado.token), {
      method: 'POST',
      headers: {
        'X-Admin-Token': estado.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vip_seats: el.vipInput.value
      })
    }).then(function (resp) {
      return resp.json().then(function (data) {
        if (!resp.ok) throw new Error(data.error || 'Erro ao salvar vagas VIP');
        return data;
      });
    }).then(function () {
      carregar(); // refresh
    }).catch(function (err) {
      mostrarAlertaModal('Não foi possível atualizar VIPs', err.message, 'erro');
      el.vipSalvar.disabled = false;
    }).finally(function () {
      el.vipSalvar.textContent = 'Salvar';
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
    if (estado.busca.trim()) {
      url += '&busca=' + encodeURIComponent(estado.busca.trim());
    }
    window.location.href = url;
  }

  // ---- carregamento ------------------------------------------------------

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
        renderizarResumo(dados.resumo);

        if (!estado.reservas.length) {
          mostrar(el.vazio);
          return;
        }

        el.baixarLista.href = API_LISTA + '?token=' + encodeURIComponent(estado.token);
        el.atualizadoEm.textContent = new Date().toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        renderizar();
        renderizarFrota();
        mostrar(el.dados);
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

  if (el.vipInput) {
    el.vipInput.addEventListener('input', function () {
      if (estado.frota && el.vipInput.value !== String(estado.frota.vip_seats)) {
        el.vipSalvar.disabled = false;
      } else {
        el.vipSalvar.disabled = true;
      }
    });
    el.vipInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        salvarVips();
      }
    });
  }

  if (el.vipSalvar) {
    el.vipSalvar.addEventListener('click', salvarVips);
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
