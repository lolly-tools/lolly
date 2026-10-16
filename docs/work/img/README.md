# docs/img - vendored illustrative marks

Plain images the docs reference via `![alt](img/<file>)` - served member-gated at
`/api/v1/docs/img/<file>`, rendered by the console as a logo strip (no credential line).
Kept OUTSIDE `docs/shots/` on purpose: everything under shots/ must carry a C2PA
screen-capture credential (`tests/docs-shots.test.ts`), and a third-party trademark is
not ours to sign.

| File | Mark | Source |
|---|---|---|
| `rancher-icon.svg` | Rancher (SUSE) | vectorlogo.zone trace of the official mark, brand `#0076a8` - swap for the SUSE product-brand portal export when preferred |
| `k3s-icon-color.svg` | k3s (CNCF) | github.com/cncf/artwork `projects/k3s/icon/color/` |
| `helm-icon-color.svg` | Helm (CNCF) | github.com/cncf/artwork `projects/helm/icon/color/` |

All marks are the property of their respective owners, used nominatively to identify the
software they name. CNCF artwork ships under the Linux Foundation trademark usage
guidelines; keep icons unmodified.
