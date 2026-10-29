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

## Form examples with a preview

`reference/form-syntax.mdx` shows each complete form example twice, in a `YAML` tab and a `Preview` tab rendered by `snippets/form-preview.jsx`. The preview's `yaml` prop is a one-line JSON string, because Mintlify rewrites whitespace inside multi-line strings. Edit only the ```yaml block, then regenerate the previews and check every example against Bentra's form schema:

```bash
pip install pyyaml jsonschema
python3 scripts/check_form_examples.py --fix
```

The schema is read from the `bento` repo checked out next to this one; pass a path to use another copy.
