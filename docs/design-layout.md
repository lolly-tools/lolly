# Layout in Design

A card grid that reflows when you add a card, a page of slides you can reorder, a group you move as one: this page covers the layout features of [Design](/info/using.html). It explains dynamic layouts, groups and pages, and the number fields and view controls you use to place things precisely.

## Dynamic layouts

Select a container and open **Dynamic layout** in the inspector. Choose **flex** for rows, columns and wrapping, or **grid** for tracks and cells. Set gaps, padding and alignment there.

Each child can keep a fixed size, grow to its content or fill the available space. Absolute placement attaches a child without including it in the flow.

Grid tracks accept `auto`, pixel sizes such as `120px`, fractions such as `1fr` and percentages such as `25%`. A layer can occupy a specific row and column, span several cells or share a named area.

On the canvas:

- drag a child to change its flow order or grid cell;
- hold Alt while dropping to detach the child;
- drag the spacing handles to edit padding and gaps.

A group takes part in its parent's layout as one item. **Fill** scales its contents with the space it is given; **Hug** fits the visible content in the group's own axes, and also works outside a dynamic layout. A resize that would skew a rotated child produces a finding and leaves the document unchanged, so review findings before you continue.

Native Penpot imports keep their supported flex and grid rules, including nested ones, and the solver follows the geometry of Penpot's current layout engine. Native Penpot exports carry editable rules and membership. [Import a design](/info/design-import.html#penpot-layouts-kept-or-fixed) explains which Penpot exports keep their layouts.

## Groups and pages

A Design session can hold named pages, each with its own artboards and nested groups. Use **Pages** above the layer tree to add, rename, reorder, duplicate or remove a page. Switching pages restores your selection and view without changing the saved document or another collaborator's page. Projects and their folders still organise whole sessions.

Groups appear as named containers in the layer tree:

- select a group to move, rotate, resize, duplicate or delete everything in it together;
- enter a group to select its contents, and press Escape to return to its parent;
- a hidden or locked group hides or locks everything inside;
- grouping and ungrouping keep the artwork in place and form one undo step.

Edit **Opacity** and **Blend mode** in a group's Appearance section; they apply to the group's combined artwork.

## Precise numbers and the view

Number fields in the inspector work the same way everywhere in Design:

- drag the grip beside a value to adjust it, or click the number to type;
- Shift makes a drag or arrow-key step ten times larger, and Alt ten times smaller;
- type arithmetic such as `1920/2`, a relative change such as `+10`, or a decimal comma;
- Enter or leaving the field applies the value, and Escape restores it;
- each drag or burst of arrow keys is one undo step;
- a mixed selection shows **Mixed** until you choose a shared value.

Zoom with the view controls or a pinch. Pan with the wheel, a middle-button drag or Space-drag. Every canvas edge and the pasteboard around it stay reachable when zoomed in. Use **Fit** or press **0** to see the whole canvas again.

::: details Saving, exporting and limits
Layout rules, pages and groups travel in saved sessions, share links, templates, generated tools and `.lolly` files. A `.lolly` file with dynamic layouts needs reader version 6; ordinary hierarchy needs version 7; group effects and non-fixed group sizing need version 8.

SVG, PDF and raster exports use the settled geometry. An export waits for the latest layout to appear or asks you to retry. No website code is generated.

Document exports use every page and artboard, including empty pages; choosing one artboard exports only that artboard. SVG keeps the group scopes. A PDF page with group opacity or blend is rasterised to keep its look; turning off raster fallback refuses that page.

The editor holds up to 20,000 layers and 256 pages, and the layer tree keeps a bounded number of rows mounted. Native Penpot export supports up to 6,000 layers, including generated artboards, and refuses a larger document with a clear error.
:::
