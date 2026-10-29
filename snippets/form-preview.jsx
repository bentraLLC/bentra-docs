/* Interactive look-alike of a Bentra request form, rendered from form.yml.
   Mirrors the app's widgets and runtime rules (visibility conditions, cascading
   options, auto-populate) closely enough to show what a form does; it is not the app. */

const EMPTY_LABELS = {
  input: "Text Input",
  textarea: "Text Area",
  dropdown: "Choose an option",
  checkboxes: "Select options",
  radio: "Select one option",
  tags: "Tags",
};

/* ---------- YAML (the subset form.yml uses) ---------- */

const parseYaml = (src) => {
  const lines = src.replace(/\t/g, "  ").split("\n");
  let i = 0;
  const indentOf = (l) => l.match(/^ */)[0].length;
  const isBlank = (l) => /^\s*(#.*)?$/.test(l);
  const skip = () => {
    while (i < lines.length && isBlank(lines[i])) i++;
  };
  const stripComment = (s) => {
    let q = null;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (q) {
        if (c === q) q = null;
      } else if (c === '"' || c === "'") {
        q = c;
      } else if (c === "#" && (k === 0 || /\s/.test(s[k - 1]))) {
        return s.slice(0, k).trimEnd();
      }
    }
    return s.trimEnd();
  };
  const KEY = /^("[^"]*"|'[^']*'|[^\s"'[{#-][^:#]*?|-[^\s:][^:#]*?)\s*:(?:\s+(.*)|$)/;

  const scalar = (s) => {
    s = s.trim();
    if (s.startsWith('"')) return JSON.parse(s);
    if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null" || s === "~" || s === "") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  };

  const flow = (s) => {
    let p = 0;
    const ws = () => {
      while (p < s.length && /\s/.test(s[p])) p++;
    };
    const atom = () => {
      ws();
      if (s[p] === '"' || s[p] === "'") {
        const q = s[p];
        let e = p + 1;
        while (e < s.length && !(s[e] === q && s[e - 1] !== "\\")) e++;
        const raw = s.slice(p, e + 1);
        p = e + 1;
        return scalar(raw);
      }
      let e = p;
      while (e < s.length && !",]}:".includes(s[e])) e++;
      if (s[e] === ":" && !/\s/.test(s[e + 1] || " ")) {
        while (e < s.length && !",]}".includes(s[e])) e++;
      }
      const raw = s.slice(p, e);
      p = e;
      return scalar(raw);
    };
    const value = () => {
      ws();
      if (s[p] === "[") {
        p++;
        const out = [];
        ws();
        if (s[p] === "]") {
          p++;
          return out;
        }
        while (p < s.length) {
          out.push(value());
          ws();
          if (s[p] === ",") p++;
          else if (s[p] === "]") {
            p++;
            break;
          }
        }
        return out;
      }
      if (s[p] === "{") {
        p++;
        const out = {};
        ws();
        if (s[p] === "}") {
          p++;
          return out;
        }
        while (p < s.length) {
          const k = atom();
          ws();
          if (s[p] === ":") p++;
          out[String(k)] = value();
          ws();
          if (s[p] === ",") p++;
          else if (s[p] === "}") {
            p++;
            break;
          }
        }
        return out;
      }
      return atom();
    };
    return value();
  };

  const inline = (s) => (s.startsWith("[") || s.startsWith("{") ? flow(s) : scalar(s));

  const blockScalar = (header, parentIndent) => {
    const body = [];
    while (i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > parentIndent)) {
      body.push(lines[i]);
      i++;
    }
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    const first = body.find((l) => l.trim() !== "");
    const ind = first ? indentOf(first) : 0;
    const text = body.map((l) => l.slice(ind));
    const joined = header.startsWith(">")
      ? text.join("\n").replace(/([^\n])\n(?=[^\n])/g, "$1 ")
      : text.join("\n");
    return header.includes("-") ? joined : joined + "\n";
  };

  const node = (indent) => {
    skip();
    if (i >= lines.length) return null;
    const ind = indentOf(lines[i]);
    if (ind < indent) return null;
    return /^\s*-(\s|$)/.test(lines[i]) ? list(ind) : map(ind);
  };

  const list = (ind) => {
    const out = [];
    for (;;) {
      skip();
      if (i >= lines.length) break;
      const l = lines[i];
      if (indentOf(l) !== ind || !/^\s*-(\s|$)/.test(l)) break;
      const after = l.slice(ind + 1);
      const rest = stripComment(after).trim();
      if (rest === "") {
        i++;
        out.push(node(ind + 1));
      } else if (KEY.test(rest) && !rest.startsWith("[") && !rest.startsWith("{")) {
        const childInd = ind + 1 + after.match(/^ */)[0].length;
        lines[i] = " ".repeat(childInd) + after.trimStart();
        out.push(map(childInd));
      } else {
        i++;
        out.push(inline(rest));
      }
    }
    return out;
  };

  const map = (ind) => {
    const out = {};
    for (;;) {
      skip();
      if (i >= lines.length) break;
      const l = lines[i];
      if (indentOf(l) !== ind || /^\s*-(\s|$)/.test(l)) break;
      const m = stripComment(l.trim()).match(KEY);
      if (!m) throw new Error(`Line ${i + 1}: expected "key: value"`);
      const key = String(scalar(m[1]));
      const raw = (m[2] || "").trim();
      i++;
      if (raw === "") {
        skip();
        if (i < lines.length && indentOf(lines[i]) > ind) out[key] = node(indentOf(lines[i]));
        else if (i < lines.length && indentOf(lines[i]) === ind && /^\s*-(\s|$)/.test(lines[i]))
          out[key] = list(ind);
        else out[key] = null;
      } else if (raw.startsWith("|") || raw.startsWith(">")) {
        out[key] = blockScalar(raw, ind);
      } else {
        out[key] = inline(raw);
      }
    }
    return out;
  };

  const result = node(0);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("A form must be a YAML mapping with name and body.");
  }
  return result;
};

