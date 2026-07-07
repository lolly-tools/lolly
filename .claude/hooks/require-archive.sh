#!/usr/bin/env bash
# PreToolUse(Bash) guard: hard-require an archive flag on bulk/deploy commands
# that ship the whole catalog. Blocks the command (permissionDecision: deny)
# when the flag is missing, so we never upload/copy ~500 catalog files one by one.
#
#   Rule A  vercel deploy   -> requires --archive (Vercel: --archive=tgz|split)
#   Rule B  rsync/cp + catalog -> requires --archive or -a (archive mode)
#
# Read-only commands that merely mention "catalog" (grep/find/cat/ls, the
# node build:catalog/validate:catalog scripts, etc.) never match and pass through.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"

deny() {
  jq -n --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

# --archive / --archive=tgz  (long form, the only form Vercel accepts)
has_long_archive() { printf '%s' "$cmd" | grep -Eq -- '--archive(=[A-Za-z]+)?'; }
# long form OR a short -a bundle (rsync -a / -avz, cp -a / -Ra)
has_any_archive() {
  printf '%s' "$cmd" | grep -Eq -- '--archive(=[A-Za-z]+)?|(^|[[:space:]])-[A-Za-z]*a[A-Za-z]*([[:space:]]|=|$)'
}

# Rule A — a Vercel deploy always bundles {tools,catalog}/** (vercel.json includeFiles).
# Catches both the explicit `vercel deploy …` and the shorthand `vercel --prod`
# / `vercel --prebuilt` (bare `vercel` defaults to deploy). Non-uploading
# subcommands (build/ls/env/inspect/pull/promote/rollback/…) never match, so a
# local `vercel build --prod` or a read-only `vercel ls` passes through.
if printf '%s' "$cmd" | grep -Eq '\bvercel\b'; then
  is_deploy=false
  if printf '%s' "$cmd" | grep -Eq '\bvercel\b[^|&;]*\bdeploy\b'; then
    is_deploy=true                                  # explicit `vercel deploy`
  elif printf '%s' "$cmd" | grep -Eq '\bvercel\b[^|&;]*(--prod\b|--prebuilt\b)' \
    && ! printf '%s' "$cmd" | grep -Eq '\bvercel\b[[:space:]]+(build|dev|ls|list|env|inspect|pull|whoami|logs?|link|login|logout|promote|rollback|redeploy|project|projects|domains|dns|certs|secrets|alias|teams|git|help)\b'; then
    is_deploy=true                                  # shorthand `vercel --prod`
  fi
  if [ "$is_deploy" = true ]; then
    has_long_archive || deny "Blocked: this Vercel deploy uploads the whole catalog (vercel.json includeFiles {tools,catalog}/** — ~500 files). Pass --archive=tgz so the source is tarballed instead of uploaded file-by-file (the file-by-file path also tends to abort). Re-run as: vercel deploy --prod --archive=tgz ..."
  fi
fi

# Rule B — bulk copy/sync of the catalog tree.
if printf '%s' "$cmd" | grep -Eq '\b(rsync|cp)\b' && printf '%s' "$cmd" | grep -Eq 'catalog'; then
  has_any_archive || deny "Blocked: this rsync/cp moves the catalog tree without archive mode. Re-run with --archive (or -a) to recurse and preserve modes: e.g. rsync -a / cp -a ... catalog ..."
fi

exit 0
