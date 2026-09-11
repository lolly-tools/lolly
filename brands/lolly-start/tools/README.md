# lolly-start tools

The blank brand ships no brand-specific tools: every tool it offers comes from
`community/`. This directory exists so `profiles.json` can mount the pack the
same way it mounts a brand that does carry tools (the content resolver reads
each `tools` root a profile names). Add a tool here only when it cannot be
brand-agnostic; a tool that works on any brand belongs in `community/`.
