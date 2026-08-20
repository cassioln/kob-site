# Revisão visual da aba Frota — Painel de despacho híbrido

## Objetivo

Revisar visualmente a aba Frota do painel administrativo para equilibrar leitura operacional e identidade visual do Kriativos On Board. A tela deve continuar sendo uma ferramenta de conferência e movimentação de grupos, mas com hierarquia mais clara, estados mais fáceis de interpretar e uma composição responsiva para desktop, tablet e celular.

## Direção aprovada

O “Painel de despacho híbrido” usa a ideia de planta baixa como um mapa compacto de ocupação no cabeçalho de cada ônibus, removendo a estrutura decorativa de cockpit, janelas, WC e traseira. A área de grupos passa a ser o centro da operação, organizada como uma unidade operacional por ônibus.

O visual usa a linguagem já estabelecida no painel: fundo claro azulado, superfícies brancas, azul-marinho para informação, roxo reservado para ação/seleção e cores semânticas para sucesso, alerta e erro. A identidade da marca aparece em detalhes controlados, sem transformar a ferramenta em uma página promocional.

## Composição

### Cabeçalho da Frota

- Manter o título “Distribuição de Passageiros”.
- Resumir a explicação de capacidade e meta mínima para uma leitura mais direta.
- Manter o controle de VIPs no mesmo contexto da Frota, em bloco compacto e facilmente localizável.
- Destacar visualmente a diferença entre configuração de VIPs e operação diária de alocação.

### Orientação operacional

Adicionar uma orientação curta e discreta explicando que grupos podem ser arrastados entre ônibus. A legenda de estados deve usar os mesmos tons semânticos dos cards, sem criar uma nova camada de navegação.

### Lista de ônibus

Cada ônibus será tratado como uma unidade operacional ampla, com:

- identificação e status no cabeçalho;
- ocupação atual e capacidade total;
- mapa compacto de ocupação com até 46 assentos, preenchidos conforme a lotação;
- corte vertical persistente na posição da meta mínima, com a etiqueta “META 40”;
- quantidade de vagas livres;
- grupos organizados em uma área operacional simples e legível;
- vagas livres representadas como espaço disponível, sem competir com reservas;
- ação de adicionar ônibus visualmente separada dos ônibus existentes.

O mapa de ocupação é um indicador de lotação, não um estado de carregamento. Os assentos ocupados são preenchidos, os livres permanecem neutros e o corte da meta fica visível mesmo quando ainda não foi alcançado. Os textos numéricos permanecem abaixo dele para garantir precisão e acessibilidade.

## Estados e interações

Todos os eventos, endpoints e regras atuais permanecem inalterados.

- **Em aberto:** aparência neutra, corte “META 40” visível e mensagem “Faltam X para fechar”.
- **Contratado:** destaque verde controlado, marcador da meta confirmado e mensagem “Meta de fechamento atingida”.
- **Lotado:** sinalização semântica de capacidade esgotada, zero vagas e mensagem “Lotação máxima atingida”.
- **Destino válido no arraste:** contorno roxo e área de destino clara.
- **Destino inválido:** contorno vermelho, sem deslocamento ou animação excessiva.
- **Grupo arrastado:** redução de opacidade e cursor de movimentação.
- **Grupo VIP:** destaque dourado reservado à identificação; não exibir o badge de tamanho “1 VIP”.
- **Seletor de movimentação:** estados de hover, foco e seleção consistentes com o painel.
- **Tooltip:** continuar disponível, com contraste e posicionamento revisados; também deve aparecer quando o conteúdo tiver foco.
- **Controle de VIPs:** preservar os estados atual, alterado, salvando, salvo por recarregamento e erro.
- **Adicionar ônibus:** manter como ação secundária e distinta da lista operacional.

## Responsividade

### Desktop

- Mapa de ocupação em duas linhas de assentos, dimensionado para a capacidade do ônibus.
- Corte vertical e etiqueta “META 40” alinhados à posição de 40 assentos.
- Cabeçalho do ônibus em uma linha quando houver espaço.
- Grupos em colunas com largura suficiente para nome, código e seletor.
- Controle de VIPs ao lado da informação contextual.

### Tablet

- Cabeçalho da Frota pode quebrar em duas áreas.
- Mapa de ocupação permanece em duas linhas, com redução controlada do espaçamento.
- O corte da meta continua visível sem depender apenas da cor.
- Conteúdo não pode ser cortado nem exigir rolagem horizontal.

### Celular

- Cabeçalho da Frota empilhado.
- Controle de VIPs ocupa a largura disponível.
- Mapa de ocupação reorganizado em duas linhas compactas, sem rolagem horizontal.
- A etiqueta da meta permanece legível em telas estreitas.
- Grupos em linhas completas, sem nomes ou selects comprimidos.
- Botões e selects com área de toque confortável.
- Respeito a `prefers-reduced-motion`.

## Limites de implementação

- Preservar os IDs, classes consumidas pelo JavaScript, listeners, endpoints, payloads e validações de lotação.
- Priorizar alterações em `assets/css/painel-onibus.css`.
- Ajustar `assets/js/painel-onibus.js` para substituir a barra de progresso e a estrutura decorativa por um mapa gerado com a capacidade dinâmica do ônibus. A alteração fica limitada à apresentação gerada — assentos, ícones, atributos de acessibilidade ou classes — sem alterar dados, eventos, chamadas de API ou fluxo de recarregamento.
- Não criar uma nova biblioteca de ícones, dependência, framework ou imagem.
- Manter o rodapé e o cabeçalho global já revisados fora do escopo desta aba.

## Critérios de aceitação

1. A aba Frota mantém o fluxo de login, carregamento e renderização dos dados.
2. O valor de VIP pode ser editado e salvo pelo mesmo endpoint atual.
3. Grupos continuam podendo ser movidos por arraste e pelo seletor “Mover para”.
4. A validação de capacidade continua impedindo destinos inválidos e exibindo o modal atual.
5. O mapa de ocupação representa corretamente assentos ocupados, livres e a meta mínima de 40 lugares, com corte e etiqueta “META 40”.
6. A mensagem de progresso usa “Faltam X para fechar”, muda para “Meta de fechamento atingida” ao alcançar o mínimo e para “Lotação máxima atingida” ao atingir a capacidade.
7. Ônibus em aberto, contratado, lotado, destino válido, destino inválido, grupo arrastado e VIP são visualmente distinguíveis.
8. O badge de tamanho “1 VIP” não aparece para reservas VIP.
9. A tela não apresenta overflow horizontal em desktop, tablet ou celular.
10. Foco de teclado e contraste permanecem visíveis e legíveis.
11. A inspeção visual cobre desktop e mobile, com capturas salvas em `.impeccable/review/`.
12. A sintaxe JavaScript, as verificações estáticas existentes e os testes do projeto são executados antes da entrega.

## Arquivos previstos

- Modificar: `assets/css/painel-onibus.css` — composição, estados e responsividade da aba Frota.
- Modificar somente se necessário: `assets/js/painel-onibus.js` — apresentação gerada, sem mudança de lógica.
- Não modificar: APIs, servidor, dados, endpoints ou regras de negócio.
