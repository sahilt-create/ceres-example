import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/apex-engineering.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/apex-engineering/template.hbs";
import {
  buildApexView,
  formatContext,
  formatDocumentDate,
  formatFigure,
  mapCompliance,
  mapContact,
  mapCostCard,
  mapItemTable,
  mapPaymentTerms,
  mapScript,
  mapPrint,
  withTemplateSettings,
  mapTotals,
  currencyMark,
  discountRate,
  isSquareLogo,
  mapStockSummary,
  onThemeColor,
  registerApexHelpers,
  resolveSettings,
  subtitleLines,
} from "../src/templates/apex-engineering/helpers";
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

const TEMPLATE_DIR = path.join(__dirname, "../src/templates/apex-engineering");

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
  buildApexView(state(edit));

/* The opening tag of the first element carrying an attribute or class. */
const tagWith = (html: string, marker: string): string => {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const start = html.lastIndexOf("<", at);
  return html.slice(start, html.indexOf(">", at) + 1);
};

beforeAll(() => {
  registerApexHelpers(HandlebarsRuntime);
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

describe("Apex Engineering — render", () => {
  it("maps the reference document from the payload", () => {
    const html = render();
    // Header: the fixed Apex mark, title, subtitle split at its comma, the business logo.
    expect(html).toContain('alt="Apex Engineering"');
    expect(html).toContain('src="apex-sample-logo.png"');
    expect(html).toContain(
      '<h1 class="ax-title" data-role="title">Equipment Quotation</h1>'
    );
    expect(html).toContain('<p class="ax-subtitle">Supply of VRV System</p>');
    expect(html).toContain(
      '<p class="ax-tagline">Equipment, accessories &amp; allied materials.</p>'
    );
    // Document details: business labels, the design's date format, custom headers.
    expect(html).toMatch(
      /ax-meta-label">Drawing No<[\s\S]*?QT-R2\/A5\/880\/SR\/46\/26-27/
    );
    expect(html).toMatch(/ax-meta-label">Date<[\s\S]*?27th May, 2026/);
    expect(html).toMatch(/ax-meta-label">DWG\. NO<[\s\S]*?>R1</);
    // Client panel.
    expect(html).toContain('<p class="ax-party-label">Client Name</p>');
    expect(html).toContain("SAMPLE CLIENT PVT LTD");
    expect(html).toContain(
      "Sample House, 1/1 Sample Street, Kolkata – 700001, West Bengal, India"
    );
    expect(html).toMatch(
      /ax-field-label">GSTIN<\/span> <span class="ax-field-value ax-num ax-break">19AAAAA0000A1Z5/
    );
    expect(html).toMatch(
      /ax-field-label">Email<\/span> <span class="ax-field-value ax-email ax-break">client@example.com/
    );
    // The cost card: the grand total, as the table's last totals row prints it.
    expect(html).toContain('<p class="ax-cost-label">Equipment Cost</p>');
    expect(html).toContain('<p class="ax-cost-note">(INCL. GST @18%)</p>');
    expect(html).toContain('data-role="grand-total">₹10,21,694.98</p>');
    expect(html).toMatch(
      /ceres-subtotal-row-grand[\s\S]*?Equipment Cost[\s\S]*?₹10,21,694\.98/
    );
    // Totals rows inside the table.
    ["Sub Total", "Discount", "CGST", "SGST"].forEach((label) =>
      expect(html).toMatch(
        new RegExp(`ceres-subtotal-label"[^>]*>\\s*${label}`)
      )
    );
    expect(html).toContain("₹77,925.89");
    // Footer: terms, payment terms card, bank, contact strip with the seller's GSTIN.
    expect(html).toContain(
      "<li>Price validity: 10 days from the date of submission.</li>"
    );
    expect(html).toContain('<p class="ax-pay-figure ax-num">90%</p>');
    expect(html).toContain(
      '<p class="ax-pay-caption">Advance along with order and before delivery of materials</p>'
    );
    expect(html).toContain('<p class="ax-pay-figure ax-num">10%</p>');
    expect(html).toMatch(
      /ax-kv-label ax-bank-bankName">Bank Name<[\s\S]*?Sample Bank/
    );
    expect(html).toMatch(/ax-kv-label ax-bank-ifsc">IFSC<[\s\S]*?SMPL0000123/);
    expect(html).toContain(
      "12 Sample Road, Kolkata – 700001, West Bengal, India"
    );
    expect(html).toContain("tel(033-0000-0000)");
    expect(html).toContain("info@example.com");
    expect(html).toMatch(/GSTIN:<\/span> 19ABCDE1234F1Z5/);
    // Words line under the totals.
    expect(html).toContain("TEN LAKH TWENTY ONE THOUSAND");
  });

  it("prints the account's columns in its order, figures without the currency symbol", () => {
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
    expect(labels).toEqual([
      "Sr.",
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
    const body = items.slice(
      items.indexOf("</thead>"),
      items.indexOf('class="ax-totals')
    );
    expect(body).toContain("7,60,698.00");
    expect(body).not.toContain("₹");
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

  it("letters the groups and numbers their items from 1 again", () => {
    const html = render();
    const groups = Array.from(
      html.matchAll(/ax-group-row[^>]*>\s*<td colspan="\d+">([^<]+)</g),
      (m) => m[1]
    );
    expect(groups).toEqual([
      "A. OUTDOOR UNITS",
      "B. INDOOR UNITS",
      "C. REFNET JOINT",
    ]);
    const serials = Array.from(
      html.matchAll(/<tr class="ax-item-row[\s\S]*?data-testid="num">(\d+)</g),
      (m) => m[1]
    );
    expect(serials).toEqual(["1", "1", "2", "3", "4", "1", "2", "3"]);
    // A group name that already carries a letter keeps it.
    const lettered = view((invoice) => {
      invoice.items[0].name = "X. SPARES";
    });
    expect(lettered.table.rows[0]).toMatchObject({
      isGroupHeader: true,
      name: "X. SPARES",
    });
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

describe("Apex Engineering — boolean settings", () => {
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
    expect(tagWith(noTaxes, 'data-ceres-subtotal-row="cgst:18"')).toContain(
      "is-hidden-by-taxes"
    );
    expect(noTaxes).not.toContain("ax-cost-note");
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
    expect(tagWith(payments(), "data-ceres-payment-table")).not.toContain(
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
    expect(html).toMatch(/ax-name-row[\s\S]*?<span class="ax-item-name">42 HP/);
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
    expect(thumbs).toContain("ax-item-thumbnail");
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
    expect(html).toContain('<span class="ax-item-code">SKU: SKU-1</span>');
    expect(html).toContain('<span class="ax-item-code">HSN/SAC: 8415</span>');
  });

  it("hideCountryOfSupply hides the supply row (kept for the live toggle)", () => {
    expect(tagWith(render(), "data-ceres-country-of-supply")).not.toContain(
      "display:none"
    );
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
    expect(every).toContain("ax-footer-fixed");
    expect(every).toContain("ax-page-frame-footer");

    const last = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = { pdfOptions: { footerOnLastPage: true } };
    });
    expect(last).not.toContain("ax-footer-fixed");
    expect(last).not.toContain("ax-page-frame-footer");
  });

  it("puts a long header detail under its label", () => {
    const long =
      "Lorem ipsum is simply dummy text of the printing and typesetting industry.";
    const html = render((invoice) => {
      invoice.customHeaders.push({ label: "Custom Fields", value: long });
    });
    expect(html).toMatch(
      /ax-meta-row ax-meta-customHeader is-long"[\s\S]*?Custom Fields/
    );
    // Short values keep the label | value line.
    expect(html).toMatch(/ax-meta-row ax-meta-customHeader"[\s\S]*?DWG\. NO/);
  });

  it("letterHeadOnFirstPage: the letterhead repeats in the print frame's header unless off", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
    });
    const header = every.slice(
      every.indexOf("ax-page-frame-header"),
      every.indexOf("</thead>")
    );
    expect(header).toContain('src="https://example.com/head.png"');
    expect(every.match(/data-ceres-height="letterhead"/g)).toHaveLength(1);

    const first = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: true } };
    });
    expect(first).not.toContain("ax-page-frame-header");
    expect(first.indexOf('src="https://example.com/head.png"')).toBeLessThan(
      first.indexOf("ax-page-frame")
    );
  });

  it("hideFooter: the letterhead footer is not drawn", () => {
    const hidden = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = { pdfOptions: { hideFooter: true } };
    });
    expect(hidden).not.toContain("https://example.com/foot.png");
    expect(hidden).toContain("ax-doc is-footer-hidden");
  });

  it("fits the print table to the paper: format and landscape", () => {
    const wide = 600; // fixed columns, px
    const at = (pdfOptions: Json) =>
      mapPrint(
        state((invoice) => {
          invoice.template = { pdfOptions };
        }),
        wide
      ).compactTable;
    expect(at({ format: "a4" })).toBe(true);
    expect(at({ format: "a4", landscape: true })).toBe(false);
    expect(at({ format: "a3" })).toBe(false);
    expect(at({ format: "a5", landscape: true })).toBe(true);
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

  it("irnPosition places the compliance box above or below the items; QR settings gate the document QR", () => {
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

    const qrOff = mapCompliance(
      state((invoice) => {
        invoice.documentQr = "data:image/png;base64,AAAA";
        invoice.owner.configuration.showQrCode = { quotation: false };
      })
    );
    expect(qrOff.qr.document).toBe("");
  });

  it("Shipped From | Shipped To | Transport Details in the panel under the client", () => {
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
    expect(client).toContain("ax-panel-slot");
    const dispatch = html.slice(html.indexOf('data-section="dispatch"'));
    const from = dispatch.indexOf('data-role="shipped-from"');
    const to = dispatch.indexOf('data-role="shipped-to"');
    const transport = dispatch.indexOf("ax-transport-vehicleNumber");
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(transport).toBeGreaterThan(to);
    // The party's fields sit in its own column.
    expect(dispatch.slice(to, transport)).toContain("19AAAAA1111A1Z5");

    // Ship To alone still opens the panel, with transport in it.
    const onlyTo = render((invoice) => {
      invoice.shippedTo = { name: "Site Office", city: "Howrah" };
      invoice.transportDetails = { vehicleNumber: "WB01AB1234" };
    });
    expect(onlyTo).toMatch(
      /data-section="dispatch"[\s\S]*?ax-transport-vehicleNumber/
    );
    // With neither party, transport reads in the header's details.
    const noParties = render((invoice) => {
      invoice.transportDetails = { vehicleNumber: "WB01AB1234" };
    });
    expect(noParties).not.toContain('data-section="dispatch"');
    expect(noParties).toMatch(/ax-meta-label">Vehicle No\.<[\s\S]*?WB01AB1234/);
  });

  it("notes on a row of their own, attachments and additional info", () => {
    const html = render((invoice) => {
      invoice.notes = "Thank you";
      invoice.attachments = ["https://example.com/drawing.pdf"];
      invoice.customFields = [{ label: "Site", value: "Block 1" }];
    });
    // Below Terms | Bank, above Additional Info | Attachments, never inside the terms row.
    const notesAt = html.indexOf('data-section="notes"');
    const termsRow = html.slice(
      html.indexOf('data-pair="terms-bank"'),
      html.indexOf('data-section="bank"')
    );
    expect(termsRow).not.toContain('data-section="notes"');
    expect(notesAt).toBeGreaterThan(html.indexOf('data-section="bank"'));
    expect(notesAt).toBeLessThan(
      html.indexOf('data-pair="additional-attachments"')
    );
    expect(html).toContain(">drawing.pdf<");
    expect(html).toMatch(/ai-label">Site<[\s\S]*?Block 1/);

    const hiddenNotes = view((invoice) => {
      invoice.notes = "Thank you";
      invoice.showNotes = false;
    });
    expect(hiddenNotes.notesRow).toBeNull();
  });

  it("bank transfer and UPI follow the payment options; upiShrink makes the QR small", () => {
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
    expect(upi).toContain('class="ax-upi is-small"');
  });

  it("party field visibility switches hide email and phone", () => {
    const html = render((invoice) => {
      invoice.billedTo.emailShowInInvoice = false;
    });
    expect(html).not.toContain("client@example.com");
  });

  it("shows the status tag on invoices, on paper only once paid", () => {
    expect(render()).not.toContain("ax-status");
    const unpaid = render((invoice) => {
      invoice.billType = "INVOICE";
    });
    expect(unpaid).toContain('class="ax-status no-print"');
    const paid = render((invoice) => {
      invoice.billType = "INVOICE";
      invoice.status = "PAID";
    });
    expect(paid).toContain('class="ax-status"');
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
    expect(arabicHtml).toContain("--ax-script-font: 'Noto Sans Arabic'");
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
    expect(html).toContain("--ax-theme: #1a5d1a");
    expect(html).toContain("--ax-text-scale: 1.1");
    expect(render()).not.toContain("--ax-theme");
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
    // No signature on the document: no "For … / Authorized Signatory" block at all.
    expect(render()).not.toContain('data-testid="signature"');
    expect(render()).not.toContain("For Apex Engineering");
    // In the footer row, after the contact strip.
    const html = render((invoice) => {
      invoice.signature = "https://example.com/sign.png";
    });
    expect(html).toContain("For Apex Engineering");
    const at = html.indexOf('data-testid="signature"');
    expect(at).toBeGreaterThan(html.indexOf('data-section="footer"'));
    expect(at).toBeGreaterThan(html.indexOf('data-testid="contact"'));
    expect(at).toBeLessThan(html.indexOf("</footer>"));
  });
});

describe("Apex Engineering — view model", () => {
  it("splits the subtitle at its first comma: bold lead, the rest below", () => {
    expect(
      subtitleLines(
        "Supply Of Dakin VRV System, Equipment, accessories & allied materials."
      )
    ).toEqual({
      lead: "Supply Of Dakin VRV System",
      rest: "Equipment, accessories & allied materials.",
    });
    expect(subtitleLines("Supply Of Dakin VRV System")).toEqual({
      lead: "Supply Of Dakin VRV System",
      rest: "",
    });
    expect(subtitleLines("Line one\nLine two")).toEqual({
      lead: "Line one",
      rest: "Line two",
    });
    expect(subtitleLines(undefined)).toEqual({ lead: "", rest: "" });
  });

  it("prints dates as 27th May, 2026 in the business's offset", () => {
    expect(formatDocumentDate("2026-05-27")).toBe("27th May, 2026");
    expect(formatDocumentDate("2026-05-01")).toBe("1st May, 2026");
    expect(formatDocumentDate("2026-05-02")).toBe("2nd May, 2026");
    expect(formatDocumentDate("2026-05-03")).toBe("3rd May, 2026");
    expect(formatDocumentDate("2026-05-11")).toBe("11th May, 2026");
    expect(formatDocumentDate("2026-05-22")).toBe("22nd May, 2026");
    expect(formatDocumentDate("2026-05-26T20:00:00.000Z", "+05:30")).toBe(
      "27th May, 2026"
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

  it("puts every line that opens with a share on the Payment Terms card, from any group", () => {
    expect(mapPaymentTerms(state())).toEqual({
      title: "Payment Terms",
      cells: [
        {
          figure: "90%",
          caption: "Advance along with order and before delivery of materials",
        },
        {
          figure: "10%",
          caption: "After successful commissioning of the system.",
        },
      ],
    });
    // One mixed group (the user's document): the share lines go to the card, the rest stay.
    const mixed = view((invoice) => {
      invoice.terms = [
        {
          label: "Terms and Conditions",
          terms: [
            "90% Taxes GST @ 18 % inclusive (as mentioned above )",
            "10% Payment terms : 50% advance and balance before dispatch.",
            "Cancellation of order : no cancellation after token or advance / no refund",
            "Freight charges : Extra /As per actual.",
          ],
        },
      ];
    });
    expect(mixed.paymentTerms?.title).toBe("Payment Terms");
    expect(mixed.paymentTerms?.cells).toEqual([
      {
        figure: "90%",
        caption: "Taxes GST @ 18 % inclusive (as mentioned above )",
      },
      {
        figure: "10%",
        caption: "Payment terms : 50% advance and balance before dispatch.",
      },
    ]);
    expect(mixed.termsRow.terms).toEqual([
      {
        title: "Terms and Conditions",
        items: [
          "Cancellation of order : no cancellation after token or advance / no refund",
          "Freight charges : Extra /As per actual.",
        ],
      },
    ]);
    // A share later in the line ("receiving 100% payment") is not a share line.
    expect(view().termsRow.terms[0].items).toContain(
      "Prices include GST. Any change in statutory taxes will be applicable at the time of receiving 100% payment."
    );
    // "50 % - on order": the share with its space dropped; a line without one stays in T&C.
    const spaced = view((invoice) => {
      invoice.terms[1].terms = ["50 % - on order", "Balance on delivery"];
    });
    expect(spaced.paymentTerms?.cells).toEqual([
      { figure: "50%", caption: "on order" },
    ]);
    expect(spaced.paymentTerms?.title).toBe("Payment Terms");
    expect(spaced.termsRow.terms.map((group: Json) => group.title)).toEqual([
      "Terms and Conditions",
      "Payment Terms",
    ]);
    // A group made only of share lines lends the card its label, and leaves T&C.
    const named = view((invoice) => {
      invoice.terms[1].label = "Milestones";
    });
    expect(named.paymentTerms?.title).toBe("Milestones");
    expect(named.termsRow.terms.map((group: Json) => group.title)).toEqual([
      "Terms and Conditions",
    ]);
    // No share lines anywhere: no card.
    expect(
      mapPaymentTerms(
        state((invoice) => {
          invoice.terms.pop();
        })
      )
    ).toBeNull();
    // On the page: the share bold, the rest regular.
    expect(render()).toMatch(
      /ax-pay-figure ax-num">90%<\/p>\s*<p class="ax-pay-caption">Advance along/
    );
  });

  it("notes the tax the cost card includes", () => {
    const card = (edit?: (invoice: Json) => void) => {
      const s = state(edit);
      return mapCostCard(s, mapTotals(s));
    };
    expect(card()).toMatchObject({
      label: "Equipment Cost",
      value: "₹10,21,694.98",
      note: "(INCL. GST @18%)",
      showRupeeIcon: true,
    });
    expect(
      card((invoice) => {
        invoice.items[1].gstRate = 28;
      })?.note
    ).toBe("(INCL. GST)");
    expect(
      card((invoice) => {
        invoice.finalTotal.cgst = 0;
        invoice.finalTotal.sgst = 0;
      })?.note
    ).toBe("");
    expect(
      card((invoice) => {
        invoice.currency = "USD";
      })?.showRupeeIcon
    ).toBe(false);
  });

  it("fills the contact strip from Billed By alone", () => {
    expect(mapContact(state())).toEqual({
      address: "12 Sample Road, Kolkata – 700001, West Bengal, India",
      phone: "033-0000-0000",
      email: "info@example.com",
    });
    // The document's enquiry contact is never used, even when Billed By has none.
    const seller = mapContact(
      state((invoice) => {
        invoice.contact = { phone: "1111111111", email: "enquiry@example.com" };
        invoice.billedBy.phone = "9800000000";
        invoice.billedBy.emailShowInInvoice = false;
      })
    );
    expect(seller).toMatchObject({ phone: "9800000000", email: "" });
    const bare = mapContact(
      state((invoice) => {
        invoice.contact = { phone: "1111111111" };
        invoice.billedBy = { name: "Apex Engineering" };
      })
    );
    expect(bare).toBeNull();
  });

  it("sizes the table from the Figma widths with a 32 px serial column", () => {
    const s = state();
    const table = mapItemTable(s, formatContext(s.invoice));
    expect(table.serialWidth).toBe(32);
    expect(
      table.header.find((cell: Json) => cell.key === "rate")?.width
    ).toBeGreaterThanOrEqual(103);
  });

  it("assembles a sparse document without failing", () => {
    const sparse = buildApexView(
      normalizeInvoiceTemplateState({
        invoice: { billType: "INVOICE" },
      } as never)
    );
    expect(sparse.parties).toEqual([]);
    expect(sparse.paymentTerms).toBeNull();
    expect(sparse.contact).toBeNull();
    expect(
      template(
        normalizeInvoiceTemplateState({
          invoice: { billType: "INVOICE" },
        } as never)
      )
    ).toContain("ax-doc");
  });
});

describe("Apex Engineering — files and CSS", () => {
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

  it("follows the repo type preset: six steps, 13 px base in print, nothing below 10 px", () => {
    const steps = (block: string) =>
      Object.fromEntries(
        Array.from(block.matchAll(/--ax-font-size-(\w+): (\d+)px;/g), (m) => [
          m[1],
          Number(m[2]),
        ])
      );
    expect(steps(source.slice(0, source.indexOf("@media")))).toEqual({
      xs: 11,
      s: 13,
      base: 13,
      m: 14,
      lg: 18,
      xl: 20,
    });
    expect(steps(source.slice(source.indexOf("@media print")))).toEqual({
      xs: 11,
      s: 13,
      base: 13,
      m: 14,
      lg: 16,
      xl: 18,
    });
    // Shrinking table text (crowded figures, a narrow page) stops at the 10 px floor.
    expect(source).toMatch(
      /has-small-numbers td\.is-num \{\s*font-size: max\(10px, 0\.9em\)/
    );
    expect(source).toMatch(
      /\.ax-items\.is-print-compact \{\s*font-size: max\(\s*10px,/
    );
    const a5 = mapPrint(
      state((invoice) => {
        invoice.template = { pdfOptions: { format: "A5" } };
      }),
      900,
      9
    );
    expect(Number(a5.tableFit)).toBeGreaterThanOrEqual(0.77);
    const all = Array.from(
      source.matchAll(/(?:font-size|--ax-font-size-\w+):\s*(\d+(?:\.\d+)?)px/g),
      (m) => Number(m[1])
    );
    expect(all.length).toBeGreaterThanOrEqual(12);
    all.forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
  });

  it("keeps every spacing value on the 4 px grid", () => {
    const values = Array.from(
      source.matchAll(
        /(?:^|\s)(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?:\s*([^;]+);/g
      ),
      (m) => m[1]
    ).flatMap((value) =>
      Array.from(value.matchAll(/(-?\d+(?:\.\d+)?)px/g), (m) => Number(m[1]))
    );
    expect(values.length).toBeGreaterThan(40);
    // The item table's 6 px cell padding is the one exception (user request).
    // ...and the totals table's -1 px rule overlap, which is a join, not spacing.
    values
      .filter((value) => value !== 6 && Math.abs(value) !== 1)
      .forEach((value) => expect(Math.abs(value) % 4).toBe(0));
    expect(source).toMatch(/\.ax-items th,\n\.ax-items td \{\s*padding: 6px;/);
    expect(source).toMatch(/\.ax-card \{[^}]*padding: 12px;/);
    expect(source).toMatch(
      /\.ax-item-desc \.toastui-editor-contents :is\(th, td\),\n[^{]*\{\s*padding: 6px;/
    );
  });

  it("scales text by the document's text scale and never changes the business's case", () => {
    expect(source).not.toMatch(/text-transform/);
    expect(source).not.toMatch(/@page\s*\{/);
    expect(source).not.toMatch(/zoom:/);
    const sizes = Array.from(
      source.matchAll(/font-size:\s*([^;]+);/g),
      (m) => m[1]
    );
    sizes
      // Relative to the scaled table text (and floored at 10 px), so already scaled.
      .filter((size) => size !== "inherit" && size !== "max(10px, 0.9em)")
      .forEach((size) => expect(size).toContain("var(--ax-text-scale, 1)"));
  });

  it("keeps a field's value on its label's line", () => {
    expect(source).toMatch(/\n\.ax-field \{\s*display: block;/);
  });

  it("lists attachments without an indent", () => {
    expect(source).toMatch(
      /\.ax-attachments \{\s*padding: 0;\s*list-style: none;/
    );
  });

  it("puts no top padding on the footer", () => {
    const footer = source.match(/\n\.ax-footer \{([^}]*)\}/);
    expect(footer).not.toBeNull();
    expect(footer?.[1]).not.toMatch(/padding/);
  });

  it("shows the signature image up to 120 px tall", () => {
    expect(source).toMatch(
      /\.ax-signature \.ax-signature-image \{[^}]*max-height: 120px;/
    );
  });

  it("top-aligns the header's title block", () => {
    expect(source).toMatch(/\.ax-header-title \{[^}]*align-self: flex-start;/);
  });

  it("spaces the client panel as the design does", () => {
    expect(source).toMatch(/\.ax-panel \{[^}]*justify-content: space-between;/);
    expect(source).toMatch(/\.ax-party \{[^}]*flex: 0 1 231px;/);
    // The fields column: 198 px at the least, hugging a longer GSTIN / phone up to 40%.
    expect(source).toMatch(
      /\.ax-party-fields \{[^}]*width: max-content;[^}]*min-width: min\(198px, 100%\);[^}]*max-width: 40%;/
    );
    expect(source).toMatch(/\.ax-panel-slot \{[^}]*flex: none;/);
  });

  it("top-aligns the contact icons with their first line", () => {
    expect(source).toMatch(/\.ax-contact-row \{[^}]*align-items: flex-start;/);
    expect(source).toMatch(/\.ax-contact-icon \{[^}]*height: 1lh;/);
  });

  it("puts the UPI QR below the bank details", () => {
    expect(source).toMatch(/\.ax-bank-body \{[^}]*flex-direction: column;/);
  });

  it("draws no box around the summaries", () => {
    expect(source).toMatch(
      /\.ax-card\.ax-widget-table \{\s*padding: 0;\s*border: 0;\s*border-radius: 0;/
    );
  });

  it("lays the Payment Terms entries two to a row", () => {
    expect(source).toMatch(
      /\.ax-pay-body \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
    );
    expect(source).toMatch(/\.ax-pay-cell:nth-child\(n \+ 3\) \{\s*border-top/);
    expect(source).toMatch(
      /\.ax-pay-caption \{[^}]*font-size: calc\(12px \* var\(--ax-text-scale, 1\)\);/
    );
    expect(source).toMatch(
      /\.ax-pay-cell:last-child:nth-child\(odd\) \{\s*grid-column: 1 \/ -1;/
    );
  });

  it("mirrors for right-to-left: logical sides only", () => {
    expect(source).not.toMatch(/(?:padding|margin|border)-(?:left|right)\s*:/);
    // Only the right-to-left overrides of the widgets' own alignment name a side.
    const withoutRtl = source.replace(
      /\.ax-doc\[dir="rtl"\][^{]*\{[^}]*\}/g,
      ""
    );
    expect(withoutRtl).not.toMatch(/text-align: (?:left|right)/);
    expect(source).toMatch(/var\(--ax-script-font, "Inter"\)/);
  });

  it("uses the design's colour tokens", () => {
    ["#22272f", "#282828", "#e0e0e2", "#ceced2", "#f9f9f9"].forEach((token) =>
      expect(source).toContain(token)
    );
  });
});

describe("Apex Engineering — the platform's other settings, under every alias", () => {
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

  it("showTerms false / hideTerms hide Terms and Conditions and the Payment Terms card", () => {
    const off = view((invoice) => {
      invoice.advanceOptions.hideTerms = true;
    });
    expect(off.termsRow.terms).toEqual([]);
    expect(off.paymentTerms).toBeNull();
    expect(view().paymentTerms).not.toBeNull();
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
    expect(html).toContain("Stock Summary");
    expect(html).toContain("B-12");
    expect(html).toContain("31st Mar, 2027");
    // A column no batch fills (Mfg. Date) is left out.
    expect(html).not.toContain("Mfg. Date");

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
      "--ax-accent: var(--primary-color, var(--ax-theme, #000))"
    );
  });
});

describe("Apex Engineering — e-way bill with the IRN", () => {
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

describe("Apex Engineering — business logo shape", () => {
  it("gives a square or upright logo the 100 px square, a wide one its 200 × 48 box", () => {
    expect(isSquareLogo(500, 500)).toBe(true);
    expect(isSquareLogo(600, 500)).toBe(true);
    expect(isSquareLogo(300, 500)).toBe(true);
    expect(isSquareLogo(800, 200)).toBe(false);
    expect(isSquareLogo(0, 0)).toBe(false);
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(/\.ax-logo-image\.is-square\s*\{[^}]*height: 100px/);
    expect(css).toMatch(
      /\.ax-logo \.ax-logo-image \{[^}]*width: 200px;[^}]*height: 48px;/
    );
  });
});

describe("Apex Engineering — the Apex mark", () => {
  it("is exactly its 198 × 120 frame: the artwork is its background at the Figma crop", () => {
    const mark = tagWith(render(), 'class="ax-mark"');
    expect(mark).toContain('role="img"');
    expect(mark).toContain('aria-label="Apex Engineering"');
    expect(mark).toContain("background-image: url('data:image/jpeg;base64,");
    const html = render();
    const after = html.slice(html.indexOf('class="ax-mark"'));
    expect(
      after
        .slice(after.indexOf(">") + 1)
        .trimStart()
        .startsWith("</div>")
    ).toBe(true);
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.ax-mark \{[^}]*width: 198px;[^}]*height: 120px;[^}]*background-position: 49\.21% 50%;[^}]*background-size: 191\.3% 150%;/
    );
  });
});

describe("Apex Engineering — logo slot", () => {
  it("holds the business logo only: never the business name, and nothing without a logo", () => {
    expect(render()).toContain("ax-logo-image");
    const noLogo = render((invoice) => {
      delete invoice.logo;
      if (invoice.billedBy) delete invoice.billedBy.logo;
    });
    expect(noLogo).not.toContain('class="ax-logo"');
    expect(noLogo).not.toContain("ax-brand-name");
    expect(noLogo).not.toContain('data-role="company-name"');
    // The details still print.
    expect(noLogo).toContain('data-section="details"');
  });
});

describe("Apex Engineering — cost card currency mark", () => {
  it("draws the rupee artwork for INR and a symbol disc for every other currency", () => {
    expect(currencyMark({ currency: "INR" })).toBeNull();
    expect(currencyMark({ currency: "USD" })).toEqual({
      symbol: "$",
      size: 16,
    });
    expect(currencyMark({ currency: "EUR" })?.symbol).toBe("€");
    expect(currencyMark({ currency: "GBP" })?.symbol).toBe("£");
    expect(currencyMark({ currency: "BRL" })).toEqual({
      symbol: "R$",
      size: 13,
    });
    expect(currencyMark({ currency: "AED" })).toEqual({
      symbol: "AED",
      size: 10,
    });
    expect(
      currencyMark({ currency: "USD", customCurrencySymbol: "US$" })?.symbol
    ).toBe("US$");
    const usd = render((invoice) => {
      invoice.currency = "USD";
    });
    expect(usd).toContain('data-testid="currency-mark"');
    expect(usd).toMatch(/font-size="16">\$<\/text>/);
    expect(render()).not.toContain('data-testid="currency-mark"');
  });
});

describe("Apex Engineering — PDF service page hooks", () => {
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
});

describe("Apex Engineering — frames hug long values", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  it("widens the bank card for a long account number or UPI ID instead of overflowing", () => {
    expect(source).toMatch(
      /\.ax-row > \.ax-bank-card \{[^}]*width: 359px;[^}]*min-width: min-content;[^}]*max-width: 100%;/
    );
    expect(source).toMatch(
      /\.ax-bank-rows \{[^}]*grid-template-columns: repeat\(2, minmax\(max-content, 1fr\)\);/
    );
  });
});

describe("Apex Engineering — party tax numbers only when on the document", () => {
  const ids = (edit: (invoice: Json) => void) =>
    view(edit).brand.fields.map((row: Json) => row.label);
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
        invoice.billedBy.vatNumber = "VAT000000000";
      })
    ).toContain("VAT Number");
    expect(
      ids((invoice) => {
        invoice.billedBy.vatNumber = "VAT000000000";
        invoice.billedBy.fieldVisibility = { vat: true };
      })
    ).toContain("VAT Number");
    expect(
      ids((invoice) => {
        invoice.taxType = "UAE";
        invoice.billedBy.vatNumber = "VAT000000000";
        invoice.billedBy.fieldVisibility = { vatNumber: false };
      })
    ).not.toContain("VAT Number");
  });
});

describe("Apex Engineering — unbroken field values", () => {
  it("lets an email or GSTIN carry on from its label and break only at the edge", () => {
    const html = render((invoice) => {
      invoice.billedTo.email = "sample.client@example.com";
    });
    expect(html).toMatch(
      /ax-field-label">Email<\/span> <span class="ax-field-value ax-email ax-break">sample.client@example\.com/
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.ax-field \.ax-field-value\.ax-break \{[^}]*word-break: break-all;/
    );
  });
});

describe("Apex Engineering — rates on the tax and discount rows", () => {
  const labels = (edit?: (invoice: Json) => void) =>
    mapTotals(state(edit)).main.map((row: Json) => row.label);
  it("prints each tax row with its rate: CGST (9%), SGST (9%) for 18% items", () => {
    expect(labels()).toEqual(
      expect.arrayContaining(["CGST (9%)", "SGST (9%)", "Discount (10%)"])
    );
    // The tax amount is the document's own.
    const cgst = mapTotals(state()).main.find((row: Json) =>
      row.key.startsWith("cgst")
    );
    expect(cgst?.value).toBe("₹77,925.89");
  });
  it("IGST shows the whole rate; mixed rates give one row per rate", () => {
    expect(
      labels((invoice) => {
        invoice.igst = true;
        invoice.items.forEach((item: Json) => {
          if (!item.group) item.igst = (item.cgst || 0) + (item.sgst || 0);
        });
        invoice.finalTotal.igst = 155851.78;
      })
    ).toContain("IGST (18%)");
    const mixed = labels((invoice) => {
      invoice.items[1].gstRate = 28;
    });
    expect(mixed).toEqual(expect.arrayContaining(["CGST (9%)", "CGST (14%)"]));
  });
  it("discount rate: the document's own, else the items' shared share, else the effective rate", () => {
    expect(
      discountRate({ finalTotal: { discountPercentage: 10, discount: 5 } })
    ).toBe("10");
    expect(
      discountRate({
        finalTotal: { discount: 50, subTotal: 1000 },
        items: [
          { discount: { amount: 5, discountType: "PERCENTAGE" } },
          { discount: { amount: 5, discountType: "PERCENTAGE" } },
        ],
      })
    ).toBe("5");
    expect(
      discountRate({
        finalTotal: { discount: 1055, subTotal: 10000 },
      })
    ).toBe("10.55");
    expect(discountRate({ finalTotal: {} })).toBe("");
  });
});
