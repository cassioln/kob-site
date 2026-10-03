# Plano de correção dos itens 1 a 8

Execução no mesmo chat, já autorizada pelo usuário após a auditoria.

- [x] Corrigir as respostas e o modal do seguro em `index.html`, `en/index.html` e `es/index.html`; ajustar descrições de bebidas em `assets/js/main.js`.
- [x] Expor apenas o número operacional do ônibus atribuído em `php/mysql/bus-registration-status.php` e no payload do mailer; manter dados pessoais fora da resposta pública.
- [x] Mostrar ônibus, horário e condição operacional na confirmação PT/EN/ES por `assets/js/onibus.js`.
- [x] Centralizar as instruções de viagem dos templates PHP, aplicar a e-mails e PDF e esclarecer as condições nas páginas e nos termos de transporte.
- [x] Testar ônibus 1, 2 e atribuição pendente em navegador e templates, revisar PDF renderizado, executar testes existentes pertinentes e revisar o diff final.

Critério de conclusão: cada correção numerada aparece em todos os canais afetados; nenhum horário é atribuído sem veículo conhecido e nenhum texto garante operação do segundo ônibus antes do quórum. Informações pendentes são encaminhadas à fonte competente, sem inventar valores ou datas.

Validação: 49 testes Node passaram; seis suítes PHP locais passaram; 42 dos 43 testes iniciais de navegador passaram e a regressão de impressão foi corrigida e retestada com sucesso (17 casos de atribuição/impressão). Quatro verificações adicionais de moeda e jornadas passaram. Sintaxe JS/PHP, JSON-LD, 34 FAQs por idioma e paridade de chaves/placeholders foram conferidos. Modais de seguro foram renderizados em PT/EN/ES, desktop e celular; PDFs e e-mail foram inspecionados com dados fictícios. Nenhum teste enviou e-mails reais ou alterou reservas no banco.

Impeccable: aumentados para 14px os avisos de tarifa, moeda e quórum e os rótulos da confirmação. Os avisos estáticos de texto preto sobre fundo escuro e corte de diálogos não se reproduziram no navegador (1440/390px); exceções restritas a `en/onibus.html` e `es/onibus.html` foram registradas pelo comando oficial. A sombra roxa de ação foi preservada como parte da identidade incumbente, com exceção igualmente restrita. Não houve supressão global de regras.

Pendências factuais encaminhadas na própria interface: apólice/limites/moeda e condições especiais do seguro, confirmação final da sala e dos horários, dia da escala no itinerário oficial e atribuição operacional de reservas ainda em espera.

Double check de 03/10/2026: a suíte completa passou com 49 testes Node, 102 testes de navegador e uma verificação de privacidade; as seis suítes PHP passaram novamente. Foram reconferidos JSON-LD e conteúdo crítico das três páginas, além da paridade de 71 chaves e seus placeholders em PT/EN/ES. A comparação dos alertas Impeccable com o HEAD anterior confirmou a presença dos estilos apontados antes destas correções; a confirmação do ônibus 2 foi conferida em 1440/390px, em tela e impressão, sem rolagem horizontal. Os alertas preexistentes permanecem fora do escopo da auditoria de conteúdo, sem novas supressões.

Publicação autorizada pelo usuário após o double check, pelo fluxo existente de push em `main` e GitHub Actions/Locaweb. As alterações locais de instalação da skill i18n não integram esta entrega.
