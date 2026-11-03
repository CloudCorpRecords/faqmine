# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `mine_faq` MCP tool and `mine`
  CLI command mining caller-supplied closed issues for
  repeated questions and drafting FAQ entries; no
  answers are invented.
- Pinned clustering rule: a title's question key is its
  lowercase tokens split on non-alphanumeric runs, minus
  the pinned stopword list, distinct and sorted
  code-unit ascending and joined with single spaces;
  issues cluster exactly when their keys are equal, and
  an empty key belongs to no cluster.
- FAQ entries carry the cluster's first title verbatim,
  its count, its urls in input order, and the distinct
  union of its labels sorted code-unit ascending; entries
  are ordered by count descending, then by the input
  position of the cluster's first issue. Counts report
  the total issues, the number of entries, the clustered
  issues, and the unclustered issues.
- Path-naming validation errors for malformed input;
  no partial results on invalid input.
