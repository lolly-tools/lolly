{{- define "sovereign.name" -}}
{{- printf "%s-%s" (.root.Release.Name | trunc 48 | trimSuffix "-") .name -}}
{{- end }}

{{- define "sovereign.selector" -}}
app.kubernetes.io/name: lolly-sovereign
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{- define "sovereign.labels" -}}
{{ include "sovereign.selector" . }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | quote }}
{{- end }}

{{- define "sovereign.image" -}}
{{- if not (regexMatch "^sha256:[a-f0-9]{64}$" .digest) -}}
{{- fail "Every sovereign image.digest must use sha256:<64 lowercase hexadecimal characters>" -}}
{{- end -}}
{{- if or (contains "@" .repository) (contains ":" (last (splitList "/" .repository))) -}}
{{- fail "Sovereign image.repository must not include a tag or digest" -}}
{{- end -}}
{{- printf "%s@%s" .repository .digest -}}
{{- end }}

{{- define "sovereign.service" -}}
{{- printf "%s.%s.svc.%s" (include "sovereign.name" .) .root.Release.Namespace .root.Values.clusterDomain -}}
{{- end }}

{{- define "sovereign.upstream" -}}
{{- printf "%s.%s.svc.%s:%v" .upstream.name .upstream.namespace .root.Values.clusterDomain .upstream.port -}}
{{- end }}

{{- define "sovereign.admissionName" -}}
{{- printf "%s-edge-%s" (.Release.Name | trunc 40 | trimSuffix "-") (sha256sum .Release.Namespace | trunc 8) -}}
{{- end }}

{{- define "sovereign.validate" -}}
{{- if or (eq .Values.public.host .Values.private.host) (eq .Release.Namespace .Values.edge.namespace) (eq .Release.Namespace .Values.private.server.namespace) (eq .Values.edge.namespace .Values.private.server.namespace) -}}
{{- fail "Public/private hosts and public/private/edge namespaces must be distinct" -}}
{{- end -}}
{{- if ne .Values.private.server.namespace .Values.private.relay.namespace -}}
{{- fail "The qualified private server and relay must share the private namespace" -}}
{{- end -}}
{{- if eq .Values.components.mcp.existingSecret .Values.components.ca.existingSecret -}}
{{- fail "MCP and CA must use different existingSecret references" -}}
{{- end -}}
{{- if and .Values.components.mcp.webBase (ne .Values.components.mcp.webBase (printf "https://%s" .Values.public.host)) -}}
{{- fail "components.mcp.webBase must be empty or the exact canonical public HTTPS origin" -}}
{{- end -}}
{{- $hosts := list .Values.public.host .Values.private.host -}}
{{- range concat .Values.public.redirectHosts .Values.private.redirectHosts -}}
{{- if has . $hosts -}}{{- fail "Canonical and redirect hosts must be unique" -}}{{- end -}}
{{- $hosts = append $hosts . -}}
{{- end -}}
{{- range append .Values.edge.proxyAddresses .Values.edge.upstreamSourceAddress -}}
{{- $address := trimPrefix "::ffff:" . -}}
{{- $parts := splitList "." $address -}}
{{- if or (ne (len $parts) 4) (not (regexMatch "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$" $address)) -}}
{{- fail "edge.proxyAddresses must contain measured exact IPv4 or IPv4-mapped IPv6 addresses, never CIDRs" -}}
{{- end -}}
{{- range $parts -}}
{{- if or (gt (int .) 255) (and (gt (len .) 1) (hasPrefix "0" .)) -}}
{{- fail "edge.proxyAddresses contains an invalid IPv4 address" -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end }}
