# Form YAML Documentation

This guide explains how to create dynamic, user-facing forms using YAML configuration files. Similar to GitHub issue templates but with advanced features like conditional visibility, dynamic field population, custom validation, and cascading dependencies.

## Table of Contents

- [Basic Structure](#basic-structure)
- [Field Types](#field-types)
- [Common Properties](#common-properties)
- [Validation](#validation)
- [Dynamic Behavior](#dynamic-behavior)
- [Visibility Control](#visibility-control)
- [Advanced Examples](#advanced-examples)

---

## Basic Structure

Every form YAML file has three top-level properties:

```yaml
name: Form Title
description: Brief description of the form's purpose
body:
  - type: input
    id: field_id
    # ... field configuration
```

### Properties

- **name** (required): The title displayed at the top of the form
- **description** (required): A brief description explaining the form's purpose
- **body** (required): An array of field definitions

---

## Field Types

### Input Field

Text-based input with support for various HTML5 input types.

```yaml
- type: input
  id: unique_field_id
  attributes:
    label: Field Label
    description: Help text shown below the field
    placeholder: Placeholder text
    input_type: text  # text, email, number, password, date, etc.
    default: ""  # Default value if user doesn't enter anything
  validations:
    required: false
    min_length: null
    max_length: null
    pattern: null
```

**Supported input_type values:**
- `text` - Standard text input
- `email` - Email input with built-in validation
- `number` - Numeric input
- `password` - Masked password input
- `date` - Date picker

**Number-specific validations:**
```yaml
validations:
  min: 0
  max: 100
  step: 1
```

**Date-specific validations:**
```yaml
validations:
  min_date: "2024-01-01"  # or "today"
  max_date: "2024-12-31"  # or "today+30"
```

### Textarea

Multi-line text input.

```yaml
- type: textarea
  id: message_field
  attributes:
    label: Message
    description: Enter your message
    placeholder: Type here...
    rows: 4
    cols: 50
    render: text  # text or markdown
    default: ""  # Default value if user doesn't enter anything
  validations:
    required: false
    min_length: null
    max_length: null
```

### Dropdown

Single or multiple selection dropdown menu.

**Single Selection:**
```yaml
- type: dropdown
  id: single_choice
  attributes:
    label: Choose an option
    description: Select one option
    options:
      - value: option1
      - value: option2
      - value: option3
    default: option1  # Default value if user doesn't select anything (set to null for no default)
    multiple: false
  validations:
    required: false
```

**Multiple Selection:**
```yaml
- type: dropdown
  id: multi_choice
  attributes:
    label: Choose multiple options
    description: Hold Ctrl/Cmd to select multiple
    options:
      - value: option1
      - value: option2
      - value: option3
    default: []  # Default values if user doesn't select anything (e.g., [option1, option2])
    multiple: true
    size: 4  # Visible rows
  validations:
    required: false
    min_selections: null
    max_selections: null
```

### Checkboxes

Group of checkboxes allowing multiple selections.

```yaml
- type: checkboxes
  id: preferences
  attributes:
    label: Select your preferences
    description: Choose one or more
    default: []  # Default checked values (e.g., [option1])
    options:
      - value: option1
        label: Option 1
        required: false
      - value: option2
        label: Option 2
        required: false
  validations:
    required: false
    min_selections: null
    max_selections: null
```

### Radio Buttons

Group of radio buttons for single selection.

```yaml
- type: radio
  id: single_choice
  attributes:
    label: Select one option
    description: Choose exactly one
    options:
      - value: choice1
        label: Choice 1
      - value: choice2
        label: Choice 2
    default: choice1  # Default selected value (set to null for no default)
  validations:
    required: false
```

### Tags

Editable set of unique key/value pairs, submitted as a JSON object (`{key: value, ...}`). Renders the same tagging widget used for workflow tags (Workflow Settings → General → Tags).

```yaml
- type: tags
  id: resource_tags
  attributes:
    label: Resource Tags
    description: Add labels for cost tracking
    key_placeholder: key
    value_placeholder: value
    max_pairs: 10
    default:
      environment: dev
      owner: platform-team
  validations:
    required: false
    min_selections: 0    # minimum number of pairs
    max_selections: 10   # maximum number of pairs
    key_pattern: "^[a-z][a-z0-9_-]*$"   # regex each key must match
    value_pattern: null                 # regex each value must match
```

The end user can freely add, edit, or remove pairs — including the ones the YAML author set as defaults; defaults are just a starting point, the same way `attributes.default` works for every other field type.

See [Tags Field Cross-Reference](#option-7-tags-field-cross-reference) for how a tags field's entries can reference other fields, and vice versa.

---

## Common Properties

All field types support these common properties:

### ID
**Required.** Unique identifier for the field. Used for referencing in conditions and dependencies.

```yaml
id: unique_field_name
```

### Attributes
Configuration for the field's appearance and behavior.

```yaml
attributes:
  label: Display Label
  description: Help text (shown below the field)
  placeholder: Placeholder text (for input fields)
```

### Validations
Rules for validating user input.

```yaml
validations:
  required: true  # or false
```

### Visibility
Conditional display based on other field values.

```yaml
visibility:
  condition: "other_field == 'value'"
  depends_on: ["other_field"]
```

### Dynamic
Dynamic behavior like auto-population or computed values.

```yaml
dynamic:
  auto_populate: "default value"
  computed: false
```

---

## Validation

### Built-in Validations

**Text Input:**
```yaml
validations:
  required: true
  min_length: 5
  max_length: 100
  pattern: "^[a-zA-Z0-9]+$"  # Regex pattern (string format)
```

**Note:** The `pattern` field must be a string containing a valid regular expression. The pattern will be evaluated against the input value for validation.

**Number Input:**
```yaml
validations:
  required: true
  min: 0
  max: 100
  step: 5
```

**Email Input:**
```yaml
validations:
  required: true
  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"  # Regex string
```

**Checkboxes/Dropdowns (multiple):**
```yaml
validations:
  required: false
  min_selections: 1
  max_selections: 3
```

### Custom Validators

Run custom validation logic when field values change. Supported languages: **python**, **javascript**.

**Using an external file:**
```yaml
validations:
  validator:
    type: file
    source: "scripts/validators/custom_validator.py"
    language: python  # python or javascript
    params:
      min_value: 10
      max_value: 100
    error_message: "Value must be between 10 and 100"
```

**Using inline code:**
```yaml
validations:
  validator:
    type: inline
    source: "return len(value) > 5 and value.isalnum()"
    language: python  # python or javascript
    params: {}
    error_message: "Value must be alphanumeric and longer than 5 characters"
```

**Validator function signature (Python):**
```python
def validate(value, params):
    # value: current field value
    # params: dictionary from params property
    # Return True if valid, False if invalid
    return True
```

**Validator function signature (JavaScript):**
```javascript
function validate(value, params) {
    // value: current field value
    // params: object from params property
    // Return true if valid, false if invalid
    return true;
}
```

---

## Dynamic Behavior

### Auto-Population

Automatically fill field values based on other fields or default values.

#### Option 1: Static Default Value
Provide a simple static default value that users can edit.

```yaml
dynamic:
  auto_populate: "default-value"
  computed: false  # User can edit
```

#### Option 2: Template String (Simple Concatenation)
Combine values from other fields using template syntax `{field_id}`.

```yaml
dynamic:
  auto_populate: "{cloud_provider}-{region}-resource"
  computed: false  # User can edit
  depends_on: ["cloud_provider", "region"]
```

**Example result:** If `cloud_provider = "aws"` and `region = "us-east-1"`, the field will auto-populate with `"aws-us-east-1-resource"`.

#### Option 3: Date-based Auto-Population
Use special date keywords for dynamic date values.

```yaml
dynamic:
  auto_populate: "today"  # Current date
  computed: false # User can edit
```

**Supported date values:**
- `"today"` - Current date (YYYY-MM-DD)
- `"today+7"` - 7 days from now
- `"today-30"` - 30 days ago

#### Option 4: Built-in Helper Functions
Use built-in functions for common transformations.

```yaml
dynamic:
  auto_populate:
    type: builtin
    function: "concat"
    params:
      values: ["{project_name}", "-", "{environment}"]
  computed: false
  depends_on: ["project_name", "environment"]
```

**Available built-in functions:**
- `concat` - Concatenate multiple values
- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `sum` - Add numeric values
- `multiply` - Multiply numeric values

#### Option 5: Inline Expression (JavaScript)
Write custom JavaScript for more complex logic.

```yaml
dynamic:
  auto_populate:
    type: inline
    language: javascript
    source: |
      // Available variables: form data object with all field values
      const basePrice = parseFloat(instance_type) || 0;
      const multiplier = region === 'us-east-1' ? 1.0 : 1.2;
      return (basePrice * multiplier * 730).toFixed(2);
  computed: true  # Read-only, recalculates automatically
  depends_on: ["instance_type", "region"]
```

**Notes:**
- The `source` code has access to all form field values
- Return the calculated value as a string
- Use `computed: true` to make the field read-only

#### Option 6: External Script File
Reference an external JavaScript or Python file for complex calculations.

```yaml
dynamic:
  auto_populate:
    type: file
    source: "scripts/calculate_cost.js"
    language: javascript  # or python
    params:
      tax_rate: 0.08
      currency: "USD"
  computed: true
  depends_on: ["instance_type", "region", "storage_size"]
```

**External script example (`scripts/calculate_cost.js`):**
```javascript
function calculate(formData, params) {
  // formData contains all field values
  // params contains the params from YAML
  const instanceCost = formData.instance_type * 0.05;
  const storageCost = formData.storage_size * 0.10;
  const total = (instanceCost + storageCost) * (1 + params.tax_rate);
  return total.toFixed(2) + ' ' + params.currency;
}
```

**External Python script example (`scripts/calculate_cost.py`):**
```python
def calculate(form_data, params):
    # form_data is a dictionary with all field values
    # params is a dictionary from YAML params
    instance_cost = float(form_data.get('instance_type', 0)) * 0.05
    storage_cost = float(form_data.get('storage_size', 0)) * 0.10
    total = (instance_cost + storage_cost) * (1 + params['tax_rate'])
    return f"{total:.2f} {params['currency']}"
```

#### Option 7: Tags Field Cross-Reference

Extends the template string syntax from [Option 2](#option-2-template-string-simple-concatenation) with a dotted path, `{tags_id.key}`, to reference a single entry of a [tags field's](#tags) value. This works in both directions: a tags field's own default entries can reference other fields, and other fields can pull a specific tag back out.

**A tag's default value referencing another field:**

```yaml
- type: input
  id: aws_region
  attributes:
    default: us-east-1
- type: tags
  id: env_tags
  attributes:
    default:
      region: "{aws_region}"   # resolved from aws_region's value
```

**Another field reading a specific tag's value:**

```yaml
- type: textarea
  id: summary
  dynamic:
    auto_populate: "Deploying to {env_tags.region}"
    depends_on: ["env_tags"]
```

**Notes:**
- If the referenced tag key doesn't exist, `{tags_id.key}` resolves to an empty string rather than erroring.
- A tags field's own default entries can only reference non-tags fields — they cannot reference another tags field's resolved values.
- `depends_on` must list the tags field's id for the dependent field to recalculate when tags are edited.

### Dynamic Options

Load dropdown/checkbox/radio options dynamically.

**Using external script:**
```yaml
attributes:
  options_loader:
    type: file
    source: "scripts/generators/get_options.py"
    depends_on: ["parent_field"]
```

**Using inline script:**
```yaml
attributes:
  options_loader:
    type: inline
    source: "return ['option1', 'option2', 'option3']"
```

---

## Visibility Control

Control when fields are shown or hidden based on other field values.

### Simple Condition

```yaml
visibility:
  condition: "cloud_provider != null"
  depends_on: ["cloud_provider"]
```

### Equality Check

```yaml
visibility:
  condition: "environment == 'production'"
  depends_on: ["environment"]
```

### Multiple Conditions (OR)

```yaml
visibility:
  condition: "cloud_provider == 'aws' || cloud_provider == 'azure'"
  depends_on: ["cloud_provider"]
```

### Multiple Conditions (AND)

```yaml
visibility:
  condition: "cloud_provider == 'aws' && environment == 'production'"
  depends_on: ["cloud_provider", "environment"]
```

### Array Inclusion (for checkboxes)

```yaml
visibility:
  condition: "advanced_options.includes('backup')"
  depends_on: ["advanced_options"]
```

### Complex Conditions

```yaml
visibility:
  condition: "advanced_options.includes('encryption') && cloud_provider == 'aws'"
  depends_on: ["advanced_options", "cloud_provider"]
```

**Condition Expression Syntax:**
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&` (AND), `||` (OR), `!` (NOT)
- Array methods: `.includes('value')`
- Null checks: `field != null`, `field == null`

---

## Advanced Examples

### Example 1: Cascading Dropdowns

Cloud provider selection that dynamically updates region and instance type options.

```yaml
body:
  - type: dropdown
    id: cloud_provider
    attributes:
      label: Cloud Provider
      options:
        - value: aws
        - value: azure
        - value: gcp
      default: null
    validations:
      required: true

  - type: dropdown
    id: region
    attributes:
      label: Region
      options: []
    validations:
      required: true
    visibility:
      condition: "cloud_provider != null"
      depends_on: ["cloud_provider"]
    dynamic:
      options_map:
        aws:
          - value: us-east-1
          - value: us-west-2
        azure:
          - value: eastus
          - value: westus2
        gcp:
          - value: us-central1
      depends_on_field: "cloud_provider"

  - type: dropdown
    id: instance_type
    attributes:
      label: Instance Type
      options: []
    validations:
      required: true
    visibility:
      condition: "cloud_provider != null"
      depends_on: ["cloud_provider"]
    dynamic:
      options_map:
        aws:
          - value: t2.micro
          - value: t2.small
        azure:
          - value: Standard_B1s
        gcp:
          - value: e2-micro
      depends_on_field: "cloud_provider"
```

### Example 2: Conditional Fields with Auto-Population

```yaml
body:
  - type: input
    id: project_name
    attributes:
      label: Project Name
      input_type: text
    validations:
      required: true
      pattern: "^[a-z0-9-]+$"

  - type: dropdown
    id: environment
    attributes:
      label: Environment
      options:
        - value: dev
        - value: staging
        - value: prod
    validations:
      required: true

  - type: input
    id: resource_name
    attributes:
      label: Resource Name
      input_type: text
      placeholder: auto-generated
    dynamic:
      auto_populate: "{project_name}-{environment}-resource"
      computed: false  # User can still edit

  - type: checkboxes
    id: features
    attributes:
      label: Optional Features
      options:
        - value: monitoring
          label: Enable Monitoring
        - value: backup
          label: Enable Automated Backups
        - value: encryption
          label: Enable Encryption
    visibility:
      condition: "environment == 'prod'"
      depends_on: ["environment"]

  - type: input
    id: backup_retention
    attributes:
      label: Backup Retention (days)
      input_type: number
    validations:
      min: 1
      max: 365
    visibility:
      condition: "features.includes('backup')"
      depends_on: ["features"]
```

### Example 3: Complex Multi-Level Dependencies

```yaml
body:
  - type: dropdown
    id: cloud_provider
    attributes:
      label: Cloud Provider
      options:
        - value: aws
        - value: azure
        - value: gcp
    validations:
      required: true

  - type: dropdown
    id: service_type
    attributes:
      label: Service Type
      options: []
    visibility:
      condition: "cloud_provider != null"
      depends_on: ["cloud_provider"]
    dynamic:
      options_map:
        aws:
          - value: compute
          - value: database
        azure:
          - value: compute
          - value: database
        gcp:
          - value: compute
          - value: database
      depends_on_field: "cloud_provider"

  - type: dropdown
    id: instance_size
    attributes:
      label: Size/Tier
      options: []
    visibility:
      condition: "service_type != null"
      depends_on: ["cloud_provider", "service_type"]
    dynamic:
      options_map:
        aws:
          compute:
            - value: t2.micro
            - value: t2.small
          database:
            - value: db.t2.micro
            - value: db.t2.small
        azure:
          compute:
            - value: Standard_B1s
          database:
            - value: Basic
        gcp:
          compute:
            - value: e2-micro
          database:
            - value: db-f1-micro
      depends_on_fields: ["cloud_provider", "service_type"]
      lookup_path: "{cloud_provider}.{service_type}"

  - type: input
    id: estimated_cost
    attributes:
      label: Estimated Monthly Cost (USD)
      input_type: text
      readonly: true
    dynamic:
      auto_populate: "calculateCost({cloud_provider}, {service_type}, {instance_size})"
      computed: true
      depends_on: ["cloud_provider", "service_type", "instance_size"]
```

### Example 4: Using External Scripts for Options

```yaml
body:
  - type: dropdown
    id: github_repo
    attributes:
      label: GitHub Repository
      options: []
      options_loader:
        type: api
        source: "/api/github/repos"
    validations:
      required: true

  - type: dropdown
    id: branch
    attributes:
      label: Branch
      options: []
      options_loader:
        type: file
        source: "scripts/get_branches.py"
        language: python
        params:
          include_protected: true
        depends_on: ["github_repo"]
    visibility:
      condition: "github_repo != null"
      depends_on: ["github_repo"]
```

---

## Best Practices

1. **Use meaningful IDs**: Choose descriptive field IDs that clearly indicate their purpose
2. **Always set depends_on**: When using visibility or dynamic features, always specify `depends_on` to ensure proper field updates
3. **Provide descriptions**: Help users understand each field with clear descriptions
4. **Set appropriate defaults**: Use sensible default values where applicable
5. **Validate early**: Use built-in validations before resorting to custom validators
6. **Keep conditions simple**: Complex visibility conditions can be hard to debug; break them into multiple fields if needed
7. **Test cascading dependencies**: Ensure multi-level dependent fields work correctly in all scenarios
8. **Use computed fields sparingly**: Only mark fields as computed when users should never edit them manually
9. **Optimize API calls**: For options_loader with API type, consider caching strategies to avoid excessive API requests
10. **Document custom scripts**: When using external validators or option loaders, document their expected behavior
11. **Prefer tags over ad-hoc inputs**: Use a `tags` field instead of multiple `input` fields when collecting an open-ended set of labels; use `key_pattern` to keep keys machine-safe

---

## Troubleshooting

### Field Not Showing
- Check the `visibility.condition` is correctly formatted
- Ensure all fields in `depends_on` exist and have values
- Verify the condition evaluates to true

### Options Not Loading
- Confirm `options_loader.source` path is correct
- Check `depends_on` fields have values before options load
- Verify API endpoints return the expected format: `[{value, label}]`

### Validation Not Working
- Ensure `pattern` uses properly escaped regex
- For custom validators, check the function signature matches expectations
- Verify `validator.source` path is correct for file-based validators

### Auto-Population Not Working
- Check template strings use correct field IDs: `{field_id}`
- Ensure `depends_on` includes all referenced fields
- Verify referenced fields have values before auto-population

### Tags Not Submitting Correctly
- Duplicate keys are last-write-wins — the widget only keeps one entry per key
- A dotted reference (`{tags_id.key}`) to a key that doesn't exist resolves to an empty string rather than erroring
- `min_selections`/`max_selections` on a `tags` field count key/value pairs, not characters

---

## Additional Resources

- Review the included `form.yml` example for a comprehensive reference
- Check commented examples at the end of `form.yml` for advanced use cases
- Test your forms incrementally, adding complexity gradually
