import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mineFaq, questionKey } from "../src/faqmine.js";

/**
 * All tests are pure local computation over inline issue
 * lists: no network, no filesystem. The pinned clustering
 * rule (lowercase, split on non-alphanumeric runs, drop
 * the pinned stopwords, distinct tokens sorted code-unit
 * ascending joined with single spaces) is pinned directly
 * through questionKey and end-to-end through mineFaq:
 * word-order variants, punctuation and case insensitivity,
 * stopword-only titles, below-threshold counting, label
 * union sorting, entry ordering and tie-breaking, the
 * min_count boundary, and every validation path.
 */

type I = Record<string, unknown>;

const issue = (over: I = {}): I => ({
  title: "How do I reset my password?",
  url: "https://example.com/issues/1",
  ...over,
});

const mine = (issues: unknown, over: I = {}) => mineFaq({ issues, ...over });

describe("questionKey — the pinned clustering rule", () => {
  it("lowercases, drops stopwords, sorts distinct tokens, joins with single spaces", () => {
    assert.equal(questionKey("How do I reset my password?"), "password reset");
  });

  it("word order does not matter: both phrasings share one key", () => {
    assert.equal(questionKey("Password reset — how?"), "password reset");
    assert.equal(
      questionKey("How do I reset my password?"),
      questionKey("Password reset — how?"),
    );
  });

  it("punctuation and case are insignificant", () => {
    assert.equal(questionKey("RESET... my PASSWORD!!!"), "password reset");
    assert.equal(questionKey("  Export   to  CSV  fails "), "csv export fails");
  });

  it("repeated tokens collapse: the key holds distinct tokens only", () => {
    assert.equal(questionKey("Login login LOGIN broken"), "broken login");
  });

  it("every pinned stopword is dropped", () => {
    assert.equal(
      questionKey(
        "a an the is are was were do does did how what why when where which who can could should would i we you it to of in on for with and or not no my me this that there here",
      ),
      "",
    );
  });

  it("a stopword-only or punctuation-only title has the empty key", () => {
    assert.equal(questionKey("How do I do it?"), "");
    assert.equal(questionKey("?!..."), "");
    assert.equal(questionKey("The and of"), "");
  });

  it("digits are alphanumeric and stay in the key", () => {
    assert.equal(questionKey("Error 500 on login"), "500 error login");
  });

  it("non-stopword function-like words survive (e.g. 'not' is a stopword, 'never' is not)", () => {
    assert.equal(questionKey("Sync never finishes"), "finishes never sync");
    assert.equal(questionKey("Sync does not finish"), "finish sync");
  });
});

describe("mineFaq — clustering end to end", () => {
  it("word-order variants cluster into one entry; question is the first title verbatim", () => {
    const out = mine([
      issue({ title: "How do I reset my password?", url: "https://e/1" }),
      issue({ title: "Password reset — how?", url: "https://e/2" }),
    ]);
    assert.deepEqual(out.entries, [
      {
        question: "How do I reset my password?",
        count: 2,
        urls: ["https://e/1", "https://e/2"],
        labels: [],
      },
    ]);
    assert.deepEqual(out.counts, {
      issues: 2,
      clusters: 1,
      clustered_issues: 2,
      unclustered: 0,
    });
  });

  it("the verbatim question follows input order: swapping the pair swaps the question", () => {
    const out = mine([
      issue({ title: "Password reset — how?", url: "https://e/2" }),
      issue({ title: "How do I reset my password?", url: "https://e/1" }),
    ]);
    assert.equal(out.entries[0].question, "Password reset — how?");
    assert.deepEqual(out.entries[0].urls, ["https://e/2", "https://e/1"]);
  });

  it("case and punctuation variants cluster together", () => {
    const out = mine([
      issue({ title: "EXPORT to CSV fails!", url: "https://e/1" }),
      issue({ title: "csv export... fails?", url: "https://e/2" }),
      issue({ title: "Fails: export to csv", url: "https://e/3" }),
    ]);
    assert.equal(out.entries.length, 1);
    assert.equal(out.entries[0].count, 3);
    assert.equal(out.entries[0].question, "EXPORT to CSV fails!");
  });

  it("different questions do not cluster", () => {
    const out = mine([
      issue({ title: "Password reset", url: "https://e/1" }),
      issue({ title: "Password policy", url: "https://e/2" }),
    ]);
    assert.deepEqual(out.entries, []);
    assert.deepEqual(out.counts, {
      issues: 2,
      clusters: 0,
      clustered_issues: 0,
      unclustered: 2,
    });
  });

  it("stopword-only titles belong to no cluster, even when repeated", () => {
    const out = mine([
      issue({ title: "How do I do it?", url: "https://e/1" }),
      issue({ title: "How do I do it?", url: "https://e/2" }),
      issue({ title: "What is this?", url: "https://e/3" }),
    ]);
    assert.deepEqual(out.entries, []);
    assert.deepEqual(out.counts, {
      issues: 3,
      clusters: 0,
      clustered_issues: 0,
      unclustered: 3,
    });
  });

  it("no answer field is ever produced on an entry", () => {
    const out = mine([issue({ url: "https://e/1" }), issue({ url: "https://e/2" })]);
    assert.deepEqual(Object.keys(out.entries[0]), ["question", "count", "urls", "labels"]);
  });
});

