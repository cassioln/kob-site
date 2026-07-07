#!/usr/bin/env bash
# Preview local do site antes de migrar.
# Uso: ./preview.sh   (depois abra http://localhost:8080)
#
# IMPORTANTE: sempre teste via este servidor (http://), NAO abrindo o
# index.html direto por duplo-clique (file://). Abrir por file:// faz o
# navegador bloquear scripts e as abas/animacoes podem nao funcionar.
cd "$(dirname "$0")"
echo "Servindo o site em http://localhost:8080  (Ctrl+C para parar)"
python3 -m http.server 8080
