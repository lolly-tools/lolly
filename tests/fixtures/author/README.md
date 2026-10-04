# Design authoring fixture

A synthetic Design document written with the authoring keys of `design-authoring-v1` (plan 291 W5), and the stored rows it expands to. `tests/design-authoring.test.ts` checks that `input.json` expands to `expected.json` exactly, and checks the geometry, ids and paint order of the traps below against hand arithmetic, so a wrong `expected.json` cannot pass on its own.

The traps come from a hand-built branded deck:

- a stack with a divider before every item but the first, each divider named after the item it precedes;
- a column-major matrix where one item leaves out a slot and restyles another;
- a table with a divider before each row after the first, a label per row and an empty cell;
- a grid with a rule per cell and one item moved down;
- cubic connectors placed in artboard coordinates and ending on one node, one of them flat (a 1 px box);
- artboards away from the canvas origin, one listed after its own layers, numbers given as strings, and a stored row that passes through untouched.

No brief is used, so unstyled text takes the built-in body style and black or white by contrast with its artboard. The colours, text and asset ids are made up.

To regenerate `expected.json` after a deliberate change to the expansion, write the rows of `expandDesignAuthoringDocument(input).rows` one per line, then read the diff row by row before committing it.
