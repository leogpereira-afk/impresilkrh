#!/bin/bash
# ============================================================================
# Publica as Edge Functions do RH no Supabase.
#
# POR QUE ESTE ARQUIVO EXISTE: em 16/08/2026, consertando um vazamento de folha,
# empurrei para o GitHub e conferi o corpo NO AR -- continuava a versao velha.
# A integracao GitHub<->Supabase deste repositorio NAO republica no push (a
# `sync` estava no ar desde 11/08 e a `mubi-pagamentos` desde 01/08, com commits
# depois das duas datas). Sem isto, o conserto fica no git e o servidor segue
# servindo o buraco, calado.
#
# E o mesmo publicador do repo do painel (painel/scripts/publicar-functions.sh),
# so com _shared/cors.ts no lugar de _shared/cripto.ts.
#
# COMO USAR (o token e o "personal access token" do Supabase, comeca com sbp_;
# pegue em https://supabase.com/dashboard/account/tokens):
#
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/publicar-functions.sh                # publica todas
#   ./scripts/publicar-functions.sh sync           # so uma
#
# O token NAO fica gravado em lugar nenhum: sai do ambiente e some quando o
# terminal fecha. Nunca escreva ele num arquivo do repositorio -- este repo e
# publico.
#
# DEPOIS DE PUBLICAR, CONFIRA O CORPO NO AR, nao a resposta do deploy:
#   curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
#     https://api.supabase.com/v1/projects/<ref>/functions/<slug>/body
# ============================================================================
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-heveemylixartyijxewh}"
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
RAIZ="$(cd "$(dirname "$0")/../supabase/functions" && pwd)"

if [ -z "$TOKEN" ]; then
  echo "Falta o token. Rode:  export SUPABASE_ACCESS_TOKEN=sbp_..." >&2
  exit 1
fi

FUNCOES=("$@")
if [ ${#FUNCOES[@]} -eq 0 ]; then
  FUNCOES=(sync admin-users backup-registros mubi-pagamentos)
fi

cd "$RAIZ"
falhou=0
for fn in "${FUNCOES[@]}"; do
  [ -f "$fn/index.ts" ] || { echo "$fn: nao existe em supabase/functions"; falhou=1; continue; }

  # _shared/cors.ts sobe junto de quem importa. O nome do arquivo tem de ser o
  # CAMINHO RELATIVO que o import usa ("../_shared/cors.ts"), senao o bundle nao
  # resolve e a function sobe morta.
  args=(-F "file=@$fn/index.ts;filename=index.ts;type=application/typescript")
  if grep -q "_shared/cors.ts" "$fn/index.ts"; then
    args+=(-F "file=@_shared/cors.ts;filename=../_shared/cors.ts;type=application/typescript")
  fi

  # verify_jwt=false de proposito: quem confere a sessao e a propria function
  # (admin.auth.getUser sobre o cracha do Supabase Auth), e o preflight CORS
  # chega sem credencial nenhuma.
  resp=$(curl -sS -X POST \
    "https://api.supabase.com/v1/projects/$REF/functions/deploy?slug=$fn" \
    -H "Authorization: Bearer $TOKEN" \
    -F "metadata={\"entrypoint_path\":\"index.ts\",\"name\":\"$fn\",\"verify_jwt\":false};type=application/json" \
    "${args[@]}") || { echo "$fn: falhou a chamada"; falhou=1; continue; }

  echo "$resp" | FN="$fn" python3 -c "
import json, os, sys
fn = os.environ['FN']
try:
    d = json.load(sys.stdin)
except Exception:
    print(f'{fn}: resposta inesperada'); sys.exit(1)
if d.get('version'):
    print(f\"{fn}: {d.get('status')} v{d.get('version')}\")
else:
    print(f\"{fn}: ERRO -- {d.get('message') or d}\"); sys.exit(1)
" || falhou=1
done

exit $falhou
