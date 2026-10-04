# Manual de Bordo Live — Implementation Plan

> Execução inline autorizada pelo pedido; revisão final por agente da skill impeccable. Não há etapa de aprovação adicional: o usuário pediu execução autônoma enquanto está ausente.

**Goal:** entregar hero consistente PT/EN/ES com vídeo amplo, aba/gaveta de assuntos e busca fiel à transcrição.

**Architecture:** separar dados da live, funções puras de busca e controle do player; preservar o módulo atual de checklist/FAQ/contato. Usar ES modules para a live e CSS existente do Manual.

**Tech Stack:** HTML estático, CSS, JavaScript, YouTube IFrame API e Playwright existentes, sem novas dependências.

## Global Constraints

- Branch feat/embarcados-guia-bordo-2026; identidade Gobold/Montserrat e paleta KOB.
- FAQ da home intacto, 42 respostas e 25 itens do Manual preservados.
- Alteração local do usuário no contato preservada; sem mensagens ou pagamentos. Publicação na main posteriormente autorizada pelo usuário.
- Transcrição real em português separada de notices editoriais traduzidos; 28 assuntos cronológicos.
- Mídia externa ativada somente por clique informado; animação reduzida disponível.

### Task 1: dados e busca verificáveis

Files: criar assets/js/manual-de-bordo-live-data.js e assets/js/manual-de-bordo-live-search.js; verificar em server/tests/manual-live.test.mjs.

Interfaces: CHAPTERS contém id, time, seconds, titles PT/EN/ES, keywords, transcript, notice e faqId. normalizeSearch(text), matchChapter(chapter, query, lang), excerpt(text, query), highlightParts(text, query) são funções puras exportadas.

- [x] Extrair todos os blocos com timestamp do anexo, agrupar 00:36:01 e conferir os 28 segundos calculados.
- [x] Separar o texto falado das correções; títulos traduzidos e palavras-chave não inventam assuntos.
- [x] Implementar índice normalizado com mapa de offsets originais; realçar por textContent/mark, sem HTML arbitrário.
- [x] Testar invariantes: `assert.equal(CHAPTERS.length, 28)` e `assert.deepEqual(CHAPTERS.map(c => c.seconds), expectedSeconds)`; conferir correspondência integral entre cada bloco do anexo e dados.
- [x] Testar consultas “água”, “eu-vou”, “Wise Nomad”, “fraldas refeições”, buscas EN/ES, vazio e texto com `<img>` sem produzir elemento injetado.

### Task 2: hero única e gaveta

Files: manual-de-bordo.html, en/manual-de-bordo.html, es/manual-de-bordo.html, assets/css/manual-de-bordo.css.

Interfaces: #heroLiveCinema contém #livePlayerWrapper e #heroLiveChaptersCol; #heroLiveToggleChaptersBtn controla #heroLiveChaptersPanel. #liveSearchInput, #liveChaptersList atende busca; o contador #liveResultsStatus foi retirado a pedido do usuário. #heroLiveTopicStatus mostra seleção/reprodução. #liveFullscreenBtn amplia o mesmo player.

- [x] Substituir hero/carrosséis e seção redundante da live por estrutura comum; preservar demais seções e o texto local do contato.
- [x] Aplicar gaveta com transform translateX e conteúdo inert quando recolhido, mantendo a aba acessível.
- [x] Corrigir header estreito, navegação duplicada e metadados fictícios; usar links reais à home do evento no subdomínio.
- [x] Incluir arte Kriativa somente após verificar alpha e provenance; manter vídeo e texto como elementos principais.
- [x] Verificar invariantes DOM: 1 h1, 1 #live, 1 #liveChaptersList, 25 checklist IDs e 42 FAQs por língua.

### Task 3: estado, API e falhas

Files: criar assets/js/manual-de-bordo-live.js; remover código legado redundante de assets/js/manual-de-bordo.js.

- [x] Instância única YT.Player vinculada ao iframe com host youtube-nocookie e origin correto; enfileirar o último tempo antes de onReady.
- [x] Renderizar controles nativos, preservar selecionado ao filtrar, atualizar caption e link externo com timestamp.
- [x] Controlar abertura, fechamento, Escape, foco e busca; selecionar assunto recolhe painel sem diminuir vídeo.
- [x] Sincronizar capítulo durante reprodução com timer suspenso quando parado, oculto ou fora de viewport.
- [x] Falha de API conserva alternativa; erro de reprodução informa recuperação. Fullscreen não cria outro áudio/iframe.

### Task 4: testes funcionais e revisão visual

Files: analytics/tests/manual-de-bordo.spec.js e nova suíte analytics/tests/manual-live.spec.js.

