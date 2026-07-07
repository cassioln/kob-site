# Kriativos On Board 2026 — landing estática

Landing page estática do **Kriativos On Board 2026**. O projeto agora vive diretamente na raiz do repositório — não há mais subpasta `site/`.

Todos os arquivos públicos de mídia ficam em `assets/images/`, `assets/videos/` ou `assets/hero-frames/`; não há mais imagens, vídeos ou pastas herdadas do WordPress na raiz.

## Estrutura

```text
.
├── index.html              página principal
├── assets/
│   ├── css/main.css        estilos da landing
│   ├── js/main.js          comportamento da landing
│   ├── hero-frames/        sequência WebP usada no scrub do hero
│   ├── images/             imagens organizadas por uso editorial
│   │   ├── brand/          logos, favicon e touch icon
│   │   ├── cabins/         fotos do modal de cabines
│   │   ├── creators/       participações especiais
│   │   ├── gallery/2024/   melhores momentos do KOB 2024
│   │   ├── hero/           poster e imagem social do hero
│   │   ├── partners/       logos de parceiros
│   │   ├── ship/           fotos do MSC Música
│   │   └── story/          fotos narrativas do evento
│   └── videos/             vídeos usados pela landing
├── PRODUCT.md              contexto do produto
├── DESIGN.md               direção/design system
├── robots.txt
├── .htaccess               configuração Apache
├── netlify.toml            configuração Netlify
├── vercel.json             configuração Vercel
└── preview.sh              servidor local simples
```

## Testar localmente

```bash
./preview.sh
# abra http://localhost:8080
```

Teste sempre via HTTP. Abrir `index.html` direto via `file://` pode bloquear comportamentos do navegador.

## Publicação

- **Hospedagem tradicional:** suba o conteúdo da raiz do repo para o document root (`public_html/`, por exemplo).
- **Netlify:** publish directory `.`.
- **Vercel:** importe o repo ou rode `vercel` na raiz.

## Limpeza realizada

Foram removidos da árvore principal os artefatos de trabalho, screenshots, masters de vídeo/frames, backup pré-Impeccable, fontes locais não utilizadas, assets legados de WordPress/WPBakery e imagens não referenciadas pela landing atual. Os assets vivos foram movidos para `assets/` e renomeados por função, eliminando a estrutura `images/YYYY/MM` herdada do WordPress.

Backups externos das limpezas foram criados ao lado deste diretório, com nomes `kob-site-pre-cleanup-backup-*` e `kob-site-pre-asset-reorg-*`.
