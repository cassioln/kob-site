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
    vipSalvar: document.getElementById('salvar-vip')
  };

  var estado = {
    reservas: [],
    filtro: 'pago',
    busca: '',
    busca: '',
    token: '',
    frota: null
  };

  // Número do grupo atualmente realçado. Guardado fora do handler para o
  // mouseover poder sair cedo quando o cursor apenas anda entre linhas da MESMA
  // reserva: sem isso, cada célula percorrida repintaria o grupo inteiro.
  var grupoRealcado = null;

  // ---- utilidades ---------------------------------------------------------

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

  // ---- renderização frota ------------------------------------------------
  
  function renderizarFrota() {
    if (!estado.frota || !Array.isArray(estado.frota.onibus)) return;
    var onibusList = estado.frota.onibus;
    el.frotaContainer.replaceChildren();

    var maxL = Number(estado.frota.capacidade || 46);
    var minL = Number(estado.frota.minimo || 40);

    // Renderiza cada onibus
    onibusList.forEach(function (info) {
      var busNum = Number(info.numero || 1);
      var ocupados = Number(info.ocupados || 0);

      var card = document.createElement('div');
      card.className = 'onibus-card';
      card.dataset.bus = busNum;

      // Eventos de drag and drop na dropzone (o card inteiro funciona como dropzone)
      card.addEventListener('dragover', function (ev) {
        ev.preventDefault();
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', function () {
        card.classList.remove('drag-over');
        card.classList.remove('drag-error');
      });
      card.addEventListener('drop', function (ev) {
        ev.preventDefault();
        card.classList.remove('drag-over');
        var rId = ev.dataTransfer.getData('text/plain');
        if (!rId) return;
        moverParaOnibus(rId, busNum);
      });

      // Cabecalho
      var header = document.createElement('div');
      header.className = 'onibus-card__header';
      var titulo = document.createElement('h3');
      titulo.className = 'onibus-card__titulo';
      titulo.textContent = 'Ônibus ' + busNum;
      
      var badge = document.createElement('span');
      badge.className = 'onibus-card__badge';
      if (info.fechado || ocupados >= minL) {
        badge.classList.add('onibus-card__badge--contratado');
        badge.textContent = 'Contratado';
      } else {
        badge.classList.add('onibus-card__badge--provisorio');
        badge.textContent = 'Em aberto';
      }
      header.append(titulo, badge);

      // Corpo (planta + lista de grupos)
      var corpo = document.createElement('div');
      corpo.className = 'onibus-card__corpo';
      
      var planta = document.createElement('div');
      planta.className = 'onibus-planta';
      
      var qtdDesenhada = 0;
      var fileiras = Math.ceil(maxL / 4);
      for (var f = 0; f < fileiras; f++) {
        var linhaAssentos = document.createElement('div');
        linhaAssentos.className = 'planta-fileira';
        for (var c = 0; c < 4; c++) {
          if (qtdDesenhada >= maxL) break;
          var assento = document.createElement('div');
          assento.className = 'planta-assento';
          if (qtdDesenhada < ocupados) {
            assento.classList.add('ocupado');
            if (info.vip_inclusos && qtdDesenhada < info.vip_inclusos) {
              assento.title = 'Lugar VIP / Organização';
              assento.style.filter = 'hue-rotate(90deg)';
            }
          }
          linhaAssentos.appendChild(assento);
          // Adiciona corredor central
          if (c === 1) {
            var corredor = document.createElement('div');
            corredor.style.width = '10px';
            linhaAssentos.appendChild(corredor);
          }
          qtdDesenhada++;
        }
        planta.appendChild(linhaAssentos);
      }

      var listaGrupos = document.createElement('div');
      listaGrupos.className = 'onibus-grupos';
      
      if (info.reservas && info.reservas.length) {
        info.reservas.forEach(function (r) {
          var item = document.createElement('div');
          item.className = 'grupo-item';
          item.draggable = true;
          item.dataset.reserva = r.id;
          
          item.addEventListener('dragstart', function (ev) {
            ev.dataTransfer.setData('text/plain', r.id);
            item.classList.add('dragging');
          });
          item.addEventListener('dragend', function () {
            item.classList.remove('dragging');
          });

          var infoGrupo = document.createElement('div');
          var nomeSpan = document.createElement('span');
          nomeSpan.className = 'grupo-item__nome';
          nomeSpan.textContent = r.grupo || r.responsavel;
          var descSpan = document.createElement('span');
          descSpan.className = 'grupo-item__responsavel';
          if (r.grupo) {
             descSpan.textContent = 'Resp: ' + r.responsavel;
          }
          
          if (r.is_vip) {
            item.style.backgroundColor = '#fefce8';
            item.style.borderColor = '#fef08a';
            nomeSpan.style.color = '#a16207';
            nomeSpan.style.display = 'flex';
            nomeSpan.style.alignItems = 'center';
            nomeSpan.style.gap = '4px';
            var estrela = document.createElement('span');
            estrela.textContent = '★';
            estrela.style.color = '#eab308';
            nomeSpan.prepend(estrela);
          }

          infoGrupo.append(nomeSpan, descSpan);

          var tamSpan = document.createElement('span');
          tamSpan.className = 'grupo-item__tamanho';
          tamSpan.textContent = r.total + ' pax';
          
          item.append(infoGrupo, tamSpan);
          listaGrupos.appendChild(item);
        });
      } else {
        var vazioHint = document.createElement('div');
        vazioHint.style.font = '400 12px/1.4 Arial,Helvetica,sans-serif';
        vazioHint.style.color = 'var(--text-dim, #71717a)';
        vazioHint.style.padding = '12px 8px';
        vazioHint.style.textAlign = 'center';
        vazioHint.style.border = '1px dashed var(--b-med, #3f3f46)';
        vazioHint.style.borderRadius = '8px';
        vazioHint.textContent = 'Arraste grupos de passageiros para cá';
        listaGrupos.appendChild(vazioHint);
      }

      corpo.append(planta, listaGrupos);

      // Rodape / ProgressBar
      var rodape = document.createElement('div');
      rodape.className = 'onibus-progresso';
      
      var barWrap = document.createElement('div');
      barWrap.className = 'progresso-bar';
      var barFill = document.createElement('div');
      barFill.className = 'progresso-bar__fill';
      var perc = Math.min(100, Math.round((ocupados / maxL) * 100));
      barFill.style.transform = 'scaleX(' + (perc / 100) + ')';
      var mark = document.createElement('div');
      mark.className = 'progresso-bar__marker';
      barWrap.append(barFill, mark);

      var tx = document.createElement('div');
      tx.className = 'progresso-texto';
      var txLeft = document.createElement('span');
      var txtOcupados = ocupados + ' de ' + maxL + ' ocupados';
      if (info.vip_inclusos > 0) {
        txtOcupados += ' (' + info.vip_inclusos + ' VIPs)';
      }
      txLeft.textContent = txtOcupados;

      var txRight = document.createElement('span');
      var faltaFechamento = Math.max(0, minL - ocupados);
      if (info.fechado || ocupados >= minL) {
        txRight.textContent = 'Mínimo atingido';
        txRight.style.color = 'var(--p-ok)';
      } else {
        txRight.textContent = 'Faltam ' + faltaFechamento + ' p/ fechar';
      }
      tx.append(txLeft, txRight);
      rodape.append(barWrap, tx);

      card.append(header, corpo, rodape);
      el.frotaContainer.appendChild(card);
    });
    
    var btnAdd = document.createElement('button');
    btnAdd.type = 'button';
    btnAdd.innerHTML = '+ Adicionar Ônibus Vazio';
    btnAdd.style.border = '2px dashed var(--b-med, #3f3f46)';
    btnAdd.style.background = 'transparent';
    btnAdd.style.borderRadius = '12px';
    btnAdd.style.color = 'var(--text-dim, #71717a)';
    btnAdd.style.cursor = 'pointer';
    btnAdd.style.display = 'flex';
    btnAdd.style.alignItems = 'center';
    btnAdd.style.justifyContent = 'center';
    btnAdd.style.minHeight = '200px';
    btnAdd.style.fontWeight = 'bold';
    btnAdd.style.fontSize = '14px';
    btnAdd.style.transition = 'all 0.2s';
    btnAdd.onmouseover = function() { btnAdd.style.borderColor = 'var(--text-dim, #71717a)'; btnAdd.style.color = 'var(--text-main, #fff)'; };
    btnAdd.onmouseout = function() { btnAdd.style.borderColor = 'var(--b-med, #3f3f46)'; btnAdd.style.color = 'var(--text-dim, #71717a)'; };
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
      alert('Falha ao mover passageiros: ' + err.message);
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
      alert('Falha ao atualizar lugares VIP: ' + err.message);
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