/* ---------- Markdown (descriptions) ---------- */

const mdInline = (text, keyBase) => {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${n++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>);
    else
      out.push(
        <a key={k} href={m[6]} target="_blank" rel="noopener noreferrer">
          {m[5]}
        </a>
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const Markdown = ({ text, className }) => {
  if (!text) return null;
  const blocks = String(text).trim().split(/\n\s*\n/);
  return (
    <div className={className}>
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
          const ordered = /^\s*\d+\./.test(lines[0]);
          const items = lines.map((l, j) => (
            <li key={j}>{mdInline(l.replace(/^\s*([-*]|\d+\.)\s+/, ""), `${b}-${j}`)}</li>
          ));
          return ordered ? <ol key={b}>{items}</ol> : <ul key={b}>{items}</ul>;
        }
        const heading = lines[0].match(/^#{1,6}\s+(.*)/);
        if (heading && lines.length === 1) {
          return (
            <p key={b}>
              <strong>{mdInline(heading[1], `${b}`)}</strong>
            </p>
          );
        }
        return <p key={b}>{mdInline(lines.join(" "), `${b}`)}</p>;
      })}
    </div>
  );
};

/* ---------- Values, templates and conditions ---------- */

const isEmpty = (v) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

const tagsToObject = (rows) =>
  Object.fromEntries((rows || []).filter((r) => r.key !== "").map((r) => [r.key, r.value]));

const conditionValue = (field, value) => {
  if (field && field.type === "tags") value = tagsToObject(value);
  return isEmpty(value) ? null : value;
};

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const dateKeyword = (s) => {
  const m = typeof s === "string" && s.trim().match(/^today\s*([+-]\s*\d+)?$/);
  return m ? isoDate(m[1] ? parseInt(m[1].replace(/\s/g, ""), 10) : 0) : null;
};

const fillTemplate = (template, values, fieldsById) =>
  String(template).replace(/\{([A-Za-z0-9_]+)(?:\.([^}]+))?\}/g, (_, id, key) => {
    const field = fieldsById[id];
    let v = values[id];
    if (field && field.type === "tags") v = tagsToObject(v);
    if (key !== undefined) v = v && typeof v === "object" ? v[key] : undefined;
    if (Array.isArray(v)) return v.join(",");
    return v === undefined || v === null ? "" : String(v);
  });

