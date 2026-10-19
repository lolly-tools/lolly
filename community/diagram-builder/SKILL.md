---
name: lolly-diagram-builder
description: Build and revise Lolly Diagrams from the supported visual, text, ASCII, Mermaid, DOT, Pikchr or table inputs while preserving the source's meaning and relationships.
---

# Diagrams

Use the overall Lolly skill for design-system setup and transport selection.
Read [the diagram workflow](skill/workflow.md) before choosing a type, importing
or restyling. It holds the decision table, the sources, the look defaults, the
fidelity record, the review loop and the export checks.
Read [the actual input definitions](reference/inputs.json) for choices and defaults.

Choose a type that answers the reader's question. Hierarchies use `org` or
`mindmap`; abstraction levels use `layercake`; directed steps use `process`;
events and dated work use `timeline` or `gantt`; categories use `kanban` or
`matrix`; feedback uses `cycle`; ranked stages use `pyramid`. Quantitative
comparison belongs in a supported Chart spec. Connector ribbons have constant
width and do not encode amounts.

Describe the installed tool before writing inputs. Its manifest default is Legacy;
the interactive fresh-start path may seed Minimal. Set `look` explicitly when
reproducing output. Supported source modes do not imply full fidelity to every
construct in a source language. Native sequence, swimlane, service-blueprint,
state-machine, draw.io and Excalidraw support is not supplied by this skill.

This tool is experimental. The public render route excludes experimental tools;
use an available interactive, CLI or MCP surface and its actual output formats.
A generic live adapter edits declared inputs, rather than Design layers. Read
access is inspection only; the connection's capabilities determine operations.
