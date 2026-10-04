# Manual de Bordo — hero e navegação da live

Pedido: melhorar a branch feat/embarcados-guia-bordo-2026, com prioridade para uma hero profissional e dinâmica; assuntos deslizam para a direita até formar uma aba e abrem para a esquerda sobre o vídeo. Conferir tempos, transcrição indexada, palavras, busca e estados. Preservar a identidade da home/ônibus e a alteração local do usuário no título de contato.

Direção autorizada pelo pedido: extensão da identidade atual, com vídeo amplo, gaveta funcional, Gobold/Montserrat, azul profundo e ações roxas. Em vez de carrosséis diferentes entre idiomas, uma hero comum PT/EN/ES, com Kriativa discreta e informações essenciais sem selo fictício de confirmação.

Interação: gaveta recolhida com aba visível; abertura via transform, Escape/fechar retornam foco; selecionar um assunto recolhe a gaveta e mostra o assunto escolhido. Em tela estreita, o painel abre sobre o vídeo com altura suficiente para a busca e rolagem. Reduced motion mantém estados imediatos. Nenhum conteúdo depende de autoplay da hero.

Conteúdo: 28 assuntos confrontados com a transcrição fornecida. Indexar o texto real; separar correções editoriais de fala original. Busca em títulos traduzidos, palavras-chave e texto original em português; múltiplos termos, acentos, pontuação e snippets seguros. Não apresentar um resumo inventado como citação. Avisos explícitos para bagagem, gestação, seguro, escala, itens e clubinho.

Player: carregar terceiros somente após ação explícita de assistir/escolher assunto. Informar YouTube antes dessa ação, independentemente do consentimento de analytics, que é outro serviço. Instância única com API oficial, fila até onReady, trecho selecionado preservado, estado atual sincronizado enquanto visível/em reprodução. Falha tem recuperação e link ao trecho no YouTube. Assistir inicia nas boas-vindas (13:53); tentar novamente preserva o ponto da reprodução. Ampliar usa fullscreen nativo; remover player modal duplicado e suas minutagens incorretas.

Limites: não alterar FAQ da home, checkout, reserva, backend ou condições comerciais. Publicação na main autorizada pelo usuário após a conferência final. Preservar 42 respostas e 25 itens; remover somente o cartão complementar de recursos de viagem solicitado. Não expor dados pessoais. Manter o rótulo local do usuário “Fale com a Organização”.

Verificação: testes de dados contra o anexo, busca/Unicode/HTML malicioso, DOM em três idiomas, overlay sem redimensionar vídeo, foco/teclado, iframe pronto/tardio/falha, active state, reduced motion, 320–1440 px, sem JS, checklist e suporte simulado. Inspeção visual desktop/mobile em uma rodada agrupada, correção em lote e confirmação. Revisão independente e documentação pela skill impeccable.

## Refinamentos solicitados e autorizados

Aba “Assuntos” de 52 × 190 px (176 px no celular), roxa, solidária à gaveta: os dois elementos se movem juntos, deixando a aba à esquerda do painel aberto. Remover a contagem visível, usar “Busque na live:” e exemplo “Ex.: embarque, jogos, festas…”. Localizar o vocabulário de assuntos, corrigir contraste/hover dos controles do header e preservar a caixa do vídeo.

Checklist principal e lateral compartilham os mesmos 25 itens, estados e grupos. Sidebar clara com cabeçalho navy e Kriativa existente. Ícone de informação no canto superior direito; categorias em texto discreto, sem fundo/borda. Hover/foco/toque mostram o conteúdo correspondente do FAQ em um painel rolável, sem navegar e sem repetir o texto do item como título. Teclado/Escape/fechar mantêm foco e não fecham a lista indevidamente. Toque abre somente ao concluir a ativação para evitar alteração de alvo durante o evento.

Copiar usa [x]/[ ]/[—]; email usa saudação, seções e status por extenso; WhatsApp usa ☑️/🔲/▪️ e títulos próprios; impressão usa documento A4 com caixas e status. Todas as opções incluem os 25 itens e suas marcas, mesmo quando há filtro ativo. Clipboard bloqueado oferece texto selecionável; email/WhatsApp preparam o conteúdo, e o envio depende do usuário.

Adicionar /manualdebordo, /en/manualdebordo e /es/manualdebordo sem retirar o subdomínio. Canonical/alternates/metadados e troca de idioma acompanham a rota. Remover o cartão complementar de transporte. Rótulos das seções usam a tipografia eyebrow da home, sem pílula. Contato mostra apenas “WhatsApp”; no PT, campo “WhatsApp (opcional)” com exemplo nacional sem +55.

Botão roxo “Manual de bordo” no header da home e do ônibus, localizado em EN/ES e apontando ao domínio principal no idioma correspondente. Disponível no celular; home compacta marca/menu e ônibus dispõe duas linhas. FAQ da home e fluxo de reserva permanecem preservados. Publicar pelo workflow FTP existente, disparado por push na main, e conferir as rotas públicas após sucesso.

Compartilhamento WhatsApp usa `https://api.whatsapp.com/send?text=...` diretamente: o redirecionamento do link curto wa.me substituiu os emojis por U+FFFD na verificação real. A página oficial direta preservou a legenda completa no link de continuação para WhatsApp Web. Cache do módulo atualizado após a correção.
