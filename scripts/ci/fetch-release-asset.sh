#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
#
# Download one GitHub release asset in CI, with a second route.
#
#   scripts/ci/fetch-release-asset.sh OWNER/REPO TAG ASSET OUTPUT
#
# First it tries the public download URL that the workflows always used:
#   https://github.com/OWNER/REPO/releases/download/TAG/ASSET
# If that fails, it fetches the same asset through the REST API with
# `gh release download`, which looks the asset up by tag and exact name and
# downloads it with Accept: application/octet-stream. On 2026-11-08 every
# releases/download URL returned HTTP 504 for hours while the API kept serving
# the same files, which stopped every job that installs a pinned tool.
#
# The API route needs GH_TOKEN or GITHUB_TOKEN in the environment (the job's
# github.token with contents: read is enough). gh reads it from the
# environment, so the token is never on a command line and never printed.
#
# This script does not judge the bytes. Every caller checks its pinned SHA-256
# straight after this call, and that check is the integrity rule whichever
# route the bytes came by.
#
# FETCH_RELEASE_MAX_TIME (seconds, default 120) bounds each attempt on the
# public URL, so a stalled connection leaves time for the API route.
set -euo pipefail
# Never trace this script, even under bash -x: a traced line that reads the token prints it.
{ set +x; } 2> /dev/null

fail() { printf 'fetch-release-asset: %s\n' "$*" >&2; exit 1; }

[[ $# -eq 4 ]] || fail 'usage: fetch-release-asset.sh OWNER/REPO TAG ASSET OUTPUT'
repo="$1" tag="$2" asset="$3" output="$4"
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail "invalid repository: $repo"
[[ "$tag" =~ ^[A-Za-z0-9_.+/-]+$ ]] || fail "invalid tag: $tag"
# gh matches the name as a glob pattern, so glob characters are refused to keep the match exact.
[[ "$asset" =~ ^[A-Za-z0-9_.+-]+$ ]] || fail "invalid asset name: $asset"
[[ -n "$output" && "$output" != */ ]] || fail 'the output must be a file path'
max_time="${FETCH_RELEASE_MAX_TIME:-120}"
[[ "$max_time" =~ ^[1-9][0-9]*$ ]] || fail 'FETCH_RELEASE_MAX_TIME must be a whole number of seconds'

encoded_tag="${tag//\//%2F}"
encoded_tag="${encoded_tag//+/%2B}"
url="https://github.com/$repo/releases/download/$encoded_tag/$asset"

part="$(mktemp "$(dirname -- "$output")/.fetch-release-asset.XXXXXX")"
trap 'rm -f -- "$part"' EXIT

if curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --retry 2 --retry-max-time 60 --connect-timeout 15 --max-time "$max_time" \
  --output "$part" "$url"; then
  route='release download URL'
else
  status=$?
  printf '::warning::Release download failed (curl exit %s) for %s; trying the GitHub REST API\n' "$status" "$url"
  if [[ -z "${GH_TOKEN:-}" ]]; then
    [[ -n "${GITHUB_TOKEN:-}" ]] || fail 'the REST API route needs GH_TOKEN or GITHUB_TOKEN in the environment'
    export GH_TOKEN="$GITHUB_TOKEN"
  fi
  command -v gh > /dev/null || fail 'the REST API route needs the gh CLI'
  export GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1
  for attempt in 1 2 3; do
    if gh release download "$tag" --repo "$repo" --pattern "$asset" --output "$part" --clobber; then
      route='REST API'
      break
    fi
    [[ "$attempt" -lt 3 ]] || fail "the REST API route failed too for $repo $tag $asset"
    sleep $((attempt * 5))
  done
fi

[[ -s "$part" ]] || fail "downloaded an empty file for $repo $tag $asset"
mv -f -- "$part" "$output"
trap - EXIT
printf 'fetch-release-asset: %s %s %s through the %s\n' "$repo" "$tag" "$asset" "$route"
