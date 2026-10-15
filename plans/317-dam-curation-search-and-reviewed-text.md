# DAM curation, search and reviewed text

Date: 2026-10-16

Follow plans 312 and 313 through the approved sequence: shared asset inspector, organisation fields, shared search, then reviewed text indexing. Build on the bounded browse branches from plan 314, which already implement paging, live source search, source status and a basic organisation field editor. Keep these dependencies explicit in the PRs.

## Implementation

1. Present indexed source identity, version, sync status, availability constraints, mapped approval and original/rendition facts in the inspector. Unknown remains unknown. A sync time is not proof of current upstream permission, and mapped approval is not a contextual rights decision.
2. Complete the organisation field editor with typed controls, read-only presentation, visible failures and explicit saves. Keep source metadata separate. Definitions remain Work policy; source names, descriptions and tags are not editable through overlays.
3. Make indexed versus live text search clear in shared browse. Reuse bounded requests, current permission filters, exact filter compatibility and incomplete-result messages. Verify query changes, failures, and cancellation of old results in the real view.
4. Offer text extracted on-device for review. Send only after the curator explicitly saves. Bind reviewed text to one selected file and indexed source revision. Reject a stale save, omit stale bound text from both search paths, expose index status, and allow clearing. Retain existing unbound text as explicitly unverified for backward compatibility. No background extraction or vendor model call.

## Ownership and dependencies

Lolly owns inspector, field controls, search presentation and review UI. Work owns permissions, source revision checks, bounded text storage, freshness checks and auditing. The Work counterpart is `plans/82-dam-reviewed-text-and-curation.md`. No engine API change or package pin update is required. New branches are stacked on `feat/314-paged-assets` and `feat/314-paged-browse`, which themselves depend on the provider branches. Main checkouts remain untouched.

## Acceptance

- Denied, failed and malformed metadata reads are visible; field saves retain input on failure and refresh shared search on success.
- Ordinary readers see facts and fields without edit actions. Curators can save only configured field types.
- Shared search shows the query and mode, returns a bounded set and never silently drops exact filters.
- Text extraction itself performs no write to Work. Review, save and clear are explicit; no extracted words appear in audit or ordinary catalog feeds.
- Record file identity, indexed revision, extraction method, reviewer and time. A changed indexed source stops matching old bound words and requires another read.
- Existing legacy metadata and text APIs keep working. Revision binding describes the indexed snapshot, not a proof of historical bytes or instant upstream revocation.
- Focused backend permission/freshness tests, UI behaviour tests, typechecks, repository wording/lint gates and scans pass. Tenant qualification remains outstanding for both real providers.

## Execution

Implemented in `feat/dam-curation-search-20261016` and `feat/dam-reviewed-text-20261016`. The shared inspector shows source facts, unknown approval, distinct source/local availability constraints, selected file role, organisation field controls and text-index status. Field edits remain on screen after a failed save. Shared browse identifies indexed/live search mode and the current query, explains searchable metadata, and offers a clear-search action.

Image OCR and SVG/PDF extraction offer an editable review form without a Work write. The explicit save records up to 8192 reviewed characters, extraction method, selected file, indexed revision, reviewer and time. Work enforces catalog editing authority and current source exposure, refuses stale submissions, and excludes bound stale text from both indexed and live-search local matches. Clear preserves organisation fields. Legacy unbound records remain searchable with an unverified label. Source approval is preserved as an optional mapped fact.

Cached Work-owned primary files are matched only when unambiguous, with version and checksum checks before offering a review. The bounded catalog metadata reader is now separate from the bridge projection, removing the browse/asset bridge dependency cycle. The engine and its vendored Work snapshot are unchanged.

Evidence: five new Work permission/freshness tests and eight new UI curation tests passed, together with existing provider, browse, metadata, availability, selected-file and cache regression suites. Full Work and installed-project Lolly typechecks passed; the normal optional Tauri dependency checks skipped. The real Assets browser walkthrough passed selection, field editing, actual SVG text extraction, review/save, search/clear and access-loss handling. Desktop and 390px mobile review screenshots are retained in `plans/317-evidence/` in the Lolly worktree, with no horizontal overflow. Image OCR inference was not exercised in a browser; its publication path is covered by the UI tests. Built documentation scans skipped where no generated /info site was present.

Lint across all source files, maintainability, UI/comment wording and generated source statistics passed. Work source scanning passed all 324 applicable files with complete parser coverage. Pinned staged secret scans and branch hygiene are recorded at handoff. These changes remain review branches, not a deployment. Real Cloudinary and Orange Logic tenant qualification remains outstanding.
