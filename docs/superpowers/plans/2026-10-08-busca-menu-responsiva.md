# Busca ao lado do menu sanduíche

Aplicar em home, Manual e Busão, PT/EN/ES. Quando o menu estiver visível, igualar a altura da busca à dele e mostrar o texto localizado se o espaço livre da linha permitir. Usar botão quadrado apenas com lupa quando a linha ficar apertada; esconder o atalho nesse modo. Ao entrar no desktop, devolver os estilos normais, incluindo os ajustes da home após rolagem do PR #55.

Medir o espaço real do cabeçalho e o texto localizado, reagindo a resize, carregamento de fontes e troca da primeira dobra. Validar igualdade de altura, ausência de sobreposição, texto quando há espaço, teclado e abertura da busca. Publicar após testes e CI.

No Busão, mover o botão existente do Manual de Bordo para a terceira posição do menu mobile, substituindo o link simples para evitar duplicação. Devolver o mesmo botão ao header no desktop. Sem JavaScript, preservar o link original no header. Aplicar também em EN/ES.
