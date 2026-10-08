# Busca global "Bilhete de embarque" (⌘K / Ctrl+K)

Pedido: aproveitar a ideia da busca do FAQ da home e criar uma busca única para todo o site, cobrindo a home, o busão e o manual de bordo, inclusive a transcrição da live. Ela abre por uma lupa no header ou pelo atalho ⌘K (Mac) / Ctrl+K (Windows), no centro da tela, como o Spotlight do macOS, com a identidade do KOB. PT, EN e ES com paridade total.

Objetivo: a pessoa encontra qualquer informação sozinha e cai no ponto exato, mesmo quando a resposta está em outro subdomínio. Sucesso: tolera erro de digitação e falta de acento, entende sinônimos, mostra a origem de cada resultado e funciona com teclado, no celular e nos três idiomas.

## Decisões aprovadas

- Busca local no navegador, sem IA: só mostra textos que já estão no site.
- ⌘K/Ctrl+K abre a busca global em todas as páginas. A caixa do FAQ continua filtrando a lista da própria página, e o selo "⌘ K" dela passa a abrir a busca global.
- Um resultado da live abre o manual com o vídeo posicionado no minuto do capítulo, pronto para dar play.
- Índice gerado por script e versionado, com teste no CI que falha se ele ficar desatualizado.
- Visual "Bilhete de embarque" (direção C) e botão "Buscar ⌘K" no header (variante B), que vira só o ícone no celular.
- Textos: "Pesquisa no site", "O que você procura?" e "Mais procurados".
- A transcrição da live já foi traduzida (`transcripts.{pt,en,es}`), então o índice EN/ES usa a fala no próprio idioma.

## Arquitetura

As três páginas compartilham o mesmo document root, só mudando o subdomínio. Por isso o índice, servido em `/assets/data/`, está na mesma origem de qualquer página e não depende de CORS.

| Unidade | Arquivo | Responsabilidade |
|---|---|---|
| Gerador | `scripts/build-search-index.mjs` | Lê os 9 HTMLs e `manual-de-bordo-live-data.js` e grava `assets/data/search-index.{pt,en,es}.json`. Comando: `npm run build:search-index`. |
| Sinônimos e destaques | `assets/data/search-synonyms.json` | Grupos de sinônimos por idioma e os 5 "Mais procurados" de cada idioma. Curado à mão. |
| Motor | `assets/js/site-search-engine.js` | Funções puras, sem DOM: prepara o índice, busca, ordena, gera o trecho e devolve os termos a destacar. Reaproveita `searchText`, `normalizeSearch`, `highlightParts` e `excerpt` de `manual-de-bordo-live-search.js`. |
| Interface | `assets/js/site-search.js` + `assets/css/site-search.css` | Botão do header, atalho, `<dialog>`, lista de resultados, navegação por teclado, montagem das URLs e chegada no destino. |

Sem dependência nova: o gerador usa um extrator mínimo próprio, `scripts/lib/html-extract.mjs`, que transforma o HTML em uma árvore leve, ignora `script`, `style` e comentários e trata elementos vazios. Isso basta porque o HTML é do próprio projeto e bem formado, e o extrator tem teste próprio. O site publicado continua sem build e sem dependências.

## Índice

Cada idioma tem um JSON com cerca de 200 entradas no formato:

```json
{ "id": "manual-faq-o08", "page": "manual", "kind": "faq",
  "title": "Qual é o limite de bagagem da MSC?",
  "text": "Por pessoa: duas malas de até 23 kg cada…",
  "keywords": "", "anchor": "#faq-o08", "time": null }
```

- `page`: `home`, `bus` ou `manual`. `kind`: `faq`, `section`, `checklist` ou `live`.
- **FAQ da home (34):** as perguntas ganham ids estáveis `faq-h01`…`faq-h34`, iguais nos 3 idiomas.
- **FAQ do manual (42):** usa os ids existentes (`faq-o01`…).
- **Live (41):** título traduzido, palavras-chave, `transcripts[idioma]` e aviso. Âncora `#live-<segundos>` e `time` = "00:20:50".
- **Checklist do manual:** itens com `data-checklist-id`, com destino `#checklist` (abre a lateral).
- **Seções:** lista explícita no gerador, com seletor e âncora de cada uma:
  - **home:** navio, o que inclui, itinerário, valores, transporte e hospedagem (com os cartões do Busão, dos hotéis e do estacionamento) e parceiros;
  - **manual:** cronograma (cada etapa), jogos (cada bloco) e contato;
  - **busão:** tarifa, como reservar, condições, quórum, cancelamento e horários.
