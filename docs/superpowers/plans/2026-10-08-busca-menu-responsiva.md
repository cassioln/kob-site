# Busca ao lado do menu sanduíche

Aplicar em home, Manual e Busão, PT/EN/ES. Quando o menu estiver visível, igualar a altura da busca à dele e mostrar o texto localizado se o espaço livre da linha permitir. Usar botão quadrado apenas com lupa quando a linha ficar apertada; esconder o atalho nesse modo. Ao entrar no desktop, devolver os estilos normais, incluindo os ajustes da home após rolagem do PR #55.

Medir o espaço real do cabeçalho e o texto localizado, reagindo a resize, carregamento de fontes e troca da primeira dobra. Validar igualdade de altura, ausência de sobreposição, texto quando há espaço, teclado e abertura da busca. Publicar após testes e CI.

No Busão, mover o botão existente do Manual de Bordo para a terceira posição do menu mobile, substituindo o link simples para evitar duplicação. Devolver o mesmo botão ao header no desktop. Sem JavaScript, preservar o link original no header. Aplicar também em EN/ES.

Validação: 14 testes de headers e navegação passaram em PT/EN/ES, de 320 a 1320 px, incluindo retorno ao desktop, foco e ausência de duplicação. Checks básicos: 129 testes de servidor, 8 de tempo dos avisos e 27 smoke do navegador passaram. Revisão visual do Manual, home e Busão em mobile confirmou a altura da busca, texto quando cabe e o botão do Manual dentro do menu. Build do índice: 201 entradas por idioma, sem alterações nos JSONs. Validação de publicação de assets e `git diff --check` passaram.

Os commits locais `b189d7c` e `01b2037` foram publicados pelo mantenedor na main durante o trabalho. Preservados os ajustes dele; removidos apenas os logs temporários de diagnóstico que entraram no teste de navegação. As mudanças finais do menu partem dessa main.
