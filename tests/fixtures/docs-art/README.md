# docs-art fixtures

Inputs for `tests/docs-art-sign.test.ts` - the bank-time pipeline in `scripts/sign-docs-art.ts`.
They are laid out as two miniature banks (`ok/`, `refuse/`, each with `mastheads/` and `figures/`)
so a test can stage a temp `docs/` directory and run the real script end to end. **Nothing here is
banked art**: no file in this directory is ever served, inlined or published, and the pipeline is
pointed at a temp copy, never at this tree.

The `.meta.json` files are true. These artifacts were emitted by a model (Claude Opus 5, prompted
and reviewed by a human), so they declare `source: "trainedAlgorithmicMedia"` with that model
disclosed - not the `digitalCreation` a hand-typed file would carry. Declaring "no trained model
invoked" (section 18.28.3) over model-emitted bytes would be the exact under-claim the pipeline exists to
prevent, in the very files that test it. The `digitalCreation` path - where **no** AI-disclosure
assertion is attached - is exercised on an artifact the test synthesises at run time, so no
committed file makes a claim about its own origin that is not true.

`refuse/` is the adversarial half: each artifact is expected to be REFUSED, and each is named for
the rule it violates. The over-budget case is synthesised at run time instead of committed - 49 KB
of filler proves nothing a generated repeat cannot.
