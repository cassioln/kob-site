import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Porta da lógica de bus_atribuir_nome_grupo (php/lib/group-names.php).
 *
 * O que se prova aqui:
 *  1. nome nunca repete;
 *  2. quando o catálogo esgota, cai para "Monopoly N" sequencial;
 *  3. em disputa (gravação recusada por unicidade) tenta o próximo, em vez de
 *     desistir ou devolver nome duplicado;
 *  4. a sequência do Monopoly continua do maior já usado, para não reemitir um
 *     número liberado por cancelamento.
 */

const CATALOGO = [
  'The Castles of Burgundy', 'SETI', 'Projeto Gaia', 'Gloomhaven',
  'Terraforming Mars', 'Ark Nova', 'Terra Mystica', 'Mage Knight',
  'Harmonies', 'Clank!', 'Root', 'Puerto Rico', 'Spirit Island', 'Lisboa',
  'Twilight Struggle', 'Um Banquete a Odin', 'Everdell',
  'Mansions of Madness', 'Ticket to Ride', 'Zombicide', 'Scythe', 'Arnak',
  'Five Tribes', 'Caverna', 'On Mars', 'La Granja', 'Sky Team', 'Azul',
  'Tiranos da Umbreterna', '7 Wonders', 'Pandemic Legacy', 'Eclipse',
  'Agricola', 'Anachrony', 'As Viagens de Marco Polo', 'Robinson Crusoé',
  'World Wonders', 'Lords of Waterdeep', 'The White Castle', 'Stone Age',
  'El Grande', 'Teotihuacan', 'Orléans', 'Food Chain Magnate', 'Tikal',
  'Power Grid', 'Wingspan', 'Catan', 'Pandemic', 'Carcassonne', 'Dixit',
];

function eGrupo(pagantes, criancas) {
  return pagantes + criancas >= 2;
}

function atribuir(usados, tentarGravar) {
  const disponiveis = CATALOGO.filter(n => !usados.includes(n));
  // shuffle determinístico não importa para o teste: o contrato é "não repete".
  for (const nome of disponiveis) {
    if (tentarGravar(nome)) return nome;
  }
  let maior = 0;
  for (const u of usados) {
    const m = /^Monopoly (\d+)$/.exec(u);
    if (m) maior = Math.max(maior, Number(m[1]));
  }
  for (let i = maior + 1; i <= maior + 50; i++) {
    if (tentarGravar(`Monopoly ${i}`)) return `Monopoly ${i}`;
  }
  return null;
}

test('catálogo tem 51 nomes e nenhum repetido na origem', () => {
  assert.equal(CATALOGO.length, 51);
  assert.equal(new Set(CATALOGO).size, 51, 'catálogo com nome duplicado');
});

test('só é grupo com 2 ou mais pessoas, contando criança de colo', () => {
  assert.equal(eGrupo(1, 0), false, '1 pagante não é grupo');
  assert.equal(eGrupo(2, 0), true, '2 pagantes é grupo');
  // Uma mãe com bebê é grupo de 2 para quem organiza o embarque, mesmo que só
  // uma pessoa pague. O requisito diz "pagante ou não".
  assert.equal(eGrupo(1, 1), true, '1 pagante + 1 colo é grupo');
  assert.equal(eGrupo(3, 2), true);
});

test('nomes não repetem ao esgotar o catálogo inteiro', () => {
  const usados = [];
  const emitidos = [];
  for (let i = 0; i < CATALOGO.length; i++) {
    const nome = atribuir(usados, n => { usados.push(n); return true; });
    emitidos.push(nome);
  }
  assert.equal(emitidos.length, 51);
  assert.equal(new Set(emitidos).size, 51, 'emitiu nome repetido');
});

test('esgotado o catálogo, cai para Monopoly sequencial', () => {
  const usados = [...CATALOGO];
  const a = atribuir(usados, n => { usados.push(n); return true; });
  const b = atribuir(usados, n => { usados.push(n); return true; });
  const c = atribuir(usados, n => { usados.push(n); return true; });
  assert.equal(a, 'Monopoly 1');
  assert.equal(b, 'Monopoly 2');
  assert.equal(c, 'Monopoly 3');
});

