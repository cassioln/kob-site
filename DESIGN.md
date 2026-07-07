<!-- Documenta a UI implementada. Paleta = cores do LOGO Kriativos On Board: ciano (#00aeef, base/água/links), roxo (#7b1fa2, AÇÃO/CTA), magenta (#e5007e, acento quente), laranja/dourado (#f7941e/#ffc20e, brilho lúdico). Re-rodar /impeccable document após grandes mudanças de UI. -->
---
name: Kriativos On Board 2026
description: Cruzeiro imersivo de jogos de tabuleiro em alto-mar — landing de campanha
colors:
  ocean-abyss: "#041d3a"
  ocean-navy: "#082f57"
  ocean-blue: "#00aeef"
  ocean-cyan: "#29c3f5"
  kriativa-purple: "#7b1fa2"
  kriativa-purple-deep: "#57127a"
  kriativa-magenta: "#e5007e"
  magenta-glow: "#ff5aa8"
  sunset-gold: "#ffc20e"
  sunset-deep: "#f7941e"
  dark-abyss: "#041d3a"
  dark-navy: "#082f57"
  foam-white: "#ffffff"
  mist-100: "#eef4fb"
  slate-ink: "#1b2740"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', 'Garage Gothic FB', system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 8vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Hanken Grotesk', 'Overpass', system-ui, sans-serif"
    fontSize: "clamp(1rem, 1.1vw, 1.125rem)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Hanken Grotesk', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "28px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.kriativa-purple}"
    textColor: "{colors.foam-white}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.kriativa-purple-deep}"
    textColor: "{colors.foam-white}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foam-white}"
    rounded: "{rounded.pill}"
    padding: "16px 36px"
  card-price:
    backgroundColor: "{colors.slate-ink}"
    textColor: "{colors.foam-white}"
    rounded: "{rounded.lg}"
    padding: "32px"
---

# Design System: Kriativos On Board 2026

## 1. Overview

**Creative North Star: "O Convés ao Entardecer"**

Um cruzeiro de board games não é um pacote turístico — é uma tribo se reunindo em
alto-mar. O sistema visual persegue a sensação de estar no convés de um navio no
fim de tarde: o azul profundo do oceano e da noite que chega, cortado pelo dourado
quente do pôr do sol. Imersivo, cinematográfico e caloroso, com a energia de um
grande festival. As seções chegam como cenas: imagens full-bleed do navio e do
mar, texto forte por cima, e o movimento revela a jornada conforme se rola a
página — como quem embarca.

O sistema rejeita explicitamente o que veio antes: o **template WordPress genérico
e datado** (page builder WPBakery, tema Emojination), com suas caixas empilhadas,
sombras cinzas e tipografia acidental. Também rejeita o **visual corporativo e frio
de operadora de cruzeiro tradicional** — nada de institucional sem alma. E rejeita
a **poluição visual**: apesar da energia cinematográfica, todo movimento tem
propósito narrativo e nunca compete com a leitura ou com o caminho até a reserva.