describe("mineFaq — min_count threshold", () => {
  const three = () => [
    issue({ title: "Login broken", url: "https://e/1" }),
    issue({ title: "Broken login", url: "https://e/2" }),
    issue({ title: "LOGIN BROKEN", url: "https://e/3" }),
  ];

  it("default min_count is 2: a pair clusters, a singleton does not", () => {
    const out = mine([
      issue({ title: "Login broken", url: "https://e/1" }),
      issue({ title: "Broken login", url: "https://e/2" }),
      issue({ title: "Solo question", url: "https://e/3" }),
    ]);
    assert.equal(out.entries.length, 1);
    assert.equal(out.entries[0].count, 2);
    assert.deepEqual(out.counts, {
      issues: 3,
      clusters: 1,
      clustered_issues: 2,
      unclustered: 1,
    });
  });

  it("a cluster of exactly min_count is included (boundary)", () => {
    const out = mine(three(), { min_count: 3 });
    assert.equal(out.entries.length, 1);
    assert.equal(out.entries[0].count, 3);
    assert.equal(out.counts.clustered_issues, 3);
    assert.equal(out.counts.unclustered, 0);
  });

  it("a cluster one below min_count is excluded but counted in unclustered", () => {
    const out = mine(three().slice(0, 2), { min_count: 3 });
    assert.deepEqual(out.entries, []);
    assert.deepEqual(out.counts, {
      issues: 2,
      clusters: 0,
      clustered_issues: 0,
      unclustered: 2,
    });
  });

  it("min_count applies per cluster when several clusters compete", () => {
    const out = mine(
      [
        issue({ title: "Login broken", url: "https://e/1" }),
        issue({ title: "Broken login", url: "https://e/2" }),
        issue({ title: "Sync fails", url: "https://e/3" }),
        issue({ title: "Fails sync", url: "https://e/4" }),
        issue({ title: "Sync fails again", url: "https://e/5" }),
      ],
      { min_count: 3 },
    );
    // "sync fails again" keys to "again fails sync" — its own singleton.
    assert.equal(out.entries.length, 0);
    assert.equal(out.counts.unclustered, 5);
  });
});

