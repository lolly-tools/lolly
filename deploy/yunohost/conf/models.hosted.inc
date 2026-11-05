# Model weights from the default host (models_source = lolli): nothing is served
# here, and the probe answers 404 so the web build keeps its built-in model host.
location = /models-base.txt {
    include /etc/nginx/conf.d/__DOMAIN__.d/__APP__.headers.inc;
    more_set_headers "Cache-Control: private, no-store, max-age=0, no-transform" "CDN-Cache-Control: no-store";
    return 404;
}