**Key Characteristics:**
- Superfície dominada pelo azul-marinho profundo (oceano/noite) com o roxo da marca (#71206c) em degradês, seções e como voz de ação e conversão; o dourado do pôr do sol entra só como brilho atmosférico pontual no hero.
- Imagens em full-bleed com overlays; o navio e o mar são protagonistas.
- Tipografia display condensada e monumental, cara de cartaz de evento.
- Movimento coreografado e revelações ao rolar; parallax sutil de mar/navio.
- Mobile-first e rápido: a decisão de compra acontece no celular.

## 2. Colors

Uma paleta extraída diretamente do logo do Kriativos On Board: o ciano vibrante do lettering "on Board" como base atmosférica (oceano/água), o roxo de "Kriativos" como cor de ação/identidade, e o magenta/laranja/dourado dos dados e meeples como acentos de energia lúdica.

### Primary
- **Ocean Navy** (#082f57): base da maior parte das superfícies e seções escuras — o "mar à noite", agora puxado ao azul-ciano do logo.
- **Ocean Abyss** (#041d3a): tom mais profundo para fundos de topo/rodapé, sobreposições sobre imagens e o degradê de profundidade do oceano.
- **Ocean Blue / Cyan** (#00aeef, claro #29c3f5): o CIANO do logo. Links, ícones, detalhes de água, realces sobre o navy e o anel de foco. Nunca vira CTA de reserva — a ação é sempre roxo.
- **Kriativa Purple** (#7b1fa2): o roxo do lettering "Kriativos". Cor de AÇÃO e identidade: fundo dos CTAs, faixas dos cards de preço, seções de comunidade/festas. Dá a alma nerd/lúdica que separa o site de uma operadora de cruzeiro comum.
- **Kriativa Purple Deep** (#57127a): tom mais escuro do roxo para profundidade em degradês e estados sobre o roxo.

### Secondary
- **Kriativa Magenta** (#e5007e): o rosa-magenta do dado do logo. Acento de urgência/energia (destaques quentes pontuais). Contraste AA com branco.
- **Sunset Gold** (#ffc20e) e **Sunset Deep / Orange** (#f7941e): o dourado e o laranja dos dados/meeples do logo. Brilho lúdico e atmosférico — usados como preenchimento com texto ESCURO (ex.: flag "melhor preço") ou como brilho no hero. Nunca como texto sobre branco.

### Neutral
- **Foam White** (#ffffff): texto sobre superfícies escuras e superfícies claras de respiro.
- **Mist 100** (#eef4fb): fundo das seções claras (contraponto de respiro entre blocos imersivos escuros).
- **Slate Ink** (#1b2740): fundo de cards escuros (preços, dados do navio) e texto sobre superfícies claras.

### Named Rules
**A Regra da Voz Única da Ação.** O roxo do logo (#7b1fa2) é a cor de ação: fundo dos CTAs. No CTA final, sobre a superfície roxa, o botão inverte para fundo branco/tinta roxa para não se camuflar. Ciano nunca vira CTA.
**Papéis semânticos das cores do logo.** Cada cor do logo tem uma voz fixa: **ciano** = informação/realce e links (eyebrows informativos, autores, ícones "incluso", stats — a "água"); **roxo** = ação/identidade (CTAs, headers de card); **magenta** (#ff5aa8 sobre escuro, #e5007e sobre claro) = urgência/escassez (eyebrows de lote/"vagas limitadas", tags "esgotado"); **dourado/laranja** = destaque lúdico pontual (flag "melhor preço", eyebrow do CTA final).
**A Regra da Art Direction "Convés ao Entardecer".** As seções alternam cenas ESCURAS imersivas (navy/abyss — evento, incluso, valores, depoimentos, participações, parceiros, CTA final), onde as cores do logo brilham, com RESPIROS CLAROS (navio, informações, hospedagem, FAQ) para leitura longa e fotos. O ritmo escuro↔claro evita bloco monótono e recupera a atmosfera de pôr do sol no mar.

## 3. Typography

**Display Font:** Bricolage Grotesque (fallback Garage Gothic FB, system-ui) — grotesca contemporânea com um quê de imperfeição charmosa e caráter lúdico; foge do cartaz condensado óbvio sem perder impacto.
**Body Font:** Hanken Grotesk (fallback Overpass, system-ui) — sans humanista limpa, calorosa e muito legível em pt-br e no mobile.
**Label Font:** Hanken Grotesk em caixa alta com tracking largo.

**Character:** O contraste é de personalidade x clareza: uma display grotesca cheia de caráter (títulos que têm cara de evento com alma nerd) equilibrada por um corpo humanista tranquilo, que deixa datas, o que está incluso e preços respirarem e serem fáceis de ler no celular. É a antítese do template WordPress com tipografia acidental.

### Hierarchy
- **Display** (800, clamp(2.75rem, 8vw, 6rem), line-height 0.98, tracking -0.02em): heros e aberturas de seção.
- **Headline** (700, clamp(1.75rem, 4vw, 3rem), line-height 1.05): títulos de seção (Itinerário, O Navio, Valores).
- **Title** (700, ~1.25rem, line-height 1.2): nomes de cards (DUPLA, TRIPLA, Dados do Navio).
- **Body** (400, clamp(1rem, 1.1vw, 1.125rem), line-height 1.6): textos corridos; largura máx ~65–70ch. Sobre navy, subir para 450–500 de peso e +0.06 no line-height.
- **Label** (700, 0.8125rem, letter-spacing 0.14em, UPPERCASE): eyebrows pontuais, tags de lote, rótulos de CTA.

### Named Rules
**A Regra do Cartaz.** Todo título display é grande e com peso alto (800). Se um cabeçalho parecer um parágrafo, ele está errado — display é para impacto, não para explicação.
**A Regra da Voz Única de Título.** Uma só família display (Bricolage) em toda a página. Nada de introduzir uma segunda display "decorativa" por seção.

## 4. Elevation

Sistema majoritariamente plano e imersivo: a profundidade vem de **camadas de imagem, degradês oceânicos e sobreposições**, não de sombras cinzas empilhadas (isso é justamente o "cheiro" do template WordPress antigo). Sombras existem só como resposta a estado (hover) e sob os CTAs roxos, para dar calor à ação.

### Shadow Vocabulary
- **Glow de ação** (`box-shadow: 0 12px 40px rgba(113,32,108,0.55)`): brilho roxo sob CTAs no hover e sob o contador — o calor da marca.
- **Lift de card** (`box-shadow: 0 20px 60px rgba(8,26,51,0.55)`): elevação sutil de cards de preço no hover, sempre em tom oceânico (nunca cinza neutro).

### Named Rules
**A Regra do Plano por Padrão.** Superfícies são planas em repouso. Sombra só aparece como resposta a interação (hover/foco) ou para dar calor à ação roxa. Sombra cinza difusa de card estático é proibida — é a assinatura do visual datado que estamos abandonando.

## 5. Components

### Buttons
- **Shape:** totalmente arredondado / pill (999px).
- **Primary:** fundo Kriativa Purple (#71206c), texto branco, padding 16px 32px. É o botão "Reservar / Garantir vaga".
- **Hover / Focus:** fundo vira Kriativa Purple Deep (#571552), texto branco, leve translateY(-2px) e glow de ação roxo. Foco visível com anel de 2px em Ocean Blue.
- **Ghost:** transparente, borda 1px branca translúcida, texto branco. Ações secundárias sobre imagem (ex: "Conhecer o navio").

### Chips
- **Style:** pill, fundo translúcido sobre navy, texto branco, label caixa alta. Usado para lotes (1º LOTE, 2º LOTE) e tags de atividade (RPG, Torneios).
- **State:** lote ativo ganha preenchimento Kriativa Purple; lotes/cabines esgotados ficam esmaecidos com tarja neutra.

### Cards / Containers
- **Corner Style:** 28px (lg) para cards de preço; 16px (md) para cards de conteúdo.
- **Background:** Slate Ink (#1b2740) sobre seções escuras; branco sobre seções claras (Mist).
- **Shadow Strategy:** plano em repouso; lift oceânico só no hover (ver Elevation).
- **Border:** hairline translúcida quando sobre imagem.
- **Internal Padding:** 32px (lg) em cards de preço.

### Inputs / Fields
- **Style:** fundo translúcido sobre navy, borda 1px translúcida, radius md (16px), texto branco.
- **Focus:** borda vira Ocean Blue + leve glow; nunca só mudança de cor sem indicação de foco.

### Navigation
- **Style:** header sticky transparente sobre o hero que ganha véu navy translúcido com blur ao rolar; logo à esquerda, âncoras no centro/direita, CTA roxo "Garantir vaga" sempre visível.
- **States:** link em branco, hover em Ocean Blue, âncora ativa realçada em roxo claro.
- **Mobile:** menu drawer full-screen navy com CTA roxo grande ao final.

### Contador Regressivo (signature)
Bloco de contagem para nov/2026 em cards escuros com números em display (Bricolage 800) e glow roxo sutil. Anima a virada dos dígitos. É o pulso de urgência da página.

## 6. Do's and Don'ts

### Do:
- **Do** usar imagens full-bleed do navio e do mar com overlay Ocean Abyss para garantir contraste do texto (WCAG AA).
- **Do** reservar o roxo da marca para ação: reservar (#71206c) e preço/contador/eyebrows como roxo claro (#c47cb6). Ação com parcimônia, sempre ligada a "aja agora".
- **Do** títulos em display Bricolage Grotesque peso 800 para dar cara de grande evento/festival.
- **Do** movimento coreografado com propósito: revelações ao rolar, parallax sutil de mar/navio, virada de dígitos do contador — sempre com fallback estático para `prefers-reduced-motion`.
- **Do** projetar mobile-first: CTA de reserva sempre alcançável (sticky), preços legíveis no celular.

### Don't:
- **Don't** parecer um **template WordPress genérico**: caixas empilhadas de page builder, sombras cinzas difusas em cards estáticos, tipografia acidental. É exatamente o que estamos abandonando.
- **Don't** parecer **agência de viagem / operadora de cruzeiro corporativa**: visual institucional, frio, sem a alma da comunidade de board games.
- **Don't** poluir com animação por animação: nada de movimento que compita com a leitura ou atrase o caminho até a reserva.
- **Don't** usar azul (Ocean Blue) nem dourado como cor de botão de reserva — CTA de conversão é sempre roxo (#71206c).
- **Don't** empilhar sombra cinza neutra em card estático (a assinatura do visual datado).
