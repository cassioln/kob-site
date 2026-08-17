import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Porta de `xlsx_coluna_letra` (php/lib/xlsx.php) para provar a regra de
 * conversão índice -> letra do Excel.
 *
 * Não é base 26 pura: não existe "dígito zero". Na primeira posição A vale 1,
 * mas na contagem interna vale 0, e é exatamente aí que a implementação ingênua
 * erra o salto de Z para AA (gera "@A" ou "AA" na posição errada).
 *
 * Se este teste falhar, a planilha sai com referências de célula inválidas e o
 * Excel recusa o arquivo inteiro.
 */
function colunaLetra(indice) {
  let letra = '';
  let n = indice;
  for (;;) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.trunc(n / 26) - 1;
    if (n < 0) break;
  }
  return letra;
}

test('conversão de índice para letra de coluna do Excel', () => {
  // Primeira faixa: A..Z
  assert.equal(colunaLetra(0), 'A');
  assert.equal(colunaLetra(1), 'B');
  assert.equal(colunaLetra(25), 'Z');

  // O salto crítico: 26 tem de virar AA, não "BA" nem "@A".
  assert.equal(colunaLetra(26), 'AA');
  assert.equal(colunaLetra(27), 'AB');
  assert.equal(colunaLetra(51), 'AZ');
  assert.equal(colunaLetra(52), 'BA');

  // Segundo salto: ZZ -> AAA.
  assert.equal(colunaLetra(701), 'ZZ');
  assert.equal(colunaLetra(702), 'AAA');
});

test('nenhuma letra gerada sai do intervalo A-Z', () => {
  // Varre a faixa que a exportação realmente usa e garante que só saem letras.
  // Um caractere fora de A-Z indicaria overflow do cálculo, que produziria
  // referência inválida silenciosamente.
  for (let i = 0; i < 1000; i++) {
    const letra = colunaLetra(i);
    assert.match(letra, /^[A-Z]+$/, `índice ${i} gerou "${letra}"`);
  }
});
