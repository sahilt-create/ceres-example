---
name: design-to-template
description: Convert a Figma export or screenshot into a Ceres Handlebars template
---

# Design to Template

## When to use this

When someone gives you a visual design (Figma export, screenshot, mockup image) and wants it turned into a working Ceres template.

## Step-by-step process

### 1. Analyze the design

Look at the image and identify these sections (most invoice/document templates follow this pattern):

| Section | What to look for | Maps to |
|---------|-----------------|---------|
| **Letterhead** | Logo, company name, address at the top | `billedBy.name`, `billedBy.street`, `billedBy.city`, etc. |
| **Document info** | Invoice number, date, due date, PO number | `invoiceNumber`, `invoiceDateUserInput`, `formattedDueDate` |
| **Billed to** | Client name, address, tax ID | `billedTo.name`, `billedTo.street`, `billedTo.gstin` |
| **Status** | Paid/Unpaid/Overdue tag | Use `{{> InvoiceStatus}}` widget |
| **Line items** | Table with item name, quantity, rate, amount | `{{#each items}}...{{/each}}` |
| **Totals** | Subtotal, tax, discount, total | `totals.subTotal`, `totals.total`, `totals.igst`, etc. |
| **Notes** | Free text area for notes | `{{> MarkdownViewer (prepareMarkdownViewerData notes)}}` |
| **Terms** | List of terms and conditions | `{{#each terms}}...{{/each}}` |
| **Footer** | Signature area, bank details | `billedBy.bankDetails`, signature fields |

### 2. Build the template folder

Create the standard structure:

```
src/templates/my-template/
  index.ts
  template.hbs
  styles.css
  version.json
  samples.json
```

Use the `scaffold-template` skill for the boilerplate of each file.

### 3. Translate visual layout to CSS

Map visual properties to CSS:

| Visual element | CSS approach |
|---------------|-------------|
| Side-by-side sections | `display: flex` or `display: grid` |
| Colored header bar | `background-color` on the header div |
| Borders/separators | `border-bottom` or `border-top` |
| Rounded corners | `border-radius` |
| Shadows | `box-shadow` (but avoid for print) |
| Custom fonts | Load via `@import` or use `--ceres-font-family` |

### 4. Map design colors to CSS custom properties

If the design uses a primary accent color, map it to `--ceres-primary-color` so users can customize it later:

```css
.header {
  background-color: var(--ceres-primary-color, #2e8555);
}
```

Always provide a fallback value that matches the design.

### 5. Handle print styles

Designs often look different on screen versus print. Add these print rules:

```css
@media print {
  /* Remove shadows (they look bad when printed) */
  * { box-shadow: none !important; }

  /* Remove background colors if they waste ink */
  .header { background-color: transparent; color: #333; }

  /* Remove padding/margin that exists for screen layout */
  .page { padding: 0; margin: 0; max-width: none; }

  /* Make sure the content does not overflow */
  body { overflow: visible !important; }
}
```

### 6. Check your work

Use this checklist:

- [ ] Does the rendered template match the design visually?
- [ ] Are all the right API fields being used in the right places?
- [ ] Do the colors respond to `--ceres-*` custom properties?
- [ ] Does it look good when printed (Ctrl+P)?
- [ ] Are all widget imports present in `index.ts`?
- [ ] Does `npm run build:template --template=my-template` succeed?

## Layout patterns catalog

### Split header (logo left, info right)

```handlebars
<div class="header">
  <div class="header-left">
    {{#if billedBy.logo}}
      <img src="{{billedBy.logo}}" class="logo" />
    {{/if}}
    <h2>{{billedBy.name}}</h2>
  </div>
  <div class="header-right">
    <p>Invoice #{{invoiceNumber}}</p>
    <p>Date: {{formateShortDateWithOffset invoiceDateUserInput ownerOffset}}</p>
  </div>
</div>
```

```css
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
```

### Full-width colored bar

```handlebars
<div class="brand-bar">
  <h1>{{invoiceTitle}}</h1>
</div>
```

```css
.brand-bar {
  background-color: var(--ceres-primary-color, #2e8555);
  color: white;
  padding: 20px 40px;
}
```

### Two-column addresses

```handlebars
<div class="addresses">
  <div class="from">
    <h4>From</h4>
    <p><strong>{{billedBy.name}}</strong></p>
    <p>{{billedBy.street}}</p>
    <p>{{billedBy.city}}, {{billedBy.state}} {{billedBy.pincode}}</p>
  </div>
  <div class="to">
    <h4>To</h4>
    <p><strong>{{billedTo.name}}</strong></p>
    <p>{{billedTo.street}}</p>
    <p>{{billedTo.city}}, {{billedTo.state}} {{billedTo.pincode}}</p>
  </div>
</div>
```

```css
.addresses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin: 24px 0;
}
```

### Right-aligned totals

```handlebars
<div class="totals">
  <div class="totals-row">
    <span>Subtotal</span>
    <span>{{totals.subTotal}}</span>
  </div>
  {{#if totals.igst}}
  <div class="totals-row">
    <span>IGST</span>
    <span>{{totals.igst}}</span>
  </div>
  {{/if}}
  <div class="totals-row total-final">
    <span>Total</span>
    <span>{{totals.total}}</span>
  </div>
</div>
```

```css
.totals {
  margin-left: auto;
  width: 300px;
}

.totals-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.total-final {
  font-weight: bold;
  font-size: 1.1em;
  border-bottom: 2px solid #333;
}
```

### Responsive mixed-content summary sections

For side-by-side Terms, Bank Details, and Tax/HSN panels:

- Use a responsive grid with `minmax(0, ...)` columns and stack the panels when the actual invoice container becomes narrow. Prefer a container query when PDF page width may differ from the browser viewport.
- Use semantic tables for label/value data.
- Let prose, labels, names, and other descriptive text wrap only at normal word boundaries.
- Keep account numbers, routing codes, IFSC/SWIFT codes, HSN/SAC codes, percentages, and monetary values on one line with `white-space: nowrap`, `overflow-wrap: normal`, and `word-break: normal`.
- Do not solve overflow by shrinking all text or applying `overflow-wrap: anywhere` to numeric/code cells.
- Visually verify both a normal-width paged PDF and a narrow/Pageless PDF for overlap, clipping, unwanted number wrapping, and correct panel stacking.
