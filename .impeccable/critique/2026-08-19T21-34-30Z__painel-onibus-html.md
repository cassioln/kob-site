---
target: <div id=\"aba-frota\"> em painel-onibus.html
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-19T21-34-30Z
slug: painel-onibus-html
---
## Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Barra de progresso e assentos visuais excelentes; falta feedback de capacidade restante em tempo real durante o arraste |
| 2 | Match Between System and Real World | 3 | Planta do ônibus (2x2 com corredor) reflete o mundo real; termo 'pax' nos cards é jargão técnico |
| 3 | User Control and Freedom | 3 | Arraste livre entre ônibus e adição de frota; falta botão de desfazer (Undo) para movimentações acidentais |
| 4 | Consistency and Standards | 3 | Componentes de cards e badges coesos; controle de VIPs no header parece solto do grid principal |
| 5 | Error Prevention | 3 | Trava de 46 lugares atua no backend; dropzone deveria desabilitar visualmente quando o grupo exceder o limite |
| 6 | Recognition Rather Than Recall | 3 | Identificação clara de grupos, responsáveis e contagens em cada card |
| 7 | Flexibility and Efficiency of Use | 2 | Apenas movimentação individual de reserva inteira; sem suporte a divisão de grupo ou seleção em lote |
| 8 | Aesthetic and Minimalist Design | 3 | Tipografia limpa e ótimo contraste; assentos visuais e cards podem ter hierarquia e micro-interações mais refinadas |
| 9 | Help Users with Errors | 3 | Modal moderno com mensagens de erro claras sobre lotação restante |
| 10 | Help and Documentation | 2 | Regra de 40/46 explicada no subtítulo, mas sem detalhamento interativo sobre lugares flexíveis e VIPs |
| **Total** | | **28/40** | **Bom / Promissor** |

## Design Specificity Verdict
**Operate Mode (Admin/Gestão)**: A aba de frota tem uma proposta de valor extremamente clara e personalizada para o evento Kriativos On Board, utilizando metáfora visual de assentos de ônibus e controle de ponto de equilíbrio financeiro (40 vs 46 lugares).
A interface não é genérica, mas ainda possui oportunidades de refinamento de micro-UX para operações sob pressão (ex: no dia do embarque ou no fechamento do contrato do fretado).

## Priority Issues
- **[P1] Falta de indicação visual prévia de capacidade ao arrastar**: Ao segurar um card de 4 passageiros, o organizador só descobre que o ônibus de destino está sem espaço após soltar o card e receber o modal de erro.
  - *Fix*: Durante o `dragover`, colorir o card de destino em vermelho suave ou exibir um badge temporário `-X vagas` se o grupo não couber.
  - *Comando sugerido*: `/impeccable polish`
- **[P1] Controle de VIPs isolado visualmente**: O input numérico de VIPs fica no cabeçalho superior e parece uma configuração global abstrata, enquanto os cards VIP são injetados diretamente nos ônibus.
  - *Fix*: Integrar o controle de VIPs como uma barra de ação com contexto claro ou permitir adicionar/remover VIP diretamente no card do ônibus desejado.
  - *Comando sugerido*: `/impeccable layout`
- **[P2] Jargão 'pax' e ausência de atalhos rápidos**: O uso do termo 'pax' nos cards de passageiros confunde operadores novatos e a falta de ação rápida (ex: botão de transferir com 1 clique) obriga o uso exclusivo de drag-and-drop.
  - *Fix*: Substituir 'pax' por 'pessoas' ou 'lugares' e adicionar menu de contexto / clique para mover.
  - *Comando sugerido*: `/impeccable clarify`
