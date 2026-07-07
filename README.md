# Kriativos On Board - Landing page (backup estatico)

Backup da landing page **https://kriativosonboard.com.br** convertido em
site estatico **autossuficiente** (HTML + CSS + JS + imagens + fontes locais).
Nao depende mais de WordPress, PHP, banco de dados nem de recursos externos.
Roda em qualquer hospedagem estatica.

## Estrutura (reorganizada e limpa)

```
site/
├── index.html          a landing page
├── assets/             CSS, JS e libs do site
│   ├── plugins/        scripts/estilos dos plugins (WPBakery, sliders, etc.)
│   ├── themes/         CSS/JS do tema
│   └── vendor/         bibliotecas (jQuery, etc.)
├── images/             todas as imagens do site (organizadas por ano)
├── fonts/              fontes locais (Google Fonts + fontes do tema)
├── robots.txt
├── .htaccess           config Apache (cPanel/Locaweb/Hostgator)
├── netlify.toml        config Netlify
├── vercel.json         config Vercel
└── preview.sh          servidor local para testar
```

## Numeros

- 1 pagina (landing) totalmente funcional
- ~115 imagens locais em `images/`
- CSS/JS de plugins e tema em `assets/`
- Fontes locais em `fonts/` (Google Fonts baixado + fontes do tema)
- 0 dependencias externas de asset (so links sociais/embeds apontam pra fora)
- 0 arquivos PHP, 0 WordPress, 0 banco de dados

## Testar localmente (recomendado antes de subir)

```bash
cd site
./preview.sh
# abra http://localhost:8080
```

IMPORTANTE: teste sempre via este servidor (http://), NAO abrindo o
`index.html` por duplo-clique (`file://`). No modo `file://` o navegador
bloqueia scripts por seguranca e as abas/animacoes podem nao funcionar,
mesmo estando tudo correto. Em um host real (http/https) funciona normal.

## Como migrar

### Hospedagem tradicional (cPanel, Locaweb, Hostgator, FTP)
1. Suba todo o conteudo desta pasta para o document root (`public_html/`).
2. Garanta que o `.htaccess` foi enviado (arquivo oculto).
3. Aponte o dominio para o novo host (DNS).

### Netlify (gratis)
1. Arraste esta pasta em https://app.netlify.com/drop
2. Configure o dominio em Domain settings (HTTPS automatico).

### Vercel
1. `vercel` na raiz desta pasta ou importe o repo.

## Observacoes

- Landing estatica: o formulario/botoes de contato usam WhatsApp e links
  externos (funcionam normal). Nao ha backend a configurar.
- A contagem regressiva e as abas (Informacoes / Valores) funcionam via
  JavaScript ja incluido.
- Os botoes das abas foram corrigidos: os links `#ancora` (que o processo
  de captura havia quebrado para `index.html#ancora`) foram restaurados,
  entao as 5 abas de "Informacoes" alternam corretamente.
- Erros de console dos plugins (popup-builder / vc_accordion) tambem
  ocorrem no site original e nao afetam a landing.