const autoValue = (spec, values, fieldsById) => {
  if (spec && typeof spec === "object") {
    const params = spec.params || {};
    const list = params.values || spec.values || [];
    const resolve = (v) =>
      typeof v === "string" && v.includes("{") ? fillTemplate(v, values, fieldsById) : v;
    const fieldText = () => {
      const f = params.field || "";
      return f.includes("{") ? fillTemplate(f, values, fieldsById) : String(values[f] ?? "");
    };
    switch (spec.function) {
      case "concat":
        return list.map(resolve).join("");
      case "uppercase":
        return fieldText().toUpperCase();
      case "lowercase":
        return fieldText().toLowerCase();
      case "sum":
        return String(list.reduce((a, v) => a + (parseFloat(resolve(v)) || 0), 0));
      case "multiply":
        return String(list.reduce((a, v) => a * (parseFloat(resolve(v)) || 0), 1));
      default:
        return null;
    }
  }
  if (typeof spec !== "string") return spec === undefined || spec === null ? null : String(spec);
  return dateKeyword(spec) ?? (spec.includes("{") ? fillTemplate(spec, values, fieldsById) : spec);
};

const evaluateCondition = (expr, lookup) => {
  const tokens = [];
  const re = /\s*(==|!=|&&|\|\||!|\(|\)|\.|,|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)/y;
  let pos = 0;
  const src = String(expr);
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m) throw new Error("bad token");
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  let t = 0;
  const peek = () => tokens[t];
  const take = (x) => {
    if (x !== undefined && tokens[t] !== x) throw new Error(`expected ${x}`);
    return tokens[t++];
  };
  const literal = (tok) => {
    if (/^['"]/.test(tok)) return tok.slice(1, -1).replace(/\\(.)/g, "$1");
    if (/^-?\d/.test(tok)) return Number(tok);
    if (tok === "null") return null;
    if (tok === "true") return true;
    if (tok === "false") return false;
    return lookup(tok);
  };
  const truthy = (v) => v !== null && v !== false;
  const equal = (a, b) => (a === null || b === null ? a === b : String(a) === String(b));
  const primary = () => {
    const tok = take();
    if (tok === undefined) throw new Error("unexpected end");
    if (tok === "(") {
      const v = or();
      take(")");
      return v;
    }
    let v = literal(tok);
    if (peek() === ".") {
      take(".");
      take("includes");
      take("(");
      const arg = literal(take());
      take(")");
      if (v === null) return false;
      if (Array.isArray(v)) return v.some((x) => String(x) === String(arg));
      return String(v).includes(String(arg));
    }
    return v;
  };
  const cmp = () => {
    const left = primary();
    if (peek() === "==" || peek() === "!=") {
      const op = take();
      const right = primary();
      return op === "==" ? equal(left, right) : !equal(left, right);
    }
    return left;
  };
  const not = () => {
    if (peek() === "!") {
      take();
      return !truthy(not());
    }
    return cmp();
  };
  const and = () => {
    let v = not();
    while (peek() === "&&") {
      take();
      const r = not();
      v = truthy(v) && truthy(r);
    }
    return v;
  };
  const or = () => {
    let v = and();
    while (peek() === "||") {
      take();
      const r = and();
      v = truthy(v) || truthy(r);
    }
    return v;
  };
  const result = or();
  if (t !== tokens.length) throw new Error("trailing tokens");
  return truthy(result);
};

/* ---------- Field model ---------- */

const optionList = (raw) =>
  (Array.isArray(raw) ? raw : []).map((o) =>
    o && typeof o === "object"
      ? { value: String(o.value), label: o.label ?? String(o.value), required: !!o.required }
      : { value: String(o), label: String(o), required: false }
  );

const parentOf = (field) => {
  const d = field.dynamic || {};
  return d.depends_on_field || (Array.isArray(d.depends_on) ? d.depends_on[0] : undefined);
};

const fieldOptions = (field, values) => {
  const attrs = field.attributes || {};
  const dyn = field.dynamic || {};
  if (dyn.options_map) {
    const parent = parentOf(field);
    const key = values[parent];
    return optionList(dyn.options_map[key === undefined || key === null ? "" : String(key)]);
  }
  if (attrs.options_from) {
    const src = attrs.options_from;
    return [1, 2, 3].map((n) => ({
      value: `${src.value}-${n}`,
      label: `Example row ${n} (${src.label || src.value})`,
      required: false,
    }));
  }
  return optionList(attrs.options);
};

const isMulti = (field) => field.type === "checkboxes" || (field.type === "dropdown" && field.attributes?.multiple);

const initialValue = (field, values, fieldsById) => {
  const attrs = field.attributes || {};
  const d = attrs.default;
  if (field.type === "tags") {
    const obj = d && typeof d === "object" ? d : {};
    return Object.entries(obj).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? fillTemplate(value, values, fieldsById) : String(value ?? ""),
    }));
  }
  if (isMulti(field)) return Array.isArray(d) ? d.map(String) : d !== undefined && d !== null ? [String(d)] : [];
  if (field.type === "input" && attrs.input_type === "password") return "";
  if (d === undefined || d === null) return "";
  return dateKeyword(d) ?? String(d);
};