test('sequência do Monopoly continua do maior, não reusa número liberado', () => {
  // Simula cancelamento que liberou "Monopoly 2": o próximo deve ser 4, não 2.
  const usados = [...CATALOGO, 'Monopoly 1', 'Monopoly 3'];
  const proximo = atribuir(usados, () => true);
  assert.equal(proximo, 'Monopoly 4');
});

test('em disputa de unicidade, tenta o próximo em vez de duplicar', () => {
  // Primeira gravação é recusada (outra reserva pegou o nome no mesmo instante).
  let tentativas = 0;
  const nome = atribuir([], () => {
    tentativas++;
    return tentativas > 1; // recusa a primeira, aceita a segunda
  });
  assert.equal(tentativas, 2, 'deveria ter tentado duas vezes');
  assert.ok(CATALOGO.includes(nome), 'nome final fora do catálogo');
});

test('aborta a busca quando a falha nao foi conflito de nome', () => {
  // Corrida na MESMA reserva: outra execução já gravou o nome, então todo UPDATE
  // devolve rowCount 0. Sem o sinal de aborto a lib varreria os 51 nomes do
  // catálogo e ainda 50 Monopoly, gastando 101 tentativas inúteis e (pior)
  // marcando nomes como usados sem necessidade.
  let tentativas = 0;
  let jaPreenchida = false;

  function atribuirComAborto(usados, tentarGravar, abortar) {
    const disponiveis = CATALOGO.filter(n => !usados.includes(n));
    for (const nome of disponiveis) {
      if (tentarGravar(nome)) return nome;
      if (abortar && abortar()) return null;
    }
    let maior = 0;
    for (const u of usados) {
      const m = /^Monopoly (\d+)$/.exec(u);
      if (m) maior = Math.max(maior, Number(m[1]));
    }
    for (let i = maior + 1; i <= maior + 50; i++) {
      if (tentarGravar(`Monopoly ${i}`)) return `Monopoly ${i}`;
      if (abortar && abortar()) return null;
    }
    return null;
  }

  const r = atribuirComAborto([], () => {
    tentativas++;
    jaPreenchida = true; // simula rowCount 0 por reserva já preenchida
    return false;
  }, () => jaPreenchida);

  assert.equal(r, null, 'deveria devolver null ao abortar');
  assert.equal(tentativas, 1, `abortou tarde: ${tentativas} tentativas em vez de 1`);
});

test('regra do estado vazio: relatorio sem reservas precisa explicar, nao so mostrar zero', () => {
  // Porta da decisao de php/lib/boarding-pdf.php e php/mysql/bus-admin-xlsx.php.
  //
  // Uma folha com "0 reserva(s)" e a legenda de um asterisco que nao aponta para
  // nada parece defeito de geracao. O teste fixa o contrato: quando a lista esta
  // vazia, o relatorio diz o que aconteceu E omite a legenda que nao se aplica.
  function montarLista(reservas) {
    const blocos = ['Lista de Embarque', `${reservas.length} reserva(s)`];
    if (reservas.length === 0) {
      blocos.push('Nenhuma reserva paga ainda.');
      // Sem legenda de asterisco: nao ha responsavel marcado para explicar.
    } else {
      reservas.forEach(r => blocos.push(`RESERVA ${r}`));
      blocos.push('* contato responsavel pela reserva');
    }
    return blocos;
  }

  const vazia = montarLista([]);
  assert.ok(vazia.some(b => /Nenhuma reserva paga/.test(b)), 'vazio sem explicacao');
  assert.ok(!vazia.some(b => b.startsWith('*')), 'legenda do asterisco sobrou no vazio');

  const cheia = montarLista(['ABC12345', 'DEF67890']);
  assert.ok(!cheia.some(b => /Nenhuma reserva paga/.test(b)), 'mensagem de vazio sobrou');
  assert.ok(cheia.some(b => b.startsWith('*')), 'legenda do asterisco faltou com dados');
  assert.equal(cheia.filter(b => b.startsWith('RESERVA')).length, 2);
});

