import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/modern-manufacturing-template.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/modern-manufacturing-template/template.hbs";
import {
  batchText,
  photoCap,
  repeatedBandCap,
  buildModernManufacturingView,
  columnNumber,
  formatContext,
  formatDocumentDate,
  formatMoney,
  formatQuantity,
  generateQrDataUrl,
  encodeQrMatrix,
  mapBank,
  mapCompliance,
  mapFooter,
  mapHsnSummary,
  mapBatchSummary,
  mapItemTable,
  mapMeta,
  mapNotes,
  mapAdditionalInfo,
  mapParty,
  amountInCurrencyWords,
  statusTag,
  partyState,
  taxIdShown,
  customFieldText,
  mapPrint,
  printWidth,
  paperHeight,
  mapDocumentScript,
  withDocumentScript,
  loadScriptFont,
  mapSupply,
  mapSettings,
  themeTint,
  mapSignature,
  mapTotals,
  mapTransport,
  transportName,
  staysWhole,
  thumbnailOf,
  mapWords,
  placeOfSupplyText,
  registerModernManufacturingHelpers,
  moneyDigits,
  withMoneyDefaults,
  withRefrensDefaults,
  planTableLayout,
  headerParts,
  qrImage,
  upiIntent,
  unitText,
} from "../src/templates/modern-manufacturing-template/helpers";
import type { ItemColumn } from "../src/templates/modern-manufacturing-template/helpers";
import subtotalPartial from "../src/widgets/subtotal/Subtotal.hbs";
import taxSummaryPartial from "../src/widgets/tax-summary/TaxSummaryTable.hbs";
import paymentTablePartial from "../src/widgets/payment-table/PaymentTable.hbs";
import brandingPartial from "../src/widgets/refrens-branding/RefrensBranding.hbs";
import ceresImagePartial from "../src/widgets/image/CeresImage.hbs";
import ceresImageGalleryPartial from "../src/widgets/image/CeresImageGallery.hbs";
import { computeSubtotalRows } from "../src/widgets/subtotal/utils";
import { computeTaxSummary } from "../src/widgets/tax-summary/utils";
import { computePaymentColumns } from "../src/widgets/payment-table/utils";
import { prepareImageGallery } from "../src/widgets/image/utils";
import registerFormatCurrencyHelper from "../src/widgets/shared/registerFormatCurrencyHelper";
import registerTaxFlagHelpers from "../src/widgets/shared/registerTaxFlagHelpers";
import formatPhoneNumberIntl from "../src/widgets/phone-number";

type Json = Record<string, any>;

