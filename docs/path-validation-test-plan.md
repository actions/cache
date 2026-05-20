# Path Validation Test Plan (`actions/cache@v5.1+`)

This document describes the test coverage for the client-side path-validation
feature added to `actions/cache` v5.1.0. The validation feature itself lives
in the `@actions/cache` toolkit (v6.1.0+); this action wires the new
`strict-paths` and `fail-on-cache-invalid` inputs through to the toolkit and
handles the `CacheIntegrityError` it can throw.

The companion document in the toolkit repo
([`packages/cache/docs/path-validation-test-plan.md`](../../actions-toolkit/packages/cache/docs/path-validation-test-plan.md))
covers the **behavioral** tests for the validation engine itself. This document
focuses on the **action-layer** wiring tests.

## Summary

| Layer                                | Test file                                          | Tests | What it validates                                                                                                  |
| ------------------------------------ | -------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| Input parsing                        | `__tests__/actionUtils.test.ts`                    | 9 new | `getPathValidationInput()` normalizes input values, defaults to `warn`, warns on unknown values                    |
| restoreImpl integration              | `__tests__/restoreImpl.test.ts`                    | 9 new | Forwards `strict-paths` to `cache.restoreCache`, handles `CacheIntegrityError` per `fail-on-cache-invalid`         |
| Regression — existing forward tests  | `__tests__/restoreImpl.test.ts` (updated)          | 11    | Existing tests now assert the `pathValidation` field is present in the options object passed to `cache.restoreCache`|
| End-to-end (good cache)              | `.github/workflows/path-validation-e2e.yml`        | 18    | A legitimate cache restores successfully under all three `strict-paths` modes on every supported OS                |
| End-to-end (poisoned cache)          | `.github/workflows/path-validation-e2e.yml`        | 18    | A poisoned cache is treated correctly per mode (extracted in `off`/`warn`, rejected in `error`)                    |
| End-to-end (fail-on-cache-invalid)   | `.github/workflows/path-validation-e2e.yml`        | 3     | When `fail-on-cache-invalid: true` and the cache is rejected, the restore step itself fails the workflow          |

Total: **77 new/updated tests** at the action layer (29 unit + 39 E2E job runs + 9 input-parsing).

## Unit tests

### `__tests__/actionUtils.test.ts` — `getPathValidationInput()` (9 new)

Verifies the input-parsing helper that the action's `restoreImpl` uses to
translate the `strict-paths` workflow input into the literal type expected by
the toolkit.

| Test                                                                | Asserts                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| returns `'warn'` when input is unset                                | Default behavior matches the action.yml default                                        |
| normalizes `off` / `warn` / `error` / `OFF` / `Warn` / `ERROR`      | Case-insensitive parsing of the three valid values                                     |
| falls back to `'warn'` for unrecognized values and logs a warning   | Typos don't silently disable validation; user gets a workflow warning via `core.info`  |
| treats empty string as default `'warn'`                             | Defensive default in case the workflow runner passes an empty string                   |

### `__tests__/restoreImpl.test.ts` — Path-validation wiring (9 new)

Verifies `restoreImpl` forwards the input to the toolkit and handles its
errors per the `fail-on-cache-invalid` input.

