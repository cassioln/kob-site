# Lista de embarque interativa

A chamada abre automaticamente após autenticação em um painel deslizante com a identidade do Checklist de Bordo. O painel entra pela esquerda no desktop e sobe pela parte inferior até 1023 px. Pode ser recolhido por Escape, backdrop ou botão; o acionador no topo permite reabri-lo. A tablist contém somente Reservas e Planejamento de Frota. Atualizações de reservas não reabrem a chamada que o operador recolheu.

A lista segue a elegibilidade do PDF: somente reservas confirmadas com ônibus atribuído, incluindo VIPs e crianças de colo. Reservas comuns são agrupadas por ônibus e reserva. Todos os VIPs de um mesmo ônibus ficam em um único bloco, mantendo os códigos de reserva por pessoa e sem unir os registros no banco. Confirmados sem ônibus aparecem em aviso com acesso à Frota.

Ida e volta têm chamadas independentes. Busca e filtros de presença reduzem as linhas exibidas; contagens por grupo/ônibus continuam usando o total do trecho e ônibus selecionados. Cabeçalho e resumo ficam fora da rolagem interna para manter os faltantes visíveis. O cabeçalho reúne os ícones de atualizar e fechar em botões de 44 × 44 px, lado a lado, e o seletor Ida/Volta com setas e texto. Atualizar tem tooltip e fica desabilitado durante a sincronização. Não há seletor de idioma nem link PDF dentro da chamada. Os ônibus usam tabs com seleção por sublinhado e contagem por ônibus. Uma única tab participa da sequência de Tab; setas esquerda/direita e Home/End movem foco e seleção, com retorno circular nas setas. Cada tab referencia o painel de resultados, cujo rótulo acompanha a seleção. A faixa de tabs rola horizontalmente quando necessário.

A identidade usa o cabeçalho azul-marinho #041d3a, título Gobold Extra2, mascote existente do Checklist, superfície #f8fafc, tinta #16324c, seleção #083965 e checkbox #71206c. O corpo mantém a fonte de sistema do painel. Os alvos de check têm 48 px, com estados textuais de salvamento e resultado. O dialog nativo protege o foco; a navegação circula entre os controles mesmo durante a entrada animada. Movimento reduzido é respeitado.

Presença, horário UTC e revisão ficam no MySQL por passageiro e trecho. A API usa o token administrativo existente, valida elegibilidade e revisão e responde com o estado persistido. A marcação confirmada e os contadores mudam somente após resposta do servidor. Nenhuma presença é persistida no localStorage.

A atualização acontece a cada oito segundos enquanto a chamada está aberta, ao recuperar foco e ao reconectar. Fechar/reabrir preserva filtros e dados; uma nova leitura sincroniza o estado. Falhas preservam a última leitura e bloqueiam marcações até nova sincronização. A tabela é criada por bootstrap aditivo, independente do diretório php/db excluído do FTP, com SQL 009 disponível para provisionamento manual.

A mesma estrutura e dicionário atendem pt-BR/en/es, incluindo títulos, códigos, estados, atributos acessíveis, controles de abertura/fechamento e tooltips dos ícones. O idioma acompanha `?lang=pt`, `?lang=en` ou `?lang=es`, com a língua da página como padrão. Nenhum conteúdo do manual foi alterado e nenhum raster novo de produção foi criado. A extensão mantém o sistema global de `docs/DESIGN.md`; seus detalhes locais ficam nesta especificação e no contrato `.impeccable/surfaces/painel-onibus-html.md`.

## Validação da revisão de 16/10/2026

- Os 25 testes do painel passaram, incluindo tabs, teclado, localização e presença; as verificações de sintaxe JS e `git diff --check` também passaram.
- Passaram 140 testes de servidor e 8 testes de timing. As duas falhas de Manual na suíte geral foram reproduzidas sem esta revisão no baseline `332cc77`.
- A revisão visual independente terminou com `disposition: ship`. Foram inspecionadas as larguras 320, 390, 820 e 1440 px, os estados com lista rolada e as versões em inglês e espanhol, em `.impeccable/review/boarding-header/`.
- O único achado visual, sobre os ícones em inglês a 320 px, foi encerrado como falso positivo após conferir as capturas completas e os recortes do cabeçalho; não exigiu alteração da interface.
- Revisão entregue no PR 79; ainda não publicada em produção.