- **Âncoras novas no busão:**
  - `id="como-reservar"` na `.bus-intro`;
  - `id="passageiros"` na `.bus-checkout`;
  - `id="condicoes"` na `.bus-reassurance`;
  - `id="embarque"` no bloco "Transporte completo de ida e volta", que tem o ponto de encontro e os horários.

  Essas âncoras também consertam os links `#embarque` e `#passageiros` do rodapé, que hoje não têm alvo.
- **Fora do índice:** depoimentos, formulário de reserva, cookies, patrocinadores, páginas legais e painel.
- **Paridade:** o mesmo conjunto de `id` existe nos 3 idiomas. Só o texto muda.

## Motor de busca

1. **Normalização:** ignora acentos, caixa e pontuação, com o normalizador da live. Stopwords por idioma (de, da, o, the, el…) só são descartadas se sobrar outra palavra.
2. **Casamento:** cada palavra da consulta precisa casar com alguma palavra da entrada (lógica E). A pontuação de cada casamento é:
   - palavra exata: 1,0;
   - começo de palavra, com 3 letras ou mais: 0,8;
   - um erro de digitação (Damerau-Levenshtein ≤ 1 em palavras de 4 a 7 letras, ≤ 2 em palavras de 8 ou mais): 0,55;
   - via sinônimo: o mesmo valor × 0,9.
3. **Pesos dos campos:** título ×3, palavras-chave ×2, texto ×1. A soma usa o melhor campo de cada palavra.
4. **Bônus:** a consulta inteira aparecendo como frase no título soma +1,5.
5. **Prioridade por tipo:** FAQ do manual 1,0 · FAQ da home 0,95 · seção 0,9 · checklist 0,85 · live 0,8. O manual vem primeiro porque é a referência mais atualizada.
6. **Saída:** até 20 resultados ordenados, cada um com o trecho e as palavras reais que casaram, que são as destacadas. O índice é preparado uma vez, e cada tecla custa menos de 5 ms.

## Interface: Bilhete de embarque

- **Estrutura:** `<dialog>` com `showModal()`. O canhoto azul-marinho, com faixa dourada à esquerda, mostra "Pesquisa no site" e o campo em Gobold grande. Um picote tracejado com recortes laterais separa o corpo, onde ficam os resultados.
- **Cada resultado:** pergunta ou título em Montserrat 700, trecho de até duas linhas e o destino à direita, com um rótulo pequeno e o nome em Gobold:
  - PT: destino Manual, destino Busão, destino Home, live 24:13;
  - EN: go to Guide / Busão / Home, live 24:13;
  - ES: destino Guía / Busão / Inicio, live 24:13.
- **Destaque:** termos casados em dourado. O ativo leva fundo dourado translúcido e um filete à esquerda.
- **Sinônimo:** quando ele foi usado, aparece a linha "Mostrando resultados para mala e bagagem".
- **Antes de digitar:** "Mais procurados" com 5 atalhos, cada um com o seu destino.
- **Sem resultado:**
  - mensagem "Nada sobre “patinete” no site.";
  - "Tente uma palavra mais geral, ou um destes assuntos:" com três termos clicáveis;
  - "Perguntar à Royal Trip no WhatsApp", com o número e a mensagem pré-preenchida no idioma da página.
