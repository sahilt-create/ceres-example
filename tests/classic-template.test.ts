import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/classic-template.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/classic-template/template.hbs";
import {
  buildClassicView,
  formatContext,
  formatDocumentDate,
  formatFigure,
  foreignAmountInWords,
  isInvisibleSymbol,
  withMoneyDefaults,
  withRefrensDefaults,
  mapCompliance,
  mapParty,
  mapItemTable,
  mapScript,
  mapPrint,
  printScaleFor,
  withTemplateSettings,
  mapStockSummary,
  onThemeColor,
  registerClassicHelpers,
  resolveSettings,
} from "../src/templates/classic-template/helpers";
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

const TEMPLATE_DIR = path.join(__dirname, "../src/templates/classic-template");

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
  buildClassicView(state(edit));

/* The opening tag of the first element carrying an attribute or class. */
const tagWith = (html: string, marker: string): string => {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const start = html.lastIndexOf("<", at);
  return html.slice(start, html.indexOf(">", at) + 1);
};

beforeAll(() => {
  registerClassicHelpers(HandlebarsRuntime);
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

describe("Classic Template — render", () => {
  it("maps the reference document from the payload", () => {
    const html = render();
    // Header: title, subtitle, the details, the business logo top right.
    expect(html).not.toContain("cl-mark");
    expect(html).toContain('src="apex-sample-logo.png"');
    expect(html).toContain(
      '<h1 class="cl-title" data-role="title">Equipment Quotation</h1>'
    );
    expect(html).toContain(
      '<p class="cl-subtitle">Supply of VRV System, Equipment, accessories &amp; allied materials.</p>'
    );
    // Document details: business labels, refrens.com's date format, custom headers.
    expect(html).toMatch(
      /cl-detail-label">Drawing No<[\s\S]*?QT-R2\/A5\/880\/SR\/46\/26-27/
    );
    expect(html).toMatch(/cl-detail-label">Date<[\s\S]*?May 27, 2026/);
    expect(html).toMatch(/cl-detail-label">DWG\. NO<[\s\S]*?>R1</);
    // Billed By | Billed To cards (Figma): heading, name, address on one line, fields.
    const parties = html.slice(
      html.indexOf('data-section="parties"'),
      html.indexOf("</section>", html.indexOf('data-section="parties"'))
    );
    expect(parties.indexOf('data-role="billed-by"')).toBeLessThan(
      parties.indexOf('data-role="billed-to"')
    );
    expect(parties).toContain('<h2 class="cl-band-caption">Client Name</h2>');
    expect(parties).toContain("SAMPLE CLIENT PVT LTD");
    expect(parties).toContain(
      "Sample House, 1/1 Sample Street, Kolkata, West Bengal, India - 700001"
    );
    expect(parties).toMatch(
      /cl-field-label">GSTIN<\/span><span class="cl-field-value cl-num cl-break">19AAAAA0000A1Z5/
    );
    expect(parties).toMatch(
      /cl-field-label">Email<\/span><span class="cl-field-value cl-email cl-break">client@example.com/
    );
    // The seller's card carries its own GSTIN.
    expect(parties).toMatch(/GSTIN<\/span><span[^>]*>19ABCDE1234F1Z5/);
    // Totals in the right-hand column; the grand total between its rules.
    const side = html.slice(html.indexOf('class="cl-bottom-side"'));
    ["Sub Total", "Discount", "CGST", "SGST"].forEach((label) =>
      expect(side).toMatch(
        new RegExp(`ceres-subtotal-label"[^>]*>\\s*${label}`)
      )
    );
    expect(side).toMatch(
      /cl-grand-row[\s\S]*?Equipment Cost[\s\S]*?₹10,21,694\.98/
    );
    expect(side).toContain("₹77,925.89");
    // The words head the left column (user request, 2026-10-24).
    expect(html).toContain("Ten Lakh Twenty One Thousand");
    // Terms keep every line (no Payment Terms card here), numbered; bank rows.
    expect(html).toContain(
      "<li>Price validity: 10 days from the date of submission.</li>"
    );
    expect(html).toContain(
      "<li>90% Advance along with order and before delivery of materials</li>"
    );
    expect(html).not.toContain("cl-pay-card");
    expect(html).toMatch(
      /cl-kv-label cl-bank-bankName">Bank<[\s\S]*?Sample Bank/
    );
    expect(html).toMatch(/cl-kv-label cl-bank-ifsc">IFSC<[\s\S]*?SMPL0000123/);
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
    // "Sr.No" over the serial numbers (user, 2026-11-25).
    expect(labels).toEqual([
      "Sr.No",
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
      .slice(items.indexOf("</thead>"), items.indexOf('class="cl-totals'))
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

  // User (2026-11-05): Refrens' PDF service prints the "electronically generated" line itself;
  // a template's own copy printed it twice. The template never prints it.
  it("never prints its own electronically generated line", () => {
    const note = (edit: (invoice: Json) => void) =>
      render((invoice) => {
        // eslint-disable-next-line no-param-reassign
        invoice.signatureMethod = "NONE";
        // eslint-disable-next-line no-param-reassign
        invoice.signature = null;
        // eslint-disable-next-line no-param-reassign
        invoice.template = {
          ...((invoice.template as Json) || {}),
          pdfOptions: { footerOnLastPage: true, letterHeadOnFirstPage: true },
        };
        edit(invoice);
      }).includes("cl-signature-note");
    expect(note(() => undefined)).toBe(false);
    expect(
      note((invoice) => {
        // eslint-disable-next-line no-param-reassign
        invoice.signatureMethod = "SIMPLE";
        // eslint-disable-next-line no-param-reassign
        invoice.signature = "https://x.test/s.png";
      })
    ).toBe(false);
    expect(
      note((invoice) => {
        // eslint-disable-next-line no-param-reassign
        (invoice.template as Json).pdfOptions = { footerOnLastPage: false };
      })
    ).toBe(false);
  });

  // User (2026-11-03): a group's images print as an item's do, thumbnails under its name.
  it("prints a group's images under its name and its original images in a row below", () => {
    const html = render((invoice) => {
      // eslint-disable-next-line no-param-reassign
      invoice.items = [
        {
          name: "Pumps",
          group: true,
          images: ["https://x.test/g.png"],
          originalImages: ["https://x.test/big.png"],
        },
        { name: "Pump A", quantity: 1, rate: 10, amount: 10, total: 10 },
      ];
    });
    expect(html).toMatch(
      /cl-group-name">Pumps<\/span>[\s\S]*?ceres-image-gallery-thumbnail[\s\S]*?g\.png/
    );
    expect(html).toMatch(
      /cl-group-image-row[\s\S]*?class="cl-large-image"[^>]*big\.png/
    );
  });

  it("prints group names as entered and numbers their items 1., 2.… from 1 again, as refrens.com", () => {
    const html = render();
    const groups = Array.from(
      html.matchAll(/class="cl-group-name">([^<]+)</g),
      (m) => m[1]
    );
    expect(groups).toEqual(["OUTDOOR UNITS", "INDOOR UNITS", "REFNET JOINT"]);
    const serials = Array.from(
      html.matchAll(
        /<tr class="cl-item-row[\s\S]*?data-testid="num">(\d+\.)</g
      ),
      (m) => m[1]
    );
    // "1.", as Refrens' native Classic numbers them (invoice 0029, 2026-11-25).
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

describe("Classic Template — boolean settings", () => {
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
    expect(noTaxes).not.toContain("cl-cost-note");
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
    expect(html).toMatch(/cl-name-row[\s\S]*?<span class="cl-item-name">42 HP/);
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
    expect(thumbs).toContain("cl-item-thumbnail");
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
    expect(html).toContain('<span class="cl-item-code">SKU: SKU-1</span>');
    expect(html).toContain('<span class="cl-item-code">HSN/SAC: 8415</span>');
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
    expect(every).toContain("cl-footer-fixed");
    expect(every).toContain("cl-footer-spacer");

    const last = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = { pdfOptions: { footerOnLastPage: true } };
    });
    expect(last).not.toContain("cl-footer-fixed");
    // The frame's footer holds only the browser print's margin row then.
    expect(last).not.toContain("cl-footer-spacer");
  });

  it("letterHeadOnFirstPage: the letterhead repeats in the print frame's header unless off", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
    });
    const header = every.slice(
      every.indexOf("cl-page-frame-header"),
      every.indexOf("</thead>")
    );
    expect(header).toContain('src="https://example.com/head.png"');
    expect(every.match(/data-ceres-height="letterhead"/g)).toHaveLength(1);

    const first = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: true } };
    });
    // The frame's header holds only the browser print's margin row then.
    expect(
      first.slice(
        first.indexOf("cl-page-frame-header"),
        first.indexOf("</thead>")
      )
    ).not.toContain("cl-letterhead");
    expect(first.indexOf('src="https://example.com/head.png"')).toBeLessThan(
      first.indexOf("cl-page-frame")
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

  // User (2026-11-01): text scale is the same everywhere. Nothing shrinks to fit the paper, the
  // table included; a table too wide for the page is cut off at its edge (landscape gives room).
  it("never shrinks the document or the table to fit the paper", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    const print = css.slice(css.indexOf("@media print {"));
    expect(print).toMatch(
      /\.cl-doc \{[^}]*zoom: var\(--cl-print-scale, 1\);\s*width: calc\(100% \/ var\(--cl-print-scale, 1\)\);/
    );
    expect(print).toMatch(
      /\.cl-items-scroll,\s*\.cl-widget-table \{\s*overflow: clip;/
    );
    // The one zoom is the 75 % print base, the whole document at once (2026-11-02).
    expect(css.match(/zoom:[^;]+;/g)).toEqual([
      "zoom: var(--cl-print-scale, 1);",
    ]);
    expect(css).not.toMatch(/--cl-doc-fit|is-print-compact|--cl-table-fit/);
    expect(render()).not.toMatch(
      /--cl-doc-fit|is-print-compact|--cl-table-fit/
    );
  });

  // The printed table always stretches, whatever either toggle says (user, 2026-11-04).
  it.each([
    [true, undefined, true],
    [true, true, true],
    [true, false, true],
    [false, true, true],
    [undefined, true, true],
    [undefined, undefined, true],
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
        stretched ? /class="cl-doc is-stretch/ : /class="cl-doc(?! is-stretch)/
      );
    }
  );

  it("caps the printed page at the width between the margins, at any print size", () => {
    // At Normal text scale (1); unset is Smaller (0.8), whose zoom widens the page in CSS px.
    const width = (pdfOptions: Json) =>
      mapPrint(
        state((invoice) => {
          invoice.template = {
            pdfOptions: { zoomSize: 1, ...(pdfOptions as object) },
          };
        })
      ).printWidth;
    // A4 is 793.7 px wide; Refrens' margins are 30 px a step (Narrow 0.5 when unset); 4 px
    // kept back for rounding.
    expect(width({ format: "a4" })).toBe(759);
    expect(width({ format: "a4", xMargins: 1 })).toBe(729);
    // Margin 0 is a real setting (edge to edge), not "unset".
    expect(width({ format: "a4", xMargins: 0 })).toBe(789);
    expect(width({ format: "a4", xMargins: 2 })).toBe(669);
    // The print size divides the space between the margins, which keep their size.
    expect(width({ format: "a4", zoomSize: 0.9 })).toBe(844);
    expect(width({ format: "a4", zoomSize: 1.2 })).toBe(632);
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
      html.indexOf('data-section="logistics"')
    );
    expect(client).not.toContain("Site Office");
    // The band's last row: Shipped From, Shipped To, Transport Details, in that order.
    const logistics = html.slice(
      html.indexOf('data-section="logistics"'),
      html.indexOf("</header>")
    );
    expect(logistics).toMatch(
      /data-role="shipped-from"[\s\S]*?data-role="shipped-to"[\s\S]*?19AAAAA1111A1Z5[\s\S]*?cl-transport[\s\S]*?WB01AB1234/
    );
    const onlyTo = render((invoice) => {
      invoice.shippedTo = { name: "Site Office", city: "Howrah" };
    });
    expect(onlyTo).toContain('data-role="shipped-to"');
    expect(onlyTo).not.toContain('data-role="shipped-from"');
    const noParties = render((invoice) => {
      invoice.transportDetails = { vehicleNumber: "WB01AB1234" };
    });
    expect(noParties).not.toContain('data-role="shipped-to"');
    expect(noParties).not.toMatch(/cl-detail-label">Vehicle Number/);
    expect(noParties).toMatch(/cl-transport-vehicleNumber[\s\S]*?WB01AB1234/);
  });

  it("terms, notes, bank and attachments beside the totals; the summaries, then additional info last", () => {
    const html = render((invoice) => {
      invoice.notes = "Thank you";
      invoice.attachments = ["https://example.com/drawing.pdf"];
      invoice.customFields = [{ label: "Site", value: "Block 1" }];
    });
    const main = html.slice(
      html.indexOf('class="cl-bottom-main"'),
      html.indexOf('class="cl-bottom-side"')
    );
    // User (2026-11-26, native Classic): Terms, Notes, then Bank | UPI, then Attachments.
    expect(main.indexOf('data-section="bank"')).toBeGreaterThan(
      main.indexOf('data-section="notes"')
    );
    expect(main.indexOf('data-section="bank"')).toBeLessThan(
      main.indexOf('data-section="attachments"')
    );
    // User request (2026-10-27): every summary table at the end, after terms, notes,
    // additional info and attachments; only the enquiry line follows them.
    // Native Classic: terms and notes beside the totals, then Bank | UPI, then Attachments
    // and Additional Information across the page, then the summaries.
    // User (2026-11-26): all of them in the one column beside the totals.
    expect(main).toContain('data-section="attachments"');
    // User (2026-11-26): Additional Information last, after the summaries (native Classic).
    expect(main).not.toContain('data-section="additional"');
    const order = [
      "terms",
      "notes",
      "bank",
      "attachments",
      "hsn",
      "tax-summary",
      "additional",
      "enquiry",
    ].map((section) => html.indexOf(`data-section="${section}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf('data-section="hsn"')).toBeGreaterThan(
      html.indexOf('class="cl-after"')
    );
    expect(html.indexOf('data-section="totals"')).toBeGreaterThan(
      html.indexOf('class="cl-bottom-side"')
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
    expect(upi).toContain('class="cl-upi"');
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
    expect(unpaid).not.toContain("cl-status");
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
      font: "'Noto Sans Arabic'",
    });
    const arabicHtml = template(arabic);
    expect(arabicHtml).toContain("--cl-script-font: 'Noto Sans Arabic'");
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
    ).toMatchObject({ dir: "ltr", lang: "hi", font: "'Noto Sans Devanagari'" });
  });

  it("theme colour, text scale and the compact print table", () => {
    const html = render((invoice) => {
      invoice.template = {
        primaryColor: "#1a5d1a",
        pdfOptions: { textScale: 1.1 },
      };
    });
    expect(html).toContain("--cl-theme: #1a5d1a");
    expect(html).toContain("--cl-text-scale: 1.1");
    expect(render()).not.toContain("--cl-theme");
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
    // Native Classic: under the signature the business's signature label as typed, nothing
    // when it is blank or unset.
    expect(html).not.toContain("cl-signature-for");
    const labelled = render((invoice) => {
      invoice.signature = "https://example.com/sign.png";
      invoice.customLabels = {
        ...(invoice.customLabels as object),
        signature: "[ A. NAME - PARTNER ]",
      };
    });
    expect(labelled).toMatch(/cl-signature-for">\[ A\. NAME - PARTNER \]</);
    // In the right-hand column, after the totals.
    const at = html.indexOf('data-testid="signature"');
    expect(at).toBeGreaterThan(html.indexOf('class="cl-bottom-side"'));
    expect(at).toBeGreaterThan(html.indexOf('data-testid="totals-table"'));
  });
});

describe("Classic Template — native Classic placement (2026-11-25)", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("logo only from the document; transport and supply labels end in a colon", () => {
    const html = render((invoice) => {
      invoice.logo = "";
      (invoice.billedBy as Record<string, unknown>).logo =
        "https://x.test/profile.png";
      invoice.transportDetails = { transportMode: "Rail" };
    });
    expect(html).not.toContain("profile.png");
    expect(html).toContain("has-no-logo");
    expect(html).toMatch(/cl-transport-transportMode">Transport Mode:</);
    expect(html).toMatch(/cl-detail-label">Country of Supply:</);
  });

  it("an item's original images sit in its own cell, 186 px wide", () => {
    const html = render((invoice) => {
      (invoice.items as Record<string, unknown>[])[1].originalImages = [
        "https://x.test/orig.png",
      ];
    });
    expect(html).toMatch(
      /cl-item-originals"><img class="cl-large-image"[^>]*orig\.png/
    );
    expect(html).not.toMatch(
      /<tr class="cl-image-row(?! cl-group)[^"]*"[\s\S]*?orig\.png/
    );
    expect(source).toMatch(
      /\.cl-item-originals > \.cl-large-image \{\s*width: 186px;\s*max-width: 100%;/
    );
  });

  it("keeps 24 px between the letterhead / footer and the content in every view", () => {
    expect(source).toMatch(/--cl-letterhead-gap: 24px;/);
    expect(source).toMatch(
      /\.cl-doc \.cl-letterhead:not\(\.is-empty\) \{\s*padding-bottom: var\(--cl-letterhead-gap\);/
    );
    expect(source).toMatch(
      /\.cl-doc \.cl-letterhead-footer:not\(\.is-empty\) \{\s*padding-top: var\(--cl-letterhead-gap\);/
    );
    expect(source).toMatch(
      /tr\.cl-stamp-room\.is-top > td \{\s*height: calc\(var\(--cl-stamp-top, 0px\) \+ var\(--cl-letterhead-gap\)\);/
    );
  });

  it("party fields keep the value beside its name (never wrapped under it)", () => {
    expect(source).toMatch(
      /\.cl-party:not\(\.cl-doc-details, \.cl-transport\) > \.cl-fields > \.cl-field \{\s*display: flex;/
    );
    expect(source).toMatch(
      /> \.cl-field > \.cl-field-value \{\s*flex: 1 1 0;\s*min-width: 0;/
    );
  });

  it("draws currency symbols Open Sans lacks (₹ ₱ ₩ …) in Noto Sans, not a heavy system face", () => {
    expect(source).toMatch(
      /@import "https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans:/
    );
    expect(source).toMatch(
      /--cl-font: [^;]*var\(--cl-symbol-fonts\), sans-serif;/
    );
    expect(source).toMatch(
      /--cl-title-font: [^;]*var\(--cl-symbol-fonts\), sans-serif;/
    );
    expect(source).toMatch(/text-rendering: optimizelegibility;/);
  });

  it("a totals row with nothing visible takes no room", () => {
    expect(source).toMatch(
      /\.cl-totals-table \.cl-totals > tr\.is-blank-row \{\s*display: none;/
    );
    const rows = view().totals.rows as { label: string; value: string }[];
    expect(rows.every((row) => `${row.label}${row.value}`.trim() !== "")).toBe(
      true
    );
  });

  it("each detail is a row of its own: a long value wraps beside its name, never under it", () => {
    expect(source).toMatch(
      /\.cl-doc-details \.cl-fields \.cl-field \{\s*display: flex;\s*flex-wrap: nowrap;/
    );
    expect(source).toMatch(
      /\.cl-doc-details \.cl-detail-value \{\s*flex: 1 1 0;\s*min-width: 0;\s*text-align: end;/
    );
  });
});

describe("Classic Template — view model", () => {
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
      /cl-enquiry[\s\S]*?For any enquiry, reach out via email at <strong class="cl-email">enquiry@example.com<\/strong>, call on/
    );
    expect(
      render((invoice) => {
        delete invoice.contact;
      })
    ).not.toContain("cl-enquiry");
  });

  it("adds Linked Document and Reason to the document details, under their title", () => {
    const html = render((invoice) => {
      invoice.billType = "CREDITNOTE";
      invoice.invoiceTitle = "Credit Note";
      invoice.documentReason = "Product Return";
      invoice.linkedInvoices = [{ _id: "x", invoiceNumber: "INV-7" }];
    });
    // No "Credit Note Details" heading over the rows (user, 2026-11-25).
    expect(html).not.toContain("Credit Note Details");
    expect(html).toMatch(/cl-detail-label">Linked Document<[\s\S]*?INV-7/);
    expect(html).toMatch(/cl-detail-label">Reason<[\s\S]*?Product Return/);
  });

  it("puts the QRs at the end of the details, IRN and e-way bill among them, one QR only", () => {
    const withQr = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
    });
    expect(withQr).toMatch(
      /data-section="details"[\s\S]*?cl-doc-qr"[^>]*><img[^>]*src="data:image\//
    );
    // Whatever the business's placement: the QR stays with the details (user, 2026-11-12).
    const beside = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
      invoice.owner.configuration.experimental = {
        qrCodePlacement: "BESIDE_LOGO",
      };
    });
    expect(beside).toMatch(
      /data-section="details"[\s\S]*?cl-details-qrs[\s\S]*?cl-doc-qr"/
    );
    expect(beside).not.toMatch(
      /cl-band-parties[^]*?cl-doc-qr[^]*?data-section="details"/
    );
    const active = render((invoice) => {
      invoice.documentQr = "doc-qr-payload";
      invoice.qrCode = "irn-qr-payload";
      invoice.irn = { Irn: "abc", qrCode: "irn-qr-payload" };
    });
    expect(active).toContain("cl-doc-qr is-empty");
    // The IRN and the e-way bill are cells of the details; no E-Invoice card in the band.
    const eway = render((invoice) => {
      invoice.irn = {
        Irn: "abc123",
        EwbNo: "602218603039",
        EwbDt: "2026-11-12 10:00:00",
      };
    });
    expect(eway).toMatch(
      /data-section="details"[\s\S]*?cl-irn-row[\s\S]*?abc123[\s\S]*?Eway Bill[\s\S]*?602218603039[\s\S]*?Eway Date/
    );
    expect(eway).not.toMatch(
      /cl-band-logistics[\s\S]*?data-section="compliance"[\s\S]*?<\/header>/
    );
  });

  it("sizes the table from the Figma's 934 px table with a 48 px serial column for Sr.No", () => {
    const s = state();
    const table = mapItemTable(s, formatContext(s.invoice));
    expect(table.serialWidth).toBe(48);
    expect(
      table.header.find((cell: Json) => cell.key === "rate")?.width
    ).toBeGreaterThanOrEqual(80);
  });

  it("assembles a sparse document without failing", () => {
    const sparse = buildClassicView(
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
    ).toContain("cl-doc");
  });
});

describe("Classic Template — files and CSS", () => {
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

  it("numbers attachments without an indent; a long name never widens its column", () => {
    expect(source).toMatch(
      /\.cl-attachments \{\s*contain: inline-size;\s*padding: 0;\s*list-style: decimal inside;/
    );
    // The totals move under the cards rather than run past the page edge.
    expect(source).toMatch(
      /\.cl-bottom \{\s*display: flex;\s*flex-wrap: wrap;/
    );
  });

  it("draws no box around the summaries", () => {
    expect(source).toMatch(
      /\.cl-card:is\(\s*\.cl-widget-table,[^)]*\) \{\s*padding: 0;\s*border: 0;\s*border-radius: 0;/
    );
  });

  it("mirrors for right-to-left: logical sides only", () => {
    expect(source).not.toMatch(/(?:padding|margin|border)-(?:left|right)\s*:/);
    // Only the right-to-left overrides of the widgets' own alignment name a side.
    const withoutRtl = source.replace(
      /\.cl-doc\[dir="rtl"\][^{]*\{[^}]*\}/g,
      ""
    );
    expect(withoutRtl).not.toMatch(/text-align: (?:left|right)/);
    expect(source).toMatch(/var\(--cl-script-font, "Open Sans"\)/);
  });

  it("uses the colours measured on Refrens' native Classic (2026-11-25)", () => {
    [
      "#16a9e0",
      "--cl-ink: #161c26;",
      "--cl-caption: #000;", // darker than native, user 2026-11-25
      "--cl-label: #000;",
      "--cl-rule: #000;",
      "--cl-head-tint: color-mix(in srgb, var(--cl-accent) 11%, var(--cl-paper));",
      "--cl-line: #000;",
    ].forEach((token) => expect(source).toContain(token));
  });
});

describe("Classic Template — the platform's other settings, under every alias", () => {
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
      "--cl-accent: var(--primary-color, var(--cl-theme, #16a9e0))"
    );
  });
});

describe("Classic Template — e-way bill with the IRN", () => {
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

describe("Classic Template — logo slot", () => {
  it("holds the business logo only: never the business name, and nothing without a logo", () => {
    expect(render()).toContain("cl-logo-image");
    const noLogo = render((invoice) => {
      delete invoice.logo;
      if (invoice.billedBy) delete invoice.billedBy.logo;
    });
    expect(noLogo).not.toContain('class="cl-logo"');
    expect(noLogo).not.toContain("cl-brand-name");
    expect(noLogo).not.toContain('data-role="company-name"');
    // The details still print.
    expect(noLogo).toContain('data-section="details"');
  });
});

describe("Classic Template — PDF service page hooks", () => {
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
    expect(footer).toContain("cl-footer-fixed");
    expect(footer).not.toContain("no-dibella");
    expect(hidden).not.toMatch(/no-dibella[^"]*cl-footer-spacer/);
  });
});

describe("Classic Template — PDF service window", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("lays the document out at the paper's printable width in the PDF service", () => {
    // The service's window is narrower than a landscape page: the layout must see the paper.
    const print = source.slice(source.indexOf("@media print {"));
    expect(print).toMatch(
      /\[class~="isDibella"\] \.cl-doc \{\s*width: calc\(var\(--cl-print-width, 100%\) \/ var\(--cl-print-scale, 1\)\);\s*max-width: none;/
    );
  });
});

describe("Classic Template — frames hug long values", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("widens the bank card for a long account number or UPI ID instead of overflowing", () => {
    // The rows take their content's width (figures never wrap) and the QR moves under them.
    expect(source).toMatch(/\.cl-bank \{[^}]*flex-flow: row wrap;/);
    expect(source).toMatch(/\.cl-bank-main \{[^}]*min-width: min-content;/);
    expect(source).toMatch(/\.cl-bottom-main \{\s*min-width: min-content;/);
  });
});

describe("Classic Template — party tax numbers only when on the document", () => {
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

describe("Classic Template — unbroken field values", () => {
  it("lets an email carry on from its label and break only at the edge; figures never break", () => {
    const html = render((invoice) => {
      invoice.billedTo.email = "sample.client@example.com";
    });
    expect(html).toMatch(
      /cl-field-label">Email<\/span><span class="cl-field-value cl-email cl-break">sample.client@example\.com/
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.cl-field-value\.cl-break:not\(\.cl-num\) \{[^}]*overflow-wrap: anywhere;/
    );
    // A document number, GSTIN, phone, transport or bank figure, or amount is never wrapped.
    [
      "\\.cl-detail-value",
      "\\.cl-party-fields \\.cl-field-value",
      "\\.cl-transport \\.cl-kv-value",
      "\\.cl-bank-rows \\.cl-kv-value",
    ].forEach((box) => {
      expect(css).not.toMatch(
        new RegExp(`${box}\\.cl-num \\{[^}]*white-space: normal;`)
      );
    });
    expect(css).toMatch(/\.cl-num \{\s*white-space: nowrap;/);
    expect(css).toMatch(/\.cl-bottom-side \{[^}]*min-width: min-content;/);
  });
});

describe("Classic Template — editor settings (accordions)", () => {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  const metaKeys = (edit?: (invoice: Json, root: Json) => void) =>
    view(edit).meta.map((row: Json) => row.key);

  it("Change Color & Font: the theme colour and both fonts; the page stays white", () => {
    expect(css).toMatch(/--cl-accent: var\(--primary-color,/);
    // refrens.com's Secondary Color / Primary + Secondary Background are shades of the theme
    // (header fill, 20 % card tint), never the page or the text (orange quotation, 2026-10-24).
    expect(css).toMatch(/--cl-ink: #161c26;/);
    expect(css).toMatch(/--cl-paper: #fff;/);
    expect(css).not.toMatch(
      /var\(--(?:primary-background|secondary-background)/
    );
    // No Secondary Color anywhere: the zebra rows take the cards' light tint (2026-10-24).
    expect(css).not.toMatch(/var\(--secondary-color/);
    expect(css).toMatch(/--cl-zebra: var\(--cl-paper\);/);
    expect(css).toMatch(/--cl-title-font: var\(--title-font,/);
    expect(css).toMatch(/--cl-font: var\(--subtitle-font,/);
    // No white is hard-coded outside the token.
    expect(css.replace(/--cl-(?:paper|on-accent):[^;]*;/g, "")).not.toMatch(
      /#fff\b/
    );
  });

  it("Other Configurations: Hide Totals on the document hides the totals, total row and words", () => {
    const shown = render();
    expect(shown).toMatch(/class="cl-words ceres-subtotal-words"/);
    const hidden = render((invoice) => {
      invoice.hideTotals = true;
    });
    expect(hidden).not.toMatch(/class="cl-words ceres-subtotal-words"/);
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

describe("Classic Template — Refrens match (2026-10-19)", () => {
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
      '<h3 class="cl-card-title" data-role="title">Payments</h3>'
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

describe("Classic Template — description and note tables in print", () => {
  it("repeats a description or note table's headings on every page, breaking between its rows", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(
      /\.cl-doc :is\(\.cl-item-desc, \.cl-note-body\) \.toastui-editor-contents thead \{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.cl-doc :is\(\.cl-item-desc, \.cl-note-body\) \.toastui-editor-contents tr \{\s*break-inside: avoid;/
    );
  });
});

describe("Classic Template — boxes split by a page break", () => {
  it("draws a split box's border on each page's piece", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(
      source.indexOf("A box split by a page break closes")
    );
    expect(print).toMatch(/\.cl-card \{[^}]*box-decoration-break: clone;/);
  });
});

describe("Classic Template — Refrens match (2026-10-23)", () => {
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
      html.indexOf("cl-bottom")
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
      /cl-bank-upi">UPI<\/span>[\s\S]*?shop@okbank[\s\S]*?cl-upi-id/
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

describe("Classic Template — failed images", () => {
  it("prints nothing for an image that fails to load: no broken mark, no alt text", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.cl-doc img\.is-broken,[^{]*\{\s*display: none;/);
    const helpers = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    expect(helpers).toMatch(
      /addEventListener\(\s*"error",[\s\S]*?classList\.add\("is-broken"\)[\s\S]*?true\s*\)/
    );
  });
});

describe("Classic Template — tax and discount rows as refrens.com prints them", () => {
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

describe("Classic Template — item table look (refrens.com Classic)", () => {
  it("gives group rows their turn in the zebra, with no grey of their own (user, 2026-10-24)", () => {
    const { rows } = view().table;
    const group = rows.findIndex((row: Json) => row.isGroupHeader);
    expect(group).toBeGreaterThanOrEqual(0);
    expect(rows[group].isStripe).toBe(group % 2 === 0);
    expect(rows[group + 1].isStripe).toBe(!rows[group].isStripe);
    const html = render();
    expect(html).toMatch(
      /<tr class="cl-group-row(?: is-stripe)?" data-testid="group-row">/
    );
    const striped = rows.findIndex(
      (row: Json) => row.isGroupHeader && row.isStripe
    );
    if (striped >= 0) {
      expect(html).toMatch(
        /<tr class="cl-group-row is-stripe" data-testid="group-row">/
      );
    }
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).not.toMatch(/\.cl-group-row(?: > td)? \{[^}]*background/);
  });

  it("keeps the table's corners square and the Total row on the paper", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    // classic.pdf: square corners, #1c2f34 rules.
    expect(css).toMatch(/\.cl-items-scroll \{[^}]*border-radius: 0;/);
    expect(css).toMatch(
      /\.cl-items-section \{[^}]*--cl-line: var\(--cl-rule\);/
    );
    expect(css).toMatch(
      /\.cl-total-row > td \{\s*background: var\(--cl-zebra\);/
    );
  });
});

describe("Classic Template — review round 2 (2026-10-23)", () => {
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
    expect(css()).toMatch(/\.cl-qr img \{[^}]*width: 120px;\s*height: 120px;/);
    expect(css()).toMatch(/\.cl-upi-qr \{[^}]*width: 120px;\s*height: 120px;/);
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
    expect(html).toMatch(
      /cl-supply-cell[\s\S]*?cl-detail-value">Karnataka \(29\)</
    );
  });

  it("rules the summary tables both ways, square corners", () => {
    expect(css()).toMatch(
      /\.cl-widget-table \.ceres-table td \{[^}]*border-inline-end: 1px solid var\(--cl-line\);\s*border-bottom: 1px solid var\(--cl-line\);/
    );
    expect(css()).toMatch(
      /\.cl-widget-table \.ceres-table-section \{[^}]*overflow: clip;\s*border-radius: 0;/
    );
    // No grey outline beside the purple header: the wrappers draw no border.
    expect(css()).not.toMatch(/\.ceres-table-section \{[^}]*border: 1px/);
    expect(css()).not.toMatch(
      /\.cl-items-scroll \{\s*max-width: 100%;[^}]*border: 1px/
    );
  });
});

describe("Classic Template — enquiry line", () => {
  it("is centred", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.cl-enquiry \{[^}]*text-align: center;/);
  });
});

describe("Classic Template — band in print", () => {
  it("prints each band row whole and keeps the title with the parties", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.cl-band-row,\s*\.cl-band-logistics > \* \{\s*break-inside: avoid;/
    );
    expect(css).toMatch(/\.cl-title-block \{\s*break-after: avoid-page;/);
  });
});

describe("Classic Template — HSN and Tax Summary columns", () => {
  it("spreads their columns equally", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\[data-section="hsn"\], \[data-section="tax-summary"\]\) \.ceres-table\.is-even \{\s*width: 100%;\s*table-layout: fixed;/
    );
  });
});

describe("Classic Template — review round 6 (2026-10-24)", () => {
  const css = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  const hbs = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "template.hbs"), "utf8");

  it("closes every page's piece of the item table in print", () => {
    // A repeated, empty footer draws the bottom corners; the headings' end cells the top ones.
    expect(hbs()).toMatch(
      /<tfoot class="cl-items-corners" aria-hidden="true">/
    );
    expect(css()).toMatch(/\.cl-items-corners \{\s*display: none;/);
    expect(css()).toMatch(
      /\.cl-items > \.cl-items-corners \{\s*display: table-footer-group;/
    );
    expect(css()).toMatch(
      /\.cl-items > thead > tr > th:first-child \{\s*border-inline-start: 1px solid var\(--cl-line\);\s*border-start-start-radius: 0;/
    );
    // The items' last row stays square where the split-off totals follow.
    expect(css()).toMatch(
      /\.cl-items:not\(:has\(\+ \[data-cl-totals-split\]\)\) > tbody:last-of-type/
    );
    expect(css()).toMatch(
      /\.cl-items\[data-cl-totals-split\]\.is-joint-left::before \{/
    );
    expect(css()).not.toMatch(/\.cl-items[^{]*> tbody:last-child/);
  });

  it("starts the e-invoice QR level with the first detail", () => {
    expect(css()).toMatch(
      /\.cl-cards > \.cl-compliance \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/
    );
    expect(css()).toMatch(
      /\.cl-compliance > \.cl-compliance-text > \.cl-card-title \{\s*grid-column: 1 \/ -1;/
    );
  });

  it("keeps the enquiry line and group headings with what they belong to in print", () => {
    expect(css()).toMatch(
      /\.cl-doc \.cl-enquiry \{\s*break-before: avoid-page;/
    );
    expect(css()).toMatch(
      /\.cl-items \.cl-group-row \+ tr \{\s*break-before: avoid;/
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
      /@container cl-doc \(width < 600px\) \{\s*\.cl-bottom-side \{\s*display: contents;[^}]*\}\s*(?:\/\*[^*]*\*\/\s*)?\.cl-bottom-side > :is\(\.cl-totals-table, \.cl-words\) \{\s*order: -1;/
    );
  });
});

describe("Classic Template — review round 5 (2026-10-24)", () => {
  const css = (): string =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("draws no border and no rounded corners on item images", () => {
    expect(css()).toMatch(
      /\.cl-doc \.cl-items :is\(\.cl-thumbnail, \.ceres-image, \.cl-large-image\) \{\s*border: 0;\s*border-radius: 0;/
    );
  });

  // User (2026-11-25): the UPI note at 11 px in a readable grey.
  it("sets the UPI note in 11 px grey", () => {
    expect(css()).toMatch(
      /\.cl-upi-note \{[^}]*color: var\(--cl-code\);[^}]*font-size: calc\(11px \* var\(--cl-text-scale, 1\)\)/
    );
    expect(css()).toMatch(/--cl-code: #666670;/);
  });

  it("sets the UPI caption in the ink colour at 11 px, medium (classic.pdf)", () => {
    expect(css()).toMatch(
      /\.cl-upi-caption \{[^}]*color: var\(--cl-ink\);[^}]*font-size: calc\(var\(--cl-font-size-section\)[^}]*font-weight: 500;/
    );
  });

  it("prints terms, notes, additional info and attachments without a box", () => {
    const rule = css().match(
      /\.cl-card:is\(\s*\.cl-widget-table,([^)]*)\) \{([^}]*)\}/
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

describe("sales order bank account from the PDF service's data", () => {
  it("takes bankAccountDetails when bankAccount is only the account's id", () => {
    const order = {
      invoice: {
        billType: "SALESORDER",
        bankAccount: "000000000000000000000001",
        bankAccountDetails: {
          accountNo: "1234 5678 9012",
          name: "Test Traders",
          bank: "Example Bank",
        },
      },
    };
    const result = withRefrensDefaults(order) as {
      invoice: Record<string, unknown>;
    };
    expect(result.invoice.bankAccount).toEqual({
      accountNo: "1234 5678 9012",
      name: "Test Traders",
      bank: "Example Bank",
    });
    // An account already sent whole is kept.
    const whole = {
      invoice: {
        bankAccount: { accountNo: "1" },
        bankAccountDetails: { accountNo: "2" },
      },
    };
    expect(
      (withRefrensDefaults(whole) as typeof whole).invoice.bankAccount
    ).toEqual({ accountNo: "1" });
  });
});

describe("Classic Template — real PDF findings (2026-11-01)", () => {
  // Khmer party names printed as boxes: the PDF service has no fallback fonts.
  it("loads the Noto face of a script found in the document's text", () => {
    const khmer = state((invoice) => {
      (invoice.billedTo as Record<string, unknown>).name = "យេសរាល យេសរាល។";
    });
    expect(mapScript(khmer).font).toBe("'Noto Sans Khmer'");
    expect(template(khmer)).toContain("--cl-script-font: 'Noto Sans Khmer';");
    expect(mapScript(state()).font).toBe("");
  });

  // Tabloid fell back to A4: the page was laid out an A4 column wide.
  it("lays a Tabloid page out at Tabloid width", () => {
    const tabloid = mapPrint({
      pdfOptions: { format: "tabloid", xMargins: 1, zoomSize: 1 },
    });
    const a4 = mapPrint({
      pdfOptions: { format: "a4", xMargins: 1, zoomSize: 1 },
    });
    expect(tabloid.printWidth).toBe(
      Math.floor((279.4 / 25.4) * 96 - 2 * 30 - 4)
    );
    expect(tabloid.printWidth).toBeGreaterThan(a4.printWidth);
  });

  // Long custom totals took the whole row and the labels broke letter by letter (A00052-E).
  it("keeps the totals' labels a word wide and lets a custom value wrap", () => {
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /grid-template-columns: minmax\(min-content, 1fr\) minmax\(min-content, 1fr\);/
    );
    expect(css).toMatch(
      /\.cl-extra-row \.cl-num:not\(\[data-testid="num"\]\) \{\s*white-space: normal;/
    );
  });
});

describe("Classic Template — line height and browser-print margins (2026-11-02)", () => {
  const css = () =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  // User: the lines read too far apart; every line height follows the text scale.
  it("sets body lines at 13 on 20 (native Classic) and no line height in fixed pixels", () => {
    expect(css()).toMatch(/--cl-lh: 1\.5385;/);
    expect(css()).not.toMatch(/line-height: \d+px/);
  });

  // User: margins did not follow the setting in a browser's print (always 1 cm).
  it("gives a browser's print the document's side margins", () => {
    const html = render((invoice) => {
      invoice.template = { pdfOptions: { xMargins: "2" } };
    });
    // Refrens' margins: 30 px of the paper per step (Wide 2 = 60 px), Narrow 0.5 when unset.
    expect(html).toContain('data-cl-side-margin="60"');
    const print = mapPrint({ pdfOptions: { xMargins: "2" } });
    expect(print.browserPrintWidth).toBe(print.printWidth);
    expect(mapPrint({ pdfOptions: {} }).sideMargin).toBe("15");
    expect(mapPrint({ pdfOptions: { xMargins: "0" } }).sideMargin).toBe("0");
  });
});

describe("Classic Template — print size (2026-11-02)", () => {
  // Print at the screen's size, like the E-commerce template, zoomed by the text scale alone:
  // each size prints at its own (user, 2026-11-02: Smaller printed as Normal).
  it("prints every text scale at its own size, 0.8 and unset by the template's own zoom", () => {
    const print = (pdfOptions: Json) => mapPrint({ pdfOptions });
    // No zoom of the document's own: the page's html zoom is the text scale.
    ["0.8", "0.9", "1", "1.2"].forEach((zoomSize) =>
      expect(print({ zoomSize }).printScale).toBe("1")
    );
    expect(printScaleFor()).toBe(1);
    // Refrens' renderer zooms <html> by 0.9, 1, 1.1 and 1.2, not 0.8 nor unset: the template's.
    expect(print({}).ownPrintZoom).toBe("0.8");
    expect(print({ zoomSize: "0.8" }).ownPrintZoom).toBe("0.8");
    expect(print({ zoomSize: "0.9" }).ownPrintZoom).toBeUndefined();
    expect(print({ zoomSize: 1 }).ownPrintZoom).toBeUndefined();
    expect(render()).toContain(
      '<style id="cl-own-zoom">@media print { :where(html) { zoom: 0.8; } }</style>'
    );
    // The page is laid out under that zoom: wider in CSS px.
    expect(print({}).printWidth).toBe(950);
  });

  // Chrome prints its date / title / URL / page-number stamps in a page's top and bottom
  // margins: they are 0 in a browser's print, the frame's margin rows put 1 cm back.
  it("gives a browser's print margin rows instead of page margins", () => {
    const html = render();
    expect(html.match(/<tr class="cl-page-margin"/g)).toHaveLength(2);
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /body:not\(\[class~="isDibella"\]\) \.cl-doc:not\(\.is-pageless\) \.cl-page-frame > \* > tr\.cl-page-margin \{\s*display: table-row;/
    );
  });
});

/*
 * Refrens' Classic (user's "Classic - Web View" PDF, 2026-11-19): logo | title, status and
 * business address; Billed By | Billed To | <Document> Details; Shipped From | Shipped To |
 * Transport Details; an outlined table on a grey heading row; terms, notes and Bank and UPI on
 * the left; totals, a theme-coloured grand-total bar, the amount in words and the signature on
 * the right.
 */
describe("Classic Template — Classic design (2026-11-19)", () => {
  const css = () =>
    fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("lays the header out as Refrens' Classic: logo | title, then three columns, then shipping", () => {
    const html = render((invoice) => {
      invoice.shippedTo = { name: "Site Office", city: "Howrah" };
    });
    const band = html.slice(
      html.indexOf('class="cl-band"'),
      html.indexOf("</header>")
    );
    const order = [
      'class="cl-logo"',
      'class="cl-title"',
      'data-role="billed-by"',
      'data-role="billed-to"',
      'data-section="details"',
      'data-role="shipped-to"',
    ].map((marker) => band.indexOf(marker));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Under the title the subtitle only, never the business address (user, 2026-11-25).
    expect(band).not.toContain('data-role="business-address"');
    // Every block under its caption, the details too.
    expect(band).toMatch(/cl-band-caption">Billed By</);
    expect(band).toMatch(/cl-band-caption">Client Name</); // the business's own label
    expect(band).not.toMatch(/cl-band-caption">[^<]+ Details</); // no details heading (user, 2026-11-25)
  });

  it("puts Country / Place of Supply and the document QR in the details column", () => {
    const html = render((invoice) => {
      invoice.countryOfSupply = "IN";
      invoice.placeOfSupply = "29";
    });
    const details = html.slice(
      html.indexOf('data-section="details"'),
      html.indexOf('data-section="logistics"')
    );
    expect(details).toContain("data-ceres-country-of-supply");
    expect(details).toContain('data-ceres-field-container="documentQr"');
  });

  it("adds the amount due to an invoice's details, never to a quotation's", () => {
    const due = (billType: string) =>
      view((invoice) => {
        invoice.billType = billType;
      }).details.find((row) => row.key === "dueAmount");
    expect(due("INVOICE")?.label).toBe("Due Amount");
    expect(due("INVOICE")?.value).toMatch(/^₹/);
    expect(due("QUOTATION")).toBeUndefined();
    // Hidden with the totals by the stylesheet, so a live Hide Totals takes it away and back.
    expect(css()).toMatch(
      /\.cl-doc:has\(\.cl-grand-row\.is-hidden-by-totals\) \.cl-detail\[class~="cl-meta-dueAmount"\] \{\s*display: none;/
    );
  });

  it("prints the amount in words under the grand total, every word capitalised", () => {
    const html = render();
    const side = html.slice(html.indexOf('class="cl-bottom-side"'));
    expect(side.indexOf("data-ceres-total-in-words")).toBeGreaterThan(
      side.indexOf("cl-grand-row")
    );
    expect(html).toMatch(/cl-words-value">Ten Lakh Twenty One Thousand [A-Z]/);
  });

  // User 2026-11-25: a row with two lines on one side (a converted amount, a long custom
  // value) left the other cell short and its rules half way down ("ye kya layout hai").
  it("keeps every totals row one ruled box: cells as tall as the row, no outline over the bar", () => {
    const sheet = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    expect(sheet).toMatch(
      /\.cl-totals-table \.cl-totals > tr \{[^}]*grid-template-columns: subgrid;[^}]*align-items: stretch;/
    );
    expect(sheet).toMatch(
      /\.cl-totals-table \.cl-totals th,\s*\.cl-totals-table \.cl-totals td \{[^}]*border-bottom: 1px solid var\(--cl-rule\);/
    );
    expect(sheet).not.toMatch(/\.cl-grand-row \{[^}]*outline:/);
  });

  // User 2026-11-25 (quotation LTG3443): an invisible custom currency symbol prints as it is.
  it("prints an invisible custom currency symbol as nothing, never a box", () => {
    expect(isInvisibleSymbol("\u3164")).toBe(true);
    expect(isInvisibleSymbol("₹")).toBe(false);
    const html = template(
      withMoneyDefaults(
        state((invoice) => {
          invoice.customCurrencySymbol = "\u3164";
        })
      )
    );
    expect(html).not.toContain("\u3164");
  });

  it("keeps terms and notes in the left column above the bank details (native Classic)", () => {
    const html = render((invoice) => {
      invoice.notes = "Thank you";
    });
    const main = html.slice(
      html.indexOf('class="cl-bottom-main"'),
      html.indexOf('class="cl-bottom-side"')
    );
    expect(main.indexOf('data-section="bank"')).toBeGreaterThan(
      main.indexOf('data-section="terms"')
    );
    expect(main).toContain('data-section="notes"');
  });

  it("draws the table in black rules under a theme-tinted heading row (native Classic)", () => {
    const sheet = css();
    expect(sheet).toMatch(
      /--cl-accent: var\(--primary-color, var\(--cl-theme, #16a9e0\)\)/
    );
    expect(sheet).toMatch(
      /--cl-head-tint: color-mix\(in srgb, var\(--cl-accent\) 11%, var\(--cl-paper\)\);/
    );
    expect(sheet).toMatch(
      /\.cl-items-section \{[^}]*--cl-line: var\(--cl-rule\);/
    );
    expect(sheet).toMatch(
      /\.cl-items > thead > tr \{\s*background: var\(--cl-head-tint\);/
    );
  });

  it("fills the grand total's bar with the theme colour on the row and each cell, the outline on the cells", () => {
    expect(css()).toMatch(
      /\.cl-totals \.cl-grand-row \{[^}]*background: var\(--cl-accent\);/
    );
    expect(css()).toMatch(
      /\.cl-grand-row > \* \{[^}]*background: var\(--cl-accent\);[^}]*color: var\(--cl-on-accent\);/
    );
    // User (2026-11-26): no hairline between the top rule and the bar; rules meet cleanly.
    expect(css()).toMatch(/\.cl-totals-table \.cl-totals \{[^}]*border: 0;/);
    expect(css()).toMatch(
      /> tr:nth-child\(1 of :not\(\.is-hidden-by-totals, \.is-hidden-by-taxes, \.is-blank-row, \[style\*="none"\]\)\)\s*> \* \{\s*border-top: 1px solid var\(--cl-rule\);/
    );
  });

  it("sets capitals only on captions and table headings; 700 only where native Classic has it", () => {
    const sheet = css();
    const blocks =
      sheet.match(/[^{}]+\{[^{}]*text-transform: uppercase;[^{}]*\}/g) || [];
    const selectors = blocks.map((block) => block.split("{")[0].trim());
    selectors.forEach((selector) =>
      expect(selector).toMatch(/caption|card-title|section-title|thead|th\b/)
    );
    expect(sheet).not.toMatch(/font-weight: (800|900|bold)/);
    // Native Classic (2026-11-25): bold 700 only on party names and the seller's field names.
    const bold = Array.from(
      sheet.matchAll(/([^{}]+)\{[^{}]*font-weight: 700;/g),
      (m) => m[1].trim().split("\n").pop()
    );
    bold.forEach((selector) =>
      expect(selector).toMatch(/cl-party-name|cl-billed-by .cl-field-label/)
    );
  });
});

describe("Classic Template — light theme colours", () => {
  it("draws headings and table rules in ink for a light theme colour, the theme colour otherwise", () => {
    const html = (color: string) =>
      render((invoice) => {
        invoice.template = {
          ...((invoice.template as Json) || {}),
          primaryColor: color,
        };
      });
    expect(html("#ffd400")).toContain("--cl-accent-text: #22272f;");
    expect(html("#ffffff")).toContain("--cl-accent-text: #22272f;");
    expect(html("#0b1f4d")).not.toContain("--cl-accent-text:");
  });
});

describe("Classic Template — live colour contrast (Lydia)", () => {
  it("re-checks text contrast whenever Lydia changes the colour live", () => {
    const index = fs.readFileSync(path.join(TEMPLATE_DIR, "index.ts"), "utf8");
    expect(index).toMatch(/registerClassicThemeContrast\(\);/);
    const helpers = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    // Watches <html>'s style (where the renderer writes --primary-color) and new documents.
    expect(helpers).toMatch(/attributeFilter: \["style"\]/);
    expect(helpers).toMatch(/setProperty\("--cl-accent-text", INK_ON_LIGHT\)/);
  });
});
