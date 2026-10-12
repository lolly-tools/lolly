// SPDX-License-Identifier: MPL-2.0
export const yamlEquivalentBefore = '# PRIVATE_YAML_COMMENT_BEFORE\nservice:\n  name: CONFIDENTIAL_YAML_NAME\n  enabled: true\n  replicas: 2\n';
export const yamlEquivalentAfter = '# PRIVATE_YAML_COMMENT_AFTER\nservice: {replicas: 2, enabled: true, name: "CONFIDENTIAL_YAML_NAME"}\n';
export const yamlChangedBefore = 'items:\n  - id: north\n    note: PRIVATE_YAML_BEFORE\n  - id: south\n    note: stable\n';
export const yamlChangedAfter = 'items:\n  - id: south\n    note: stable\n  - id: north\n    note: PRIVATE_YAML_AFTER\n';
export const yamlRefusedBefore = 'root: &PRIVATE_YAML_ANCHOR\n  value: CONFIDENTIAL_YAML_PARSER_BEFORE\ncopy: *PRIVATE_YAML_ANCHOR\n';
export const yamlRefusedAfter = 'root: &PRIVATE_YAML_ANCHOR\n  value: CONFIDENTIAL_YAML_PARSER_AFTER\ncopy: *PRIVATE_YAML_ANCHOR\n';
