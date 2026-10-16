# lolly-demo tools

The demo brand ships no brand-specific tools: every tool it offers comes from
`community/`. This directory exists so `profiles.json` can mount the pack the
same way it mounts a brand that does carry tools (the content resolver reads
each `tools` root a profile names). Template overlays for the demo brand will
live here when they arrive; an overlay's `tool.json` replaces the community one,
so keep them few.
