#!/bin/bash

#=================================================
# COMMON VARIABLES AND CUSTOM HELPERS
#=================================================

# The nginx location file includes this sibling on every location (see
# conf/security-headers.inc). It is not a *.conf, so the domain's server block does
# not include it a second time by itself.
headers_inc="/etc/nginx/conf.d/$domain.d/$app.headers.inc"
# The /any-site location's policy (conf/any-site-headers.inc): the same, with a
# frame-src that admits any https page.
any_site_inc="/etc/nginx/conf.d/$domain.d/$app.any-site.inc"
# Where the on-device model weights come from (conf/models.*.inc): the nginx locations
# for /models/ and for the /models-base.txt probe the web build asks at startup.
models_inc="/etc/nginx/conf.d/$domain.d/$app.models.inc"
# The release host the weights are fetched from for "this server". Overridable so the
# package tests can fetch from a local directory.
lolly_models_origin="${LOLLY_MODELS_ORIGIN:-https://lolli.li}"

# Only complete HTTPS origins may enter the nginx template. In particular, no
# CSP directives, nginx variables, wildcards, credentials or URL paths belong here.
lolly_normalize_connect_src() {
    local LC_ALL=C
    local value="$1" origin authority hostname port result=""
    local label='[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?'
    local origin_pattern="^https://($label\.)*$label(:[0-9]{1,5})?/?$"
    local -a origins
    [[ ${#value} -le 4096 && "$value" != *$'\n'* ]] || return 1
    IFS=' ' read -r -a origins <<< "$value"
    for origin in "${origins[@]}"; do
        [[ "$origin" =~ $origin_pattern ]] || return 1
        origin="${origin%/}"
        authority="${origin#https://}"
        hostname="${authority%%:*}"
        [[ ${#hostname} -le 253 ]] || return 1
        if [[ "$authority" == *:* ]]; then
            port="${authority##*:}"
            (( 10#$port >= 1 && 10#$port <= 65535 )) || return 1
        fi
        if [[ " $result " != *" $origin "* ]]; then
            result="${result:+$result }$origin"
        fi
    done
    printf '%s' "$result"
}

# "local" only when the admin chose this server AND the data directory holds the
# complete set for the manifest this release carries (the marker is that manifest's
# sha256). Until then the app keeps using the default host rather than serving 404s.
lolly_models_mode() {
    local marker="$data_dir/models/.complete" manifest="$install_dir/models-manifest.json"
    if [[ "${models_source:-lolli}" == local && -f "$marker" && -f "$manifest" \
          && "$(cat "$marker")" == "$(sha256sum "$manifest" | cut -d' ' -f1)" ]]; then
        printf 'local'
    else
        printf 'lolli'
    fi
}

# Fetch every file in the release's model manifest into $data_dir/models, checking size
# and sha256 against the manifest before a file is kept. Safe to run again: verified
# files are skipped and an interrupted download resumes. Nothing is served until the
# marker is written, so a failed run leaves the app on the default host.
lolly_fetch_models() {
    local manifest="$install_dir/models-manifest.json" root="$data_dir/models"
    local marker="$root/.complete" want total avail
    [[ -f "$manifest" ]] || ynh_die "This Lolly release carries no models-manifest.json, so it cannot fetch model files. Upgrade to a newer release."
    want=$(sha256sum "$manifest" | cut -d' ' -f1)
    if [[ -f "$marker" && "$(cat "$marker")" == "$want" ]]; then return 0; fi
    mkdir -p "$root"
    total=$(jq '[.[].size] | add' "$manifest")
    avail=$(df -B1 --output=avail "$root" | tail -n 1 | tr -d ' ')
    [[ "$total" =~ ^[0-9]+$ && "$avail" =~ ^[0-9]+$ ]] || ynh_die "Could not read the model manifest or the free disk space."
    (( avail > total + 536870912 )) || ynh_die "Not enough free disk space for the model files: $total bytes needed."
    rm -f "$marker"

    local url immutable size sha dest part alias attempt got
    local path_pattern='^/models/[a-z0-9-]+(@[0-9a-f]{16})?/[a-zA-Z0-9_./-]+$'
    while IFS=$'\t' read -r url immutable size sha; do
        [[ "$url" =~ $path_pattern && "$immutable" =~ $path_pattern && "$url$immutable" != *..* \
           && "$size" =~ ^[0-9]+$ && "$sha" =~ ^[a-f0-9]{64}$ ]] \
            || ynh_die "The model manifest has an entry that is not valid: $url"
        dest="$data_dir$immutable"
        mkdir -p "$(dirname "$dest")"
        if ! { [[ -f "$dest" && "$(stat -c %s "$dest")" == "$size" ]] && [[ "$(sha256sum "$dest" | cut -d' ' -f1)" == "$sha" ]]; }; then
            part="$dest.part"
            for attempt in 1 2; do
                if [[ -f "$part" && "$(stat -c %s "$part")" != "$size" ]]; then
                    curl --fail --silent --show-error --location --retry 5 --retry-delay 5 -C - -o "$part" "$lolly_models_origin$immutable" || true
                elif [[ ! -f "$part" ]]; then
                    curl --fail --silent --show-error --location --retry 5 --retry-delay 5 -o "$part" "$lolly_models_origin$immutable" || true
                fi
                got=$(stat -c %s "$part" 2>/dev/null || echo 0)
                if [[ "$got" == "$size" && "$(sha256sum "$part" | cut -d' ' -f1)" == "$sha" ]]; then break; fi
                # A resumed prefix can be stale; start the file again once.
                rm -f "$part"
                [[ "$attempt" == 2 ]] && ynh_die "Model file failed its size or sha256 check: $immutable"
            done
            mv -f "$part" "$dest"
        fi
        # The legacy path is the same bytes under the name some code paths still request.
        alias="$data_dir$url"
        mkdir -p "$(dirname "$alias")"
        ln -f "$dest" "$alias"
    done < <(jq -r '.[] | [.url, .immutableUrl, .size, .sha256] | @tsv' "$manifest")

    chown -R "$app:www-data" "$root"
    find "$root" -type d -exec chmod 750 {} +
    find "$root" -type f -exec chmod 640 {} +
    printf '%s' "$want" > "$marker"
    chown "$app:www-data" "$marker"
}

# Install or refresh the header includes and the models include. Called before
# ynh_config_add_nginx in every script, because the nginx config refers to them and
# nginx -t would fail without them.
lolly_add_headers_inc() {
    local lolly_csp_extra_connect_src lolly_models_template
    lolly_csp_extra_connect_src=$(lolly_normalize_connect_src "${csp_extra_connect_src:-}") \
        || ynh_die "Invalid extra CSP origins. Use space-separated HTTPS origins without paths or wildcards."
    # The leading space belongs to the addition so an empty setting produces the
    # hosted policy byte for byte.
    lolly_csp_extra_connect_src="${lolly_csp_extra_connect_src:+ $lolly_csp_extra_connect_src}"
    # The default host stays in the policy; a server that holds its own models drops it.
    local lolly_csp_models_host=" https://lolli.li"
    lolly_models_template="models.hosted.inc"
    if [[ "$(lolly_models_mode)" == local ]]; then
        lolly_csp_models_host=""
        lolly_models_template="models.local.inc"
    fi
    # shellcheck disable=SC2034 # read by ynh_config_add as __LOLLY_CSP_MODELS_HOST__
    lolly_csp_models_host="$lolly_csp_models_host"
    ynh_config_add --template="security-headers.inc" --destination="$headers_inc"
    ynh_config_add --template="any-site-headers.inc" --destination="$any_site_inc"
    ynh_config_add --template="$lolly_models_template" --destination="$models_inc"
}

# Render the includes, check and reload nginx, and put the previous files back if that
# fails. The caller saves its setting only after this returns.
lolly_apply_includes() {
    local previous_headers previous_any_site previous_models
    previous_headers=$(mktemp)
    previous_any_site=$(mktemp)
    previous_models=$(mktemp)
    cp -p "$headers_inc" "$previous_headers"
    cp -p "$any_site_inc" "$previous_any_site" 2>/dev/null || : > "$previous_any_site"
    cp -p "$models_inc" "$previous_models" 2>/dev/null || : > "$previous_models"
    lolly_add_headers_inc
    if ! nginx -t || ! ynh_systemctl --service=nginx --action=reload; then
        cp -p "$previous_headers" "$headers_inc"
        cp -p "$previous_any_site" "$any_site_inc"
        cp -p "$previous_models" "$models_inc"
        rm -f "$previous_headers" "$previous_any_site" "$previous_models"
        ynh_store_file_checksum "$headers_inc"
        ynh_store_file_checksum "$any_site_inc"
        ynh_store_file_checksum "$models_inc"
        return 1
    fi
    rm -f "$previous_headers" "$previous_any_site" "$previous_models"
}

# Open tabs keep requesting earlier hashes. Capture only immutable families,
# with hard links when possible, before the source helper replaces the release.
lolly_capture_immutable() {
    local lolly_source="$1" lolly_retained="$2" lolly_file lolly_relative lolly_dest
    while IFS= read -r -d '' lolly_file; do
        lolly_relative="${lolly_file#"$lolly_source/"}"
        [[ "$lolly_relative" =~ ^(_app/|ort-hf/[^/]+/|tools/[a-zA-Z0-9-]+@[0-9a-f]{16}/|models/.+@[0-9a-f]{16}/|.*\.[0-9a-f]{16}\.[a-zA-Z0-9]{1,16}(\.(gz|br))?$) ]] || continue
        lolly_dest="$lolly_retained/$lolly_relative"
        mkdir -p "$(dirname "$lolly_dest")"
        ln "$lolly_file" "$lolly_dest" 2>/dev/null || cp -p "$lolly_file" "$lolly_dest"
    done < <(find "$lolly_source" -type f -print0)
}

lolly_restore_immutable() {
    local lolly_retained="$1" lolly_target="$2" lolly_file lolly_relative lolly_dest
    while IFS= read -r -d '' lolly_file; do
        lolly_relative="${lolly_file#"$lolly_retained/"}"; lolly_dest="$lolly_target/$lolly_relative"
        if [[ -e "$lolly_dest" ]]; then
            cmp -s "$lolly_file" "$lolly_dest" || ynh_die "Immutable release collision: $lolly_relative"
        else
            mkdir -p "$(dirname "$lolly_dest")"
            cp -p "$lolly_file" "$lolly_dest"
        fi
    done < <(find "$lolly_retained" -type f -print0)
}
