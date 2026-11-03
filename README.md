# faqmine

Support queues and issue trackers fill up with the same
questions asked over and over, each time as a separate
closed issue with slightly different wording. faqmine
finds those repeats for you. You supply the closed
issues — each one's title and link, plus its labels if
you have them — and faqmine groups the ones that are
really the same question and drafts an FAQ from the
groups: for every repeated question, the question text,
how many times it was asked, and the links to each
asking. It invents no answers. The question, the count,
and the links all come from the issues you supplied,
verbatim, so the draft can go straight into triage
without anyone having to fact-check generated prose.

Two titles count as the same question when their
question keys match. The key is built by lowercasing the
title, splitting it into tokens on every run of
non-alphanumeric characters, discarding a pinned list
of stopwords (`a`, `an`, `the`, `is`, `are`, `was`,
`were`, `do`, `does`, `did`, `how`, `what`, `why`,
`when`, `where`, `which`, `who`, `can`, `could`,
`should`, `would`, `i`, `we`, `you`, `it`, `to`, `of`,
`in`, `on`, `for`, `with`, `and`, `or`, `not`, `no`,
`my`, `me`, `this`, `that`, `there`, `here`), keeping
each remaining token once, sorting the survivors, and
joining them with single spaces. Word order, case, and
punctuation therefore do not matter: "How do I reset my
password?" and "Password reset — how?" share the key
`password reset` and cluster together. A title made
only of stopwords and punctuation has an empty key and
belongs to no cluster at all.

A cluster becomes an FAQ entry once it reaches
`min_count` issues (2 unless you say otherwise). The
entry's question is the title of the cluster's first
issue in the order you supplied them, echoed exactly;
its urls are the cluster's links in that same order;
and its labels are the distinct union of the cluster's
labels, sorted ascending. Entries are ordered by count,
largest first, with ties broken by where the cluster's
first issue appeared in your input. The counts report
how many issues you supplied, how many entries were
drafted, how many issues landed in those entries, and
how many were left unclustered — the ones in
below-threshold clusters plus the empty-key ones.

Malformed input — a missing or empty issue list, an
item that is not an object, a missing, empty, or
non-string `title` or `url`, a `labels` value that is
not an array or that holds an empty or non-string entry,
or a `min_count` below 2 or not an integer — is a
validation error naming the offending path, with no
partial result. Unknown extra fields are ignored.

## CLI

```bash
npx @reneturcios/faqmine mine --input args.json
npx @reneturcios/faqmine --version
```

`args.json` contains the full arguments object:

```json
{
  "issues": [
    {
      "title": "How do I reset my password?",
      "url": "https://example.com/issues/1",
      "labels": ["account", "auth"]
    },
    {
      "title": "Password reset — how?",
      "url": "https://example.com/issues/2",
      "labels": ["auth"]
    },
    {
      "title": "Export to CSV fails",
      "url": "https://example.com/issues/3"
    }
  ]
}
```

The FAQ draft is printed as JSON:

```json
{
  "entries": [
    {
      "question": "How do I reset my password?",
      "count": 2,
      "urls": [
        "https://example.com/issues/1",
        "https://example.com/issues/2"
      ],
      "labels": ["account", "auth"]
    }
  ],
  "counts": {
    "issues": 3,
    "clusters": 1,
    "clustered_issues": 2,
    "unclustered": 1
  }
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or
invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/faqmine mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "faqmine": {
      "command": "npx",
      "args": ["-y", "@reneturcios/faqmine", "mcp"]
    }
  }
}
```

### Tools

- `mine_faq` — Mine caller-supplied closed issues for
  repeated questions and draft FAQ entries: the
  question (a supplied issue title, verbatim), its
  count, and the issue links. No answers are invented.
  - `issues` (array, required, at least 1 item) — the
    closed issues to mine, in the caller's order; each
    item:
    - `title` (string, required, non-empty) — issue title
    - `url` (string, required, non-empty) — issue link
    - `labels` (array of strings, optional) — issue
      labels; absent means none
  - `min_count` (integer, optional, at least 2,
    default 2) — minimum cluster size for an FAQ entry

  Returns `{entries, counts}`, where `entries` holds
  one `{question, count, urls, labels}` per included
  cluster and `counts` is `{issues, clusters,
  clustered_issues, unclustered}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/faqmine
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/faqmine mine --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
