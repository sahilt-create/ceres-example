import { readFileSync } from "fs";
import { join } from "path";
import {
  hasSriLankanMultipleRenderedTextLines,
  hasSriLankanPrintCellOverflow,
  hasSriLankanPrintTableOverflow,
  isSriLankanLydiaPagelessMode,
} from "../src/templates/sri-lankan-template/helpers";

describe("Sri Lankan template print boundaries", () => {
  const css = readFileSync(
    join(process.cwd(), "src/templates/sri-lankan-template/styles.css"),
    "utf8"
  );
  const template = readFileSync(
    join(process.cwd(), "src/templates/sri-lankan-template/template.hbs"),
    "utf8"
  );
  const printCss = css.slice(css.lastIndexOf("@media print"));

  it("uses a fallback font for currency glyphs", () => {
    expect(css).toMatch(
      /\.sri-lankan-invoice \.sri-currency-symbol\s*\{[^}]*font-family:\s*Arial,[^}]*"Noto Sans"[^}]*!important;/
    );
  });

  it("renders additional information only when document details configure it", () => {
    expect(template).toContain(
      '{{#if sri.showClosingInformation}}<section class="closing-info-grid">'
    );
    expect(template).toMatch(
      /\{\{#if sri\.showAdditionalInformation\}\}<section class="additional-info">/
    );
    expect(template).toMatch(/<\/section>\{\{\/if\}\}/);
    expect(template.indexOf('class="closing-info-grid"')).toBeGreaterThan(
      template.indexOf("data-ceres-payment-table")
    );
    expect(css).toMatch(
      /\.closing-info-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
    );
    expect(css).toMatch(
      /\.closing-info-grid > :only-child\s*\{[^}]*grid-column:\s*1 \/ -1;/
    );
  });

  it("renders the invoice title at the equivalent em size", () => {
    expect(css).toMatch(
      /\.invoice-title-wrap h1\s*\{[^}]*font-size:\s*1\.5385em !important;/
    );
  });

  it("renders signature text only when a signature image exists", () => {
    expect(template).toContain(
      '{{#if invoice.signature}}<section class="signature-section">'
    );
    expect(template).toContain(
      "Authorized Signatory</span></div></section>{{/if}}"
    );
  });

  it("does not render country or place of supply", () => {
    expect(template).not.toContain("Country of Supply:");
    expect(template).not.toContain("Place of Supply:");
    expect(template).not.toContain("data-ceres-country-of-supply");
    expect(template).not.toContain("data-ceres-place-of-supply");
  });

  it("renders document fields row-wise from left to right", () => {
    expect(template).not.toContain('<section class="supply-meta">');
    expect(template).toContain(
      '{{#each sri.documentRows}}<div class="detail-row"'
    );
    expect(css).toMatch(
      /\.detail-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-flow:\s*row;/
    );
    expect(css).toMatch(
      /\.document-details \.detail-row:last-child:nth-child\(odd\)\s*\{[^}]*grid-column:\s*1 \/ -1;/
    );
  });

  it("top-aligns item values while keeping the existing horizontal alignment", () => {
    expect(css).toMatch(
      /\.line-items thead th,\s*\n\.line-items \.item-row > td\s*\{[^}]*text-align:\s*center !important;/
    );
    expect(css).toMatch(
      /\.line-items thead th\s*\{[^}]*vertical-align:\s*middle;/
    );
    expect(css).toMatch(
      /\.line-items \.item-row > td\s*\{[^}]*vertical-align:\s*top;/
    );
    expect(css).toMatch(
      /\.line-items thead th\.col-item,\s*\n\.line-items \.item-row > td\.col-item\s*\{[^}]*text-align:\s*start !important;/
    );
    expect(css).toMatch(
      /\.line-items thead th:last-child,\s*\n\.line-items \.item-row > td:last-child\s*\{[^}]*text-align:\s*end !important;/
    );
    expect(css).not.toMatch(/\.line-items \.number-cell\s*\{[^}]*text-align:/);
    expect(css).not.toMatch(/\.line-items \.text-cell\s*\{[^}]*text-align:/);
  });

  it("lets the line-item table hug its content without placeholder rows", () => {
    expect(template).not.toContain("sri.blankRows");
    expect(css).not.toContain(".placeholder-row");
  });

  it("does not render images inside line items", () => {
    expect(template).not.toContain("prepareImageGallery item.images");
    expect(template).not.toContain("prepareImageGallery item.originalImages");
    expect(template).not.toContain("CeresImageGallery");
  });

  it("uses the item text color for description list markers", () => {
    expect(css).toMatch(
      /\.item-description li,\s*\n\.item-description li::marker\s*\{[^}]*color:\s*var\(--sri-ink\) !important;/
    );
  });

  it("uses the template text color for ordered numbers and bullets", () => {
    expect(css).toMatch(
      /\.content-panel li,[\s\S]*?\.toastui-editor-contents ol > li::before\s*\{[^}]*color:\s*var\(--sri-ink\) !important;/
    );
    expect(css).toMatch(
      /\.toastui-editor-contents ul > li::before\s*\{[^}]*background-color:\s*var\(--sri-ink\) !important;/
    );
  });

  it("keeps Markdown bullets and bullet-like paragraphs compact", () => {
    expect(css).toMatch(
      /\.item-description \.toastui-editor-contents p,[\s\S]*?\.item-description p\s*\{[^}]*margin:\s*0 !important;[^}]*line-height:\s*1\.3;/
    );
    expect(css).toMatch(
      /\.item-description \.toastui-editor-contents li,[\s\S]*?\.item-description li\s*\{[^}]*margin:\s*0 !important;[^}]*line-height:\s*1\.3;/
    );
  });

  it("uses a compact item row and a full-width description row", () => {
    expect(template).toContain("data-ceres-description-inline");
    expect(template).toContain('class="item-description-row"');
    expect(template).toContain("data-ceres-description-row");
    expect(template).toContain("data-ceres-description-full-width");
    expect(template).toContain(
      'colspan="{{../mapped.visibility.visibleColumnCount}}"'
    );
    expect(css).toMatch(
      /\.item-description-row > td\s*\{[^}]*text-align:\s*start !important;[^}]*vertical-align:\s*top;/
    );
    expect(template).toContain(
      "{{#unless ../../mapped.visibility.isDescriptionFullWidth}}"
    );
    expect(template).toContain(
      "{{#if ../mapped.visibility.isDescriptionFullWidth}}"
    );
  });

  it("binds line-item and footer sections to advanced-setting visibility", () => {
    expect(template).toContain(
      "{{#if ../../mapped.visibility.showSerialNumbersInDescription}}"
    );
    expect(template).toContain(
      "{{#if (showItemSku item ../../mapped.visibility.showSkuInName)}}"
    );
    expect(template).toContain(
      '{{#if mapped.visibility.showTotalsRow}}<tr class="items-total-row">'
    );
    expect(template).toContain(
      "{{#if mapped.visibility.showTotalInWords}}<section"
    );
    expect(template).toContain("Total Amount in words:");
    expect(template).not.toContain("Total (in words):");
  });

  it("renders source-mapped summary rows without hard-coded labels", () => {
    expect(template).toContain("{{#each sri.summaryRows}}");
    expect(template).toContain(">{{label}}</th>");
    expect(template).not.toContain("{{label}}:</th>");
    expect(template).not.toContain("Total Value of Supply:");
    expect(template).not.toContain("VAT Amount (Total Value of Supply");
    expect(template).not.toContain("Total Amount/consideration including VAT:");
  });

  it("renders terms before additional notes", () => {
    expect(template.indexOf('class="content-panel terms-panel"')).toBeLessThan(
      template.indexOf('class="content-panel notes-panel"')
    );
  });

  it("provides separate mapped tax, HSN, batch, and payment summary sections", () => {
    expect(template).toContain("data-ceres-tax-summary");
    expect(template).toContain("data-ceres-hsn-summary");
    expect(template).toContain("data-ceres-batch-summary");
    expect(template).toContain("data-ceres-payment-table");
    expect(template).toContain("{{sri.summaryLabels.tax}}");
    expect(template).toContain("{{sri.summaryLabels.hsn}}");
    expect(template).toContain("{{sri.summaryLabels.batch}}");
    expect(template).toContain("heading=sri.summaryLabels.payments");
    expect(template).toContain("{{#each sri.widgets.batchSummary.columns}}");
    expect(template).toContain("{{#each sri.widgets.batchSummary.rows}}");
    expect(template).toContain("{{#if sri.isVatTax}}");
    expect(template).toContain("{{sri.vatTaxLabel}}");
    expect(template).toContain("{{#each sri.vatTaxRows}}");
    expect(template).toContain("{{sri.vatTaxInWords}}");
    expect(css).toMatch(
      /\.summary-section \.ceres-table-section\s*\{[^}]*margin:\s*0 !important;/
    );
    expect(css).toMatch(
      /\.summary-section \.ceres-table thead:first-child tr:first-child > \*\s*\{[^}]*border-top:\s*0;/
    );
    expect(css).toMatch(/\.summary-section\s*\{[^}]*border:\s*0;/);
    expect(css).not.toMatch(
      /\.summary-section \.ceres-table tr > :(?:first|last)-child/
    );
    expect(css).not.toMatch(
      /\.summary-section \.ceres-table tr:last-child > \*/
    );
  });

  it("renders the mapped contact-details bar as the final document section", () => {
    expect(template).toContain("data-ceres-contact-details");
    expect(template).toContain("{{sri.contact.intro}}");
    expect(template).toContain("{{sri.contact.emailLabel}}");
    expect(template).toContain("{{sri.contact.phoneLabel}}");
    expect(template.indexOf("data-ceres-contact-details")).toBeGreaterThan(
      template.indexOf("{{> RefrensBranding invoice}}")
    );
    expect(css).toMatch(
      /\.contact-details-bar\s*\{[^}]*border:\s*1px solid var\(--sri-rule\);[^}]*padding:\s*8px;[^}]*text-align:\s*center;/
    );
  });

  it("renders numbered attachment links with single-line truncation", () => {
    expect(template).toContain("data-ceres-attachments");
    expect(template).toContain("{{sri.attachments.label}}");
    expect(template).toContain("{{#each sri.attachments.items}}");
    expect(template).toContain('href="{{url}}"');
    expect(template).toContain('title="{{label}}"');
    expect(template).toContain('class="attachment-number">{{number}}.');
    expect(template).toContain('class="attachment-name">{{label}}');
    expect(template).not.toContain('class="attachment-preview"');
    expect(css).toMatch(
      /\.attachment-list\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
    );
    expect(css).toMatch(
      /\.attachment-name\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/
    );
  });

  it("renders document details as separate bordered fields", () => {
    expect(css).toMatch(
      /\.document-details \.detail-row\s*\{[^}]*border:\s*1px solid var\(--sri-rule\);[^}]*padding:\s*5px 9px;/
    );
    expect(css).not.toMatch(
      /\.content-panel,\s*\n\.document-details\s*\{[^}]*border:/
    );
  });

  it("renders the Transport Details heading at normal weight", () => {
    expect(template).toContain("<h2>Transport Details</h2>");
    expect(css).toMatch(/\.transport-panel h2\s*\{[^}]*font-weight:\s*400;/);
  });

  it("renders mapped TIN fields before billing-party names", () => {
    const supplierTin = template.indexOf("{{#each sri.supplier.tinRows}}");
    const supplierName = template.indexOf("Supplier's Name:");
    const purchaserTin = template.indexOf("{{#each sri.purchaser.tinRows}}");
    const purchaserName = template.indexOf("Purchaser's Name:");

    expect(supplierTin).toBeGreaterThan(-1);
    expect(purchaserTin).toBeGreaterThan(-1);
    expect(supplierTin).toBeLessThan(supplierName);
    expect(purchaserTin).toBeLessThan(purchaserName);
  });

  it("uses the billing-party structure for shipped-from and shipped-to details", () => {
    expect(template).toMatch(
      /<article class="party-box shipping-party-box">[\s\S]*?display\.labels\.shippedFrom[\s\S]*?class="address-row"[\s\S]*?display\.partyDetails\.shippedFrom/
    );
    expect(template).toMatch(
      /<article class="party-box shipping-party-box">[\s\S]*?display\.labels\.shippedTo[\s\S]*?class="address-row"[\s\S]*?display\.partyDetails\.shippedTo/
    );
    expect(template).not.toMatch(
      /<article class="detail-panel"><h2>\{\{display\.labels\.shipped(?:From|To)\}\}/
    );
  });

  it("left-aligns statutory total labels and right-aligns their values", () => {
    expect(css).toMatch(
      /\.total-row th,\s*\n\.total-row td\s*\{[^}]*vertical-align:\s*middle;/
    );
    expect(css).toMatch(
      /\.total-row th\s*\{[^}]*text-align:\s*start !important;/
    );
    expect(css).toMatch(
      /\.total-row \.total-value\s*\{[^}]*text-align:\s*end !important;/
    );
  });

  it("renders the UPI QR square without a fixed height", () => {
    expect(css).toMatch(
      /\.upi-qr\s*\{[^}]*width:\s*100px;[^}]*aspect-ratio:\s*1;/
    );
  });

  it("lets the line-item header hug its content", () => {
    expect(css).toMatch(
      /\.line-items thead th\s*\{[^}]*height:\s*auto;[^}]*text-align:\s*center;[^}]*vertical-align:\s*middle;/
    );
    expect(css).not.toMatch(/\.line-items thead th\s*\{[^}]*height:\s*72px;/);
  });

  it("leaves page geometry and recurring header space to the PDF host", () => {
    expect(printCss).not.toContain("@page {");
    expect(printCss).toContain('html,\n  body,\n  [id="documentOutput"]');
    expect(printCss).not.toMatch(/min-height:\s*[\d.]+(?:px|em)/);
    expect(printCss).toContain("margin: 0 !important;");
    expect(printCss).toContain("padding: 0 !important;");
    expect(printCss).toContain("overflow: visible !important;");
  });

  it("repeats the table header with a clean cap after page breaks", () => {
    expect(printCss).toMatch(
      /\.line-items thead\s*\{[^}]*display:\s*table-header-group;/
    );
    expect(printCss).toMatch(
      /\.line-items thead th\s*\{[^}]*background-image:\s*linear-gradient\(\s*var\(--sri-table-rule\),\s*var\(--sri-table-rule\)\s*\);[^}]*background-size:\s*100% 0\.5px;/
    );
    expect(printCss).toMatch(
      /\.line-items tbody tr,[\s\S]*?break-inside:\s*avoid-page;/
    );
  });

  it("keeps short sections together and allows lengthy prose to fragment", () => {
    expect(printCss).toMatch(
      /\.party-grid,[\s\S]*?\.signature-section,[\s\S]*?break-inside:\s*avoid;/
    );
    expect(printCss).toMatch(
      /\.content-panel,[\s\S]*?\.content-panel \.toastui-editor-contents\s*\{[^}]*break-inside:\s*auto;/
    );
    expect(printCss).toMatch(
      /\[data-ceres-attachments\],[\s\S]*?\.closing-info-grid\s*\{[^}]*break-inside:\s*auto;/
    );
    expect(printCss).toMatch(
      /\.attachment-list li\s*\{[^}]*break-inside:\s*avoid-page;/
    );
    expect(printCss).toContain("orphans: 3;");
    expect(printCss).toContain("widows: 3;");
  });

  it("keeps each item row with its full-width description when possible", () => {
    expect(printCss).toMatch(
      /\.line-items \.item-row:has\(\+ \.item-description-row\)\s*\{[^}]*break-after:\s*avoid-page;/
    );
    expect(printCss).toMatch(
      /\.line-items \.item-description-row\s*\{[^}]*break-before:\s*avoid-page;[^}]*break-inside:\s*auto;/
    );
  });

  it("never wraps numeric values, including in dense tables", () => {
    expect(printCss).toMatch(
      /\.line-items td\.number-cell,[\s\S]*?white-space:\s*nowrap;/
    );
    expect(printCss).toMatch(
      /\.items-table-wrap\.is-dense \.line-items td\.number-cell,[\s\S]*?white-space:\s*nowrap;[\s\S]*?overflow-wrap:\s*normal;/
    );
    expect(printCss).toMatch(
      /\.line-items th\.col-item,[\s\S]*?overflow-wrap:\s*break-word;/
    );
  });

  it("uses system fonts and equivalent em sizes for the default and print-fit floor", () => {
    expect(css).toMatch(
      /\.sri-lankan-invoice\s*\{[^}]*font-size:\s*0\.8125em;/
    );
    expect(css).toMatch(
      /\.sri-lankan-invoice \*\s*\{[^}]*font-size:\s*1em !important;[^}]*font-family:\s*var\(--subtitle-font,[^}]*!important;/
    );
    expect(css).toMatch(
      /\.invoice-title-wrap h1\s*\{[^}]*font-size:\s*1\.5385em !important;[^}]*font-family:\s*var\([^}]*--title-font,[^}]*!important;/
    );
    expect(css).toMatch(
      /\.sri-lankan-invoice h1,[\s\S]*?\.sri-lankan-invoice \.ceres-table-heading\s*\{[^}]*font-family:\s*var\([^}]*--title-font,[^}]*--subtitle-font[^}]*!important;/
    );
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items th,[\s\S]*?font-size:\s*1em;/
    );
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items td \*\s*\{[^}]*font-size:\s*1em !important;/
    );
    expect(printCss).toMatch(
      /\.sri-lankan-invoice\.is-compact-print-table \.line-items\s*\{[^}]*font-size:\s*0\.8462em !important;/
    );
    // A descendant selector would compound the factor at every nesting level.
    expect(printCss).not.toMatch(
      /\.is-compact-print-table \.line-items \*[^{]*\{[^}]*font-size/
    );
    const declaredFontSizes = Array.from(
      css.matchAll(/font-size:\s*([\d.]+)px/g),
      (match) => Number(match[1])
    );
    expect(Math.min(...declaredFontSizes)).toBeGreaterThanOrEqual(11);
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items\s*\{[^}]*table-layout:\s*auto;/
    );
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items col\s*\{[^}]*width:\s*1%;/
    );
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items col\.col-item\s*\{[^}]*width:\s*auto;/
    );
    expect(css).toMatch(
      /\.items-table-wrap\.is-dense \.line-items th:not\(\.col-item\),[\s\S]*?width:\s*1%;/
    );
    expect(css).not.toContain("--items-table-min-width");
  });

  it("detects print-table overflow without reacting to sub-pixel noise", () => {
    const measured = (clientWidth: number, scrollWidth: number) => ({
      clientWidth,
      scrollWidth,
      getBoundingClientRect: () => ({ width: clientWidth }),
    });

    expect(
      hasSriLankanPrintTableOverflow(measured(700, 700), measured(700, 700))
    ).toBe(false);
    expect(
      hasSriLankanPrintTableOverflow(measured(700, 700), measured(700, 701))
    ).toBe(false);
    expect(
      hasSriLankanPrintTableOverflow(measured(700, 700), measured(700, 702))
    ).toBe(true);
    expect(
      hasSriLankanPrintCellOverflow([
        { clientWidth: 100, scrollWidth: 101 },
        { clientWidth: 100, scrollWidth: 102 },
      ])
    ).toBe(true);
  });

  it("detects wrapped header text from rendered line positions", () => {
    expect(
      hasSriLankanMultipleRenderedTextLines([
        { top: 10, width: 30, height: 13 },
        { top: 10.2, width: 20, height: 13 },
      ])
    ).toBe(false);
    expect(
      hasSriLankanMultipleRenderedTextLines([
        { top: 10, width: 30, height: 13 },
        { top: 23, width: 20, height: 13 },
      ])
    ).toBe(true);
  });

  it("distinguishes Lydia pageless output from normal paged printing", () => {
    expect(isSriLankanLydiaPagelessMode("?isLydiaMode=1")).toBe(true);
    expect(isSriLankanLydiaPagelessMode("?devMode=1")).toBe(false);
    expect(isSriLankanLydiaPagelessMode("")).toBe(false);
    expect(printCss).toContain("body.is-sri-lydia-pageless-print");
  });
});
