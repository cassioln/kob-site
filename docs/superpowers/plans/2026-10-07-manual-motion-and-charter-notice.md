# Animações do manual e remoção do aviso do fretado

**Objetivo:** corrigir as três transições de layout autorizadas pelo mantenedor e remover a atualização editorial sobre horários do fretado em PT/EN/ES.

**Arquitetura:** usar `scaleY(2)` para realçar a linha de progresso ao arrastar, mantendo sua altura de layout em 3px; usar `translateX(6px)` no hover/foco dos links do menu; manter a entrada/saída do painel por `translateY`, com atualização única da altura entre os modos parcial/completo. Preservar cores, textos, áreas de toque e controles existentes. A redução de movimento mantém os estados, sem transições espaciais.

**Stack:** HTML, CSS, módulos JavaScript e Playwright existentes; nenhuma dependência nova.

- [x] Alterar somente as três transições no CSS compartilhado e suas regras de redução de movimento.
- [x] Remover `notice` e `noticeSeconds` de `chapter-1535`; preservar assunto, transcrição, FAQ e apoio aprovado com link do fretado.
- [x] Atualizar versões de cache do CSS e dos módulos afetados nas três páginas.
- [x] Atualizar os testes existentes para 21 avisos e para a permanência do apoio sem a atualização removida; conservar cobertura de avisos mistos em outro momento da gravação.
- [x] Validar testes de tempos, painel mobile, marcadores e menu; inspecionar desktop/mobile em uma rodada.
- [ ] Publicar por PR, checks, merge e deploy, e confirmar os arquivos em produção.

Validação local: sete testes de tempos e 14 cenários Playwright passaram. A seleção dos assets para publicação também passou. Inspeção em 390/1024px confirmou ausência de overflow, largura e padding constantes nos links e respeito à redução de movimento. Durante o gesto de toque, o progresso mantém 3px de altura de layout e chega a 6px visuais; o painel continua abrindo/fechando por deslocamento e alterna entre alturas parcial/completa. O detector não aponta mais transições de layout neste arquivo. O CI obrigatório será confirmado no PR antes do merge.
