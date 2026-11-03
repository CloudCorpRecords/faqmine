/**
 * faqmine types.
 *
 * faqmine mines caller-supplied closed issues for
 * repeated questions and drafts FAQ entries. For each
 * issue the caller supplies its title and link, and
 * optionally its labels. The caller may also supply the
 * minimum cluster size for an FAQ entry. From that data
 * alone, as pure local computation, faqmine reports:
 *
 *   - one FAQ entry per repeated-question cluster at or
 *     above the minimum size: the cluster's first title
 *     verbatim, the cluster size, the issue urls in input
 *     order, and the distinct union of the cluster's
 *     labels sorted code-unit ascending
 *   - counts: the number of supplied issues, the number
 *     of FAQ entries, how many issues were clustered,
 *     and how many were not
 *
 * Clustering is by a pinned title-normalization rule
 * (see faqmine.ts): two issues cluster together exactly
 * when their question keys are equal. No answer text is
 * ever generated.
 */

/** One FAQ entry drafted from a repeated-question cluster. */
export interface FaqEntry {
  /** Title of the cluster's first issue, echoed verbatim. */
  question: string;
  /** Number of issues in the cluster. */
  count: number;
  /** The cluster's issue urls, in input order. */
  urls: string[];
  /** Distinct union of the cluster's labels, sorted code-unit ascending. */
  labels: string[];
}

/** Issue tallies for a mining run. */
export interface FaqCounts {
  /** Number of issues supplied. */
  issues: number;
  /** Number of FAQ entries (included clusters). */
  clusters: number;
  /** Issues in included clusters. */
  clustered_issues: number;
  /** Every other supplied issue (below-threshold clusters and empty-key issues). */
  unclustered: number;
}

/** The full FAQ draft. */
export interface FaqmineResult {
  /** One entry per included cluster, sorted by count descending, then by first-issue input position ascending. */
  entries: FaqEntry[];
  /** Issue tallies. */
  counts: FaqCounts;
}
