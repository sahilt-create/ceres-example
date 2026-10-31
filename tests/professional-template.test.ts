import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/professional-template.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/professional-template/template.hbs";
import {
  buildProfessionalView,
  formatContext,
  formatDocumentDate,
  formatFigure,
  foreignAmountInWords,
  withRefrensDefaults,
  mapCompliance,
  mapParty,
  mapItemTable,
  mapScript,
  mapPrint,
  withTemplateSettings,
  mapStockSummary,
  onThemeColor,
  registerProfessionalHelpers,
  resolveSettings,
} from "../src/templates/professional-template/helpers";
import taxSummaryPartial from "../src/widgets/tax-summary/TaxSummaryTable.hbs";
import hsnSummaryPartial from "../src/widgets/hsn-summary/HsnSummaryTable.hbs";
import paymentTablePartial from "../src/widgets/payment-table/PaymentTable.hbs";
import brandingPartial from "../src/widgets/refrens-branding/RefrensBranding.hbs";
import ceresImagePartial from "../src/widgets/image/CeresImage.hbs";
import ceresImageGalleryPartial from "../src/widgets/image/CeresImageGallery.hbs";
import invoiceStatusPartial from "../src/widgets/invoice-status/InvoiceStatus.hbs";
import { computeTaxSummary } from "../src/widgets/tax-summary/utils";
import { computeHsnSummary } from "../src/widgets/hsn-summary/utils";
import { computePaymentColumns } from "../src/widgets/payment-table/utils";
import { prepareImageGallery } from "../src/widgets/image/utils";
import registerFormatCurrencyHelper from "../src/widgets/shared/registerFormatCurrencyHelper";
import registerTaxFlagHelpers from "../src/widgets/shared/registerTaxFlagHelpers";

type Json = Record<string, any>;

const TEMPLATE_DIR = path.join(
  __dirname,
  "../src/templates/professional-template"
);

/* A fresh, mutable copy of the fixture's wrapped payload. */
const payload = (edit?: (invoice: Json, root: Json) => void): Json => {
  const copy = JSON.parse(JSON.stringify(fixture));
  if (edit) edit(copy.invoice, copy);
  return copy;
};

const state = (edit?: (invoice: Json, root: Json) => void): Json =>
  normalizeInvoiceTemplateState(payload(edit) as never) as unknown as Json;

const render = (edit?: (invoice: Json, root: Json) => void): string =>
  template(state(edit));

const view = (edit?: (invoice: Json, root: Json) => void) =>
  buildProfessionalView(state(edit));

/* The opening tag of the first element carrying an attribute or class. */
const tagWith = (html: string, marker: string): string => {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const start = html.lastIndexOf("<", at);
  return html.slice(start, html.indexOf(">", at) + 1);
};

beforeAll(() => {
  registerProfessionalHelpers(HandlebarsRuntime);
  registerFormatCurrencyHelper(HandlebarsRuntime);
  registerTaxFlagHelpers(HandlebarsRuntime);

  HandlebarsRuntime.registerHelper(
    "formateShortDateWithOffset",
    (value: unknown) => `date(${String(value ?? "")})`
  );
  HandlebarsRuntime.registerHelper(
    "formatPhoneNumber",
    (value: unknown) => `tel(${String(value ?? "")})`
  );
  HandlebarsRuntime.registerHelper(
    "prepareMarkdownViewerData",
    (content: unknown) => ({ content })
  );
  HandlebarsRuntime.registerPartial(
    "MarkdownViewer",
    (context: { content?: string }) =>
      `<div class="md">${context.content}</div>`
  );
  HandlebarsRuntime.registerPartial("TaxSummaryTable", taxSummaryPartial);
  HandlebarsRuntime.registerHelper(
    "computeTaxSummary",
    (items: unknown, options: { hash?: Json }) =>
      computeTaxSummary(Array.isArray(items) ? items : [], {
        isIgst: !!options?.hash?.isIgst,
        isUtgst: !!options?.hash?.isUtgst,
      })
  );
  HandlebarsRuntime.registerPartial("HsnSummaryTable", hsnSummaryPartial);
  HandlebarsRuntime.registerHelper(
    "computeHsnSummary",
    (items: unknown, options: { hash?: Json }) =>
      computeHsnSummary(Array.isArray(items) ? items : [], {
        isIgst: !!options?.hash?.isIgst,
        isUtgst: !!options?.hash?.isUtgst,
      })
  );
  HandlebarsRuntime.registerHelper("amountInWords", () => "words");
  HandlebarsRuntime.registerPartial("PaymentTable", paymentTablePartial);
  HandlebarsRuntime.registerHelper(
    "computePaymentColumns",
    (payments: unknown, options: { hash?: Json }) =>
      computePaymentColumns(Array.isArray(payments) ? payments : [], {
        businessCurrency: options?.hash?.businessCurrency,
        currency: options?.hash?.currency,
      })
  );
  HandlebarsRuntime.registerPartial("RefrensBranding", brandingPartial);
  HandlebarsRuntime.registerPartial("CeresImage", ceresImagePartial);
  HandlebarsRuntime.registerPartial(
    "CeresImageGallery",
    ceresImageGalleryPartial
  );
  HandlebarsRuntime.registerHelper(
    "prepareImageGallery",
    (images: unknown, options: { hash?: Json }) =>
      prepareImageGallery(images as never, {
        variant: options?.hash?.variant,
        alt: options?.hash?.alt,
      })
  );
  HandlebarsRuntime.registerPartial("InvoiceStatus", invoiceStatusPartial);
  HandlebarsRuntime.registerHelper("computeInvoiceStatus", (invoice: Json) => ({
    tags: [
      {
        text: invoice?.status === "PAID" ? "Paid" : "Unpaid",
        finalClass: "invoice-tag",
      },
    ],
  }));
});

