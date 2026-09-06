#!/bin/bash

#=================================================
# COMMON VARIABLES AND CUSTOM HELPERS
#=================================================

# The nginx location file includes this sibling on every location (see
# conf/security-headers.inc). It is not a *.conf, so the domain's server block does
# not include it a second time by itself.
headers_inc="/etc/nginx/conf.d/$domain.d/$app.headers.inc"

# Install or refresh the header include. Called before ynh_config_add_nginx in
# every script, because the nginx config refers to it and nginx -t would fail
# without it.
lolly_add_headers_inc() {
    ynh_config_add --template="security-headers.inc" --destination="$headers_inc"
}
