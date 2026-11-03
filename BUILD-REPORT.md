# faqmine — Build Report

MCP Rebuild 1000, Batch 19. Original program build from the
packages-100 plan (cluster G #84), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch19/faqmine.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `faqmine`, npm `@reneturcios/faqmine`,
MCP name `io.github.CloudCorpRecords/faqmine`, version
`0.1.0`, bin `faqmine` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Mine
  supplied closed issues for repeated questions; draft an
  FAQ with counts and links." — 87 chars, verified by
  count; npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/faqmine:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/faqmine"`),
  `tsconfig.json` (byte-identical to the reference),
  `.gitignore`, `LICENSE` (MIT, Copyright (c) 2026 Rene
  Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`mine --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/faqmine.ts` (core,
  `VERSION = "0.1.0"`, `mineFaq`, `formatPayload`,
  plus the exported `questionKey` helper the tests pin
  the clustering rule through)
- `test/faqmine.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/faqmine`,
  smoke-test server-name assertion `faqmine`; the other
  three workflows are byte-identical to the reference)

Plus the parity fixture at
`harness/fixtures/faqmine-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster G #84.

## Tools implemented (1)

- `mine_faq` — arguments: `issues` (array, required, at
  least 1 item) and `min_count` (integer, optional,
  >= 2, default 2). Each issue item: `title` (string,
  required, non-empty), `url` (string, required,
  non-empty), and `labels` (array of strings, optional,
  absent means []). Required is exactly `["issues"]` at
  the top level and `["title", "url"]` per item.

  The question key is pinned: lowercase the title; split
  into tokens on every run of non-alphanumeric
  characters; drop empty tokens; drop the pinned
  stopwords (a, an, the, is, are, was, were, do, does,
  did, how, what, why, when, where, which, who, can,
  could, should, would, i, we, you, it, to, of, in, on,
  for, with, and, or, not, no, my, me, this, that, there,
  here); take the distinct remaining tokens, sort them
  code-unit ascending, and join with a single space.
  Two issues cluster together exactly when their keys
  are equal; an issue whose key is the empty string
  belongs to no cluster.

  Returns `{entries, counts}`, where each entry is
  `{question, count, urls, labels}` in that key order —
  question the title of the cluster's first issue in
  input order, echoed verbatim; urls in input order;
  labels the distinct union of the cluster's labels
  sorted code-unit ascending — entries sorted by count
  descending with ties broken by the input position of
  the cluster's first issue, ascending; and `counts` is
  `{issues, clusters, clustered_issues, unclustered}`
  in that key order, with unclustered counting every
  supplied issue outside the included clusters
  (below-threshold clusters and empty-key issues). No
  answer text is ever generated.

  The fixture literal
  (`harness/fixtures/faqmine-tools-original.json`) and the
  `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing,
  non-array, or empty `issues`; a non-object item; a
  missing, empty, or non-string `title` or `url`; a
  `labels` value that is not an array or that holds a
  non-string or empty string; or a present `min_count`
  that is non-integer or < 2 throws an Error naming the
  offending path (e.g. `issues[0].labels[1] must be a
  non-empty string`) and produces no partial result
  (MCP: `isError`; CLI: exit 1). Unknown extra fields
  are ignored, including inside items; a non-object
  top-level argument is treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **39 tests,
  39 pass, 0 fail** — the pinned key rule pinned directly
  (lowercase / stopword drop / distinct / code-unit sort /
  single-space join, word order irrelevant, punctuation
  and case insignificant, repeated tokens collapsing,
  every pinned stopword dropped, stopword-only and
  punctuation-only titles keying to "", digits kept,
  non-listed words surviving); clustering end to end
  (word-order variants "How do I reset my password?" vs
  "Password reset — how?" in one entry with the first
  title verbatim, the verbatim question and url order
  following input order when the pair is swapped, case /
  punctuation variants, distinct questions not
  clustering, repeated stopword-only titles unclustered,
  no answer field on any entry); the threshold (default
  2 with a singleton excluded but counted, a cluster of
  exactly min_count included, one below excluded but
  counted in unclustered, per-cluster application);
  labels (distinct union sorted code-unit ascending
  across a mixed-case set, absent and empty meaning none,
  no leakage from unclustered issues, within-issue
  duplicates collapsing); ordering and counts shape
  (count descending, ties by first-issue input position,
  urls in input order, counts keys in the pinned order
  with clustered + unclustered = issues on a mixed
  input, top-level keys entries then counts); and every
  validation path (issues missing / non-array / empty,
  non-object items, title and url missing / empty /
  non-string, labels non-array and bad entries naming
  `issues[i].labels[j]`, min_count 1 / 0 / negative /
  fractional / string / boolean / null / array / object
  plus 2 and larger integers valid, non-object top-level
  treated as {}, unknown extras ignored, no partial
  result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `node dist/cli.js --version` → `0.1.0`; unknown command
  exits 2 with usage; `mine` with no `--input` exits 2;
  `mine --input <valid file>` exits 0 and prints the
  hand-checked draft for the input `{"issues":
  [{"title": "How do I reset my password?", "url":
  "https://example.com/issues/1", "labels": ["account",
  "auth"]}, {"title": "Password reset — how?", "url":
  "https://example.com/issues/2", "labels": ["auth"]},
  {"title": "Export to CSV fails", "url":
  "https://example.com/issues/3"}]}` — one entry with
  the first title verbatim, count 2, both urls in input
  order, labels `["account", "auth"]`, counts issues 3,
  clusters 1, clustered_issues 2, unclustered 1;
  `mine --input <invalid file>` (first item's second
  label the empty string) exits 1 with
  `error: issues[0].labels[1] must be a non-empty string`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/faqmine-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/faqmine`, **128 package entries**. The
subsequent offline `npm install --ignore-scripts
--offline`, build, tests, and parity all ran against
this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated test
  where applicable): (1) the stopword list is implemented
  exactly as written in the spec file — 41 words by count;
  the build brief called it a 44-word list, and the spec
  file's literal list governs; (2) tokenization splits on
  runs of characters outside `[a-z0-9]` after lowercasing
  (ASCII alphanumeric), which matches every spec example;
  the spec does not pin non-ASCII letters, so a title
  token containing one would split there — no spec
  example exercises it; (3) the `labels` items schema is
  `{type: "string"}` in both the fixture and the `mcp.ts`
  literal — the spec pins `labels` as an array of strings
  without a separate items fragment, and the two literals
  agree exactly; (4) unknown extra fields are ignored
  rather than rejected, at the top level and inside items
  (the spec says so); (5) a non-object top-level arguments
  value is treated as an empty object, so it fails as
  `issues is required`; (6) error-message wording follows
  the fleet's path-naming pattern, distinguishing a
  missing field (`issues[0].title is required`) from a
  malformed one (`issues[0].title must be a non-empty
  string`), matching the spec's example. No other spec
  ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
