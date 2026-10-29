"""Check the form examples in reference/form-syntax.mdx.

- Every <FormPreview yaml={...} /> must hold exactly the YAML of the ```yaml block before it.
  The preview string is one JSON-escaped line, because Mintlify rewrites whitespace inside
  multi-line strings. Edit the ```yaml block, then run with --fix to rewrite the previews.
- Every complete form example (top-level `name` and `body`) must pass Bentra's form schema.

Usage: python3 scripts/check_form_examples.py [--fix] [path/to/form.schema.json]
Needs: pip install pyyaml jsonschema
The schema defaults to the bento repo checked out next to this one.
"""
import json
import re
import sys
from pathlib import Path

import yaml
from jsonschema import validators

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "reference" / "form-syntax.mdx"
DEFAULT_SCHEMA = ROOT.parent / "bento" / "bento" / "forms" / "static" / "forms" / "schema" / "form.schema.json"

YAML_BLOCK = re.compile(r"```yaml[^\n]*\n(.*?)\n```", re.S)
PREVIEW = re.compile(r'<FormPreview yaml=\{("(?:[^"\\]|\\.)*"|`.*?`)\} />', re.S)


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def preview_yaml(literal: str) -> str | None:
    """The YAML a preview holds, or None for an old-style template literal."""
    return json.loads(literal) if literal.startswith('"') else None


def yaml_before(text: str, index: int) -> str | None:
    before = [m.group(1) for m in YAML_BLOCK.finditer(text) if m.start() < index]
    return before[-1] if before else None


def check_previews(text: str) -> tuple[list[str], int]:
    errors = []
    matches = list(PREVIEW.finditer(text))
    for m in matches:
        where = f"{PAGE.name}:{line_of(text, m.start())}"
        expected = yaml_before(text, m.start())
        if expected is None:
            errors.append(f"{where}: FormPreview has no ```yaml block before it")
        elif preview_yaml(m.group(1)) != expected:
            errors.append(f"{where}: FormPreview differs from the ```yaml block before it (run with --fix)")
    return errors, len(matches)


def fix_previews(text: str) -> str:
    def rewrite(m: re.Match) -> str:
        expected = yaml_before(text, m.start())
        return m.group(0) if expected is None else f"<FormPreview yaml={{{json.dumps(expected)}}} />"

    return PREVIEW.sub(rewrite, text)


def check_schema(text: str, schema_path: Path) -> tuple[list[str], int]:
    schema = json.loads(schema_path.read_text())
    validator = validators.validator_for(schema)(schema)
    errors, checked = [], 0
    for m in YAML_BLOCK.finditer(text):
        where = f"{PAGE.name}:{line_of(text, m.start())}"
        try:
            doc = yaml.safe_load(m.group(1))
        except yaml.YAMLError as exc:
            errors.append(f"{where}: YAML doesn't parse: {exc}")
            continue
        if not (isinstance(doc, dict) and "name" in doc and "body" in doc):
            continue
        checked += 1
        for err in validator.iter_errors(doc):
            path = "/".join(str(p) for p in err.absolute_path) or "(root)"
            errors.append(f"{where}: {path}: {err.message}")
    return errors, checked


def main() -> None:
    args = sys.argv[1:]
    fix = "--fix" in args
    paths = [a for a in args if a != "--fix"]
    schema_path = Path(paths[0]) if paths else DEFAULT_SCHEMA
    text = PAGE.read_text()
    if fix:
        text = fix_previews(text)
        PAGE.write_text(text)
    errors, previews = check_previews(text)
    if schema_path.exists():
        schema_errors, forms = check_schema(text, schema_path)
        errors += schema_errors
        print(f"{forms} complete form examples checked against {schema_path}")
    else:
        print(f"Schema not found at {schema_path}; skipping schema validation")
    print(f"{previews} previews compared with their YAML")
    for e in errors:
        print(f"  {e}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