test('log do webhook distingue envio real de reenvio sem envio', () => {
  // Porta da regra de php/mysql/mercadopago-webhook.php.
  //
  // O Mercado Pago reenvia notificacao rotineiramente. Antes, qualquer resultado
  // com ok:true virava "enviado", inclusive quando NADA foi enviado porque tudo
  // ja tinha sido entregue. Log que mente sobre isso custa tempo: manda procurar
  // e-mail que nunca saiu, ou culpar o sistema por duplicata que ele nao mandou.
  function resumir(envio) {
    if (!envio.ok) return envio.motivo || 'nao_enviado';
    const enviados = [];
    if (envio.contato === 'enviado') enviados.push('contato');
    for (const p of envio.passageiros || []) {
      if (p.status === 'enviado') enviados.push('passageiro' + p.pos);
    }
    if (envio.admin === 'enviado') enviados.push('admin');
    let r = enviados.length ? enviados.join('+') : 'nada_novo';
    if (envio.erros && envio.erros.length) r += ` (com falha: ${envio.erros.length})`;
    return r;
  }

  // Primeira notificacao: tudo sai.
  assert.equal(resumir({
    ok: true, contato: 'enviado', admin: 'enviado',
    passageiros: [{ pos: 2, status: 'enviado' }, { pos: 3, status: 'enviado' }],
  }), 'contato+passageiro2+passageiro3+admin');

  // Reenvio: nada sai. O caso que estava sendo relatado como "enviado".
  assert.equal(resumir({
    ok: true, contato: 'ja_enviado', admin: 'ja_enviado',
    passageiros: [{ pos: 2, status: 'ja_enviado' }],
  }), 'nada_novo');

  // Passageiro sem e-mail informado nao conta como envio.
  assert.equal(resumir({
    ok: true, contato: 'enviado', admin: 'enviado',
    passageiros: [{ pos: 2, status: 'sem_email' }],
  }), 'contato+admin');

  // Falha parcial precisa aparecer, senao passa por sucesso completo.
  assert.equal(resumir({
    ok: true, contato: 'enviado', admin: 'falhou',
    passageiros: [], erros: ['admin: timeout'],
  }), 'contato (com falha: 1)');

  // Reserva ainda nao confirmada.
  assert.equal(resumir({ ok: false, motivo: 'nao_confirmada' }), 'nao_confirmada');
});

test('falha de SMTP em um destinatario nao impede nem duplica os outros', () => {
  // Porta da regra de php/mysql/lib/confirmation-mailer.php.
  //
  // Cada destinatario tem sua PROPRIA marca de envio no banco (a da reserva para
  // o contato, uma por passageiro, e a de admin). Isso existe para que uma falha
  // isolada de SMTP -- comum na Locaweb, que limita por janela e devolve 451 de
  // forma inconsistente -- nao vire perda silenciosa nem reenvio em massa.
  //
  // Contrato provado aqui:
  //   1. falha em um destinatario NAO bloqueia os seguintes;
  //   2. quem falhou NAO recebe marca, entao a proxima passagem tenta de novo;
  //   3. quem teve sucesso RECEBE marca, entao nao recebe segunda via;
  //   4. na segunda passagem, so o que faltava e enviado.

  function disparar(estado, smtpFalhaPara) {
    const enviados = [];
    const erros = [];

    const tentar = (quem) => {
      if (estado[quem]) return 'ja_enviado';        // marca no banco: nao reenvia
      if (smtpFalhaPara.includes(quem)) {
        erros.push(quem);
        return 'falhou';                             // sem marca: retenta depois
      }
      estado[quem] = 'MARCADO';
      enviados.push(quem);
      return 'enviado';
    };

    const r = {
      contato: tentar('contato'),
      passageiros: [2, 3].map(pos => ({ pos, status: tentar('p' + pos) })),
      admin: tentar('admin'),
    };
    return { r, enviados, erros, estado };
  }

  // Passagem 1: o SMTP falha para o passageiro 2 e para o admin.
  const estado = {};
  const a = disparar(estado, ['p2', 'admin']);

  assert.equal(a.r.contato, 'enviado', 'contato deveria ter saido');
  assert.equal(a.r.passageiros[0].status, 'falhou');
  assert.equal(a.r.passageiros[1].status, 'enviado',
    'falha no passageiro 2 nao pode impedir o passageiro 3');
  assert.equal(a.r.admin, 'falhou');
  assert.deepEqual(a.enviados, ['contato', 'p3']);

  // Quem falhou NAO tem marca; quem foi tem.
  assert.ok(estado.contato && estado.p3, 'sucesso precisa de marca');
  assert.ok(!estado.p2 && !estado.admin, 'falha NAO pode gravar marca');

  // Passagem 2 (retentativa, SMTP normal): so o que faltava sai.
  const b = disparar(estado, []);
  assert.deepEqual(b.enviados, ['p2', 'admin'],
    'retentativa deve enviar apenas o que faltava');
  assert.equal(b.r.contato, 'ja_enviado', 'contato nao pode receber duas vezes');
  assert.equal(b.r.passageiros[1].status, 'ja_enviado');

  // Passagem 3: nada mais a fazer.
  const c = disparar(estado, []);
  assert.deepEqual(c.enviados, [], 'terceira passagem nao deve enviar nada');
});

