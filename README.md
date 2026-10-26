# bentra-docs

Internal documentation for Bentra, a Django-based infrastructure workflow automation platform. The docs are built with [MkDocs](https://www.mkdocs.org/) and the [Material](https://squidfunk.github.io/mkdocs-material/) theme.

## What's in here

All content lives under `bentra-docs/docs/`, and navigation is defined in `bentra-docs/mkdocs.yml`.

| Section | Path | Contents |
|---|---|---|
| Home | `docs/index.md` | Project overview, tech stack, goals, current status |
| Roadmap | `docs/roadmap.md` | Active and planned work |
| Architecture | `docs/architecture/` | System overview, Django apps, data model, integrations, runners, microservices, RBAC and tenancy, REST APIs, hosting |
| Development | `docs/development.md` | Local development guide |
| Reference | `docs/reference/` | Form and workflow syntax, REST API reference |
| MCP server | `docs/mcp/` | Bentra MCP server |
| Subprojects | `docs/subprojects/` | Scoped efforts such as the Azure Hosting Spike |
| Journal | `docs/journal.md` | Dated progress entries |

## Running the docs locally

Requires Python 3.

1. Create and activate a virtual environment at the repo root:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install MkDocs and its dependencies:

   ```bash
   pip install mkdocs mkdocs-material pymdown-extensions
   ```

3. Start the dev server from the `bentra-docs/` directory:

   ```bash
   cd bentra-docs
   mkdocs serve
   ```

4. Open http://127.0.0.1:8002. The site reloads automatically when files change.

To build a static copy instead, run `mkdocs build` from `bentra-docs/`. Output goes to `bentra-docs/site/`, which is gitignored.

## Adding a page

1. Create a Markdown file under `bentra-docs/docs/`.
2. Add it to the `nav` section of `bentra-docs/mkdocs.yml`, or it won't appear in the sidebar.