const labelOf = (field) => field.attributes?.label || EMPTY_LABELS[field.type] || field.id;

const validate = (fields, values, visible) => {
  const errors = [];
  for (const field of fields) {
    if (!visible[field.id]) continue;
    const v = field.validations || {};
    const value = values[field.id];
    const label = labelOf(field);
    const filled = field.type === "tags" ? Object.keys(tagsToObject(value)).length > 0 : !isEmpty(value);
    if (v.required && !filled) {
      errors.push(`${label}: This field is required.`);
      continue;
    }
    if (!filled) continue;
    if (field.type === "checkboxes") {
      for (const opt of optionList(field.attributes?.options)) {
        if (opt.required && !value.includes(opt.value)) errors.push(`${label}: "${opt.label}" must be checked.`);
      }
    }
    if (Array.isArray(value)) {
      if (v.min_selections && value.length < v.min_selections)
        errors.push(`${label}: Select at least ${v.min_selections}.`);
      if (v.max_selections && value.length > v.max_selections)
        errors.push(`${label}: Select at most ${v.max_selections}.`);
    }
    if (typeof value === "string") {
      if (v.min_length && value.length < v.min_length)
        errors.push(`${label}: Use at least ${v.min_length} characters.`);
      if (v.max_length && value.length > v.max_length)
        errors.push(`${label}: Use at most ${v.max_length} characters.`);
      if (v.pattern) {
        try {
          if (!new RegExp(`^(?:${v.pattern})$`).test(value)) errors.push(`${label}: Doesn't match the required format.`);
        } catch (e) {
          /* an invalid pattern can't be checked in the preview */
        }
      }
      if (field.attributes?.input_type === "number") {
        const n = Number(value);
        if (v.min !== undefined && n < v.min) errors.push(`${label}: Must be at least ${v.min}.`);
        if (v.max !== undefined && n > v.max) errors.push(`${label}: Must be at most ${v.max}.`);
      }
    }
  }
  return errors;
};

/* ---------- Widgets ---------- */

