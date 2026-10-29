# bentra-docs

Documentation for Bentra, published with [Mintlify](https://mintlify.com). `docs.json` at the repo root holds the site settings and navigation.

## What's in here

| Path | Published | Contents |
|---|---|---|
| `index.mdx`, `plans.mdx` | Yes | Landing page, plans and limits |
| `runners/` | Yes | Install a runner, network requirements |
| `authentication/` | Yes | How sign-in works, set up SSO |
| `reference/` | Yes | Workflow and form syntax, connectors |
| `reference/api/` | Yes | REST API reference |
| `mcp.mdx` | Yes | Bentra MCP server |
| `internal/` | No | Architecture, roadmap, journal, development guide, subprojects, license management |

`.mintignore` keeps `internal/` and this README off the site. Internal pages are plain Markdown for reading in the repo.

## Running the docs locally

Requires Node.js 20.17 or newer.

```bash
npm i -g mint
mint dev
```

Open http://localhost:3000. Before pushing, run `mint validate` and `mint broken-links`.

## Adding a page

1. Create an `.mdx` file with a `title` in its frontmatter.
2. Add its path, without the extension, to `navigation` in `docs.json`, or it won't appear in the sidebar.

Link between pages with root-relative paths such as `/runners/install`.
