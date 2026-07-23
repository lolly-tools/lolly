{{/*
Base name of the chart.
*/}}
{{- define "lolly.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Release-scoped base fullname (DNS-safe, <=63 chars).
*/}}
{{- define "lolly.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "lolly.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Per-component fullname: "<release-fullname>-<component>" (e.g. lolly-web).
Usage: {{ include "lolly.componentFullname" (dict "root" . "name" "web") }}
*/}}
{{- define "lolly.componentFullname" -}}
{{- printf "%s-%s" (include "lolly.fullname" .root) .name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for a component. Pass (dict "root" . "name" "<component>").
*/}}
{{- define "lolly.componentLabels" -}}
helm.sh/chart: {{ include "lolly.chart" .root }}
{{ include "lolly.componentSelectorLabels" . }}
{{- if .root.Chart.AppVersion }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: {{ include "lolly.name" .root }}
{{- end }}

{{/*
Selector labels for a component (stable — never include version/checksum).
*/}}
{{- define "lolly.componentSelectorLabels" -}}
app.kubernetes.io/name: {{ include "lolly.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .name }}
{{- end }}

{{/*
Image reference for a component. Pass (dict "image" .Values.web.image "root" .).
tag defaults to the chart appVersion.
*/}}
{{- define "lolly.componentImage" -}}
{{- $tag := default .root.Chart.AppVersion .image.tag -}}
{{- printf "%s:%s" .image.repository $tag -}}
{{- end }}

{{/*
Shared ServiceAccount name.
*/}}
{{- define "lolly.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "lolly.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
CA Secret name — the existing secret if provided, else the chart-managed one.
*/}}
{{- define "lolly.ca.secretName" -}}
{{- if .Values.ca.existingSecret }}
{{- .Values.ca.existingSecret }}
{{- else }}
{{- printf "%s-secrets" (include "lolly.componentFullname" (dict "root" . "name" "ca")) }}
{{- end }}
{{- end }}
