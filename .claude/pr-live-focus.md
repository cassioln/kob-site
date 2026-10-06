## Resumo

Correção de acompanhamento do #24, encontrada ao rodar `npm run test:analytics`.

Com **movimento reduzido** ativo, ao abrir a lista de Assuntos no mobile o foco não ia para o botão de fechar da folha: a regra global de movimento reduzido dá uma transição de 0,01ms a todos os elementos, e os botões da folha ficavam "invisíveis" por uns 2 quadros no momento de receber o foco. Agora as transições dentro da folha ficam desligadas nesse modo.

- `assets/css/manual-de-bordo.css`: `.live-drawer__panel *` entra na regra de `transition: none` do bloco de movimento reduzido.
- Versão do CSS nos 3 HTML (PT/EN/ES) passa para `20261006-live-focus`, para o navegador buscar o arquivo novo.

## Testes

- [x] Reproduzido e validado no navegador com a regra real de movimento reduzido: o foco vai para o botão de fechar; sem movimento reduzido, continua igual.
- [ ] `npm run test:analytics`: devem passar os 3 casos de "Gaveta e teclado a 320/390/768px".

As outras 10 falhas da suíte já existiam antes do #24 (comparado com `cff291a`): o seletor de idioma da home (i18n), o hambúrguer escondido no desktop do Manual e o "Mais detalhes" sob a aba de Assuntos em 769–850px. Ficam para outro PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
