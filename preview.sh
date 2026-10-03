#!/usr/bin/env bash
# Preview local do site.
# Uso: ./preview.sh [porta]  (padrão: 8085, ex: ./preview.sh 8088)
#
# IMPORTANTE: sempre teste via este servidor (http://), NAO abrindo o
# index.html direto por duplo-clique (file://). Abrir por file:// faz o
# navegador bloquear scripts e as abas/animacoes podem nao funcionar.
cd "$(dirname "$0")"
PORT="${1:-${PORT:-8085}}"

if command -v php >/dev/null 2>&1; then
  echo "Iniciando servidor PHP com suporte a rotas de API em http://localhost:${PORT} (Ctrl+C para parar)"
  php -S "localhost:${PORT}" router.php
else
  echo "PHP não encontrado, iniciando servidor estático Python em http://localhost:${PORT} (Ctrl+C para parar)"
  python3 -m http.server "${PORT}"
fi
