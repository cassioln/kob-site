<?php

declare(strict_types=1);

/**
 * Gerador de .xlsx (OOXML) sem dependências externas.
 *
 * Por que existe: o projeto não usa Composer e não queremos `vendor/` num site
 * estático publicado por FTP, então PhpSpreadsheet está fora. O que o servidor
 * oferece (medido, não suposto): `ZipArchive` disponível e `gzdeflate` presente.
 * Um .xlsx é justamente um ZIP com alguns XMLs dentro, então dá para montar.
 *
 * Por que não CSV: o Excel converte código de reserva em número quando parece
 * número, e come o zero à esquerda de telefone e CPF. Aqui toda célula é
 * declarada como texto (`inlineStr`), então o dado chega intacto.
 *
 * O que ele deliberadamente NÃO faz: fórmulas, múltiplas abas, imagens dentro da
 * planilha, gráficos. É uma exportação de tabela com estilo, não um editor.
 */

/**
 * Converte índice de coluna (0 = A) na letra do Excel.
 *
 * O salto de Z para AA é a parte fácil de errar: não é base 26 pura, porque não
 * existe "dígito zero" (A vale 1 na primeira posição, mas 0 na contagem).
 */
function xlsx_coluna_letra(int $indice): string
{
    $letra = '';
    $n = $indice;
    while (true) {
        $letra = chr(65 + ($n % 26)) . $letra;
        $n = intdiv($n, 26) - 1;
        if ($n < 0) {
            break;
        }
    }

    return $letra;
}

/**
 * Escapa texto para XML e REMOVE caracteres de controle inválidos.
 *
 * Escapar não basta: byte de controle (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F) é
 * proibido em XML 1.0 mesmo escapado, e o Excel recusa o arquivo INTEIRO com
 * "formato inválido" se um passar. Melhor perder um caractere invisível do que
 * entregar planilha que não abre.
 */
function xlsx_texto(string $valor): string
{
    $limpo = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $valor);
    if ($limpo === null) {
        // preg_replace devolve null em entrada UTF-8 inválida; nesse caso força
        // a conversão em vez de deixar o valor passar cru.
        $limpo = mb_convert_encoding($valor, 'UTF-8', 'UTF-8');
    }

    return htmlspecialchars($limpo, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

/**
 * Índices dos estilos em xl/styles.xml. A ordem aqui define o `s="N"` da célula,
 * então mexer na ordem quebra a formatação: o mapa existe para isso ficar
 * explícito em vez de espalhar números mágicos pelo código.
 */
function xlsx_estilos_indices(): array
{
    return [
        'padrao' => 0,
        'titulo' => 1,
        'subtitulo' => 2,
        'cabecalho' => 3,
        'normal' => 4,
        'responsavel' => 5,
        'grupo' => 6,
        'status_ok' => 7,
        'status_espera' => 8,
        'status_falha' => 9,
        'vip' => 10,
        'status_vip' => 11,
        'responsavel_centralizado' => 12,
    ];
}

/**
 * Monta xl/styles.xml com a identidade visual do site.
 *
 * Cores: ocean-abyss #041D3A e ocean-navy #082F57 no cabeçalho, roxo claro
 * #F3E8F8 para o contato responsável, e os três tons de status já usados no
 * painel (verde, amarelo, vermelho).
 */
function xlsx_styles(): string
{
    // A ordem de fonts/fills/borders é referenciada por índice nos cellXfs.
    $fonts = [
        '<font><sz val="11"/><color rgb="FF0D2242"/><name val="Calibri"/></font>',
        '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
        '<font><i/><sz val="10"/><color rgb="FF5A6A82"/><name val="Calibri"/></font>',
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
        '<font><b/><sz val="11"/><color rgb="FF0F7A4A"/><name val="Calibri"/></font>',
        '<font><b/><sz val="11"/><color rgb="FF8A5A00"/><name val="Calibri"/></font>',
        '<font><b/><sz val="11"/><color rgb="FFA3232B"/><name val="Calibri"/></font>',
        '<font><b/><sz val="11"/><color rgb="FF0D2242"/><name val="Calibri"/></font>',
    ];

    $fills = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FF041D3A"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FF082F57"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF3E8F8"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE6F5EE"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFDF3E2"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFBEAEA"/><bgColor indexed="64"/></patternFill></fill>',
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D6"/><bgColor indexed="64"/></patternFill></fill>',
    ];

    $bordaFina = '<left style="thin"><color rgb="FFD9E1EC"/></left>'
        . '<right style="thin"><color rgb="FFD9E1EC"/></right>'
        . '<top style="thin"><color rgb="FFD9E1EC"/></top>'
        . '<bottom style="thin"><color rgb="FFD9E1EC"/></bottom>';

    $borders = [
        '<border><left/><right/><top/><bottom/><diagonal/></border>',
        '<border>' . $bordaFina . '<diagonal/></border>',
        // Borda superior média: marca onde um grupo de reserva começa.
        '<border><left style="thin"><color rgb="FFD9E1EC"/></left>'
            . '<right style="thin"><color rgb="FFD9E1EC"/></right>'
            . '<top style="medium"><color rgb="FFB9C6D8"/></top>'
            . '<bottom style="thin"><color rgb="FFD9E1EC"/></bottom><diagonal/></border>',
    ];

    // cellXfs: a ordem AQUI é o índice usado em `s="N"` nas células.
    $xfs = [
        // 0 padrao
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
        // 1 titulo — centralizado na faixa mesclada A1:<última>1. Sem
        // horizontal="center" a mesclagem só alarga a caixa e o texto continua
        // encostado na esquerda.
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 2 subtitulo — também centralizado, para acompanhar o título mesclado.
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 3 cabecalho
        '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
        // 4 normal
        '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>',
        // 5 responsavel
        '<xf numFmtId="49" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>',
        // 6 grupo
        '<xf numFmtId="49" fontId="0" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>',
        // 7 status_ok
        '<xf numFmtId="49" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 8 status_espera
        '<xf numFmtId="49" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 9 status_falha
        '<xf numFmtId="49" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 10 vip — fundo dourado claro para a linha administrativa.
        '<xf numFmtId="49" fontId="7" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>',
        // 11 status_vip
        '<xf numFmtId="49" fontId="5" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
        // 12 responsavel_centralizado — mesmo destaque do responsável, com o Nº centralizado.
        '<xf numFmtId="49" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',
    ];

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<fonts count="' . count($fonts) . '">' . implode('', $fonts) . '</fonts>'
        . '<fills count="' . count($fills) . '">' . implode('', $fills) . '</fills>'
        . '<borders count="' . count($borders) . '">' . implode('', $borders) . '</borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="' . count($xfs) . '">' . implode('', $xfs) . '</cellXfs>'
        . '</styleSheet>';
}

