# Painel de reservas: editar reserva e registrar desistência

Data: 2026-10-16
Página: `painel-onibus.html` (https://painel.kriativosonboard.com.br/)

## Intenção

A organização precisa corrigir dados de passageiros (nome digitado errado, CPF,
contato, faixa etária, grupo) e registrar quem desistiu da viagem sem apagar a
reserva. Hoje o painel é só leitura para reservas pagas: não há como corrigir
nada nem liberar o lugar de quem não vai mais.

A desistência precisa ficar **visível** (lista de reservas e Excel), mas a pessoa
**some** de onde ocupa recurso operacional: assento na frota e chamada de
embarque. A reserva continua existindo, com histórico.

## Objetivos

1. Ícone de editar em cada reserva da lista (todas: pagas, pendentes,
   canceladas, VIP), na primeira linha do grupo.
   O mesmo ícone também aparece em cada card de reserva do Planejamento de
   Frota (`.grupo-item__top`, ao lado do código), abrindo o mesmo modal. O
   clique não pode iniciar o arraste do card (`mousedown` com
   `stopPropagation`, como os outros botões do card). Cards VIP legados
   (`id` começando com `vip_`) não têm reserva real e ficam sem o ícone.
2. Ao clicar, abrir um modal com a identidade visual do `#painel-vip-dialog`
   (`bus-dialog`, cabeçalho com badge de ícone, título, subtítulo, ações no
   rodapé).
3. O modal lista todas as pessoas da reserva, cada uma como um item recolhido
   (nome + resumo: faixa etária, CPF, marca de responsável, marca de
   desistência). Clicar no passageiro expande o item e mostra os campos
   editáveis. Reserva de uma pessoa só (VIP ou solo) abre já expandida e sem
   controle de recolher (ver "Reserva de uma pessoa só").
4. Editáveis por passageiro: nome completo, CPF, WhatsApp, e-mail, faixa etária
   (18+, 6 a 17, 0 a 5 colo). Editável por reserva: nome do grupo.
5. Toggle "Desistiu" em cada passageiro, com campo opcional de motivo. Reserva
   VIP não tem desistência (ver "VIP: sem desistência").
6. Ao salvar uma desistência:
   - lista de reservas: passageiro aparece marcado (riscado/esmaecido + etiqueta
     "Desistiu");
   - Excel: passageiro continua na planilha, com indicação de desistência, data
     e motivo;
   - painel de frota: passageiro deixa de contar e o assento dele é liberado no
     ônibus (criança de colo não ocupa assento). No card, quem pagava e desistiu
     continua visível: meeple vermelho depois dos roxos, e no tooltip o nome
     fica vermelho e tachado com "Desistência" no lugar da faixa etária. Colo
     que desiste simplesmente some;
   - chamada de embarque: passageiro sai da lista (online, PDF e XLSX da
     chamada);
   - e-mail para a organização resumindo a mudança.
7. Se o desistente for o responsável, o modal exige escolher um novo
   responsável entre os passageiros ativos da reserva.

## Não-objetivos

- Não mexer em valores: valor pago, `amount_cents`, receita e receita líquida
  não mudam com desistência. Reembolso, se houver, é feito fora do painel.
- Não mudar status de pagamento pela interface (regra já registrada em
  `bus-admin-data.php`: confirmar vaga sem lastro é proibido).
- Não adicionar nem excluir passageiros de uma reserva.
- Não enviar e-mail para passageiros ou para o novo responsável.
- Não criar versões EN/ES do painel (o painel e o modal VIP são só em PT-BR; a
  chamada de embarque já tem i18n e só precisa esconder o desistente).

## Antiobjetivos (seria falha mesmo funcionando)

- Apagar o passageiro do banco ou perder o histórico.
- Assento liberado na frota sem que o embarque reflita, ou vice-versa (as duas
  visões precisam ler a mesma regra).
- Uma reserva ficar com mais crianças de colo do que adultos (18+) ativos.
- Uma reserva ativa ficar sem responsável, ou com responsável menor de idade.
- Edição que derrube reserva para um ônibus acima da capacidade sem aviso.

## Regras decididas pelo usuário

| Tema | Decisão |
|---|---|
| O que editar | Tudo: dados pessoais, faixa etária e nome do grupo |
| Valores | Desistência só marca; não altera valores nem receita |
| Reverter | Pode desfazer: desligar o toggle e salvar reativa a pessoa no mesmo ônibus do grupo; se não houver lugar, bloqueia e avisa |
| Colo sem adulto | Bloquear o salvamento se crianças de colo ativas > adultos (18+) ativos (menor de 6 a 17 não acompanha colo, como no checkout); a mensagem orienta marcar também a criança |
| Novo responsável | Só adultos 18+ ativos; e-mail e WhatsApp dele viram o contato da reserva; se faltarem, o modal exige preencher antes de salvar |
| Todos desistem | A reserva vira "Desistente": sai da frota e do embarque, fica na lista com esse status, não pede novo responsável |
| Alcance do ícone | Lista de reservas e cards da frota. Todas as reservas. O toggle de desistência só aparece em reservas pagas (confirmadas) que não sejam VIP |
| VIP: sem desistência | Reserva VIP tem uma pessoa só e não tem desistência: o modal não mostra o switch "Desistiu", o motivo nem "Novo responsável", e o servidor recusa `withdrawn: true` num passageiro de reserva VIP ("Reserva VIP não tem desistência. Use "Remover reserva VIP"."). O payload segue com `withdrawn: false`. Desistência já gravada em dado antigo continua como está |
| VIP: remoção pelo modal | Só o modal remove a reserva VIP. O rodapé tem o botão vermelho "Remover reserva VIP" (`#editar-remover-vip`, entre Cancelar e "Salvar alterações"), visível só para VIP real (`is_vip` e id que não começa com `vip_`). O clique fecha o modal sem perguntar sobre alterações e abre a confirmação (`#painel-alerta-dialog`) com o botão "Remover VIP" em vermelho; confirmar chama `api/bus-vip-delete`. Cancelar a confirmação não reabre o modal. O botão "−" saiu dos cards da frota e da lista "Sem ônibus confirmado" |
| Reserva de uma pessoa só | VIP ou solo: o painel da pessoa abre expandido e o cabeçalho deixa de ser botão (sem seta, sem `aria-expanded`/`aria-controls`, sem clique), para o leitor de tela não anunciar um controle que não faz nada. O foco inicial vai para o campo Nome. Com mais de uma pessoa, segue a sanfona (um aberto por vez) |
| E-mail | Avisar a organização (administrativo@) a cada salvamento com desistência, reativação ou troca de responsável |
| Grupo | Seletor com os nomes livres do catálogo (`bus_catalogo_grupos`) + o atual. Fica no cabeçalho do modal, à direita do título (sob ele no celular), travado (`disabled`) com o nome atual; o link "Alterar grupo" destrava e foca o seletor e só então busca os nomes livres (`api/bus-group-names`). "Manter grupo" volta ao nome de antes e trava de novo. Sem alteração, `group_name` não vai no pedido |
| Registro | Data/hora da desistência (automática, UTC) + motivo opcional; ambos no Excel |
| Mockup | Dispensado; seguir a identidade do modal VIP |
| Colo → pagante | Permitido com aviso no modal ("passa a ocupar um assento sem pagamento correspondente"); salva se houver lugar no ônibus; cobrança resolvida fora do painel. Vale também para reservas pendentes |
| Reativar reserva inteira | Volta para o mesmo ônibus de antes (guardado); sem lugar → bloqueia e avisa |
| Histórico de edição | Guardar log de cada salvamento (antes/depois, quando). Não aparece no painel por enquanto |
| Lugar liberado | Só liberar no mapa; o e-mail da organização avisa se há reservas na espera. Realocação continua manual |

### Decisões minhas (revisar)

- **Desistência da reserva inteira não usa o `status`.** O webhook do Mercado
  Pago e a reconciliação sobrescrevem `status` sem olhar o valor atual; um
  estorno ou uma notificação reenviada apagaria a desistência ou até
  devolveria a reserva à frota. Por isso a desistência fica em colunas
  próprias, separadas do pagamento, e o status de pagamento continua intacto.
- **CPF não pode repetir em outra reserva ativa** (paga, VIP ou pendente, com o
  passageiro não desistente), igual ao cadastro de VIP. Evita a mesma pessoa
  contada em dois ônibus.

## Modelo de dados (como está hoje)

- `bus_registrations`: `primary_name`, `primary_cpf`, `primary_birth_date`,
  `email`, `whatsapp`, `passenger_count` (pagantes), `children_count` (colo),
  `group_name` (único, NULL em reserva individual), `is_vip`, `bus_number`,
  `fleet_assignment_status`, `status`, `amount_cents`.
- `bus_passengers`: `position`, `full_name`, `cpf`, `whatsapp`, `email`,
  `is_primary`, `is_minor`, `is_child_lap`. UNIQUE `(registration_id, cpf)`.
- Os dados do responsável estão **duplicados**: `primary_*`/`email`/`whatsapp`
  na reserva e a linha `is_primary = 1` em `bus_passengers`.
- Assentos: `bus_fleet_seat_count(pagantes, colo) = pagantes` (colo não ocupa
  assento). Frota, balanceamento e trava usam `passenger_count`/`children_count`.
- Embarque: `php/lib/bus-boarding.php` lista `bus_passengers` de reservas
  `confirmed` com `bus_number` não nulo; check-ins em `bus_boarding_checkins`.
- Triggers/CHECK: `passenger_count` entre 1 e 100; `children_count <=
  passenger_count`; `status` dentro do ENUM.

## Desenho proposto

### Banco (migração `010_passenger_withdrawal.sql`)

- `bus_passengers`: `withdrawn_at DATETIME NULL` (UTC) e
  `withdrawal_reason VARCHAR(500) NULL`. Desistente = `withdrawn_at IS NOT NULL`.
- `bus_registrations.passenger_count` e `children_count` passam a significar
  **ativos**. Recalcular ao salvar, a partir dos passageiros não desistentes.
  Assim frota, balanceamento, trava, manifesto e resumo continuam corretos sem
  reescrever cada consulta.
- `bus_registrations`: `withdrawn_at DATETIME NULL` (UTC),
  `withdrawn_bus_number TINYINT UNSIGNED NULL` e
  `withdrawn_fleet_status ENUM('assigned','waiting') NULL`, preenchidos quando
  todos desistem. Reserva "Desistente" = `withdrawn_at IS NOT NULL`. O `status`
  de pagamento não muda (ver "Decisões minhas").
- Reserva inteira desistente: `bus_number = NULL`; `passenger_count` e
  `children_count` **ficam com os valores de antes** (o trigger exige
  `passenger_count >= 1`), e toda leitura de frota/embarque/resumo filtra
  `withdrawn_at IS NULL`. Ao reativar, restaura `bus_number` e
  `fleet_assignment_status` dos campos `withdrawn_*` (checando capacidade e
  trava) e zera os três.
- Nova tabela `bus_registration_edits` (log): `id`, `registration_id`,
  `edited_at` (UTC), `changes JSON` (lista de {passageiro, campo, antes,
  depois}, incluindo grupo, responsável, desistência e reativação). Só
  escrita por enquanto.
- A migração segue o padrão das existentes e roda também pelo
  `bus_fleet_ensure_*` lazy, como as outras colunas recentes.

### Endpoint `php/mysql/bus-registration-update.php`

- POST, `bus_check_admin_token`, `read_json_body()`, mesmo padrão de
  `bus-vip-delete.php`.
- Corpo: `registration_id`, `group_name` (opcional), `primary_passenger_id`
  (quando muda), `passengers[]` com `id`, `full_name`, `cpf`, `whatsapp`,
  `email`, `age_group` (`adult`/`minor`/`lap`), `withdrawn` (bool),
  `withdrawal_reason`.
- Uma transação com `SELECT ... FOR UPDATE` na reserva. Validações reaproveitam
  `validation.php` (nome, CPF, WhatsApp, e-mail):
  - CPF não pode repetir dentro da reserva (constraint já existe).
  - Responsável: exatamente um, ativo, adulto 18+. E-mail e WhatsApp são obrigatórios ao trocar o responsável; mantido o responsável, só o campo que já estava gravado (VIP sem contato salva sem inventar um).
  - Colo ativos ≤ adultos (18+) ativos. Menores de 6 a 17 ocupam assento, mas não contam como acompanhante do colo.
  - Grupo: nome do catálogo, livre ou o atual; reserva individual ativa fica
    com NULL (decisão do builder se um grupo que encolhe para 1 pessoa perde o
    nome; recomendação: manter o nome, para não quebrar referência do grupo no
    embarque).
  - Capacidade: se a reserva está num ônibus e os assentos ativos aumentam
    (reativação ou colo → pagante), checar contra a capacidade (46). Se não
    couber, responder 409 com mensagem clara. Ônibus travado também bloqueia
    aumento.
- Atualiza `bus_passengers`, recalcula `passenger_count`/`children_count`,
  sincroniza `primary_name`/`primary_cpf`/`email`/`whatsapp` com o
  responsável. `primary_birth_date`: zerar ao trocar responsável (o novo não
  tem data coletada) — chamada do builder se preferir pedir a data no modal.
- Todos desistiram: grava `withdrawn_at`/`withdrawn_bus_number`/
  `withdrawn_fleet_status` e zera `bus_number` (mantém as contagens).
- CPF: além do UNIQUE na reserva, bloquear CPF presente em outra reserva com
  passageiro ativo e status pago, VIP ou pendente.
- Faixa colo → pagante: permitido; servidor só checa capacidade. O aviso é do
  modal.
- Grava uma linha em `bus_registration_edits` com o diff do salvamento.
- Remove check-ins de embarque dos desistentes? **Não**: mantém histórico; o
  embarque simplesmente não lista quem tem `withdrawn_at`.
- Depois do commit, envia o e-mail administrativo (falha no envio não desfaz o
  salvamento; registra em log).
- Resposta: a reserva atualizada no mesmo formato de `bus-admin-data.php`, para
  o painel re-renderizar sem recarregar tudo (ou o painel chama `carregar()`).

### Leituras que precisam conhecer a desistência

- `bus-admin-data.php`: incluir `id`, `desistiu`, `desistiu_em`,
  `motivo_desistencia` em cada passageiro; reserva com `withdrawn_at` recebe
  `status_chave = 'desistente'`, rótulo "Desistente" (sobrepõe o status de
  pagamento na lista, que continua no Excel); fica fora da frota e do resumo
  de pessoas a bordo (receita não muda); a lista `passageiros` da frota traz
  os pagantes desistentes com `desistiu: true` (só para o meeple vermelho e o
  tooltip; `pagantes`, `criancas` e `assentos` seguem contando só ativos) e
  omite criança de colo desistente. O card também recebe `desistentes`.
  Cuidado com o índice "onde mais esse CPF aparece": ignorar desistentes.
- `bus-boarding.php` (lib): `AND p.withdrawn_at IS NULL` na lista e na contagem
  de espera; `bus_boarding_set` responde `manifest_changed` para desistente
  (o fluxo offline já trata `removed`).
- PDF/XLSX da chamada e `bus-manifest.php`: excluir desistentes.
- `bus-admin-xlsx.php`: manter o desistente na planilha; nova coluna
  "Desistência" (data dd/mm/aaaa hh:mm em São Paulo + motivo), linha com estilo
  esmaecido; "Qtd Pessoas" passa a refletir ativos; filtro e resumo contam a
  reserva desistente.
- `bus-fleet.php` (balanceamento, trava, atribuição) e `bus-fleet-assign.php`:
  reservas com `withdrawn_at` ficam fora; demais já leem contagens ativas.
- Webhook/reconciliação: se uma reserva desistente receber `confirmed` de novo,
  não chamar `bus_assign_fleet` (a desistência prevalece até ser revertida no
  painel).
- E-mails futuros de confirmação/pix não devem ir a desistentes (checar
  `confirmation-mailer.php`).

### Painel (front)

- `painel-onibus.html`: novo `<dialog id="painel-editar-dialog" class="bus-dialog
  bus-dialog--editar">` com a mesma estrutura do VIP (header com badge e ícone de
  lápis, título "Editar reserva #CODE", subtítulo com grupo e status). Corpo: seletor
  de grupo (quando aplicável) e lista de passageiros em acordeão (botão com
  `aria-expanded`, um aberto por vez é chamada do builder). Rodapé: "Cancelar" e
  "Salvar alterações".
- Item expandido: campos no mesmo estilo de `vip-formularios`, faixa etária,
  toggle "Desistiu" (`role="switch"`) e, quando ligado, campo "Motivo
  (opcional)".
- Responsável desistiu: aparece um bloco "Novo responsável" com rádios dos
  adultos ativos; se o escolhido não tem e-mail/WhatsApp, os campos dele ficam
  obrigatórios e o item abre.
- Validação no cliente espelha a do servidor (mensagens em `vip-form__erro`
  equivalente). Fechar com alterações não salvas pede confirmação, como
  `fecharDialogVipComConfirmacao`.
- Lista de reservas (`renderizar`): botão de ícone (lápis) com
  `aria-label="Editar reserva #CODE"` na célula Reserva da primeira linha;
  passageiro desistente com classe `tabela__linha--desistente` (texto riscado,
  opacidade reduzida) e etiqueta "Desistiu" + data; contagem "N pessoas" e
  resumo contam só ativos; busca continua encontrando desistentes.
- Filtro de status: incluir "Desistentes" se a reserva inteira desistiu (o
  builder decide se vira opção própria ou entra em "cancelados e falhas";
  recomendação: opção própria).
- Frota: some do mapa de poltronas pela contagem ativa; nenhum código novo além
  de usar os dados atualizados.
- Subir o `?v=` dos scripts/CSS alterados em `painel-onibus.html`.

### E-mail para a organização

Novo template em `php/lib/` no padrão de `admin-email.php`: assunto "Reserva
CODE – alteração no painel", lista do que mudou (desistências com motivo,
reativações, troca de responsável, dados corrigidos de forma resumida), ônibus e
lugares liberados. Enviado só quando houver desistência, reativação ou troca de
responsável (edições simples de dados não disparam). Quando lugares são
liberados e há reservas com `fleet_assignment_status = 'waiting'`, o e-mail
diz quantas estão na espera, para a organização realocar.

