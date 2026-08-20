/* Painel de gestão de reservas — transporte fretado.
 *
 * Somente leitura. Nenhuma ação aqui altera reserva: mudar status de pagamento
 * pela interface abriria caminho para confirmar vaga sem lastro no Mercado Pago.
 *
 * Sem dependências externas — o site é estático e publicado por FTP, então
 * adicionar bundler ou biblioteca de planilha só para exportar não se paga.
 */
(function () {
  'use strict';

  var API = 'api/bus-admin-data';
  var API_LISTA = 'api/bus-manifest';

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
    frota: null
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
    el.rReceita.textContent = 'R$ ' + resumo.receita;
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
      
      // Esquerda: Título e Badge de Status
      var headerLeft = document.createElement('div');
      headerLeft.className = 'onibus-card__header-left';
      
      var titulo = document.createElement('h3');
      titulo.className = 'onibus-card__titulo';
      titulo.innerHTML = '🚍 Ônibus ' + busNum;

      var badge = document.createElement('span');
      badge.className = 'onibus-card__badge';
      if (info.fechado || ocupados >= minL) {
        badge.classList.add('onibus-card__badge--contratado');
        badge.textContent = ocupados >= maxL ? 'Lotado (' + ocupados + '/' + maxL + ')' : 'Contratado (' + ocupados + '/' + maxL + ')';
      } else {
        badge.classList.add('onibus-card__badge--provisorio');
        badge.textContent = 'Em aberto (' + ocupados + '/' + minL + ')';
      }
      headerLeft.append(titulo, badge);

      // Centro: Barra de Progresso com Marcador de 40
      var headerCenter = document.createElement('div');
      headerCenter.className = 'onibus-card__header-center';

      var barWrap = document.createElement('div');
      barWrap.className = 'progresso-bar';
      var barFill = document.createElement('div');
      barFill.className = 'progresso-bar__fill';
      if (ocupados >= maxL) {
        barFill.classList.add('progresso-bar__fill--cheio');
      } else if (ocupados >= minL) {
        barFill.classList.add('progresso-bar__fill--ok');
      }
      var perc = Math.min(100, Math.round((ocupados / maxL) * 100));
      barFill.style.transform = 'scaleX(' + (perc / 100) + ')';
      
      var mark = document.createElement('div');
      mark.className = 'progresso-bar__marker';
      mark.title = 'Meta de viabilidade: 40 assentos';
      barWrap.append(barFill, mark);

      var tx = document.createElement('div');
      tx.className = 'progresso-texto';
      var txLeft = document.createElement('span');
      var txtOcupados = ocupados + ' de ' + maxL + ' ocupados';
      if (info.vip_inclusos > 0) {
        txtOcupados += ' (' + info.vip_inclusos + ' VIP)';
      }
      txLeft.textContent = txtOcupados;

      var txRight = document.createElement('span');
      var faltaFechamento = Math.max(0, minL - ocupados);
      if (info.fechado || ocupados >= minL) {
        txRight.textContent = 'Meta atingida';
        txRight.style.color = 'var(--p-ok)';
        txRight.style.fontWeight = '600';
      } else {
        txRight.textContent = 'Faltam ' + faltaFechamento + ' p/ meta';
      }
      tx.append(txLeft, txRight);
      headerCenter.append(barWrap, tx);

      // Direita: Badge com vagas livres
      var headerRight = document.createElement('div');
      headerRight.className = 'onibus-card__header-right';
      
      var vagasBadge = document.createElement('span');
      vagasBadge.className = 'onibus-card__vagas-badge';
      if (vagasRestantes === 0) {
        vagasBadge.textContent = '0 vagas livres';
        vagasBadge.style.color = 'var(--p-falha)';
      } else {
        vagasBadge.textContent = vagasRestantes === 1 ? '1 vaga livre' : vagasRestantes + ' vagas livres';
      }
      headerRight.appendChild(vagasBadge);

      header.append(headerLeft, headerCenter, headerRight);

      // --- PLANTA BAIXA HORIZONTAL DO ÔNIBUS ---
      var plantaHorizontal = document.createElement('div');
      plantaHorizontal.className = 'onibus-planta-horizontal';

      // 1. Cockpit / Frente do Ônibus
      var cockpit = document.createElement('div');
      cockpit.className = 'onibus-planta__cockpit';
      cockpit.title = 'Frente do Ônibus · Cabine do Motorista';
      cockpit.innerHTML = `
        <div class="onibus-planta__parabrisa"></div>
        <div class="onibus-planta__volante">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="2" x2="12" y2="9"></line>
            <line x1="2" y1="12" x2="9" y2="12"></line>
            <line x1="15" y1="12" x2="22" y2="12"></line>
          </svg>
          <span>FRENTE</span>
        </div>
        <div class="onibus-planta__porta">
          <span>🚪 Entrada</span>
        </div>
      `;

      // 2. Salão / Cabine de Passageiros
      var cabine = document.createElement('div');
      cabine.className = 'onibus-planta__cabine';

      var cabineHeader = document.createElement('div');
      cabineHeader.className = 'onibus-planta__cabine-header';

      var janelaSuperior = document.createElement('div');
      janelaSuperior.className = 'onibus-planta__faixa-janelas';
      janelaSuperior.innerHTML = '<span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span>';

      var statusCabine = document.createElement('div');
      statusCabine.className = 'onibus-planta__status-cabine';
      var numGrupos = (info.reservas && info.reservas.length) ? info.reservas.length : 0;
      statusCabine.innerHTML = '<span><strong>Planta Baixa Horizontal</strong> &middot; ' + maxL + ' assentos totais</span><span>' + plural(numGrupos, 'reserva alocada', 'reservas alocadas') + ' &middot; ' + plural(ocupados, 'pessoa a bordo', 'pessoas a bordo') + '</span>';

      cabineHeader.append(janelaSuperior, statusCabine);
      cabine.appendChild(cabineHeader);

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
            document.querySelectorAll('.onibus-card').forEach(function(c) {
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

          // Rodapé do card: Badge de Pessoas e Seletor Mover
          var itemBottom = document.createElement('div');
          itemBottom.className = 'grupo-item__bottom';

          var tamTag = null;
          if (!r.is_vip) {
            tamTag = document.createElement('span');
            tamTag.className = 'grupo-item__tag-tamanho';
            var numPagantes = Number(r.pagantes || r.total || 1);
            var numColo = Number(r.criancas || 0);
            if (numColo > 0) {
              tamTag.textContent = numPagantes + ' + ' + numColo + ' colo';
            } else {
              tamTag.textContent = numPagantes === 1 ? '1 pessoa' : numPagantes + ' pessoas';
            }
          } else {
            itemBottom.style.justifyContent = 'flex-end';
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

          if (tamTag) itemBottom.appendChild(tamTag);
          itemBottom.appendChild(selectMover);
          item.appendChild(itemBottom);

          // Tooltip com Informações Extras no Hover
          var tooltip = document.createElement('div');
          tooltip.className = 'grupo-item__tooltip';
          if (r.is_vip) {
            tooltip.innerHTML = '<span class="grupo-item__tooltip-resp">★ Lugar VIP da Organização</span><span class="grupo-item__tooltip-pax">1 vaga reservada para a equipe</span>';
          } else {
            var tooltipResp = '<span class="grupo-item__tooltip-resp">👤 Resp: ' + escHtml(r.responsavel || r.grupo || 'Participante') + '</span>';
            var nomesPassageiros = Array.isArray(r.passageiros) && r.passageiros.length > 0
              ? r.passageiros.join(', ')
              : (r.responsavel || 'Não informado');
            var tooltipPax = '<span class="grupo-item__tooltip-pax">Passageiros: ' + escHtml(nomesPassageiros) + '</span>';
            tooltip.innerHTML = tooltipResp + tooltipPax;
          }
          item.appendChild(tooltip);

          assentosGrid.appendChild(item);
        });

        // Bloco de Vagas Livres se ainda houver vagas disponíveis no ônibus
        if (vagasRestantes > 0) {
          var slotLivres = document.createElement('div');
          slotLivres.className = 'onibus-vagas-livres-slot';
          slotLivres.innerHTML = `
            <div class="onibus-vagas-livres-icone">💺</div>
            <div class="onibus-vagas-livres-info">
              <strong>` + (vagasRestantes === 1 ? '1 Assento Livre' : vagasRestantes + ' Assentos Livres') + `</strong>
              <span>Espaço disponível neste ônibus. Arraste grupos ou use a opção "Mover…" para alocar pessoas aqui.</span>
            </div>
          `;
          assentosGrid.appendChild(slotLivres);
        }
      } else {
        var vazioHint = document.createElement('div');
        vazioHint.style.font = '400 13px/1.5 system-ui, -apple-system, sans-serif';
        vazioHint.style.color = 'var(--p-tinta-fraca)';
        vazioHint.style.padding = '36px 16px';
        vazioHint.style.textAlign = 'center';
        vazioHint.style.border = '2px dashed #cbd5e1';
        vazioHint.style.borderRadius = '12px';
        vazioHint.style.background = '#f8fafc';
        vazioHint.style.gridColumn = '1 / -1';
        vazioHint.textContent = '🚍 Cabine vazia (46 vagas livres). Arraste grupos para cá ou use a opção "Mover…" em qualquer reserva para alocar pessoas neste ônibus.';
        assentosGrid.appendChild(vazioHint);
      }

      cabine.appendChild(assentosGrid);

      var janelaInferior = document.createElement('div');
      janelaInferior.className = 'onibus-planta__faixa-janelas';
      janelaInferior.innerHTML = '<span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span><span class="onibus-janela"></span>';
      cabine.appendChild(janelaInferior);

      // 3. Traseira do Ônibus (WC / Motor)
      var traseira = document.createElement('div');
      traseira.className = 'onibus-planta__traseira';
      traseira.title = 'Traseira do Ônibus · WC a Bordo';
      traseira.innerHTML = `
        <div class="onibus-planta__wc" title="Sanitário a Bordo">
          <span style="font-size: 16px;">🚻</span>
          <span>WC</span>
        </div>
        <div class="onibus-planta__motor">
          <span>MOTOR</span>
        </div>
      `;

      plantaHorizontal.append(cockpit, cabine, traseira);
      card.append(header, plantaHorizontal);

      el.frotaContainer.appendChild(card);
    });

    // Card Horizontal para Adicionar Ônibus Vazio
    var nextBusNum = onibusList.length > 0 ? Math.max.apply(null, onibusList.map(function(o) { return Number(o.numero); })) + 1 : 1;
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
        <h4 class="onibus-card--adicionar-titulo">+ Adicionar Ônibus Vazio à Frota (Ônibus ` + nextBusNum + `)</h4>
        <p class="onibus-card--adicionar-desc">Cria uma nova cabine para balancear grupos e organizar os assentos da viagem.</p>
      </div>
    `;
    btnAdd.onclick = function() {
      var novoBusNum = onibusList.length > 0 ? Math.max.apply(null, onibusList.map(function(o) { return Number(o.numero); })) + 1 : 1;
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
    }).then(function(resp) {
      return resp.json().then(function(data) {
        if (!resp.ok) throw new Error(data.error || 'Erro ao mover passageiros');
        return data;
      });
    }).then(function() {
      // Recarrega tudo para manter as totalizacoes sincronizadas
      carregar();
    }).catch(function(err) {
      mostrarAlertaModal('Não foi possível mover passageiros', err.message, 'erro');
    }).finally(function() {
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
    }).then(function(resp) {
      return resp.json().then(function(data) {
        if (!resp.ok) throw new Error(data.error || 'Erro ao salvar vagas VIP');
        return data;
      });
    }).then(function() {
      carregar(); // refresh
    }).catch(function(err) {
      mostrarAlertaModal('Não foi possível atualizar VIPs', err.message, 'erro');
      el.vipSalvar.disabled = false;
    }).finally(function() {
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
          estado.token = '';
          localStorage.removeItem('kob_admin_token');
          if (el.erroLogin) el.erroLogin.hidden = false;
          mostrar(el.estadoLogin);
          return;
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
      el.abas.forEach(function(b) { b.classList.remove('ativo'); });
      botao.classList.add('ativo');

      el.conteudosAba.forEach(function(c) {
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
    el.vipInput.addEventListener('input', function() {
      if (estado.frota && el.vipInput.value !== String(estado.frota.vip_seats)) {
        el.vipSalvar.disabled = false;
      } else {
        el.vipSalvar.disabled = true;
      }
    });
    el.vipInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        salvarVips();
      }
    });
  }
  
  if (el.vipSalvar) {
    el.vipSalvar.addEventListener('click', salvarVips);
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

  if (!estado.token) {
    mostrar(el.estadoLogin);
  } else {
    carregar();
  }
})();
