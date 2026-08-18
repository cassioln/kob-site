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
    semAcesso: document.getElementById('estado-sem-acesso'),
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
    rSemTelefone: document.getElementById('r-sem-telefone')
  };

  var estado = {
    reservas: [],
    filtro: 'pago',
    busca: '',
    token: ''
  };

  // Número do grupo atualmente realçado. Guardado fora do handler para o
  // mouseover poder sair cedo quando o cursor apenas anda entre linhas da MESMA
  // reserva: sem isso, cada célula percorrida repintaria o grupo inteiro.
  var grupoRealcado = null;

  // ---- utilidades ---------------------------------------------------------

  function mostrar(secao) {
    [el.carregando, el.semAcesso, el.erro, el.vazio, el.dados].forEach(function (s) {
      if (s) s.hidden = s !== secao;
    });
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
        celula('WhatsApp', 'não informado', 'tabela__tel tabela__tel--vazio');
      }

      // O nome do grupo substitui a antiga contagem de pessoas e e exibido apenas na
      // primeira linha da reserva para manter o alinhamento visual do grupo.
      var nomeGrupo = (primeiro && r.grupo) ? r.grupo : '';
      celula('Grupo', nomeGrupo, 'tabela__grupo');

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
      mostrar(el.semAcesso);
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
        mostrar(el.dados);
      })
      .catch(function (erro) {
        if (erro && erro.semAcesso) {
          mostrar(el.semAcesso);
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

  // O token vem na URL. Sai do histórico depois de lido, para o link não vazar
  // em captura de tela da barra de endereço nem no histórico do navegador.
  var params = new URLSearchParams(window.location.search);
  estado.token = params.get('token') || '';
  if (estado.token && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  carregar();
})();