describe("mineFaq — labels", () => {
  it("labels are the distinct union of the cluster's labels, sorted code-unit ascending", () => {
    const out = mine([
      issue({ url: "https://e/1", labels: ["zebra", "Auth"] }),
      issue({ url: "https://e/2", labels: ["auth", "Auth", "bug"] }),
    ]);
    // Code-unit ascending: uppercase sorts before lowercase; duplicates collapse.
    assert.deepEqual(out.entries[0].labels, ["Auth", "auth", "bug", "zebra"]);
  });

  it("absent labels mean none; an empty labels array contributes none", () => {
    const out = mine([
      issue({ url: "https://e/1" }),
      issue({ url: "https://e/2", labels: [] }),
      issue({ url: "https://e/3", labels: ["x"] }),
    ]);
    // All three share the default title, so they form one cluster.
    const out2 = mine([
      issue({ url: "https://e/1" }),
      issue({ url: "https://e/2", labels: [] }),
    ]);
    assert.deepEqual(out2.entries[0].labels, []);
    assert.equal(out.entries.length, 1);
  });

  it("labels of unclustered issues never leak into an entry", () => {
    const out = mine([
      issue({ title: "Login broken", url: "https://e/1", labels: ["keep"] }),
      issue({ title: "Broken login", url: "https://e/2" }),
      issue({ title: "Other topic", url: "https://e/3", labels: ["leak"] }),
    ]);
    assert.deepEqual(out.entries[0].labels, ["keep"]);
  });

  it("duplicate labels within one issue collapse in the union", () => {
    const out = mine([
      issue({ url: "https://e/1", labels: ["bug", "bug"] }),
      issue({ url: "https://e/2", labels: ["bug"] }),
    ]);
    assert.deepEqual(out.entries[0].labels, ["bug"]);
  });
});

describe("mineFaq — entry ordering and counts shape", () => {
  it("entries sort by count descending", () => {
    const out = mine([
      issue({ title: "Alpha topic", url: "https://e/1" }),
      issue({ title: "Beta topic", url: "https://e/2" }),
      issue({ title: "Topic beta", url: "https://e/3" }),
      issue({ title: "Topic alpha", url: "https://e/4" }),
      issue({ title: "ALPHA TOPIC", url: "https://e/5" }),
    ]);
    assert.deepEqual(
      out.entries.map((e) => [e.question, e.count]),
      [
        ["Alpha topic", 3],
        ["Beta topic", 2],
      ],
    );
  });

  it("count ties break by the input position of the cluster's first issue, ascending", () => {
    const out = mine([
      issue({ title: "Zeta topic", url: "https://e/1" }),
      issue({ title: "Alpha topic", url: "https://e/2" }),
      issue({ title: "Topic alpha", url: "https://e/3" }),
      issue({ title: "Topic zeta", url: "https://e/4" }),
    ]);
    // Both clusters have count 2; zeta's first issue came first.
    assert.deepEqual(
      out.entries.map((e) => e.question),
      ["Zeta topic", "Alpha topic"],
    );
  });

  it("urls within an entry follow input order, not sorted order", () => {
    const out = mine([
      issue({ url: "https://e/z" }),
      issue({ url: "https://e/a" }),
      issue({ url: "https://e/m" }),
    ]);
    assert.deepEqual(out.entries[0].urls, ["https://e/z", "https://e/a", "https://e/m"]);
  });

  it("counts keys are in the pinned order and counts sum correctly on a mixed input", () => {
    const out = mine([
      issue({ title: "Login broken", url: "https://e/1" }),
      issue({ title: "Broken login", url: "https://e/2" }),
      issue({ title: "How do I do it?", url: "https://e/3" }),
      issue({ title: "Solo topic", url: "https://e/4" }),
      issue({ title: "Sync fails", url: "https://e/5" }),
      issue({ title: "Fails sync", url: "https://e/6" }),
      issue({ title: "Sync fails", url: "https://e/7" }),
    ]);
    assert.deepEqual(Object.keys(out.counts), [
      "issues",
      "clusters",
      "clustered_issues",
      "unclustered",
    ]);
    assert.deepEqual(out.counts, {
      issues: 7,
      clusters: 2,
      clustered_issues: 5,
      unclustered: 2,
    });
    assert.equal(out.counts.clustered_issues + out.counts.unclustered, out.counts.issues);
  });

  it("the result's top-level keys are entries then counts", () => {
    const out = mine([issue({ url: "https://e/1" }), issue({ url: "https://e/2" })]);
    assert.deepEqual(Object.keys(out), ["entries", "counts"]);
  });
});