- [x] Simular API e iframe: testar seleção antes de pronta e múltiplos cliques, onReady, erro e progresso sem rede YouTube real.
- [x] Medir bounding boxes: vídeo conserva width/height ao abrir; painel avança para a esquerda e sobrepõe vídeo; tab permanece visível ao recolher.
- [x] Verificar teclado, foco, snippets, busca repetida, notice, três línguas, redução de movimento e 320 px sem overflow.
- [x] Executar `node --test server/tests/manual-live.test.mjs`, Playwright focado e regressões existentes adequadas.
- [x] Capturar e abrir desktop/mobile e estados do painel numa rodada, corrigir problemas em lote, confirmar uma vez.
- [x] Passar evidência ao impeccable_finish_reviewer; aplicar achados materiais e pedir veredito dos ajustes.
- [x] Passar resultado ao impeccable_documenter com limite de escrita: somente brief desta superfície, sem reparar drift global.

Evidence: 28 source blocks compared against the supplied transcript, including the two blocks at 00:36:01. 25 browser cases: 24 passed together and the sidebar passed after its test answered the cookie banner; the four reduced-motion viewport cases were rechecked after enforcing immediate transitions. Five Node search/data cases passed. Screenshots are in .impeccable/review, PT 1440×1100 / 390×900 and EN/ES 1440×1100.

The three new Kriativa poses have native alpha and exact generation/edit prompts embedded; embed-prompt scan reported 3 rasters, 0 missing. Playback starts at the first spoken chapter (13:53), and retry resumes the current player position.

The fresh finish reviewer requested removal of the header eyebrow in the three languages. After that change and 12 recaptures, its Verdict Pass marked the finding resolved, remaining clear, disposition ship. This final verdict covers the scored correction. The earlier full review recorded persistence PASS and fidelity MATCH.

The fresh documenter recorded the implemented surface, assets/provenance, interaction, verification and review scope in `.impeccable/surfaces/manual-de-bordo-html.md`. Its result was checked against the implementation evidence. The existing global design documents were preserved; their preexisting font drift was reported without repair.

### Task 5: refinamentos do Manual e publicação autorizada

- [x] Remover contador e vocabulário visível de capítulos; ajustar label/placeholder e aba móvel unida à gaveta.
- [x] Corrigir hovers do header, idiomas e navegação. Retirar declarações obsoletas de gradient-text apontadas pelo hook; nenhuma nova supressão.
- [x] Redesenhar sidebar, corrigir textos/grupos/N/A e sincronizar os dois checklists.
- [x] Ícones de info, categorias discretas e orientação sem título repetido; hover/teclado/toque e fechamento sem sair da lista.
- [x] Formatos próprios de copy/email/WhatsApp/print, estados completos, fallback de clipboard e conteúdo de impressão escapado.
- [x] Rotas limpas no domínio principal e subdomínio, metadados e preferência explícita de idioma.
- [x] Retirar cartão complementar de transporte, aplicar rótulos simples da home e simplificar contato em PT.
- [x] Botões destacados no header de home e ônibus em PT/EN/ES; menu compacto e header de ônibus em duas linhas no celular.
- [x] 39 casos de navegador aprovados (30 casos anteriores e rodada final de 9 casos do checklist); 61 testes de servidor aprovados, incluindo os 8 novos casos de dados/busca/checklist. O setup do checklist passou a declarar cookies opcionais rejeitados, sem depender do momento de abertura do banner.
- [x] Apache: 9 caminhos/hosts retornam 200; seleção automática EN e escolha explícita PT/ES preservadas.
- [x] 45 estados de header (seis páginas, cinco larguras, home antes/depois de scroll) sem sobreposição ou controles fora da janela; hovers brancos e destinos por idioma corretos.
Publicação autorizada: enviar a versão à main pelo workflow existente e verificar sucesso/respostas públicas. Registrar o resultado no brief local e na resposta final após o deploy.

Evidência adicional: `.impeccable/review/refinements-2026-10-04`, `checklist-2026-10-04` e `headers-2026-10-04`. Refinamentos posteriores ao veredito independente inicial foram conferidos pelo agente principal; não se atribui um novo veredito ao reviewer anterior.

Último ajuste do usuário: WhatsApp usa exatamente “☑️ Conferido · 🔲 Pendente · ▪️ Não se aplica” na legenda e os mesmos símbolos nos itens. Verificação adicional dos ícones/categorias em 9 combinações idioma/largura, incluindo toque, sem repetição do título no painel.

Compartilhamento WhatsApp usa `https://api.whatsapp.com/send?text=...` diretamente: o redirecionamento do link curto wa.me substituiu os emojis por U+FFFD na verificação real. A página oficial direta preservou a legenda completa no link de continuação para WhatsApp Web. Cache do módulo atualizado após a correção.
