import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/modern-manufacturing-template.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/modern-manufacturing-template/template.hbs";
import {
  batchText,
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
  mapItemTable,
  mapMeta,
  mapNotes,
  mapAdditionalInfo,
  mapParty,
  mapPrint,
  mapSupply,
  mapSettings,
  themeTint,
  mapSignature,
  mapTotals,
  mapTransport,
  thumbnailOf,
  mapWords,
  placeOfSupplyText,
  registerModernManufacturingHelpers,
  moneyDigits,
  withMoneyDefaults,
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
      "41,966.70",
      "For Vertex Foundry Components",
      "Authorised Signatory",
    ].forEach((expected) => expect(html).toContain(expected));
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
    const header = html.slice(
      html.indexOf('data-testid="items-header"'),
      html.indexOf("</thead>")
    );
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
    // The IRN block sits below the dispatch row, above the supply row and the items.
    expect(html.indexOf('class="mm-box mm-compliance"')).toBeGreaterThan(
      html.indexOf('data-section="dispatch"')
    );
    expect(html.indexOf('class="mm-box mm-compliance"')).toBeLessThan(
      html.indexOf('class="mm-supply-row"')
    );
  });

  it("puts transport in the details grid, or in its own box beside Shipped From", () => {
    // Default (spec v2): E-Way Bill No., Vehicle No., Transporter in the grid, before Place
    // of Supply; no dispatch row.
    const html = render();
    const details = html.slice(
      html.indexOf('data-section="details"'),
      html.indexOf('data-section="parties"')
    );
    expect(details).toMatch(
      /2610 9890 1234[\s\S]*KA01AB1234[\s\S]*Speedway Logistics Pvt Ltd/
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
    const html = render();
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

  it("leads the header with the company name alone when there is no logo", () => {
    const html = render((invoice) => {
      invoice.logo = "";
    });
    const brand = (html.match(/<div class="mm-brand">([\s\S]*?)<\/div>/) ||
      [])[1];
    expect(brand).toContain('class="mm-brand-name"');
    expect(brand).not.toContain("mm-logo");
    expect(html).not.toContain("mm-monogram");
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
    // IRN on its own line; Ack No. | Ack Date side by side, like the party fields.
    expect(html).toMatch(
      /<p class="mm-id-line mm-irn-row"><span class="mm-id">IRN: <span class="mm-irn-value" data-ceres-field="irn">IRN123<\/span><\/span><\/p>\s*<p class="mm-id-line"><span class="mm-id">Ack No\.: <span class="mm-num" data-testid="num">ACK1<\/span><\/span><span class="mm-id">Ack Date: /
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
      invoice.hsnSummary = invoice.hsnSummary.map((row: Json) => ({
        ...row,
        igst: row.cgst * 2,
        cessAmount: 1,
      }));
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
    // A foreign-currency document: every figure carries its currency and decimals, the
    // business-currency line follows, and the rate reads "BGN 1 = ₹57.22".
    const bgn = mapTotals(
      state((invoice) => {
        invoice.currency = "BGN";
        delete invoice.subUnitLength;
        invoice.conversionRates = { INR: 57.22 };
        invoice.owner.currency = "INR";
        invoice.finalTotal.total = 625975;
      })
    );
    const grand = bgn.main.find((row) => row.key === "total");
    expect(grand?.value).toBe("BGN\u00a06,25,975.00");
    expect(grand?.converted).toBe("₹3,58,18,289.50");
    expect(bgn.main.find((row) => row.key === "conversionRate")?.value).toBe(
      "BGN\u00a01 = ₹57.22"
    );
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
        { trnNumber: "T1", contactPerson: { name: "Asha" } }
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
    expect(party.ids).toEqual([
      { key: "gstin", label: "GSTIN", value: "27ABC" },
      { key: "vat", label: "VAT Number", value: "VAT-1" },
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
      ["GSTIN=27ABC", "VAT Number=VAT-1"],
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
    expect(other.ids).toEqual([{ key: "vat", label: "TRN", value: "TRN" }]);
    expect(other.contacts).toEqual([]);
    expect(party.hasIdLines).toBe(true);
    // GSTIN | PAN and Phone | Email share one grid in the party box, so their columns align.
    const html = render((doc) => {
      doc.billedTo.phone = "+91 1";
    });
    const bill = html.slice(html.indexOf("is-bill-to"));
    expect(bill).toMatch(
      /<div class="mm-id-grid">\s*<p class="mm-id-line"><span class="mm-id">GSTIN:[\s\S]*<\/p>\s*<p class="mm-id-line"><span class="mm-id">Phone:/
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
      '<p class="mm-id-line"><span class="mm-id">date: <span class="mm-num" data-testid="num">13-Oct-2026</span></span><span class="mm-id">Note: <span>Gate 2 after noon</span></span></p>'
    );
    // The header labels phone and email too.
    const header = fields.slice(0, fields.indexOf("</header>"));
    expect(header).toContain(
      '<span class="mm-id">Phone: <span class="mm-num" data-testid="num">+91 831 298 7000</span></span>'
    );
    expect(header).toContain(
      '<span class="mm-id">Email: <span class="mm-email">sales@vertexfoundry.com</span></span>'
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

    // Their own row above the items; the live toggles target the row (the shared toggle)
    // and the Place of Supply cell; hidden parts stay in the page for them.
    const html = render();
    const row = html.slice(
      html.indexOf('<div class="mm-supply-row"'),
      html.indexOf('data-section="items"')
    );
    expect(row).toMatch(
      /^<div class="mm-supply-row" data-ceres-country-of-supply>/
    );
    expect(
      render((invoice) => {
        invoice.advanceOptions.hideCountryOfSupply = true;
      })
    ).toContain(
      '<div class="mm-supply-row" data-ceres-country-of-supply style="display:none">'
    );
    expect(row).toContain(
      '<p class="mm-supply-cell"><span class="mm-supply-label">Country of Supply:</span> <span class="mm-supply-value">India</span></p>'
    );
    expect(row).toContain(
      '<p class="mm-supply-cell" data-ceres-place-of-supply><span class="mm-supply-label">Place of Supply:</span> <span class="mm-supply-value">Maharashtra (27)</span></p>'
    );
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
          vehicleType: "Truck",
          transport: "Road",
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
    expect(byKey.distance.value).toBe("120");
    expect(byKey.subSupplyType.value).toBe("Job work");
    expect(byKey.vehicleNumber).toBeUndefined();

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
    expect(live.qr).toEqual({
      irn: "data:image/png;base64,QQ",
      zatca: "data:image/png;base64,ZZ",
      lhdn: "",
      document: "https://cdn.example/doc-qr.png",
    });

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
    // MERGE_QUANTITY folds the unit into the Qty cell; Unit gets no column of its own.
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
    expect(figma).toMatchObject({ mergeUnit: false, smallNumbers: false });

    // Too wide: shrink to content, then merge Unit into Qty, then smaller numbers.
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
      mergeUnit: false,
      smallNumbers: false,
    });
    expect(planTableLayout(wide(8, "1,250.00")).widths.c0).toBe(70);
    expect(planTableLayout(wide(6, "12,50,000.00"))).toMatchObject({
      mergeUnit: true,
      smallNumbers: false,
    });
    expect(planTableLayout(wide(10, "1,23,45,67,890.00"))).toMatchObject({
      mergeUnit: true,
      smallNumbers: true,
    });
    // Without a Unit column, the chain skips straight to smaller numbers.
    expect(planTableLayout(wide(10, "12,50,000.00", false))).toMatchObject({
      mergeUnit: false,
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
    expect(intra.labels.hsn).toBe("HSN/SAC");
    expect(intra.rows[3]).toMatchObject({
      hsn: "8483",
      total: "₹41,966.70",
    });
    expect(intra.totals.total).toBe("₹1,22,088.70");
    // Tax in words under the Total row: CGST + SGST here, across all five columns.
    expect(intra.words).toEqual({
      label: "Total Tax In Words",
      value:
        "EIGHTEEN THOUSAND SIX HUNDRED TWENTY THREE RUPEES AND SEVENTY PAISE ONLY",
    });
    expect(intra.columnCount).toBe(5);
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
      /<tr class="mm-hsn-words">\s*<td colspan="5">Total Tax In Words: EIGHTEEN THOUSAND/
    );

    const inter = mapHsnSummary(
      state((invoice) => {
        invoice.igst = true;
        invoice.columns = invoice.columns.filter(
          (col: Json) => col.key !== "hsn"
        );
        invoice.customLabels.hsnSac = "HSN Code";
        invoice.advanceOptions = { showHSNSummaryInInvoice: false };
        invoice.hsnSummary = {
          hsnList: [
            { hsn: "7307", taxableValue: 100, igst: 18, cessAmount: 1 },
            { hsn: "", taxableValue: 5 },
          ],
        };
      }),
      ctx
    );
    expect(inter.showIgst).toBe(true);
    expect(inter.hasCess).toBe(true);
    // IGST + Cess: 18 + 1 in words; HSN, Taxable, IGST, Cess, Total.
    expect(inter.words.value).toBe("NINETEEN RUPEES ONLY");
    expect(inter.columnCount).toBe(5);
    expect(inter.isHidden).toBe(true);
    expect(inter.labels.hsn).toBe("HSN Code");
    expect(inter.rows).toEqual([
      expect.objectContaining({ igst: "₹18.00", total: "₹119.00" }),
    ]);
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
      "Bank Name=Bank",
      "Account No.=123",
      "IFSC=IFSC1",
      "IBAN=IBAN1",
      "BIC=SWIFT1",
      "Sort Code=SC",
      "Account Type=Current",
      "Branch=Main",
      "MICR=400",
    ]);
    expect(bank.upi).toEqual({
      label: "UPI",
      id: "vertex@bank",
      scanLabel: "Scan to Pay",
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
    expect(
      mapWords(
        state((invoice) => {
          invoice.customLabels.totalInWordsValue = "";
          invoice.currency = "USD";
        })
      )
    ).toBeNull();
    expect(
      mapWords(
        state((invoice) => {
          invoice.hideTotalInWords = true;
        })
      )
    ).toBeNull();
    expect(
      mapWords(
        state((invoice) => {
          invoice.advanceOptions.hideTotals = true;
        })
      )
    ).toBeNull();
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
    expect(mapAdditionalInfo(state(), ctx)?.title).toBe("Additional Info");

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
          invoice.showPaymentsTable = false;
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments.show
    ).toBe(false);
    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.allPayments = [{ amount: 10 }];
        })
      ).payments.show
    ).toBe(true);
  });

  it("prints at true size and compacts a table too wide for the paper", () => {
    // No zoom of its own: only the text scale and the compact-table flag.
    expect(mapPrint({})).toEqual({ textScale: "1", compactTable: false });
    // A4: 718 px printable (the document has no padding of its own); Description keeps 22%.
    expect(mapPrint({}, 560).compactTable).toBe(false);
    expect(mapPrint({}, 561).compactTable).toBe(true);
    expect(mapPrint({ pdfOptions: { format: "A5" } }, 377).compactTable).toBe(
      false
    );
    expect(mapPrint({ pdfOptions: { format: "A5" } }, 378).compactTable).toBe(
      true
    );
    expect(
      mapPrint({ pdfOptions: { format: "letter" } }, 577).compactTable
    ).toBe(false);
    expect(
      mapPrint({ pdfOptions: { format: "letter" } }, 578).compactTable
    ).toBe(true);
    expect(
      mapPrint({ pdfOptions: { format: "tabloid" } }, 561).compactTable
    ).toBe(true);
    // The renderer zooms <html> by zoomSize (not at 0.8), which narrows the page.
    expect(mapPrint({ pdfOptions: { zoomSize: 1.2 } }, 466).compactTable).toBe(
      false
    );
    expect(mapPrint({ pdfOptions: { zoomSize: 1.2 } }, 467).compactTable).toBe(
      true
    );
    expect(
      mapPrint({ pdfOptions: { zoomSize: "0.8" } }, 560).compactTable
    ).toBe(false);
    expect(mapPrint({ pdfOptions: { zoomSize: 0 } }, 561).compactTable).toBe(
      true
    );
    // Larger text needs more room.
    expect(mapPrint({ pdfOptions: { textScale: 1.1 } }, 520).compactTable).toBe(
      true
    );
    // Text scale as a ratio or a percentage, kept within 0.3–2.
    expect(mapPrint({ pdfOptions: { textScale: 1.1 } }).textScale).toBe("1.1");
    expect(mapPrint({ pdfOptions: { scale: "120" } }).textScale).toBe("1.2");
    expect(mapPrint({ pdfOptions: { textScale: 0.1 } }).textScale).toBe("0.3");
    expect(mapPrint({ pdfOptions: { textScale: 500 } }).textScale).toBe("2");
    expect(mapPrint({ pdfOptions: { textScale: "x" } }).textScale).toBe("1");

    const html = render((invoice) => {
      invoice.template = { pdfOptions: { format: "a5", textScale: 1.1 } };
    });
    expect(html).toContain('style="--mm-text-scale: 1.1;"');
    expect(html).not.toContain("--mm-print-zoom");
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
      "--mm-ink: #1a2130;",
      "--mm-strong: #282828;",
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
      /border-right: 1px solid var\(--mm-accent-200\);/
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
      /font-size: 14px;\s*line-height: [\d.]+;\s*font-weight: 700;/
    );
    expect(rule(".mm-copy")).toMatch(
      /font-size: 13px;\s*line-height: [\d.]+;\s*font-weight: 600;/
    );
    // The seller's street in bold, then city, state and country in grey (user request, as the
    // spec had it).
    expect(rule(".mm-seller-address")).toMatch(/color: var\(--mm-muted\);/);
    expect(rule(".mm-seller-street")).toMatch(
      /color: var\(--mm-strong\);\s*font-weight: 600;/
    );
    expect(rule(".mm-items thead th")).toMatch(/font-weight: 700;/);
    expect(rule(".mm-item-name")).toMatch(/font-weight: 700;/);
    expect(rule(".mm-signature-for")).toMatch(/font-weight: 700;/);
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
      /font-size: 13px;[^}]*font-weight: 700;/
    );
    expect(css).toMatch(
      /\[data-role="grand-total"\]\s*\{[^}]*font-size: 18px;\s*line-height: [\d.]+;\s*font-weight: 800;/
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
    expect(rule(".mm-doc")).toMatch(/gap: 16px;/);
    // No padding of its own (user request): Lydia's business margins are the only ones, and
    // the letterhead footer sits on the page's edge.
    expect(rule(".mm-doc")).toMatch(/padding: 0;/);
    expect(source).not.toMatch(/\.mm-doc \{[^}]*padding: (?!0;)/);
    expect(rule(".mm-pair-box")).toMatch(/padding: 12px;/);
    // Parties: padding 14, 6 px between lines.
    expect(css).toMatch(
      /\.mm-parties > \.mm-pair-box,\s*\.mm-dispatch > \.mm-pair-box \{\s*gap: 6px;\s*padding: 14px;/
    );
    expect(rule(".mm-detail")).toMatch(/gap: 4px;[\s\S]*padding: 10px;/);
    // Item cells 8 × 6, plus 8 px at the row ends.
    expect(css).toMatch(
      /\.mm-items th,\s*\.mm-items td\s*\{[^}]*padding: 8px 6px;/
    );
    // The row-end 8 px is split evenly on both sides of the first and last cells.
    expect(css).toMatch(
      /\.mm-items tr > :first-child,\s*\.mm-items tr > :last-child \{\s*padding-right: 10px;\s*padding-left: 10px;/
    );
    expect(rule(".mm-items tr > .mm-col-serial")).toMatch(
      /padding-right: 8px;\s*padding-left: 8px;/
    );
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
      /\.mm-hsn-table th,\s*\.mm-hsn-table td\s*\{[^}]*padding: 6px 8px;/
    );
    expect(css).not.toMatch(/padding-(left|right): 18px;/);
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th,\s*\.mm-widget-table \.ceres-table td\s*\{\s*padding: 6px 8px;/
    );
    expect(rule(".mm-widget-table .ceres-table-heading")).toMatch(
      /padding: 6px 8px;/
    );
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
    expect(rule(".mm-hsn-table .is-text")).toMatch(/text-align: left;/);
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th,\s*\.mm-widget-table \.ceres-table td\s*\{[^}]*text-align: center;/
    );
    expect(css).toMatch(
      /\.mm-widget-table \.ceres-table th:first-child,\s*\.mm-widget-table \.ceres-table td:first-child,\s*\.mm-widget-table \.ceres-table-words\s*\{\s*text-align: left;/
    );
    // Only a two-row heading hides the rule under its first row.
    expect(css).toContain(
      ".mm-widget-table .ceres-table thead tr:first-child:not(:only-child) th:not([colspan])"
    );
    expect(rule(".mm-items .ceres-image-gallery")).toMatch(/gap: 8px;/);
    expect(rule(".mm-signature-section")).toMatch(/margin-top: 16px;/);
    // The signature block (and its rule) grows with its text, 240 px at the least.
    expect(rule(".mm-signature")).toMatch(
      /width: max-content;\s*min-width: min\(240px, 100%\);\s*max-width: 100%;/
    );
    expect(rule(".mm-signature-line")).toMatch(/width: 100%;/);
  });

  it("gives every text size its line height on a 4 px rhythm", () => {
    // 11 → 16, 12 → 18, 13 → 20, 14 → 20, 18 → 24, 20 → 24 px, as ratios so they scale.
    const expected: Record<string, string> = {
      "11": "1.4545",
      "12": "1.5",
      "13": "1.5385",
      "14": "1.4286",
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
        /^calc\(var\(--mm-font-size-(xs|s|base|m|lg|xl)\) \* var\(--mm-text-scale, 1\)\)$/
      )
    );
  });

  it("follows the repo type preset: six steps, 13 px base in print, 10 px floor", () => {
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
    expect(screen).toEqual({ xs: 10, s: 11, base: 13, m: 14, lg: 18, xl: 20 });
    // Print compresses only the steps above base.
    expect(paper).toEqual({ xs: 10, s: 11, base: 13, m: 14, lg: 16, xl: 18 });
    // Nothing below 10 px anywhere (the parser found declarations, so this is not vacuous).
    const all = Array.from(
      source.matchAll(/(?:font-size|--mm-font-size-\w+):\s*(\d+(?:\.\d+)?)px/g),
      (m) => Number(m[1])
    );
    expect(all.length).toBeGreaterThanOrEqual(12);
    all.forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
    // No page-fit zoom: print is true size; the renderer's print size does the scaling.
    expect(source).not.toMatch(/zoom:/);
  });

  it("prints at true size on the full printable width, compacting a wide table", () => {
    const print = source.slice(source.indexOf("@media print"));
    expect(print).toMatch(/\.mm-doc \{[^}]*width: 100%;[^}]*margin: 0;/);
    // The planner's screen widths give way to the page; a compact table drops to the s step.
    expect(print).toMatch(
      /\.mm-doc \.mm-items th\[style\] \{\s*width: auto !important;/
    );
    expect(print).toMatch(
      /\.mm-items\.is-print-compact \{\s*font-size: calc\(var\(--mm-font-size-s\)/
    );
    expect(print).toMatch(
      /\.mm-items\.is-print-compact :is\(th, td\) \{\s*padding-right: 4px;\s*padding-left: 4px;/
    );
    expect(print).toMatch(
      /\.mm-items thead,[^{]*\{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.mm-items tfoot,[^{]*\{\s*display: table-row-group;/
    );
    expect(print).toMatch(
      /\.mm-items-scroll,\s*\.mm-widget-box \{\s*overflow: clip;/
    );
    expect(print).toMatch(/\.mm-box,[\s\S]*?break-inside: avoid;/);
    // A table split across pages ends under its last row on each page: the cells draw the
    // outline and every row closes with its own bottom rule.
    expect(print).toMatch(/\.mm-items \{\s*border: 0;\s*\}/);
    expect(print).toMatch(
      /\.mm-items tbody td,\s*\.mm-items tfoot td \{\s*border-top: 0;\s*border-bottom: 1px solid var\(--mm-line\);/
    );
    expect(print).toMatch(
      /\.mm-items tr > th:last-child,\s*\.mm-items tr > td:last-child \{\s*border-right: 1px solid var\(--mm-table-outline\);/
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

  it("moves the company name below a logo it cannot fit beside", () => {
    expect(rule(".mm-brand")).toMatch(/flex-wrap: wrap;/);
    expect(rule(".mm-brand-name")).toMatch(
      /flex: 1 1 160px;\s*min-width: min\(160px, 100%\);/
    );
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
    // In the header they are set from the right: a one-field line in the right-hand column,
    // a field wrapping from a fuller line in the left one (as live; user request).
    expect(rule(".mm-seller .mm-id-grid")).toMatch(
      /justify-content: end;\s*text-align: right;/
    );
    expect(
      rule(".mm-seller .mm-id-grid > .mm-id-line > .mm-id:only-child")
    ).toMatch(/grid-column: -2 \/ -1;/);
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
    expect(rule(".mm-bank-rows")).toMatch(/gap: 6px 24px;/);
  });

  it("heads tables in descriptions and notes like the summary tables", () => {
    expect(
      rule(
        ".mm-doc .mm-item-desc .toastui-editor-contents th,\n.mm-doc .mm-note-body .toastui-editor-contents th"
      )
    ).toMatch(
      /border-color: var\(--mm-line\);\s*background: var\(--mm-title-bar\);\s*color: var\(--mm-accent\);\s*font-weight: 700;/
    );
    // Headings and cells read from the left (user request).
    expect(
      rule(
        ".mm-doc .mm-item-desc .toastui-editor-contents :is(th, td),\n.mm-doc .mm-note-body .toastui-editor-contents :is(th, td)"
      )
    ).toMatch(/text-align: left;/);
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
      /max-width: 240px;\s*max-height: 120px;/
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
    expect(rule(".mm-large-image")).toMatch(
      /width: 100%;\s*max-width: 100%;\s*height: auto;/
    );
    // The full-width description row has no divider after its empty Sr cell.
    expect(rule(".mm-items .mm-detail-row > td.mm-col-serial")).toMatch(
      /border-right: 0;/
    );
    expect(rule(".mm-items-scroll")).toMatch(/overflow-x: auto;/);
    expect(css).not.toMatch(/\.mm-num[^{]*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});