- **Falha ao carregar o índice:** "Não foi possível carregar a busca. Verifique a conexão e tente de novo.", com o botão "Tentar de novo".
- **Desktop:** largura `min(680px, 92vw)`, a 12vh do topo, com os resultados rolando até 60vh. O rodapé mostra ↑↓ navegar, ↵ abrir e esc fechar.
- **Celular (≤ 640px):** tela inteira. O canhoto tem "Fechar" à direita, os atalhos de teclado somem e o teclado do celular abre com o cursor no campo.
- **Movimento:** ao abrir, o fundo escurece em 160 ms e o bilhete sobe 16px com escala de 0,98 para 1, em 260 ms (`--ease-expo`). O corpo "destaca" do canhoto 40 ms depois. Ao fechar, o movimento se inverte em 160 ms. Com movimento reduzido, fica só a opacidade.
- **Tokens:** `--ocean-abyss`, `--ocean-navy`, `#0a3a68`, `--sunset-gold`, Gobold Extra2 e Montserrat. Todos vêm de `main.css`, que as 3 páginas já carregam.

## Atalho e botão no header

- **Botão estático nos 9 HTMLs:**
  - home: em `.nav__right`, antes dos idiomas;
  - manual: em `.guide-header__actions`, antes dos idiomas;
  - busão: em `.bus-header__right`, antes dos idiomas.
- **Formato do botão:** `<button class="site-search-trigger" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K">`, com o ícone, "Buscar" / "Search" / "Buscar" e o `<kbd>`. No celular, fica só o ícone com `aria-label`.
- **Atalho:** o `<kbd>` mostra "⌘ K" em Mac e iOS e "Ctrl K" nos outros sistemas. ⌘K/Ctrl+K abre e fecha a busca de qualquer ponto da página, com `preventDefault`.
- **Atalhos antigos:** saem os de `main.js` (linha ~2878) e `manual-de-bordo.js` (linha ~869). O `<kbd>` da caixa do FAQ (home e manual, 3 idiomas) vira um botão que abre a busca global e mostra a tecla da plataforma.

## Destino de cada resultado

- **Montagem da URL:** o índice guarda só `page` + `anchor`. O idioma vem do `lang` da página atual.
  - Produção: `https://kriativosonboard.com.br{/en|/es}/`, `https://busao.kriativosonboard.com.br{/en|/es}/` e `https://manualdebordo.kriativosonboard.com.br{/en|/es}/`.
  - Local (localhost/127.0.0.1): `{/en|/es}/`, `{/en|/es}/onibus.html` e `{/en|/es}/manual-de-bordo.html`.
- **Mesma página:** fecha o bilhete, atualiza o hash e vai direto, sem recarregar.
- **FAQ:** abre o `<details>`, limpa o filtro do FAQ se ele esconder o item, rola até ele, foca o `summary` e dá um destaque de 2 s. No manual, aproveita o `checkHashTarget` existente. Na home, a chegada por hash entra em `main.js`.
- **Live (`#live-<s>`):** `manual-de-bordo-live.js` seleciona o capítulo, rola até o vídeo e faz o botão "Assistir" começar naquele minuto.
  - Na mesma página, o clique conta como gesto do usuário, então um `CustomEvent('kob:live-seek', { detail: { seconds } })` chama `playAt` e o vídeo toca na hora.
  - Vindo de outro subdomínio, o navegador não deixa tocar com som sozinho, e a pessoa aperta o play.
- **Checklist (`#checklist`):** abre a lateral, pelo `openFromHash` existente.

## Acessibilidade

- **Padrão combobox:** o campo tem `role="combobox"`, `aria-expanded`, `aria-controls` e `aria-activedescendant`. A lista é `role="listbox"` e cada item é `role="option"`, com `aria-selected`.
- **Região viva:** uma `aria-live="polite"` anuncia "4 resultados" e equivalentes.
- **Foco:** o `<dialog>` modal prende o foco e torna o fundo inerte. Esc fecha e devolve o foco ao botão que abriu.
- **Visual:** foco visível no padrão do site, contraste AA em texto e selos, e alvos de toque de 44 px no celular.
- **Segurança:** os resultados são montados com `textContent` e nós de destaque, sem `innerHTML` com conteúdo do índice ou da consulta.

## i18n

Todo texto visível existe em PT, EN e ES: botão, `aria-label`, canhoto, campo, "Mais procurados", rótulos de destino, mensagens, rodapé de atalhos e a mensagem do WhatsApp. O texto fica num dicionário `pt/en/es` em `site-search.js`, escolhido por `document.documentElement.lang`, no padrão dos outros módulos. O glossário do projeto vale para os termos: Onboard Guide / Guía de a bordo; "Busão" é nome de marca.