describe("mineFaq — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => mineFaq(args), { message });

  it("issues missing is an error naming issues", () => {
    throws({}, "issues is required");
    throws({ min_count: 2 }, "issues is required");
  });

  it("a non-object top-level argument is treated as {} and fails on issues", () => {
    throws(null, "issues is required");
    throws([], "issues is required");
    throws("x", "issues is required");
    throws(42, "issues is required");
    throws(undefined, "issues is required");
  });

  it("issues not an array or empty names issues", () => {
    throws({ issues: "x" }, "issues must be a non-empty array");
    throws({ issues: {} }, "issues must be a non-empty array");
    throws({ issues: 3 }, "issues must be a non-empty array");
    throws({ issues: [] }, "issues must be a non-empty array");
  });

  it("an item that is not an object names its index", () => {
    throws({ issues: ["x"] }, "issues[0] must be an object");
    throws({ issues: [null] }, "issues[0] must be an object");
    throws({ issues: [[]] }, "issues[0] must be an object");
    throws({ issues: [issue(), 7] }, "issues[1] must be an object");
  });

  it("title missing, empty, or non-string names issues[i].title", () => {
    const { title: _t, ...noTitle } = issue();
    throws({ issues: [noTitle] }, "issues[0].title is required");
    throws({ issues: [issue({ title: "" })] }, "issues[0].title must be a non-empty string");
    throws({ issues: [issue({ title: 42 })] }, "issues[0].title must be a non-empty string");
    throws({ issues: [issue({ title: null })] }, "issues[0].title must be a non-empty string");
    throws(
      { issues: [issue(), issue({ title: false })] },
      "issues[1].title must be a non-empty string",
    );
  });

  it("url missing, empty, or non-string names issues[i].url", () => {
    const { url: _u, ...noUrl } = issue();
    throws({ issues: [noUrl] }, "issues[0].url is required");
    throws({ issues: [issue({ url: "" })] }, "issues[0].url must be a non-empty string");
    throws({ issues: [issue({ url: 42 })] }, "issues[0].url must be a non-empty string");
    throws({ issues: [issue({ url: null })] }, "issues[0].url must be a non-empty string");
  });

  it("labels present but not an array names issues[i].labels", () => {
    for (const bad of ["bug", 42, true, null, {}]) {
      throws({ issues: [issue({ labels: bad })] }, "issues[0].labels must be an array");
    }
  });

  it("a labels entry that is non-string or empty names issues[i].labels[j] (spec example)", () => {
    throws(
      { issues: [issue({ labels: ["ok", ""] })] },
      "issues[0].labels[1] must be a non-empty string",
    );
    throws(
      { issues: [issue({ labels: [42] })] },
      "issues[0].labels[0] must be a non-empty string",
    );
    throws(
      { issues: [issue(), issue({ labels: ["a", null] })] },
      "issues[1].labels[1] must be a non-empty string",
    );
  });

  it("min_count present but non-integer or below 2 names min_count", () => {
    for (const bad of [1, 0, -2, 2.5, "2", true, null, [], {}]) {
      throws(
        { issues: [issue()], min_count: bad },
        "min_count must be an integer >= 2",
      );
    }
  });

  it("min_count of exactly 2 is valid, as are larger integers", () => {
    assert.equal(mine([issue(), issue({ url: "https://e/2" })], { min_count: 2 }).entries.length, 1);
    assert.equal(mine([issue(), issue({ url: "https://e/2" })], { min_count: 100 }).entries.length, 0);
  });

  it("unknown extra fields are ignored, including inside items", () => {
    const out = mineFaq({
      issues: [issue({ state: "closed", number: 7 }), issue({ url: "https://e/2", extra: true })],
      generated_by: "test",
    });
    assert.equal(out.entries.length, 1);
    assert.equal(out.counts.issues, 2);
  });

  it("no partial result is produced on invalid input deep in the list", () => {
    assert.throws(() =>
      mine([issue(), issue({ url: "https://e/2" }), issue({ url: "" })]),
    );
  });
});