const TEMPLATE_DIR = path.join(
  __dirname,
  "../src/templates/modern-manufacturing-template"
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

const ctx = { locale: "en-IN", digits: 2, currency: "INR", symbol: "" };

const column = (key: string, extra: Json = {}): Json => ({
  key,
  label: key,
  ...extra,
});

beforeAll(() => {
  registerModernManufacturingHelpers(HandlebarsRuntime);
  registerFormatCurrencyHelper(HandlebarsRuntime);
  registerTaxFlagHelpers(HandlebarsRuntime);
  // The shared phone-number widget's helper, as it registers itself in the browser.
  HandlebarsRuntime.registerHelper("formatPhoneNumber", (phone: unknown) =>
    phone ? formatPhoneNumberIntl(String(phone)) ?? String(phone) : ""
  );

  HandlebarsRuntime.registerHelper(
    "formateShortDateWithOffset",
    (value: unknown) => `date(${String(value ?? "")})`
  );
  HandlebarsRuntime.registerHelper(
    "formatDateInTimeZone",
    (value: unknown) => `utc(${String(value ?? "")})`
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
  HandlebarsRuntime.registerPartial("Subtotal", subtotalPartial);
  HandlebarsRuntime.registerHelper(
    "computeSubtotalRows",
    (invoice: unknown, options: { hash?: Json }) =>
      computeSubtotalRows(invoice, { columns: options?.hash?.columns })
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
});

describe("Modern Manufacturing template — render", () => {
  it("maps the reference document from the payload", () => {
    const html = render();

    [
      "Vertex Foundry Components",
      "Tax Invoice cum Delivery Challan",
      "ORIGINAL FOR RECIPIENT",
      "VFC/26-27/0156",
      "PO/450789",
      "Order Date",
      "21-Sep-2026",
      "15-Sep-2026",
      "Total Taxable Value (Rs.)",
      "2610 9890 1234",
      "KA01AB1234",
      "Speedway Logistics Pvt Ltd",
      "Maharashtra (27)",
      "Bill To (Buyer)",
      "Ship To (Consignee)",
      "Alpha Engineering Pvt Ltd – Plant 2",
      "Belagavi – 590014, Karnataka, India",
      "B260907",
      "1,03,465.00",
      "9,311.85",
      "1,22,088.70",
      "Grand Total (Rs.)",
      "Beneficiary Name",
      "SBIN0041234",
      "INR ONE LAKH TWENTY-TWO THOUSAND EIGHTY-EIGHT AND SEVENTY PAISE ONLY",
      "Notes",
      "Terms &amp; Conditions",
      "Additional Info",
      "Net 30 days",
      "Test certificate TC-0921.pdf",
      // The HSN summary's Total: each row's tax, as refrens.com prints it.
      "6,401.70",
    ].forEach((expected) => expect(html).toContain(expected));
    // No signature added: no signatory block (user request).
    expect(html).not.toContain('data-section="signature"');
    expect(html).not.toContain("For Vertex Foundry Components");
  });

  it("repeats the letterhead on every printed page unless it is for the first page only", () => {
    const letterheads = (html: string) =>
      (html.match(/data-ceres-height="letterhead"/g) || []).length;
    const everyPage = render((invoice) => {
      invoice.letterHead = "https://cdn.example/head.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: false } };
    });
    expect(everyPage).toMatch(
      /<thead class="mm-page-frame-header">[\s\S]*?src="https:\/\/cdn\.example\/head\.png"/
    );
    expect(letterheads(everyPage)).toBe(1);

    const firstPage = render((invoice) => {
      invoice.letterHead = "https://cdn.example/head.png";
      invoice.template = { pdfOptions: { letterHeadOnFirstPage: true } };
    });
    expect(firstPage).not.toContain("mm-page-frame-header");
    expect(firstPage.indexOf("head.png")).toBeLessThan(
      firstPage.indexOf("mm-page-frame")
    );
    expect(letterheads(firstPage)).toBe(1);
  });

  it("takes Lydia's colour settings: text, page and box backgrounds", () => {
    const styles = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    // Secondary colour → text; primary background → page; secondary background → boxes.
    expect(styles).toContain("--mm-ink: var(--secondary-color, #1a2130);");
    expect(styles).toMatch(/background: var\(--primary-background, #fff\);/);
    [
      ".mm-box",
      ".mm-pair",
      ".mm-summary-row:has(> .mm-bank)",
      ".mm-summary-spacer + .mm-totals",
      ".mm-widget-box",
    ].forEach((selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(styles).toMatch(
        new RegExp(
          `\\n${escaped} \\{[^}]*background: var\\(--secondary-background, transparent\\);`
        )
      );
    });
    // The theme colour: the accent, with the renderer's --primary-color underneath.
    expect(styles).toContain(
      "--mm-accent: var(--mm-theme, var(--primary-color, #013d7f));"
    );
  });

  it("hides every totals row with the totals, additional charges included", () => {
    const html = render((invoice) => {
      invoice.additionalCharges = [
        { _id: "c1", label: "Discounts", amount: -500, multiplier: 1 },
      ];
      invoice.advanceOptions.hideTotals = true;
    });
    const totals = html.slice(html.indexOf('data-section="totals"'));
    const rows = Array.from(
      totals.matchAll(/<tr\s+class="(ceres-subtotal-row[^"]*)"/g),
      (match) => match[1]
    );
    expect(rows.length).toBeGreaterThan(2);
    rows.forEach((row) => expect(row).toContain("is-hidden-by-totals"));
    expect(totals).toContain("Discounts");
    expect(html).not.toContain("data-ceres-subtotal-keep");
    // Shown again with the totals on.
    const shown = render((invoice) => {
      invoice.additionalCharges = [
        { _id: "c1", label: "Discounts", amount: -500, multiplier: 1 },
      ];
    });
    expect(shown).not.toContain("is-hidden-by-totals");
    // With nothing left to show, the box itself goes.
    expect(
      fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8")
    ).toMatch(
      /\.mm-totals:not\(:has\(\.ceres-subtotal-row:not\(\.is-hidden-by-totals, \.is-hidden-by-taxes\), \.mm-words:not\(\.is-hidden-by-totals, \.is-hidden-by-words-setting\)\)\) \{\s*display: none;/
    );
  });

  it("marks the page for the stretched table when the business allows it, whatever the document says", () => {
    const business = (fullHeightTable: unknown) =>
      render((invoice) => {
        invoice.template = { pdfOptions: { fullHeightTable } };
        invoice.owner.configuration = {
          ...invoice.owner.configuration,
          experimental: { stretchInvoiceTable: true },
        };
      });
    [true, false, undefined].forEach((toggle) =>
      expect(business(toggle)).toContain(
        'data-testid="invoice-root" data-mm-stretch-table data-mm-paper-height="1122" dir="ltr"'
      )
    );
    expect(render()).not.toContain("data-mm-stretch-table");
    expect(
      render((invoice) => {
        invoice.template = { pdfOptions: { fullHeightTable: true } };
      })
    ).not.toContain("data-mm-stretch-table");
    // A Pageless document is marked, so the preview leaves its table as it is.
    expect(render()).not.toContain("data-mm-pageless");
    expect(
      render((invoice) => {
        invoice.template = { pdfOptions: { pageless: true } };
      })
    ).toContain("data-mm-pageless");
  });

  it("shows the signatory block once a signature is added", () => {
    const signed = render((invoice) => {
      invoice.signature = "https://cdn.example/sign.png";
    });
    [
      'data-section="signature"',
      "mm-signature-image",
      "For Vertex Foundry Components",
      "Authorised Signatory",
    ].forEach((expected) => expect(signed).toContain(expected));
    // A digital signature counts too, awaiting or signed.
    const digital = render((invoice) => {
      invoice.signatureMethod = "DIGITAL";
    });
    expect(digital).toContain("Awaiting Digital Signature");
    expect(digital).toContain("For Vertex Foundry Components");
  });

  it("ends the banner with the subtitle, after the copy tag", () => {
    const html = render((invoice) => {
      invoice.invoiceSubTitle = "Subtitle";
    });
    const banner = html.slice(
      html.indexOf('data-section="banner"'),
      html.indexOf('data-section="details"')
    );
    expect(banner).toMatch(
      /mm-banner-title" data-role="title">Tax Invoice cum Delivery Challan<\/h2>[\s\S]*mm-copy[\s\S]*<span class="mm-subtitle">Subtitle<\/span>\s*<\/div>/
    );
  });

  it("prints the account's own column labels in the account's order", () => {
    const html = render((invoice) => {
      invoice.columns[0].label = "Part Description";
    });
    const start = html.indexOf('data-testid="items-header"');
    const header = html.slice(start, html.indexOf("</thead>", start));
    const cells = Array.from(
      header.matchAll(/data-col="([^"]+)"[^>]*>([\s\S]*?)<\/th>/g),
      (match) => [
        match[1],
        match[2]
          .replace(/<span class="mm-desc-min"[^>]*><\/span>/, "")
          .replace(/<wbr \/>/g, "")
          .trim(),
      ]
    );
    expect(cells).toEqual([
      ["sr", "Sr."],
      ["desc", "Part Description"],
      ["batch", "Batch"],
      ["hsn", "HSN/SAC"],
      ["qty", "Qty"],
      ["unit", "Unit"],
      ["rate", "Rate"],
      ["tx", "Taxable"],
      ["c", "CGST"],
      ["s", "SGST"],
      ["amt", "Amount"],
    ]);
    // Headers may break after "/" only.
    expect(header).toContain("HSN/<wbr />SAC");
    // Hidden by the account (gstRate) or by normalization (igst, zero discount).
    expect(html).not.toContain(">GST Rate<");
    expect(html).not.toContain(">IGST<");
    expect(html).not.toContain(">Discount<");
  });

  it("puts the sections in the spec's fixed order with their test hooks", () => {
    const html = render((invoice) => {
      invoice.shippedFrom = { name: "Works", city: "Belgaum" };
      invoice.paymentOptions = { accountTransfer: true };
      invoice.signature = "https://cdn.example/sign.png";
    });
    const sections = Array.from(
      html.matchAll(/data-testid="section" data-section="([a-z]+)"/g),
      (match) => match[1]
    );
    expect(sections).toEqual([
      "header",
      "banner",
      "details",
      "parties",
      "dispatch",
      "items",
      "summary",
      "bank",
      "totals",
      "terms",
      "notes",
      "additional",
      "attachments",
      "hsn",
      "signature",
    ]);
    [
      'data-testid="invoice-root"',
      'data-testid="items-scroll"',
      'data-testid="items-table"',
      'data-testid="items-total"',
      'data-testid="signature"',
      'data-pair="parties"',
      'data-pair="dispatch"',
      'data-pair="summary"',
      'data-pair="terms-notes"',
      'data-pair="additional-attachments"',
      'data-role="company-name"',
      'data-role="grand-total"',
      'data-role="tag"',
      'data-role="address"',
      'data-role="ai-label"',
      'data-role="ai-value"',
    ].forEach((hook) => expect(html).toContain(hook));
    expect(html).toMatch(/data-testid="item-row" data-item-index="0"/);
    // The IRN block sits below the dispatch row, above the items.
    expect(html.indexOf('class="mm-box mm-compliance"')).toBeGreaterThan(
      html.indexOf('data-section="dispatch"')
    );
    expect(html.indexOf('class="mm-box mm-compliance"')).toBeLessThan(
      html.indexOf('data-section="items"')
    );
  });

  it("marks a foreign-currency document for the tax summary's words", () => {
    expect(render()).not.toContain("data-mm-currency");
    expect(
      render((invoice) => {
        invoice.currency = "SAR";
      })
    ).toContain('data-mm-currency="SAR"');
    // A currency without known words keeps the widget's line.
    expect(
      render((invoice) => {
        invoice.currency = "XYZ";
      })
    ).not.toContain("data-mm-currency");
  });

  it("prints no title over the details grid (user request)", () => {
    expect(render()).not.toContain("mm-details-title");
    expect(render()).not.toContain(">Invoice Details<");
  });

  it("puts transport in the details grid, or in its own box beside Shipped From", () => {
    // Default (spec v2): the Eway Bill first, then Transporter and Vehicle Number in Refrens'
    // order, in the grid; no dispatch row.
    const html = render();
    const details = html.slice(
      html.indexOf('data-section="details"'),
      html.indexOf('data-section="parties"')
    );
    expect(details).toMatch(
      /2610 9890 1234[\s\S]*Speedway Logistics Pvt Ltd[\s\S]*Vehicle Number[\s\S]*KA01AB1234/
    );
    // Country / Place of Supply have their own row above the items, not grid cells.
    expect(details).not.toContain("Place of Supply");
    expect(details).toContain("--mm-detail-columns: 4");
    expect(html).not.toContain('data-section="dispatch"');

    // transportPosition "section": its own box in the dispatch row.
    const own = render((invoice) => {
      invoice.template = { transportPosition: "Section" };
    });
    const dispatch = own.slice(
      own.indexOf('data-section="dispatch"'),
      own.indexOf('data-section="items"')
    );
    [
      "Transport Details",
      "KA01AB1234",
      "Speedway Logistics Pvt Ltd",
      "2610 9890 1234",
    ].forEach((value) => expect(dispatch).toContain(value));
    const ownDetails = own.slice(
      own.indexOf('data-section="details"'),
      own.indexOf('data-section="parties"')
    );
    expect(ownDetails).not.toContain("KA01AB1234");
    expect(ownDetails).toContain("--mm-detail-columns: 4");

    // With a Shipped From address, transport moves beside it: Shipped From | Transport Details.
    const withFrom = render((invoice) => {
      invoice.shippedFrom = { name: "Dispatch Yard", city: "Belagavi" };
    });
    const fromRow = withFrom.slice(
      withFrom.indexOf('data-section="dispatch"'),
      withFrom.indexOf('data-section="items"')
    );
    expect(fromRow).toMatch(
      /Shipped From[\s\S]*Dispatch Yard[\s\S]*mm-transport[\s\S]*Transport Details[\s\S]*KA01AB1234/
    );
    const fromDetails = withFrom.slice(
      withFrom.indexOf('data-section="details"'),
      withFrom.indexOf('data-section="parties"')
    );
    expect(fromDetails).not.toContain("KA01AB1234");
  });

  it("keeps the live-update hooks the host patches, and renders only sections that are on", () => {
    const html = render((invoice) => {
      invoice.signature = "https://cdn.example/sign.png";
    });
    [
      'data-ceres-height="letterhead"',
      'data-ceres-height="letterhead-footer"',
      'data-ceres-field="irn"',
      'data-ceres-field="qrCode"',
      'data-ceres-field="zatcaQrCode"',
      'data-ceres-field="lhdnQrCode"',
      'data-ceres-field="documentQr"',
      "data-ceres-place-of-supply",
      "data-ceres-hsn-summary",
      "data-ceres-subtotal",
    ].forEach((hook) => expect(html).toContain(hook));
    expect(html).not.toContain("data-ceres-tax-summary");
    expect(html).not.toContain("data-ceres-payment-table");

    const withSummaries = render((invoice) => {
      invoice.advanceOptions.taxSummaryView = "TABLE";
      invoice.allPayments = [{ amount: 100, paymentDate: "2026-09-22" }];
      invoice.advanceOptions.showHsnSummary = false;
    });
    expect(withSummaries).toContain("data-ceres-tax-summary");
    expect(withSummaries).toContain("data-ceres-payment-table");
    expect(withSummaries).not.toContain('data-section="hsn"');

    // The tax summary and payment record sit below the HSN summary, above the signature.
    const allTables = render((invoice) => {
      invoice.advanceOptions.taxSummaryView = "TABLE";
      invoice.allPayments = [{ amount: 100, paymentDate: "2026-09-22" }];
      invoice.signature = "https://cdn.example/sign.png";
    });
    const at = (hook: string) => allTables.indexOf(hook);
    expect(at('data-section="attachments"')).toBeLessThan(
      at('data-section="hsn"')
    );
    expect(at('data-section="hsn"')).toBeLessThan(at("data-ceres-tax-summary"));
    expect(at("data-ceres-tax-summary")).toBeLessThan(
      at("data-ceres-payment-table")
    );
    expect(at("data-ceres-payment-table")).toBeLessThan(
      at('data-section="signature"')
    );
  });

  it("sets the seller's street on its own line above city, state and country", () => {
    const header = render(() => undefined).split("</header>")[0];
    expect(header).toMatch(
      /<p class="mm-seller-street">Plot No\. 42, Industrial Area, Shivanagar<\/p>\s*<p class="mm-seller-region">Belagavi – 590014, Karnataka, India<\/p>/
    );
    const party = mapParty(
      {},
      { name: "Works", city: "Pune", country: "IN" },
      "Shipped From"
    ) as Json;
    expect(party).toMatchObject({ street: "", region: "Pune, India" });
  });

  it("reads the document's language, script and right-to-left setting", () => {
    // Nothing set: left to right, no language, no extra font.
    expect(mapDocumentScript()).toEqual({
      direction: "ltr",
      isRtl: false,
      lang: "",
      font: "",
    });
    // Lydia's "Change Script": Arabic, right to left.
    expect(
      mapDocumentScript({ languageScript: "Arabic", enableRtl: true })
    ).toEqual({
      direction: "rtl",
      isRtl: true,
      lang: "ar",
      font: "Noto Sans Arabic",
    });
    // Codes, picked options and other spellings; a later source wins.
    expect(mapDocumentScript({ language: "hi-IN" })).toMatchObject({
      lang: "hi",
      font: "Noto Sans Devanagari",
    });
    expect(
      mapDocumentScript({ script: { value: "Tamil", label: "Tamil" } })
    ).toMatchObject({ lang: "ta", font: "Noto Sans Tamil" });
    expect(mapDocumentScript({ direction: "RTL" }).isRtl).toBe(true);
    expect(
      mapDocumentScript({ direction: "rtl" }, { isRTL: "false" }).isRtl
    ).toBe(false);
    expect(mapDocumentScript({ rightToLeft: 1 }).direction).toBe("rtl");
    expect(mapDocumentScript({ rtl: 0, direction: "rtl" }).isRtl).toBe(false);
    expect(
      mapDocumentScript({ isRtl: "yes", textDirection: "ltr" }).isRtl
    ).toBe(false);
    // A language Inter covers needs no extra face.
    expect(mapDocumentScript({ language: "English" })).toMatchObject({
      lang: "",
      font: "",
    });

    // The data mapper reads the top-level template before the normalizer drops it.
    const mapped = withDocumentScript(
      { invoice: { template: {} } },
      {
        template: { languageScript: "Hebrew", enableRtl: "true" },
      }
    );
    expect(mapped.documentScript).toMatchObject({ lang: "he", isRtl: true });
    expect(withDocumentScript({}, {})).toEqual({});
    // Outside a browser there is no font to load.
    expect(() => loadScriptFont("Noto Sans Arabic")).not.toThrow();

    // The page takes the direction, language and font; the layout mirrors via logical CSS.
    const html = render((invoice) => {
      invoice.template = { languageScript: "Arabic", enableRtl: true };
    });
    expect(html).toContain(
      '<div class="mm-doc" data-testid="invoice-root" data-mm-paper-height="1122" dir="rtl" lang="ar" style="--mm-text-scale: 1; --mm-print-width: 714px; --mm-browser-print-width: 714px; --mm-photo-cap: 596px; --mm-band-cap: 241px; --mm-script-font: \'Noto Sans Arabic\';'
    );
    expect(render()).toContain(
      'data-testid="invoice-root" data-mm-paper-height="1122" dir="ltr" style='
    );
    const styles = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    expect(styles).toMatch(
      /--mm-font: var\(--subtitle-font, "Inter", sans-serif\), var\(--mm-script-font, sans-serif\);/
    );
    // The riyal sign is drawn (drawRiyalSigns), not set in a font: the renderer blocks data: fonts.
    expect(styles).not.toContain("@font-face");
    expect(styles).toMatch(
      /\.mm-riyal \{\s*display: inline-block;\s*width: 0\.67em;\s*height: 0\.75em;\s*vertical-align: -0\.04em;\s*fill: currentcolor;/
    );
    // Physical sides only where right-to-left pins them (right is the start of an RTL line).
    const outsideRtl = styles.replace(
      /\.mm-doc\[dir="rtl"\][^{]*\{[^}]*\}/g,
      ""
    );
    expect(outsideRtl).not.toMatch(
      /text-align: (left|right);|border-(left|right):|float: (left|right);|border-(top|bottom)-(left|right)-radius/
    );
    // Figures, dates and codes keep their order; "Label: value" lines and labels take the
    // direction of their own text.
    expect(styles).toMatch(
      /\.mm-doc\[dir="rtl"\] :is\(\.mm-num, \.mm-email\) \{\s*direction: ltr;\s*unicode-bidi: isolate;/
    );
    expect(styles).toMatch(
      /\.mm-doc\[dir="rtl"\]\s*:is\([^)]*\.mm-id, \.mm-items th\.mm-col-serial\) \{\s*unicode-bidi: plaintext;/
    );
  });

  it("sets the logo, then the company and its details beside it, the QR alone on the right", () => {
    // Name, then the address, beside the logo, in the brand (user, 2026-10-20).
    const html = render((invoice) => {
      invoice.logo = "https://cdn.example/logo.png";
    });
    expect(html).toMatch(
      /<div class="mm-brand">\s*<div class="mm-logo">[\s\S]*?<\/div>\s*<div class="mm-seller">[\s\S]*?<h1 class="mm-brand-name" data-role="company-name">Vertex Foundry Components<\/h1>\s*<div class="mm-seller-address">/
    );
    expect(html).toMatch(
      /<div class="mm-header-end">\s*<div class="mm-qr mm-header-qr/
    );
    // No logo, no stand-in: the details lead.
    const bare = render((invoice) => {
      invoice.logo = "";
    });
    expect(bare).toMatch(/<div class="mm-brand">\s*<div class="mm-seller">/);
    expect(bare).not.toContain("mm-monogram");
    // A name without seller details still prints.
    const nameOnly = render((invoice) => {
      invoice.billedBy = { name: "Works Only" };
    });
    expect(nameOnly).toMatch(
      /<div class="mm-seller">\s*<h1 class="mm-brand-name" data-role="company-name">Works Only<\/h1>\s*<\/div>/
    );
  });

  it("renders letterhead images, logo, signature and full-width descriptions", () => {
    const html = render((invoice) => {
      invoice.letterHead = "https://cdn.example/head.png";
      invoice.letterHeadFooter = "https://cdn.example/foot.png";
      invoice.logo = "https://cdn.example/logo.png";
      invoice.signature = "https://cdn.example/sign.png";
      invoice.advanceOptions.isDescriptionFullWidth = true;
      invoice.items[0].description = "Machined to drawing";
      invoice.items[0].images = ["https://cdn.example/item.png"];
    });
    expect(html).toContain('src="https://cdn.example/head.png"');
    expect(html).toContain('src="https://cdn.example/foot.png"');
    expect(html).toContain("mm-logo-image");
    expect(html).not.toContain("mm-monogram");
    expect(html).toContain("mm-signature-image");
    expect(html).toMatch(
      /data-testid="item-detail-row" data-item-index="0">\s*<td class="mm-col-serial is-fixed"><\/td>\s*<td colspan="\d+">\s*<div class="mm-item-detail">\s*<div class="mm-item-desc"><div class="md">Machined to drawing/
    );
  });

  it("renders the compliance strip, digital signature states and footer rows", () => {
    const html = render((invoice) => {
      invoice.irn = {
        Irn: "IRN123",
        AckNo: "ACK1",
        AckDt: "2026-09-21 10:00:00",
      };
      invoice.qrCode = "data:image/png;base64,AAAA";
      invoice.signatureMethod = "DIGITAL";
      invoice.contact = { email: "a@b.example", phone: "+91 1" };
      invoice.footers = [{ label: "CIN", value: "U12345" }];
      invoice.items[0].description = "inline note";
      invoice.items[0].thumbnail = "https://cdn.example/t.png";
      invoice.advanceOptions.showThumbnailAsColumn = true;
      invoice.items.splice(1, 0, { name: "Castings", group: true });
    });
    expect(html).toContain('data-ceres-field="irn">IRN123</span>');
    // IRN, Ack No. and Ack Date one a line, each name in a column, like the other boxes.
    expect(html).toMatch(
      /<div class="mm-field mm-irn-row"><span class="mm-label">IRN No.<\/span><span class="mm-value mm-irn-value" data-ceres-field="irn">IRN123<\/span><\/div>\s*<div class="mm-field"><span class="mm-label">Ack No\.<\/span><span class="mm-value mm-num" data-testid="num">ACK1<\/span><\/div>\s*<div class="mm-field"><span class="mm-label">Ack Date<\/span>/
    );
    expect(html).toContain("21-Sep-2026");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain("Awaiting Digital Signature");
    // A footer field prints in Additional Info, not under the signature.
    const info = html.slice(html.indexOf('data-section="additional"'));
    expect(info.slice(0, info.indexOf("</section>"))).toMatch(
      /data-role="ai-label">CIN<\/span>\s*<span class="mm-info-value" data-role="ai-value">U12345</
    );
    expect(html.slice(html.indexOf('data-section="signature"'))).not.toContain(
      "U12345"
    );
    expect(html).toContain("a@b.example");
    expect(html).toContain('<div class="md">inline note</div>');
    expect(html).toContain("mm-thumbnail");
    expect(html).toContain('<tr class="mm-group-row">');

    const signed = render((invoice) => {
      invoice.signatureMethod = "DIGITAL";
      invoice.documentSignatureRequest = {
        status: "SIGNED",
        signers: [{ signerName: "R. Rao" }],
      };
      invoice.share = { pdf: "https://cdn.example/signed.pdf" };
    });
    expect(signed).toContain("Digitally signed");
    expect(signed).toContain("R. Rao");
  });

  it("renders the IGST variant of the summary and drops sections that are off", () => {
    const html = render((invoice) => {
      invoice.igst = true;
      invoice.hsnSummary.hsnList = invoice.hsnSummary.hsnList.map(
        (row: Json) => ({
          ...row,
          igstRate: 18,
          igstAmount: row.cgstAmount * 2,
          totalCessAmount: 1,
          taxAmount: row.cgstAmount * 2 + 1,
        })
      );
      invoice.columns = invoice.columns.filter((c: Json) => c.key !== "name");
      invoice.bankAccount = undefined;
      invoice.notes = "";
      invoice.terms = [];
      invoice.billedTo = {};
      invoice.shippedTo = {};
      invoice.transportDetails = {};
      invoice.irn = {};
      invoice.invoiceTitle = "";
      invoice.copy = "";
    });
    // The bank slot stays, empty, so totals keep the right half (spec C3).
    expect(html).toContain("mm-summary-spacer");
    expect(html).not.toContain('data-section="bank"');
    expect(html).not.toContain('data-section="banner"');
    expect(html).not.toContain('data-section="terms"');
    expect(html).not.toContain('data-section="declaration"');
    expect(html).not.toContain('data-section="parties"');
    expect(html).not.toContain('data-section="dispatch"');
    expect(html).toMatch(
      /<td class="mm-col-serial is-fixed" data-col="sr">Total<\/td>/
    );
    expect(html).toContain(">IGST</th>");
  });
});

describe("Modern Manufacturing template — no hardcoded document data", () => {
  it("keeps sample values from the reference design out of the source", () => {
    const source = ["template.hbs", "helpers.ts", "styles.css"]
      .map((file) => fs.readFileSync(path.join(TEMPLATE_DIR, file), "utf8"))
      .join("\n");
    [
      "Vertex",
      "Alpha Engineering",
      "Belagavi",
      "SBIN",
      "Speedway",
      "VFC/",
      "Tax Invoice cum",
      "ORIGINAL FOR",
      "Beneficiary",
      "Declaration",
    ].forEach((sample) => expect(source).not.toContain(sample));
  });

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
});

describe("Modern Manufacturing template — view model", () => {
  it("prints document dates as DD-Mon-YYYY in the business's offset", () => {
    // Zone-less values are already local (including the IST-encoded IRN timestamps).
    expect(formatDocumentDate("2026-09-21")).toBe("21-Sep-2026");
    expect(formatDocumentDate("2026-09-21 23:50:00", "-05:00")).toBe(
      "21-Sep-2026"
    );
    // An instant shifts into the offset: IST by default, else the one given.
    expect(formatDocumentDate("2026-09-20T18:30:00.000Z")).toBe("21-Sep-2026");
    expect(formatDocumentDate("2026-09-20T18:30:00.000Z", "-04:00")).toBe(
      "20-Sep-2026"
    );
    expect(formatDocumentDate("2026-09-20T18:30:00+00:00", "+0530")).toBe(
      "21-Sep-2026"
    );
    expect(formatDocumentDate(Date.UTC(2026, 0, 5, 12), 0)).toBe("05-Jan-2026");
    // An offset without minutes ("+6") is whole hours.
    expect(formatDocumentDate("2026-09-20T18:30:00.000Z", "+6")).toBe(
      "21-Sep-2026"
    );
    expect(formatDocumentDate("2026-09-20T18:30:00.000Z", "IST")).toBe(
      "21-Sep-2026"
    );
    expect(formatDocumentDate("")).toBe("");
    expect(formatDocumentDate(undefined)).toBe("");
    expect(formatDocumentDate("next Monday")).toBe("next Monday");
  });

  it("prints the widget's totals with the currency symbol, and no Round Off", () => {
    // The fixture carries totalRoundOff: 0 and a roundOff label; neither prints a row.
    const totals = mapTotals(state());
    expect(totals.main.map((row) => `${row.label}=${row.value}`)).toEqual([
      "Total Taxable Value (Rs.)=₹1,03,465.00",
      "CGST (Rs.)=₹9,311.85",
      "SGST (Rs.)=₹9,311.85",
      "Grand Total (Rs.)=₹1,22,088.70",
    ]);

    const rich = mapTotals(
      state((invoice) => {
        delete invoice.finalTotal.totalRoundOff;
        invoice.finalTotal.amountRoundOff = -0.3;
        invoice.customLabels = {};
        invoice.additionalCharges = [
          {
            _id: "c1",
            label: "Freight",
            amount: 100,
            multiplier: 1,
            tax: 18,
            taxAmount: 18,
            cgst: 9,
            sgst: 9,
          },
        ];
        // A charge with its own tax arrives as a flagged line item.
        invoice.items.push({
          _id: "tc",
          name: "Packing",
          isAdditionalCharge: true,
          rate: 200,
          igst: 36,
          gstRate: 18,
          hsn: "9985",
        });
        invoice.extraTotalFields = [
          { label: "DL No.", value: "MH-12 ₹ free text" },
        ];
        invoice.balance = { paid: 1000, due: 500 };
      })
    );
    // A foreign-currency document with "Show Applied Exchange Rate" on: every figure carries
    // its currency and decimals, the business-currency line follows, and the rate reads
    // "BGN 1 = ₹57.22".
    const foreign = (showExchangeRateOnPdf?: boolean) =>
      mapTotals(
        state((invoice) => {
          invoice.currency = "BGN";
          delete invoice.subUnitLength;
          invoice.conversionRates = { INR: 57.22 };
          invoice.owner.currency = "INR";
          invoice.finalTotal.total = 625975;
          invoice.balance = { paid: 1000, due: 500 };
          invoice.advanceOptions.showExchangeRateOnPdf = showExchangeRateOnPdf;
        })
      );
    const bgn = foreign(true);
    const grand = bgn.main.find((row) => row.key === "total");
    expect(grand?.value).toBe("BGN\u00a06,25,975.00");
    expect(grand?.converted).toBe("₹3,58,18,289.50");
    expect(bgn.main.find((row) => row.key === "conversionRate")?.value).toBe(
      "BGN\u00a01 = ₹57.22"
    );
    // Off (refrens.com's default): the document's currency only, and no rate row.
    const plain = foreign(undefined);
    expect(plain.main.find((row) => row.key === "total")?.converted).toBeNull();
    expect(plain.main.some((row) => row.key === "conversionRate")).toBe(false);
    expect(plain.due.every((row) => row.converted === null)).toBe(true);
    // A non-zero round-off is already in the total: still no row of its own.
    expect(rich.main.some((row) => row.key === "roundOff")).toBe(false);
    expect(rich.main[rich.main.length - 1].key).toBe("total");
    // Free text keeps every character; money rows keep their currency symbol.
    expect(rich.extra[0].value).toBe("MH-12 ₹ free text");
    expect(rich.due.map((row) => row.value)).toEqual([
      "(₹1,000.00)",
      "₹500.00",
    ]);
    const charge = rich.main.find((row) => row.key.startsWith("charge:"));
    expect(charge?.value).toBe("₹100.00");
    const taxed = rich.main.find((row) => row.key === "taxedCharge:tc");
    expect(taxed?.value).toBe("₹200.00");
    expect(taxed?.extra?.value).toBe("₹36.00");
  });

  it("formats money, quantities and the context", () => {
    // The shared formatCurrency: the document's symbol, grouping and decimal places.
    expect(formatMoney("", ctx)).toBe("");
    expect(formatMoney(-1234.5, ctx)).toBe("(₹1,234.50)");
    expect(formatMoney("100000", ctx)).toBe("₹1,00,000.00");
    expect(formatMoney(625975, ctx)).toBe("₹6,25,975.00");
    expect(formatMoney(625975, { ...ctx, currency: "BGN" })).toBe(
      "BGN\u00a06,25,975.00"
    );
    expect(formatMoney(12.5, { ...ctx, symbol: "Rs." })).toBe("Rs. 12.50");
    expect(formatMoney(7, { ...ctx, digits: 0 })).toBe("₹7");
    // An invalid locale falls back to the currency code and fixed decimals.
    expect(formatMoney(5, { ...ctx, locale: "en_IN" })).toBe("INR 5.00");
    expect(formatQuantity(null, ctx)).toBe("");
    expect(formatQuantity(1250.5, ctx)).toBe("1,250.5");
    // An invalid locale falls back to fixed decimals instead of throwing.
    expect(formatQuantity(5, { ...ctx, locale: "en_IN" })).toBe("5");
    expect(formatQuantity(2.25, { ...ctx, locale: "en_IN" })).toBe("2.25");
    expect(
      formatContext({
        subUnitLength: 3,
        locale: "en-US",
        currency: "BGN",
        customCurrencySymbol: "лв",
      })
    ).toEqual({ locale: "en-US", digits: 3, currency: "BGN", symbol: "лв" });
    expect(
      formatContext({ subUnitLength: 1.5, owner: { locale: "de-DE" } })
    ).toEqual({ locale: "de-DE", digits: 2, currency: "INR", symbol: "" });
    expect(formatContext({})).toEqual({
      locale: "en-IN",
      digits: 2,
      currency: "INR",
      symbol: "",
    });
    // The data mapper makes the decimal places explicit for the shared widgets.
    expect(moneyDigits({ subUnitLength: 0 })).toBe(0);
    expect(moneyDigits({ subUnitLength: -1 })).toBe(2);
    const bare: Json = { invoice: { currency: "BGN" } };
    expect(withMoneyDefaults(bare).invoice.subUnitLength).toBe(2);
    const set: Json = { invoice: { subUnitLength: 3 } };
    expect(withMoneyDefaults(set).invoice.subUnitLength).toBe(3);
    expect(withMoneyDefaults({ other: 1 })).toEqual({ other: 1 });
  });

  it("shows units in their own column unless the document chose otherwise", () => {
    const options = (advanceOptions?: Json) =>
      (withRefrensDefaults({ invoice: { advanceOptions } }) as Json).invoice
        .advanceOptions;
    expect(options(undefined).unitColumn).toBe("SEPARATE_COLUMN");
    expect(options({ unitColumn: "MERGE_QUANTITY" }).unitColumn).toBe(
      "MERGE_QUANTITY"
    );
    expect(options({ showUnitInName: true }).unitColumn).toBeUndefined();
    // A bare invoice (not wrapped in { invoice }) too.
    expect(
      (withRefrensDefaults({ items: [] }) as Json).advanceOptions.unitColumn
    ).toBe("SEPARATE_COLUMN");
    // Rendered: "2" under Quantity and "KGS" in a Unit column, not "2 KGS".
    const html = template(
      normalizeInvoiceTemplateState(
        withRefrensDefaults(
          payload((invoice) => {
            invoice.advanceOptions = {};
            invoice.items[0].unit = "KGS";
          })
        ) as never
      )
    );
    expect(html).toContain('data-col="unit"');
  });

  it("labels every country's tax number and the responsible person", () => {
    const lines = (invoice: Json, party: Json) =>
      (
        mapParty(invoice, { name: "Buyer", ...party }, "Billed To") as Json
      ).lines.map((line: Json[]) =>
        line.map((item) => `${item.label}=${item.value}`)
      );
    expect(
      lines(
        {},
        {
          country: "BG",
          vatNumber: "BG1",
          trnNumber: "T1",
          tinNumber: "N1",
          sstNumber: "S1",
          taxId: "X1",
          contactPerson: { name: "Mr. Svetoslav Vasilev Totev" },
          additionalIds: [{ label: "ID No.", value: "104000194" }],
        }
      )
    ).toEqual([
      // The tax numbers share their line, as GSTIN | PAN always has.
      ["VAT Number=BG1", "TRN=T1", "TIN=N1", "SST=S1", "Tax ID=X1"],
      // The responsible person leads the party's own fields, two to a line.
      ["Responsible Person=Mr. Svetoslav Vasilev Totev", "ID No.=104000194"],
    ]);
    // Labels are editable; a name already printed as one of the party's fields is not repeated.
    expect(
      lines(
        { customLabels: { trn: "TRN No.", contactPerson: "Contact" } },
        { country: "AE", trnNumber: "T1", contactPerson: { name: "Asha" } }
      )
    ).toEqual([["TRN No.=T1"], ["Contact=Asha"]]);
    expect(
      lines(
        { customLabels: { responsiblePerson: "МОЛ" } },
        { contactPerson: { name: "Asha" } }
      )
    ).toEqual([["МОЛ=Asha"]]);
    // Business profiles key their custom fields by id instead of listing them.
    expect(
      lines(
        {},
        {
          contactPerson: { name: "Martin Petkov" },
          customFields: {
            yzkv6khclts: {
              label: "Responsible Person",
              value: "martin petkov",
            },
          },
        }
      )
    ).toEqual([["Responsible Person=martin petkov"]]);
  });

  it("prints the MSIC column and the note's reason as refrens.com does", () => {
    const keys = (billType: string, hidden = false) =>
      (
        mapItemTable(
          state((invoice) => {
            invoice.billType = billType;
            invoice.columns.push({
              key: "msic",
              label: "MSIC",
              isHidden: hidden,
            });
          }),
          ctx
        ).header as Json[]
      ).map((cell) => cell.key);
    // A column like any other on challans, quotations and notes; never on invoices,
    // proformas or sales orders; and not once the business hid it.
    expect(keys("DELIVERYCHALLAN")).toContain("msic");
    expect(keys("CREDITNOTE")).toContain("msic");
    expect(keys("INVOICE")).not.toContain("msic");
    expect(keys("SALESORDER")).not.toContain("msic");
    expect(keys("QUOTATION", true)).not.toContain("msic");
    // No item with a unit: no Unit column.
    const noUnit = mapItemTable(
      state((invoice) => {
        invoice.items.forEach((item: Json) => {
          delete item.unit;
        });
        invoice.advanceOptions.unitDisplayType = "SEPARATE_COLUMN";
      }),
      ctx
    );
    expect((noUnit.header as Json[]).map((cell) => cell.key)).not.toContain(
      "unit"
    );
    // A credit or debit note's reason, among the document details.
    const meta = mapMeta(
      state((invoice) => {
        invoice.documentReason = "Product Return";
      }),
      []
    );
    expect(meta.find((row) => row.key === "documentReason")).toMatchObject({
      label: "Reason",
      value: "Product Return",
    });
  });

  it("tags the document's status as refrens.com does", () => {
    const tag = (invoice: Json) => statusTag(invoice)?.text ?? null;
    expect(tag({ billType: "INVOICE", status: "DRAFT" })).toBe("Draft");
    expect(tag({ billType: "INVOICE", status: "CANCELED" })).toBe("Canceled");
    expect(tag({ billType: "QUOTATION", status: "CANCELLED" })).toBe(
      "Cancelled"
    );
    expect(tag({ billType: "INVOICE", status: "PAID" })).toBe("Paid");
    expect(tag({ billType: "PROFORMAINV", status: "PARTIAL" })).toBe(
      "Part Paid"
    );
    expect(tag({ billType: "DEBITNOTE", status: "PARTIALLY_PAID" })).toBe(
      "Part Paid"
    );
    expect(tag({ billType: "INVOICE", status: "UNPAID" })).toBeNull();
    expect(tag({ billType: "QUOTATION", status: "OPEN" })).toBe("Created");
    expect(
      tag({ billType: "DELIVERYCHALLAN", reminders: { views: [{ open: 0 }] } })
    ).toBe("Delivery Challan Sent");
    expect(
      tag({ billType: "PURCHASEORDER", reminders: { views: [{ open: 2 }] } })
    ).toBe("Purchase Order Seen");
    expect(tag({ billType: "CREDITNOTE", creditNoteStatus: "ISSUED" })).toBe(
      "Issued"
    );
    expect(
      tag({
        billType: "CREDITNOTE",
        creditNoteStatus: "ISSUED",
        isOverdue: true,
      })
    ).toBeNull();
    expect(tag({ billType: "CREDITNOTE", creditNoteStatus: "PARTIAL" })).toBe(
      "Partially Utilised"
    );
    expect(tag({ billType: "CREDITNOTE", creditNoteStatus: "REDEEMED" })).toBe(
      "Redeemed"
    );
    expect(tag({ billType: "SALESORDER", status: "OPEN" })).toBeNull();
    // On the title bar after the title and its copy tag (user request); on paper only when
    // the document asks for it.
    const html = render((invoice) => {
      invoice.status = "PAID";
    });
    expect(html).toMatch(
      /<h2 class="mm-banner-title"[^>]*>[^<]*<\/h2>\s*<span class="mm-copy" data-role="tag">[^<]*<\/span>\s*<span class="mm-status( no-print)?"><span class="invoice-tag success">Paid<\/span><\/span>/
    );
  });

  it("prints a party's fields as refrens.com does", () => {
    const party = (fields: Json, billing = true) =>
      mapParty({}, { name: "P", ...fields }, "Billed To", billing) as Json;
    // The state of the GST state code, over the stored state.
    expect(partyState({ state: "Maharashtra", gstState: "24" })).toBe(
      "Gujarat"
    );
    expect(partyState({ state: "Kerala", gstState: "" })).toBe("Kerala");
    expect(partyState({ state: "Kerala", gstState: "25" })).toBe("Kerala");
    expect(
      party({
        city: "Mumbai",
        state: "Maharashtra",
        gstState: "24",
        country: "IN",
      }).address
    ).toBe("Mumbai, Gujarat, India");
    expect(party({ country: "US" }).address).toBe(
      "United States of America (USA)"
    );
    // GSTIN / PAN off for a billing party abroad; kept for a shipping address.
    expect(party({ country: "US", gstin: "G1", panNumber: "P1" }).ids).toEqual(
      []
    );
    expect(party({ country: "US", gstin: "G1" }, false).ids).toEqual([
      { key: "gstin", label: "GSTIN", value: "G1" },
    ]);
    // VAT: shown abroad, off in India, and any switch wins.
    expect(taxIdShown({}, { country: "AE" }, ["vat"])).toBe(true);
    expect(taxIdShown({}, { country: "IN" }, ["vat"])).toBe(false);
    expect(
      taxIdShown({}, { country: "IN", vatShowInInvoice: true }, ["vat"])
    ).toBe(true);
    expect(taxIdShown({}, { country: "AE", hideVat: true }, ["vat"])).toBe(
      false
    );
    expect(
      taxIdShown(
        {},
        { country: "AE", fieldVisibility: { vat: { showInDocument: false } } },
        ["vat"]
      )
    ).toBe(false);
    expect(
      taxIdShown(
        {
          owner: {
            configuration: {
              experimental: { fieldVisibility: { vatNumber: true } },
            },
          },
        },
        { country: "IN" },
        ["vat", "vatNumber"]
      )
    ).toBe(true);
    expect(taxIdShown({}, { country: "" }, ["vat"])).toBe(false);
    // Custom field values: picked options by label, lists joined, yes / no.
    expect(customFieldText([{ label: "Option 1" }, "Option 2", {}])).toBe(
      "Option 1, Option 2"
    );
    expect(customFieldText({ value: "Option 3" })).toBe("Option 3");
    expect(customFieldText(true)).toBe("Yes");
    expect(customFieldText(false)).toBe("No");
    expect(customFieldText("plain")).toBe("plain");
    expect(
      party({
        customFields: [
          { label: "newtest", value: [{ label: "Option 1", value: "o1" }] },
        ],
      }).lines
    ).toEqual([
      [expect.objectContaining({ label: "newtest", value: "Option 1" })],
    ]);
    // Phone numbers in Refrens' spacing (the shared phone-number widget).
    const html = render((invoice) => {
      invoice.billedTo.phone = "+919876543210";
      invoice.billedTo.phoneShowInInvoice = true;
    });
    expect(html).toContain("+91 98765 43210");
  });

  it("maps parties with every optional identifier and visibility flag", () => {
    const invoice = {
      owner: {
        configuration: {
          experimental: { fieldVisibility: { pan: { showInDocument: false } } },
        },
      },
    };
    expect(mapParty(invoice, {}, "Billed To")).toBeNull();

    const party = mapParty(
      invoice,
      {
        name: "Buyer",
        address: "Unit 4",
        building: "Tower B",
        street: "Ring Road",
        city: "Pune",
        district: "Pune",
        zipCode: "411001",
        state: "MH",
        country: "India",
        gstin: "27ABC",
        panNumber: "ABCDE",
        vatNumber: "VAT-1",
        phone: "+91 1",
        phoneShowInInvoice: false,
        email: "b@example.com",
        contactPerson: { name: "Asha" },
        additionalIds: [
          { label: "CIN", value: "C1" },
          { label: "Hidden", value: "H", showInInvoice: false },
        ],
        customFields: [
          { name: "Vendor Code", value: "V9" },
          { label: "Off", value: "X", params: { showInInvoice: "false" } },
          { label: "Empty", value: "" },
        ],
        customHeaders: [
          { label: "Region", value: "West" },
          { label: "Gone", value: "G", showInInvoice: false },
        ],
      },
      "Billed To"
    ) as Json;

    expect(party.address).toBe(
      "Unit 4, Tower B, Ring Road, Pune – 411001, MH, India"
    );
    // An Indian party's VAT number stays off, as on refrens.com.
    expect(party.ids).toEqual([
      { key: "gstin", label: "GSTIN", value: "27ABC" },
    ]);
    expect(party.contacts).toEqual([
      { key: "email", label: "Email", value: "b@example.com", isNum: false },
    ]);
    expect(party.extras.map((row: Json) => row.label)).toEqual([
      "CIN",
      "Vendor Code",
      "Region",
    ]);
    // One kind of line for all of them: ids, contacts, then the responsible person (a
    // labelled field, user request) and the party's own fields two a line, in the order filled.
    expect(
      party.lines.map((line: Json[]) =>
        line.map((item) => `${item.label}=${item.value}`)
      )
    ).toEqual([
      ["GSTIN=27ABC"],
      ["Email=b@example.com"],
      ["Responsible Person=Asha", "CIN=C1"],
      ["Vendor Code=V9", "Region=West"],
    ]);
    // An email breaks only when its box is too narrow; figures and one-word values never wrap.
    expect(party.lines[1][0]).toMatchObject({
      isNum: false,
      noWrap: false,
      isEmail: true,
    });
    expect(party.lines[2][1]).toMatchObject({ isNum: true, noWrap: true });
    expect(party.lines[0][0]).toMatchObject({ noWrap: true });
    // A tax number typed with spaces wraps at them instead of running out of its box.
    const spaced = mapParty(
      {},
      { name: "B", gstin: "27ABC", panNumber: "GKYP efv 7729A" },
      "Billed To"
    ) as Json;
    expect(
      spaced.lines[0].map((item: Json) => [item.label, item.noWrap])
    ).toEqual([
      ["GSTIN", true],
      ["PAN", false],
    ]);

    const other = mapParty(
      {},
      {
        name: "Seller",
        district: "Haveli",
        city: "Pune",
        pincode: 411001,
        country: "AE",
        gstin: "G",
        fieldVisibility: { gst: false },
        vatNumber: "TRN",
        vatLabel: "TRN",
        emailShowInInvoice: false,
        email: "x@example.com",
      },
      ""
    ) as Json;
    expect(other.address).toBe("Pune – 411001, Haveli, United Arab Emirates");
    expect(other.ids).toEqual([
      { key: "vatNumber", label: "TRN", value: "TRN" },
    ]);
    expect(other.contacts).toEqual([]);
    expect(party.hasIdLines).toBe(true);
    // One party field a line, in order, its name in a column before its value: GSTIN, then
    // Phone (user, 2026-10-28).
    const html = render((doc) => {
      doc.billedTo.phone = "+91 1";
    });
    const bill = html.slice(html.indexOf("is-bill-to"));
    expect(bill).toMatch(
      /<div class="mm-party-fields">\s*<div class="mm-field"><span class="mm-label">GSTIN<\/span><span class="mm-value[\s\S]*<div class="mm-field"><span class="mm-label">Phone<\/span><span class="mm-value/
    );

    // Party fields read like GSTIN / PAN: a date is formatted, a sentence wraps.
    const fields = render((doc) => {
      doc.billedTo.customFields = [
        { label: "date", value: "2026-10-12T18:30:00.000Z", dataType: "date" },
        { label: "Note", value: "Gate 2 after noon" },
      ];
    });
    const fieldsBox = fields.slice(fields.indexOf("is-bill-to"));
    expect(fieldsBox).toContain(
      '<div class="mm-field"><span class="mm-label">date</span><span class="mm-value mm-num" data-testid="num">13-Oct-2026</span></div>'
    );
    expect(fieldsBox).toContain(
      '<div class="mm-field"><span class="mm-label">Note</span><span class="mm-value">Gate 2 after noon</span></div>'
    );
    // The header: one field a line, its name in a column, as in the party boxes.
    const header = fields.slice(0, fields.indexOf("</header>"));
    expect(header).toContain(
      '<div class="mm-field"><span class="mm-label">Phone</span><span class="mm-value mm-num" data-testid="num">\u2066+91 831 298 7000\u2069</span></div>'
    );
    expect(header).toContain(
      '<div class="mm-field"><span class="mm-label">Email</span><span class="mm-value mm-email">sales@vertexfoundry.com</span></div>'
    );
  });

  it("formats the place of supply from the same raw value as the normalizer", () => {
    expect(placeOfSupplyText({ placeOfSupply: "27" })).toBe("Maharashtra (27)");
    expect(placeOfSupplyText({ placeOfSupply: "27-Maharashtra" })).toBe(
      "Maharashtra (27)"
    );
    expect(placeOfSupplyText({ placeOfSupply: "98" })).toBe("98");
    expect(placeOfSupplyText({ placeOfSupply: "Gujarat" })).toBe("Gujarat");
    expect(
      placeOfSupplyText({
        placeOfSupply: "27",
        countryOfSupply: "AE",
        billedTo: { state: "Dubai" },
      })
    ).toBe("Dubai");
  });

  it("shows Country / Place of Supply from the buyer unless the document hides them", () => {
    const supply = (edit: (invoice: Json) => void): Json => {
      const model = mapSupply(state(edit));
      return {
        row: !model.hidden,
        ...Object.fromEntries(
          model.rows.map((cell) => [cell.key, [cell.value, !cell.isHidden]])
        ),
      };
    };
    // No countryOfSupply on the document: the buyer's country; shown by default.
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
      })
    ).toEqual({
      row: true,
      countryOfSupply: ["India", true],
      placeOfSupply: ["Maharashtra (27)", true],
    });
    // Refrens' one toggle ("Show Place/Country Of Supply" off → hideCountryOfSupply) hides
    // the whole row: Place of Supply included.
    expect(
      supply((invoice) => {
        invoice.advanceOptions.hideCountryOfSupply = true;
      }).row
    ).toBe(false);
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.advanceOptions.showCountryOfSupply = "true";
        invoice.hideCountryOfSupply = true;
      }).row
    ).toBe(true);
    // Place of Supply's own keys and the field settings act on their cell.
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.hidePlaceOfSupply = true;
      })
    ).toEqual({
      row: true,
      countryOfSupply: ["India", true],
      placeOfSupply: ["Maharashtra (27)", false],
    });
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.advanceOptions.showPlaceOfSupply = false;
      }).placeOfSupply
    ).toEqual(["Maharashtra (27)", false]);
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.invoiceValueProps = {
          CountryOfSupply: false,
          placeOfSupply: { visible: "false" },
        };
      })
    ).toEqual({
      row: true,
      countryOfSupply: ["India", false],
      placeOfSupply: ["Maharashtra (27)", false],
    });
    expect(
      supply((invoice) => {
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.invoiceValueProps = {
          countryOfSupply: { showInInvoice: true },
          placeOfSupply: { other: 1 },
        };
      })
    ).toEqual({
      row: true,
      countryOfSupply: ["India", true],
      placeOfSupply: ["Maharashtra (27)", true],
    });

    // Under Shipped To only (user decision), Place first; the live toggles target the block
    // (the shared toggle) and the Place of Supply line; hidden parts stay in the page for them.
    const html = render();
    const shipTo = html.slice(html.indexOf("Ship To (Consignee)"));
    const block = shipTo.slice(
      shipTo.indexOf('<div class="mm-party-supply"'),
      shipTo.indexOf("</div>", shipTo.indexOf('<div class="mm-party-supply"'))
    );
    expect(block).toMatch(
      /^<div class="mm-party-supply" data-ceres-country-of-supply>\s*<div class="mm-field" data-ceres-place-of-supply><span class="mm-label">Place of Supply<\/span><span class="mm-value">Maharashtra \(27\)<\/span>/
    );
    expect(html.slice(0, html.indexOf("Ship To (Consignee)"))).not.toContain(
      "mm-party-supply"
    );
    expect(
      render((invoice) => {
        invoice.advanceOptions.hideCountryOfSupply = true;
      })
    ).toContain(
      '<div class="mm-party-supply" data-ceres-country-of-supply style="display:none">'
    );
    // No shipping address: neither line prints.
    expect(
      render((invoice) => {
        invoice.shippedTo = null;
      })
    ).not.toContain("Place of Supply");
    // No value anywhere: no row.
    expect(
      mapSupply(
        state((invoice) => {
          invoice.placeOfSupply = "";
          invoice.billedTo = { name: "X" };
        })
      ).show
    ).toBe(false);
  });

  it("builds the meta grid from present values only, honouring settings", () => {
    const meta = mapMeta(
      state((invoice) => {
        invoice.dueDate = "2026-10-21";
        invoice.customHeaders = [{ label: "Indent", value: "IND-7" }];
        invoice.transportDetails = {
          challanNumber: "CH-1",
          challanDate: "2026-09-20",
          vehicleType: "Truck",
          transport: "Road",
          transporterName: "Fallback Carrier",
          transporterId: "TID",
          distance: 120,
          transactionType: "Regular",
          subSupplyDesc: "Job work",
          extraInformation: "Fragile",
        };
        invoice.irn = {
          EwbNo: "E1",
          EwbDt: "2026-09-21",
          EwbValidTill: "2026-09-25",
          ewayCancelDate: "2026-09-22",
        };
        invoice.countryOfSupply = "IN";
        delete invoice.advanceOptions.hideCountryOfSupply;
        invoice.reverseCharge = true;
      }),
      [
        {
          key: "vehicleNumber",
          label: "Vehicle No.",
          value: "KA01",
          isNum: true,
        },
      ]
    );
    const byKey = Object.fromEntries(meta.map((row) => [row.key, row]));
    expect(byKey.dueDate.isDate).toBe(true);
    expect(byKey.customHeader.value).toBe("IND-7");
    // Document custom fields go to Additional Info, not the grid.
    expect(byKey.customField).toBeUndefined();
    // Transport rows passed in follow the document's fields; supply fields are not here.
    expect(byKey.vehicleNumber.isNum).toBe(true);
    expect(meta.map((row) => row.key).slice(-2)).toEqual([
      "vehicleNumber",
      "reverseCharge",
    ]);
    expect(byKey.countryOfSupply).toBeUndefined();
    expect(byKey.placeOfSupply).toBeUndefined();
    expect(byKey.reverseCharge.value).toBe("Yes");

    const off = mapMeta(
      state((invoice, root) => {
        invoice.irn = {
          EwbNo: "E1",
          EwbDt: "d",
          EwbValidTill: "v",
          ewayCancelDate: "c",
        };
        root.ewayConfig = {
          billNumber: false,
          billDate: false,
          billValidTillDate: false,
          billCancelledDate: false,
        };
        invoice.advanceOptions.reverseCharge = true;
        invoice.advanceOptions.hidePlaceOfSupply = true;
      }),
      []
    );
    expect(off.find((row) => row.key === "reverseCharge")).toBeDefined();
    // hidePlaceOfSupply hides the supply-row cell (the grid never has it).
    expect(
      mapSupply(
        state((invoice) => {
          invoice.advanceOptions.hidePlaceOfSupply = true;
        })
      ).rows.find((row) => row.key === "placeOfSupply")?.isHidden
    ).toBe(true);
  });

  it("maps transport details into their own card, present values only", () => {
    const card = mapTransport(
      state((invoice) => {
        invoice.customLabels.transport = "Dispatch";
        invoice.transportDetails = {
          challanNumber: "CH-1",
          challanDate: "2026-09-20",
          vehicleType: "OVERDIMENSIONALCARGO",
          transport: "ROAD",
          transporterName: "Fallback Carrier",
          transporterId: "TID",
          distance: 120,
          transactionType: "Regular",
          subSupplyDesc: "Job work",
          extraInformation: "Fragile",
        };
      })
    );
    expect(card?.title).toBe("Dispatch");
    const byKey = Object.fromEntries(
      (card?.rows || []).map((row) => [row.key, row])
    );
    expect(byKey.challanDate.isDate).toBe(true);
    expect(byKey.transportMode.value).toBe("Road");
    expect(byKey.transportName.value).toBe("Fallback Carrier");
    expect(byKey.transporterId.value).toBe("TID");
    expect(byKey.distance).toMatchObject({ label: "Distance", value: "120" });
    // Codes print as Refrens names them.
    expect(byKey.vehicleType.value).toBe("Over Dimensional Cargo");
    // The e-way bill's filing fields are not printed, as on Refrens.
    expect(byKey.subSupplyType).toBeUndefined();
    expect(byKey.transactionType).toBeUndefined();
    expect(byKey.vehicleNumber).toBeUndefined();
    // The fixture's e-way bill first, then the details in the order Refrens prints them.
    expect((card?.rows || []).map((row) => row.key)).toEqual([
      "ewayBillNumber",
      "transportMode",
      "transportName",
      "transporterId",
      "distance",
      "challanDate",
      "challanNumber",
      "vehicleType",
      "transportExtraInfo",
    ]);
    expect(transportName("NEW_MODE")).toBe("New Mode");
    // A figure field relabelled and filled with text wraps like text.
    expect(staysWhole("KA01AB1234")).toBe(true);
    expect(staysWhole("MH 12 AB 1234")).toBe(true);
    expect(
      staysWhole("flyadeal warehouse SAUDI ARABIAN AIRLINES NO 160-11")
    ).toBe(false);
    expect(staysWhole("North gate")).toBe(false);
    const relabelled = mapTransport(
      state((invoice) => {
        invoice.transportDetails = {
          challanNumber: "flyadeal warehouse SAUDI ARABIAN AIRLINES NO 160-11",
        };
      })
    );
    expect(
      relabelled?.rows.find((row) => row.key === "challanNumber")?.isNum
    ).toBe(false);
    expect(transportName("By hand")).toBe("By hand");

    const eway = mapTransport(
      state((invoice) => {
        invoice.transportDetails = {};
        invoice.irn = {
          EwbNo: "E1",
          EwbDt: "2026-09-21",
          EwbValidTill: "2026-09-25",
          ewayCancelDate: "2026-09-22",
        };
      })
    );
    const ewayByKey = Object.fromEntries(
      (eway?.rows || []).map((row) => [row.key, row])
    );
    expect(ewayByKey.ewayBillNumber).toMatchObject({
      value: "E1",
      isNum: true,
    });
    expect(ewayByKey.ewayBillDate.isUtcDate).toBe(true);
    expect(ewayByKey.ewayCancelled.value).toBe("2026-09-22");

    const ewayOff = mapTransport(
      state((invoice, root) => {
        invoice.transportDetails = {};
        invoice.irn = {
          EwbNo: "E1",
          EwbDt: "d",
          EwbValidTill: "v",
          ewayCancelDate: "c",
        };
        root.ewayConfig = {
          billNumber: false,
          billDate: false,
          billValidTillDate: false,
          billCancelledDate: false,
        };
      })
    );
    expect(ewayOff).toBeNull();

    expect(
      mapTransport(
        state((invoice) => {
          invoice.transportDetails = {};
          invoice.irn = {};
        })
      )
    ).toBeNull();
  });

  it("maps IRN rows and QR images, honouring cancellation and settings", () => {
    const live = mapCompliance(
      state((invoice) => {
        invoice.irn = {
          Irn: "IRN",
          AckNo: "A1",
          AckDt: "2026-09-21",
          qrCode: "data:image/png;base64,QQ",
        };
        invoice.zatcaQrCode = "data:image/png;base64,ZZ";
        invoice.documentQr = "https://cdn.example/doc-qr.png";
      })
    );
    expect(live.showIrn).toBe(true);
    expect(live.rows.map((row) => row.key)).toEqual(["ackNo", "ackDate"]);
    // One QR (user decision): while the IRN is active its QR prints, not the document QR.
    expect(live.qr).toEqual({
      irn: "data:image/png;base64,QQ",
      zatca: "data:image/png;base64,ZZ",
      lhdn: "",
      document: "",
    });
    // The IRN's own QR text is drawn: the signed one when the business prints that.
    const drawn = (owner: Json, irn: Json) =>
      mapCompliance(
        state((invoice) => {
          invoice.irn = { Irn: "IRN", ...irn };
          invoice.owner.configuration = {
            ...invoice.owner.configuration,
            ...owner,
          };
        })
      ).qr;
    expect(drawn({}, { qr: "plain", SignedQRCode: "signed" }).irn).toBe(
      qrImage("plain")
    );
    expect(
      drawn({ showSignedIrnQr: true }, { qr: "plain", SignedQRCode: "signed" })
        .irn
    ).toBe(qrImage("signed"));
    // A cancelled e-invoice (by status too) gives the document QR back.
    const statusCancelled = mapCompliance(
      state((invoice) => {
        invoice.irn = { Irn: "IRN", qr: "plain" };
        invoice.einvoiceGeneratedStatus = "CANCELLED";
        invoice.documentQr = "doc";
      })
    ).qr;
    expect(statusCancelled.irn).toBe("");
    expect(statusCancelled.document).toBe(qrImage("doc"));
    // The business can switch the document QR off, in general or for this kind of document.
    const off = (configuration: Json) =>
      mapCompliance(
        state((invoice) => {
          invoice.irn = {};
          invoice.documentQr = "doc";
          invoice.owner.configuration = {
            ...invoice.owner.configuration,
            ...configuration,
          };
        })
      ).qr.document;
    expect(off({ enableQrCode: false })).toBe("");
    expect(off({ showQrCode: { invoice: false } })).toBe("");
    expect(off({ showQrCode: { quotation: false } })).toBe(qrImage("doc"));

    const cancelled = mapCompliance(
      state((invoice, root) => {
        invoice.irn = {
          Irn: "IRN",
          AckNo: "A1",
          AckDt: "d",
          CancelDate: "2026-09-22",
          qrCode: "data:image/png;base64,QQ",
        };
        invoice.documentQr = '{"encoded":"text"}';
        root.einvoiceConfig = { irnNumber: false };
      })
    );
    expect(cancelled.showIrn).toBe(false);
    expect(cancelled.rows.map((row) => row.key)).toEqual(["irnCancelled"]);
    expect(cancelled.qr.irn).toBe("");
    // documentQr text is drawn as a QR, not passed through as an image.
    expect(cancelled.qr.document).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,%3Csvg/
    );

    const optedOut = mapCompliance(
      state((invoice) => {
        invoice.irn = { AckNo: "A1", AckDt: "d", CancelDate: "c" };
        invoice.owner.configuration.einvoice = {
          irnAcknowledgementNumber: false,
          irnAcknowledgementDate: false,
          irnCancelledDate: false,
        };
      })
    );
    expect(optedOut.rows).toEqual([]);
  });

  it("keeps the document QR in the header, also on a document with an IRN (user request)", () => {
    const html = render((invoice) => {
      invoice.irn = { Irn: "IRN-123", qr: "plain" };
      invoice.einvoiceGeneratedStatus = "CANCELLED";
      invoice.documentQr = "doc";
    });
    const header = html.slice(
      html.indexOf('data-section="header"'),
      html.indexOf("</header>")
    );
    expect(header).toMatch(
      /data-ceres-field-container="documentQr">\s*<img data-ceres-field="documentQr" src="data:image/
    );
  });

  it("follows refrens.com on export supply, a switched-off Unit column and empty % discounts", () => {
    // A supply abroad prints its country only, no Indian place of supply.
    const abroad = mapSupply(
      state((invoice) => {
        invoice.countryOfSupply = "US";
        invoice.placeOfSupply = "19";
      })
    );
    expect(abroad.rows.map((row) => row.key)).toEqual(["countryOfSupply"]);
    const india = mapSupply(
      state((invoice) => {
        invoice.countryOfSupply = "IN";
        invoice.placeOfSupply = "24";
      })
    );
    expect(india.rows.map((row) => row.key)).toContain("placeOfSupply");

    // The business's Unit column switched off: no Unit column, even with units on items.
    const keys = (edit: (invoice: Json) => void) =>
      mapItemTable(
        state((invoice) => {
          invoice.advanceOptions = { unitColumn: "SEPARATE_COLUMN" };
          invoice.items[0].unit = "PCS";
          edit(invoice);
        }),
        ctx
      ).columns.map((entry: Json) => entry.key);
    expect(keys(() => {})).toContain("unit");
    expect(
      keys((invoice) => {
        invoice.columns = [
          ...invoice.columns,
          { key: "unit", label: "Unit", isHidden: true },
        ];
      })
    ).not.toContain("unit");

    // A percentage discount left empty reads 0%.
    const html = render((invoice) => {
      invoice.items[0].discount = { discountType: "PERCENTAGE" };
      invoice.items[1].discount = { discountType: "PERCENTAGE", amount: 5 };
      invoice.finalTotal.discount = -100;
    });
    expect(html).toMatch(/data-testid="num">0%<\/span>/);
  });

  it("resolves units and batches from the item and business settings", () => {
    expect(unitText({}, {})).toBe("");
    expect(unitText({}, { unit: "PCS" })).toBe("PCS");
    expect(
      unitText(
        { owner: { configuration: { units: { u1: { displayName: "Nos" } } } } },
        { unit: "u1" }
      )
    ).toBe("Nos");
    expect(
      unitText(
        { owner: { configuration: { units: [{ _id: "u2", label: "Kg" }] } } },
        { unit: "u2" }
      )
    ).toBe("Kg");
    // A business's own unit key ("1ohfdis0uax") resolves through every config shape …
    const key = "1ohfdis0uax";
    const via = (units: unknown, where = "owner") =>
      unitText(
        where === "invoice"
          ? { units }
          : { [where]: { configuration: { units } } },
        { unit: key }
      );
    expect(via({ [key]: "lds" })).toBe("lds"); // { key: name }
    expect(via({ lds: key })).toBe("lds"); // { name: key }
    expect(via([{ key, value: "lds" }])).toBe("lds"); // name in value
    expect(via([{ id: key, unitName: "lds" }])).toBe("lds");
    expect(via({ custom: [{ code: key, symbol: "lds" }] })).toBe("lds"); // a group
    expect(via({ custom: { [key]: { name: "lds" } } })).toBe("lds");
    expect(via({ first: { key, name: "lds" } })).toBe("lds"); // a unit as a map value
    expect(via({ [key]: "lds" }, "business")).toBe("lds");
    expect(via({ [key]: "lds" }, "ownerBusiness")).toBe("lds");
    expect(via({ [key]: "lds" }, "invoice")).toBe("lds");
    expect(
      unitText({ configuration: { units: { [key]: "lds" } } }, { unit: key })
    ).toBe("lds");
    // … and is never printed raw: the item's own unit name, else nothing.
    expect(via({ other: "x" })).toBe("");
    expect(via({ [key]: key })).toBe("");
    expect(via([{ key, value: key }])).toBe("");
    expect(via({ a: { b: { c: { d: { e: { [key]: "deep" } } } } } })).toBe("");
    expect(unitText({}, { unit: key, unitName: "lds" })).toBe("lds");
    expect(unitText({}, { unit: key, uom: "lds" })).toBe("lds");
    expect(unitText({}, { unit: { value: "BOX" } })).toBe("BOX");
    // A short plain unit stays as written.
    expect(unitText({}, { unit: "Nos" })).toBe("Nos");
    expect(
      batchText({
        batchSummary: [
          { batchName: "B1" },
          { name: "B2" },
          { batchName: "B1" },
        ],
        allocations: [
          { batch: { batchName: "B3" } },
          { batch: { name: "B4" } },
          { batch: "B5" },
          { batchName: "B6" },
          {},
        ],
      })
    ).toBe("B1, B2, B3, B4, B5, B6");
    // Refrens' allocations name the batch by its database id, the name in batchData.
    expect(
      batchText({
        allocations: [
          {
            batch: "64b0000000000000000000a1",
            batchData: { batchName: "Lot A" },
          },
          { batch: "64b0000000000000000000a2" },
        ],
      })
    ).toBe("Lot A");
  });

  it("formats each column kind and resolves custom column values", () => {
    const table = mapItemTable(
      state((invoice) => {
        invoice.advanceOptions.unitColumn = "MERGE_QUANTITY";
        invoice.columns = [
          column("name"),
          column("sku"),
          column("unit"),
          column("quantity"),
          column("gstRate"),
          column("margin", { semanticType: "percentage" }),
          column("discount"),
          column("rate"),
          column("cess", { isCessColumn: true }),
          column("freight", { semanticType: "currency" }),
          column("duty", { fxReturnType: "currency" }),
          column("weight", { dataType: "number", summarise: true }),
          column("grade", { dataType: "text" }),
          column("finish", { label: "Finish" }),
          column("colours"),
          column("sgst"),
          column("total"),
        ];
        invoice.finalTotal.discount = 10;
        invoice.items = [
          {
            name: "Part",
            sku: "S1",
            images: ["https://cdn.example/a.png", ""],
            originalImages: ["https://cdn.example/b.png", ""],
            unit: "PCS",
            quantity: 4,
            taxRate: 18,
            margin: 12.5,
            discount: { amount: 10, discountType: "PERCENTAGE" },
            rate: 100,
            cess: 2,
            freight: 30,
            custom: { duty: 4 },
            weight: 2.25,
            customFields: [
              { key: "grade", value: "A" },
              { label: "Finish", value: "Matt" },
            ],
            colours: ["Red", "Blue"],
            utgst: 9,
            subTotal: 472,
          },
          {
            name: "Plain",
            quantity: 1,
            discount: 5,
            rate: 50,
            total: 59,
          },
        ];
      }),
      ctx
    );

    const first = Object.fromEntries(
      (table.rows[0] as Json).cells.map((cell: Json) => [cell.key, cell.value])
    );
    expect((table.rows[0] as Json).images).toEqual([
      "https://cdn.example/a.png",
    ]);
    expect((table.rows[0] as Json).originalImages).toEqual([
      "https://cdn.example/b.png",
    ]);
    // MERGE_QUANTITY (the account's own setting) folds the unit into the Qty cell; Unit gets
    // no column of its own. The planner itself never merges (as refrens.com).
    expect(table.mergeUnit).toBe(true);
    expect(table.header.map((cell) => cell.key)).not.toContain("unit");
    expect(first).toEqual({
      name: "Part",
      sku: "S1",
      quantity: "4 PCS",
      gstRate: "18%",
      margin: "12.5%",
      discount: "10%",
      rate: "₹100.00",
      cess: "₹2.00",
      freight: "₹30.00",
      duty: "₹4.00",
      weight: "2.25",
      grade: "A",
      finish: "Matt",
      colours: "Red, Blue",
      sgst: "₹9.00",
      total: "₹472.00",
    });
    const classes = Object.fromEntries(
      (table.rows[0] as Json).cells.map((cell: Json) => [
        cell.key,
        cell.className,
      ])
    );
    expect(classes.grade).toContain("is-word");
    expect(classes.colours).not.toContain("is-word");
    expect(classes.rate).not.toContain("is-word");
    const second = (table.rows[1] as Json).cells.find(
      (cell: Json) => cell.key === "discount"
    );
    expect(second.value).toBe("₹5.00");

    const footer = Object.fromEntries(
      table.footer.cells.map((cell) => [cell.key, cell.value])
    );
    // Rate never sums; percent discounts are not additive.
    expect(footer.rate).toBe("");
    expect(footer.discount).toBe("");
    expect(footer.quantity).toBe("5");
    expect(footer.weight).toBe("2.25");
    expect(footer.total).toBe("₹531.00");

    const sumsDiscount = mapItemTable(
      state((invoice) => {
        invoice.finalTotal.discount = 10;
        invoice.items[0].discount = 4;
        invoice.items[1].discount = 6;
      }),
      ctx
    );
    expect(
      sumsDiscount.footer.cells.find((cell) => cell.key === "discount")?.value
    ).toBe("₹10.00");
  });

  it("puts the thumbnail beside the item name and images[] with the description", () => {
    expect(thumbnailOf({ thumbnail: "https://cdn.example/t.png" })).toBe(
      "https://cdn.example/t.png"
    );
    expect(
      thumbnailOf({ thumbnail: { url: "https://cdn.example/obj.png" } })
    ).toBe("https://cdn.example/obj.png");
    // The thumbnail never borrows a gallery image: images[] is a separate field.
    expect(
      thumbnailOf({ images: [{ src: "https://cdn.example/first.png" }] })
    ).toBe("");

    const edit = (invoice: Json) => {
      invoice.advanceOptions.showThumbnailAsColumn = true;
      invoice.advanceOptions.isDescriptionFullWidth = true;
      invoice.items[0].thumbnail = "https://cdn.example/thumb.png";
      invoice.items[0].images = [{ url: "https://cdn.example/a.png" }];
      invoice.items[0].originalImages = ["https://cdn.example/original.png"];
      invoice.items[1].images = ["https://cdn.example/b.png"];
    };
    const table = mapItemTable(state(edit), ctx);
    expect(table.showThumbnail).toBe(true);
    const [first, second] = table.rows as Json[];
    expect(first.thumbnail).toBe("https://cdn.example/thumb.png");
    expect(first.images).toEqual(["https://cdn.example/a.png"]);
    expect(second.thumbnail).toBe("");
    expect(second.hasDetail).toBe(true);
    // No extra column: the thumbnail lives in the description cell.
    expect(table.colspan).toBe(table.columns.length + 1);
    expect(first.detailColspan).toBe(table.columns.length);

    const html = render(edit);
    expect(html).toMatch(/class="mm-items[^"]* has-thumbnails"/);
    expect(html).not.toContain("mm-col-thumbnail");
    // Thumbnail inside the description cell, ahead of the item name.
    const nameCell = html.slice(html.indexOf('<td class="mm-col-name'));
    expect(nameCell.indexOf('<div class="mm-item-thumbnail">')).toBeLessThan(
      nameCell.indexOf('<span class="mm-item-name">')
    );
    expect(html).toMatch(
      /class="ceres-image mm-thumbnail" src="https:\/\/cdn.example\/thumb.png"/
    );
    // Full-width description row (empty Sr cell + the gallery), then the original image in
    // a row of its own across the whole table.
    const rows = html.slice(html.indexOf('data-testid="item-detail-row"'));
    const descriptionRow = rows.slice(0, rows.indexOf("</tr>"));
    expect(descriptionRow).toContain("https://cdn.example/a.png");
    expect(descriptionRow).not.toContain("https://cdn.example/original.png");
    expect(rows).toMatch(
      new RegExp(
        `^[^]*?</tr>\\s*<tr class="mm-image-row" data-testid="item-detail-row" data-item-index="0">\\s*<td colspan="${table.colspan}">\\s*<img class="mm-large-image" data-testid="large-image" src="https://cdn.example/original.png"`
      )
    );
    expect(first.imageRow).toBe(true);
    expect(second.imageRow).toBe(false);

    // The image row is there whether or not the description is full width; the description
    // and gallery then stay in the item's own cell.
    const inline = render((invoice) => {
      edit(invoice);
      invoice.advanceOptions.isDescriptionFullWidth = false;
    });
    expect(inline.match(/class="mm-detail-row/g)).toBeNull();
    expect(inline).toMatch(
      /<td class="mm-col-name[^"]*" data-col="desc">[\s\S]*https:\/\/cdn.example\/a.png[\s\S]*<tr class="mm-image-row"/
    );
  });

  it("reads each special column value", () => {
    const total: ItemColumn = {
      key: "total",
      label: "",
      kind: "money",
      className: "",
      summable: true,
    };
    expect(columnNumber({ total: 1, subTotal: 2 }, total)).toBe(1);
    expect(columnNumber({ subTotal: 2 }, total)).toBe(2);
  });

  it("builds group rows, inline codes and the batch/unit columns", () => {
    const table = mapItemTable(
      state((invoice) => {
        invoice.advanceOptions.unitColumn = "MERGE_NAME";
        invoice.advanceOptions.showSkuInInvoice = true;
        invoice.advanceOptions.hsnView = "MERGE";
        invoice.owner.country = "MY";
        invoice.billedBy.country = "MY";
        invoice.items[0].sku = "SKU-1";
        invoice.items[0].classification = "022";
        invoice.items[1].sku = "SKU-2";
        invoice.items[1].showSku = false;
        invoice.items.splice(2, 0, { name: "Group A", group: true });
        invoice.items.push(
          {
            name: "Subtotal A",
            isGroupItemTotalRow: true,
            amount: 10,
            total: 12,
          },
          { name: "Freight", isAdditionalCharge: true },
          { name: "Hidden", hidden: true }
        );
      }),
      ctx
    );
    const rows = table.rows as Json[];
    expect(rows[0].inlineCodes).toEqual([
      "SKU: SKU-1",
      "HSN/SAC: 8708",
      "Classification: 022",
      "Unit: PCS",
    ]);
    expect(rows[1].inlineCodes).toEqual(["HSN/SAC: 8483", "Unit: PCS"]);
    // The codes share one row under the name.
    const codesHtml = render((invoice) => {
      invoice.advanceOptions.showSkuInInvoice = true;
      invoice.advanceOptions.hsnView = "MERGE";
      invoice.items[0].sku = "SKU-1";
    });
    expect(codesHtml).toContain(
      '<span class="mm-item-codes"><span class="mm-item-code">SKU: SKU-1</span><span class="mm-item-code">HSN/SAC: 8708</span></span>'
    );
    expect(rows[2]).toEqual({
      isGroupHeader: true,
      name: "Group A",
      colspan: table.colspan,
    });
    const groupTotal = rows[rows.length - 1];
    expect(groupTotal.isGroupTotal).toBe(true);
    expect(groupTotal.serial).toBe("");
    expect(
      groupTotal.cells.find((cell: Json) => cell.key === "batch").value
    ).toBe("");
    expect(rows.map((row) => row.serial).filter(Boolean)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    expect(table.columns.some((col) => col.key === "unit")).toBe(false);

    const hiddenSubtotals = mapItemTable(
      state((invoice) => {
        invoice.advanceOptions.hideGroupSubTotal = true;
        invoice.items.push({ name: "Sub", isGroupItemTotalRow: true });
      }),
      ctx
    );
    expect(hiddenSubtotals.rows).toHaveLength(8);

    const noBatch = mapItemTable(
      state((invoice) => {
        invoice.advanceOptions.showBatchColumnsInInvoice = false;
        invoice.columns = invoice.columns.filter(
          (col: Json) => col.key !== "quantity"
        );
      }),
      ctx
    );
    expect(noBatch.columns.map((col) => col.key)).not.toContain("batch");
    expect(noBatch.columns.map((col) => col.key)).not.toContain("unit");

    // The document's own Batch Code column reads the allocation's batch; no Batch column then.
    const ownBatch = mapItemTable(
      state((invoice) => {
        invoice.columns.splice(
          1,
          0,
          column("batchCode"),
          column("expiryDate", { dataType: "date" })
        );
        invoice.items[0].allocations = [
          {
            batch: "64b0000000000000000000a3",
            batchData: {
              batchCode: "B-0001",
              expiryDate: "2025-12-25T18:30:00.000Z",
            },
          },
        ];
      }),
      ctx
    );
    expect(ownBatch.columns.map((col) => col.key)).not.toContain("batch");
    const codeAt = ownBatch.columns.findIndex((col) => col.key === "batchCode");
    expect(JSON.stringify(ownBatch.rows[0])).toContain("B-0001");
    // A date column prints as the document's dates do, never the raw instant.
    expect(JSON.stringify(ownBatch.rows[0])).toContain("26-Dec-2025");
    expect(JSON.stringify(ownBatch.rows[0])).not.toContain("T18:30");
    expect(codeAt).toBeGreaterThan(-1);

    const accountColumns = mapItemTable(
      state((invoice) => {
        invoice.columns.splice(1, 0, column("batch"), column("unit"));
      }),
      ctx
    );
    expect(
      accountColumns.columns.filter((col) =>
        ["batch", "unit"].includes(col.key)
      )
    ).toHaveLength(2);

    const batchFirst = mapItemTable(
      state((invoice) => {
        invoice.columns = invoice.columns.filter(
          (col: Json) => col.key !== "name"
        );
      }),
      ctx
    );
    expect(batchFirst.columns[0].key).toBe("batch");
    expect(batchFirst.footer.labelInSerial).toBe(true);

    const empty = mapItemTable(
      state((invoice) => {
        invoice.items = [];
      }),
      ctx
    );
    expect(empty.footer.show).toBe(false);
  });

  it("plans column widths from Figma, falling back in the spec's order", () => {
    const col = (key: string, label: string, kind: ItemColumn["kind"]) => ({
      key,
      label,
      kind,
      className: "",
      summable: false,
    });
    const name = { column: col("name", "Description", "name"), values: [] };
    const money = (key: string, label: string, value: string) => ({
      column: col(key, label, "money"),
      values: [value],
    });

    // Figma widths when Description keeps its share. The last column carries the row's 8 px
    // end padding (Amount 90 → 98); Taxable grows to the bold 12 px total "1,03,465.00".
    const figma = planTableLayout([
      name,
      { column: col("hsn", "HSN/SAC", "code"), values: ["8708"] },
      { column: col("quantity", "Qty", "qty"), values: ["97"] },
      { column: col("unit", "Unit", "code"), values: ["PCS"] },
      money("rate", "Rate", "3,200.00"),
      money("amount", "Taxable", "1,03,465.00"),
      money("cgst", "CGST", "9,311.85"),
      money("sgst", "SGST", "9,311.85"),
      money("total", "Amount", "1,22,088.70"),
    ]);
    expect(figma.widths).toEqual({
      hsn: 70,
      quantity: 42,
      unit: 45,
      rate: 75,
      amount: 92,
      cgst: 75,
      sgst: 75,
      total: 99,
    });
    // 934 px inside the table's outline, less Sr (30 + 8) and the other columns.
    expect(figma.descriptionWidth).toBe(934 - 38 - 573);
    expect(figma).toMatchObject({ smallNumbers: false });

    // Too wide: shrink to content, then smaller numbers. Unit stays its own column, as on
    // refrens.com (the planner no longer folds it into Qty).
    const wide = (count: number, value: string, withUnit = true) => [
      name,
      { column: col("quantity", "Qty", "qty"), values: ["10 PCS"] },
      ...(withUnit
        ? [{ column: col("unit", "Unit", "code"), values: ["PCS"] }]
        : []),
      ...Array.from({ length: count }, (_, index) =>
        money(`c${index}`, `Col ${index}`, value)
      ),
    ];
    expect(planTableLayout(wide(8, "1,250.00"))).toMatchObject({
      smallNumbers: false,
    });
    expect(planTableLayout(wide(8, "1,250.00")).widths.c0).toBe(70);
    expect(planTableLayout(wide(6, "12,50,000.00"))).toMatchObject({
      smallNumbers: true,
    });
    expect(planTableLayout(wide(10, "1,23,45,67,890.00"))).toMatchObject({
      smallNumbers: true,
    });
    // Without a Unit column, the same.
    expect(planTableLayout(wide(10, "12,50,000.00", false))).toMatchObject({
      smallNumbers: true,
    });
    // Description is held to ≥ 22% of the table, even past the last fallback.
    const tight = planTableLayout(wide(14, "1,23,45,67,890.00"));
    const others = Object.values(tight.widths).reduce((a, b) => a + b, 38);
    expect(
      (tight.descriptionMin + 13) / (others + tight.descriptionMin + 13)
    ).toBeGreaterThanOrEqual(0.22);
    // Text columns count only their longest word; headers break after "/".
    expect(headerParts("HSN/SAC")).toEqual(["HSN/", "SAC"]);
    const note = planTableLayout([
      name,
      {
        column: col("note", "Remarks", "text"),
        values: ["Work will resume after advance payment ".repeat(20)],
      },
    ]);
    // A long note sizes a text column by its longest word only (at 13 px, "ADVANCE" /
    // "PAYMENT" need a little over the 75 px start), plus the row's end padding.
    expect(note.widths.note).toBe(88);
    // A character outside the measured glyph table counts as a wide one.
    const lot = planTableLayout([
      name,
      { column: col("lot", "Lot", "code"), values: ["#########"] },
    ]);
    expect(lot.widths.lot).toBe((9 * 8 * 13) / 12 + 13 + 8);
  });

  it("maps the HSN summary for either tax path", () => {
    const intra = mapHsnSummary(state(), ctx);
    expect(intra.hasRows).toBe(true);
    expect(intra.isHidden).toBe(false);
    // refrens.com's headings, whatever the item column is called.
    expect(intra.labels).toMatchObject({
      hsn: "HSN",
      taxable: "Taxable Value",
      rate: "Rate",
      amount: "Amount",
    });
    // Each tax's rate and amount; Total is the row's tax (refrens.com).
    expect(intra.rows[3]).toMatchObject({
      hsn: "8483",
      cgstRate: "9%",
      cgst: "₹3,200.85",
      sgstRate: "9%",
      total: "₹6,401.70",
    });
    expect(intra.totals.total).toBe("₹18,623.70");
    // Tax in words under the Total row: CGST + SGST here, across all seven columns.
    expect(intra.words).toEqual({
      label: "Total Tax In Words",
      value:
        "EIGHTEEN THOUSAND SIX HUNDRED TWENTY THREE RUPEES AND SEVENTY PAISE ONLY",
    });
    expect(intra.columnCount).toBe(7);
    // Footer on every page unless the document asks for the last page only.
    const footerHtml = render((invoice) => {
      invoice.letterHeadFooter = "https://cdn.example/footer.png";
    });
    expect(footerHtml).toContain("mm-footer-fixed");
    expect(footerHtml).toMatch(
      /<tfoot class="mm-page-frame-footer">[\s\S]*mm-footer-spacer/
    );
    const lastOnly = render((invoice) => {
      invoice.letterHeadFooter = "https://cdn.example/footer.png";
      invoice.template = { pdfOptions: { footerOnLastPage: true } };
    });
    expect(lastOnly).not.toContain("mm-footer-fixed");
    expect(lastOnly).not.toContain("mm-page-frame-footer");
    expect(render()).toMatch(
      /<tr class="mm-hsn-words">\s*<td colspan="7">Total Tax In Words: EIGHTEEN THOUSAND/
    );

    const inter = mapHsnSummary(
      state((invoice) => {
        invoice.igst = true;
        invoice.columns = invoice.columns.filter(
          (col: Json) => col.key !== "hsn"
        );
        invoice.customLabels.hsnSac = "HSN Code";
        invoice.advanceOptions = { showHSNSummaryInInvoice: false };
        // The older list form, with the short keys.
        invoice.hsnSummary = [
          { hsn: "7307", taxableValue: 100, igst: 18, cessAmount: 1 },
          { hsn: "", taxableValue: 5 },
        ];
      }),
      ctx
    );
    expect(inter.showIgst).toBe(true);
    expect(inter.hasCess).toBe(true);
    // IGST + Cess: 18 + 1 in words; HSN, Taxable, IGST and Cess (rate, amount), Total.
    expect(inter.words.value).toBe("NINETEEN RUPEES ONLY");
    expect(inter.columnCount).toBe(7);
    expect(inter.isHidden).toBe(true);
    expect(inter.labels.hsn).toBe("HSN");
    // The short keys too; no rate given, none printed.
    expect(inter.rows).toEqual([
      expect.objectContaining({
        igst: "₹18.00",
        igstRate: "",
        total: "₹19.00",
      }),
    ]);

    // A foreign-currency document's words in its own currency (refrens.com: "EIGHTEEN
    // RIYALS ONLY"), from Refrens' stored keys.
    const riyal = mapHsnSummary(
      state((invoice) => {
        invoice.igst = true;
        invoice.currency = "SAR";
        invoice.hsnSummary = {
          hsnList: [
            {
              hsn: "111",
              taxableValue: 100,
              igstRate: 18,
              igstAmount: 18,
              totalCess: 1,
              totalCessAmount: 1,
              taxAmount: 19,
            },
          ],
        };
      }),
      { ...ctx, currency: "SAR" }
    );
    expect(riyal.rows[0]).toMatchObject({
      igstRate: "18%",
      cessRate: "1%",
      cess: expect.stringContaining("1.00"),
    });
    expect(riyal.words.value).toBe("NINETEEN RIYALS ONLY");
    // Rendered: each row under the IGST heading takes its IGST rate and amount, and each
    // cell its heading as the narrow card's label.
    const igstHtml = render((invoice) => {
      invoice.igst = true;
      invoice.hsnSummary = {
        hsnList: [
          { hsn: "111", taxableValue: 300, igstRate: 18, igstAmount: 54 },
        ],
      };
    });
    const igstBody = igstHtml.slice(
      igstHtml.indexOf('class="mm-hsn-table"'),
      igstHtml.indexOf("<tfoot>", igstHtml.indexOf('class="mm-hsn-table"'))
    );
    expect(igstBody).toContain('data-label="IGST Rate"');
    expect(igstBody).toContain(">18%<");
    expect(igstBody).not.toContain('data-label="CGST');

    // No stored row tax: CGST + SGST (+ Cess) summed.
    const summed = mapHsnSummary(
      state((invoice) => {
        invoice.hsnSummary = [
          { hsn: "7307", taxableValue: 100, cgst: 9, sgst: 9, cessAmount: 2 },
        ];
      }),
      ctx
    );
    expect(summed.rows[0].total).toBe("₹20.00");
  });

  it("maps bank rows, UPI and the section gate", () => {
    const bank = mapBank(
      state((invoice) => {
        invoice.bankAccount = {
          accountHolderName: "Holder",
          bankName: "Bank",
          accountNumber: "123",
          ifscCode: "IFSC1",
          iban: "IBAN1",
          swiftCode: "SWIFT1",
          sortCode: "SC",
          accountType: "Current",
          branch: "Main",
          customFields: [
            { name: "MICR", value: "400" },
            { label: "Off", value: "x", params: { showInInvoice: false } },
          ],
        };
        invoice.customLabels.swift = "BIC";
        invoice.paymentOptions.upi = true;
        invoice.upi = { upi: "vertex@bank", qr: "data:image/png;base64,UU" };
      })
    );
    expect(bank.show).toBe(true);
    expect(bank.title).toBe("Bank Details");
    expect(bank.rows.map((row) => `${row.label}=${row.value}`)).toEqual([
      "Account Name=Holder",
      "Account Number=123",
      "IFSC=IFSC1",
      "IBAN=IBAN1",
      "BIC=SWIFT1",
      "Sort Code=SC",
      "Account Type=Current",
      "Bank=Bank",
      "Branch=Main",
      "MICR=400",
    ]);
    expect(bank.upi).toEqual({
      label: "UPI",
      id: "vertex@bank",
      scanLabel: "Scan to pay via UPI",
      qr: "data:image/png;base64,UU",
      note: "Maximum of 1 lakh can be transferred via UPI in a single day",
    });

    const upiOnly = mapBank(
      state((invoice) => {
        invoice.paymentOptions = { upi: true };
        invoice.upi = { vpa: "pay@upi" };
      })
    );
    expect(upiOnly.rows).toEqual([]);
    expect(upiOnly.show).toBe(true);
    expect(upiOnly.title).toBe("UPI Details");
    // No QR image supplied: the UPI intent is drawn here.
    expect(upiOnly.upi?.qr).toMatch(/^data:image\/svg\+xml/);

    const none = mapBank(
      state((invoice) => {
        invoice.paymentOptions = {};
      })
    );
    expect(none.show).toBe(false);
    expect(none.upi).toBeNull();

    // Account type: title case, only for a bank in India (as refrens.com).
    const typed = (bankAccount: Json) =>
      mapBank(
        state((invoice) => {
          invoice.bankAccount = { accountNumber: "1", ...bankAccount };
        })
      ).rows.find((row) => row.key === "accountType")?.value;
    expect(typed({ accountType: "SAVINGS", country: "IN" })).toBe("Savings");
    expect(typed({ accountType: "SAVINGS", country: "AE" })).toBeUndefined();

    // A delivery challan prints no bank details or UPI.
    const challan = mapBank(
      state((invoice) => {
        invoice.billType = "DELIVERYCHALLAN";
        invoice.paymentOptions.upi = true;
        invoice.upi = { vpa: "pay@upi" };
      })
    );
    expect(challan.rows).toEqual([]);
    expect(challan.upi).toBeNull();
    expect(challan.show).toBe(false);

    // The UPI limit note: only on a document still to be paid, of ₹100 or more.
    const note = (edit: (invoice: Json) => void) =>
      mapBank(
        state((invoice) => {
          invoice.paymentOptions.upi = true;
          invoice.upi = { vpa: "pay@upi" };
          edit(invoice);
        })
      ).upi?.note;
    expect(
      note((invoice) => {
        invoice.status = "PAID";
      })
    ).toBe("");
    expect(
      note((invoice) => {
        invoice.finalTotal = { total: 99.5 };
      })
    ).toBe("");
    expect(
      note((invoice) => {
        invoice.finalTotal = {};
      })
    ).toBe("");
    expect(
      note((invoice) => {
        invoice.status = "PARTIAL";
        invoice.finalTotal = { total: 100 };
      })
    ).toMatch(/lakh/);
  });

  it("builds the UPI intent the platform encodes", () => {
    const intent = upiIntent(
      {
        billedBy: { name: "Vertex & Co" },
        balance: { due: 250000 },
        currency: "INR",
        invoiceTitle: "Tax Invoice",
        invoiceNumber: "VF/26-27/0042",
      },
      "pay@upi"
    );
    expect(intent).toBe(
      "upi://pay?pa=pay%40upi&pn=Vertex%20%26%20Co&am=100000.00&cu=INR&tn=Tax%20Invoice%20VF%2F26-27%2F0042"
    );
    // Part payments allowed: no amount; nothing due: no amount; defaults to INR.
    expect(
      upiIntent(
        {
          finalTotal: { total: 500 },
          paymentOptions: { meta: { allowPartialPayment: true } },
        },
        "pay@upi"
      )
    ).toBe("upi://pay?pa=pay%40upi&cu=INR");
    expect(upiIntent({ finalTotal: { total: 120.5 } }, "p@u")).toBe(
      "upi://pay?pa=p%40u&am=120.50&cu=INR"
    );
    expect(
      upiIntent({ invoiceNumber: "X".repeat(80) }, "p@u").split("tn=")[1]
    ).toHaveLength(50);
  });

  it("draws QR codes: image sources pass through, text is encoded", () => {
    expect(qrImage("")).toBe("");
    expect(qrImage("https://cdn.example/qr.png")).toBe(
      "https://cdn.example/qr.png"
    );
    expect(qrImage("data:image/png;base64,QQ")).toBe(
      "data:image/png;base64,QQ"
    );
    expect(qrImage("blob:abc")).toBe("blob:abc");
    expect(qrImage("hello")).toBe(generateQrDataUrl("hello"));

    // Version grows with the payload: 21 modules for v1, 4 more per version.
    const small = encodeQrMatrix("hello");
    expect(small).toHaveLength(21);
    expect(small?.every((row) => row.length === 21)).toBe(true);
    // Finder pattern corners are dark.
    expect([small?.[0][0], small?.[0][20], small?.[20][0]]).toEqual([
      true,
      true,
      true,
    ]);
    const medium = encodeQrMatrix("x".repeat(100));
    expect(medium!.length).toBeGreaterThan(21);
    // Version 7+ carries version information; multi-byte text is UTF-8 encoded.
    expect(encodeQrMatrix("é".repeat(120))!.length).toBeGreaterThanOrEqual(45);
    // Too long for version 20, or empty: nothing drawn.
    expect(encodeQrMatrix("x".repeat(2000))).toBeNull();
    expect(encodeQrMatrix("")).toBeNull();
    expect(generateQrDataUrl("")).toBe("");
    expect(generateQrDataUrl(undefined as unknown as string)).toBe("");
    expect(generateQrDataUrl("hello")).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,%3Csvg.*viewBox%3D%220%200%2029%2029%22/
    );
  });

  it("prints words from the stored value, else computes INR, else nothing", () => {
    // In capitals, the stored value included (user request).
    expect(mapWords(state())?.value).toContain("ONE LAKH");
    expect(
      mapWords(
        state((invoice) => {
          invoice.customLabels.totalInWordsValue = "";
        })
      )?.value
    ).toBe(
      "ONE LAKH TWENTY TWO THOUSAND EIGHTY EIGHT RUPEES AND SEVENTY PAISE ONLY"
    );
    // Nothing stored on a foreign-currency document: the total in that currency's words.
    expect(
      mapWords(
        state((invoice) => {
          invoice.customLabels.totalInWordsValue = "";
          invoice.currency = "USD";
        })
      )?.value
    ).toBe(
      "ONE HUNDRED TWENTY TWO THOUSAND EIGHTY EIGHT DOLLARS AND SEVENTY CENTS ONLY"
    );
    expect(amountInCurrencyWords(1000000, "JPY")).toBe("ONE MILLION YEN ONLY");
    // No currency, or one without words of its own: rupees (the shared converter).
    expect(amountInCurrencyWords(2, "")).toContain("TWO RUPEES");
    expect(amountInCurrencyWords(2, "XYZ")).toContain("TWO RUPEES");
    expect(
      mapWords(
        state((invoice) => {
          invoice.customLabels.totalInWordsValue = "";
          invoice.currency = "";
        })
      )?.value
    ).toContain("RUPEES");
    expect(amountInCurrencyWords(5, "GBP")).toBe("FIVE POUNDS ONLY");
    expect(amountInCurrencyWords(0, "EUR")).toBe("ZERO EUROS ONLY");
    expect(amountInCurrencyWords(1001.05, "AED")).toBe(
      "ONE THOUSAND ONE DIRHAMS AND FIVE FILS ONLY"
    );
    // A currency without known words prints none.
    expect(
      mapWords(
        state((invoice) => {
          invoice.customLabels.totalInWordsValue = "";
          invoice.currency = "XYZ";
        })
      )
    ).toBeNull();
    // Hidden by a setting, the line stays, hidden by class, for Lydia's live toggles.
    expect(
      mapWords(
        state((invoice) => {
          invoice.hideTotalInWords = true;
        })
      )
    ).toMatchObject({ hiddenBySetting: true, hiddenByTotals: false });
    expect(
      mapWords(
        state((invoice) => {
          invoice.advanceOptions.hideTotals = true;
        })
      )
    ).toMatchObject({ hiddenBySetting: false, hiddenByTotals: true });
    expect(mapWords(state())).toMatchObject({
      hiddenBySetting: false,
      hiddenByTotals: false,
    });
  });

  it("follows Lydia's live total-in-words and hide-totals toggles", () => {
    const html = render((invoice) => {
      invoice.hideTotalInWords = true;
    });
    expect(html).toMatch(
      /<p class="mm-words is-hidden-by-words-setting" data-ceres-total-in-words>/
    );
    expect(render()).toMatch(/<p class="mm-words" data-ceres-total-in-words>/);
    expect(
      fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8")
    ).toMatch(
      /\.mm-words:is\(\.is-hidden-by-totals, \.is-hidden-by-words-setting\) \{\s*display: none;/
    );
  });

  it("lays terms | notes, additional info | attachments, and notes in their own row", () => {
    // Defaults: both terms groups stacked in one box with the notes beside them, then
    // Additional Info | Attachments.
    const view = buildModernManufacturingView(
      state((invoice) => {
        invoice.terms.push({ label: "Warranty", terms: ["Two"] });
      })
    );
    expect(view.termsRow.terms.map((group) => group.title)).toEqual([
      "Terms & Conditions",
      "Warranty",
    ]);
    expect(view.termsRow.notes?.title).toBe("Notes");
    expect(view.termsRow.show).toBe(true);
    expect(view.infoRow.additional?.rows).toHaveLength(5);
    expect(view.infoRow.attachments?.files).toHaveLength(3);
    expect(view.infoRow.show).toBe(true);
    expect(view.notesRow).toBeNull();

    const html = render();
    expect(html.match(/data-pair="terms-notes"/g)).toHaveLength(1);
    expect(html.match(/data-pair="additional-attachments"/g)).toHaveLength(1);
    expect(html).toMatch(
      /data-section="terms"[\s\S]*data-section="notes"[\s\S]*data-section="additional"[\s\S]*data-section="attachments"/
    );

    // notesPosition "row": the notes leave the terms row for their own row at the end.
    const row = buildModernManufacturingView(
      state((invoice) => {
        invoice.template = { notesPosition: "row" };
      })
    );
    expect(row.termsRow.notes).toBeNull();
    expect(row.notesRow?.title).toBe("Notes");
    const rowHtml = render((invoice) => {
      invoice.template = { notesPosition: "Row" };
    });
    expect(rowHtml).toMatch(
      /data-section="attachments"[\s\S]*mm-notes-row" data-testid="section" data-section="notes"/
    );

    // A row whose boxes are all off is not rendered.
    const empty = buildModernManufacturingView(
      state((invoice) => {
        invoice.terms = [];
        invoice.notes = "";
        invoice.customFields = [];
        invoice.attachments = [];
      })
    );
    expect(empty.termsRow.show).toBe(false);
    expect(empty.infoRow.show).toBe(false);
    const notesOnly = buildModernManufacturingView(
      state((invoice) => {
        invoice.terms = [];
      })
    );
    expect(notesOnly.termsRow.show).toBe(true);
    const rowWithoutTerms = buildModernManufacturingView(
      state((invoice) => {
        invoice.terms = [];
        invoice.template = { notesPosition: "row" };
      })
    );
    expect(rowWithoutTerms.termsRow.show).toBe(false);
  });

  it("maps Additional Info from the document's custom fields", () => {
    const info = mapAdditionalInfo(
      state((invoice) => {
        invoice.customFields = [
          {
            label: "Order Date",
            value: "2026-09-14T18:30:00.000Z",
            dataType: "date",
          },
          { name: "Advance", value: 500, dataType: "currency" },
          { label: "Lines", value: ["A", "B"], dataType: "text" },
          { label: "Hidden", value: "x", params: { showInInvoice: false } },
          { label: "Empty", value: "" },
        ];
        invoice.customLabels.additionalInfo = "More";
      }),
      ctx
    );
    expect(info?.title).toBe("More");
    expect(info?.rows.map((row) => [row.label, row.value, row.isDate])).toEqual(
      [
        ["Order Date", "2026-09-14T18:30:00.000Z", true],
        ["Advance", "₹500.00", false],
        ["Lines", "A, B", false],
      ]
    );
    expect(
      mapAdditionalInfo(
        state((invoice) => {
          invoice.customFields = [];
        }),
        ctx
      )
    ).toBeNull();
    expect(mapAdditionalInfo(state(), ctx)?.title).toBe(
      "Additional Information"
    );

    // The document's Additional Info fields (customFooters / footers) lead, then custom fields.
    const withFooters = mapAdditionalInfo(
      state((invoice) => {
        invoice.customFooters = [
          { key: "f1", label: "Account Number", value: "9043" },
          { defaultValue: "Regd. Office", value: "Mumbai" },
          { label: "Empty", value: "" },
        ];
        invoice.footers = [{ label: "CIN", value: "U1" }];
        invoice.customFields = [{ label: "Inspection", value: "TC-1" }];
      }),
      ctx
    );
    expect(withFooters?.rows.map((row) => [row.label, row.value])).toEqual([
      ["Account Number", "9043"],
      ["Regd. Office", "Mumbai"],
      ["CIN", "U1"],
      ["Inspection", "TC-1"],
    ]);
    // Footer fields alone still make the box.
    expect(
      mapAdditionalInfo(
        state((invoice) => {
          invoice.customFields = [];
          invoice.customFooters = [{ label: "IFSC Code", value: "X1" }];
        }),
        ctx
      )?.rows
    ).toHaveLength(1);
  });

  it("maps notes, terms and attachments", () => {
    const notes = mapNotes(
      state((invoice) => {
        invoice.customLabels = { terms: "Conditions", attachment: "" };
        invoice.terms = [{ terms: ["One"] }, { label: "", terms: [] }];
        invoice.attachments = [
          "https://cdn.example/files/Drawing%20Rev%20C.pdf?sig=1",
          { url: "https://cdn.example/files/%E0%A4%A.pdf" },
          { link: "https://cdn.example/folder/" },
          "",
        ];
      })
    );
    expect(notes.notes?.title).toBe("Notes");
    expect(notes.terms).toEqual([{ title: "Conditions", items: ["One"] }]);
    expect(notes.attachments?.title).toBe("");
    expect(notes.attachments?.files.map((file) => file.name)).toEqual([
      "Drawing Rev C.pdf",
      "%E0%A4%A.pdf",
      "https://cdn.example/folder/",
    ]);

    const defaults = mapNotes(
      state((invoice) => {
        invoice.customLabels = {};
        invoice.terms = [{ terms: ["Two"] }];
        invoice.notesShowInInvoice = false;
        invoice.attachments = [];
      })
    );
    expect(defaults.notes).toBeNull();
    expect(defaults.terms[0].title).toBe("Terms and Conditions");
    expect(defaults.attachments).toBeNull();

    expect(
      mapNotes(
        state((invoice) => {
          invoice.hideNotes = true;
        })
      ).notes
    ).toBeNull();
  });

  it("maps the signature block and footer", () => {
    expect(mapSignature(state())).toMatchObject({
      forLabel: "For Vertex Foundry Components",
      image: "",
      awaitingDigital: false,
      signedDigital: false,
      label: "Authorised Signatory",
    });
    expect(
      mapSignature(
        state((invoice) => {
          invoice.billedBy = {};
          invoice.customLabels = { for: "On behalf of" };
        })
      )
    ).toMatchObject({
      forLabel: "On behalf of",
      label: "Authorized Signatory",
    });

    const footer = mapFooter(
      state((invoice) => {
        invoice.contact = { phone: "+91 2" };
      })
    );
    expect(footer.contact).toMatchObject({ email: "", phone: "+91 2" });
    expect(mapFooter(state()).contact).toBeNull();
  });

  describe("Batch Summary (refrens.com, invoice 0014)", () => {
    const batchRow = {
      itemName: "Motherboard",
      sku: "SKU-0001",
      batch: {
        batchName: "FEB 2026",
        batchCode: "B-0001",
        manufacturerName: "MSI",
        expiryDate: "2027-02-01T00:00:00.000Z",
      },
      warehouse: "000000000000000000000001",
      warehouseName: "WH0001",
      quantity: 12,
    };
    const withBatches = (invoice: Json, root: Json) => {
      invoice.batchSummary = [batchRow];
      invoice.advanceOptions.showStockSummary = true;
      root.batchSummary = [batchRow];
    };

    it("prints the account's columns, with the SKU and batch code where asked", () => {
      const summary = mapBatchSummary(
        state((invoice, root) => {
          withBatches(invoice, root);
          invoice.stockSummaryConfig = {
            batchSummaryColumns: [
              { key: "itemName", label: "Item Name", showSku: true },
              { key: "batchName", label: "Batch Name", showBatchCode: true },
              { key: "quantity", label: "Qty" },
              { key: "warehouse", label: "Warehouse" },
              { key: "manufacturerName", label: "Mfg Name" },
              { key: "manufacturingDate", label: "Mfg Date" },
              { key: "expiryDate", label: "Expiry Date" },
              { key: "sku", label: "SKU", isHidden: true },
              { label: "No key" },
            ],
          };
        }),
        ctx
      );
      expect(summary.show).toBe(true);
      expect(summary.title).toBe("Batch Summary");
      expect(summary.columns.map((c) => c.label)).toEqual([
        "Item Name",
        "Batch Name",
        "Qty",
        "Warehouse",
        "Mfg Name",
        "Mfg Date",
        "Expiry Date",
      ]);
      expect(summary.rows[0]).toEqual([
        { value: "Motherboard (SKU-0001)" },
        { value: "FEB 2026 (B-0001)" },
        { value: "12", isNum: true },
        { value: "WH0001" },
        { value: "MSI", isDate: false },
        { value: "", isDate: true },
        { value: "2027-02-01T00:00:00.000Z", isDate: true },
      ]);
    });

    it("falls back to refrens.com's columns, without codes, and hides when switched off", () => {
      const plain = mapBatchSummary(
        state((invoice, root) => {
          withBatches(invoice, root);
          invoice.batchSummary = [{ quantity: 2, batchName: "Lot 7" }];
          root.batchSummary = invoice.batchSummary;
        }),
        ctx
      );
      expect(plain.columns.map((c) => c.key)).toEqual([
        "itemName",
        "batchName",
        "quantity",
        "warehouse",
        "manufacturerName",
        "manufacturingDate",
        "expiryDate",
      ]);
      expect(plain.rows[0].slice(0, 2)).toEqual([
        { value: "" },
        { value: "Lot 7" },
      ]);
      const off = mapBatchSummary(
        state((invoice, root) => {
          withBatches(invoice, root);
          invoice.advanceOptions.showStockSummary = false;
        }),
        ctx
      );
      expect(off.show).toBe(false);
      expect(mapBatchSummary(state(), ctx).show).toBe(false);
    });

    it("renders it after the tax summary, before the payments", () => {
      const html = render(withBatches);
      expect(html).toContain("data-ceres-batch-summary");
      expect(html).toMatch(
        /<h3 class="ceres-table-heading">Batch Summary<\/h3>/
      );
      expect(html).toMatch(/<td>FEB 2026<\/td>/);
      const source = fs.readFileSync(
        path.join(
          __dirname,
          "../src/templates/modern-manufacturing-template/template.hbs"
        ),
        "utf8"
      );
      const at = (marker: string) =>
        source.indexOf(`<div class="mm-widget-box mm-widget-table" ${marker}`);
      expect(at("data-ceres-tax-summary")).toBeLessThan(
        at("data-ceres-batch-summary")
      );
      expect(at("data-ceres-batch-summary")).toBeLessThan(
        at("data-ceres-payment-table")
      );
      expect(render()).not.toContain("data-ceres-batch-summary");
    });
  });

  it("heads the HSN and tax summaries, and lines their columns up", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.taxSummaryView = "TABLE";
    });
    expect(html).toMatch(
      /data-ceres-hsn-summary>\s*<h3 class="ceres-table-heading">HSN Summary<\/h3>\s*<table class="mm-hsn-table">/
    );
    expect(html).toMatch(
      /data-ceres-tax-summary>\s*<h3 class="ceres-table-heading">Tax Summary<\/h3>/
    );
    // Tax Rate as narrow as the HSN summary's HSN column; Rate, Amount and Total share the rest.
    const styles = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const width = (n: number, part: string) =>
      new RegExp(
        `\\[data-ceres-tax-summary\\]\\s*\\.ceres-table:has\\(tbody tr:first-child > :nth-child\\(${n}\\):last-child\\)\\s*thead\\s*tr:first-child\\s*> ${part} \\{\\s*width: ([\\d.]+)%;`
      ).exec(styles)?.[1];
    // IGST: 4 columns here, 5 in the HSN summary (20% each); CGST + SGST: 6 here, 7 there.
    expect(width(4, ":first-child")).toBe("20");
    expect(width(4, ":not\\(:first-child, \\[colspan\\]\\)")).toBe("26.6667");
    expect(width(4, '\\[colspan="2"\\]')).toBe("53.3333");
    expect(width(6, ":first-child")).toBe("14.2857");
    expect(width(6, ":not\\(:first-child, \\[colspan\\]\\)")).toBe("17.1429");
    const named = buildModernManufacturingView(
      state((invoice) => {
        invoice.customLabels = {
          ...invoice.customLabels,
          hsnSummary: "HSN/SAC",
          taxSummary: "GST",
        };
      })
    );
    expect(named.hsn.title).toBe("HSN/SAC");
    expect(named.taxSummaryTitle).toBe("GST");
  });

  it("assembles the view, with fallbacks for a sparse document", () => {
    const view = buildModernManufacturingView(state());
    expect(view.brand).toMatchObject({
      name: "Vertex Foundry Components",
      logo: "",
    });
    expect(view.brand).not.toHaveProperty("initials");
    expect(view.parties.map((party) => party?.title)).toEqual([
      "Bill To (Buyer)",
      "Ship To (Consignee)",
    ]);
    expect(view.payments.show).toBe(false);

    const sparse = buildModernManufacturingView(
      state((invoice, root) => {
        invoice.billedBy = {};
        invoice.shippedFrom = { name: "Works" };
        invoice.advanceOptions.showPaymentsTable = false;
        root.showPaymentsTable = false;
      })
    );
    expect(sparse.brand).toMatchObject({
      name: "",
      seller: null,
    });
    expect(sparse.parties.map((party) => party?.title)).toEqual([
      "Bill To (Buyer)",
      "Ship To (Consignee)",
    ]);
    // Shipped From pairs with Transport in the dispatch row, not with the parties.
    expect(sparse.shippedFrom?.title).toBe("Shipped From");
    expect(sparse.hasDispatch).toBe(true);
    expect(sparse.payments.show).toBe(false);
    // Seven details (transport in the grid) wrap four a row; five or fewer share one row.
    expect(view.detailColumns).toBe(4);
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.template = { transportPosition: "section" };
          invoice.dueDate = "2026-10-21";
        })
      ).detailColumns
    ).toBe(5);
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.invoiceNumber = "";
          invoice.purchaseOrderNumber = "";
          invoice.customFields = [];
          invoice.customHeaders = [];
          invoice.dueDate = "";
          invoice.transportDetails = {};
          invoice.irn = {};
        })
      ).detailColumns
    ).toBeLessThan(5);

    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.advanceOptions.showPaymentsTable = false;
          invoice.showPaymentsTable = false;
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments.show
    ).toBe(false);
    // Only when the document turns "Show Payments Table" on (as refrens.com).
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments
    ).toEqual({ show: true, heading: "Payments" });
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          delete invoice.advanceOptions.showPaymentsTable;
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments.show
    ).toBe(false);
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          delete invoice.advanceOptions.showPaymentsTable;
          invoice.showPaymentsTable = true;
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments.show
    ).toBe(true);
  });

  it("prints at true size, stretching the table where the business asks", () => {
    // No zoom of its own: the text scale, the printable width and the stretch flags only.
    expect(mapPrint({})).toEqual({
      textScale: "1",
      printWidth: 714,
      browserPrintWidth: 714,
      paperHeight: 1122,
      photoCap: 596,
      bandCap: 241,
      stretchTable: false,
      pageless: false,
    });
    // The printable width caps the page in print (Refrens' PDF service lays the page out in
    // a wider window): paper less the side margins, under the print zoom, 4 px kept back.
    expect(printWidth({})).toBe(714);
    // The paper's height, which a one-page document fits within (the long side, or the
    // short one in landscape).
    expect(paperHeight({})).toBe(1122);
    expect(paperHeight({ format: "a5", landscape: true })).toBe(559);
    expect(printWidth({ format: "A5", xMargins: "0.5" })).toBe(517);
    // 0 cm is a real margin, not unset: the page takes the paper's whole width.
    expect(printWidth({ xMargins: "0" })).toBe(789);
    expect(printWidth({ xMargins: 0 })).toBe(789);
    expect(printWidth({ format: "letter", landscape: true })).toBe(976);
    expect(printWidth({ zoomSize: "0.8" })).toBe(714);
    // A large photo is at most 55 % of the page from the paper itself, never the window (vh).
    expect(photoCap({})).toBe(596);
    expect(photoCap({ format: "a5" })).toBe(415);
    expect(photoCap({ landscape: true })).toBe(415);
    expect(photoCap({ zoomSize: "1.2" })).toBe(496);
    expect(photoCap({ zoomSize: "0.8" })).toBe(596);
    expect(printWidth({ zoomSize: "1.1", format: "unknown" })).toBe(641);
    // The letterhead and footer repeated on every page stay under a quarter of a browser
    // print's page (1 cm margins), less their 16 px gap and 4 px: Chrome stops repeating a
    // taller table header or footer, and the fixed footer then covered the content.
    expect(repeatedBandCap({})).toBe(241);
    expect(repeatedBandCap({ landscape: true })).toBe(159);
    expect(repeatedBandCap({ format: "a5", landscape: true })).toBe(100);
    expect(repeatedBandCap({ zoomSize: "1.2" })).toBe(198);
    expect(repeatedBandCap({ zoomSize: "0.8" })).toBe(241);
    // "Stretch invoice & quotation tables to fill the page": the business's setting
    // (experimental.stretchInvoiceTable) alone; the document's own toggle is ignored.
    const allowed = {
      invoice: {
        owner: {
          configuration: { experimental: { stretchInvoiceTable: true } },
        },
      },
    };
    [true, "true", false, "false", undefined].forEach((fullHeightTable) => {
      expect(
        mapPrint({ ...allowed, pdfOptions: { fullHeightTable } }).stretchTable
      ).toBe(true);
      expect(mapPrint({ pdfOptions: { fullHeightTable } }).stretchTable).toBe(
        false
      );
    });
    expect(mapPrint(allowed).stretchTable).toBe(true);
    // Lydia's Pageless PDF, by any of its names.
    expect(mapPrint({ pdfOptions: { pageless: true } }).pageless).toBe(true);
    expect(mapPrint({ pdfOptions: { isPageless: "true" } }).pageless).toBe(
      true
    );
    expect(mapPrint({ pdfOptions: { longPdf: 1 } }).pageless).toBe(true);
    expect(mapPrint({ pdfOptions: { pageless: false } }).pageless).toBe(false);
    // Text scale as a ratio or a percentage, kept within 0.3–2.
    expect(mapPrint({ pdfOptions: { textScale: 1.1 } }).textScale).toBe("1.1");
    expect(mapPrint({ pdfOptions: { scale: "120" } }).textScale).toBe("1.2");
    expect(mapPrint({ pdfOptions: { textScale: 0.1 } }).textScale).toBe("0.3");
    expect(mapPrint({ pdfOptions: { textScale: 500 } }).textScale).toBe("2");
    expect(mapPrint({ pdfOptions: { textScale: "x" } }).textScale).toBe("1");

    const html = render((invoice) => {
      invoice.template = { pdfOptions: { format: "a5", textScale: 1.1 } };
    });
    expect(html).toContain(
      'style="--mm-text-scale: 1.1; --mm-print-width: 479px; --mm-browser-print-width: 479px; --mm-photo-cap: 415px; --mm-band-cap: 159px;"'
    );
    expect(html).not.toContain("--mm-print-zoom");
    expect(html).not.toContain("is-print-compact");
  });

  it("places the document QR in the header, beside the seller", () => {
    const html = render((invoice) => {
      invoice.documentQr = '{"encoded":"text"}';
    });
    const header = html.slice(
      html.indexOf('data-section="header"'),
      html.indexOf("</header>")
    );
    expect(header).toMatch(
      /mm-seller[\s\S]*class="mm-qr mm-header-qr" data-ceres-field-container="documentQr">\s*<img data-ceres-field="documentQr" src="data:image\//
    );
    expect(html.match(/data-ceres-field="documentQr"/g)).toHaveLength(1);
    // Without a QR the header slot stays for the renderer, hidden.
    expect(render()).toContain('class="mm-qr mm-header-qr is-empty"');
  });

  it("takes the theme colour and layout positions from the document's template settings", () => {
    // The default blue keeps the stylesheet's own #013d7f / #bddcff.
    expect(mapSettings(state())).toEqual({
      theme: null,
      transportInGrid: true,
      notesBeside: true,
    });
    expect(
      mapSettings(
        state((invoice) => {
          invoice.template = { primaryColor: "#013D7F" };
        })
      ).theme
    ).toBeNull();
    // Any other colour is set inline with a light tint for the header dividers.
    expect(
      mapSettings(
        state((invoice) => {
          invoice.template = {
            primaryColor: "#f60",
            transportPosition: "section",
            notesPosition: "row",
          };
        })
      )
    ).toEqual({
      theme: { accent: "#ff6600", tint: "#ffd7bd" },
      transportInGrid: false,
      notesBeside: false,
    });
    expect(
      mapSettings(
        state((invoice) => {
          invoice.template = { primaryColor: "rgb(1,2,3)" };
        })
      ).theme
    ).toBeNull();
    // The tint keeps the hue: one per colour-wheel sector, and grey stays grey.
    expect(
      [
        "#ff0000",
        "#ffff00",
        "#00ff00",
        "#00ffff",
        "#0000ff",
        "#ff00ff",
        "#808080",
      ].map(themeTint)
    ).toEqual([
      "#ffbdbd",
      "#ffffbd",
      "#bdffbd",
      "#bdffff",
      "#bdbdff",
      "#ffbdff",
      "#dedede",
    ]);

    const html = render((invoice) => {
      invoice.template = { primaryColor: "#ff6900" };
    });
    expect(html).toContain("--mm-theme: #ff6900; --mm-theme-tint: #ffd8bd;");
    expect(render()).not.toContain("--mm-theme");
  });

  it("registers the view helper only when Handlebars is present", () => {
    expect(() => registerModernManufacturingHelpers(undefined)).not.toThrow();
    const helpers: Record<string, (...args: unknown[]) => unknown> = {};
    registerModernManufacturingHelpers({
      registerHelper: (name, helper) => {
        helpers[name] = helper;
      },
    });
    expect((helpers.mmView({}) as Json).title).toBe("");
    expect(helpers.mmDate("2026-09-20T18:30:00.000Z", "-04:00", {})).toBe(
      "20-Sep-2026"
    );
    // A missing offset arrives as Handlebars' options object: fall back to IST.
    expect(helpers.mmDate("2026-09-20T18:30:00.000Z", { hash: {} })).toBe(
      "21-Sep-2026"
    );
  });
});