## Testes

- PHP (`php/tests/`): regras do endpoint isoladas numa função de lib
  (`php/lib/registration-edit.php`) testável sem HTTP: colo > adultos bloqueia;
  responsável desistente sem substituto bloqueia; novo responsável menor
  bloqueia; todos desistem → reserva com `withdrawn_at` e fora da frota; reativação acima da capacidade → 409;
  contagens recalculadas; CPF repetido na reserva e em outra reserva ativa;
  reativação da reserva inteira volta ao ônibus guardado; log gravado.
- Embarque: teste em `bus-boarding.test.php` garantindo que desistente não sai na
  lista nem nas exportações (`boarding-rollcall-*.test.php`).
- XLSX admin: coluna e estilo de desistência.
- Playwright (`analytics/tests/`, padrão de `painel-embarque.spec.js` com rotas
  mockadas): abrir modal, expandir passageiro, editar e salvar; ligar
  desistência do responsável e escolher novo; marca visual na lista; teclado e
  `aria-expanded`.
- Rodar Playwright pelo Terminal do app em porta privada (ver memória do
  projeto).

## Deixado para o builder

- Ícones exatos (lápis no botão e no badge do header), cores do estado
  "desistente" dentro da paleta existente.
- Acordeão com um ou vários itens abertos.
- Formato da resposta do endpoint (reserva inteira vs. recarregar tudo).
