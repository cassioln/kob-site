/* Painel da organização — transporte fretado.
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
    filtro: 'confirmed',
    busca: '',
    token: ''
  };

  // ---- utilidades ---------------------------------------------------------

  function mostrar(secao) {
    [el.carregando, el.semAcesso, el.erro, el.vazio, el.dados].forEach(function (s) {
      if (s) s.hidden = s !== secao;
    });
  }

  function textoStatus(status) {
    if (status === 'confirmed') return { rotulo: 'Pago', classe: 'etiqueta--ok' };
    if (status === 'payment_pending') return { rotulo: 'Aguardando', classe: 'etiqueta--espera' };
    if (status === 'paid_awaiting_proof') return { rotulo: 'Em análise', classe: 'etiqueta--espera' };
    if (status === 'cancelled' || status === 'failed') return { rotulo: 'Cancelado', classe: 'etiqueta--falha' };
    return { rotulo: status || '—', classe: 'etiqueta--espera' };
  }

  function plural(n, singular, pluralForma) {
    return n + ' ' + (n === 1 ? singular : pluralForma);
  }

  // ---- montagem da tabela ------------------------------------------------

  /**
   * Achata reservas em linhas de passageiro, que é o formato útil na conferência:
   * quem está na porta do ônibus procura UMA pessoa, não um grupo.
   */
  function linhasVisiveis() {
    var termo = estado.busca.trim().toLowerCase();
    var linhas = [];

    estado.reservas.forEach(function (reserva) {
      if (estado.filtro !== 'todas' && reserva.status !== estado.filtro) return;

      var passageiros = reserva.passageiros.length
        ? reserva.passageiros
        // Reserva sem passageiro gravado ainda: mostra o contato, para a linha
        // não desaparecer da conferência.
        : [{ posicao: 1, nome: reserva.contato, whatsapp: null }];

      passageiros.forEach(function (p, i) {
        if (termo) {
          var alvo = [
            reserva.code, reserva.contato, reserva.email,
            reserva.contato_whatsapp, p.nome, p.whatsapp || '', reserva.order_id || ''
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

    linhas.forEach(function (linha) {
      var r = linha.reserva;
      var p = linha.passageiro;
      var tr = document.createElement('tr');
      if (linha.primeiroDoGrupo) tr.dataset.grupoInicio = 'true';

      function celula(rotulo, conteudo, classe) {
        var td = document.createElement('td');
        td.dataset.rotulo = rotulo;
        if (classe) td.className = classe;
        if (typeof conteudo === 'string') {
          td.textContent = conteudo;
        } else {
          td.appendChild(conteudo);
        }
        tr.appendChild(td);
        return td;
      }

      // Reserva: só no primeiro do grupo, para o olho ler por bloco.
      var reservaSpan = document.createElement('span');
      reservaSpan.className = 'tabela__codigo';
      reservaSpan.textContent = linha.primeiroDoGrupo ? r.code : '';
      celula('Reserva', reservaSpan);

      var nomeWrap = document.createDocumentFragment();
      var pos = document.createElement('span');
      pos.className = 'tabela__posicao';
      pos.textContent = p.posicao + '.';
      var nome = document.createElement('span');
      nome.className = 'tabela__nome';
      nome.textContent = ' ' + p.nome;
      nomeWrap.append(pos, nome);
      celula('Passageiro', nomeWrap);

      if (p.whatsapp) {
        celula('WhatsApp', p.whatsapp, 'tabela__tel');
      } else {
        celula('WhatsApp', 'não informado', 'tabela__tel tabela__tel--vazio');
      }

      var contatoWrap = document.createDocumentFragment();
      var contatoNome = document.createElement('span');
      contatoNome.textContent = r.contato;
      var contatoInfo = document.createElement('span');
      contatoInfo.className = 'tabela__secundario';
      contatoInfo.textContent = r.contato_whatsapp + ' · ' + r.email;
      contatoWrap.append(contatoNome, contatoInfo);
      celula('Contato principal', contatoWrap);

      var grupo = r.pagantes + (r.criancas > 0 ? ' + ' + r.criancas + ' colo' : '');
      celula('Grupo', grupo, 'tabela__num');

      var st = textoStatus(r.status);
      var etiqueta = document.createElement('span');
      etiqueta.className = 'etiqueta ' + st.classe;
      etiqueta.textContent = st.rotulo;
      celula('Situação', etiqueta);

      celula('Pago em', r.pago_em || '—', 'tabela__num');

      el.corpo.appendChild(tr);
    });

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
    el.rReservas.textContent = resumo.reservas_confirmadas;
    el.rPendentes.textContent = resumo.reservas_pendentes > 0
      ? plural(resumo.reservas_pendentes, 'pendente', 'pendentes')
      : 'nenhuma pendente';
    el.rReceita.textContent = 'R$ ' + resumo.receita;
    el.rSemTelefone.textContent = resumo.sem_telefone;
  }

  // ---- exportação --------------------------------------------------------

  /**
   * Exporta em SpreadsheetML 2003 (.xls), que o Excel abre nativamente.
   *
   * Por que não CSV aqui: CSV perde tipo de dado — o Excel transforma o código
   * da reserva em número quando parece número, e telefone com zero à esquerda
   * perde o zero. SpreadsheetML declara cada célula como texto, então o dado
   * chega intacto. Por que não .xlsx de verdade: exigiria montar um ZIP no
   * navegador, o que não se paga para uma planilha simples.
   *
   * O CSV continua disponível no botão "Baixar lista de embarque", que é o
   * formato pedido por quem só quer imprimir.
   */
  function exportarExcel() {
    var linhas = linhasVisiveis();
    if (!linhas.length) return;

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var colunas = [
      'Reserva', 'Nº', 'Passageiro', 'WhatsApp do passageiro',
      'Contato principal', 'WhatsApp do contato', 'E-mail',
      'Pagantes', 'Crianças (colo)', 'Valor pago', 'Situação', 'Pago em', 'Transação'
    ];

    var xml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<?mso-application progid="Excel.Sheet"?>'
      + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
      + ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
      + '<Styles>'
      + '<Style ss:ID="cab"><Font ss:Bold="1"/>'
      + '<Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>'
      + '</Styles>'
      + '<Worksheet ss:Name="Passageiros"><Table>';

    xml += '<Row>' + colunas.map(function (c) {
      return '<Cell ss:StyleID="cab"><Data ss:Type="String">' + esc(c) + '</Data></Cell>';
    }).join('') + '</Row>';

    linhas.forEach(function (l) {
      var r = l.reserva;
      var p = l.passageiro;
      var valores = [
        r.code, p.posicao, p.nome, p.whatsapp || '',
        r.contato, r.contato_whatsapp, r.email,
        r.pagantes, r.criancas, 'R$ ' + r.valor,
        textoStatus(r.status).rotulo, r.pago_em || '', r.order_id || ''
      ];
      xml += '<Row>' + valores.map(function (v) {
        return '<Cell><Data ss:Type="String">' + esc(v) + '</Data></Cell>';
      }).join('') + '</Row>';
    });

    xml += '</Table></Worksheet></Workbook>';

    var hoje = new Date().toISOString().slice(0, 10);
    baixar(xml, 'passageiros-kob2026-' + hoje + '.xls',
      'application/vnd.ms-excel;charset=utf-8');
  }

  function baixar(conteudo, nome, tipo) {
    // BOM: sem ele o Excel no Windows exibe acentuação quebrada.
    var blob = new Blob(['\ufeff' + conteudo], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoga depois: revogar imediatamente cancela o download em alguns navegadores.
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
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

        el.baixarLista.href = API_LISTA + '?token=' + encodeURIComponent(estado.token) + '&format=csv';
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

  // O token vem na URL. Fica fora do histórico depois de lido, para o link não
  // vazar em captura de tela da barra de endereço nem no histórico do navegador.
  var params = new URLSearchParams(window.location.search);
  estado.token = params.get('token') || '';
  if (estado.token && window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  carregar();
})();