| Test                                                                                            | Asserts                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| defaults strict-paths to `'warn'` and forwards it to `restoreCache`                              | Default option object contains `pathValidation: 'warn'`                                                                          |
| `test.each(['off', 'warn', 'error'])` forwards each value to `restoreCache`                      | All three valid values reach the toolkit unchanged                                                                               |
| falls back to `'warn'` when strict-paths input is unrecognized                                   | Unknown values are coerced to `'warn'` and a warning is logged                                                                   |
| treats `CacheIntegrityError` as a cache miss by default                                          | When the toolkit throws `CacheIntegrityError` and `fail-on-cache-invalid: false`, action logs the rejection and returns without setting the `cache-hit` output (intentionally unset to match regular cache-miss semantics — see issue #1466) |
| fails when `CacheIntegrityError` is raised and `fail-on-cache-invalid: true`                     | When `fail-on-cache-invalid: true`, `core.setFailed()` is called with a message containing `integrity validation` and the code   |
| propagates non-integrity errors normally                                                         | Network/auth errors still surface via `core.setFailed()` rather than being mis-classified as integrity failures                  |
| `PARSE_ERROR` integrity failure also treated as miss by default                                  | Validation handles both `PATH_VIOLATION` and `PARSE_ERROR` codes identically                                                     |
| tolerates `CacheIntegrityError` without explicit `.code`                                         | If the toolkit ever omits a code, the action still degrades gracefully (logs `unknown`)                                          |
| does not set `cache-hit` output when integrity error is rethrown                                 | When `fail-on-cache-invalid: true`, no `cache-hit` output is set (preserves existing miss semantics for downstream `if:` checks) |

### Detection strategy for `CacheIntegrityError`

The action detects integrity errors by **name** (`err.name === 'CacheIntegrityError'`) rather than `instanceof`. This is intentional:

* The `@actions/cache` toolkit is shipped as ESM, while the action's runtime is
  bundled by `ncc` into CJS. Cross-module-system `instanceof` checks are
  fragile (different module realms, two copies of the class).
* The toolkit guarantees `name === 'CacheIntegrityError'` via the class
  constructor.
* The toolkit also attaches a stable `code` property whose value is one of
  `'PARSE_ERROR' | 'PATH_VIOLATION' | 'CHECKSUM_MISMATCH'`. The action surfaces
  this code in the workflow log so users can diagnose rejections.

This approach is covered by the **tolerates `CacheIntegrityError` without
explicit `.code`** test — even if the toolkit changes the shape of its error,
the action continues to recognize and handle it.

## End-to-end workflow

[`.github/workflows/path-validation-e2e.yml`](../.github/workflows/path-validation-e2e.yml)
runs three jobs:

### 1. `good-cache` — legitimate cache restores correctly under all modes (18 runs)

Matrix: `[ubuntu-latest, ubuntu-22.04, macos-latest, macos-13, windows-latest, windows-2022]` × `[off, warn, error]`.

For each combination:

1. Generates a directory `path-validation-cache/` with 5 small files.
2. Saves it using `actions/cache@./` with a unique key.
3. Removes the local directory.
4. Restores using `actions/cache@./` with `strict-paths: ${{ matrix.strict-paths }}` and `fail-on-cache-invalid: true`.
5. Asserts `cache-hit == 'true'` and all 5 files are present.

This validates that **enabling path validation does not regress legitimate
caches** — a critical false-positive check on every supported platform and
both archive formats (gnu-tar on Linux/macOS, bsdtar on Windows).

### 2. `poisoned-cache` — poisoned cache is handled per mode (18 runs)

Same matrix. For each combination:

1. Generates a directory `path-validation-cache/` with one legitimate file.
2. Generates an `escape.txt` file **outside** the declared `path` (in the workspace root, one level up from `path-validation-cache/`).
3. Uses the toolkit's `saveCache()` directly (via `__tests__/e2e/save-poisoned-cache.mjs`) to upload a cache that includes BOTH paths. This produces an archive whose entries, when extracted relative to the declared `path` on restore, would write `escape.txt` outside the declared path.
4. Removes local files.
5. Restores via `actions/cache@./` declaring **only** the legitimate `path` (this is what an unsuspecting downstream consumer would do).
6. Asserts per-mode:
   * **`off`**: `cache-hit == 'true'`, `escape.txt` IS present (validation disabled = legacy behavior).
   * **`warn`**: `cache-hit == 'true'`, `escape.txt` IS present (validation does not block extraction in warn mode), and a workflow warning should be visible in the log.
   * **`error`**: `cache-hit == 'false'`, NEITHER `escape.txt` NOR `path-validation-cache/legit.txt` exists (the archive was rejected before any extraction).

This validates the **false-negative** axis — the path-validation logic
correctly identifies a real cross-path entry on every supported OS.

### 3. `poisoned-cache-fail-on-invalid` — rejected cache fails the workflow when configured to (3 runs)

Matrix: `[ubuntu-latest, macos-latest, windows-latest]`.

Same setup as job 2, but with `fail-on-cache-invalid: true`. The restore step
itself is expected to **fail** (step `outcome == 'failure'`). The job uses
`continue-on-error: true` on the restore step so we can assert on its outcome
rather than the job failing.

This validates the workflow-fail path that strict security-conscious users
will enable in production pipelines.

## Manual tests

Before tagging a release, run the following manual sanity checks:

### Manual test 1: existing workflow regressions

In a workflow file that uses `actions/cache@<branch>` (no path-validation
inputs set), run a normal cache save + restore cycle. Verify:

* The action behaves identically to v5.0.x.
* No new warnings appear in the log for a clean cache.
* `cache-hit` output is set correctly.

### Manual test 2: warn-mode visibility

Configure a workflow that uses `actions/cache@<branch>` with
`strict-paths: warn` (the default in v5.1+). Confirm that:

* For a clean cache, no warning is logged.
* For a poisoned cache (use the E2E helper to create one), a single `::warning::`
  annotation appears in the workflow summary, mentioning the path violation
  and the offending entry.

### Manual test 3: error mode with fail-on-cache-invalid

Configure a workflow:

```yaml
- uses: actions/cache@<branch>
  with:
    key: ...
    path: ./build
    strict-paths: error
    fail-on-cache-invalid: true
```

Trigger a restore of a poisoned cache. Confirm:

* The workflow fails at the cache restore step.
* The failure annotation includes the code (e.g., `PATH_VIOLATION`) and a
  short message describing the violation.

### Manual test 4: cross-OS cache restore (`enableCrossOsArchive: true`)

Save a cache on Linux with one path, restore it on Windows with the same
path under each `strict-paths` value. Confirm validation behaves the same
way across the OS boundary (this exercises both `gnu-tar` archive
production and `bsdtar`-on-Windows extraction).

### Manual test 5: large real-world cache

Restore a realistic, multi-gigabyte cache (e.g., a `node_modules`
deep-dependency tree) with `strict-paths: warn`. Measure:

* No measurable regression in restore wall time.
* No false-positive warnings for paths containing `..` segments that resolve
  to valid in-workspace locations (e.g., symlinks inside the cache).

## What's NOT tested here

* **The validation algorithm itself.** Comprehensive tests for path
  resolution, glob expansion, env-var substitution, and parse-error
  classification live in the toolkit repo
  ([`packages/cache/__tests__/pathValidation.test.ts`](../../actions-toolkit/packages/cache/__tests__/pathValidation.test.ts),
  [`listAndValidate.test.ts`](../../actions-toolkit/packages/cache/__tests__/listAndValidate.test.ts), and
  [`tarPathValidation.test.ts`](../../actions-toolkit/packages/cache/__tests__/tarPathValidation.test.ts)).
* **`saveCache` validation.** This change adds restore-side validation only.
  The save path does not validate the entries it creates (and does not need
  to — saves operate on paths the user explicitly declared in this action's
  inputs).
* **Server-side scanning.** This is a client-side defence-in-depth control;
  it does not replace server-side cache-poisoning mitigations.

## How to run

```bash
# unit tests (Jest + ts-jest)
npm test

# rebuild distribution bundles
npm run build

# full lint + format + tests + build
npm run format-check && npm run lint && npm test && npm run build
```

For the E2E workflow, push the changes to a branch and trigger the
`Path Validation E2E` workflow. All 39 matrix entries should pass; any
matrix-entry failure indicates the validation logic disagrees with this
plan on a specific OS/archive-format combination.

## Local development note

The `@actions/cache` toolkit v6.1.0 used by this action is currently
unpublished. For local development:

1. From the toolkit repo: `cd packages/cache && npm pack`
2. From this repo: `npm install /path/to/actions-toolkit/packages/cache/actions-cache-6.1.0.tgz`
3. After running `npm install`, restore `package.json`'s
   `"@actions/cache": "^6.1.0"` specifier (npm rewrites it to a `file:` URL
   when installing from a tarball).

Once the toolkit is published to npm, `npm install` will resolve `^6.1.0`
directly from the registry and step 1-3 are no longer needed.

Jest cannot load the ESM-only toolkit directly. The `jest.config.js` file
includes a `moduleNameMapper` that redirects `@actions/cache` imports during
tests to a CJS stub at
[`__tests__/__mocks__/actions-cache.ts`](../__tests__/__mocks__/actions-cache.ts).
The stub re-implements just the surface the action consumes (with the same
validation behavior for keys and paths) so tests can spy/mock on it. The
production bundle (built by `ncc`) uses the real ESM module — verified by
grepping for `pathValidation` and `CacheIntegrityError` symbols in the
bundled `dist/restore/index.js`.
