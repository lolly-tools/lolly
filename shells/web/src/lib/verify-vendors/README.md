# Verify vendor marks

Path data from [Simple Icons 13.0.0](https://github.com/simple-icons/simple-icons/tree/13.0.0/icons), under CC0 (see LICENSE.md). Marks identify software named in a file; they do not imply endorsement or verified authorship. Served locally without requests to vendors.

## Registry

`registry.json` lists the products Verify can identify: an id, the product's name, its kind (`software`, `device`, `ai`, `signer` or `scheme`), the patterns a recorded name is matched against and, when one is held, the key of its mark in `marks.json`. The first entry that matches wins, so a product sits before its maker. `identify.ts` holds the lookup, `identifyVendor()`.

A product with no mark draws a monogram of its initials in the same box. A mark or a monogram identifies a product. It says nothing about whether the claim that recorded the product is true, which is why every vendor chip also states how strong the evidence is.

To add a mark, copy the path data from the pinned Simple Icons release and add the key to the entry. `identify.test.ts` checks that every pattern compiles, every mark exists and every name identifies its own entry.
