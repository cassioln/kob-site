/* Modal "Editar reserva" do painel de transporte (só PT-BR).
 *
 * Lista cada pessoa da reserva recolhida; um item aberto por vez mostra os
 * campos. O switch "Desistiu" marca a desistência sem apagar ninguém. Quando o
 * responsável desiste e ainda há quem viaje, o modal pede um novo responsável
 * adulto. A validação aqui repete as regras e as mensagens do servidor
 * (php/lib/registration-edit.php) só para dar o retorno antes do POST; quem
 * decide é o servidor, e a mensagem dele aparece como veio.
 *
 * Os normalizadores (CPF, WhatsApp, e-mail, nome) chegam de painel-onibus.js em
 * `options.formatos`, para não haver duas versões das mesmas regras.
 *
 * Dados do usuário entram só por textContent/value: nada de innerHTML com dado.
 */
(function () {
  'use strict';

  var API_SALVAR = 'api/bus-registration-update';
  var API_GRUPOS = 'api/bus-group-names';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var FAIXAS = [
    { valor: 'adult', rotulo: '18 anos ou mais' },
    { valor: 'minor', rotulo: '6 a 17 anos' },
    { valor: 'lap', rotulo: '0 a 5 anos (colo)' }
  ];

  // Iguais às do servidor, palavra por palavra.
  var MSG = {
    escolherResponsavel: 'Escolha o novo responsável da reserva.',
    contatoResponsavel: 'Informe WhatsApp e e-mail do responsável.',
    responsavelAdulto: 'O responsável precisa ser um adulto (18+) que continua na viagem.',
    coloSemAdulto: 'Há mais crianças de colo do que adultos pagantes na viagem. '
      + 'Marque também a desistência da criança ou mantenha um adulto.',
    cpfRepetido: 'Não repita o CPF de um passageiro.',
    semPassageiros: 'Esta reserva não tem passageiros cadastrados e não pode ser editada aqui.',
    falhaSalvar: 'Não foi possível salvar a reserva.',
    falhaRede: 'Não foi possível salvar a reserva. Verifique a conexão e tente de novo.'
  };

  var CHEVRON_PONTOS = '6 9 12 15 18 9';

  function rotuloFaixa(valor) {
    for (var i = 0; i < FAIXAS.length; i++) {
      if (FAIXAS[i].valor === valor) return FAIXAS[i].rotulo;
    }
    return '';
  }

  function faixaDe(passageiro) {
    if (passageiro.crianca_colo) return 'lap';
    return passageiro.menor ? 'minor' : 'adult';
  }

  function digitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  // Mesmo algoritmo de is_valid_cpf (php/lib/validation.php).
  function cpfValido(valor) {
    var cpf = digitos(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (var tamanho = 9; tamanho < 11; tamanho++) {
      var soma = 0;
      for (var i = 0; i < tamanho; i++) soma += Number(cpf.charAt(i)) * (tamanho + 1 - i);
      var resto = (soma * 10) % 11;
      if (resto === 10) resto = 0;
      if (resto !== Number(cpf.charAt(tamanho))) return false;
    }
    return true;
  }

  function criar(tag, classe, texto) {
    var no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto !== undefined && texto !== null) no.textContent = texto;
    return no;
  }

  function svgChevron() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'editar-passageiro__seta');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    var linha = document.createElementNS(SVG_NS, 'polyline');
    linha.setAttribute('points', CHEVRON_PONTOS);
    svg.appendChild(linha);
    return svg;
  }

  function svgMeeple(caminho) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 512 512');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', caminho);
    svg.appendChild(path);
    return svg;
  }

  function mostrarModal(dialog) {
    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
        return;
      } catch (err) {
        // cai no atributo abaixo
      }
    }
    dialog.setAttribute('open', '');
  }

  window.KobEditarReserva = function (dialog, options) {
    options = options || {};
    var formatos = options.formatos || {};
    function formato(nome, reserva) {
      return typeof formatos[nome] === 'function' ? formatos[nome] : reserva;
    }
    var formatarCpf = formato('formatarCpf', function (v) { return digitos(v).slice(0, 11); });
    var formatarWhatsapp = formato('formatarWhatsapp', function (v) { return String(v || ''); });
    var normalizarWhatsapp = formato('normalizarWhatsapp', function (v) { return digitos(v); });
    var normalizarEmail = formato('normalizarEmail', function (v) { return String(v || '').trim().toLowerCase(); });
    var emailValido = formato('emailValido', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')); });
    var normalizarNomeCompleto = formato('normalizarNomeCompleto', function (v) { return String(v || '').trim().replace(/\s+/g, ' '); });

    var el = {
      form: dialog.querySelector('#form-editar'),
      titulo: dialog.querySelector('#painel-editar-titulo'),
      subtitulo: dialog.querySelector('#painel-editar-subtitulo'),
      grupoCampo: dialog.querySelector('#editar-grupo-campo'),
      lista: dialog.querySelector('#editar-passageiros'),
      responsavel: dialog.querySelector('#editar-responsavel'),
      aviso: dialog.querySelector('#editar-aviso'),
      erro: dialog.querySelector('#editar-erro'),
      cancelar: dialog.querySelector('#editar-cancelar'),
      salvar: dialog.querySelector('#editar-salvar')
    };

    var estado = null;      // uma abertura do modal; null quando fechado
    var aberturas = 0;      // descarta respostas de uma abertura anterior
    var pressionouFora = false;

    // ---- estado da abertura --------------------------------------------

    function novoEstado(reserva) {
      var lista = Array.isArray(reserva.passageiros) ? reserva.passageiros.slice() : [];
      lista.sort(function (a, b) { return Number(a.posicao || 0) - Number(b.posicao || 0); });

      var responsavelId = null;
      lista.forEach(function (p) {
        if (p.responsavel && responsavelId === null) responsavelId = String(p.id);
      });

      var passageiros = lista.map(function (p, indice) {
        var faixa = faixaDe(p);
        var whatsapp = p.whatsapp_digitos || digitos(p.whatsapp);
        var email = p.email || '';
        // O contato do responsável também mora na reserva. Se a linha do
        // passageiro veio sem ele, usa o da reserva para não travar o salvamento.
        if (String(p.id) === responsavelId) {
          if (!whatsapp && reserva.contato_whatsapp) whatsapp = digitos(reserva.contato_whatsapp);
          if (!email && reserva.email) email = String(reserva.email);
        }
        return {
          id: String(p.id),
          posicao: Number(p.posicao) || indice + 1,
          original: { faixa: faixa, desistiu: Boolean(p.desistiu) },
          nome: String(p.nome || ''),
          cpf: formatarCpf(p.cpf_digitos || p.cpf || ''),
          whatsapp: whatsapp ? formatarWhatsapp(whatsapp) : '',
          email: email,
          faixa: faixa,
          desistiu: Boolean(p.desistiu),
          motivo: String(p.motivo_desistencia || ''),
          el: {}
        };
      });

      var grupo = reserva.grupo ? String(reserva.grupo) : null;
      return {
        reserva: reserva,
        codigo: String(reserva.code || String(reserva.id).slice(0, 8).toUpperCase()),
        podeDesistir: reserva.status === 'confirmed',
        passageiros: passageiros,
        responsavelId: responsavelId,
        novoResponsavelId: null,
        grupoAtual: grupo,
        grupoSelecionado: grupo,
        abertoId: null,
        salvando: false,
        inicial: '',
        opener: null
      };
    }

    function porId(id) {
      if (!estado || id === null) return null;
      for (var i = 0; i < estado.passageiros.length; i++) {
        if (estado.passageiros[i].id === id) return estado.passageiros[i];
      }
      return null;
    }

    function ativos() {
      return estado.passageiros.filter(function (p) { return !p.desistiu; });
    }

    // O responsável atual desistiu, deixou de ser adulto ou não existe, e ainda
    // há quem viaje.
    function precisaNovoResponsavel() {
      var original = porId(estado.responsavelId);
      return ativos().length > 0 && (!original || original.desistiu || original.faixa !== 'adult');
    }

    function responsavelEfetivoId() {
      return precisaNovoResponsavel() ? estado.novoResponsavelId : estado.responsavelId;
    }

    function nomeExibicao(p) {
      return normalizarNomeCompleto(p.nome) || ('Passageiro ' + p.posicao);
    }

    function contatoCompleto(p) {
      return Boolean(normalizarWhatsapp(p.whatsapp)) && emailValido(p.email);
    }

    // Retrato do que mudaria no banco, com o texto cru dos campos: digitar algo
    // inválido e fechar também pede confirmação.
    function assinatura() {
      return JSON.stringify({
        grupo: estado.grupoSelecionado,
        responsavel: estado.novoResponsavelId,
        passageiros: estado.passageiros.map(function (p) {
          return [
            normalizarNomeCompleto(p.nome), digitos(p.cpf), digitos(p.whatsapp),
            normalizarEmail(p.email), p.faixa, p.desistiu, p.desistiu ? p.motivo.trim() : ''
          ];
        })
      });
    }

    function temAlteracoes() {
      return Boolean(estado) && assinatura() !== estado.inicial;
    }

    // ---- mensagens -----------------------------------------------------

    function mostrarErro(mensagem) {
      el.erro.textContent = mensagem || '';
      el.erro.hidden = !mensagem;
    }

    function aoMudar() {
      if (!el.erro.hidden) mostrarErro('');
    }

    function atualizarAviso() {
      var frases = estado.passageiros.filter(function (p) {
        return p.original.faixa === 'lap' && p.faixa !== 'lap' && !p.desistiu;
      }).map(function (p) {
        return nomeExibicao(p) + ' passa a ocupar um assento sem pagamento correspondente.';
      });
      el.aviso.textContent = frases.join(' ');
      el.aviso.hidden = frases.length === 0;
    }

    // ---- grupo -----------------------------------------------------------

    function renderizarGrupo() {
      el.grupoCampo.replaceChildren();
      // Nome de grupo só faz sentido para reserva com mais de uma pessoa ou que
      // já tem um nome.
      var aplicavel = Boolean(estado.grupoAtual) || estado.passageiros.length > 1;
      el.grupoCampo.hidden = !aplicavel;
      if (!aplicavel) return;

      var campo = criar('div', 'vip-formulario__campo editar-grupo');
      var rotulo = criar('label', null, 'Nome do grupo');
      rotulo.setAttribute('for', 'editar-grupo');
      var select = criar('select');
      select.id = 'editar-grupo';
      var nenhum = criar('option', null, 'Sem nome de grupo');
      nenhum.value = '';
      select.appendChild(nenhum);
      if (estado.grupoAtual) {
        var atual = criar('option', null, estado.grupoAtual + ' (atual)');
        atual.value = estado.grupoAtual;
        select.appendChild(atual);
      }
      select.value = estado.grupoAtual || '';
      select.addEventListener('change', function () {
        estado.grupoSelecionado = select.value === '' ? null : select.value;
        aoMudar();
      });
      var aviso = criar('p', 'editar-grupo__aviso');
      aviso.id = 'editar-grupo-aviso';
      aviso.hidden = true;
      campo.append(rotulo, select, aviso);
      el.grupoCampo.appendChild(campo);
      el.grupoSelect = select;
      el.grupoAviso = aviso;
    }

    function carregarGrupos(abertura) {
      if (!el.grupoSelect || el.grupoCampo.hidden) return;
      var select = el.grupoSelect;
      var falhou = function () {
        if (abertura !== aberturas || !estado) return;
        el.grupoAviso.textContent = 'Não foi possível carregar os nomes livres. '
          + 'Dá para manter o nome atual ou deixar sem nome.';
        el.grupoAviso.hidden = false;
        select.setAttribute('aria-describedby', 'editar-grupo-aviso');
      };
      var token = typeof options.token === 'function' ? options.token() : '';
      fetch(API_GRUPOS, { headers: { 'X-Admin-Token': token }, cache: 'no-store' })
        .then(function (resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.json();
        })
        .then(function (dados) {
          if (abertura !== aberturas || !estado) return;
          var livres = dados && Array.isArray(dados.livres) ? dados.livres : [];
          livres.forEach(function (nome) {
            nome = String(nome);
            if (nome === estado.grupoAtual) return;
            var opcao = criar('option', null, nome);
            opcao.value = nome;
            select.appendChild(opcao);
          });
        })
        .catch(falhou);
    }

    // ---- passageiros ---------------------------------------------------

    function campoTexto(p, chave, rotulo, tipo, classeExtra) {
      var wrapper = criar('div', 'vip-formulario__campo' + (classeExtra ? ' ' + classeExtra : ''));
      var label = criar('label', null, rotulo);
      var id = 'editar-p-' + p.id + '-' + chave;
      label.setAttribute('for', id);
      var input = criar('input');
      input.id = id;
      input.type = tipo;
      input.value = p[chave];
      wrapper.append(label, input);
      return { wrapper: wrapper, label: label, input: input };
    }

    function marcarValidade(input, invalido) {
      if (invalido) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    function criarPassageiro(p) {
      var li = criar('li', 'editar-passageiro');
      var painelId = 'editar-p-' + p.id;

      var resumo = criar('button', 'editar-passageiro__resumo');
      resumo.type = 'button';
      resumo.setAttribute('aria-expanded', 'false');
      resumo.setAttribute('aria-controls', painelId);
      var icone = criar('span', 'editar-passageiro__icone');
      var texto = criar('span', 'editar-passageiro__texto');
      var nome = criar('span', 'editar-passageiro__nome');
      var papel = criar('span', 'sr-only');
      var meta = criar('span', 'editar-passageiro__meta');
      texto.append(nome, papel, meta);
      var etiqueta = criar('span', 'etiqueta etiqueta--falha editar-passageiro__etiqueta', 'Desistiu');
      resumo.append(icone, texto, etiqueta, svgChevron());
      resumo.addEventListener('click', function () {
        abrirPainel(estado.abertoId === p.id ? null : p.id);
      });

      var painel = criar('div', 'editar-passageiro__painel');
      painel.id = painelId;
      painel.hidden = true;
      var grid = criar('div', 'vip-formulario__grid');

      var cNome = campoTexto(p, 'nome', 'Nome *', 'text', 'vip-formulario__campo--nome');
      cNome.input.autocomplete = 'off';
      cNome.input.maxLength = 255;
      cNome.input.dataset.vipField = 'full_name';
      cNome.input.addEventListener('input', function () {
        p.nome = cNome.input.value;
        cNome.input.removeAttribute('aria-invalid');
        atualizarResumo(p);
        atualizarRotulosResponsavel();
        atualizarAviso();
        aoMudar();
      });

      var cCpf = campoTexto(p, 'cpf', 'CPF *', 'text');
      cCpf.input.autocomplete = 'off';
      cCpf.input.inputMode = 'numeric';
      cCpf.input.maxLength = 14;
      cCpf.input.addEventListener('input', function () {
        cCpf.input.value = formatarCpf(cCpf.input.value);
        p.cpf = cCpf.input.value;
        cCpf.input.removeAttribute('aria-invalid');
        atualizarResumo(p);
        aoMudar();
      });

      var cWhatsapp = campoTexto(p, 'whatsapp', 'WhatsApp', 'tel');
      cWhatsapp.input.autocomplete = 'off';
      cWhatsapp.input.inputMode = 'tel';
      cWhatsapp.input.maxLength = 17;
      cWhatsapp.input.placeholder = '(11) 90000-0000';
      cWhatsapp.input.addEventListener('input', function () {
        cWhatsapp.input.value = formatarWhatsapp(cWhatsapp.input.value);
        p.whatsapp = cWhatsapp.input.value;
        marcarValidade(cWhatsapp.input, p.whatsapp.trim() !== '' && !normalizarWhatsapp(p.whatsapp));
        atualizarRotulosResponsavel();
        aoMudar();
      });

      var cEmail = campoTexto(p, 'email', 'E-mail', 'email');
      cEmail.input.autocomplete = 'off';
      cEmail.input.maxLength = 200;
      cEmail.input.dataset.vipField = 'email';
      cEmail.input.addEventListener('input', function () {
        cEmail.input.value = normalizarEmail(cEmail.input.value);
        p.email = cEmail.input.value;
        marcarValidade(cEmail.input, p.email !== '' && !emailValido(p.email));
        atualizarRotulosResponsavel();
        aoMudar();
      });

      var faixaWrapper = criar('div', 'vip-formulario__campo');
      var faixaLabel = criar('label', null, 'Faixa etária');
      var faixaId = 'editar-p-' + p.id + '-faixa';
      faixaLabel.setAttribute('for', faixaId);
      var faixaSelect = criar('select');
      faixaSelect.id = faixaId;
      FAIXAS.forEach(function (faixa) {
        var opcao = criar('option', null, faixa.rotulo);
        opcao.value = faixa.valor;
        faixaSelect.appendChild(opcao);
      });
      faixaSelect.value = p.faixa;
      faixaSelect.addEventListener('change', function () {
        p.faixa = faixaSelect.value;
        faixaSelect.removeAttribute('aria-invalid');
        atualizarResumo(p);
        atualizarResponsavel();
        atualizarAviso();
        aoMudar();
      });
      faixaWrapper.append(faixaLabel, faixaSelect);

      grid.append(cNome.wrapper, cCpf.wrapper, cWhatsapp.wrapper, cEmail.wrapper, faixaWrapper);
      painel.appendChild(grid);

      var interruptor = null;
      var motivoWrapper = null;
      if (estado.podeDesistir) {
        var bloco = criar('div', 'editar-desistencia');
        interruptor = criar('button', 'editar-switch');
        interruptor.type = 'button';
        interruptor.id = 'editar-p-' + p.id + '-desistiu';
        interruptor.setAttribute('role', 'switch');
        interruptor.setAttribute('aria-checked', String(p.desistiu));
        var trilho = criar('span', 'editar-switch__trilho');
        trilho.setAttribute('aria-hidden', 'true');
        trilho.appendChild(criar('span', 'editar-switch__botao'));
        interruptor.append(trilho, criar('span', 'editar-switch__rotulo', 'Desistiu'));

        motivoWrapper = criar('div', 'vip-formulario__campo editar-motivo');
        var motivoLabel = criar('label', null, 'Motivo (opcional)');
        var motivoId = 'editar-p-' + p.id + '-motivo';
        motivoLabel.setAttribute('for', motivoId);
        var motivo = criar('textarea');
        motivo.id = motivoId;
        motivo.rows = 2;
        motivo.maxLength = 500;
        motivo.value = p.motivo;
        motivo.addEventListener('input', function () {
          p.motivo = motivo.value;
          aoMudar();
        });
        motivoWrapper.append(motivoLabel, motivo);
        motivoWrapper.hidden = !p.desistiu;

        interruptor.addEventListener('click', function () {
          p.desistiu = !p.desistiu;
          interruptor.setAttribute('aria-checked', String(p.desistiu));
          motivoWrapper.hidden = !p.desistiu;
          atualizarResumo(p);
          atualizarResponsavel();
          atualizarAviso();
          aoMudar();
        });
        bloco.append(interruptor, motivoWrapper);
        painel.appendChild(bloco);
      } else if (p.desistiu) {
        painel.appendChild(criar('p', 'editar-nota',
          'Desistência registrada. Só reserva com pagamento aprovado pode mudar a desistência.'));
      }

      li.append(resumo, painel);
      p.el = {
        li: li, resumo: resumo, painel: painel, icone: icone, nome: nome, papel: papel, meta: meta,
        etiqueta: etiqueta, inputNome: cNome.input, inputCpf: cCpf.input,
        inputWhatsapp: cWhatsapp.input, inputEmail: cEmail.input,
        labelWhatsapp: cWhatsapp.label, labelEmail: cEmail.label,
        faixa: faixaSelect, interruptor: interruptor
      };
      atualizarResumo(p);
      return li;
    }

    function atualizarResumo(p) {
      var e = p.el;
      if (!e.li) return;
      e.nome.textContent = nomeExibicao(p);
      var partes = [rotuloFaixa(p.faixa)];
      if (digitos(p.cpf)) partes.push('CPF ' + p.cpf);
      e.meta.textContent = partes.join(' · ');
      e.etiqueta.hidden = !p.desistiu;
      e.li.classList.toggle('editar-passageiro--desistente', p.desistiu);
    }

    // Meeple e "(responsável)" acompanham quem vai ficar como contato.
    function atualizarIconesResponsavel() {
      var alvo = responsavelEfetivoId() || estado.responsavelId;
      estado.passageiros.forEach(function (p) {
        var e = p.el;
        var eh = p.id === alvo;
        e.icone.replaceChildren();
        e.icone.classList.toggle('editar-passageiro__icone--responsavel', eh);
        // O texto para leitor de tela fica em `papel`; o ícone é só visual.
        e.icone.setAttribute('aria-hidden', 'true');
        if (eh && options.meeplePath) {
          e.icone.appendChild(svgMeeple(options.meeplePath));
        } else {
          e.icone.textContent = p.faixa === 'lap' ? '•' : '–';
        }
        e.papel.textContent = eh ? ' (responsável)' : '';
      });
    }

    // Contato obrigatório só para quem fica como responsável.
    function marcarObrigatorios() {
      var alvo = responsavelEfetivoId();
      estado.passageiros.forEach(function (p) {
        var obrigatorio = p.id === alvo;
        [[p.el.inputWhatsapp, p.el.labelWhatsapp, 'WhatsApp'], [p.el.inputEmail, p.el.labelEmail, 'E-mail']]
          .forEach(function (par) {
            par[0].required = obrigatorio;
            if (obrigatorio) par[0].setAttribute('aria-required', 'true');
            else par[0].removeAttribute('aria-required');
            par[1].textContent = par[2] + (obrigatorio ? ' *' : '');
          });
      });
    }

    function abrirPainel(id) {
      estado.abertoId = id;
      estado.passageiros.forEach(function (p) {
        var aberto = p.id === id;
        p.el.resumo.setAttribute('aria-expanded', String(aberto));
        p.el.painel.hidden = !aberto;
        p.el.li.classList.toggle('editar-passageiro--aberto', aberto);
      });
    }

    // ---- novo responsável ------------------------------------------------

    function limparResponsavel() {
      Array.prototype.slice.call(el.responsavel.children).forEach(function (filho) {
        if (filho.tagName !== 'LEGEND') filho.remove();
      });
    }

    function textoOpcaoResponsavel(p) {
      var falta = [];
      if (!normalizarWhatsapp(p.whatsapp)) falta.push('WhatsApp');
      if (!emailValido(p.email)) falta.push('e-mail');
      return falta.length ? 'falta ' + falta.join(' e ') : '';
    }

    function atualizarRotulosResponsavel() {
      if (el.responsavel.hidden) return;
      Array.prototype.slice.call(el.responsavel.querySelectorAll('[data-responsavel-id]')).forEach(function (rotulo) {
        var p = porId(rotulo.getAttribute('data-responsavel-id'));
        if (!p) return;
        rotulo.querySelector('.editar-responsavel__nome').textContent = nomeExibicao(p);
        var falta = textoOpcaoResponsavel(p);
        var detalhe = rotulo.querySelector('.editar-responsavel__falta');
        detalhe.textContent = falta ? ' (' + falta + ')' : '';
      });
    }

    function atualizarResponsavel() {
      limparResponsavel();
      var precisa = precisaNovoResponsavel();
      el.responsavel.hidden = !precisa;
      if (!precisa) {
        estado.novoResponsavelId = null;
      } else {
        var elegiveis = ativos().filter(function (p) { return p.faixa === 'adult'; });
        if (!elegiveis.some(function (p) { return p.id === estado.novoResponsavelId; })) {
          estado.novoResponsavelId = null;
        }
        var original = porId(estado.responsavelId);
        var dica = criar('p', 'editar-responsavel__dica');
        dica.id = 'editar-responsavel-dica';
        if (elegiveis.length === 0) {
          dica.textContent = 'Nenhum adulto (18+) continua na viagem. Mantenha um adulto '
            + 'ou marque a desistência de todos.';
        } else {
          var motivo = '';
          if (original) {
            motivo = nomeExibicao(original) + (original.desistiu ? ' desistiu. ' : ' não é mais adulto (18+). ');
          }
          dica.textContent = motivo
            + 'Escolha quem passa a ser o contato da reserva (adulto que continua na viagem).';
        }
        el.responsavel.setAttribute('aria-describedby', dica.id);
        el.responsavel.appendChild(dica);

        var opcoes = criar('div', 'editar-responsavel__opcoes');
        elegiveis.forEach(function (p) {
          var rotulo = criar('label', 'editar-responsavel__opcao');
          rotulo.setAttribute('data-responsavel-id', p.id);
          var radio = criar('input');
          radio.type = 'radio';
          radio.name = 'editar-novo-responsavel';
          radio.value = p.id;
          radio.checked = p.id === estado.novoResponsavelId;
          radio.addEventListener('change', function () {
            if (!radio.checked) return;
            estado.novoResponsavelId = p.id;
            marcarObrigatorios();
            atualizarIconesResponsavel();
            aoMudar();
            if (!contatoCompleto(p)) abrirPainel(p.id);
          });
          var texto = criar('span');
          texto.append(criar('span', 'editar-responsavel__nome'), criar('span', 'editar-responsavel__falta'));
          rotulo.append(radio, texto);
          opcoes.appendChild(rotulo);
        });
        el.responsavel.appendChild(opcoes);
        atualizarRotulosResponsavel();
      }
      marcarObrigatorios();
      atualizarIconesResponsavel();
    }

    // ---- validação (mesma ordem do servidor) ---------------------------

    function validar() {
      if (estado.passageiros.length === 0) return { mensagem: MSG.semPassageiros };
      var vistos = {};
      for (var i = 0; i < estado.passageiros.length; i++) {
        var p = estado.passageiros[i];
        var nome = normalizarNomeCompleto(p.nome);
        if (nome.length < 3 || nome.length > 255) {
          return { mensagem: 'Nome do passageiro ' + p.posicao + ' inválido.', p: p, campo: p.el.inputNome };
        }
        if (nome.split(' ').filter(Boolean).length < 2) {
          return { mensagem: 'Informe o nome completo do passageiro ' + p.posicao + '.', p: p, campo: p.el.inputNome };
        }
        if (!cpfValido(p.cpf)) {
          return { mensagem: 'CPF inválido para o passageiro ' + p.posicao + '.', p: p, campo: p.el.inputCpf };
        }
        if (p.whatsapp.trim() !== '' && !normalizarWhatsapp(p.whatsapp)) {
          return { mensagem: 'WhatsApp do passageiro ' + p.posicao + ' inválido.', p: p, campo: p.el.inputWhatsapp };
        }
        if (p.email.trim() !== '' && !emailValido(p.email)) {
          return { mensagem: 'E-mail do passageiro ' + p.posicao + ' inválido.', p: p, campo: p.el.inputEmail };
        }
        var cpf = digitos(p.cpf);
        if (vistos[cpf]) return { mensagem: MSG.cpfRepetido, p: p, campo: p.el.inputCpf };
        vistos[cpf] = true;
      }

      var viajam = ativos();
      if (viajam.length === 0) return null; // reserva inteira desistente: sem responsável

      var colo = viajam.filter(function (p) { return p.faixa === 'lap'; });
      if (colo.length > viajam.length - colo.length) {
        return { mensagem: MSG.coloSemAdulto, p: colo[0], campo: colo[0].el.interruptor || colo[0].el.faixa };
      }

      if (precisaNovoResponsavel() && !estado.novoResponsavelId) {
        var primeiro = el.responsavel.querySelector('input[type="radio"]');
        var original = porId(estado.responsavelId);
        // Mesma mensagem que o servidor daria: "escolha" quando o responsável
        // desistiu; "precisa ser adulto" quando ele só mudou de faixa etária.
        var mensagem = !original || original.desistiu ? MSG.escolherResponsavel : MSG.responsavelAdulto;
        return primeiro
          ? { mensagem: mensagem, campo: primeiro }
          : { mensagem: mensagem, p: original, campo: original && (original.el.interruptor || original.el.faixa) };
      }
      var responsavel = porId(responsavelEfetivoId());
      if (!responsavel || responsavel.desistiu || responsavel.faixa !== 'adult') {
        return { mensagem: MSG.responsavelAdulto, p: responsavel, campo: responsavel && responsavel.el.faixa };
      }
      if (!normalizarWhatsapp(responsavel.whatsapp)) {
        return { mensagem: MSG.contatoResponsavel, p: responsavel, campo: responsavel.el.inputWhatsapp };
      }
      if (!emailValido(responsavel.email)) {
        return { mensagem: MSG.contatoResponsavel, p: responsavel, campo: responsavel.el.inputEmail };
      }
      return null;
    }

    function apontarProblema(problema) {
      mostrarErro(problema.mensagem);
      if (problema.p) abrirPainel(problema.p.id);
      var campo = problema.campo;
      if (!campo) return;
      if (campo.tagName === 'INPUT' && campo.type !== 'radio') campo.setAttribute('aria-invalid', 'true');
      if (campo.tagName === 'SELECT') campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }

    // ---- envio -----------------------------------------------------------

    function montarPedido() {
      var responsavelId = responsavelEfetivoId() || estado.responsavelId;
      var pedido = {
        registration_id: String(estado.reserva.id),
        expected_updated_at: estado.reserva.updated_at,
        primary_passenger_id: responsavelId,
        passengers: estado.passageiros.map(function (p) {
          var whatsapp = normalizarWhatsapp(p.whatsapp);
          var email = normalizarEmail(p.email);
          var motivo = p.motivo.trim();
          return {
            id: p.id,
            full_name: normalizarNomeCompleto(p.nome),
            cpf: digitos(p.cpf),
            whatsapp: whatsapp || null,
            email: email || null,
            age_group: p.faixa,
            withdrawn: p.desistiu,
            withdrawal_reason: p.desistiu && motivo !== '' ? motivo : null
          };
        })
      };
      // Sem a chave o servidor mantém o grupo; null remove.
      if (estado.grupoSelecionado !== estado.grupoAtual) pedido.group_name = estado.grupoSelecionado;
      return pedido;
    }

    function botaoSalvando(sim) {
      el.salvar.textContent = sim ? 'Salvando…' : 'Salvar alterações';
      if (sim) {
        el.salvar.setAttribute('aria-busy', 'true');
        el.salvar.setAttribute('aria-disabled', 'true');
      } else {
        el.salvar.removeAttribute('aria-busy');
        el.salvar.removeAttribute('aria-disabled');
      }
    }

    function salvar(evento) {
      evento.preventDefault();
      if (!estado || estado.salvando) return;
      mostrarErro('');
      var problema = validar();
      if (problema) {
        apontarProblema(problema);
        return;
      }

      var abertura = estado;
      abertura.salvando = true;
      // Sem `disabled`: desabilitar o botão em foco joga o foco para o <body>.
      botaoSalvando(true);
      var token = typeof options.token === 'function' ? options.token() : '';

      fetch(API_SALVAR, {
        method: 'POST',
        headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPedido())
      }).then(function (resp) {
        return resp.text().then(function (texto) {
          var dados = null;
          try { dados = JSON.parse(texto); } catch (err) { dados = null; }
          if (!resp.ok || !dados || !dados.success) {
            var falha = new Error((dados && dados.error) || MSG.falhaSalvar);
            falha.doServidor = true;
            throw falha;
          }
          return dados;
        });
      }).then(function () {
        if (estado !== abertura) return;
        abertura.salvando = false;
        fecharAgora(true);
        if (typeof options.aoSalvar === 'function') options.aoSalvar();
      }).catch(function (err) {
        if (estado !== abertura) return;
        abertura.salvando = false;
        botaoSalvando(false);
        mostrarErro(err && err.doServidor ? err.message : MSG.falhaRede);
      });
    }

    // ---- abrir e fechar --------------------------------------------------

    function renderizar() {
      var reserva = estado.reserva;
      el.titulo.textContent = 'Editar reserva #' + estado.codigo;
      var status = String(reserva.status_rotulo || '');
      el.subtitulo.textContent = reserva.grupo ? reserva.grupo + (status ? ' · ' + status : '') : status;
      mostrarErro('');
      botaoSalvando(false);
      renderizarGrupo();
      el.lista.replaceChildren();
      estado.passageiros.forEach(function (p) {
        el.lista.appendChild(criarPassageiro(p));
      });
      atualizarResponsavel();
      atualizarAviso();
      if (estado.passageiros.length === 0) mostrarErro(MSG.semPassageiros);
    }

    function abrir(reservaId) {
      if (dialog.open) return;
      var reserva = typeof options.reserva === 'function' ? options.reserva(reservaId) : null;
      if (!reserva) return;
      aberturas++;
      estado = novoEstado(reserva);
      var ativo = document.activeElement;
      estado.opener = ativo && ativo !== document.body && typeof ativo.focus === 'function' ? ativo : null;
      el.grupoSelect = null;
      el.grupoAviso = null;
      renderizar();
      estado.inicial = assinatura();
      carregarGrupos(aberturas);
      mostrarModal(dialog);
    }

    // Foco volta ao lápis que abriu o modal. Depois de salvar, a lista é
    // redesenhada e aquele lápis some: por alguns instantes, se o foco cair no
    // <body>, procura o lápis novo da mesma reserva.
    function devolverFoco(opener, codigo, vigiar) {
      if (opener && opener.isConnected) opener.focus();
      if (!vigiar) return;
      var seletor = opener && opener.classList && opener.classList.contains('grupo-item__editar')
        ? '.grupo-item__editar'
        : '.tabela__editar, .grupo-item__editar';
      var rotulo = 'Editar reserva #' + codigo;
      var tentativas = 0;
      (function procurar() {
        var atual = document.activeElement;
        var perdido = !atual || atual === document.body || (atual === opener && !opener.isConnected);
        if (!perdido && atual !== opener) return; // o usuário já seguiu adiante
        if (perdido) {
          var candidatos = Array.prototype.slice.call(document.querySelectorAll(seletor));
          for (var i = 0; i < candidatos.length; i++) {
            if (candidatos[i].getAttribute('aria-label') === rotulo && candidatos[i].getClientRects().length) {
              candidatos[i].focus();
              return;
            }
          }
        }
        if (++tentativas < 30) window.setTimeout(procurar, 100);
      })();
    }

    function fecharAgora(salvou) {
      if (!estado) return;
      var opener = estado.opener;
      var codigo = estado.codigo;
      estado = null;
      if (dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
      el.lista.replaceChildren();
      limparResponsavel();
      el.responsavel.hidden = true;
      devolverFoco(opener, codigo, Boolean(salvou));
    }

    function pedirFechar() {
      if (!estado || estado.salvando) return;
      if (!temAlteracoes()) {
        fecharAgora();
        return;
      }
      var abertura = estado;
      var confirmar = typeof options.confirmar === 'function'
        ? options.confirmar
        : function (t, m) { return Promise.resolve(window.confirm(t + ': ' + m)); };
      confirmar(
        'Descartar alterações?',
        'As alterações desta reserva ainda não foram salvas. Deseja descartar e fechar?',
        'Descartar e fechar'
      ).then(function (confirmado) {
        if (confirmado && estado === abertura) fecharAgora();
      });
    }

    // ---- eventos fixos ---------------------------------------------------

    el.form.addEventListener('submit', salvar);
    el.cancelar.addEventListener('click', pedirFechar);
    dialog.addEventListener('cancel', function (evento) {
      evento.preventDefault();
      pedirFechar();
    });
    dialog.addEventListener('close', function () {
      // Fechado sem passar por pedirFechar (o Chrome fecha direto num segundo
      // Esc seguido, sem `cancel`): com alterações, reabre e pergunta.
      if (!estado || estado.salvando) return;
      if (temAlteracoes()) {
        mostrarModal(dialog);
        pedirFechar();
      } else {
        fecharAgora();
      }
    });

    // Clique no fundo escurecido. O próprio <dialog> recebe o clique também no
    // seu padding, então confere se o ponteiro estava fora da caixa, e se o
    // botão foi apertado fora (arrastar uma seleção para fora não fecha).
    function foraDaCaixa(evento) {
      var caixa = dialog.getBoundingClientRect();
      return evento.clientX < caixa.left || evento.clientX > caixa.right
        || evento.clientY < caixa.top || evento.clientY > caixa.bottom;
    }
    dialog.addEventListener('mousedown', function (evento) {
      pressionouFora = evento.target === dialog && foraDaCaixa(evento);
    });
    dialog.addEventListener('click', function (evento) {
      var fora = pressionouFora && evento.target === dialog && foraDaCaixa(evento);
      pressionouFora = false;
      if (fora) pedirFechar();
    });

    return { abrir: abrir };
  };
})();
