/**
 * faqmine core: mine caller-supplied closed issues for
 * repeated questions and draft FAQ entries.
 *
 *   mineFaq(args) -> { entries, counts }
 *
 * The question KEY of a title (pinned): lowercase the
 * title; split into tokens on every run of
 * non-alphanumeric characters; drop empty tokens; drop
 * the pinned stopwords (see STOPWORDS below); take the
 * DISTINCT remaining tokens, sort them code-unit
 * ascending, and join with a single space. Two issues
 * cluster together exactly when their keys are equal.
 * An issue whose key is the empty string (title was all
 * stopwords/punctuation) belongs to no cluster.
 *
 * A cluster at or above `min_count` (default 2) becomes
 * one FAQ entry {question, count, urls, labels} with
 * keys in that order: question is the title of the
 * cluster's FIRST issue in input order, echoed verbatim;
 * count is the cluster size; urls are the cluster's
 * issue urls in input order; labels are the distinct
 * union of the cluster's labels, sorted code-unit
 * ascending. Entries are sorted by count descending;
 * ties break by the input position of the cluster's
 * first issue, ascending.
 *
 * counts is {issues, clusters, clustered_issues,
 * unclustered} with keys in that order: issues is the
 * number of supplied issues, clusters is the number of
 * FAQ entries, clustered_issues counts issues in
 * included clusters, and unclustered counts every other
 * supplied issue (below-threshold clusters and empty-key
 * issues).
 *
 * No answer text is ever generated: the question, the
 * count, and the links all come from the supplied
 * issues verbatim.
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and
 * no partial result is produced. Unknown extra fields
 * are ignored, including inside items; a non-object
 * top-level argument is treated as {}.
 */
import type { FaqCounts, FaqEntry, FaqmineResult } from "./types.js";

export const VERSION = "0.1.0";

/** Pinned stopword list: these tokens never enter a question key. */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "can",
  "could",
  "should",
  "would",
  "i",
  "we",
  "you",
  "it",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "and",
  "or",
  "not",
  "no",
  "my",
  "me",
  "this",
  "that",
  "there",
  "here",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The pinned question key of a title ("" when nothing survives). */
export function questionKey(title: string): string {
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return [...new Set(tokens)].sort().join(" ");
}

interface IssueFacts {
  title: string;
  url: string;
  labels: string[];
}

function parseIssue(item: unknown, index: number): IssueFacts {
  const at = `issues[${index}]`;
  if (!isRecord(item)) throw new Error(`${at} must be an object`);

  if (item.title === undefined) throw new Error(`${at}.title is required`);
  if (typeof item.title !== "string" || item.title.length === 0) {
    throw new Error(`${at}.title must be a non-empty string`);
  }

  if (item.url === undefined) throw new Error(`${at}.url is required`);
  if (typeof item.url !== "string" || item.url.length === 0) {
    throw new Error(`${at}.url must be a non-empty string`);
  }

  let labels: string[] = [];
  if (item.labels !== undefined) {
    if (!Array.isArray(item.labels)) {
      throw new Error(`${at}.labels must be an array`);
    }
    labels = item.labels.map((label, j) => {
      if (typeof label !== "string" || label.length === 0) {
        throw new Error(`${at}.labels[${j}] must be a non-empty string`);
      }
      return label;
    });
  }

  return { title: item.title, url: item.url, labels };
}

interface Cluster {
  firstIndex: number;
  question: string;
  urls: string[];
  labelSet: Set<string>;
}

/** Mine caller-supplied closed issues for repeated questions. */
export function mineFaq(args: unknown): FaqmineResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.issues === undefined) throw new Error("issues is required");
  if (!Array.isArray(raw.issues) || raw.issues.length === 0) {
    throw new Error("issues must be a non-empty array");
  }

  let minCount = 2;
  if (raw.min_count !== undefined) {
    if (
      typeof raw.min_count !== "number" ||
      !Number.isInteger(raw.min_count) ||
      raw.min_count < 2
    ) {
      throw new Error("min_count must be an integer >= 2");
    }
    minCount = raw.min_count;
  }

  const facts = raw.issues.map((item, i) => parseIssue(item, i));

  const byKey = new Map<string, Cluster>();
  facts.forEach((f, i) => {
    const key = questionKey(f.title);
    if (key === "") return;
    let cluster = byKey.get(key);
    if (!cluster) {
      cluster = { firstIndex: i, question: f.title, urls: [], labelSet: new Set() };
      byKey.set(key, cluster);
    }
    cluster.urls.push(f.url);
    for (const label of f.labels) cluster.labelSet.add(label);
  });

  const included = [...byKey.values()].filter((c) => c.urls.length >= minCount);
  included.sort((a, b) => b.urls.length - a.urls.length || a.firstIndex - b.firstIndex);

  const entries: FaqEntry[] = included.map((c) => ({
    question: c.question,
    count: c.urls.length,
    urls: c.urls,
    labels: [...c.labelSet].sort(),
  }));

  const clustered = entries.reduce((sum, e) => sum + e.count, 0);
  const counts: FaqCounts = {
    issues: facts.length,
    clusters: entries.length,
    clustered_issues: clustered,
    unclustered: facts.length - clustered,
  };

  return { entries, counts };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
