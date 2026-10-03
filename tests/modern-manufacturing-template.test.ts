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
  formatMoney,
  formatQuantity,
  initials,
  mapBank,
  mapCompliance,
  mapFooter,
  mapHsnSummary,
  mapItemTable,
  mapMeta,
  mapNotes,
  mapParty,
  mapSignature,
  mapWords,
  placeOfSupplyText,
  registerModernManufacturingHelpers,
  tableDensity,
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

const ctx = { locale: "en-IN", digits: 2 };

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
      "date(2026-09-14T18:30:00.000Z)",
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
      "INR One Lakh Twenty-Two Thousand Eighty-Eight and Seventy Paise Only",
      "Declaration",
      "Terms &amp; Conditions",
      "41,966.70",
      "For Vertex Foundry Components",
      "Authorised Signatory",
    ].forEach((expected) => expect(html).toContain(expected));
  });

  it("prints the account's own column labels in the account's order", () => {
    const html = render((invoice) => {
      invoice.columns[0].label = "Part Description";
    });
    const headers = Array.from(
      html.matchAll(/<th class="mm-col-[^"]*">([^<]*)<\/th>/g),
      (match) => match[1]
    );
    expect(headers).toEqual([
      "Sr.",
      "Part Description",
      "Batch",
      "HSN/SAC",
      "Qty",
      "Unit",
      "Rate",
      "Taxable",
      "CGST",
      "SGST",
      "Amount",
    ]);
    // Hidden by the account (gstRate) or by normalization (igst, zero discount).
    expect(html).not.toContain(">GST Rate<");
    expect(html).not.toContain(">IGST<");
    expect(html).not.toContain(">Discount<");
  });

  it("keeps every live-update hook the host patches", () => {
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
    expect(html).toMatch(/data-ceres-tax-summary style="display:none"/);
    expect(html).toMatch(/data-ceres-payment-table>/);
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
      /data-ceres-description-full-width>\s*<div class="mm-item-desc" data-ceres-description-content><div class="md">Machined to drawing/
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
    expect(html).toContain("utc(2026-09-21 10:00:00)");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain("Awaiting Digital Signature");
    expect(html).toContain("U12345");
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

  it("renders the IGST variant of the summary and hides optional blocks", () => {
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
      invoice.invoiceTitle = "";
      invoice.copy = "";
    });
    expect(html).toContain("mm-settlement has-no-bank");
    expect(html).not.toContain("mm-title-bar");
    expect(html).not.toContain("mm-notes");
    expect(html).not.toContain("mm-parties");
    expect(html).toMatch(/<td class="mm-col-serial is-fixed">Total<\/td>/);
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
  it("formats money, quantities and the context", () => {
    expect(formatMoney("", ctx)).toBe("");
    expect(formatMoney(-1234.5, ctx)).toBe("(1,234.50)");
    expect(formatMoney("100000", ctx)).toBe("1,00,000.00");
    // An invalid locale falls back to fixed decimals instead of throwing.
    expect(formatMoney(5, { locale: "en_IN", digits: 2 })).toBe("5.00");
    expect(formatQuantity(null, ctx)).toBe("");
    expect(formatQuantity(1250.5, ctx)).toBe("1,250.5");
    expect(formatContext({ subUnitLength: 3, locale: "en-US" })).toEqual({
      locale: "en-US",
      digits: 3,
    });
    expect(
      formatContext({ subUnitLength: 1.5, owner: { locale: "de-DE" } })
    ).toEqual({ locale: "de-DE", digits: 2 });
    expect(formatContext({})).toEqual({ locale: "en-IN", digits: 2 });
    expect(initials("Vertex Foundry & Components")).toBe("VF");
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

    expect(party.addressLines).toEqual([
      "Unit 4, Tower B, Ring Road",
      "Pune – 411001, MH, India",
    ]);
    expect(party.ids).toEqual([
      { key: "gstin", label: "GSTIN", value: "27ABC" },
      { key: "vat", label: "VAT Number", value: "VAT-1" },
    ]);
    expect(party.contacts).toEqual(["b@example.com"]);
    expect(party.contactPerson).toBe("Asha");
    expect(party.extras.map((row: Json) => row.label)).toEqual([
      "CIN",
      "Vendor Code",
      "Region",
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
    expect(other.addressLines).toEqual([
      "Pune – 411001, Haveli, United Arab Emirates",
    ]);
    expect(other.ids).toEqual([{ key: "vat", label: "TRN", value: "TRN" }]);
    expect(other.contacts).toEqual([]);
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

  it("builds the meta grid from present values only, honouring settings", () => {
    const meta = mapMeta(
      state((invoice) => {
        invoice.dueDate = "2026-10-21";
        invoice.customHeaders = [{ label: "Indent", value: "IND-7" }];
        invoice.customFields.push(
          { label: "Advance", value: 500, dataType: "currency" },
          { label: "Lines", value: ["A", "B"], dataType: "text" },
          { label: "Hidden", value: "x", params: { showInInvoice: false } }
        );
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
        invoice.reverseCharge = true;
      }),
      ctx
    );
    const byKey = Object.fromEntries(meta.map((row) => [row.key, row]));
    expect(byKey.dueDate.isDate).toBe(true);
    expect(byKey.customHeader.value).toBe("IND-7");
    expect(
      meta.filter((row) => row.key === "customField").map((r) => r.value)
    ).toEqual(["2026-09-14T18:30:00.000Z", "500.00", "A, B"]);
    expect(byKey.transportMode.value).toBe("Road");
    expect(byKey.transportName.value).toBe("Fallback Carrier");
    expect(byKey.subSupplyType.value).toBe("Job work");
    expect(byKey.ewayBillDate.isUtcDate).toBe(true);
    expect(byKey.ewayCancelled.value).toBe("2026-09-22");
    expect(byKey.countryOfSupply.value).toBe("India");
    expect(byKey.countryOfSupply.isHidden).toBe(false);
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
      ctx
    );
    expect(off.some((row) => row.key.startsWith("eway"))).toBe(false);
    expect(off.find((row) => row.key === "reverseCharge")).toBeDefined();
    expect(off.find((row) => row.key === "placeOfSupply")?.isHidden).toBe(true);
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
    expect(cancelled.qr.document).toBe("");

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
    expect(first).toEqual({
      name: "Part",
      sku: "S1",
      unit: "PCS",
      quantity: "4 PCS",
      gstRate: "18%",
      margin: "12.5%",
      discount: "10%",
      rate: "100.00",
      cess: "2.00",
      freight: "30.00",
      duty: "4.00",
      weight: "2.25",
      grade: "A",
      finish: "Matt",
      colours: "Red, Blue",
      sgst: "9.00",
      total: "472.00",
    });
    const second = (table.rows[1] as Json).cells.find(
      (cell: Json) => cell.key === "discount"
    );
    expect(second.value).toBe("5.00");

    const footer = Object.fromEntries(
      table.footer.cells.map((cell) => [cell.key, cell.value])
    );
    // Rate never sums; percent discounts are not additive.
    expect(footer.rate).toBe("");
    expect(footer.discount).toBe("");
    expect(footer.quantity).toBe("5");
    expect(footer.weight).toBe("2.25");
    expect(footer.total).toBe("531.00");

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
    ).toBe("10.00");
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

  it("steps the table density down as its figures widen", () => {
    const columns = (count: number): ItemColumn[] =>
      Array.from({ length: count }, (_, index) => ({
        key: `c${index}`,
        label: "Long Header Word",
        kind: "money",
        className: "",
        summable: true,
      }));
    const rows = (count: number, value: string) => [
      { cells: columns(count).map((col) => ({ key: col.key, value })) },
      { isGroupHeader: true },
    ];
    const name: ItemColumn = {
      key: "name",
      label: "",
      kind: "name",
      className: "",
      summable: false,
    };

    expect(
      tableDensity([name, ...columns(4)], rows(4, "1,000.00"), [])
    ).toEqual({
      density: "",
      fit: "",
    });
    expect(tableDensity(columns(8), rows(8, "10,000.00"), [])).toEqual({
      density: "is-compact",
      fit: "",
    });
    expect(
      tableDensity(columns(8), rows(8, "100,000.00"), [
        { key: "c0", value: "" },
      ])
    ).toEqual({ density: "is-dense", fit: "" });
    expect(tableDensity(columns(12), rows(12, "18,44,49,856.65"), [])).toEqual({
      density: "is-dense",
      fit: "0.80",
    });
  });

  it("maps the HSN summary for either tax path", () => {
    const intra = mapHsnSummary(state(), ctx);
    expect(intra.hasRows).toBe(true);
    expect(intra.isHidden).toBe(false);
    expect(intra.labels.hsn).toBe("HSN/SAC");
    expect(intra.rows[3]).toMatchObject({
      hsn: "8483",
      rate: "18%",
      total: "41,966.70",
    });
    expect(intra.totals.total).toBe("1,22,088.70");

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
    expect(inter.isHidden).toBe(true);
    expect(inter.labels.hsn).toBe("HSN Code");
    expect(inter.rows).toEqual([
      expect.objectContaining({ rate: "", igst: "18.00", total: "119.00" }),
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
      label: "UPI ID",
      id: "vertex@bank",
      qr: "data:image/png;base64,UU",
    });

    const upiOnly = mapBank(
      state((invoice) => {
        invoice.paymentOptions = { upi: true };
        invoice.upi = { vpa: "pay@upi" };
      })
    );
    expect(upiOnly.rows).toEqual([]);
    expect(upiOnly.show).toBe(true);
    expect(upiOnly.upi?.qr).toBe("");

    const none = mapBank(
      state((invoice) => {
        invoice.paymentOptions = {};
      })
    );
    expect(none.show).toBe(false);
    expect(none.upi).toBeNull();
  });

  it("prints words from the stored value, else computes INR, else nothing", () => {
    expect(mapWords(state())?.value).toContain("One Lakh");
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
    expect(notes.notes?.title).toBe("Additional Notes");
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
      })
    );
    expect(defaults.notes).toBeNull();
    expect(defaults.terms[0].title).toBe("Terms and Conditions");
    expect(defaults.attachments).toBeNull();
    expect(defaults.hasAny).toBe(true);

    expect(
      mapNotes(
        state((invoice) => {
          invoice.hideNotes = true;
          invoice.terms = [];
        })
      ).hasAny
    ).toBe(false);
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
        invoice.customFooters = [
          { defaultValue: "Regd. Office", value: "Mumbai" },
          { label: "Empty", value: "" },
        ];
        invoice.contact = { phone: "+91 2" };
      })
    );
    expect(footer.rows).toEqual([
      { key: "footer", label: "Regd. Office", value: "Mumbai" },
    ]);
    expect(footer.contact).toMatchObject({ email: "", phone: "+91 2" });
    expect(mapFooter(state()).contact).toBeNull();
  });

  it("assembles the view, with fallbacks for a sparse document", () => {
    const view = buildModernManufacturingView(state());
    expect(view.brand).toMatchObject({
      name: "Vertex Foundry Components",
      initials: "VF",
      logo: "",
    });
    expect(view.parties.map((party) => party?.title)).toEqual([
      "Bill To (Buyer)",
      "Ship To (Consignee)",
    ]);
    expect(view.payments.hidden).toBe(false);

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
      initials: "",
      seller: null,
    });
    expect(sparse.parties.map((party) => party?.title)).toEqual([
      "Bill To (Buyer)",
      "Shipped From",
      "Ship To (Consignee)",
    ]);
    expect(sparse.payments.hidden).toBe(true);

    expect(
      buildModernManufacturingView(
        state((invoice) => {
          invoice.showPaymentsTable = false;
        })
      ).payments.hidden
    ).toBe(true);
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
  });
});

