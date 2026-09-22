#!/bin/bash

#=================================================
# COMMON VARIABLES AND CUSTOM HELPERS
#=================================================

# The nginx location file includes this sibling on every location (see
# conf/security-headers.inc). It is not a *.conf, so the domain's server block does
# not include it a second time by itself.
headers_inc="/etc/nginx/conf.d/$domain.d/$app.headers.inc"

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

# Install or refresh the header include. Called before ynh_config_add_nginx in
# every script, because the nginx config refers to it and nginx -t would fail
# without it.
lolly_add_headers_inc() {
    local lolly_csp_extra_connect_src
    lolly_csp_extra_connect_src=$(lolly_normalize_connect_src "${csp_extra_connect_src:-}") \
        || ynh_die "Invalid extra CSP origins. Use space-separated HTTPS origins without paths or wildcards."
    # The leading space belongs to the addition so an empty setting produces the
    # hosted policy byte for byte.
    lolly_csp_extra_connect_src="${lolly_csp_extra_connect_src:+ $lolly_csp_extra_connect_src}"
    ynh_config_add --template="security-headers.inc" --destination="$headers_inc"
}
