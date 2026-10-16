# Lista de embarque interativa

O painel abre na primeira aba, **Lista de embarque**. A administração confere
passageiros em celular e tablet, mantendo as abas Reservas e Planejamento de Frota.

A lista segue o PDF: somente reservas confirmadas com ônibus atribuído, incluindo
VIPs e crianças de colo, agrupadas por ônibus e reserva. Pessoas sem ônibus
confirmado aparecem em um aviso que encaminha para a Frota, sem permitir presença.

Há chamadas independentes de ida e volta, busca por pessoa/grupo/código/CPF,
filtro de faltantes/presentes/todos, resumo global e progresso por ônibus e grupo.
A marcação individual é um botão com estado acessível, texto e ícone. O estado
confirmado e os contadores mudam somente depois da resposta do servidor.

O MySQL armazena presença, horário UTC e revisão por passageiro e trecho em uma
tabela própria com chave estrangeira. A API usa o token administrativo existente,
valida elegibilidade e aplica controle de revisão para impedir sobrescritas
silenciosas entre aparelhos. Não há presença persistida no localStorage.

A aba sincroniza a cada oito segundos enquanto visível, ao recuperar foco e ao
voltar a conexão. Falhas preservam a última leitura, identificam dados
desatualizados e oferecem nova tentativa; nunca anunciam uma gravação sem confirmação.

O painel administrativo atual tem uma única página. A nova superfície usa um
dicionário compartilhado pt-BR/en/es, selecionável no próprio embarque, mantendo
idêntica estrutura, atributos acessíveis e regras nos três idiomas.

Validação: testes PHP de validação e concorrência/persistência, testes de navegador
com duas sessões, erro de rede, recarga, filtros, teclado, idiomas e layouts de
celular/tablet/desktop. A migração aditiva é idempotente e também aplicada pela
API autenticada, conforme a prática atual do painel.

## Registro da implementação concluída — 2026-10-15

A implementação mantém o fluxo previsto. O resumo acompanha o trecho e o ônibus
selecionados, ou todos os ônibus; busca e filtro de presença alteram somente as
linhas exibidas. O resumo permanece fixo a 8px do topo durante a rolagem em
desktop, tablet e celular. Após salvar, o foco retorna à ação da pessoa; quando
o filtro a remove, segue para uma pessoa adjacente visível ou para a busca.

A superfície reutiliza os tokens operacionais de `painel-onibus.css`: system-ui,
fundo frio, superfícies brancas, tinta azul-marinho, roxo para seleção e foco,
verde para presença, âmbar para faltantes e vermelho para erro. As ações
individuais têm ao menos 48px de altura, ou 60px até 480px. Até 800px, cabeçalho
e ferramentas se reorganizam; até 480px, os ônibus rolam horizontalmente, a
interface fica mais compacta e nomes continuam junto de suas ações. A busca
e os filtros voltam a empilhar abaixo de 375px. Não foram criados rasters de
produção nem alterado o sistema visual geral; `docs/DESIGN.md` foi preservado.

Arquivos da superfície: `painel-onibus.html`, `assets/css/painel-embarque.css`,
`assets/js/painel-embarque.js` e `assets/js/painel-embarque-i18n.js`. A API
autenticada cria a tabela de forma idempotente pelo bootstrap em
`php/lib/bus-boarding.php`, sem depender do diretório `php/db` excluído do deploy;
`009_bus_boarding_checkins.sql` permanece como migração manual equivalente.

QA final: 22 testes do painel aprovados, validação PHP e integração com MariaDB
10.11 isolado aprovadas; `npm run test:ci` aprovado com 140 testes do servidor,
testes de temporização de avisos da live e 41 fluxos essenciais de navegador.
As sete capturas finais em `.impeccable/review/` cobrem página inteira e viewport
de desktop/tablet/celular e o tablet durante a rolagem. O revisor independente
emitiu **ship no escopo das duas correções avaliadas**, ambas resolvidas: foco
após salvar e resumo sticky em todas as larguras. O registro detalhado de tokens,
comportamento e evidências fica em
`.impeccable/surfaces/painel-onibus-html.md`.