## Testes

- **`server/tests/html-extract.test.mjs`:** texto de `details` e `summary`, elementos vazios, entidades (`&amp;`, `&nbsp;`) e omissão de `script`/`style`.
- **`server/tests/search-index.test.mjs`:**
  - regenera o índice em memória e exige igualdade com os JSONs versionados;
  - exige ids únicos e o mesmo conjunto de ids nos 3 idiomas;
  - exige que cada âncora exista no HTML de destino;
  - confere as contagens (34 + 42 FAQs e 41 capítulos por idioma).
- **`server/tests/site-search-engine.test.mjs`:**
  - acentos, typo ("bagajem" acha bagagem), prefixo, sinônimo ("mala" acha bagagem), lógica E e stopwords;
  - ordem (FAQ do manual acima da live para "bagagem");
  - consultas em EN e ES;
  - trecho e destaques sem fabricar HTML.
- **`analytics/tests/site-search.spec.js` (Playwright):**
  - botão e ⌘K/Ctrl+K nas 3 páginas e nos 3 idiomas;
  - setas e Enter; mesma página (FAQ abre); URL de outra página no formato local;
  - live (`#live-…` pré-seleciona o capítulo); Esc devolve o foco;
  - celular a 375px em tela inteira; movimento reduzido;
  - estados vazio e de falha (rota do índice interceptada); sem erros no console.
- Os testes existentes de FAQ e live continuam passando, junto com `npm run validate:analytics`.

## Fora do escopo

- Eventos de analytics da busca. As consultas podem conter dados pessoais, então isso fica para uma etapa própria, com a allowlist do GTM.
- Busca nas páginas legais e no painel.
- Resposta gerada por IA.
- Os textos do FAQ EN/ES do manual, que estão pendentes no Lote 3 da localização.

## Decisões de implementação

Ajustes feitos durante a implementação, depois das revisões de cada etapa:

- **Lógica E com folga:** a lógica E continua sendo a regra. Quando ela não acha nada e a consulta tem 3 palavras ou mais, a busca aceita resultados em que falte 1 palavra. Assim, perguntas escritas por extenso ("como funciona o pacote de bebidas") não caem no estado vazio.
- **Palavras ignoradas:**
  - as stopwords saem da consulta antes do limite de 8 palavras;
  - a lista inclui verbos e palavras de pergunta comuns ("quanto custa", "how much", "cuánto cuesta").
- **Erros de digitação:**
  - a busca só tenta corrigir uma palavra que não existe no índice nem como começo de outra palavra. Senão, "quanto" virava "quando";
  - plurais simples acham o singular ("bagagens" acha bagagem).
- **Sinônimos:** valem por palavra inteira. Também valem como começo de palavra, mas só a partir de 5 letras, porque "car" achava "card".
- **Atalho:** ⌘K em Mac e iOS, Ctrl+K nos demais sistemas, cada um só com a sua tecla. No Mac, Ctrl+K continua apagando até o fim da linha. Esc fecha só o bilhete e não chega ao banner de cookies.
- **Âncoras:**
  - cada etapa do cronograma aponta para o seu grupo;
  - os cards de preço apontam para a própria aba (`#panel-cabines`, `#panel-bebidas`), e a chegada seleciona a aba antes de rolar.
- **Chegada:**
  - o destino para abaixo do header fixo (`scroll-margin-top`), e a pergunta do FAQ recebe o foco;
  - quando a rolagem suave termina, o destino é realinhado uma vez, porque o layout acima ainda pode se acomodar logo depois do carregamento.
- **Header:**
  - na home rolada, entre 1321 e 1679 px, a lupa fica só com o ícone e o link do manual perde o "Confira o", para o botão de reserva caber;
  - no busão e no manual, até 480 px, a lupa tem 32 px. Isso atende o WCAG 2.5.8 AA, e 44 px não cabem a 320 px;
  - o selo "⌘ K" do FAQ some até 620 px, como o `kbd` que ele substituiu.