test('payload minimo por audiencia: template do cliente nao RECEBE cpf nem email', () => {
  // Porta da regra de php/mysql/lib/confirmation-mailer.php.
  //
  // Antes havia UM conjunto de passageiros com cpf e email, entregue aos tres
  // templates; a blindagem dependia de o template do cliente "escolher nao
  // imprimir" esses campos. Isso e fragil: uma alteracao futura, um log de
  // excecao que serialize o payload, ou um esquecimento vazariam CPF e e-mail de
  // todos os passageiros para um unico destinatario.
  //
  // Agora sao DOIS conjuntos. O contrato provado aqui e estrutural: o dado
  // sensivel nem chega ao template do cliente, entao nao ha o que ele imprima
  // por engano.
  function montarPayload(passageiros) {
    return {
      passengers: passageiros.map(p => ({
        name: p.name, whatsapp: p.whatsapp, isPrimary: p.isPrimary,
      })),
      passengersAdmin: passageiros.map(p => ({
        name: p.name, whatsapp: p.whatsapp, cpf: p.cpf, email: p.email,
        isPrimary: p.isPrimary,
      })),
    };
  }

  const d = montarPayload([
    { name: 'Mariana', whatsapp: '(11) 98765-4321', cpf: '126.842.132-40', email: 'mariana@x.com', isPrimary: true },
    { name: 'Rafael', whatsapp: '(11) 91234-5678', cpf: '377.243.745-11', email: 'rafael@x.com', isPrimary: false },
  ]);

  // Conjunto do CLIENTE: cpf e email nem existem como chave.
  for (const p of d.passengers) {
    assert.ok(!('cpf' in p), `cpf chegou ao template do cliente: ${JSON.stringify(p)}`);
    assert.ok(!('email' in p), `email chegou ao template do cliente: ${JSON.stringify(p)}`);
    assert.ok(p.name, 'nome e necessario para listar quem embarca');
  }

  // Mesmo serializando o conjunto do cliente (log, var_dump), nada sensivel sai.
  const serializado = JSON.stringify(d.passengers);
  assert.ok(!/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(serializado), 'CPF vazou na serializacao');
  assert.ok(!/@/.test(serializado), 'e-mail vazou na serializacao');

  // Conjunto do ADMIN: precisa ter tudo, senao a ficha interna fica inutil.
  assert.equal(d.passengersAdmin.length, 2);
  assert.equal(d.passengersAdmin[1].cpf, '377.243.745-11');
  assert.equal(d.passengersAdmin[1].email, 'rafael@x.com');
});