describe("Modern Manufacturing template — CSS (spec tokens and scope)", () => {
  const source = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  /*
   * Every size is "calc(var(--mm-font-size-<step>) * var(--mm-text-scale, 1))", the steps set
   * on .mm-doc (design-to-template §4a); assertions read the step's screen size.
   */
  const SCREEN_SCALE: Record<string, string> = Object.fromEntries(
    Array.from(
      source
        .slice(0, source.indexOf("@media"))
        .matchAll(/--mm-font-size-(\w+): (\d+px);/g),
      (m) => [m[1], m[2]]
    )
  );
  const css = source.replace(
    /calc\(var\(--mm-font-size-(\w+)\) \* var\(--mm-text-scale, 1\)\)/g,
    (_, step: string) => SCREEN_SCALE[step]
  );
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    return match ? match[1] : "";
  };

  it("uses the spec's colour tokens", () => {
    const root = rule(".mm-doc");
    [
      // The document's theme colour first, then the renderer's, then the v2 default blue.
      "--mm-accent: var(--mm-theme, var(--primary-color, #013d7f));",
      "--mm-accent-200: var(--mm-theme-tint, #bddcff);",
      "--mm-ink: var(--secondary-color, #1a2130);",
      "--mm-strong: var(--secondary-color, #282828);",
      "--mm-muted: #666670;",
      "--mm-line: #d1d6e0;",
      "--mm-table-outline: #dcdcdc;",
      "--mm-cell-line: #d1d6db;",
      "--mm-stripe: #f9fafc;",
      "--mm-title-bar: #f5f7fa;",
      "--mm-signature-ink: #1e293b;",
      "--mm-signature-muted: #64748b;",
    ].forEach((token) => expect(root).toContain(token));
    expect(rule(".mm-items")).toMatch(
      /border: 1px solid var\(--mm-table-outline\);\s*border-radius: 6px;/
    );
    expect(rule(".mm-items thead th")).toMatch(
      /border-inline-end: 1px solid var\(--mm-accent-200\);/
    );
  });

  it("follows the type scale on Inter (body text 13 px, user request)", () => {
    expect(
      css.startsWith(
        '@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800'
      )
    ).toBe(true);
    expect(rule(".mm-doc")).toMatch(/font-size: 13px;/);
    // No logo, no monogram stand-in (user request).
    expect(css).not.toContain("mm-monogram");
    expect(rule(".mm-brand-name")).toMatch(
      /font-size: 18px;\s*line-height: [\d.]+;\s*font-weight: 600;/
    );
    expect(rule(".mm-banner .mm-banner-title")).toMatch(
      /font-size: 20px;\s*line-height: [\d.]+;\s*font-weight: 600;/
    );
    // The copy tag reads like the subtitle (user request).
    expect(rule(".mm-copy")).toMatch(
      /font-size: 13px;\s*line-height: [\d.]+;\s*font-weight: 400;/
    );
    expect(rule(".mm-copy")).not.toMatch(/opacity/);
    // Title, copy tag and status together at the start; the subtitle takes the free space.
    expect(rule(".mm-banner .mm-banner-title")).toMatch(
      /margin-inline-end: 0;/
    );
    expect(rule(".mm-subtitle")).toMatch(/margin-inline-start: auto;/);
    // The whole address in grey, the street too (user, 2026-10-20).
    expect(rule(".mm-seller-address")).toMatch(/color: var\(--mm-muted\);/);
    expect(rule(".mm-seller-street")).toMatch(
      /color: var\(--mm-muted\);\s*font-weight: 400;/
    );
    // No weight above 600 but the grand total amount (user request): not even text the
    // browser or the notes library makes bold, and the box titles are 600 too.
    expect(css).not.toMatch(/font-weight: 700;/);
    expect(css).toMatch(
      /\.mm-doc :is\(strong, b, th\),\s*\.mm-doc \.toastui-editor-contents :is\(strong, b\) \{\s*font-weight: 600;/
    );
    expect(rule(".mm-party-label")).toMatch(/font-weight: 600;/);
    // Field values (transport, bank, additional information) at 500 (user request).
    expect(rule(".mm-kv-value")).toMatch(/font-weight: 600;/);
    expect(rule(".mm-info-value")).toMatch(/font-weight: 500;/);
    expect(css).toMatch(
      /600, not the shared widget's 700\. \*\/\n\.mm-totals \.ceres-subtotal-row-grand > \.ceres-subtotal-value \{\s*font-weight: 600;/
    );
    expect(rule(".mm-items thead th")).toMatch(/font-weight: 600;/);
    expect(rule(".mm-item-name")).toMatch(/font-weight: 600;/);
    expect(rule(".mm-signature-for")).toMatch(/font-weight: 600;/);
    expect(rule(".mm-party-name")).toMatch(
      /font-size: 13px;\s*line-height: [\d.]+;\s*font-weight: 600;/
    );
    // UPI note 12 px (user request; the spec had 11 px).
    expect(rule(".mm-upi-note")).toMatch(/font-size: 13px;/);
    // Rows after the grand total are ruled off from the words line.
    expect(css).toMatch(
      /\.mm-totals:has\(\.ceres-subtotal-table-extra, \.ceres-subtotal-table-due\) \.mm-words \{\s*padding-top: 8px;\s*border-top: 1px solid var\(--mm-line\);/
    );
    expect(rule(".mm-section-title")).toMatch(
      /font-size: 13px;[^}]*font-weight: 600;/
    );
    expect(css).toMatch(
      /\[data-role="grand-total"\]\s*\{[^}]*font-size: 18px;\s*line-height: [\d.]+;\s*font-weight: 600;/
    );
    // Grand total label 18/500.
    expect(css).toMatch(
      /\.ceres-subtotal-row-grand > \.ceres-subtotal-label \{\s*font-weight: 500;/
    );
    // Nothing below the 10 px floor.
    Array.from(css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g), (m) =>
      Number(m[1])
    ).forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
  });

  it("uses the spec's spacing: sections, boxes, cells and images", () => {
    // 16 px between sections (user request).
    expect(rule(".mm-doc")).toMatch(/gap: 16px;/);
    expect(rule(".mm-banner")).toMatch(/gap: 12px;\s*padding: 10px 12px;/);
    // One 32 px gutter at the sides, as the default template has (user request: Lydia adds
    // none); the letterhead and footer run through it to the page's edges, and the gutter
    // keeps the content off the top / bottom edge when there is no letterhead / footer.
    expect(rule(".mm-doc")).toMatch(
      /--mm-gutter: 32px;[\s\S]*padding: 0 var\(--mm-gutter\);/
    );
    expect(
      rule(".mm-doc .mm-letterhead,\n.mm-doc .mm-letterhead-footer")
    ).toMatch(
      /width: auto;\s*margin-right: calc\(-1 \* var\(--mm-gutter\)\);\s*margin-left: calc\(-1 \* var\(--mm-gutter\)\);/
    );
    expect(rule(".mm-doc:has(.mm-letterhead.is-empty)")).toMatch(
      /padding-top: var\(--mm-gutter\);/
    );
    expect(rule(".mm-doc:has(> .mm-letterhead-footer.is-empty)")).toMatch(
      /padding-bottom: var\(--mm-gutter\);/
    );
    // On paper the paper's margins give the space.
    expect(source.slice(source.indexOf("@media print"))).toMatch(
      /--mm-gutter: 0px;/
    );
    expect(rule(".mm-pair-box")).toMatch(/padding: 12px;/);
    // Parties: padding 14, 6 px between lines.
    expect(css).toMatch(
      /\.mm-parties > \.mm-pair-box,\s*\.mm-dispatch > \.mm-pair-box \{\s*gap: 6px;\s*padding: 12px;/
    );
    expect(rule(".mm-detail")).toMatch(/gap: 4px;[\s\S]*padding: 12px;/);
    expect(rule(".mm-detail .mm-value")).toMatch(/font-weight: 600;/);
    expect(rule(".mm-banner")).toMatch(/border-radius: 6px;/);
    // Item headers and cells: 6 px on every side, the row ends too (user request).
    expect(css).toMatch(
      /\.mm-items th,\s*\.mm-items td\s*\{[^}]*padding: 6px;/
    );
    expect(css).not.toMatch(
      /\.mm-items tr > :first-child,\s*\.mm-items tr > :last-child \{/
    );
    expect(rule(".mm-items tr > .mm-col-serial")).toBe("");
    // 8 px between a box title and its content; 12 px between groups.
    expect(rule(".mm-note-group")).toMatch(/gap: 8px;/);
    expect(rule(".mm-note-block")).toMatch(/gap: 12px;/);
    // Additional Info: labels share a column as wide as the longest (100 px at the least, half
    // the box at most, user request), 8 px to the value, rows 6 px apart.
    expect(rule(".mm-info-rows")).toMatch(
      /grid-template-columns: fit-content\(50%\) minmax\(0, 1fr\);\s*gap: 6px 8px;/
    );
    expect(rule(".mm-info-row")).toMatch(/display: contents;/);
    expect(rule(".mm-info-label")).toMatch(/min-width: 100px;/);
    // Summary tables (HSN, tax summary, payment record): cells 6 × 8 px, the same at the
    // row ends (user request).
    expect(css).toMatch(
      /\.mm-hsn-table th,\s*\.mm-hsn-table td\s*\{[^}]*padding: 6px;/
    );
    expect(css).not.toMatch(/padding-(left|right): 18px;/);
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th,\s*\.mm-widget-table \.ceres-table td\s*\{\s*padding: 6px;/
    );
    // The summary headings (HSN Summary, Tax Summary, Batch Summary, Payments) share a rule.
    expect(
      rule(
        ".mm-widget-table .ceres-table-heading,\n.mm-hsn .ceres-table-heading"
      )
    ).toMatch(/padding: 6px;/);
    // Columns share the width evenly (user request; the spec had 150 px numeric columns).
    expect(rule(".mm-hsn-table")).toMatch(/table-layout: fixed;/);
    expect(rule(".mm-widget-table .ceres-table")).toMatch(/min-width: 560px;/);
    // Summary columns share the width: 4 columns → 25% each (no fixed layout: the words line
    // spans colspan="99").
    expect(css).toMatch(
      /\.ceres-table:has\(tbody tr:first-child > :nth-child\(4\):last-child\)\s*:is\(th, td\):not\(\[colspan\]\) \{\s*width: 25%;/
    );
    // Summary tables centre every column but the first (user request).
    expect(css).toMatch(
      /\.mm-hsn-table th,\s*\.mm-hsn-table td\s*\{[^}]*text-align: center;/
    );
    expect(rule(".mm-hsn-table .is-text")).toMatch(/text-align: start;/);
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th,\s*\.mm-widget-table \.ceres-table td\s*\{[^}]*text-align: center;/
    );
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th:first-child,\s*\.mm-widget-table \.ceres-table td:first-child,\s*\.mm-widget-table \.ceres-table-words\s*\{\s*text-align: start;/
    );
    // Only a two-row heading hides the rule under its first row.
    expect(css).toContain(
      ".mm-widget-table .ceres-table thead tr:first-child:not(:only-child) th:not([colspan])"
    );
    expect(rule(".mm-items .ceres-image-gallery")).toMatch(/gap: 8px;/);
    // One 16 px section gap above the signature too (user request).
    expect(rule(".mm-signature-section")).not.toMatch(/margin-top/);
    // The signature block (and its rule) grows with its text, 240 px at the least.
    expect(rule(".mm-signature")).toMatch(
      /width: max-content;\s*min-width: min\(240px, 100%\);\s*max-width: 100%;/
    );
    expect(rule(".mm-signature-line")).toMatch(/width: 100%;/);
  });

  it("gives every text size its line height on a 4 px rhythm", () => {
    // 11 → 16, 12 → 18, 13 → 20, 14 → 20, 16 → 24, 18 → 24, 20 → 24 px, as ratios so they scale.
    const expected: Record<string, string> = {
      "11": "1.4545",
      "12": "1.5",
      "13": "1.5385",
      "14": "1.4286",
      "16": "1.5",
      "18": "1.3333",
      "20": "1.2",
    };
    const blocks = Array.from(css.matchAll(/\{([^{}]*)\}/g), (m) => m[1]);
    const sized = blocks.filter((body) => /font-size: \d+px/.test(body));
    expect(sized.length).toBeGreaterThan(15);
    sized.forEach((body) => {
      const size = (body.match(/font-size: (\d+)px/) as RegExpMatchArray)[1];
      expect(body).toContain(`line-height: ${expected[size]};`);
    });
    // No leftover fixed or "normal" line heights.
    expect(source).not.toMatch(/line-height: (1\.4|normal);/);
  });

  it("scales every text size by the document's text scale", () => {
    const sizes = Array.from(
      source.matchAll(/(?:^|[\s;{])font-size:\s*([^;]+);/g),
      (m) => m[1]
      // Relative sizes (inherit, 0.9em for squeezed figures) follow their parent's step.
    ).filter((size) => size !== "inherit" && !/^[\d.]+em$/.test(size));
    expect(sizes.length).toBeGreaterThan(15);
    sizes.forEach((size) =>
      expect(size).toMatch(
        // A wide printed table also shrinks by its fit (--mm-print-fit), never under 10 px.
        /^(calc\(var\(--mm-font-size-(xs|s|base|m|lg|xl)\) \* var\(--mm-text-scale, 1\)\)|max\(10px, calc\(var\(--mm-font-size-(s|base)\) \* var\(--mm-text-scale, 1\) \* var\(--mm-print-fit, 1\)\)\))$/
      )
    );
  });

  it("follows the repo type preset: six steps, printed 1:1 as on screen, 10 px floor", () => {
    const steps = (block: string) =>
      Object.fromEntries(
        Array.from(block.matchAll(/--mm-font-size-(\w+): (\d+)px;/g), (m) => [
          m[1],
          Number(m[2]),
        ])
      );
    const print = source.slice(source.indexOf("@media print"));
    const screen = steps(source.slice(0, source.indexOf("@media")));
    const paper = steps(print);
    // m is the banner title: 16 px on screen and paper (user request).
    expect(screen).toEqual({ xs: 10, s: 11, base: 13, m: 16, lg: 18, xl: 20 });
    // Print uses the screen's sizes, headings too (user, 2026-10-21: print 1:1).
    expect(paper).toEqual({});
    // Nothing below 10 px anywhere (the parser found declarations, so this is not vacuous).
    const all = Array.from(
      source.matchAll(/(?:font-size|--mm-font-size-\w+):\s*(\d+(?:\.\d+)?)px/g),
      (m) => Number(m[1])
    );
    expect(all.length).toBeGreaterThanOrEqual(6);
    all.forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
    // No page-fit zoom: print is true size; the renderer's print size does the scaling. The one
    // zoom is the last resort of a table still too wide at the 10 px floor, never cut off.
    expect(source.match(/zoom:[^;]*;/g)).toEqual([
      "zoom: var(--mm-print-squeeze, 1);",
      "zoom: var(--mm-print-squeeze, 1);",
    ]);
  });

  it("prints at true size on the full printable width, fitting a wide table", () => {
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(/\.mm-doc \{[^}]*width: 100%;[^}]*margin: 0 auto;/);
    // The planner's screen widths give way to the page; a table wider than it fits by shrinking.
    expect(print).toMatch(
      /\.mm-doc \.mm-items th\[style\] \{\s*width: auto !important;/
    );
    expect(print).toMatch(
      /\.mm-items\.is-print-fit \{\s*font-size: max\(10px, calc\(var\(--mm-font-size-base\) \* var\(--mm-text-scale, 1\) \* var\(--mm-print-fit, 1\)\)\);/
    );
    expect(print).toMatch(
      /\.mm-items\.is-print-fit :is\(th, td\) \{\s*padding-right: 4px;\s*padding-left: 4px;/
    );
    expect(source).not.toContain("is-print-compact");
    expect(print).toMatch(
      /\.mm-items thead,[^{]*\{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.mm-items tfoot,[^{]*\{\s*display: table-row-group;/
    );
    expect(print).toMatch(
      /\.mm-items-scroll,\s*\.mm-widget-box \{\s*overflow: clip;/
    );
    // Boxes never split across pages: the selector list ends in this very rule.
    expect(print).toMatch(
      /\.mm-header,\s*\.mm-banner,\s*\.mm-details,\s*\.mm-box,\s*\.mm-pair,\s*\.mm-summary-row,\s*\.mm-doc > \.mm-letterhead-footer \{\s*\/\*[^*]*\*\/\s*break-inside: avoid;/
    );
    // The screen frame's display: contents is weak enough for print to restore the table.
    expect(source).toMatch(
      /\.mm-page-frame > :where\(thead, tbody\),\s*\.mm-page-frame > :where\(thead, tbody\) > tr,/
    );
    // A table split across pages ends under its last row on each page: the cells draw the
    // outline and every row closes with its own bottom rule.
    expect(print).toMatch(/\.mm-items \{\s*border: 0;\s*\}/);
    expect(print).toMatch(
      /\.mm-items tbody td,\s*\.mm-items tfoot td \{\s*border-top: 0;\s*border-bottom: 1px solid var\(--mm-line\);/
    );
    expect(print).toMatch(
      /\.mm-items tr > th:last-child,\s*\.mm-items tr > td:last-child \{\s*border-inline-end: 1px solid var\(--mm-table-outline\);/
    );
    // The page box and margins stay with the browser or PDF service.
    expect(source).not.toMatch(/@page/);
  });

  it("pins a repeating footer to the foot of every printed page", () => {
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(
      /\.mm-letterhead-footer\.mm-footer-fixed \{\s*position: fixed;\s*bottom: 0;\s*left: 0;\s*width: 100%;/
    );
    expect(print).toMatch(
      /\.mm-page-frame-footer \{\s*display: table-footer-group;/
    );
    expect(print).toMatch(/\.mm-footer-spacer \{[^}]*visibility: hidden;/);
    // On screen the frame is transparent.
    expect(css).toMatch(/\.mm-page-body \{\s*display: contents;/);
  });

  it("prints headings, labels and table headers in the business's own case", () => {
    // They are editable labels: no rule may force upper case (or any other case).
    expect(source).not.toMatch(/text-transform/);
  });

  it("colours the party and transport box titles with the theme", () => {
    expect(rule(".mm-party-label")).toMatch(/color: var\(--mm-accent\);/);
  });

  it("splits the HSN and tax tables' width equally between their columns", () => {
    expect(rule(".mm-widget-table .ceres-table")).toMatch(
      /table-layout: fixed;/
    );
    expect(rule(".mm-hsn-table")).toMatch(/table-layout: fixed;/);
    // A tax heading over Rate | Amount takes two shares of a four-column table.
    expect(css).toMatch(
      /:nth-child\(4\):last-child\)\s*\[colspan="2"\] \{\s*width: 50%;/
    );
    // Long entries wrap inside their own column instead of running into the next.
    const cells = rule(
      ".mm-widget-table .ceres-table th,\n.mm-widget-table .ceres-table td"
    );
    expect(cells).toMatch(/overflow-wrap: anywhere;/);
    expect(cells).not.toMatch(/nowrap/);
    // The Batch Summary is sized by its content, words kept whole (user request).
    expect(rule("[data-ceres-batch-summary] .ceres-table")).toMatch(
      /table-layout: auto;/
    );
    expect(css).toMatch(
      /\.mm-widget-table:not\(\[data-ceres-batch-summary\]\)\s*\.ceres-table:has/
    );
    // The Payments table keeps its earlier layout (user request): content-sized; its words wrap
    // only when the entries need the room (an A5 page), its figures never (td[data-mm-figure]).
    expect(rule("[data-ceres-payment-table] .ceres-table")).toMatch(
      /table-layout: auto;/
    );
    expect(
      rule(
        "[data-ceres-payment-table] .ceres-table th,\n[data-ceres-payment-table] .ceres-table td"
      )
    ).not.toMatch(/white-space: nowrap;/);
  });

  it("sets one party field a line, its name in a column as in the Transport box", () => {
    expect(rule(".mm-party-fields")).toMatch(
      /display: grid;\s*grid-template-columns: auto auto;\s*justify-content: start;\s*gap: 4px 16px;/
    );
    expect(css).not.toMatch(/\.mm-party:only-child \.mm-party-fields/);
    expect(rule(".mm-field")).toMatch(/display: contents;/);
    // The name column is as wide as the longest name: no 100 px floor, no empty gap.
    expect(css).not.toMatch(/30cqi/);
    // Party boxes: title 4 px above the name, name / address / fields 4 px apart.
    expect(rule(".mm-party-head")).toMatch(/gap: 4px;/);
    expect(rule(".mm-parties > .mm-party,\n.mm-dispatch > .mm-party")).toMatch(
      /gap: 4px;/
    );
    expect(rule(".mm-field .mm-value")).toMatch(/font-weight: 600;/);
    // Header and IRN lines ("GSTIN: …") read the same way: the name 400 grey, the value 500 ink.
    expect(rule(".mm-id-label")).toMatch(
      /color: var\(--mm-muted\);\s*font-weight: 400;/
    );
    expect(rule(".mm-id-line")).toMatch(/color: var\(--mm-ink\);/);
    // The header's seller fields: the party rows, across the seller column's width.
    expect(rule(".mm-seller-fields")).toMatch(/align-self: stretch;/);
    expect(css).not.toMatch(/mm-seller-ids/);
  });

  it("sets the logo and the seller details side by side on the left", () => {
    expect(rule(".mm-brand")).toMatch(
      /display: flex;\s*flex: 1 1 auto;\s*flex-wrap: wrap;\s*align-items: flex-start;\s*gap: 14px;\s*min-width: 0;/
    );
    // Left-aligned, taking the room up to the QR; under the logo below 260 px.
    expect(rule(".mm-seller")).toMatch(
      /display: flex;\s*flex: 1 1 260px;\s*flex-direction: column;\s*align-items: flex-start;\s*gap: 8px;\s*min-width: 0;/
    );
    expect(rule(".mm-seller")).not.toMatch(/text-align: end/);
    expect(rule(".mm-brand-name")).toMatch(
      /max-width: 100%;[\s\S]*overflow-wrap: break-word;/
    );
    expect(rule(".mm-logo")).toMatch(/flex: 0 1 auto;\s*min-width: 0;/);
    // Brand | QR 20 px apart (Figma).
    expect(rule(".mm-header")).toMatch(/gap: 20px;/);
  });

  it("lets a details cell hug a value that cannot wrap", () => {
    expect(rule(".mm-details")).toMatch(
      /grid-template-columns: repeat\(\s*var\(--mm-detail-columns, 5\),\s*minmax\(min-content, 1fr\)\s*\);/
    );
  });

  it("prints the enquiry line in the main text colour", () => {
    expect(rule(".mm-contact")).toMatch(/color: var\(--mm-ink\);/);
  });

  it("spaces identifier lines 4 px apart wherever they are", () => {
    expect(rule(".mm-id-grid")).toMatch(/gap: 4px 12px;/);
    // In the header too, from the left, beside the logo (user, 2026-10-20).
    expect(rule(".mm-seller .mm-id-grid")).toBe("");
    expect(css).not.toContain(
      ".mm-seller .mm-id-grid > .mm-id-line > .mm-id:only-child"
    );
    expect(css).not.toContain(":last-child:nth-child(odd)");
  });

  it("gives running text room to read: 22 px lines, points 4 px apart", () => {
    expect(css).toMatch(
      /\.mm-terms,\s*\.mm-attachments,\s*\.mm-note-body,\s*\.mm-item-desc \{\s*line-height: 1\.6923;/
    );
    expect(css).toMatch(
      /\.mm-terms > li \+ li,\s*\.mm-attachments > li \+ li,[^{]*\.mm-note-body \.toastui-editor-contents li \+ li,[^{]*\.mm-item-desc \.toastui-editor-contents li \+ li \{\s*margin-top: 4px;/
    );
  });

  it("sets the bank details rows 6 px apart", () => {
    expect(rule(".mm-bank-rows")).toMatch(/gap: 4px 16px;/);
  });

  it("heads tables in descriptions and notes like the summary tables", () => {
    expect(
      rule(
        ".mm-doc .mm-item-desc .toastui-editor-contents th,\n.mm-doc .mm-note-body .toastui-editor-contents th"
      )
    ).toMatch(
      /border-color: var\(--mm-line\);\s*background: var\(--mm-title-bar\);\s*color: var\(--mm-accent\);\s*font-weight: 600;/
    );
    // Headings and cells read from the left (user request).
    expect(
      rule(
        ".mm-doc .mm-item-desc .toastui-editor-contents :is(th, td),\n.mm-doc .mm-note-body .toastui-editor-contents :is(th, td)"
      )
    ).toMatch(/text-align: start;/);
    // The same bar and text colour as the HSN summary's heading.
    expect(rule(".mm-hsn-table thead th")).toMatch(
      /background: var\(--mm-title-bar\);\s*color: var\(--mm-accent\);/
    );
  });

  it("keeps each attachment on one line, cut off with an ellipsis", () => {
    expect(rule(".mm-attachments > li")).toMatch(
      /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/
    );
    expect(rule(".mm-attachments a")).not.toMatch(/word-break/);
  });

  it("draws list bullets and numbers in the text colour", () => {
    expect(css).toMatch(
      /\.mm-note-body \.toastui-editor-contents ul > li::before \{\s*background-color: currentcolor;/
    );
    expect(css).toMatch(
      /\.mm-note-body \.toastui-editor-contents ol > li::before \{\s*color: inherit;/
    );
  });

  it("gives a field alone on its line the whole line", () => {
    expect(rule(".mm-id-grid > .mm-id-line > .mm-id:only-child")).toMatch(
      /grid-column: 1 \/ -1;/
    );
  });

  it("lays an item's inline codes side by side", () => {
    // 11 px (user request), muted.
    expect(rule(".mm-item-code")).toMatch(/font-size: 11px;/);
    expect(rule(".mm-item-codes")).toMatch(
      /display: flex;\s*flex-wrap: wrap;\s*gap: 4px 12px;/
    );
  });

  it("shows the business logo up to 120 px tall and every QR at 120 px", () => {
    expect(rule(".mm-logo .mm-logo-image")).toMatch(
      /max-width: min\(240px, 100%\);\s*max-height: 120px;/
    );
    expect(rule(".mm-qr.mm-header-qr img")).toMatch(
      /width: 120px;\s*height: 120px;/
    );
    expect(rule(".mm-qr img")).toMatch(/width: 120px;\s*height: 120px;/);
    expect(rule(".mm-upi-qr")).toMatch(/width: 120px;\s*height: 120px;/);
    expect(rule(".mm-scan-title")).toMatch(/width: 120px;/);
  });

  it("draws item images with square corners", () => {
    expect(rule(".mm-thumbnail")).toMatch(/border-radius: 0;/);
    expect(rule(".mm-items .ceres-image-gallery .ceres-image")).toMatch(
      /border-radius: 0;/
    );
    expect(rule(".mm-large-image")).not.toMatch(/border-radius/);
  });

  it("keeps figures on one line; original images fill their row", () => {
    expect(rule(".mm-num")).toMatch(/white-space: nowrap;/);
    // A value holding two numbers ("12345678901 / 12345678901") stays on one line too: the bank
    // and transport halves widen for it rather than wrap it (user rule).
    expect(rule(".mm-kv-value.mm-num")).toBe("");
    expect(rule(".mm-summary-row")).toMatch(
      /grid-template-columns: repeat\(2, minmax\(min-content, 1fr\)\);/
    );
    expect(rule(".mm-bank-rows")).toMatch(
      /minmax\(100px, max-content\) minmax\(min-content, 1fr\)/
    );
    expect(rule(".mm-dispatch")).toMatch(
      /repeat\(2, minmax\(min-content, 1fr\)\)/
    );
    expect(rule(".mm-widget-table .ceres-table td[data-mm-figure]")).toMatch(
      /white-space: nowrap;/
    );
    // On a phone the summary tables read as cards, like the HSN summary.
    expect(css).toMatch(
      /\.mm-doc \.mm-widget-table \.ceres-table td\[data-label\]::before \{[^}]*content: attr\(data-label\);/
    );
    // Party fields: one a line, never split onto stacked rows.
    expect(css).not.toMatch(/\.mm-id-line\.is-stacked/);
    expect(rule(".mm-large-image")).toMatch(
      /width: 100%;\s*max-width: 100%;\s*height: auto;/
    );
    // The full-width description row has no divider after its empty Sr cell.
    expect(rule(".mm-items .mm-detail-row > td.mm-col-serial")).toMatch(
      /border-inline-end: 0;/
    );
    expect(rule(".mm-items-scroll")).toMatch(/overflow-x: auto;/);
    expect(css).not.toMatch(/\.mm-num[^{]*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});

describe("Modern Manufacturing — description and note tables in print", () => {
  it("repeats a description or note table's headings on every page, breaking between its rows", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(
      /\.mm-doc :is\(\.mm-item-desc, \.mm-note-body\) \.toastui-editor-contents thead \{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.mm-doc :is\(\.mm-item-desc, \.mm-note-body\) \.toastui-editor-contents tr \{\s*break-inside: avoid;/
    );
  });
});

describe("Modern Manufacturing — seller block", () => {
  it("prints no heading over the seller block on any document type", () => {
    [
      "INVOICE",
      "QUOTATION",
      "PROFORMAINV",
      "DELIVERYCHALLAN",
      "CREDITNOTE",
    ].forEach((billType) => {
      const html = render((invoice) => {
        invoice.billType = billType;
      });
      expect(html).not.toContain("mm-seller-title");
      expect(html).not.toMatch(/>(?:Billed By|Quotation From|Issued By)</);
    });
  });
});

describe("Modern Manufacturing — boxes split by a page break", () => {
  it("draws a split box's border on each page's piece", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const print = source.slice(
      source.indexOf("A box split by a page break closes")
    );
    expect(print).toContain(
      ":is(.mm-box, .mm-pair, .mm-pair-box, .mm-bank, .mm-summary-row, .mm-widget-box)"
    );
    expect(print).toMatch(/box-decoration-break: clone;/);
  });
});
