#!/usr/bin/env bash
# Sender.net MCP Server Runner
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../../.." && pwd)"

# 1. Carrega o .env do projeto kob-site se disponível
kob_env="${project_root}/.env"

if [ -f "$kob_env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in [A-Za-z_]*=*) ;; *) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    export "$key=$val"
  done < "$kob_env"
elif [ -f "$hub_env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    case "$line" in [A-Za-z_]*=*) ;; *) continue ;; esac
    key="${line%%=*}"; val="${line#*=}"
    case "$val" in
      \"*\") val="${val#\"}"; val="${val%\"}" ;;
      \'*\') val="${val#\'}"; val="${val%\'}" ;;
    esac
    export "$key=$val"
  done < "$hub_env"
fi

# 2. Executa o servidor MCP em Python com FastMCP
exec python3 "${script_dir}/sender_mcp_server.py"
