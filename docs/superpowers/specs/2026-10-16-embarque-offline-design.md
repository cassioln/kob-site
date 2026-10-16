# Chamada de embarque offline

O usuário aprovou a proposta de cache IndexedDB, fila durável, estados pendente/salvo, reenvio e conflitos, e pediu acesso offline por celular/tablet. Esta extensão preserva a chamada e o banco central existentes.

## Fluxo

A primeira leitura autenticada guarda uma cópia mínima da lista no IndexedDB, separada por hash da chave administrativa. CPF e dados financeiros ficam fora do cache. Cada alteração é persistida antes de ser enviada. Até a resposta do servidor, a marcação é identificada como pendente; os contadores incluem a seleção local, com aviso explícito. Ida e volta continuam independentes. Falha de armazenamento não pode produzir uma confirmação falsa.

A fila sobrevive a recarga/fechamento. O envio ocorre com a chamada aberta e conexão disponível, na abertura, ao reconectar, recuperar foco e a cada oito segundos; não se promete execução com o app fechado. As operações usam a revisão e o ônibus de origem. Se o estado atual já corresponder ao desejado, a operação é satisfeita, inclusive após resposta perdida. Revisão divergente com estado diferente exige escolha explícita entre manter o banco e enviar a marcação local com a nova revisão. Mudança de ônibus também exige revisão; passageiro removido/não elegível permite apenas descartar a pendência. Nenhuma sobrescrita silenciosa.

Transações do IndexedDB e lease por sessão evitam drenagem simultânea entre abas. Atualizações notificam outras abas. A API mantém as validações e a transação MySQL existentes. Falha transitória conserva a fila; rejeição de acesso suspende envio e exige nova autenticação. Sair com pendências exige confirmação de descarte; sair remove a cópia local e a fila do acesso.

## Acesso offline

Um service worker armazena apenas HTML e assets estáticos explicitamente permitidos, nunca API, respostas administrativas ou URLs com tokens. A mesma página em `?chamada=1` abre somente a chamada, sem consultar Reservas, pagamentos ou reconciliação. O painel normal também recupera a chamada em falha de rede. Um manifesto instalável abre esse modo. O controle Acesso offline mostra a preparação dos arquivos e lista, acesso ao modo de chamada, instalação quando disponível e instruções Android/iOS. Uma instalação nova no iOS exige entrada e preparação online dentro do atalho.

Pronto offline exige cache estático instalado e cópia IndexedDB válida para a chave presente. HTTPS é necessário em produção; localhost permite testes. Armazenamento persistente é solicitado, mas a interface não promete retenção absoluta se o navegador/usuário apagar os dados. Sem preparação prévia, a tela explica que precisa de uma primeira conexão.

## Interface e idiomas

Preservar layout, meeples, progresso duplo e seletor existentes. Aviso compacto de conexão e quantidade pendente permanece visível; cada pessoa distingue seleção pendente de confirmação do banco. Conflitos ficam na área rolável com nome, trecho, estados e dois controles claros. Nenhum CPF é exibido na interface de conflito. Exportações ficam bloqueadas enquanto offline, desatualizado, com fila ou conflitos, evitando relatórios que pareçam confirmados. Textos e atributos atendem pt/en/es no dicionário compartilhado; manifesto tem versões localizadas.

## Verificação

Testar fila persistida antes de rede, check/desmarcar em ambos os trechos, recarga/novo documento sem sinal, recuperação/reenvio, resposta perdida, duas abas, alteração remota, mudança/remoção de passageiro, acesso rejeitado, armazenamento indisponível e logout. Testar service worker real com APIs mockadas apenas na página: cache de arquivos, navegação offline, ausência de API/credenciais no CacheStorage e inicialização sem chamadas financeiras. Conferir UI em celular/tablet/desktop e idiomas, teclado e estados. O teste não deve gravar passageiros reais. Publicação em produção depende do fluxo normal do projeto; o PR permanece em rascunho.

Referências: [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [armazenamento persistente](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist), [armazenamento separado no app iOS](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/).

## Refinamentos solicitados durante a implementação

Grupos exibem “Responsável: nome” entre título e código da reserva. O nome vem da pessoa primária da reserva completa, com contato da reserva como alternativa, mesmo se o filtro esconder essa pessoa. Nenhum card individual mostra o rótulo; VIPs e solos também não. Crianças de colo usam o SVG de meeple rosa de 14 px da Frota, decorativo junto ao nome, mantendo o rótulo textual nos três idiomas.

## Validação local e revisão visual — 16/10/2026

Passaram 60 testes do painel/Frota em Chromium (52,9 s), 19 cenários offline em WebKit (16,7 s), 150 testes do servidor e o comando completo `npm run test:ci` (77 fluxos de navegador em 1,2 min, mais contratos/servidor e oito casos de timing). A API/PHP não mudou nesta extensão. Os cenários abrangem commit local antes de POST, fila por trecho, recarga/novo documento offline, resposta perdida sem duplicação, conflitos, troca/remoção de passageiro, quota/armazenamento indisponível, acesso rejeitado, reautenticação e logout.

Os testes WebKit usam HTTP fictício isolado porque a interceptação de requests controladas por SW não é equivalente à do Chromium. As três navegações offline usam queda real das conexões HTTP de teste: `setOffline` do Playwright tem falha conhecida em WebKit mesmo com respostas literais do SW ([issue 42775](https://github.com/microsoft/playwright/issues/42775)). Não houve teste físico em iPhone/iPad ou gravação de presença real.

Doze capturas com dados fictícios foram conferidas em `.impeccable/review/boarding-offline/`: desktop/mobile de grupo e criança de colo, pendência, preparação, instruções, conflito, acesso rejeitado, pt/en/es e tablet em retrato/paisagem, com larguras 320/390/820/1180/1440. Não houve overflow horizontal ou erro JavaScript. O anúncio invisível foi ancorado ao topo para não ampliar a rolagem externa do dialog; as capturas confirmam `scrollTop=0` e altura externa igual à viewport, com cabeçalho/rodapé fixos após o check. No menor caso de 390×568, a área interna continua rolável.

## Correção do CI do PR 79

O workflow 38908579753 falhou em três casos do painel: largura em en/es após reabrir o slider e centralização do aviso de exportação. As imagens mostram a captura durante a animação e o dialog deslocado pelo anúncio acessível em posição estática fora do viewport. A posição do anúncio foi corrigida; os testes aguardam o fim da animação antes de medir e registram elementos que excederem a largura em caso de falha. O servidor estático de testes agora usa fila 128 para as páginas concorrentes e precache do SW. O comando integral do CI passou localmente; a execução remota deve validar o commit atualizado. PR segue em rascunho e sem deploy.
