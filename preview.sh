#!/usr/bin/env bash
# Preview local do site antes de migrar.
# Uso: ./preview.sh   (depois abra http://localhost:8080)
#
# IMPORTANTE: sempre teste via este servidor (http://), NAO abrindo o
# index.html direto por duplo-clique (file://). Abrir por file:// faz o
# navegador bloquear scripts e as abas/animacoes podem nao funcionar.
cd "$(dirname "$0")"
if command -v php >/dev/null 2>&1; then
  echo "Iniciando servidor PHP com suporte a rotas de API em http://localhost:8080 (Ctrl+C para parar)"
  php -S localhost:8080 router.php
else
  echo "PHP não encontrado, iniciando servidor estático Python em http://localhost:8080 (Ctrl+C para parar)"
  python3 -m http.server 8080
fi