/**
 * Emite células vazias `<c/>` de `$de` a `$ate` (índices de coluna) numa linha.
 *
 * Existe por dois motivos: numa faixa mesclada, o Excel só aplica o preenchimento
 * às células que EXISTEM no XML (a faixa fica meio pintada se elas faltarem); e
 * numa linha de dados, a célula vazia é o que desenha a borda — sem ela a moldura
 * da tabela fica com furos.
 */
function xlsx_celulas_vazias(int $de, int $ate, int $linha, int $estilo): string
{
    $xml = '';
    for ($i = $de; $i <= $ate; $i++) {
        $xml .= '<c r="' . xlsx_coluna_letra($i) . $linha . '" s="' . $estilo . '"/>';
    }

    return $xml;
}

/**
 * Gera o .xlsx.
 *
 * @param array{
 *   nome?: string, titulo?: string, subtitulo?: string,
 *   colunas: list<array{titulo: string, largura?: int|float}>,
 *   linhas: list<array{celulas: list<string|array{v: string, estilo?: string}>, estilo?: string}>
 * } $planilha
 */
function xlsx_build(array $planilha): string
{
    $indices = xlsx_estilos_indices();
    $colunas = $planilha['colunas'];
    $totalColunas = count($colunas);
    $ultimaLetra = xlsx_coluna_letra(max(0, $totalColunas - 1));

    $linhasXml = [];
    $mesclagens = [];
    $numero = 1;

    // Título e subtítulo mesclados na largura da tabela: dão contexto quando a
    // planilha circula por e-mail, longe do painel que a gerou. A mesclagem é
    // declarada em <mergeCells>; sem ela o texto só "transborda" visualmente e
    // a primeira célula com conteúdo à direita o corta.
    if (!empty($planilha['titulo'])) {
        $linhasXml[] = '<row r="' . $numero . '" ht="30" customHeight="1">'
            . '<c r="A' . $numero . '" s="' . $indices['titulo'] . '" t="inlineStr">'
            . '<is><t>' . xlsx_texto((string) $planilha['titulo']) . '</t></is></c>'
            // As células mescladas ainda precisam existir com o mesmo estilo, ou
            // o Excel pinta o fundo apenas na primeira coluna da faixa.
            . xlsx_celulas_vazias(1, $totalColunas - 1, $numero, $indices['titulo'])
            . '</row>';
        if ($totalColunas > 1) {
            $mesclagens[] = 'A' . $numero . ':' . $ultimaLetra . $numero;
        }
        $numero++;
    }
    if (!empty($planilha['subtitulo'])) {
        $linhasXml[] = '<row r="' . $numero . '" ht="18" customHeight="1">'
            . '<c r="A' . $numero . '" s="' . $indices['subtitulo'] . '" t="inlineStr">'
            . '<is><t>' . xlsx_texto((string) $planilha['subtitulo']) . '</t></is></c>'
            . xlsx_celulas_vazias(1, $totalColunas - 1, $numero, $indices['subtitulo'])
            . '</row>';
        if ($totalColunas > 1) {
            $mesclagens[] = 'A' . $numero . ':' . $ultimaLetra . $numero;
        }
        $numero++;
    }

    $linhaCabecalho = $numero;
    $celulasCabecalho = [];
    foreach ($colunas as $i => $col) {
        $celulasCabecalho[] = '<c r="' . xlsx_coluna_letra($i) . $linhaCabecalho
            . '" s="' . $indices['cabecalho'] . '" t="inlineStr"><is><t>'
            . xlsx_texto((string) $col['titulo']) . '</t></is></c>';
    }
    $linhasXml[] = '<row r="' . $linhaCabecalho . '" ht="30" customHeight="1">'
        . implode('', $celulasCabecalho) . '</row>';
    $numero++;

    foreach ($planilha['linhas'] as $linha) {
        $estiloLinha = $linha['estilo'] ?? 'normal';
        $celulas = [];
        foreach ($linha['celulas'] as $i => $celula) {
            $valor = is_array($celula) ? (string) ($celula['v'] ?? '') : (string) $celula;
            $estiloCelula = is_array($celula) && !empty($celula['estilo'])
                ? $celula['estilo']
                : $estiloLinha;
            if ($estiloLinha === 'vip' && in_array($estiloCelula, ['texto', 'centralizado'], true)) {
                $estiloCelula = 'vip';
            } elseif ($estiloLinha === 'responsavel') {
                if ($estiloCelula === 'texto') {
                    $estiloCelula = 'responsavel';
                } elseif ($estiloCelula === 'centralizado') {
                    $estiloCelula = 'responsavel_centralizado';
                }
            }
            $s = $indices[$estiloCelula] ?? $indices['normal'];

            // Célula vazia ainda precisa existir para a borda desenhar; sem ela
            // a moldura da tabela fica com furos.
            if ($valor === '') {
                $celulas[] = '<c r="' . xlsx_coluna_letra($i) . $numero . '" s="' . $s . '"/>';
                continue;
            }
            $celulas[] = '<c r="' . xlsx_coluna_letra($i) . $numero . '" s="' . $s
                . '" t="inlineStr"><is><t>' . xlsx_texto($valor) . '</t></is></c>';
        }
        $linhasXml[] = '<row r="' . $numero . '">' . implode('', $celulas) . '</row>';
        $numero++;
    }

    $ultimaLinha = max($linhaCabecalho, $numero - 1);

    $cols = [];
    foreach ($colunas as $i => $col) {
        $cols[] = '<col min="' . ($i + 1) . '" max="' . ($i + 1)
            . '" width="' . (float) ($col['largura'] ?? 14) . '" customWidth="1"/>';
    }

    // <autoFilter> vem DEPOIS de <sheetData> e ANTES de <mergeCells>: é a ordem
    // do schema CT_Worksheet (ECMA-376) — confirmada contra duas
    // implementações de referência testadas contra o Excel real (openpyxl e
    // xlsxwriter escrevem autoFilter antes de mergeCells). A ordem inversa
    // (usada antes aqui) não quebrou nos leitores testados (openpyxl,
    // Gnumeric), mas segue a ordem certa evita depender da tolerância do
    // leitor.
    $mergeXml = $mesclagens
        ? '<mergeCells count="' . count($mesclagens) . '">'
            . implode('', array_map(static function (string $ref): string {
                return '<mergeCell ref="' . $ref . '"/>';
            }, $mesclagens))
            . '</mergeCells>'
        : '';
    $autoFilterXml = '<autoFilter ref="A' . $linhaCabecalho . ':' . $ultimaLetra . $ultimaLinha . '"/>';

    // Congela abaixo do cabeçalho para rolar a lista sem perder os títulos.
    $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<sheetViews><sheetView workbookViewId="0" tabSelected="1">'
        . '<pane ySplit="' . $linhaCabecalho . '" topLeftCell="A' . ($linhaCabecalho + 1)
        . '" activePane="bottomLeft" state="frozen"/>'
        . '</sheetView></sheetViews>'
        . '<sheetFormatPr defaultRowHeight="16"/>'
        . '<cols>' . implode('', $cols) . '</cols>'
        . '<sheetData>' . implode('', $linhasXml) . '</sheetData>'
        . $autoFilterXml
        . $mergeXml
        . '</worksheet>';

    $nomeAba = xlsx_texto(substr($planilha['nome'] ?? 'Dados', 0, 31));

    $membros = [
        '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . '</Types>',

        '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>',

        'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="' . $nomeAba . '" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>',

        'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            . '</Relationships>',

        'xl/styles.xml' => xlsx_styles(),
        'xl/worksheets/sheet1.xml' => $sheet,
    ];

    $temporario = tempnam(sys_get_temp_dir(), 'kobxlsx');
    if ($temporario === false) {
        throw new RuntimeException('Não foi possível criar arquivo temporário para o xlsx.');
    }

    try {
        $zip = new ZipArchive();
        if ($zip->open($temporario, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Não foi possível abrir o container do xlsx.');
        }
        foreach ($membros as $caminho => $conteudo) {
            $zip->addFromString($caminho, $conteudo);
        }
        $zip->close();

        $bytes = file_get_contents($temporario);
        if ($bytes === false) {
            throw new RuntimeException('Não foi possível ler o xlsx gerado.');
        }

        return $bytes;
    } finally {
        // Remove o temporário mesmo se algo acima lançar: sem isso o /tmp do
        // servidor acumula planilhas a cada exportação com erro.
        if (is_file($temporario)) {
            @unlink($temporario);
        }
    }
}
