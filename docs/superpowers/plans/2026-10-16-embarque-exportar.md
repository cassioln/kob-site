# Exportação da chamada — implementação

**Objetivo:** rodapé fixo Exportar com Copiar, E-mail, Excel e PDF, sempre para todos os ônibus e ambos os trechos confirmados.
**Arquitetura:** módulos frontend de exportação e combobox, dicionário pt/en/es, API `/api/bus-boarding?format=pdf|xlsx&lang=pt|en|es` autenticada por header e geradores PHP existentes, sem esquema novo.
**Restrições:** PHP 8.0/MySQL5.7, sem dependências novas de produção, sem SonarQube, sem envio automático de mensagens e sem tokens nos URLs.

- [x] Criar texto simples, clipboard/fallback rolável e rascunho E-mail; listas grandes geram `.eml` completo. Substituir WhatsApp por Excel conforme pedido final. Nenhum envio automático.
- [x] Montar rodapé `checklist-share` com seta para cima e quatro controles, preservando todos os ônibus independentemente dos filtros. Exibir avisos centrais flutuantes de carregamento/sucesso/erro, sem expandir o rodapé.
- [x] Gerar PDF A4 por nova consulta MySQL: pessoa indivisível, grupo pequeno junto, grupo grande com título de continuação, contexto do ônibus e páginas numeradas/horário de São Paulo.
- [x] Gerar XLSX real nos três idiomas, com oito colunas, grupo/código/nome e estados/horários de ida e volta, tipos textuais e filtro. Token no header e `Cache-Control: no-store`, sem gravações de presença ou dados em localStorage.
- [x] Manter campo fechado em 52 px/13 px ou 48 px/12 px até 374 px; menu com opções de 18 px e alvos de 56 px. Combobox/listbox com teclado e busca por digitação; Escape fecha somente o menu. Espanhol compacto apenas no campo fechado.
- [x] Agrupar solo de um passageiro por ônibus como VIP, classificando pela lista completa. Reutilizar meeples decorativos do Planejamento em laranja/azul/roxo para VIP/solo/grupo e manter códigos/checks individuais nas saídas.
- [x] Animar Atualizar durante/depois da leitura com fallback de movimento reduzido; alinhar sincronização à direita e retirar o sufixo de atualização automática nos três idiomas, mantendo polling de oito segundos.
- [x] Aprovar 38 testes de navegador em 39,7 s, 146 do servidor, geradores PHP nos três idiomas, PDF anterior de Reservas e validação de embarque. Conferir HTTP de leitura em MariaDB descartável e os três XLSX em openpyxl. Não repetir o teste destrutivo MySQL já validado.
- [x] Conferir treze capturas UI, recortes e PDF de 67 passageiros/dez páginas em teste isolado. Receber `disposition: ship` do revisor independente no acabamento revisado, sem correções materiais de UI/exportação.
- [x] Atualizar README, especificações, planos e contrato, preservando documentos globais, drift preexistente e ausência de novos rasters de produção.
Entrega no PR 79, mantido em rascunho e sem deploy.
