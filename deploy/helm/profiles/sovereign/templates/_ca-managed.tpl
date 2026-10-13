{{- define "lolly.ca.managedFields" -}}
{{- range $name := list "address" "mount" "serviceAccountName" "trustJson" "rolesJson" -}}
{{- if not (index $ $name) -}}{{ fail (printf "Managed CA %s is required" $name) }}{{- end -}}
{{- end -}}
{{- if not (has .auth (list "agent" "kubernetes")) -}}{{ fail "Managed CA workload authentication is required" }}{{- end -}}
{{- if eq .auth "kubernetes" -}}
{{- range $name := list "kubernetesMount" "kubernetesRole" "kubernetesAudience" -}}{{- if not (index $ $name) -}}{{ fail (printf "Managed CA %s is required" $name) }}{{- end -}}{{- end -}}
{{- else -}}{{- if not .credentialSecret -}}{{ fail "Managed CA credentialSecret is required for Vault Agent authentication" }}{{- end -}}
{{- end -}}
{{- if not .egress -}}{{ fail "Managed CA egress must specify approved peers and ports" }}{{- end -}}
{{- range .egress -}}
{{- if or (not .to) (not .ports) -}}{{ fail "Managed CA egress rules require peers and ports" }}{{- end -}}
{{- range .to -}}
{{- if or (not .) (and .ipBlock (has .ipBlock.cidr (list "0.0.0.0/0" "::/0"))) (and (hasKey . "namespaceSelector") (not .namespaceSelector)) -}}{{ fail "Managed CA egress cannot allow every destination" }}{{- end -}}
{{- end -}}
{{- end -}}
{{- end }}

{{- define "lolly.ca.managedEnv" -}}
- {name: CA_VAULT_ADDR, value: {{ .address | quote }}}
- {name: CA_VAULT_MOUNT, value: {{ .mount | quote }}}
- {name: CA_VAULT_NAMESPACE, value: {{ .namespace | quote }}}
- {name: CA_VAULT_AUTH, value: {{ .auth | quote }}}
- {name: CA_ENROLLMENT_TRUST_JSON, value: {{ .trustJson | quote }}}
- {name: CA_VAULT_ROLES_JSON, value: {{ .rolesJson | quote }}}
- {name: CA_ENROLLMENT_ALLOW_MEMORY, value: "0"}
{{- if eq .auth "kubernetes" }}
- {name: CA_VAULT_K8S_MOUNT, value: {{ .kubernetesMount | quote }}}
- {name: CA_VAULT_K8S_ROLE, value: {{ .kubernetesRole | quote }}}
- {name: CA_VAULT_K8S_JWT_FILE, value: /run/lolly-vault/jwt/token}
{{- else }}
- {name: CA_VAULT_TOKEN_FILE, value: /run/lolly-vault/credential/token}
{{- end }}
{{- if .revocationCredentialSecret }}
- {name: CA_VAULT_REVOCATION_TOKEN_FILE, value: /run/lolly-vault/revocation/token}
{{- end }}
{{- end }}

{{- define "lolly.ca.managedMounts" -}}
{{- if eq .auth "kubernetes" }}
- {name: vault-jwt, mountPath: /run/lolly-vault/jwt, readOnly: true}
{{- else }}
- {name: vault-credential, mountPath: /run/lolly-vault/credential, readOnly: true}
{{- end }}
{{- if .revocationCredentialSecret }}
- {name: vault-revocation, mountPath: /run/lolly-vault/revocation, readOnly: true}
{{- end }}
{{- end }}

{{- define "lolly.ca.managedVolumes" -}}
{{- if eq .auth "kubernetes" }}
- name: vault-jwt
  projected:
    sources:
      - serviceAccountToken:
          path: token
          audience: {{ .kubernetesAudience | quote }}
          expirationSeconds: 600
{{- else }}
- name: vault-credential
  secret:
    secretName: {{ .credentialSecret }}
    items: [{key: token, path: token}]
{{- end }}
{{- if .revocationCredentialSecret }}
- name: vault-revocation
  secret:
    secretName: {{ .revocationCredentialSecret }}
    items: [{key: token, path: token}]
{{- end }}
{{- end }}