describe("Modern Manufacturing template — CSS rules", () => {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
  const printBlock = css.slice(css.indexOf("@media print"));

  it("never sets a font size below 10px, on screen or in print", () => {
    const sizes = Array.from(
      css.matchAll(
        /(?:font-size|--mm-font-size-[a-z]+)\s*:\s*(\d+(?:\.\d+)?)px/g
      ),
      (match) => Number(match[1])
    );
    expect(sizes.length).toBeGreaterThan(10);
    sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(10));
  });

  it("pins the base step at 13px on screen and in print", () => {
    const bases = Array.from(
      css.matchAll(/--mm-font-size-base:\s*(\d+)px/g),
      (match) => match[1]
    );
    expect(bases).toEqual(["13", "13"]);
    expect(printBlock).toContain("--mm-font-size-base: 13px");
  });

  it("keeps every spacing value on the 4px grid", () => {
    const declarations = Array.from(
      css.matchAll(
        /(?:^|[\s;{])((?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)*)\s*:\s*([^;]+);/g
      ),
      (match) => match[2]
    );
    expect(declarations.length).toBeGreaterThan(20);
    declarations.forEach((value) => {
      Array.from(value.matchAll(/(-?\d+(?:\.\d+)?)px/g), (match) =>
        Number(match[1])
      ).forEach((px) => expect(Math.abs(px) % 4).toBe(0));
    });
  });

  it("keeps figures and codes on one line", () => {
    expect(css).toMatch(
      /\.mm-items td\.is-fixed,\s*\.mm-items \.mm-col-serial\s*\{[^}]*white-space: nowrap;/
    );
    expect(css).toMatch(
      /\.mm-summary-table th,[^{]*\{[^}]*white-space: nowrap;/
    );
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere/);
  });
});