describe("Professional Template — render", () => {
  it("maps the reference document from the payload", () => {
    const html = render();
    // Header: title, subtitle, the details, the business logo top right.
    expect(html).not.toContain("pt-mark");
    expect(html).toContain('src="apex-sample-logo.png"');
    expect(html).toContain(
      '<h1 class="pt-title" data-role="title">Equipment Quotation</h1>'
    );
    expect(html).toContain(
      '<p class="pt-subtitle">Supply of VRV System, Equipment, accessories &amp; allied materials.</p>'
    );
    // Document details: business labels, refrens.com's date format, custom headers.
    expect(html).toMatch(
      /pt-meta-label">Drawing No<[\s\S]*?QT-R2\/A5\/880\/SR\/46\/26-27/
    );
    expect(html).toMatch(/pt-meta-label">Date<[\s\S]*?May 27, 2026/);
    expect(html).toMatch(/pt-meta-label">DWG\. NO<[\s\S]*?>R1</);
    // Billed By | Billed To cards (Figma): heading, name, address on one line, fields.
    const parties = html.slice(
      html.indexOf('data-section="parties"'),
      html.indexOf("</section>", html.indexOf('data-section="parties"'))
    );
    expect(parties.indexOf('data-role="billed-by"')).toBeLessThan(
      parties.indexOf('data-role="billed-to"')
    );
    expect(parties).toContain('<h2 class="pt-card-title">Client Name</h2>');
    expect(parties).toContain("SAMPLE CLIENT PVT LTD");
    expect(parties).toContain(
      "Sample House, 1/1 Sample Street, Kolkata, West Bengal, India - 700001"
    );
    expect(parties).toMatch(
      /pt-field-label">GSTIN<\/span><span class="pt-field-value pt-num pt-break">19AAAAA0000A1Z5/
    );
    expect(parties).toMatch(
      /pt-field-label">Email<\/span><span class="pt-field-value pt-email pt-break">client@example.com/
    );
    // The seller's card carries its own GSTIN.
    expect(parties).toMatch(/GSTIN<\/span><span[^>]*>19ABCDE1234F1Z5/);
    // Totals in the right-hand column; the grand total between its rules.
    const side = html.slice(html.indexOf('class="pt-bottom-side"'));
    ["Sub Total", "Discount", "CGST", "SGST"].forEach((label) =>
      expect(side).toMatch(
        new RegExp(`ceres-subtotal-label"[^>]*>\\s*${label}`)
      )
    );
    expect(side).toMatch(
      /pt-grand-row[\s\S]*?Equipment Cost[\s\S]*?₹10,21,694\.98/
    );
    expect(side).toContain("₹77,925.89");
    // The words head the left column (user request, 2026-10-24).
    expect(html).toContain("TEN LAKH TWENTY ONE THOUSAND");
    // Terms keep every line (no Payment Terms card here), numbered; bank rows.
    expect(html).toContain(
      "<li>Price validity: 10 days from the date of submission.</li>"
    );
    expect(html).toContain(
      "<li>90% Advance along with order and before delivery of materials</li>"
    );
    expect(html).not.toContain("pt-pay-card");
    expect(html).toMatch(
      /pt-kv-label pt-bank-bankName">Bank<[\s\S]*?Sample Bank/
    );
    expect(html).toMatch(/pt-kv-label pt-bank-ifsc">IFSC<[\s\S]*?SMPL0000123/);
  });

  it("prints the account's columns in its order, money with the currency symbol", () => {
    const html = render();
    const items = html.slice(html.indexOf('data-testid="items-table"'));
    const header = items.slice(
      items.indexOf("<thead>"),
      items.indexOf("</thead>")
    );
    const labels = Array.from(
      header.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g),
      (m) =>
        m[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
    );
    // The serial heading carries no text (user request); its name is kept for screen readers.
    expect(header).toContain('aria-label="Sr."></th>');
    expect(labels).toEqual([
      "",
      "Product Description",
      "Location",
      "Remote Type",
      "Model",
      "TR",
      "Qty",
      "Unit",
      "Unit Price (₹)",
      "Amount (₹)",
    ]);
    // The figures as printed: each cell's data-label repeats its heading ("Unit Price (₹)")
    // for the phone layout, so it is left out here.
    const body = items
      .slice(items.indexOf("</thead>"), items.indexOf('class="pt-totals'))
      .replace(/ data-label="[^"]*"/g, "");
    expect(body).toContain("₹7,60,698.00");
    expect(body).toContain("BLOCK - 1");
    expect(body).toContain("RXQ42RY16");
  });

  it("keeps the totals out of the items' columns", () => {
    const html = render();
    const items = html.slice(
      html.indexOf('data-testid="items-table"'),
      html.indexOf('data-testid="totals-table"')
    );
    expect(items).not.toContain("ceres-subtotal-row");
    expect(items).toContain("</table>");
    expect(html).toMatch(
      /data-testid="totals-table"[\s\S]*?data-ceres-subtotal-row="total"/
    );
    expect(html).not.toMatch(/ceres-subtotal-label" colspan/);
  });

  it("prints group names as entered and numbers their items 1., 2.… from 1 again, as refrens.com", () => {
    const html = render();
    const groups = Array.from(
      html.matchAll(/pt-group-row[^>]*>\s*<td colspan="\d+">([^<]+)</g),
      (m) => m[1]
    );
    expect(groups).toEqual(["OUTDOOR UNITS", "INDOOR UNITS", "REFNET JOINT"]);
    const serials = Array.from(
      html.matchAll(
        /<tr class="pt-item-row[\s\S]*?data-testid="num">(\d+\.)</g
      ),
      (m) => m[1]
    );
    expect(serials).toEqual(["1.", "1.", "2.", "3.", "4.", "1.", "2.", "3."]);
  });

  it("keeps sample-free sections out until the document has their data", () => {
    const html = render();
    // No transport / shipped from / notes / attachments / payments in the reference.
    [
      'data-section="dispatch"',
      'data-section="notes"',
      'data-section="attachments"',
      'data-section="payments"',
    ].forEach((hook) => expect(html).not.toContain(hook));
    // The compliance box is present (live update target) but shows only with a value (CSS).
    expect(html).toContain('data-ceres-field="irn"');
    expect(html).toContain('data-ceres-field-container="documentQr"');
  });
});

describe("Professional Template — boolean settings", () => {
  it("hideTotals hides the totals rows and the cost card; hideTaxes the tax rows and note", () => {
    const hidden = render((invoice) => {
      invoice.hideTotals = true;
      invoice.advanceOptions.hideTotals = true;
    });
    expect(tagWith(hidden, 'data-ceres-subtotal-row="total"')).toContain(
      "is-hidden-by-totals"
    );
    expect(hidden).not.toContain('data-testid="cost-card"');

    const noTaxes = render((invoice) => {
      invoice.hideTaxes = true;
      invoice.advanceOptions.hideTaxes = true;
    });
    expect(tagWith(noTaxes, 'data-ceres-subtotal-row="cgst')).toContain(
      "is-hidden-by-taxes"
    );
    expect(noTaxes).not.toContain("pt-cost-note");
  });

  it("hideTotalInWords hides the words line (kept for the live toggle); showTotalsRow adds the column total", () => {
    const words = tagWith(
      render((invoice) => {
        invoice.hideTotalInWords = true;
      }),
      "data-ceres-total-in-words"
    );
    expect(words).toContain("is-hidden-by-words-setting");
    expect(tagWith(render(), "data-ceres-total-in-words")).not.toContain(
      "is-hidden-by-words-setting"
    );
    // A 3-decimal document keeps its words line.
    const threeDecimals = tagWith(
      render((invoice) => {
        invoice.subUnitLength = 3;
      }),
      "data-ceres-total-in-words"
    );
    expect(threeDecimals).not.toBe("");
    expect(threeDecimals).not.toContain("is-hidden");
    const totals = render((invoice) => {
      invoice.showTotalsRow = true;
    });
    expect(totals).toContain('data-testid="items-total"');
    expect(totals).toMatch(/items-total[\s\S]*?9,62,048\.00/);
  });

  it("renders the summaries hidden while off, so the host's live toggles can show them", () => {
    const off = render();
    expect(tagWith(off, "data-ceres-hsn-summary")).toContain("display: none");
    expect(tagWith(off, "data-ceres-tax-summary")).toContain("display: none");

    const on = render((invoice) => {
      invoice.advanceOptions.showHsnSummary = true;
      invoice.advanceOptions.taxSummaryView = "TABLE";
      invoice.hsnSummary = {
        hsnList: [{ hsn: "8415", taxableValue: 865843.2 }],
      };
    });
    expect(tagWith(on, "data-ceres-hsn-summary")).not.toContain(
      "display: none"
    );
    expect(tagWith(on, "data-ceres-tax-summary")).not.toContain(
      "display: none"
    );
    expect(on).toContain("<td>8415</td>");

    const payments = (show?: boolean) =>
      render((invoice) => {
        invoice.allPayments = [
          { amount: 1000, paymentDate: "2026-06-01", paymentMethod: "CASH" },
        ];
        if (show !== undefined) invoice.advanceOptions.showPaymentsTable = show;
      });
    // refrens.com prints payments only with "Show payments table" on; unset or off, hidden.
    expect(tagWith(payments(true), "data-ceres-payment-table")).not.toContain(
      "display: none"
    );
    expect(tagWith(payments(), "data-ceres-payment-table")).toContain(
      "display: none"
    );
    expect(tagWith(payments(false), "data-ceres-payment-table")).toContain(
      "display: none"
    );
  });

  it("isDescriptionFullWidth moves the description between its two live targets", () => {
    const edit = (full: boolean) => (invoice: Json) => {
      invoice.items[1].description = "Inverter, R32";
      invoice.advanceOptions.isDescriptionFullWidth = full;
    };
    const inline = render(edit(false));
    expect(tagWith(inline, "data-ceres-description-row")).toContain(
      "display: none"
    );
    expect(inline).toMatch(
      /data-ceres-description-inline>\s*<div data-ceres-description-content>/
    );

    const full = render(edit(true));
    expect(tagWith(full, "data-ceres-description-row")).not.toContain(
      "display: none"
    );
    expect(full).toMatch(
      /data-ceres-description-full-width>\s*<div data-ceres-description-content>/
    );
  });

  it("itemNameFullWidth puts the name on a row of its own above the figures", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.itemNameFullWidth = true;
    });
    expect(html).toMatch(/pt-name-row[\s\S]*?<span class="pt-item-name">42 HP/);
    expect(
      view((invoice) => {
        invoice.advanceOptions.itemNameFullWidth = true;
      }).table.rows[1]
    ).toMatchObject({ nameRow: true });
  });

  it("showThumbnailAsColumn shows an item's thumbnail; hideGroupSubTotal keeps group totals out", () => {
    const thumbs = render((invoice) => {
      invoice.advanceOptions.showThumbnailAsColumn = true;
      invoice.items[1].thumbnail = "https://example.com/t.png";
    });
    expect(thumbs).toContain("pt-item-thumbnail");
    expect(thumbs).toContain("has-thumbnails");

    const subtotal = (hide: boolean) =>
      view((invoice) => {
        invoice.advanceOptions.hideGroupSubTotal = hide;
        invoice.items.splice(2, 0, {
          _id: "gt",
          name: "Sub Total",
          isGroupItemTotalRow: true,
          amount: 760698,
        });
      }).table.rows.some((row: Json) => row.isGroupTotal);
    expect(subtotal(true)).toBe(false);
    expect(subtotal(false)).toBe(true);
  });

  it("inline SKU / HSN / unit codes follow their settings", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showSkuInInvoice = true;
      invoice.advanceOptions.hsnView = "MERGE";
      invoice.items[1].sku = "SKU-1";
    });
    expect(html).toContain('<span class="pt-item-code">SKU: SKU-1</span>');
    expect(html).toContain('<span class="pt-item-code">HSN/SAC: 8415</span>');
  });

  it("Country / Place of Supply in their own row above the items, as refrens.com prints them; hideCountryOfSupply hides them (kept for the live toggle)", () => {
    const html = render();
    const at = html.indexOf('data-section="supply"');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(html.indexOf('data-section="items"'));
    expect(tagWith(html, "data-ceres-country-of-supply")).not.toContain(
      "display:none"
    );
    // Never inside the Shipped To card.
    const shipped = render((invoice) => {
      invoice.shippedTo = {
        name: "Site Office",
        city: "Howrah",
        country: "IN",
      };
    });
    expect(shipped).not.toMatch(
      /data-role="shipped-to"[^]*?data-ceres-country-of-supply[^]*?data-section="supply"/
    );
    expect(shipped.match(/data-ceres-country-of-supply/g)).toHaveLength(1);
    expect(
      tagWith(
        render((invoice) => {
          invoice.advanceOptions.hideCountryOfSupply = true;
        }),
        "data-ceres-country-of-supply"
      )
    ).toContain("display:none");
  });

  it("letterhead, footer and footerOnLastPage", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.letterHeadFooter = "https://example.com/foot.png";
    });
    expect(every).toContain('src="https://example.com/head.png"');
    expect(every).toContain("pt-footer-fixed");
    expect(every).toContain("pt-page-frame-footer");

    const last = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = { pdfOptions: { footerOnLastPage: true } };
    });
    expect(last).not.toContain("pt-footer-fixed");
    expect(last).not.toContain("pt-page-frame-footer");
  });

  it("keeps a long header detail beside its label, wrapping in the value column", () => {
    const long =
      "Lorem ipsum is simply dummy text of the printing and typesetting industry.";
    const html = render((invoice) => {
      invoice.customHeaders.push({ label: "Custom Fields", value: long });
    });
    expect(html).toMatch(
      /pt-meta-row pt-meta-customHeader"[\s\S]*?Custom Fields<\/span>\s*<span class="pt-meta-value">Lorem ipsum/
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.pt-meta \{[^}]*grid-template-columns: minmax\(100px, max-content\) minmax\(min-content, 1fr\);/
    );
  });

  it("letterHeadOnFirstPage: the letterhead repeats in the print frame's header unless off", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
    });
    const header = every.slice(
      every.indexOf("pt-page-frame-header"),
      every.indexOf("</thead>")
    );
    expect(header).toContain('src="https://example.com/head.png"');
    expect(every.match(/data-ceres-height="letterhead"/g)).toHaveLength(1);

    const first = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: true } };
    });
    expect(first).not.toContain("pt-page-frame-header");
    expect(first.indexOf('src="https://example.com/head.png"')).toBeLessThan(
      first.indexOf("pt-page-frame")
    );
  });

  // Refrens' "Hide footer" only drops the "electronically generated" line its PDF service adds.
  it("hideFooter: the letterhead footer is still drawn", () => {
    const html = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = { pdfOptions: { hideFooter: true } };
    });
    expect(html).toContain("https://example.com/foot.png");
    expect(html).not.toContain("is-footer-hidden");
  });

  // User (2026-10-31): a table too wide for the paper scales the whole document, as refrens.com
  // does, never the table alone (no compact padding, no table-only text shrink).
  it("fits a wide table by scaling the whole document in print", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    const print = css.slice(css.indexOf("@media print {"));
    expect(print).toMatch(
      /\.pt-doc \{[^}]*zoom: var\(--pt-doc-fit, 1\);\s*width: calc\(100% \/ var\(--pt-doc-fit, 1\)\);/
    );
    expect(css).not.toMatch(/is-print-compact|--pt-table-fit/);
    expect(render()).not.toMatch(/is-print-compact|--pt-table-fit/);
    const print4 = mapPrint(state()) as Record<string, unknown>;
    expect(print4.compactTable).toBeUndefined();
    expect(print4.tableFit).toBeUndefined();
  });

  // The business's toggle alone stretches the printed table; the document's own is ignored
  // (user, 2026-10-31).
  it.each([
    [true, undefined, true],
    [true, true, true],
    [true, false, true],
    [false, true, false],
    [undefined, true, false],
    [undefined, undefined, false],
  ])(
    "stretches in print with the business toggle %s and the document toggle %s: %s",
    (business, document, stretched) => {
      const edit = (invoice: Json) => {
        invoice.owner.configuration.experimental = {
          stretchInvoiceTable: business,
        };
        invoice.template = { pdfOptions: { fullHeightTable: document } };
      };
      expect(mapPrint(state(edit)).stretchTable).toBe(stretched);
      expect(tagWith(render(edit), 'data-testid="invoice-root"')).toMatch(
        stretched ? /class="pt-doc is-stretch/ : /class="pt-doc(?! is-stretch)/
      );
    }
  );

  it("caps the printed page at the width between the margins, at any print size", () => {
    const width = (pdfOptions: Json) =>
      mapPrint(
        state((invoice) => {
          invoice.template = { pdfOptions };
        })
      ).printWidth;
    // A4 is 793.7 px wide; 1 cm is 37.8 px; 4 px kept back for rounding.
    expect(width({ format: "a4" })).toBe(714);
    expect(width({ format: "a4", xMargins: 1 })).toBe(714);
    // Margin 0 is a real setting (edge to edge), not "unset".
    expect(width({ format: "a4", xMargins: 0 })).toBe(789);
    expect(width({ format: "a4", xMargins: 2 })).toBe(638);
    // The print size divides the space between the margins, which keep their size.
    expect(width({ format: "a4", zoomSize: 0.9 })).toBe(793);
    expect(width({ format: "a4", zoomSize: 1.2 })).toBe(594);
  });

  it("merges a wrapped payload's template settings onto the document", () => {
    const merged = withTemplateSettings({
      invoice: { template: { pdfOptions: { footerOnLastPage: true } } },
      template: {
        primaryColor: "#123456",
        pdfOptions: { letterHeadOnFirstPage: true, footerOnLastPage: false },
      },
    }) as Json;
    expect(merged.invoice.template).toEqual({
      primaryColor: "#123456",
      pdfOptions: { letterHeadOnFirstPage: true, footerOnLastPage: true },
    });
    const flat = { invoiceNumber: "1", template: { name: "x" } };
    expect(withTemplateSettings(flat)).toBe(flat);
    const s = normalizeInvoiceTemplateState(
      withTemplateSettings({
        ...payload(),
        template: { pdfOptions: { letterHeadOnFirstPage: true } },
      }) as never
    ) as unknown as Json;
    expect(s.mapped.visibility.letterHeadOnFirstPage).toBe(true);
  });

  it("irnPosition places the compliance box above or below the items; the document QR prints whenever the document has one", () => {
    const withIrn = (edit?: (invoice: Json) => void) =>
      render((invoice) => {
        invoice.irn = {
          Irn: "abc123",
          AckNo: "112233",
          AckDt: "2026-05-27 10:00:00",
        };
        invoice.documentQr = "data:image/png;base64,AAAA";
        edit?.(invoice);
      });
    const above = withIrn();
    expect(above.indexOf('data-section="compliance"')).toBeLessThan(
      above.indexOf('data-section="items"')
    );
    expect(above).toContain(">abc123<");
    expect(above).toContain('src="data:image/png;base64,AAAA"');

    const below = withIrn((invoice) => {
      invoice.irnPosition = "BELOW_LINEITEMS";
    });
    expect(below.indexOf('data-section="compliance"')).toBeGreaterThan(
      below.indexOf('data-section="items"')
    );

    // refrens.com prints the document QR whenever the document carries one, whatever the
    // business's enableQrCode / showQrCode say (real PDFs, 2026-10-23).
    const qrOff = mapCompliance(
      state((invoice) => {
        invoice.documentQr = "data:image/png;base64,AAAA";
        invoice.owner.configuration.enableQrCode = false;
        invoice.owner.configuration.showQrCode = { quotation: false };
      })
    );
    expect(qrOff.qr.document).toBe("data:image/png;base64,AAAA");
  });

  it("Shipped From | Shipped To and Transport Details | E-Invoice cards, in their columns", () => {
    const html = render((invoice) => {
      invoice.shippedFrom = { name: "Warehouse", city: "Kolkata" };
      invoice.shippedTo = {
        name: "Site Office",
        city: "Howrah",
        gstin: "19AAAAA1111A1Z5",
      };
      invoice.transportDetails = { vehicleNumber: "WB01AB1234" };
    });
    const client = html.slice(
      html.indexOf('data-section="parties"'),
      html.indexOf('data-section="dispatch"')
    );
    expect(client).not.toContain("Site Office");
    const dispatch = html.slice(
      html.indexOf('data-section="dispatch"'),
      html.indexOf('data-section="logistics"')
    );
    expect(dispatch).toMatch(/pt-party pt-col-1" data-role="shipped-from"/);
    expect(dispatch).toMatch(/pt-party pt-col-2" data-role="shipped-to"/);
    expect(dispatch).toContain("19AAAAA1111A1Z5");
    // Transport Details is a card of its own in the left column, never in the details.
    const logistics = html.slice(html.indexOf('data-section="logistics"'));
    expect(logistics).toMatch(/pt-transport pt-col-1[\s\S]*?WB01AB1234/);
    const onlyTo = render((invoice) => {
      invoice.shippedTo = { name: "Site Office", city: "Howrah" };
    });
    expect(onlyTo).toMatch(/pt-col-2" data-role="shipped-to"/);
    expect(onlyTo).not.toContain('data-role="shipped-from"');
    const noParties = render((invoice) => {
      invoice.transportDetails = { vehicleNumber: "WB01AB1234" };
    });
    expect(noParties).not.toContain('data-section="dispatch"');
    expect(noParties).not.toMatch(/pt-meta-label">Vehicle Number/);
    expect(noParties).toMatch(/pt-transport-vehicleNumber[\s\S]*?WB01AB1234/);
  });

  it("bank on the left beside the totals; terms, notes, additional info and attachments across the page, the summaries last", () => {
    const html = render((invoice) => {
      invoice.notes = "Thank you";
      invoice.attachments = ["https://example.com/drawing.pdf"];
      invoice.customFields = [{ label: "Site", value: "Block 1" }];
    });
    const main = html.slice(
      html.indexOf('class="pt-bottom-main"'),
      html.indexOf('class="pt-bottom-side"')
    );
    expect(main).toContain('data-section="bank"');
    // User request (2026-10-27): every summary table at the end, after terms, notes,
    // additional info and attachments; only the enquiry line follows them.
    const order = [
      "bank",
      "terms",
      "notes",
      "additional",
      "attachments",
      "hsn",
      "tax-summary",
      "enquiry",
    ].map((section) => html.indexOf(`data-section="${section}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf('data-section="hsn"')).toBeGreaterThan(
      html.indexOf('class="pt-after"')
    );
    expect(html.indexOf('data-section="totals"')).toBeGreaterThan(
      html.indexOf('class="pt-bottom-side"')
    );
    expect(html).toContain(">drawing.pdf<");
    expect(html).toMatch(/ai-label">Site<[\s\S]*?Block 1/);

    const hiddenNotes = view((invoice) => {
      invoice.notes = "Thank you";
      invoice.showNotes = false;
    });
    expect(hiddenNotes.notes).toBeNull();
  });

  it("bank transfer and UPI follow the payment options; the UPI QR stays 120 px", () => {
    expect(
      render((invoice) => {
        invoice.paymentOptions.accountTransfer = false;
      })
    ).not.toContain('data-section="bank"');
    const upi = render((invoice) => {
      invoice.paymentOptions.upi = true;
      invoice.upi = { upi: "apex@upi" };
      invoice.template = { upiShrink: true };
    });
    expect(upi).toContain("apex@upi");
    // Every QR is 120 px (user request, 2026-10-24): upiShrink no longer makes the UPI QR small.
    expect(upi).toContain('class="pt-upi"');
    expect(upi).not.toContain("is-small");
  });

  it("party field visibility switches hide email and phone", () => {
    const html = render((invoice) => {
      invoice.billedTo.emailShowInInvoice = false;
    });
    expect(html).not.toContain("client@example.com");
  });

  it("shows the status tag as refrens.com does for each document type", () => {
    // A quotation reads "Created"; an unpaid invoice has no tag; a paid one "Paid".
    expect(render()).toContain('<span class="invoice-tag info">Created</span>');
    const unpaid = render((invoice) => {
      invoice.billType = "INVOICE";
      invoice.status = "UNPAID";
    });
    expect(unpaid).not.toContain("pt-status");
    const paid = render((invoice) => {
      invoice.billType = "INVOICE";
      invoice.status = "PAID";
    });
    expect(paid).toContain('<span class="invoice-tag success">Paid</span>');
    const part = render((invoice) => {
      invoice.billType = "INVOICE";
      invoice.status = "PARTIAL";
    });
    expect(part).toContain("Part Paid");
    // A purchase order sent to its vendor reads "Purchase Order Sent" (as refrens.com shows it);
    // one never sent stays "Created".
    const order = (vendorReminder?: Json) =>
      render((invoice) => {
        invoice.billType = "PURCHASEORDER";
        invoice.status = "UNPAID";
        invoice.vendorReminder = vendorReminder;
      });
    expect(order({ recipients: [{ email: "vendor@example.com" }] })).toContain(
      '<span class="invoice-tag info">Purchase Order Sent</span>'
    );
    expect(order({ recipients: [] })).toContain(
      '<span class="invoice-tag info">Created</span>'
    );
  });

  it("Change Script: right-to-left and the Language/Script font", () => {
    // Default: left to right, no extra font.
    expect(mapScript(state())).toEqual({
      dir: "ltr",
      lang: "en-IN", // the document's locale
      script: "",
      font: "",
      fontUrl: "",
    });
    expect(render()).toContain('dir="ltr"');

    // "Enable right-to-left script" with Latin ext: RTL, Inter covers the glyphs.
    const latin = state((invoice) => {
      invoice.template = { languageScript: "Latin ext", enableRtl: true };
    });
    expect(mapScript(latin)).toMatchObject({
      dir: "rtl",
      script: "latinext",
      font: "",
    });
    const html = template(latin);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('data-ceres-script="latinext"');
    expect(html).not.toContain("fonts.googleapis.com/css2?family=Noto");

    // A non-Latin script loads its Noto face; Arabic reads right to left on its own.
    const arabic = state((invoice) => {
      invoice.template = { script: "Arabic" };
    });
    expect(mapScript(arabic)).toMatchObject({
      dir: "rtl",
      font: "Noto Sans Arabic",
    });
    const arabicHtml = template(arabic);
    expect(arabicHtml).toContain("--pt-script-font: 'Noto Sans Arabic'");
    // Handlebars escapes "=" in the attribute; the browser reads it back as the URL.
    expect(arabicHtml).toContain(
      'href="https://fonts.googleapis.com/css2?family&#x3D;Noto+Sans+Arabic:wght@400;500;600;700&amp;display&#x3D;swap"'
    );
    // The switch turned off wins over the script's own direction.
    expect(
      mapScript(
        state((invoice) => {
          invoice.template = { script: "Arabic", enableRtl: false };
        })
      ).dir
    ).toBe("ltr");
    expect(
      mapScript(
        state((invoice) => {
          invoice.template = {
            languageScript: "Devanagari",
            languageCode: "hi",
          };
        })
      )
    ).toMatchObject({ dir: "ltr", lang: "hi", font: "Noto Sans Devanagari" });
  });

  it("theme colour, text scale and the compact print table", () => {
    const html = render((invoice) => {
      invoice.template = {
        primaryColor: "#1a5d1a",
        pdfOptions: { textScale: 1.1 },
      };
    });
    expect(html).toContain("--pt-theme: #1a5d1a");
    expect(html).toContain("--pt-text-scale: 1.1");
    expect(render()).not.toContain("--pt-theme");
  });

  it("signature: image, awaiting and signed digital signatures", () => {
    expect(
      render((invoice) => {
        invoice.signature = "https://example.com/sign.png";
      })
    ).toContain('src="https://example.com/sign.png"');
    expect(
      render((invoice) => {
        invoice.signatureMethod = "DIGITAL";
      })
    ).toContain("Awaiting Digital Signature");
    expect(
      render((invoice) => {
        invoice.signatureMethod = "DIGITAL";
        invoice.documentSignatureRequest = {
          status: "SIGNED",
          signers: [{ signerName: "A. Signer" }],
        };
      })
    ).toContain("Digitally signed by A. Signer");
    // No signature on the document: no signature block at all.
    expect(render()).not.toContain('data-testid="signature"');
    const html = render((invoice) => {
      invoice.signature = "https://example.com/sign.png";
    });
    // No "For <business>" line, as refrens.com prints the signature.
    expect(html).not.toContain("pt-signature-for");
    // In the right-hand column, after the totals.
    const at = html.indexOf('data-testid="signature"');
    expect(at).toBeGreaterThan(html.indexOf('class="pt-bottom-side"'));
    expect(at).toBeGreaterThan(html.indexOf('data-testid="totals-table"'));
  });
});

describe("Professional Template — view model", () => {
  it("prints dates as refrens.com does, May 27, 2026, in the business's offset", () => {
    expect(formatDocumentDate("2026-05-27")).toBe("May 27, 2026");
    expect(formatDocumentDate("2026-05-01")).toBe("May 01, 2026");
    expect(formatDocumentDate("2050-07-09")).toBe("Jul 09, 2050");
    expect(formatDocumentDate("2026-05-26T20:00:00.000Z", "+05:30")).toBe(
      "May 27, 2026"
    );
    expect(formatDocumentDate("not a date")).toBe("not a date");
    expect(formatDocumentDate("")).toBe("");
  });

  it("formats table figures without the symbol, negatives in brackets", () => {
    const ctx = formatContext({
      currency: "INR",
      locale: "en-IN",
      subUnitLength: 2,
    });
    expect(formatFigure(760698, ctx)).toBe("7,60,698.00");
    expect(formatFigure(-50, ctx)).toBe("(50.00)");
    expect(formatFigure("", ctx)).toBe("");
  });

  it("closes with Refrens' enquiry line from the document's contact details", () => {
    const html = render((invoice) => {
      invoice.contact = {
        email: "enquiry@example.com",
        phone: "+919800000000",
      };
    });
    expect(html).toMatch(
      /pt-enquiry[\s\S]*?For any enquiry, reach out via email at <strong class="pt-email">enquiry@example.com<\/strong>, call on/
    );
    expect(
      render((invoice) => {
        delete invoice.contact;
      })
    ).not.toContain("pt-enquiry");
  });

  it("adds Linked Document and Reason to the document details, with no details title", () => {
    const html = render((invoice) => {
      invoice.billType = "CREDITNOTE";
      invoice.invoiceTitle = "Credit Note";
      invoice.documentReason = "Product Return";
      invoice.linkedInvoices = [{ _id: "x", invoiceNumber: "INV-7" }];
    });
    // No "Credit Note Details" title over the rows (user request, 2026-10-21).
    expect(html).not.toContain("pt-meta-title");
    expect(html).not.toContain("Credit Note Details");
    expect(html).toMatch(/pt-meta-label">Linked Document<[\s\S]*?INV-7/);
    expect(html).toMatch(/pt-meta-label">Reason<[\s\S]*?Product Return/);
  });

  it("puts the document QR under the details (refrens.com's placement), one QR only", () => {
    const withQr = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
    });
    expect(withQr).toMatch(
      /data-section="details"[\s\S]*?pt-doc-qr pt-details-qr"[^>]*><img[^>]*src="data:image\//
    );
    // Another placement puts it beside the logo.
    const beside = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
      invoice.owner.configuration.experimental = {
        qrCodePlacement: "BESIDE_LOGO",
      };
    });
    expect(beside).toMatch(/pt-brand[\s\S]*?pt-logo[\s\S]*?pt-doc-qr"/);
    expect(beside).not.toContain("pt-details-qr");
    const active = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
      invoice.qrCode = "irn-qr-payload";
      invoice.irn = { Irn: "abc", qrCode: "irn-qr-payload" };
    });
    expect(active).toContain("pt-doc-qr pt-details-qr is-empty");
  });

  it("sizes the table from the Figma's 934 px table with a 32 px serial column", () => {
    const s = state();
    const table = mapItemTable(s, formatContext(s.invoice));
    expect(table.serialWidth).toBe(32);
    expect(
      table.header.find((cell: Json) => cell.key === "rate")?.width
    ).toBeGreaterThanOrEqual(80);
  });

  it("assembles a sparse document without failing", () => {
    const sparse = buildProfessionalView(
      normalizeInvoiceTemplateState({
        invoice: { billType: "INVOICE" },
      } as never)
    );
    expect(sparse.parties).toEqual([]);
    expect(sparse.terms).toEqual([]);
    expect(sparse.enquiry).toBeNull();
    expect(
      template(
        normalizeInvoiceTemplateState({
          invoice: { billType: "INVOICE" },
        } as never)
      )
    ).toContain("pt-doc");
  });
});

describe("Professional Template — files and CSS", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("holds only the files the template rule allows", () => {
    expect(fs.readdirSync(TEMPLATE_DIR).sort()).toEqual([
      "helpers.ts",
      "index.ts",
      "samples.json",
      "styles.css",
      "template.hbs",
      "version.json",
    ]);
  });

  it("keeps the fixture's document values out of the source", () => {
    const code = ["template.hbs", "helpers.ts", "styles.css"]
      .map((file) => fs.readFileSync(path.join(TEMPLATE_DIR, file), "utf8"))
      .join("\n");
    [
      "SAMPLE CLIENT",
      "Sample Bank",
      "Drawing No",
      "RXQ42RY16",
      "OUTDOOR",
      "Equipment Cost",
      "19ABCDE",
    ].forEach((sample) => expect(code).not.toContain(sample));
  });

  it("prints every text at 13 px but the title (24), the grand total (20), the coloured headings (16 above the items, 14 under them), the summary titles (12) and item codes (11), as on screen", () => {
    const steps = (block: string) =>
      Object.fromEntries(
        Array.from(block.matchAll(/--pt-font-size-(\w+): (\d+)px;/g), (m) => [
          m[1],
          Number(m[2]),
        ])
      );
    expect(steps(source.slice(0, source.indexOf("@media")))).toEqual({
      code: 11,
      xs: 13,
      sm: 13,
      s: 13,
      base: 13,
      m: 13,
      l: 13,
      lg: 13,
      xl: 24,
      heading: 16,
      subheading: 14,
      grand: 20,
      name: 14,
      caption: 12,
    });
    // Print keeps every size, headings too (user, 2026-10-21: print 1:1).
    expect(steps(source.slice(source.indexOf("@media print")))).toEqual({});
    // Crowded tables keep 13 px figures on screen (user, 2026-10-23: all text 13 px).
    expect(source).not.toMatch(/has-small-numbers td\.is-num \{/);
    const all = Array.from(
      source.matchAll(/(?:font-size|--pt-font-size-\w+):\s*(\d+(?:\.\d+)?)px/g),
      (m) => Number(m[1])
    );
    expect(all.length).toBeGreaterThanOrEqual(6);
    all.forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
  });

  it("keeps every spacing value on the 4 px grid; table cells 6px 8px", () => {
    const values = Array.from(
      source.matchAll(
        /(?:^|\s)(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?:\s*([^;]+);/g
      ),
      (m) => m[1]
    ).flatMap((value) =>
      Array.from(value.matchAll(/(-?\d+(?:\.\d+)?)px/g), (m) => Number(m[1]))
    );
    expect(values.length).toBeGreaterThan(40);
    // The Figma's own off-grid steps: 6 px cell padding, and 18 px (6 + 18 = the 24 px between
    // the totals rows and the grand total); a 1 px rule overlap is a join, not spacing.
    values
      // ...and 10 px, refrens.com's own gap between paired cards (user, 2026-10-23).
      .filter(
        (value) =>
          ![6, 10, 18].includes(Math.abs(value)) && Math.abs(value) !== 1
      )
      .forEach((value) => expect(Math.abs(value) % 4).toBe(0));
    expect(source).toMatch(
      /\.pt-items th,\n\.pt-items td \{\s*padding: 6px 8px;/
    );
    expect(source).toMatch(
      /\.pt-widget-table \.ceres-table th,\n\.pt-widget-table \.ceres-table td \{\s*padding: 6px 8px;/
    );
    expect(source).toMatch(/\.pt-card \{[^}]*padding: 12px;/);
    expect(source).toMatch(/\.pt-cards > \.pt-card \{[^}]*padding: 16px;/);
    expect(source).toMatch(
      /\.pt-item-desc \.toastui-editor-contents :is\(th, td\),\n[^{]*\{\s*padding: 6px 8px;/
    );
  });

  it("scales text by the document's text scale and never changes the business's case", () => {
    // Only the summary tables' titles go to capitals (user's pick, 2026-10-24).
    expect(source.match(/text-transform: [a-z]+/g)).toEqual([
      "text-transform: uppercase",
    ]);
    expect(source).not.toMatch(/@page\s*\{/);
    // The one zoom: the whole document's print fit for a too-wide table (2026-10-31).
    expect(source.match(/zoom:[^;]+;/g)).toEqual([
      "zoom: var(--pt-doc-fit, 1);",
    ]);
    const sizes = Array.from(
      source.matchAll(/font-size:\s*([^;]+);/g),
      (m) => m[1]
    );
    sizes
      // Relative to the scaled table text (and floored at 10 px), so already scaled.
      .filter((size) => size !== "inherit" && size !== "max(10px, 0.9em)")
      .forEach((size) => expect(size).toContain("var(--pt-text-scale, 1)"));
  });

  it("aligns party fields like Bank Details: label column, value column, 4 px / 20 px", () => {
    expect(source).toMatch(
      /\.pt-fields \{\s*display: grid;\s*grid-template-columns: fit-content\(50%\) minmax\(0, 1fr\);\s*gap: 4px 20px;/
    );
    expect(source).toMatch(/\n\.pt-field \{\s*display: contents;/);
    expect(source).toMatch(/\.pt-kv \{[^}]*gap: 4px 20px;/);
  });

  it("lists attachments without an indent; a long name never widens its column", () => {
    expect(source).toMatch(
      /\.pt-attachments \{\s*contain: inline-size;\s*padding: 0;\s*list-style: none;/
    );
    // The totals move under the cards rather than run past the page edge.
    expect(source).toMatch(
      /\.pt-bottom \{\s*display: flex;\s*flex-wrap: wrap;/
    );
  });

  it("draws no box around the summaries", () => {
    expect(source).toMatch(
      /\.pt-card:is\(\s*\.pt-widget-table,[^)]*\) \{\s*padding: 0;\s*border: 0;\s*border-radius: 0;/
    );
  });

  it("mirrors for right-to-left: logical sides only", () => {
    expect(source).not.toMatch(/(?:padding|margin|border)-(?:left|right)\s*:/);
    // Only the right-to-left overrides of the widgets' own alignment name a side.
    const withoutRtl = source.replace(
      /\.pt-doc\[dir="rtl"\][^{]*\{[^}]*\}/g,
      ""
    );
    expect(withoutRtl).not.toMatch(/text-align: (?:left|right)/);
    expect(source).toMatch(/var\(--pt-script-font, "Inter"\)/);
  });

  it("uses the design's colour tokens (text colours as refrens.com, 2026-10-24)", () => {
    [
      "#7d3bdf",
      "--pt-ink: #1d1d1d;",
      "--pt-muted: rgb(0 0 0 / 50%);",
      "--pt-code: #666670;",
      "#e8eaed",
      "#fbfcfd",
      "#f7f9fa",
    ].forEach((token) => expect(source).toContain(token));
  });
});

describe("Professional Template — the platform's other settings, under every alias", () => {
  it("reads description full width, item name full width and group subtotal aliases", () => {
    const aliased = view((invoice) => {
      invoice.advanceOptions.showDescriptionInFullWidth = true;
      invoice.advanceOptions.isDescriptionFullWidth = false;
      invoice.advanceOptions.showGroupSubTotal = false;
    });
    expect(aliased.descriptionFullWidth).toBe(true);
    const settings = resolveSettings(
      state((invoice) => {
        invoice.showItemNameFullWidth = true;
        invoice.advanceOptions.hideGroupSubTotal = true;
      })
    );
    expect(settings.itemNameFullWidth).toBe(true);
    expect(settings.groupSubtotal).toBe(false);
  });

  it("showSummarisedTotalQuantity switches the in-table Total row", () => {
    expect(
      view((invoice) => {
        invoice.showTotalsRow = false;
        invoice.advanceOptions.showSummarisedTotalQuantity = true;
      }).table.footer.show
    ).toBe(true);
    expect(
      view((invoice) => {
        invoice.advanceOptions.showSummarizedTotalQuantity = false;
      }).table.footer.show
    ).toBe(false);
  });

  it("prints item serial numbers under the name unless switched off", () => {
    const withSerials = (invoice: Json) => {
      invoice.items[1].serialNumbers = ["SN-001", { serialNumber: "SN-002" }];
    };
    const row = (v: ReturnType<typeof view>) =>
      v.table.rows.find(
        (entry: Json) => entry.name === fixture.invoice.items[1].name
      ) as Json;
    expect(row(view(withSerials)).inlineCodes).toContain(
      "Serial No.: SN-001, SN-002"
    );
    expect(
      row(
        view((invoice) => {
          withSerials(invoice);
          invoice.advanceOptions.showSerialNumbersInDescription = false;
        })
      ).inlineCodes.join(" ")
    ).not.toContain("SN-001");
  });

  it("hideBalanceDue / showDueAmount false drop the Balance Due row, not the paid rows", () => {
    const paid = (invoice: Json) => {
      invoice.balance = { ...(invoice.balance || {}), paid: 1000, due: 5000 };
    };
    const keys = (v: ReturnType<typeof view>) =>
      v.totals.due.map((entry: Json) => entry.key);
    expect(keys(view(paid))).toContain("dueAmount");
    const hidden = view((invoice) => {
      paid(invoice);
      invoice.advanceOptions.hideBalanceDue = true;
    });
    expect(keys(hidden)).not.toContain("dueAmount");
    expect(keys(hidden).length).toBeGreaterThan(0);
    expect(
      keys(
        view((invoice) => {
          paid(invoice);
          invoice.invoiceValueProps = { dueAmount: { visible: false } };
        })
      )
    ).not.toContain("dueAmount");
  });

  it("showTerms false / hideTerms hide Terms and Conditions", () => {
    const off = view((invoice) => {
      invoice.advanceOptions.hideTerms = true;
    });
    expect(off.terms).toEqual([]);
    expect(view().terms.length).toBeGreaterThan(0);
  });

  it("a header field switched off in invoiceValueProps stays off", () => {
    const keys = (v: ReturnType<typeof view>) =>
      v.meta.map((row: Json) => row.key);
    const dated = (invoice: Json) => {
      invoice.dueDate = "2026-06-30";
    };
    expect(keys(view(dated))).toContain("dueDate");
    expect(
      keys(
        view((invoice) => {
          dated(invoice);
          invoice.invoiceValueProps = { DueDate: false };
        })
      )
    ).not.toContain("dueDate");
  });

  it("renders the stock summary from the document's batchSummary, hidden while switched off", () => {
    const batches = (invoice: Json) => {
      invoice.batchSummary = [
        {
          itemName: "Indoor unit",
          batch: { batchName: "B-12", expiryDate: "2027-03-31" },
          warehouseName: "Main",
          quantity: 4,
        },
      ];
    };
    const html = render(batches);
    expect(tagWith(html, "data-ceres-batch-summary")).not.toContain(
      "display: none"
    );
    // Refrens calls it "Batch Summary" (it has no Stock Summary).
    expect(html).toContain("Batch Summary");
    expect(html).toContain("B-12");
    expect(html).toContain("Mar 31, 2027");
    // A column no batch fills (Mfg Date) is left out.
    expect(html).not.toContain("Mfg Date");

    const off = render((invoice) => {
      batches(invoice);
      invoice.advanceOptions.showStockSummary = false;
    });
    expect(tagWith(off, "data-ceres-batch-summary")).toContain("display: none");
    expect(render()).not.toContain("data-ceres-batch-summary");
  });

  it("uses the item batches only when the stock summary is switched on, with the business's columns", () => {
    const itemBatches = (invoice: Json) => {
      invoice.items[1].batchSummary = [{ batchName: "LOT-7", quantity: 1 }];
      invoice.defaultBatchColumns = [
        { key: "batchName", label: "Lot" },
        { key: "quantity", label: "Qty" },
        { key: "expiryDate", label: "Expiry", isHidden: true },
      ];
    };
    expect(mapStockSummary(state(itemBatches), formatContext({}))).toBeNull();
    const stock = mapStockSummary(
      state((invoice) => {
        itemBatches(invoice);
        invoice.advanceOptions.showStockSummary = true;
      }),
      formatContext({})
    ) as Json;
    expect(stock.columns.map((column: Json) => column.label)).toEqual([
      "Lot",
      "Qty",
    ]);
    expect(stock.rows[0].map((cell: Json) => cell.value)).toEqual([
      "LOT-7",
      "1",
    ]);
  });

  it("Pageless PDF prints the letterhead and footer once", () => {
    const pageless = view((invoice) => {
      invoice.template = {
        ...(invoice.template || {}),
        pdfOptions: { longPdf: true },
      };
    });
    expect(pageless.pageless).toBe(true);
    expect(pageless.letterheadEveryPage).toBe(false);
    expect(pageless.footerEveryPage).toBe(false);
  });

  it("puts dark text on a light theme colour and follows the host's live colour first", () => {
    expect(onThemeColor("#ffd400")).toBe("#22272f");
    expect(onThemeColor("#1f4e79")).toBe("#ffffff");
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toContain(
      "--pt-accent: var(--primary-color, var(--pt-theme, #7d3bdf))"
    );
  });
});

describe("Professional Template — e-way bill with the IRN", () => {
  it("lists the e-way bill under the IRN details, not under Transport Details", () => {
    const v = view((invoice) => {
      invoice.irn = {
        ...(invoice.irn || {}),
        Irn: "abc123",
        AckNo: "1826",
        EwbNo: "801598508277",
        EwbDt: "2026-09-08 10:00:00",
      };
      invoice.transportDetails = { vehicleNumber: "KA01AB1234" };
    });
    const complianceKeys = v.compliance.rows.map((row: Json) => row.key);
    expect(complianceKeys).toEqual(["ackNo", "ewayBillNumber", "ewayBillDate"]);
    const transportKeys = [
      ...(v.transport ? v.transport.rows : []),
      ...v.meta,
    ].map((row: Json) => row.key);
    expect(transportKeys).toContain("vehicleNumber");
    expect(transportKeys).not.toContain("ewayBillNumber");
  });
});

describe("Professional Template — logo slot", () => {
  it("holds the business logo only: never the business name, and nothing without a logo", () => {
    expect(render()).toContain("pt-logo-image");
    const noLogo = render((invoice) => {
      delete invoice.logo;
      if (invoice.billedBy) delete invoice.billedBy.logo;
    });
    expect(noLogo).not.toContain('class="pt-logo"');
    expect(noLogo).not.toContain("pt-brand-name");
    expect(noLogo).not.toContain('data-role="company-name"');
    // The details still print.
    expect(noLogo).toContain('data-section="details"');
  });
});

describe("Professional Template — PDF service page hooks", () => {
  const tag = (html: string, marker: string) => tagWith(html, marker);
  it("marks every-page letterhead and footer for the PDF service, which draws them itself", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/lh.png";
      invoice.letterHeadFooter = "https://example.com/ft.png";
      invoice.template = {
        pdfOptions: { letterHeadOnFirstPage: false, footerOnLastPage: false },
      };
    });
    const header = tag(every, 'data-ceres-page-policy="all"');
    expect(header).toContain("data-ceres-page-header");
    expect(header).toContain("no-dibella");
    const footer = tag(every, "data-ceres-page-footer");
    expect(footer).toContain('data-ceres-page-policy="all"');
    expect(footer).toContain("no-dibella");
  });

  it("keeps a first-page letterhead and a last-page footer in the document for the PDF service", () => {
    const once = render((invoice) => {
      invoice.letterHead = "https://example.com/lh.png";
      invoice.letterHeadFooter = "https://example.com/ft.png";
      invoice.template = {
        pdfOptions: { letterHeadOnFirstPage: true, footerOnLastPage: true },
      };
    });
    const header = tag(once, 'data-ceres-page-policy="first"');
    expect(header).toContain("data-ceres-page-header");
    expect(header).not.toContain("no-dibella");
    const footer = tag(once, "data-ceres-page-footer");
    expect(footer).toContain('data-ceres-page-policy="last"');
    expect(footer).not.toContain("no-dibella");
  });

  // "Hide footer" turns the PDF service's own footer off, the letterhead footer with it.
  it("draws the every-page footer itself when Hide footer is on", () => {
    const hidden = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/ft.png";
      invoice.template = {
        pdfOptions: { footerOnLastPage: false, hideFooter: true },
      };
    });
    const footer = tag(hidden, "data-ceres-page-footer");
    expect(footer).toContain('data-ceres-page-policy="all"');
    expect(footer).toContain("pt-footer-fixed");
    expect(footer).not.toContain("no-dibella");
    expect(hidden).not.toMatch(/no-dibella[^"]*pt-footer-spacer/);
  });
});

describe("Professional Template — PDF service window", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("lays the document out at the paper's printable width in the PDF service", () => {
    // The service's window is narrower than a landscape page: the fit must see the paper.
    const print = source.slice(source.indexOf("@media print {"));
    expect(print).toMatch(
      /\[class~="isDibella"\] \.pt-doc \{\s*width: calc\(var\(--pt-print-width, 100%\) \/ var\(--pt-doc-fit, 1\)\);\s*max-width: none;/
    );
  });
});

describe("Professional Template — frames hug long values", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("widens the bank card for a long account number or UPI ID instead of overflowing", () => {
    // The rows take their content's width (figures never wrap) and the QR moves under them.
    expect(source).toMatch(/\.pt-bank \{[^}]*flex-flow: row wrap;/);
    expect(source).toMatch(/\.pt-bank-main \{[^}]*min-width: min-content;/);
    expect(source).toMatch(/\.pt-bottom-main \{\s*min-width: min-content;/);
  });
});

describe("Professional Template — party tax numbers only when on the document", () => {
  const ids = (edit: (invoice: Json) => void) => {
    const invoice = state(edit).invoice as Json;
    const party = mapParty(invoice, invoice.billedBy, "");
    return party ? [...party.ids, ...party.extras].map((row) => row.label) : [];
  };
  it("does not print a stored VAT / TRN number on an Indian GST document", () => {
    expect(
      ids((invoice) => {
        invoice.billedBy.vatNumber = "VAT000000000";
        invoice.billedBy.trnNumber = "100000000000003";
      })
    ).not.toEqual(expect.arrayContaining(["VAT Number"]));
  });
  it("prints it where the document carries it, and never when switched off", () => {
    expect(
      ids((invoice) => {
        invoice.taxType = "UAE";
        invoice.billedBy.country = "AE";
        invoice.billedBy.vatNumber = "VAT000000000";
      })
    ).toContain("VAT Number");
    // A party abroad prints its own number on an Indian GST document too (refrens.com)…
    expect(
      ids((invoice) => {
        invoice.billedBy.country = "AE";
        invoice.billedBy.vatNumber = "VAT000000000";
      })
    ).toContain("VAT Number");
    // …and a party in India never does, even switched on.
    expect(
      ids((invoice) => {
        invoice.billedBy.vatNumber = "VAT000000000";
        invoice.billedBy.fieldVisibility = { vat: true };
      })
    ).not.toContain("VAT Number");
    expect(
      ids((invoice) => {
        invoice.taxType = "UAE";
        invoice.billedBy.country = "AE";
        invoice.billedBy.vatNumber = "VAT000000000";
        invoice.billedBy.fieldVisibility = { vatNumber: false };
      })
    ).not.toContain("VAT Number");
  });
});

describe("Professional Template — unbroken field values", () => {
  it("lets an email carry on from its label and break only at the edge; figures never break", () => {
    const html = render((invoice) => {
      invoice.billedTo.email = "sample.client@example.com";
    });
    expect(html).toMatch(
      /pt-field-label">Email<\/span><span class="pt-field-value pt-email pt-break">sample.client@example\.com/
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.pt-field-value\.pt-break:not\(\.pt-num\) \{[^}]*overflow-wrap: anywhere;/
    );
    // A document number, GSTIN, phone, transport or bank figure, or amount is never wrapped.
    [
      "\\.pt-meta-value",
      "\\.pt-party-fields \\.pt-field-value",
      "\\.pt-transport \\.pt-kv-value",
      "\\.pt-bank-rows \\.pt-kv-value",
    ].forEach((box) => {
      expect(css).not.toMatch(
        new RegExp(`${box}\\.pt-num \\{[^}]*white-space: normal;`)
      );
    });
    expect(css).toMatch(/\.pt-num \{\s*white-space: nowrap;/);
    expect(css).toMatch(/\.pt-bottom-side \{[^}]*min-width: min-content;/);
  });
});

describe("Professional Template — editor settings (accordions)", () => {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  const metaKeys = (edit?: (invoice: Json, root: Json) => void) =>
    view(edit).meta.map((row: Json) => row.key);

  it("Change Color & Font: the theme colour and both fonts; the page stays white", () => {
    expect(css).toMatch(/--pt-accent: var\(--primary-color,/);
    // refrens.com's Secondary Color / Primary + Secondary Background are shades of the theme
    // (header fill, 20 % card tint), never the page or the text (orange quotation, 2026-10-24).
    expect(css).toMatch(/--pt-ink: #1d1d1d;/);
    expect(css).toMatch(/--pt-paper: #fff;/);
    expect(css).not.toMatch(
      /var\(--(?:primary-background|secondary-background)/
    );
    // No Secondary Color anywhere: the zebra rows take the cards' light tint (2026-10-24).
    expect(css).not.toMatch(/var\(--secondary-color/);
    expect(css).toMatch(/--pt-zebra: var\(--pt-tint\);/);
    expect(css).toMatch(/--pt-title-font: var\(--title-font,/);
    expect(css).toMatch(/--pt-font: var\(--subtitle-font,/);
    // No white is hard-coded outside the token.
    expect(css.replace(/--pt-(?:paper|on-accent):[^;]*;/g, "")).not.toMatch(
      /#fff\b/
    );
  });

  it("Other Configurations: Hide Totals on the document hides the totals, total row and words", () => {
    const shown = render();
    expect(shown).toMatch(/class="pt-words ceres-subtotal-words"/);
    const hidden = render((invoice) => {
      invoice.hideTotals = true;
    });
    expect(hidden).not.toMatch(/class="pt-words ceres-subtotal-words"/);
    expect(
      resolveSettings(
        state((invoice) => {
          invoice.hideTotals = true;
        })
      ).totalsRow
    ).toBe(false);
  });

  it("Other Configurations: Show Refrens branding", () => {
    expect(render()).not.toContain("refrens-branding-widget");
    expect(
      render((invoice) => {
        invoice.showBranding = true;
      })
    ).toContain("refrens-branding-widget");
  });

  it("document details follow the business's saved order", () => {
    expect(metaKeys()).toEqual([
      "invoiceNumber",
      "invoiceDate",
      "customHeader",
    ]);
    expect(
      metaKeys((invoice) => {
        invoice.documentFieldOrder = ["DWG. NO", { key: "invoiceDate" }];
      })
    ).toEqual(["customHeader", "invoiceDate", "invoiceNumber"]);
    expect(
      metaKeys((invoice) => {
        invoice.template = {
          ...invoice.template,
          documentDetailsOrder: ["invoice_date"],
        };
      })
    ).toEqual(["invoiceDate", "invoiceNumber", "customHeader"]);
  });

  it("Watermark: drawn by the shared widget the template loads", () => {
    const index = fs.readFileSync(path.join(TEMPLATE_DIR, "index.ts"), "utf8");
    expect(index).toContain('import "../../widgets/watermark"');
  });
});

describe("Professional Template — Refrens match (2026-10-19)", () => {
  const unitRow = (unitColumn?: string) =>
    template(
      normalizeInvoiceTemplateState(
        withRefrensDefaults(
          (() => {
            const root = JSON.parse(JSON.stringify(fixture));
            const invoice = root.invoice || root;
            invoice.advanceOptions = { ...invoice.advanceOptions };
            delete invoice.advanceOptions.unitColumn;
            if (unitColumn) invoice.advanceOptions.unitColumn = unitColumn;
            invoice.items.forEach((item: Json) => {
              if (!item.group) item.unit = "PCS";
            });
            return root;
          })()
        )
      )
    );

  it("prints the unit where the unit setting puts it, as refrens.com does", () => {
    // Unset (Refrens' default) and SEPARATE_COLUMN: a Unit column of its own.
    expect(unitRow()).toMatch(/<th[^>]*data-col="unit"/);
    expect(unitRow("SEPARATE_COLUMN")).toMatch(/<th[^>]*data-col="unit"/);
    // Merged into Quantity: "1 (PCS)", no Unit column.
    const merged = unitRow("MERGE_QUANTITY");
    expect(merged).not.toMatch(/<th[^>]*data-col="unit"/);
    expect(merged).toMatch(/\d \(PCS\)/);
    // With the item name: "Unit: PCS" under it, no Unit column.
    const named = unitRow("MERGE_NAME");
    expect(named).not.toMatch(/<th[^>]*data-col="unit"/);
    expect(named).toContain("Unit: PCS");
  });

  it("adds a Notes column to the payments when a payment has notes", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showPaymentsTable = true;
      invoice.allPayments = [
        {
          amount: 1000,
          paymentDate: "2026-06-01",
          paymentMethod: "CASH",
          notes: "Hi sweet",
        },
      ];
    });
    expect(html).toMatch(/<th>Notes<\/th>[\s\S]*?Hi sweet/);
    expect(html).toContain(
      '<h3 class="pt-card-title" data-role="title">Payments</h3>'
    );
  });

  it("spells foreign amounts in their own units, as refrens.com", () => {
    expect(foreignAmountInWords(5400.18, "USD").toUpperCase()).toBe(
      "FIVE THOUSAND FOUR HUNDRED DOLLARS AND EIGHTEEN CENTS ONLY"
    );
    expect(foreignAmountInWords(1800, "SAR").toUpperCase()).toBe(
      "ONE THOUSAND EIGHT HUNDRED RIYALS ONLY"
    );
  });
});

describe("Professional Template — description and note tables in print", () => {
  it("repeats a description or note table's headings on every page, breaking between its rows", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(
      /\.pt-doc :is\(\.pt-item-desc, \.pt-note-body\) \.toastui-editor-contents thead \{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.pt-doc :is\(\.pt-item-desc, \.pt-note-body\) \.toastui-editor-contents tr \{\s*break-inside: avoid;/
    );
  });
});

describe("Professional Template — boxes split by a page break", () => {
  it("draws a split box's border on each page's piece", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(
      source.indexOf("A box split by a page break closes")
    );
    expect(print).toMatch(/\.pt-card \{[^}]*box-decoration-break: clone;/);
  });
});

describe("Professional Template — Refrens match (2026-10-23)", () => {
  it("prints the status tag on paper as refrens.com's PDFs do", () => {
    const tag = (billType: string, status: string) =>
      view((invoice) => {
        invoice.billType = billType;
        invoice.status = status;
      }).status;
    expect(tag("INVOICE", "PARTIAL")).toMatchObject({
      text: "Part Paid",
      inPrint: true,
    });
    expect(tag("QUOTATION", "UNPAID")).toMatchObject({
      text: "Created",
      inPrint: false,
    });
    expect(tag("QUOTATION", "DRAFT")).toMatchObject({
      text: "Draft",
      inPrint: true,
    });
  });

  it("keeps the business's own 'Tax' wording on the column and its totals row", () => {
    const html = render((invoice) => {
      invoice.igst = true;
      invoice.columns = invoice.columns.map((column: Json) =>
        column.key === "igst" ? { ...column, label: "Tax" } : column
      );
    });
    expect(html).not.toMatch(
      /data-ceres-subtotal-row="igst[^"]*"[\s\S]{0,200}?>\s*IGST/
    );
  });

  it("prints table money with its sign, rates and flat discounts as entered", () => {
    const html = render((invoice) => {
      invoice.items[1].rate = 180.5;
      invoice.items[1].discount = { discountType: "FIXED", amount: 50 };
    });
    const body = html.slice(
      html.indexOf("</thead>"),
      html.indexOf("pt-bottom")
    );
    expect(body).toContain("₹180.5<");
    expect(body).toMatch(/₹[\d,]+\.\d\d</);
  });

  it("prints the UPI ID once: under the QR when there is one", () => {
    const html = render((invoice) => {
      invoice.paymentOptions = { ...invoice.paymentOptions, upi: true };
      invoice.upi = { vpa: "shop@okbank" };
    });
    const bank = html.slice(html.indexOf('data-section="bank"'));
    const ids =
      bank.slice(0, bank.indexOf("</section>")).match(/shop@okbank/g) || [];
    // The QR's alt text names it too; the printed text has it once.
    expect(ids.length).toBeLessThanOrEqual(2);
    expect(bank).not.toMatch(
      /pt-bank-upi">UPI<\/span>[\s\S]*?shop@okbank[\s\S]*?pt-upi-id/
    );
  });

  it("titles the compliance card by what it holds", () => {
    const einvoice = view((invoice) => {
      invoice.irn = {
        Irn: "abc123",
        AckNo: "1122",
        AckDt: "2026-05-27 10:00:00",
      };
    });
    expect(einvoice.compliance.title).toBe("E-Invoice Details");
    const eway = view((invoice) => {
      invoice.irn = { EwbNo: "6811", EwbDt: "2026-05-27 10:00:00" };
    });
    expect(["Eway Bill Details", ""]).toContain(eway.compliance.title);
  });

  it("wraps a worded transport entry; a code or figure keeps to one line", () => {
    const rows = view((invoice) => {
      invoice.transportDetails = {
        challanNumber: "flyadeal warehouse SAUDI ARABIAN AIRLINES NO 160-11",
        vehicleNumber: "WB01AB1234",
      };
    }).transport?.rows as Json[];
    expect(rows.find((row) => row.key === "challanNumber")?.isNum).toBe(false);
    expect(rows.find((row) => row.key === "vehicleNumber")?.isNum).toBe(true);
  });
});

describe("Professional Template — failed images", () => {
  it("prints nothing for an image that fails to load: no broken mark, no alt text", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.pt-doc img\.is-broken,[^{]*\{\s*display: none;/);
    const helpers = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    expect(helpers).toMatch(
      /addEventListener\(\s*"error",[\s\S]*?classList\.add\("is-broken"\)[\s\S]*?true\s*\)/
    );
  });
});

describe("Professional Template — tax and discount rows as refrens.com prints them", () => {
  it("follows the document's own tax view: one CGST / SGST row, no rates added", () => {
    const rows = view().totals.rows.map((row: Json) => row.label);
    expect(rows).toContain("CGST");
    expect(rows.some((label: string) => /^CGST \(/.test(label))).toBe(false);
  });

  it("labels the discount row without a rate", () => {
    const rows = view().totals.rows as Json[];
    const discount = rows.find((row) => row.key === "discount");
    expect(discount?.label).not.toMatch(/%\)/);
  });
});

describe("Professional Template — item table look (refrens.com Professional)", () => {
  // refrens.com: the first row white, the second in the document's Secondary Color, and so on
  // (user request, 2026-10-24: "read the api how it works").
  it("tints every other row, the second one first, in the document's Secondary Color", () => {
    const { rows } = view().table;
    rows.forEach((row: Json, index: number) =>
      expect(row.isStripe).toBe(index % 2 === 1)
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /tr\.is-stripe > td \{\s*background: var\(--pt-zebra\);/
    );
    expect(css).toMatch(/--pt-zebra: var\(--pt-tint\);/);
  });

  it("gives group rows their turn in the zebra, with no grey of their own (user, 2026-10-24)", () => {
    const { rows } = view().table;
    const group = rows.findIndex((row: Json) => row.isGroupHeader);
    expect(group).toBeGreaterThanOrEqual(0);
    expect(rows[group].isStripe).toBe(group % 2 === 1);
    expect(rows[group + 1].isStripe).toBe(!rows[group].isStripe);
    const html = render();
    expect(html).toMatch(
      /<tr class="pt-group-row(?: is-stripe)?" data-testid="group-row">/
    );
    const striped = rows.findIndex(
      (row: Json) => row.isGroupHeader && row.isStripe
    );
    if (striped >= 0) {
      expect(html).toMatch(
        /<tr class="pt-group-row is-stripe" data-testid="group-row">/
      );
    }
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).not.toMatch(/\.pt-group-row(?: > td)? \{[^}]*background/);
  });

  it("rounds the table's corners and tints the Total row", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.pt-items-scroll \{[^}]*border-radius: 8px;/);
    expect(css).toMatch(
      /\.pt-total-row > td \{\s*background: var\(--pt-zebra\);/
    );
  });
});

describe("Professional Template — review round 2 (2026-10-23)", () => {
  const css = () =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("draws the e-invoice QR from irn.SignedQRCode and drops the document QR", () => {
    const signed = "eyJhbGciOiJSUzI1NiJ9.".padEnd(948, "x");
    const compliance = mapCompliance(
      state((invoice) => {
        invoice.documentQr = "doc-qr-payload";
        invoice.irn = { Irn: "abc", SignedQRCode: signed, Status: "ACT" };
      })
    );
    expect(compliance.qr.irn).toMatch(/^data:image\/svg\+xml/);
    expect(compliance.qr.document).toBe("");
    // Every QR is 120 px, the e-invoice's too (user request, 2026-10-24).
    expect(css()).toMatch(/\.pt-qr img \{[^}]*width: 120px;\s*height: 120px;/);
    expect(css()).toMatch(/\.pt-upi-qr \{[^}]*width: 120px;\s*height: 120px;/);
    expect(css()).not.toMatch(/150px/);
  });

  it("names the Place of Supply from its GST code, as refrens.com", () => {
    const html = render((invoice) => {
      invoice.placeOfSupply = "29";
      invoice.billedTo = {
        ...invoice.billedTo,
        state: "Gujarat",
        country: "IN",
      };
    });
    expect(html).toMatch(/pt-supply-value">Karnataka \(29\)</);
  });

  it("rules the summary tables both ways and rounds their corners", () => {
    expect(css()).toMatch(
      /\.pt-widget-table \.ceres-table td \{[^}]*border-inline-end: 1px solid var\(--pt-line\);\s*border-bottom: 1px solid var\(--pt-line\);/
    );
    expect(css()).toMatch(
      /\.pt-widget-table \.ceres-table-section \{[^}]*overflow: clip;\s*border-radius: 8px;/
    );
    // No grey outline beside the purple header: the wrappers draw no border.
    expect(css()).not.toMatch(/\.ceres-table-section \{[^}]*border: 1px/);
    expect(css()).not.toMatch(
      /\.pt-items-scroll \{\s*max-width: 100%;[^}]*border: 1px/
    );
  });

  it("tints every info card like Billed By / To and puts the subtitle under the title", () => {
    expect(css()).toMatch(
      /\.pt-cards > \.pt-card,\n\.pt-card\.pt-bank \{\s*background: var\(--pt-tint\);/
    );
    const html = render((invoice) => {
      invoice.invoiceSubTitle = "Supply of VRV System";
    });
    const row = html.slice(
      html.indexOf('class="pt-title-row"'),
      html.indexOf("</div>", html.indexOf('class="pt-title-row"'))
    );
    expect(row).not.toContain("pt-subtitle");
    expect(row).not.toContain("pt-copy");
    expect(html).toMatch(
      /<\/div>\s*\{?[^<]*<p class="pt-subtitle">Supply of VRV System<\/p>/
    );
    expect(css()).toMatch(/\.pt-bottom-side \{[^}]*padding-block: 12px;/);
  });
});

describe("Professional Template — enquiry line", () => {
  it("is centred", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.pt-enquiry \{[^}]*text-align: center;/);
  });
});

describe("Professional Template — supply row in print", () => {
  it("keeps the supply row with the item table across a page break", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.pt-supply \{\s*break-after: avoid-page;/);
    expect(css).toMatch(
      /\.pt-supply \+ \.pt-items-section \{\s*break-before: avoid-page;/
    );
  });
});

describe("Professional Template — HSN and Tax Summary columns", () => {
  it("spreads their columns equally", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\[data-section="hsn"\], \[data-section="tax-summary"\]\) \.ceres-table\.is-even \{\s*width: 100%;\s*table-layout: fixed;/
    );
  });
});

describe("Professional Template — review round 6 (2026-10-24)", () => {
  const css = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  const hbs = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "template.hbs"), "utf8");

  it("rounds every page's piece of the item table in print", () => {
    // A repeated, empty footer draws the bottom corners; the headings' end cells the top ones.
    expect(hbs()).toMatch(
      /<tfoot class="pt-items-corners" aria-hidden="true">/
    );
    expect(css()).toMatch(/\.pt-items-corners \{\s*display: none;/);
    expect(css()).toMatch(
      /\.pt-items > \.pt-items-corners \{\s*display: table-footer-group;/
    );
    expect(css()).toMatch(
      /\.pt-items thead th:first-child \{\s*border-start-start-radius: 8px;/
    );
    // The items' last row stays square where the split-off totals follow.
    expect(css()).toMatch(
      /\.pt-items:not\(:has\(\+ \[data-pt-totals-split\]\)\) > tbody:last-of-type/
    );
    expect(css()).toMatch(/\.pt-items td\.is-joint-left::after \{/);
    expect(css()).not.toMatch(/\.pt-items[^{]*> tbody:last-child/);
  });

  it("starts the e-invoice QR level with the first detail", () => {
    expect(css()).toMatch(
      /\.pt-cards > \.pt-compliance \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/
    );
    expect(css()).toMatch(
      /\.pt-compliance > \.pt-compliance-text > \.pt-card-title \{\s*grid-column: 1 \/ -1;/
    );
  });

  it("sets the coloured headings under the item table at 14 px", () => {
    expect(css()).toMatch(/--pt-font-size-subheading: 14px;/);
    expect(css()).toMatch(
      /\.pt-bottom \.pt-card-title,\s*\.pt-bottom \.pt-upi-caption,[^{]*\{\s*font-size: calc\(var\(--pt-font-size-subheading\)/
    );
  });

  it("spaces the totals with gaps, not padding", () => {
    expect(css()).toMatch(
      /\.pt-totals-table \.pt-totals \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto;\s*gap: 12px 20px;/
    );
    expect(css()).toMatch(
      /\.pt-totals-table \.pt-totals th,\s*\.pt-totals-table \.pt-totals td \{\s*padding: 0;/
    );
    expect(css()).not.toMatch(
      /\.ceres-subtotal-label \{[^}]*padding-inline-end/
    );
  });

  it("sizes the logo as refrens.com: within 240 × 120, square corners", () => {
    expect(css()).toMatch(
      /\.pt-doc \.pt-logo \.pt-logo-image \{[^}]*max-width: 240px;[^}]*max-height: 120px;[^}]*border-radius: 0;/
    );
    expect(css()).toMatch(
      /@container pt-doc \(width < 420px\) \{[^@]*\.pt-doc \.pt-logo \.pt-logo-image \{\s*max-width: 180px;/
    );
  });

  it("spaces the grand total by gaps alone: no padding, no margin", () => {
    expect(css()).toMatch(
      /\.pt-totals-table \.pt-totals > \.pt-grand-row \{\s*row-gap: 12px;\s*\}/
    );
    expect(css()).toMatch(
      /\.pt-grand-row::after \{\s*grid-column: 1 \/ -1;\s*border-top: 1px solid var\(--pt-ink\);/
    );
    expect(css()).not.toMatch(/\.pt-grand-row \{[^}]*(?:padding|margin)/);
  });

  it("keeps the enquiry line and group headings with what they belong to in print", () => {
    expect(css()).toMatch(
      /\.pt-doc \.pt-enquiry \{\s*break-before: avoid-page;/
    );
    expect(css()).toMatch(
      /\.pt-items \.pt-group-row \+ tr \{\s*break-before: avoid;/
    );
  });

  it("never wraps a value with a digit; print wraps cells as the screen does", () => {
    expect(css()).not.toMatch(/is-print-compact/);
    expect(
      fs.readFileSync(path.join(TEMPLATE_DIR, "helpers.ts"), "utf8")
    ).toMatch(/\/\\d\/\.test\(value\)\s*\?\s*" has-digits"/);
  });

  it("puts the totals straight after the items on a phone", () => {
    expect(css()).toMatch(
      /@container pt-doc \(width < 600px\) \{\s*\.pt-bottom-side \{\s*display: contents;[^}]*\}\s*\.pt-bottom-side > \.pt-totals-table \{\s*order: -1;/
    );
  });
});

describe("Professional Template — review round 5 (2026-10-24)", () => {
  const css = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("spaces the details rows 8 px and the sections 16 px", () => {
    expect(css()).toMatch(/\.pt-meta \{[^}]*gap: 8px 16px;/);
    expect(css()).toMatch(/--pt-section-gap: 16px;/);
    expect(css()).toMatch(
      /\.pt-bottom-main \{[^}]*gap: var\(--pt-section-gap\);/
    );
    expect(css()).not.toMatch(/\.pt-shipping \+ \.pt-logistics/);
  });

  it("prints the amount in words on one line at the head of the left column", () => {
    const html = render();
    const words = html.indexOf("data-ceres-total-in-words");
    expect(words).toBeGreaterThan(html.indexOf('class="pt-bottom-main"'));
    expect(words).toBeLessThan(html.indexOf('data-section="bank"'));
    expect(words).toBeLessThan(html.indexOf('class="pt-bottom-side"'));
    expect(html).toMatch(
      /<span class="pt-words-label">Total \(in words\) :<\/span>\s*<span class="pt-words-value">[A-Z ]+<\/span>/
    );
  });

  // Weights and colours as refrens.com prints this layout (user request, 2026-10-24).
  it("prints the details bold with 50 % black labels, and the fields with bold labels", () => {
    expect(css()).toMatch(
      /\.pt-meta-label \{[^}]*color: var\(--pt-muted\);[^}]*font-weight: 600;/
    );
    expect(css()).toMatch(
      /\.pt-meta-value \{[^}]*color: var\(--pt-ink\);[^}]*font-weight: 600;/
    );
    ["field", "kv"].forEach((kind) => {
      expect(css()).toMatch(
        new RegExp(
          `\\.pt-${kind}-label \\{[^}]*color: var\\(--pt-ink\\);[^}]*font-weight: 600;`
        )
      );
      expect(css()).toMatch(
        new RegExp(
          `\\.pt-${kind}-value \\{[^}]*color: var\\(--pt-ink\\);[^}]*font-weight: 400;`
        )
      );
    });
  });

  it("weighs the title, names, totals, words and headings as refrens.com", () => {
    const rule = (selector: string) =>
      css().match(new RegExp(`${selector} \\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule("\\.pt-title")).toMatch(/font-weight: 400;/);
    expect(rule("\\.pt-party-name")).toMatch(/font-weight: 600;/);
    expect(rule("\\.pt-party-address")).toMatch(/font-weight: 400;/);
    expect(rule("\\.pt-item-name")).toMatch(/font-weight: 500;/);
    expect(rule("\\.pt-item-codes")).toMatch(/color: var\(--pt-code\);/);
    expect(rule("\\.pt-items thead th")).toMatch(/font-weight: 500;/);
    expect(rule("\\.pt-widget-table \\.ceres-table thead th")).toMatch(
      /font-weight: 500;/
    );
    expect(rule("\\.pt-doc \\.pt-words")).toMatch(/font-weight: 600;/);
    expect(rule("\\.pt-upi-id")).toMatch(/font-weight: 400;/);
    expect(
      rule("\\.pt-totals-table \\.pt-totals \\.ceres-subtotal-value")
    ).toMatch(/font-weight: 400;/);
    expect(
      rule(
        "\\.pt-totals-table \\.pt-totals \\.pt-grand-row > \\.ceres-subtotal-label"
      )
    ).toMatch(/font-weight: 400;/);
    // Every card heading 16 px medium: Terms, Notes, Additional Information and Attachments
    // take the shared heading rule (user request, 2026-10-24).
    expect(css()).not.toMatch(
      /\[data-section="[a-z]+"\]\) > \.pt-card-title \{/
    );
    expect(css()).not.toMatch(
      /\[data-section="additional"\] > \.pt-card-title \{/
    );
    expect(css()).toMatch(/\.pt-card-title \{[^}]*font-weight: 500;/);
    expect(css()).toMatch(
      /\.pt-upi-caption \{[^}]*font-size: calc\(var\(--pt-font-size-heading\)[^}]*font-weight: 500;/
    );
    expect(css()).toMatch(
      /\.pt-card\.pt-widget-table > \.pt-card-title \{\s*color: var\(--pt-caption\);[^}]*font-weight: 500;[^}]*text-transform: uppercase;/
    );
    // No weight above 600 (user request, 2026-10-24).
    expect(css()).not.toMatch(/font-weight: (?:700|800|900|bold)/);
    expect(css()).toMatch(
      /\.pt-doc :is\(strong, b\),\n\.pt-doc \.toastui-editor-contents :is\(strong, b\) \{\s*font-weight: 600;/
    );
  });

  it("draws no border and no rounded corners on item images", () => {
    expect(css()).toMatch(
      /\.pt-doc \.pt-items :is\(\.pt-thumbnail, \.ceres-image, \.pt-large-image\) \{\s*border: 0;\s*border-radius: 0;/
    );
  });

  it("sets each card's content 8 px under its heading", () => {
    expect(css()).toMatch(
      /\.pt-cards > \.pt-card \{\s*gap: 8px;\s*padding: 16px;/
    );
  });

  it("sets the party name, address and fields 6 px apart", () => {
    expect(css()).toMatch(/\.pt-party-body \{[^}]*gap: 6px;/);
    expect(css()).toMatch(/\.pt-fields \{[^}]*gap: 4px 20px;/);
  });

  it("sets the coloured section headings in 16 px; the summaries' titles a 12 px grey caption", () => {
    expect(css()).toMatch(
      /\.pt-card-title \{[^}]*font-size: calc\(var\(--pt-font-size-heading\)[^}]*line-height: 24px;/
    );
    expect(css()).toMatch(
      /\.pt-card\.pt-widget-table > \.pt-card-title \{[^}]*font-size: calc\(var\(--pt-font-size-caption\)[^}]*letter-spacing: 0\.6px;/
    );
    expect(css()).toMatch(
      /--pt-caption: color-mix\(in srgb, var\(--pt-ink\) 60%, var\(--pt-paper\)\);/
    );
  });

  it("sets the UPI note in 11 px", () => {
    expect(css()).toMatch(
      /\.pt-upi-note \{[^}]*font-size: calc\(var\(--pt-font-size-code\)/
    );
    expect(css()).toMatch(/--pt-font-size-code: 11px;/);
  });

  it("colours the UPI caption like the Bank Details heading", () => {
    expect(css()).toMatch(/\.pt-upi-caption \{[^}]*color: var\(--pt-accent\);/);
  });

  it("tints Bank Details like Billed By / To", () => {
    expect(css()).toMatch(
      /\.pt-card\.pt-bank \{\s*background: var\(--pt-tint\);/
    );
  });

  it("prints terms, notes, additional info and attachments without a box", () => {
    const rule = css().match(
      /\.pt-card:is\(\s*\.pt-widget-table,([^)]*)\) \{([^}]*)\}/
    );
    expect(rule).not.toBeNull();
    ["terms", "notes", "additional", "attachments"].forEach((section) =>
      expect(rule?.[1]).toContain(`[data-section="${section}"]`)
    );
    expect(rule?.[2]).toMatch(/padding: 0;/);
    expect(rule?.[2]).toMatch(/border: 0;/);
    expect(rule?.[2]).toMatch(/border-radius: 0;/);
    expect(rule?.[2]).toMatch(/background: none;/);
  });
});
