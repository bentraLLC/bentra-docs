# Source files behind the public reference

Moved out of the public [form syntax](../reference/form-syntax.mdx) and [workflow syntax](../reference/workflow-syntax.mdx) pages.

## Forms

- Schema: `bento/forms/static/forms/schema/form.schema.json`
- Parser and server validation: `bento/forms/form_config.py`
- Condition evaluator: `bento/forms/condition_eval.py`, mirrored in `bento/forms/static/forms/form.js`
- An example covering every field type except `tags`: `test/form.local.yml`

## Workflows

- Runner execution: `bentra-runners/runners/worker.py`, `step_plan.py`, `checks.py`, `datasets.py`
- Pre-cut validation: `bento/workflows/versioning.py`
- File paths and limits: `bento/workflows/local_files.py`
- Starter template: `bento/workflows/starter_templates.py`
