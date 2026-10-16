# Exportação da chamada de embarque

## Rodapé e estados

O rodapé fixo repete a identidade do `checklist-share` do Manual: título Exportar com seta para cima e quatro controles com ícone e texto, Copiar, E-mail, Excel e PDF. Excel substitui WhatsApp por pedido explícito do usuário. Os controles têm altura mínima de 60 px, em quatro colunas, e permanecem visíveis durante a rolagem. Textos e atributos acessíveis atendem pt/en/es.

Carregamento, sucesso e erro aparecem em um aviso flutuante central no slider, com spinner ou ícone e botão de fechar nos resultados. O aviso não amplia o rodapé. Clipboard indisponível oferece textarea selecionável dentro da área rolável. Estado inicial incompleto, dados desatualizados, falta de conexão, gravação pendente ou lista vazia bloqueiam exportar; downloads pendentes impedem ações duplicadas. Nenhuma mensagem é enviada automaticamente.

## Escopo e saídas

Todas as saídas incluem **todos os ônibus**, independentemente de select, busca ou filtro, com estados confirmados de ida e volta, grupos e códigos individuais. Texto e PDF apresentam resumos dos trechos e blocos de VIPs/solos por ônibus; Excel identifica o agrupamento na coluna Grupo. A classificação solo usa a reserva completa com um passageiro; filtros não transformam grupos em solo. CPF, token, dados de pagamento e links privados ficam fora do relatório.

- **Copiar:** texto simples, legível, com marcações `[x]`/`[ ]`, nome, código e os dois trechos. Usa a última leitura confirmada completa. Se clipboard falhar, mantém o relatório inteiro no campo selecionável.
- **E-mail:** rascunho `mailto` com assunto, introdução e relatório completo, sem destinatário ou envio automático. Quando a URL excede 8000 caracteres, baixa `.eml` completo e editável, sem truncar passageiros.
- **Excel:** XLSX real gerado no backend, com oito colunas localizadas: ônibus, grupo, código de reserva, nome, ida, horário da ida, volta e horário da volta. A coluna grupo identifica VIP, solo ou nome do grupo. Horários usam America/Sao_Paulo; códigos preservam zeros e valores textuais não viram fórmulas. Há filtro de colunas.
- **PDF:** download A4 real, sem janela de impressão. Cada bloco indivisível reúne nome, código e checks de ida/volta. Grupos pequenos ficam juntos quando cabem; grandes continuam com título repetido. Cada página mantém cabeçalho/contexto do ônibus, horário de geração em São Paulo e numeração.

## Contrato da API

`GET /api/bus-boarding?format=pdf|xlsx&lang=pt|en|es` recebe o token administrativo no header `X-Admin-Token`, sem token na URL. PDF e XLSX consultam novamente o MySQL e retornam o tipo de arquivo correspondente com `Cache-Control: no-store`. Idioma inválido responde 400. Exportar não grava presença, não exige esquema novo e não armazena dados em localStorage. O bypass localhost preexistente do ambiente de desenvolvimento continua existindo; o teste HTTP local não comprova rejeição de autenticação em produção.

Frontend: `assets/js/painel-embarque-export.js`, integrado ao módulo de chamada e dicionário compartilhado. Backend: `php/mysql/bus-boarding.php`, `php/lib/boarding-rollcall-pdf.php` e `php/lib/boarding-rollcall-xlsx.php`, reutilizando os geradores existentes sem novas dependências de produção.

## Ajustes operacionais finais

O campo de ônibus fechado acompanha Ida/Volta: combobox de 52 px com texto de 13 px, ou 48 px/12 px até 374 px. As opções abertas usam 18 px e alvos mínimos de 56 px. O select interno transparente e `aria-hidden` mantém o valor; botão combobox e listbox oferecem setas, Home/End, Enter, Escape, Tab e busca por digitação. Escape fecha o menu sem recolher o dialog. Em espanhol até 374 px, o fechado mostra “Todos”, com nome acessível completo; a opção aberta mostra “Todos los autobuses”.

Por ônibus, VIPs e reservas solo ficam em blocos próprios; grupos maiores preservam sua reserva. Os cabeçalhos reutilizam a geometria de meeple do Planejamento, decorativa, em #d97706 para VIP, #0077b6 para solo e #7b1fa2 para grupo. Cada pessoa mantém código e checks independentes.

Atualizar gira durante a leitura e completa uma volta ao concluir; movimento reduzido desliga as animações. `#embarque-sync` fica alinhado à direita. O sufixo sobre atualização automática foi retirado em pt/en/es, mantendo a sincronização a cada oito segundos.

## Validação e revisão — 16/10/2026

- Passaram 38 testes de navegador em 39,7 s e 146 testes do servidor. Passaram os geradores PHP PDF/XLSX nos três idiomas, o PDF anterior de Reservas e a validação de embarque. O teste destrutivo MySQL não foi repetido, pois a persistência já havia sido validada.
- A integração HTTP somente de leitura em MariaDB descartável confirmou PDF/XLSX em espanhol com 200, assinaturas e tipos corretos e `no-store`; idioma inválido retornou 400. Openpyxl abriu os três XLSX: oito colunas, códigos com zeros, células textuais sem fórmulas e filtro.
- Evidências em `.impeccable/review/boarding-export/`: treze PNGs completos (`desktop-ready`, `desktop-solo`, `tablet-ready`, `user-892`, `mobile-solo`, `mobile-menu`, `small-spanish-menu`, `english-ready`, `short-mobile`, `mobile-loading`, `desktop-success`, `mobile-error`, `mobile-fallback`), recortes de rodapé/opções e `pdf/pt-01..10.png`, `en-first.png`, `es-first.png`. Os arquivos `chamada-{pt,en,es}.pdf/.xlsx` usam o mesmo caso fictício de 67 passageiros; o PDF português tem dez páginas.
- Os testes e capturas são isolados, com dados fictícios e sem gravações de presença no banco. Não houve inspeção direta da aba do usuário. O revisor independente conferiu as treze capturas e PDFs atuais e emitiu **`disposition: ship` no acabamento revisado**, sem correções materiais de UI/exportação.
- Nenhum raster novo de produção foi criado. `docs/PRODUCT.md`, `docs/DESIGN.md` e a ausência preexistente de `.impeccable/design.json` permanecem preservados. O PR 79 segue em rascunho, sem deploy.
