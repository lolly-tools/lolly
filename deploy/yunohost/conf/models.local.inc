# Model weights served from this server (models_source = local). Rendered to
# /etc/nginx/conf.d/<domain>.d/<app>.models.inc by lolly_add_models_inc and included
# at the top of nginx.conf, so these locations sit at server level and a prefix match
# with ^~ keeps the regex locations from taking /models/ back.
#
# The probe: the web build asks for /models-base.txt at startup (see
# shells/web/src/lib/models-base.ts). An empty body tells it to use this origin.
location = /models-base.txt {
    default_type text/plain;
    include /etc/nginx/conf.d/__DOMAIN__.d/__APP__.headers.inc;
    more_set_headers "Cache-Control: private, no-store, max-age=0, no-transform" "CDN-Cache-Control: no-store";
    return 200 "";
}

# Files fetched and checked by scripts/_common.sh: <family>@<hash16>/ is the
# content-addressed copy, <family>/ the legacy alias (hard links to the same bytes).
# No gzip: the browser checks the sha256 of the bytes it receives, ETags must stay
# strong for range resume, and ONNX weights do not compress.
location ^~ /models/ {
    root __DATA_DIR__;
    gzip off;
    etag on;
    more_set_headers "Cache-Control: private, no-store, max-age=0, no-transform" "CDN-Cache-Control: no-store";
    more_set_headers -s "200 206 304" "Cache-Control: public, max-age=0, s-maxage=0, must-revalidate, no-transform" "CDN-Cache-Control: max-age=0, must-revalidate, no-transform";
    include /etc/nginx/conf.d/__DOMAIN__.d/__APP__.headers.inc;
    default_type application/octet-stream;
    types {
        application/json    json;
        text/plain          txt md;
        application/wasm    wasm;
    }
    # The bookkeeping files in the data directory are not model files.
    location ~ /\. { return 404; }
    location ~ "^/models/[a-z0-9-]+@[0-9a-f]{16}/" {
        gzip off;
        more_set_headers "Cache-Control: private, no-store, max-age=0, no-transform" "CDN-Cache-Control: no-store";
        more_set_headers -s "200 206 304" "Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable, no-transform" "CDN-Cache-Control: max-age=31536000, no-transform";
        include /etc/nginx/conf.d/__DOMAIN__.d/__APP__.headers.inc;
    }
}