const Chevron = ({ open }) => (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true" className="bt-fp-chevron">
    <path d={open ? "M4 8l4-4 4 4" : "M4 4l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const Dropdown = ({ field, options, value, onChange, disabled }) => {
  const attrs = field.attributes || {};
  const multiple = !!attrs.multiple;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const selected = multiple ? value || [] : value;
  const shown = attrs.searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;
  const current = options.find((o) => o.value === selected);
  const triggerText = multiple
    ? selected.length
      ? `${selected.length} selected`
      : "Select options"
    : current
      ? current.label
      : "--Please choose an option--";
  const pick = (opt) => {
    if (multiple) {
      onChange(selected.includes(opt.value) ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
    } else {
      onChange(opt.value);
      setOpen(false);
    }
  };
  const rows = attrs.size || 7;
  return (
    <div className="bt-fp-dropdown" ref={ref}>
      <button
        type="button"
        className={`bt-fp-control bt-fp-trigger${open ? " is-open" : ""}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={multiple ? (selected.length ? "" : "bt-fp-muted") : current ? "" : "bt-fp-muted"}>
          {triggerText}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="bt-fp-panel" role="listbox" aria-multiselectable={multiple}>
          {attrs.searchable && (
            <input
              className="bt-fp-search"
              placeholder="Search..."
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="bt-fp-options" style={{ maxHeight: `${rows * 36 + 8}px` }}>
            {shown.length === 0 && <div className="bt-fp-empty">No matching options</div>}
            {shown.map((opt) => {
              const on = multiple ? selected.includes(opt.value) : opt.value === selected;
              return (
                <button
                  type="button"
                  key={opt.value}
                  role="option"
                  aria-selected={on}
                  className={`bt-fp-option${on ? " is-selected" : ""}`}
                  onClick={() => pick(opt)}
                >
                  {multiple && <span className={`bt-fp-box${on ? " is-on" : ""}`} />}
                  <span className="bt-fp-option-label">{opt.label}</span>
                  {!multiple && on && <span className="bt-fp-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const PasswordInput = ({ field, value, onChange, disabled }) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="bt-fp-password">
      <input
        className="bt-fp-control"
        type={shown ? "text" : "password"}
        placeholder={field.attributes?.placeholder || ""}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="bt-fp-eye"
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => setShown(!shown)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
};

const TagsInput = ({ field, value, onChange, disabled }) => {
  const attrs = field.attributes || {};
  const rows = value || [];
  const max = attrs.max_pairs;
  const update = (idx, part, text) => onChange(rows.map((r, j) => (j === idx ? { ...r, [part]: text } : r)));
  return (
    <div className="bt-fp-tags">
      {rows.map((row, idx) => (
        <div className="bt-fp-tag-row" key={idx}>
          <input
            className="bt-fp-control"
            placeholder={attrs.key_placeholder || "key"}
            value={row.key}
            disabled={disabled}
            onChange={(e) => update(idx, "key", e.target.value)}
          />
          <span className="bt-fp-tag-sep">:</span>
          <input
            className="bt-fp-control"
            placeholder={attrs.value_placeholder || "value"}
            value={row.value}
            disabled={disabled}
            onChange={(e) => update(idx, "value", e.target.value)}
          />
          <button
            type="button"
            className="bt-fp-tag-remove"
            aria-label="Remove tag"
            disabled={disabled}
            onClick={() => onChange(rows.filter((_, j) => j !== idx))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="bt-fp-btn bt-fp-btn--secondary bt-fp-btn--sm"
        disabled={disabled || (max && rows.length >= max)}
        onClick={() => onChange([...rows, { key: "", value: "" }])}
      >
        + Add Tag
      </button>
    </div>
  );
};

const Control = ({ field, options, value, onChange, readOnly }) => {
  const attrs = field.attributes || {};
  const v = field.validations || {};
  if (field.type === "textarea") {
    return (
      <textarea
        className="bt-fp-control bt-fp-textarea"
        rows={attrs.rows || 4}
        placeholder={attrs.placeholder || ""}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "dropdown") {
    return <Dropdown field={field} options={options} value={value} onChange={onChange} disabled={readOnly} />;
  }
  if (field.type === "checkboxes" || field.type === "radio") {
    const multi = field.type === "checkboxes";
    return (
      <div className="bt-fp-choices">
        {options.map((opt) => {
          const on = multi ? (value || []).includes(opt.value) : value === opt.value;
          return (
            <label className="bt-fp-choice" key={opt.value}>
              <input
                type={multi ? "checkbox" : "radio"}
                checked={on}
                disabled={readOnly}
                onChange={() =>
                  onChange(multi ? (on ? value.filter((x) => x !== opt.value) : [...(value || []), opt.value]) : opt.value)
                }
              />
              <span className={multi ? `bt-fp-box${on ? " is-on" : ""}` : `bt-fp-dot${on ? " is-on" : ""}`} />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (field.type === "tags") {
    return <TagsInput field={field} value={value} onChange={onChange} disabled={readOnly} />;
  }
  const type = attrs.input_type || "text";
  if (type === "password") return <PasswordInput field={field} value={value} onChange={onChange} disabled={readOnly} />;
  const bounds =
    type === "number"
      ? { min: v.min, max: v.max, step: v.step }
      : type === "date"
        ? { min: dateKeyword(v.min_date) ?? v.min_date, max: dateKeyword(v.max_date) ?? v.max_date }
        : {};
  return (
    <input
      className="bt-fp-control"
      type={type}
      placeholder={attrs.placeholder || (type === "email" ? "you@example.com" : "")}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      {...bounds}
    />
  );
};

/* ---------- Form ---------- */

const PreviewForm = ({ form }) => {
  const fields = (Array.isArray(form.body) ? form.body : []).filter((f) => f && f.id);
  const fieldsById = Object.fromEntries(fields.map((f) => [f.id, f]));
  const [values, setValues] = useState(() => {
    const out = {};
    for (const f of fields) out[f.id] = initialValue(f, out, fieldsById);
    return out;
  });
  const [autoFilled, setAutoFilled] = useState(() => new Set());
  const [errors, setErrors] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const next = { ...values };
    const filled = new Set(autoFilled);
    let changed = false;
    for (const f of fields) {
      const dyn = f.dynamic || {};
      if (dyn.auto_populate === undefined) continue;
      const computed = autoValue(dyn.auto_populate, next, fieldsById);
      if (computed === null || computed === undefined) continue;
      const current = next[f.id];
      const mayWrite = dyn.computed || isEmpty(current) || filled.has(f.id);
      if (mayWrite && current !== computed) {
        next[f.id] = computed;
        filled.add(f.id);
        changed = true;
      }
    }
    if (changed) {
      setValues(next);
      setAutoFilled(filled);
    }
  }, [values]);

  const lookup = (id) => conditionValue(fieldsById[id], values[id]);
  const visible = {};
  for (const f of fields) {
    const cond = f.visibility?.condition;
    if (!cond) {
      visible[f.id] = true;
      continue;
    }
    try {
      visible[f.id] = evaluateCondition(cond, lookup);
    } catch (e) {
      visible[f.id] = true;
    }
  }

  const setValue = (id, value) => {
    setSubmitted(false);
    setErrors([]);
    const next = { ...values, [id]: value };
    for (const f of fields) {
      if (f.dynamic?.options_map && parentOf(f) === id) next[f.id] = isMulti(f) ? [] : "";
    }
    setValues(next);
    if (autoFilled.has(id)) {
      const filled = new Set(autoFilled);
      filled.delete(id);
      setAutoFilled(filled);
    }
  };

  const submit = () => {
    const found = validate(fields, values, visible);
    setErrors(found);
    setSubmitted(found.length === 0);
  };

  const sectionVisible = {};
  for (const f of fields) {
    if (f.section && visible[f.id]) sectionVisible[f.section] = true;
  }

  let lastSection;
  return (
    <div className="bt-fp">
      <div className="bt-fp-title">{form.name || "Submit request"}</div>
      <Markdown text={form.description} className="bt-fp-description" />
      <div className="bt-fp-card">
        <div className="bt-fp-fields">
          {fields.map((field) => {
            const header =
              field.section && field.section !== lastSection && sectionVisible[field.section] ? (
                <div className="bt-fp-section" key={`section-${field.id}`}>
                  <span>{field.section}</span>
                  <hr />
                </div>
              ) : null;
            if (field.section && sectionVisible[field.section]) lastSection = field.section;
            if (!visible[field.id]) return header;
            const attrs = field.attributes || {};
            const required = !!field.validations?.required;
            const readOnly = !!attrs.readonly || !!field.dynamic?.computed;
            const compact = field.type === "input" || (field.type === "dropdown" && !attrs.multiple);
            const options = fieldOptions(field, values);
            const isGroup = field.type === "checkboxes" || field.type === "radio";
            return [
              header,
              <div className={`bt-fp-field${compact ? " is-compact" : ""}`} key={field.id}>
                <div className="bt-fp-label">
                  <span>{labelOf(field)}</span>
                  {required ? (
                    <span className="bt-fp-required" aria-label="required">*</span>
                  ) : (
                    <span className="bt-fp-optional">Optional</span>
                  )}
                </div>
                <Markdown text={attrs.description} className="bt-fp-help" />
                {attrs.options_from && (
                  <div className="bt-fp-note">
                    Options load from the <code>{attrs.options_from.dataset}</code> dataset of the{" "}
                    <code>{attrs.options_from.job}</code> job. The preview shows example rows.
                  </div>
                )}
                <div className={isGroup ? "" : "bt-fp-control-wrap"}>
                  <Control
                    field={field}
                    options={options}
                    value={values[field.id]}
                    readOnly={readOnly}
                    onChange={(v) => setValue(field.id, v)}
                  />
                </div>
              </div>,
            ];
          })}
        </div>
        {errors.length > 0 && (
          <div className="bt-fp-alert" role="alert">
            <strong>Please fix the following:</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {submitted && <div className="bt-fp-ok">Looks good. This is a preview, so nothing was submitted.</div>}
        <div className="bt-fp-actions">
          <button type="button" className="bt-fp-btn bt-fp-btn--secondary">
            Cancel
          </button>
          <button type="button" className="bt-fp-btn bt-fp-btn--primary" onClick={submit}>
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
};

export const FormPreview = ({ yaml }) => {
  let form = null;
  let error = null;
  try {
    form = parseYaml(String(yaml || ""));
  } catch (e) {
    error = e.message;
  }
  if (error) {
    return (
      <div className="bt-fp bt-fp-error">
        Can't preview this YAML: {error}
      </div>
    );
  }
  return <PreviewForm form={form} />;
};
