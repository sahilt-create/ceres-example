import fs from "fs";
import path from "path";
import HandlebarsRuntime from "handlebars/runtime";
import fixture from "./fixtures/Ecommerce-Template.json";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import template from "../src/templates/Ecommerce-Template/template.hbs";
import {
  buildEcommerceView,
  copyLabel,
  formatDocumentDate,
  isSquareLogo,
  groupedNumber,
  paymentModeName,
  customFieldText,
  statusTag,
  amountInCurrencyWords,
  withGstColumnLabels,
  htmlToMarkdown,
  withRefrensDefaults,
  registerEcommerceHelpers,
  mapPrint,
  collapseBlankLines,
  hasMarkdownTable,
} from "../src/templates/Ecommerce-Template/helpers";
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
  "../src/templates/Ecommerce-Template"
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
  buildEcommerceView(state(edit));

/* The text of an element, tags dropped and spaces collapsed. */
const plain = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* The markup of the first <section data-section="…"> (to its closing tag). */
const section = (html: string, name: string): string => {
  const start = html.indexOf(`data-section="${name}"`);
  if (start < 0) return "";
  return html.slice(
    html.indexOf(">", start) + 1,
    html.indexOf("</section>", start)
  );
};

beforeAll(() => {
  registerEcommerceHelpers(HandlebarsRuntime);
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

describe("Ecommerce template — render", () => {
  it("lays the document out as the design: masthead, parties, references", () => {
    const html = render();
    expect(html).toContain('class="ec-frame"');
    expect(plain(section(html, "header"))).toContain(
      "Tax Invoice/Bill of Supply/Cash Memo (Original for Recipient)"
    );

    const roles = (markup: string) =>
      [...markup.matchAll(/class="ec-party" data-role="([a-z-]+)"/g)]
        .map((match) => match[1])
        .filter((role) => role !== "address");
    // Seller | buyer, then the shipping details on a row of their own below.
    const parties = section(html, "parties");
    const shipping = section(html, "shipping");
    expect(roles(parties)).toEqual(["seller", "billing"]);
    expect(roles(shipping)).toEqual(["shipping"]);
    expect(html.indexOf('data-section="shipping"')).toBeGreaterThan(
      html.indexOf('data-section="parties"')
    );
    const text = `${plain(parties)} ${plain(shipping)}`;
    expect(text).toContain("Sold By:");
    expect(text).toContain("Billing Address:");
    expect(text).toContain("Shipping Address:");
    expect(text).toContain("Bengaluru, Karnataka, India - 560055");
    expect(text).toContain("GSTIN: 29AAAAA0000A1Z5");
    // Nothing derived: no State/UT Code, no Place of delivery (user request).
    expect(text).not.toContain("State/UT Code");
    expect(text).toContain("Place of Supply: Karnataka (29)");
    expect(text).not.toContain("Place of delivery");
    // Country of Supply prints whenever the document has one, a domestic sale included.
    expect(text).toContain("Country of Supply: India");

    const details = section(html, "details");
    const [start, end] = details.split('class="ec-references-end"');
    expect(plain(start)).toContain("Order Number: 400-0000000-0000000");
    expect(plain(end)).toContain("Invoice Number: 2024000001");
    expect(plain(end)).toContain("Invoice Date: June 08, 2026");
  });

  it("totals only the tax and last money columns, then the words", () => {
    const html = render();
    const total = html.slice(
      html.indexOf('data-testid="items-total"'),
      html.indexOf("</tr>", html.indexOf('data-testid="items-total"'))
    );
    // TOTAL: under Sr.No and Description, then a cell per column so the column rules run on.
    expect(total).toMatch(/colspan="2"[^>]*><span class="ec-text">TOTAL:/);
    expect((total.match(/<td class="ec-total-value/g) || []).length).toBe(7);
    expect(plain(total.slice(total.indexOf(">") + 1))).toBe(
      "TOTAL: ₹599.76 ₹5,597.76"
    );
    // Every subtotal field prints under the TOTAL row (user request), then the words.
    const totals = section(html, "totals");
    ["(amount|subTotal)", "igst", "total"].forEach((key) =>
      expect(totals).toMatch(new RegExp(`data-ceres-subtotal-row="${key}`))
    );
    expect(plain(totals)).toMatch(
      /Amount In Words: FIVE THOUSAND FIVE HUNDRED NINETY SEVEN RUPEES AND SEVENTY SIX PAISE ONLY$/
    );
  });

  it("prints every subtotal field: sub total, discount and the total", () => {
    const { totals } = view((invoice) => {
      invoice.finalTotal = {
        ...invoice.finalTotal,
        amount: 4498,
        discount: 500,
        total: 5097.76,
      };
    });
    const keys = totals.main.map((row: Json) => row.key);
    expect(keys).toContain("subTotal");
    expect(keys).toContain("discount");
    expect(keys).toContain("total");
  });

  it("prints money with the currency symbol, centred under the headings", () => {
    const html = render();
    const row = html.slice(
      html.indexOf('data-testid="item-row"'),
      html.indexOf("</tr>", html.indexOf('data-testid="item-row"'))
    );
    expect(plain(row)).toContain(
      "₹2,499.00 2 ₹4,998.00 12% IGST ₹599.76 ₹5,597.76"
    );
    expect(html).toMatch(/data-col="sr" style="width: 43px">Sr\.No/);
  });

  it("heads the HSN and tax summaries like Batch Summary and Payments", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showHsnSummary = true;
      invoice.hsnSummary = { hsnList: [{ hsn: "9401", taxableValue: 100 }] };
    });
    expect(plain(section(html, "hsn"))).toMatch(/^HSN Summary/);
    expect(plain(section(html, "tax-summary"))).toMatch(/^Tax Summary/);
    // The business's own label wins.
    const renamed = render((invoice) => {
      invoice.customLabels = {
        ...invoice.customLabels,
        hsnSummary: "HSN/SAC Summary",
      };
    });
    expect(plain(section(renamed, "hsn"))).toMatch(/^HSN\/SAC Summary/);
  });

  it("puts the summary tables last: HSN, tax, stock, then payments", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.taxSummaryView = "BOTH";
    });
    const at = (name: string) => html.indexOf(`data-section="${name}"`);
    expect(at("notes")).toBeLessThan(at("hsn"));
    expect(at("hsn")).toBeLessThan(at("tax-summary"));
    expect(at("tax-summary")).toBeLessThan(at("payments"));
    expect(html.indexOf('data-testid="signature"')).toBeLessThan(at("hsn"));
  });

  it("fills the business's batch columns from the item's batch data, never a batch id", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showBatchColumnsInInvoice = true;
      const at =
        invoice.columns.findIndex((column: Json) => column.key === "name") + 1;
      invoice.columns.splice(
        at,
        0,
        { key: "batchCode", label: "Batch Code" },
        { key: "expiryDate", label: "Expiry Date" },
        { key: "batchName", label: "Batch Name", isHidden: true }
      );
      invoice.items[0].allocations = [
        {
          batch: "694cef3b77911c00116e9609",
          quantity: 1,
          batchData: {
            batchName: "Lot A",
            batchCode: "BTC0001",
            expiryDate: "2025-12-25T18:30:00.000Z",
          },
        },
      ];
    });
    const items = section(html, "items");
    expect(items).toContain(">Batch Code<");
    expect(items).toContain(">Expiry Date<");
    expect(plain(items)).toContain("BTC0001 December 26, 2025");
    expect(items).not.toContain("694cef3b77911c00116e9609");
    expect(items).not.toContain(">Batch<"); // no column of the template's own
    expect(items).not.toContain("Lot A"); // Batch Name is switched off
  });

  describe("batch summary (Show Batch Summary in Invoice)", () => {
    const withBatch = (invoice: Json) => {
      invoice.advanceOptions.showStockSummary = true;
      invoice.batchSummary = [
        {
          itemName: "Herbal Tea",
          sku: "TEA-01",
          warehouseName: "WH0001",
          quantity: 1,
          batch: {
            batchName: "Lot A",
            batchCode: "BTC0001",
            expiryDate: "2025-12-25T18:30:00.000Z",
          },
        },
      ];
      invoice.stockSummaryConfig = {
        batchSummaryColumns: [
          { key: "itemName", label: "Item Name", showSku: true },
          { key: "batchName", label: "Batch Name", showBatchCode: true },
          { key: "quantity", label: "Qty" },
          { key: "warehouse", label: "Warehouse" },
          { key: "manufacturerName", label: "Mfg Name" },
          { key: "manufacturingDate", label: "Mfg Date", isHidden: true },
          { key: "expiryDate", label: "Expiry Date" },
        ],
      };
    };

    it("is titled Batch Summary and prints the business's columns in their order", () => {
      const batch = section(render(withBatch), "batch-summary");
      expect(plain(batch)).toBe(
        "Batch Summary Item Name Batch Name Qty Warehouse Mfg Name Expiry Date Herbal Tea (TEA-01) Lot A (BTC0001) 1 WH0001 December 26, 2025"
      );
      expect(render(withBatch)).not.toContain("Stock Summary");
    });

    it("leaves the SKU and batch code out when the columns switch them off", () => {
      const batch = section(
        render((invoice) => {
          withBatch(invoice);
          invoice.stockSummaryConfig.batchSummaryColumns[0].showSku = false;
          invoice.stockSummaryConfig.batchSummaryColumns[1].showBatchCode =
            false;
        }),
        "batch-summary"
      );
      expect(plain(batch)).toContain("Herbal Tea Lot A 1 WH0001");
    });

    it("stays in the page, hidden, while switched off", () => {
      const html = render((invoice) => {
        withBatch(invoice);
        invoice.advanceOptions.showStockSummary = false;
      });
      expect(html).toMatch(
        /data-section="batch-summary" data-ceres-batch-summary style="display: none;"/
      );
    });
  });

  it("closes with the signature, numbered terms, notes and the payments table", () => {
    const html = render();
    const at = html.indexOf('data-testid="signature"');
    expect(plain(html.slice(at, html.indexOf("</section>", at)))).toMatch(
      /For Sample Pharmacy.*Authorized Signatory/
    );
    expect(plain(section(html, "terms"))).toContain(
      "Terms &amp; Conditions (1) Service Accounting Code: 998339"
    );
    expect(plain(section(html, "notes"))).toContain("Notes");
    expect(plain(section(html, "payments"))).toBe(
      "Payments Date Mode Amount Received Payment Account Transaction Charge TDS Jun 08, 2026 Account Transfer ₹5,597.76 payments@example.com ₹100.00 ₹138.42"
    );
  });

  it("keeps the order of the design's sections", () => {
    const html = render();
    const order = [
      'data-section="header"',
      'data-section="parties"',
      'data-section="details"',
      'data-section="items"',
      'data-testid="signature"',
      'data-section="terms"',
      'data-section="notes"',
      'data-section="payments"',
    ].map((marker) => html.indexOf(marker));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("Ecommerce template — settings and data", () => {
  it("leaves out what the document does not carry", () => {
    const html = render((invoice) => {
      delete invoice.logo;
      delete invoice.signature;
      delete invoice.shippedTo;
      delete invoice.notes;
      delete invoice.terms;
      delete invoice.allPayments;
    });
    expect(html).not.toContain("ec-logo");
    expect(html).not.toContain('data-testid="signature"');
    expect(html).not.toContain('data-role="shipping"');
    expect(html).not.toContain('data-section="terms"');
    expect(html).not.toContain('data-section="notes"');
    expect(html).not.toContain('data-section="payments"');
    // Place / Country of Supply print under Shipped To only: without one, neither shows.
    expect(html).not.toContain("Place of Supply");
    expect(html).not.toContain("Country of Supply");
  });

  it("Show Place/Country of Supply hides Place and Country of Supply only, kept for the live toggle", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.hideCountryOfSupply = true;
    });
    expect(html).toMatch(
      /class="ec-supply" data-ceres-country-of-supply style="display:none"/
    );
    // The toggle reaches nothing else: the only toggle targets are the supply group and the
    // place line inside it.
    expect((html.match(/data-ceres-country-of-supply/g) || []).length).toBe(1);

    const shown = render();
    expect(shown).toMatch(/class="ec-supply" data-ceres-country-of-supply>/);
    expect(plain(section(shown, "shipping"))).toContain(
      "Place of Supply: Karnataka (29) Country of Supply: India"
    );
  });

  it("prints the Country of Supply on an export", () => {
    const text = plain(
      section(
        render((invoice) => {
          invoice.countryOfSupply = "AE";
        }),
        "shipping"
      )
    );
    expect(text).toContain("Country of Supply: United Arab Emirates");
  });

  it("hides the words, terms and payments when switched off, keeping live targets", () => {
    const html = render((invoice) => {
      invoice.advanceOptions.hideTotalInWords = true;
      invoice.advanceOptions.showPaymentsTable = false;
      invoice.advanceOptions.hideTerms = true;
    });
    expect(html).toMatch(/ec-words-row[^"]*is-hidden-by-words-setting/);
    expect(html).toMatch(/data-ceres-payment-table style="display: none;"/);
    expect(html).not.toContain('data-section="terms"');
  });

  it("keeps a party heading when its custom label is saved empty", () => {
    const text = plain(
      section(
        render((invoice) => {
          invoice.customLabels = { shippedTo: "", billedBy: "" };
        }),
        "shipping"
      )
    );
    expect(text).toMatch(/^Shipping Address:/);
  });

  it("follows the custom labels", () => {
    const text = plain(
      render((invoice) => {
        invoice.customLabels = {
          billedBy: "Seller",
          billedTo: "Bill To",
          invoiceNumber: "Bill No.",
          totalInWords: "In Words",
          serialNumber: "#",
        };
      })
    );
    expect(text).toContain("Seller:");
    expect(text).toContain("Bill To:");
    expect(text).toContain("Bill No.: 2024000001");
    expect(text).toContain("In Words:");
  });

  it("letterhead and footer: every page by default, first / last page when asked", () => {
    const every = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.letterHeadFooter = "https://example.com/foot.png";
    });
    expect(every).toContain("ec-page-frame-header");
    expect(every).toContain("ec-footer-fixed");
    expect(every).toContain('data-ceres-page-policy="all"');

    const once = render((invoice) => {
      invoice.letterHead = "https://example.com/head.png";
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = {
        pdfOptions: { letterHeadOnFirstPage: true, footerOnLastPage: true },
      };
    });
    expect(once).not.toContain("ec-page-frame-header");
    expect(once).not.toContain("ec-footer-fixed");
    expect(once).toContain('data-ceres-page-policy="first"');
    expect(once).toContain('data-ceres-page-policy="last"');
  });

  it("keeps the footer on every printed page when Long PDF is on", () => {
    const html = render((invoice) => {
      invoice.letterHeadFooter = "https://example.com/foot.png";
      invoice.template = {
        pdfOptions: { longPdf: true, footerOnLastPage: false },
      };
    });
    expect(html).toContain("ec-page-frame-footer");
    expect(html).toContain("ec-footer-fixed");
  });

  it("puts the theme colour on the table header fill", () => {
    const html = render((invoice) => {
      invoice.template = { primaryColor: "#1565c0" };
    });
    expect(html).toContain("--ec-theme: #1565c0;");
  });
});

describe("Ecommerce template — E-Invoice and E-Way Bill", () => {
  const withIrn = (invoice: Json) => {
    invoice.irn = {
      Irn: "abc123",
      AckNo: "112010036563310",
      AckDt: "2026-06-08 11:20:00",
      EwbNo: "351000123456",
      EwbDt: "2026-06-08 12:10:00",
      EwbValidTill: "2026-06-10 23:59:00",
    };
  };

  it("sits after the document details, just above the items, as two untitled groups", () => {
    const html = render(withIrn);
    const compliance = html.indexOf('data-section="compliance"');
    expect(compliance).toBeGreaterThan(html.indexOf('data-section="details"'));
    expect(compliance).toBeLessThan(html.indexOf('data-section="items"'));
    const text = plain(section(html, "compliance"));
    expect(text).not.toContain("E-Invoice Details");
    expect(text).not.toContain("E-Way Bill Details");
    expect(text).toContain("IRN No.: abc123 Ack No.: 112010036563310");
    expect(text).toContain(
      "Eway Bill: 351000123456 E-Way Bill Date: June 08, 2026 Valid Till: June 10, 2026"
    );
  });

  it("puts the document QR just below the document details, not with the IRN", () => {
    const html = render((invoice) => {
      withIrn(invoice);
      invoice.documentQr = '{"doc":"INV-1","total":5597.76}';
    });
    const details = section(html, "details");
    expect(details).toMatch(
      /class="ec-qr ec-doc-qr" data-ceres-field-container="documentQr"><img data-ceres-field="documentQr" src="data:image/
    );
    expect(section(html, "compliance")).not.toContain("documentQr");
  });

  it("moves below the items when the business places the IRN there", () => {
    const html = render((invoice) => {
      withIrn(invoice);
      invoice.irnPosition = "BELOW_LINE_ITEMS";
    });
    expect(html.indexOf('data-section="compliance"')).toBeGreaterThan(
      html.indexOf('data-section="items"')
    );
  });

  it("leaves the E-Way Bill section out without an e-way bill", () => {
    expect(render()).not.toContain('data-testid="eway"');
  });
});

describe("Ecommerce template — Transport Details", () => {
  it("prints transport in the form's order with Refrens's names", () => {
    const html = render((invoice) => {
      invoice.customLabels = {
        transport: "Transport Details",
        transportName: "Transport",
      };
      invoice.transportDetails = {
        transporter: {
          name: "Sample Carrier",
          transporterId: "29AAAAA0000A1Z5",
        },
        distance: 120,
        transportMode: "RAIL",
        challanNumber: "C-1",
        challanDate: "2026-10-21",
        vehicleType: "OVERDIMENSIONALCARGO",
        vehicleNumber: "KA01AB1234",
        transactionType: "BILLTOSHIPTO",
        subSupplyType: "import",
      };
    });
    const at = html.indexOf('data-testid="transport"');
    const text = plain(html.slice(at, html.indexOf("</section>", at)));
    // Its own section, after the parties and before the document details and items.
    expect(at).toBeGreaterThan(html.indexOf('data-section="parties"'));
    expect(at).toBeLessThan(html.indexOf('data-section="details"'));
    expect(html.indexOf('data-section="details"')).toBeLessThan(
      html.indexOf('data-section="items"')
    );
    expect(plain(section(html, "details"))).not.toContain("Transport");
    expect(text).toContain(
      "Transport Details Transport Mode: Rail Transporter: Sample Carrier Transporter ID: 29AAAAA0000A1Z5 Distance: 120 Challan Date: October 21, 2026 Challan Number: C-1 Vehicle Type: Over Dimensional Cargo Vehicle Number: KA01AB1234"
    );
    expect(text).not.toContain("Transaction Type");
    expect(text).not.toContain("Sub Supply Type");
  });
});

describe("Ecommerce template — bank details and UPI", () => {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

  it("lists the bank details in the order of Refrens' form", () => {
    const html = render((invoice) => {
      invoice.bankAccount = {
        bank: "Sample Bank",
        accountNo: "000123456789012",
        ifsc: "SMPL0000001",
        name: "Sample Store",
        accountType: "CURRENT",
      };
      invoice.paymentOptions = { accountTransfer: true };
    });
    expect(plain(section(html, "bank"))).toMatch(
      /^Bank Details Account Name: Sample Store Account Number: 000123456789012 IFSC: SMPL0000001 Account Type: Current Bank: Sample Bank/
    );
  });

  it("wraps text in a field read as a code, but keeps a real code whole", () => {
    const html = render((invoice) => {
      invoice.transportDetails = {
        challanNumber:
          "Sample warehouse CARGO HANDLING GROUND FLOOR SOUTH TERMINAL BUILDING",
        vehicleNumber: "MH 12 AB 1234",
      };
    });
    const transport = html.slice(html.indexOf('data-testid="transport"'));
    expect(transport).toMatch(
      /ec-ref-challanNumber"><span class="ec-field-label">[^<]*<\/span> <span class="ec-field-value">/
    );
    expect(transport).toMatch(
      /ec-ref-vehicleNumber"><span class="ec-field-label">[^<]*<\/span> <span class="ec-field-value ec-num">/
    );
  });

  it("puts Scan to Pay, the QR and the UPI limit note in a column beside the bank details", () => {
    const html = render((invoice) => {
      invoice.bankAccount = {
        bank: "Sample Bank",
        accountNo: "000123456789012",
      };
      invoice.upi = { upi: "samplestore@upi" };
      invoice.paymentOptions = { accountTransfer: true, upi: true };
    });
    const bank = section(html, "bank");
    const [details, qr] = bank.split('<figure class="ec-upi');
    expect(plain(details)).toMatch(
      /^Bank Details Account Number: 000123456789012 Bank: Sample Bank/
    );
    expect(plain(details)).toContain("UPI: samplestore@upi");
    expect(plain(details)).not.toContain("Maximum of 1 lakh");
    // Scan to Pay heads the QR column; the limit note sits under the QR.
    expect(qr.indexOf("Scan to Pay")).toBeLessThan(
      qr.indexOf('data-testid="upi-qr"')
    );
    expect(qr.indexOf('data-testid="upi-qr"')).toBeLessThan(
      qr.indexOf("Maximum of 1 lakh")
    );
    expect(css).toMatch(/\.ec-bank \{[^}]*gap: 16px 24px;/);
  });

  it("lets a table in a full-width item description fill the whole row, Sr.No column included", () => {
    const table = "| Colour | Pcs |\n| --- | --- |\n| Colour 106 | 18 |";
    expect(hasMarkdownTable(table)).toBe(true);
    expect(hasMarkdownTable("Plain text | with a bar")).toBe(false);
    const rows = (description: string) =>
      render((invoice) => {
        invoice.showDescriptionInFullWidth = true;
        invoice.items[0].description = description;
      }).match(/<tr class="ec-detail-row"[\s\S]*?<\/tr>/)?.[0] ?? "";
    const withTable = rows(table);
    expect(withTable).not.toContain('class="ec-col-serial"');
    const plainText = rows("Plain description");
    expect(plainText).toContain('class="ec-col-serial"');
    const span = (row: string) => Number(row.match(/colspan="(\d+)"/)?.[1]);
    expect(span(withTable)).toBe(span(plainText) + 1);
    expect(css).toMatch(
      /\.ec-doc \.ec-item-desc \.toastui-editor-contents table \{\s*width: 100%;/
    );
  });

  it("keeps the description row's space above and below on every page it runs over", () => {
    expect(css).toMatch(
      /\.ec-items \.ec-detail-row > td:not\(\.ec-col-serial\) \{\s*padding-block: 0;/
    );
    expect(css).toMatch(
      /\.ec-detail-row \.ec-item-detail \{[^}]*padding-block: 6px;[^}]*box-decoration-break: clone;/
    );
  });

  it("sets an item's SKU / HSN / unit line at 11 px", () => {
    expect(css).toMatch(/--ec-font-size-xs: 11px;/);
    expect(css).toMatch(
      /\.ec-item-codes \{[^}]*font-size: calc\(var\(--ec-font-size-xs\) \* var\(--ec-text-scale, 1\)\);/
    );
  });

  it("sets the item table's headings in semibold", () => {
    expect(css).toMatch(/\.ec-items thead th \{[^}]*font-weight: 600;/);
  });

  it("sets the summary headings 8 px above their tables", () => {
    expect(css).toMatch(
      /\.ec-summary > \.ec-block-title \{\s*margin-bottom: 8px;/
    );
  });

  it("keeps the UPI QR 24 px after the bank details, beside them even with a long address", () => {
    const rule = (selector: string) =>
      css.match(
        new RegExp(`\\n${selector.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`)
      )?.[1] ?? "";
    expect(rule(".ec-bank")).not.toContain("flex-wrap");
    expect(rule(".ec-bank-details")).toMatch(
      /flex: 0 1 auto;[^}]*min-width: 0;/
    );
    expect(rule(".ec-upi")).toContain("flex: none;");
    // Only a phone-width document puts the QR under the details.
    expect(css).toMatch(
      /@container ec-doc \(width < 400px\) \{\s*\.ec-bank \{\s*flex-wrap: wrap;/
    );
  });
});

describe("Ecommerce template — logo size", () => {
  it("sizes the logo by its shape, as Apex does: 100 px square, else a 200 × 80 box", () => {
    expect(isSquareLogo(400, 400)).toBe(true);
    expect(isSquareLogo(120, 100)).toBe(true);
    expect(isSquareLogo(300, 400)).toBe(true);
    expect(isSquareLogo(133, 80)).toBe(false);
    expect(isSquareLogo(0, 0)).toBe(false);
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.ec-logo \.ec-logo-image \{[^}]*width: 200px;[^}]*height: 80px;/
    );
    expect(css).toMatch(
      /\.ec-logo-image\.is-square \{[^}]*width: 100px;[^}]*height: 100px;/
    );
    expect(render()).toContain("ec-logo-image");
  });
});

describe("Ecommerce template — totals rows keep one rule", () => {
  it("label, rule-less empty cells per column, the figure cell marked for the browser fit", () => {
    const html = render((invoice) => {
      invoice.extraTotalFields = [
        { _id: "x1", label: "Custom Field", value: "A long custom value" },
      ];
    });
    const row = html.slice(
      html.indexOf('data-ceres-subtotal-row="extra:x1"'),
      html.indexOf("</tr>", html.indexOf('data-ceres-subtotal-row="extra:x1"'))
    );
    // Sr.No + Description under the label, then 6 empty cells, then the figure: 9 columns.
    expect(row).toMatch(/class="ceres-subtotal-label" colspan="2"/);
    expect((row.match(/class="ec-fill"/g) || []).length).toBe(6);
    expect(row).toMatch(/<td class="ceres-subtotal-value" data-ec-fit>/);
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.ec-items \.ec-totals \.ec-fill \{\s*border-inline-end: 0;/
    );
    expect(css).toMatch(
      /\.ec-items \.ec-fig \{[^}]*width: 0;[^}]*min-width: 100%;/
    );
  });
});

describe("Ecommerce template — Show exchange rate on PDF", () => {
  const usd = (show?: boolean) => (invoice: Json) => {
    invoice.currency = "USD";
    invoice.conversionRates = { INR: 96.326 };
    invoice.finalTotal = {
      ...invoice.finalTotal,
      discount: 10,
      total: 5587.76,
    };
    if (show !== undefined) invoice.advanceOptions.showExchangeRateOnPdf = show;
  };

  it("shows both currencies and the Applied Exchange Rate row only when switched on", () => {
    const off = section(render(usd()), "totals");
    expect(off).not.toContain("ceres-subtotal-converted");
    expect(off).not.toContain('data-ceres-subtotal-row="conversionRate"');
    expect(section(render(usd(false)), "totals")).not.toContain("₹");

    // On (as the Apex and Modern Manufacturing templates): the business-currency figure
    // under each amount.
    const on = section(render(usd(true)), "totals");
    expect(on).toContain("ceres-subtotal-converted");
    expect(on).toContain("₹");
    expect(on).toContain('data-ceres-subtotal-row="conversionRate"');
    // The rate exactly as stored on the document (editable in Refrens), between the codes.
    expect(plain(on)).toContain(
      "Applied Exchange Rate 1 USD &#x3D; 96.326 INR"
    );
  });

  it("prints an edited rate as typed, every decimal kept", () => {
    const on = section(
      render((invoice) => {
        usd(true)(invoice);
        invoice.conversionRates = { INR: 95.3929 };
      }),
      "totals"
    );
    expect(plain(on)).toContain("1 USD &#x3D; 95.3929 INR");
  });
});

describe("Ecommerce template — contact details", () => {
  it("closes the document with Refrens' enquiry line, only when the document has contact details", () => {
    const html = render((invoice) => {
      invoice.contact = { email: "help@example.com", phone: "+91 90000 00000" };
    });
    const at = html.indexOf('data-section="contact"');
    expect(at).toBeGreaterThan(html.indexOf('data-section="payments"'));
    expect(plain(section(html, "contact")).replace(/ ,/g, ",")).toBe(
      "For any enquiry, reach out via email at help@example.com, call on tel(+91 90000 00000)"
    );
    expect(render()).not.toContain('data-section="contact"');
  });
});

describe("Ecommerce template — GST tax names", () => {
  const withColumnLabel = (taxType: string) => (invoice: Json) => {
    invoice.taxType = taxType;
    invoice.columns = invoice.columns.map((column: Json) => {
      if (column.key === "igst") return { ...column, label: "PPN" };
      if (column.key === "gstRate") return { ...column, label: "PPN Rate" };
      return column;
    });
    invoice.advanceOptions.taxSummaryView = "BOTH";
  };
  const renderMapped = (edit: (invoice: Json) => void) =>
    template(
      normalizeInvoiceTemplateState(withGstColumnLabels(payload(edit)) as never)
    );

  it("prints IGST on an Indian GST document whatever word its saved column carries", () => {
    const html = renderMapped(withColumnLabel("INDIA"));
    expect(html).not.toContain("PPN");
    expect(plain(section(html, "tax-summary"))).toContain("IGST");
    expect(html).toMatch(/data-col="gst"[^>]*>(<span[^>]*><\/span>)?GST Rate</);
  });

  it("keeps a business's own rename of the tax column", () => {
    const fixed = withGstColumnLabels(
      payload((invoice) => {
        invoice.taxType = "INDIA";
      })
    ) as Json;
    expect(
      fixed.invoice.columns.find((column: Json) => column.key === "igst").label
    ).toBe("Tax Amount");
  });

  it("keeps the document's own tax word on other tax types", () => {
    const html = renderMapped(withColumnLabel("GLOBAL"));
    expect(html).toContain("PPN");
  });

  it("prints a rate column saved as Tax Rate the way refrens.com does", () => {
    const rateLabel = (edit: (invoice: Json) => void) =>
      (withGstColumnLabels(payload(edit)) as Json).invoice.columns.find(
        (column: Json) => column.key === "gstRate"
      ).label;
    const saved = (taxType: string, billType: string, taxName = "GST") =>
      rateLabel((invoice) => {
        Object.assign(invoice, { taxType, billType, taxName });
        invoice.columns = invoice.columns.map((column: Json) =>
          column.key === "gstRate" ? { ...column, label: "Tax Rate" } : column
        );
      });
    expect(saved("INDIA", "INVOICE")).toBe("TAX Rate");
    expect(saved("INDIA", "PURCHASEORDER")).toBe("Tax Rate");
    expect(saved("GLOBAL", "QUOTATION", "Tax")).toBe("Tax Rate");
    expect(saved("GLOBAL", "CREDITNOTE", "TAX")).toBe("TAX Rate");
  });

  it("keeps a tax column saved as Tax on an Indian document, as refrens.com", () => {
    const fixed = withGstColumnLabels(
      payload((invoice) => {
        invoice.taxType = "INDIA";
        invoice.columns = invoice.columns.map((column: Json) =>
          column.key === "igst" ? { ...column, label: "Tax" } : column
        );
      })
    ) as Json;
    expect(
      fixed.invoice.columns.find((column: Json) => column.key === "igst").label
    ).toBe("Tax");
  });

  it("a custom label for IGST still wins", () => {
    const html = renderMapped((invoice) => {
      withColumnLabel("INDIA")(invoice);
      invoice.customLabels = { igst: "Integrated Tax" };
    });
    expect(plain(section(html, "tax-summary"))).toContain("Integrated Tax");
  });
});

describe("Ecommerce template — formula columns", () => {
  it("shows a group's own images under its name, and its original images in a row below", () => {
    const html = render((invoice) => {
      invoice.items.unshift({
        name: "Kitchen",
        group: true,
        images: ["https://example.com/group-thumb.png"],
        originalImages: ["https://example.com/group-large.png"],
      });
    });
    const at = html.indexOf('data-testid="group-row"');
    const row = html.slice(at, html.indexOf("</tr>", at));
    expect(plain(row)).toContain("Kitchen");
    expect(row).toContain("ceres-image-gallery-thumbnail");
    expect(row).toContain("https://example.com/group-thumb.png");
    const large = html.indexOf('data-testid="group-image-row"');
    expect(large).toBeGreaterThan(at);
    expect(html.slice(large, html.indexOf("</tr>", large))).toContain(
      "https://example.com/group-large.png"
    );
  });

  it("draws a group without images as its name alone", () => {
    const html = render((invoice) => {
      invoice.items.unshift({ name: "Kitchen", group: true });
    });
    const at = html.indexOf('data-testid="group-row"');
    expect(html.slice(at, html.indexOf("</tr>", at))).not.toContain(
      "ceres-image-gallery"
    );
    expect(html).not.toContain('data-testid="group-image-row"');
  });

  it("draws the e-invoice QR from the IRN's own QR text, signed when the business asks", () => {
    const irn = {
      Irn: "abc123",
      qr: '{"SellerGstin":"24AAAAA0000A1Z5"}',
      SignedQRCode: `eyJ${"x".repeat(940)}`,
    };
    // The active e-invoice's QR replaces the document QR, in the e-invoice section.
    const plainQr = view((invoice) => {
      invoice.irn = irn;
    }).compliance.qr.irn;
    expect(plainQr).toMatch(/^data:image\/svg\+xml/);
    const signedQr = view((invoice) => {
      invoice.irn = irn;
      invoice.owner = {
        ...(invoice.owner || {}),
        configuration: { showSignedIrnQr: true },
      };
    }).compliance.qr.irn;
    expect(signedQr).toMatch(/^data:image\/svg\+xml/);
    expect(signedQr).not.toBe(plainQr);
  });

  it('prints the creator when "Show in Invoice" is on, and the contact person\'s email', () => {
    const html = render((invoice) => {
      invoice.advanceOptions.showCreatorInInvoice = true;
      invoice.creator = { name: "Creator Person" };
      invoice.billedTo.contactPerson = {
        name: "Contact Person",
        email: "contact.person@example.com",
        displayFields: ["name", "email", "phone"],
      };
    });
    expect(plain(html)).toContain("Created By: Creator Person");
    expect(plain(html)).toContain("Contact Email: contact.person@example.com");
    expect(plain(render())).not.toContain("Created By");
  });

  it("names payment modes the API sends in capitals", () => {
    expect(paymentModeName("CHEQUE")).toBe("Cheque");
    expect(paymentModeName("Account Transfer")).toBe("Account Transfer");
    expect(paymentModeName("Gift Voucher")).toBe("Gift Voucher");
  });

  it("repeats only the figures that add up on a group total row, never the rate", () => {
    const html = render((invoice) => {
      invoice.items.push({
        name: "Kitchen",
        isGroupItemTotalRow: true,
        quantity: 3,
        rate: 0,
        amount: 7200,
        total: 8496,
      });
    });
    const at = html.lastIndexOf("ec-group-total-row");
    const row = html.slice(at, html.indexOf("</tr>", at));
    expect(row).toContain("7,200.00");
    expect(row).not.toContain(
      '0.00</span></td>\n                              <td class="ec-col-amount'
    );
    expect(plain(row)).not.toMatch(/₹0\.00/);
  });

  it("prints custom number and formula figures with two decimals, as refrens.com", () => {
    const html = render((invoice) => {
      invoice.locale = "en-IN";
      invoice.columns.push(
        {
          key: "fxn",
          label: "GST cal",
          dataType: "formula",
          fxReturnType: "number",
        },
        { key: "num", label: "Rate", dataType: "number" },
        { key: "txt", label: "Weight", dataType: "text" }
      );
      invoice.items[0].custom = { fxn: 156282300, num: -8, txt: 0 };
    });
    expect(html).toMatch(/data-col="fxn">[^]*?15,62,82,300\.00</);
    expect(html).toMatch(/data-col="num">[^]*?-8\.00</);
    expect(html).not.toMatch(/data-col="txt">[^<]*0\.00/);
  });

  it("reads a figure saved as grouped text in full, not up to its first comma", () => {
    expect(groupedNumber("20,13,20,21,562")).toBe(2013202156 * 10 + 2);
    expect(groupedNumber("1,234,567.50")).toBe(1234567.5);
    expect(groupedNumber("AF-139")).toBe("AF-139");
    expect(groupedNumber(42)).toBe(42);
    const html = render((invoice) => {
      invoice.columns.push({
        key: "fx1",
        label: "Grand",
        dataType: "number",
        fxReturnType: "number",
      });
      invoice.items[0].custom = {
        ...(invoice.items[0].custom || {}),
        fx1: "20,13,20,21,562",
      };
    });
    expect(html).toMatch(
      /data-col="fx1"><span class="ec-num" data-testid="num">20,13,20,21,562</
    );
  });
});

describe("Ecommerce template — Change Script", () => {
  it("right-to-left: dir and lang on the document, the script's font loaded", () => {
    const html = render((invoice) => {
      invoice.template = { languageScript: "Arabic", enableRtl: true };
    });
    expect(html).toMatch(/class="ec-doc[^"]*"[^>]*dir="rtl"/);
    expect(html).toContain("--ec-script-font: 'Noto Sans Arabic'");
    expect(html).toContain("fonts.googleapis.com");
  });

  it("isolates every piece of the business's text, so its punctuation stays put", () => {
    const html = render();
    [
      "Sold By:",
      "Sample Pharmacy",
      "12 Sample Road, Sample Town",
      "TOTAL:",
      "Authorized Signatory",
    ].forEach((value) =>
      expect(html).toMatch(
        new RegExp(
          `class="ec-text">${value.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}</span>`
        )
      )
    );
    const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");
    expect(css).toMatch(
      /\.ec-doc\[dir="rtl"\][^{]*\.ec-text[^{]*\{\s*unicode-bidi: plaintext;/
    );
  });
});

describe("Ecommerce template — view model", () => {
  it("prints dates as June 08, 2026 in the business's offset", () => {
    expect(formatDocumentDate("2026-06-08")).toBe("June 08, 2026");
    expect(formatDocumentDate("2026-06-07T20:00:00.000Z", "+05:30")).toBe(
      "June 08, 2026"
    );
  });

  it("writes the copy in brackets", () => {
    expect(copyLabel("Original for Recipient")).toBe(
      "(Original for Recipient)"
    );
    expect(copyLabel("(Duplicate)")).toBe("(Duplicate)");
  });

  it("prints the amount in words in capitals, the document's stored words included", () => {
    const html = render((invoice) => {
      invoice.customLabels = {
        totalInWordsValue:
          "eight lakh seven thousand rupees and twenty eight paise only",
      };
    });
    expect(plain(section(html, "totals"))).toContain(
      "EIGHT LAKH SEVEN THOUSAND RUPEES AND TWENTY EIGHT PAISE ONLY"
    );
  });

  it("assembles a sparse document without failing", () => {
    const sparse = normalizeInvoiceTemplateState({
      invoice: { billedBy: { name: "Shop" }, items: [] },
    } as never);
    expect(() => template(sparse)).not.toThrow();
  });
});

describe("Ecommerce template — files and CSS", () => {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, "styles.css"), "utf8");

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
      "Sample Pharmacy",
      "Sample Studio",
      "Tax Invoice/Bill",
      "Original for Recipient",
      "998339",
      "29AAAAA",
    ].forEach((sample) => expect(code).not.toContain(sample));
  });

  it("never changes the business's case, scopes every rule and uses no @page", () => {
    expect(css).not.toMatch(/text-transform/);
    expect(css).not.toMatch(/@page\s*\{/);
  });

  it("sizes columns by their content, the column rule straight through the totals", () => {
    const html = render();
    // No width shares on the columns: each fits its widest figure, Description the rest.
    expect(html).not.toMatch(/data-col="(?!sr)[^"]*" style="width/);
    expect(css).toMatch(
      /\.ec-items thead th:not\(\.ec-col-name, \.ec-col-serial\) \{\s*width: 1%;/
    );
    expect(css).toMatch(
      /\.ec-items \.ec-totals \.ceres-subtotal-value \{\s*border-inline-start: var\(--ec-rule-width\)/
    );
  });

  it("right-aligns the last item column, heading and figures", () => {
    expect(css).toMatch(
      /\.ec-items \.ec-item-row > td:last-child:not\(\.ec-col-name, \.ec-col-serial\) \{\s*text-align: end;/
    );
  });

  it("prints item descriptions and codes in the ink, not grey", () => {
    expect(css).toMatch(/\.ec-item-codes \{[^}]*color: var\(--ec-ink\)/);
    expect(css).toMatch(/\.ec-item-detail \{[^}]*color: var\(--ec-ink\)/);
  });

  it("leaves 4 px between a party's address and its first field", () => {
    expect(css).toMatch(
      /\.ec-party \.ec-party-line \+ \.ec-field,[^{]*\{\s*margin-top: 4px;/
    );
  });

  it("rules a full-width description off its item across the whole table, Sr.No included", () => {
    expect(css).toMatch(
      /\.ec-items \.ec-detail-row > td,\s*\.ec-items \.ec-image-row > td \{\s*border-top:/
    );
  });

  it("styles the summary tables like the payment strip: light rules, no header fill", () => {
    expect(css).toMatch(
      /\.ec-summary \.ceres-table \{[^}]*border: var\(--ec-rule-width\) solid var\(--ec-soft-rule\)/
    );
    expect(css).toMatch(
      /\.ec-summary \.ceres-table thead th \{\s*background: none;/
    );
  });

  it("centres the summary tables' text in their equal columns, the first column from the start", () => {
    expect(css).toMatch(
      /\.ec-summary \.ceres-table td \{[^}]*text-align: center;/
    );
    expect(css).toMatch(
      /\.ec-summary \.ceres-table :is\(th, td\):first-child \{\s*text-align: start;/
    );
  });

  it("prints every section as a unit, the page breaking between sections", () => {
    expect(css).not.toContain(".ec-items-section ~");
    const rule = css.slice(css.indexOf("  .ec-masthead,\n  .ec-parties,"));
    const block = rule.slice(0, rule.indexOf("}"));
    [
      ".ec-block",
      ".ec-bank",
      ".ec-summary",
      ".ec-payments",
      ".ec-signature",
    ].forEach((name) => expect(block).toContain(name));
    expect(block).toContain("break-inside: avoid;");
  });

  it("caps the printed page at the paper's printable width, whatever the window", () => {
    const width = (pdfOptions: Record<string, unknown>) =>
      mapPrint({ pdfOptions }).printWidth;
    // A4 at 1 cm side margins: 794 - 76 - 4 px kept back.
    expect(width({})).toBe(714);
    expect(width({ xMargins: "0.5" })).toBe(751);
    expect(width({ zoomSize: "0.9" })).toBe(802);
    expect(width({ landscape: true })).toBe(1042);
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/max-width: var\(--ec-print-width, none\);/);
    expect(render()).toContain("--ec-print-width: 714px;");
  });

  it("keeps the print table's 10 px text floor at 10 px on paper, whatever the print zoom", () => {
    const zoom = (pdfOptions: Record<string, unknown>) =>
      mapPrint({ pdfOptions }).printZoom;
    expect(zoom({})).toBe("1");
    expect(zoom({ zoomSize: "1.2" })).toBe("1.2");
    // The renderer applies no zoom for 0.8.
    expect(zoom({ zoomSize: "0.8" })).toBe("1");
    expect(render()).toContain("--ec-print-zoom: 1;");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).not.toMatch(/font-size: max\(\s*10px,/);
    expect(
      print.match(
        /font-size: max\(\s*calc\(10px \/ var\(--ec-print-zoom, 1\)\),/g
      )
    ).toHaveLength(4);
  });

  it("leaves the batch columns out when the document switches them off", () => {
    const heads = (on: boolean | undefined) => {
      const html = render((invoice) => {
        invoice.columns = [
          ...(invoice.columns || []),
          { key: "batchCode", label: "Batch Code", isHidden: false },
          { key: "expiryDate", label: "Expiry Date", isHidden: false },
        ];
        invoice.advanceOptions = {
          ...(invoice.advanceOptions || {}),
          showBatchColumnsInInvoice: on,
        };
      });
      const table = html.slice(html.indexOf('<table class="ec-items'));
      return plain(table.slice(0, table.indexOf("</thead>")));
    };
    expect(heads(true)).toContain("Batch Code");
    expect(heads(undefined)).toContain("Batch Code");
    expect(heads(false)).not.toContain("Batch Code");
    expect(heads(false)).not.toContain("Expiry Date");
  });

  it("caps a Long PDF's original images at a fixed height, not one read off the window", () => {
    expect(css).toMatch(
      /\.ec-doc\.is-pageless \.ec-large-image \{\s*max-height: 490px;/
    );
  });

  it("puts the item table and the totals under it on one rule in print", () => {
    expect(css).toMatch(
      /\.ec-items\[data-ec-totals-split\] \{\s*margin-top: -1px;/
    );
  });

  it("keeps a clear type hierarchy: section titles 14 px bold, names and labels semibold", () => {
    expect(css).toMatch(/--ec-font-size-m: 14px;/);
    [".ec-party-title {", ".ec-block-title {", ".ec-upi-caption {"].forEach(
      (rule) => {
        const at = css.indexOf(rule.replace(" {", ""));
        expect(at).toBeGreaterThan(-1);
      }
    );
    expect(css).toMatch(
      /\.ec-party-title \{[^}]*font-size: calc\(var\(--ec-font-size-m\)/
    );
    expect(css).toMatch(
      /\.ec-block-title \{[^}]*font-size: calc\(var\(--ec-font-size-m\)/
    );
    expect(css).toMatch(/\.ec-field-label \{\s*font-weight: 600;/);
    expect(css).toMatch(/\.ec-party-name \{\s*font-weight: 600;/);
    expect(render()).toContain('class="ec-text">Sold By:</span>');
  });

  it("spaces the page evenly: 12 px inside the frame, 16 px between sections, no empty logo box", () => {
    expect(css).toMatch(/\.ec-frame \{\s*--ec-frame-pad: 12px;[^}]*gap: 16px;/);
    expect(css).toMatch(/\.ec-signature \{[^}]*gap: 8px;/);
    expect(css).toMatch(/\.ec-logo:has\(\.is-broken\) \{\s*display: none;/);
  });

  it("prints runs of empty lines in notes and descriptions as one paragraph break", () => {
    expect(collapseBlankLines("a\n\n<br>\nb\n\n\n\nc<br><br><br>d")).toBe(
      "a\n\nb\n\nc\n\nd"
    );
    expect(collapseBlankLines("one<br>two\nthree")).toBe("one<br>two\nthree");
  });

  it("never prints the enquiry line alone at the top of a page", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.ec-contact \{\s*break-before: avoid;/);
  });

  it("lets terms, notes and attachments carry on line by line across a page break", () => {
    expect(css).toMatch(
      /\.ec-block:is\(\[data-section="terms"\], \[data-section="notes"\], \[data-section="attachments"\]\) \{\s*break-inside: auto;/
    );
  });

  it("repeats a description or note table's headings on every page, breaking between its rows", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(
      /\.ec-doc :is\(\.ec-item-desc, \.ec-note-body\) \.toastui-editor-contents thead \{\s*display: table-header-group;/
    );
    expect(print).toMatch(
      /\.ec-doc :is\(\.ec-item-desc, \.ec-note-body\) \.toastui-editor-contents tr,\s*\.ec-summary \.ceres-table tr \{\s*break-inside: avoid;/
    );
    // The item table's last-column alignment stays on its own heading row.
    expect(css).toContain(
      ".ec-items > thead th:last-child:not(.ec-col-name, .ec-col-serial),"
    );
  });

  it("prints each line item whole, its description and images kept with it", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.ec-items > tbody > tr \{\s*break-inside: avoid;/);
    expect(print).toMatch(
      /\.ec-items \.ec-item-row\.has-name-row,\s*\.ec-items \.ec-detail-row,\s*\.ec-items \.ec-image-row \{\s*break-before: avoid;/
    );
    expect(print).toMatch(
      /\.ec-summary \.ceres-table tr \{\s*break-inside: avoid;/
    );
    expect(css).toMatch(/\.ec-items \.ec-group-row \{\s*break-after: avoid;/);
    const image = print.slice(print.indexOf(".ec-large-image {"));
    expect(image.slice(0, image.indexOf("}"))).toContain(
      "max-height: min(45vh, 490px);"
    );
  });

  it("closes the item table with a rule at every page break (print-only repeating footer)", () => {
    expect(render()).toMatch(
      /<tfoot class="ec-page-close" aria-hidden="true"><tr><td colspan="\d+"><\/td><\/tr><\/tfoot>/
    );
    expect(css).toMatch(/\.ec-items \.ec-page-close \{\s*display: none;/);
    expect(css).toMatch(
      /\.ec-items \.ec-page-close \{\s*display: table-footer-group;/
    );
  });

  it("keeps an every-page footer within a quarter page, so Chrome repeats its spacer", () => {
    expect(css).toMatch(
      /\.ec-page-frame-footer \.ec-letterhead-footer img,\s*\.ec-letterhead-footer\.ec-footer-fixed img \{[^}]*max-height: 22vh;/
    );
  });

  it("sizes the signature by its shape, as the logo: wide 200 × 80, square 120 × 120", () => {
    expect(css).toMatch(
      /\.ec-signature-mark img \{[^}]*width: 200px;[^}]*height: 80px;[^}]*object-fit: contain;/
    );
    expect(css).toMatch(
      /\.ec-signature-mark img\.is-square \{\s*width: 120px;\s*height: 120px;/
    );
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    expect(source).toContain('target.classList.contains("ec-signature-image")');
  });

  it("draws the UPI QR at 120 × 120 always", () => {
    expect(css).toMatch(/\.ec-upi-qr \{[^}]*width: 120px;[^}]*height: 120px;/);
    expect(css).not.toMatch(/\.ec-upi\.is-small \.ec-upi-qr/);
  });

  it("closes the frame with the contact line as a box of its own, edge to edge", () => {
    expect(css).toMatch(
      /\.ec-contact \{[^}]*margin: 0 calc\(-1 \* var\(--ec-frame-pad\)\) calc\(-1 \* var\(--ec-frame-pad\)\);[^}]*border-top: 1px solid var\(--ec-ink\)/
    );
  });

  it("lets every batch summary column hug its content, none pinned", () => {
    expect(css).not.toMatch(
      /\.ec-batch-table :is\(th, td\):not\(:first-child\) \{\s*width: 1%;/
    );
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "helpers.ts"),
      "utf8"
    );
    expect(source).toContain('".ec-summary .ceres-table:not(.ec-batch-table)"');
  });

  it("draws the payments as one centred table, figures never wrapping", () => {
    expect(css).toMatch(
      /\.ec-summary\.ec-payments \.ceres-table :is\(th, td\):first-child \{\s*text-align: center;/
    );
    expect(css).toMatch(
      /\.ec-summary \.ceres-table td\.ec-num \{\s*white-space: nowrap;/
    );
  });

  it("prints several payments under one heading row, with a Total row", () => {
    const html = render((invoice) => {
      const first = invoice.allPayments[0];
      invoice.allPayments = [
        first,
        { ...first, amount: 100, tds: 0.15, transactionCharge: 0 },
      ];
    });
    const payments = section(html, "payments");
    expect(payments.match(/<thead>/g)).toHaveLength(1);
    expect(payments.match(/data-testid="payment"/g)).toHaveLength(2);
    const total = payments.slice(payments.indexOf("<tfoot>"));
    expect(plain(total)).toBe("Total ₹5,697.76 ₹100.00 ₹138.57");
    // One payment: no Total row, as refrens.com prints it.
    expect(section(render(), "payments")).not.toContain("payments-total");
  });

  it("hides an empty list item, so its marker never falls out of the cell", () => {
    expect(css).toMatch(
      /\.ec-item-desc \.toastui-editor-contents li:empty,[^{]*\{\s*display: none;/
    );
  });

  it("keeps paragraphs in notes and descriptions 4 px apart", () => {
    expect(css).toMatch(
      /> \* \+ :is\(p, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre, table, div\) \{\s*margin-top: 4px !important;/
    );
  });

  it("draws the design's frame, rules and header fill", () => {
    expect(css).toMatch(
      /\.ec-frame \{[^}]*padding: var\(--ec-frame-pad\);[^}]*border: 1px solid var\(--ec-ink\)/
    );
    expect(css).toContain("--ec-ink: #282828;");
    expect(css).toContain("--ec-rule-width: 0.5px;");
    expect(css).toMatch(/--ec-head-fill: color-mix\(/);
  });
});

describe("Ecommerce template — as refrens.com prints real documents", () => {
  it("prints dropdown, checkbox and yes/no custom fields as Refrens does", () => {
    expect(customFieldText(["Option 2", "Option 3"])).toBe(
      "Option 2, Option 3"
    );
    expect(customFieldText([{ label: "Red", value: "red" }])).toBe("Red");
    expect(customFieldText(true)).toBe("Yes");
    expect(customFieldText(false)).toBe("No");
    expect(customFieldText("test")).toBe("test");
    const html = plain(
      render((invoice) => {
        invoice.billedTo.customFields = [
          {
            label: "Colours",
            dataType: "MULTISELECT",
            value: ["Option 2", "Option 3"],
            params: { showInInvoice: true },
          },
          {
            label: "Approved",
            dataType: "BOOLEAN",
            value: false,
            params: { showInInvoice: true },
          },
        ];
      })
    );
    expect(html).toContain("Colours: Option 2, Option 3");
    expect(html).toContain("Approved: No");
  });

  it("reads inline HTML in an item description as refrens.com renders it", () => {
    expect(
      htmlToMarkdown(
        "be <strong>100 to 200 words</strong> long<br>or <i>less</i>"
      )
    ).toBe("be **100 to 200 words** long\nor *less*");
    expect(htmlToMarkdown("plain 2 < 3 text")).toBe("plain 2 < 3 text");
    const html = render((invoice) => {
      invoice.items[0].description =
        "be <strong>100 to 200 words</strong> long";
    });
    expect(plain(section(html, "items"))).not.toContain("<strong>");
    expect(section(html, "items")).not.toContain("&lt;strong&gt;");
  });

  it("drops the account's Unit column when no item has a unit", () => {
    const header = (unit?: string) =>
      plain(
        section(
          render((invoice) => {
            invoice.columns.push({ key: "unit", label: "Unit" });
            invoice.advanceOptions.unitColumn = "SEPARATE_COLUMN";
            invoice.items[0].unit = unit;
          }),
          "items"
        )
      );
    expect(header()).not.toMatch(/\bUnit\b(?! Price)/);
    expect(header("PCS")).toMatch(/\bUnit\b(?! Price)/);
  });

  it("prints the MSIC column on challans and quotations, not on invoices", () => {
    const msic = (billType: string) =>
      plain(
        section(
          render((invoice) => {
            invoice.billType = billType;
            invoice.columns.push({ key: "msic", label: "MSIC" });
          }),
          "items"
        )
      ).includes("MSIC");
    expect(msic("QUOTATION")).toBe(true);
    expect(msic("DELIVERYCHALLAN")).toBe(true);
    expect(msic("INVOICE")).toBe(false);
    expect(msic("SALESORDER")).toBe(false);
  });

  it("prints 0% for an item whose percentage discount has no amount", () => {
    const html = render((invoice) => {
      invoice.columns.push({ key: "discount", label: "Discount" });
      // One item with 10% off, the next with the type and no amount.
      invoice.items.push({ ...invoice.items[0], name: "Second item" });
      invoice.items[0].discount = { discountType: "PERCENTAGE", amount: 10 };
      invoice.items[1].discount = { discountType: "PERCENTAGE" };
      invoice.finalTotal = { ...invoice.finalTotal, discount: 499.8 };
    });
    const items = plain(section(html, "items"));
    expect(items).toContain("10%");
    expect(items).toMatch(/Second item.*\b0%/);
  });

  it("spells a foreign-currency total in its own currency when no words are stored", () => {
    const words = (currency: string) =>
      plain(
        render((invoice) => {
          invoice.currency = currency;
          invoice.customLabels = {
            ...invoice.customLabels,
            totalInWordsValue: "",
          };
          invoice.finalTotal = { ...invoice.finalTotal, total: 1655 };
        })
      );
    expect(words("USD")).toContain(
      "ONE THOUSAND SIX HUNDRED FIFTY FIVE DOLLARS ONLY"
    );
    expect(words("XYZ")).not.toContain("RUPEES");
  });

  it("prints GSTIN and PAN for an Indian buyer, not for one abroad", () => {
    const ids = (country: string) =>
      plain(
        render((invoice) => {
          invoice.billedTo.country = country;
          invoice.billedTo.gstin = "29BBBBB1111B1Z5";
          invoice.billedTo.panNumber = "BBBBB1111B";
        })
      );
    expect(ids("IN")).toContain("29BBBBB1111B1Z5");
    expect(ids("IN")).toContain("BBBBB1111B");
    expect(ids("HK")).not.toContain("29BBBBB1111B1Z5");
    expect(ids("HK")).not.toContain("BBBBB1111B");
  });

  it("prints a VAT number for a party outside India, never for an Indian one", () => {
    const vat = (taxType: string, country: string) =>
      plain(
        render((invoice) => {
          invoice.taxType = taxType;
          invoice.billedTo.country = country;
          invoice.billedTo.vatNumber = "100000000000003";
        })
      ).includes("100000000000003");
    expect(vat("INDIA", "AE")).toBe(true);
    expect(vat("GLOBAL", "IN")).toBe(false);
    expect(vat("INDIA", "IN")).toBe(false);
  });

  it("never prints a bare GSTIN / PAN label, even with Show when Empty on", () => {
    const withEmpty = (showWhenEmpty: boolean) =>
      plain(
        section(
          render((invoice) => {
            invoice.billedTo.gstin = "";
            invoice.billedTo.panNumber = "";
            invoice.owner = invoice.owner || {};
            invoice.owner.configuration = {
              experimental: {
                fieldVisibility: {
                  gst: { showInDocument: true, showWhenEmpty },
                  pan: { showInDocument: true, showWhenEmpty },
                },
              },
            };
          }),
          "parties"
        ).split("Billing Address")[1]
      );
    expect(withEmpty(true)).not.toMatch(/GSTIN:|PAN:/);
    expect(withEmpty(false)).not.toMatch(/GSTIN:|PAN:/);
  });

  it("prints a credit / debit note's reason in the document details", () => {
    const html = plain(
      section(
        render((invoice) => {
          invoice.documentReason = "Product Return";
        }),
        "details"
      )
    );
    expect(html).toContain("Reason: Product Return");
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
  });

  it("prints the payments table only when Show Payments Table is on", () => {
    expect(
      view((invoice) => {
        invoice.advanceOptions = {
          ...invoice.advanceOptions,
          showPaymentsTable: undefined,
        };
      }).payments.hidden
    ).toBe(true);
    expect(
      view((invoice) => {
        invoice.advanceOptions = {
          ...invoice.advanceOptions,
          showPaymentsTable: true,
        };
      }).payments.hidden
    ).toBe(false);
  });

  it("labels the bank rows and the footer fields as Refrens does", () => {
    const result = view((invoice) => {
      invoice.paymentOptions = {
        ...invoice.paymentOptions,
        accountTransfer: true,
      };
      invoice.bankAccount = {
        accountNo: "1234567890",
        bank: "State Bank",
        accountType: "SAVINGS",
      };
    });
    const rows = Object.fromEntries(
      result.bank.rows.map((row: Json) => [row.label, row.value])
    );
    expect(rows).toMatchObject({
      "Account Number": "1234567890",
      Bank: "State Bank",
      "Account Type": "Savings",
    });
    // A bank abroad prints no account type, as refrens.com.
    const abroad = view((invoice) => {
      invoice.paymentOptions = {
        ...invoice.paymentOptions,
        accountTransfer: true,
      };
      invoice.bankAccount = {
        accountNo: "1234567890",
        accountType: "SAVINGS",
        country: "HK",
      };
    });
    expect(
      abroad.bank.rows.map((row: Json) => row.label).includes("Account Type")
    ).toBe(false);
    // A delivery challan prints no bank details.
    const challan = view((invoice) => {
      invoice.billType = "DELIVERYCHALLAN";
      invoice.paymentOptions = {
        ...invoice.paymentOptions,
        accountTransfer: true,
      };
      invoice.bankAccount = { accountNo: "1234567890", bank: "State Bank" };
    });
    expect(challan.bank.rows).toHaveLength(0);
  });

  it("tags each kind of document as refrens.com does", () => {
    const tag = (billType: string, status: string, extra: Json = {}) =>
      statusTag({ billType, status, ...extra })?.text ?? null;
    expect(tag("INVOICE", "PAID")).toBe("Paid");
    expect(tag("INVOICE", "PARTIAL")).toBe("Part Paid");
    expect(tag("INVOICE", "UNPAID")).toBeNull();
    expect(tag("PROFORMAINV", "UNPAID")).toBeNull();
    expect(tag("DELIVERYCHALLAN", "UNPAID")).toBe("Created");
    expect(tag("PURCHASEORDER", "UNPAID")).toBe("Created");
    expect(tag("QUOTATION", "UNPAID")).toBe("Created");
    expect(tag("QUOTATION", "CANCELED")).toBe("Cancelled");
    expect(tag("DEBITNOTE", "CANCELED")).toBe("Canceled");
    expect(tag("CREDITNOTE", "UNPAID", { creditNoteStatus: "ISSUED" })).toBe(
      "Issued"
    );
    expect(tag("CREDITNOTE", "UNPAID", { creditNoteStatus: "PARTIAL" })).toBe(
      "Partially Utilised"
    );
    expect(tag("SALESORDER", "UNPAID")).toBeNull();
    expect(tag("SALESORDER", "DRAFT")).toBe("Draft");
    // Emailed: Sent until the email is opened, then Seen.
    const emailed = (open: number) => ({ reminders: { views: [{ open }] } });
    expect(tag("QUOTATION", "UNPAID", emailed(0))).toBe("Quotation Sent");
    expect(tag("DELIVERYCHALLAN", "UNPAID", emailed(1))).toBe(
      "Delivery Challan Seen"
    );
    expect(tag("INVOICE", "UNPAID", emailed(1))).toBeNull();
    // A credit note past its due date has no tag; a fully used one is Redeemed.
    expect(
      tag("CREDITNOTE", "UNPAID", {
        creditNoteStatus: "ISSUED",
        isOverdue: true,
      })
    ).toBeNull();
    expect(tag("CREDITNOTE", "PAID", { creditNoteStatus: "REDEEMED" })).toBe(
      "Redeemed"
    );
  });

  it("prints no heading over the document details (user request)", () => {
    const html = render((invoice) => {
      invoice.customLabels = {
        ...invoice.customLabels,
        invoiceDetails: "Quotation Details",
      };
    });
    expect(section(html, "details")).not.toContain("Quotation Details");
  });

  it("puts # before the number unless the business hides it", () => {
    const number = (hide?: boolean) =>
      plain(
        section(
          render((invoice) => {
            invoice.owner = {
              ...(invoice.owner || {}),
              configuration: { hideHashInDocumentNumber: hide },
            };
          }),
          "details"
        )
      );
    expect(number(false)).toMatch(/: #\S+/);
    expect(number(true)).not.toContain("#");
  });

  it("stretches the item table to the page only when the business and document ask", () => {
    const stretch = (enabled: boolean, full: boolean) =>
      render((invoice, root) => {
        invoice.owner = {
          ...(invoice.owner || {}),
          configuration: { experimental: { stretchInvoiceTable: enabled } },
        };
        root.pdfOptions = { ...(root.pdfOptions || {}), fullHeightTable: full };
        invoice.template = {
          ...(invoice.template || {}),
          pdfOptions: {
            ...(invoice.template?.pdfOptions || {}),
            fullHeightTable: full,
          },
        };
      });
    expect(stretch(true, true)).toContain('class="ec-filler"');
    expect(stretch(true, true)).toContain("ec-doc is-stretch");
    expect(stretch(false, true)).not.toContain('class="ec-filler"');
    expect(stretch(true, false)).not.toContain('class="ec-filler"');
    // A Long PDF has no page to fill.
    expect(
      render((invoice, root) => {
        invoice.owner = {
          ...(invoice.owner || {}),
          configuration: { experimental: { stretchInvoiceTable: true } },
        };
        root.pdfOptions = {
          ...(root.pdfOptions || {}),
          fullHeightTable: true,
          longPdf: true,
        };
        invoice.template = {
          ...(invoice.template || {}),
          pdfOptions: {
            ...(invoice.template?.pdfOptions || {}),
            fullHeightTable: true,
            longPdf: true,
          },
        };
      })
    ).not.toContain("ec-doc is-stretch");
    // Every document type (user request), a delivery challan too.
    expect(
      render((invoice, root) => {
        invoice.billType = "DELIVERYCHALLAN";
        invoice.owner = {
          ...(invoice.owner || {}),
          configuration: { experimental: { stretchInvoiceTable: true } },
        };
        root.pdfOptions = { ...(root.pdfOptions || {}), fullHeightTable: true };
        invoice.template = {
          ...(invoice.template || {}),
          pdfOptions: { fullHeightTable: true },
        };
      })
    ).toContain('class="ec-filler"');
  });

  it("prints one QR: the active e-invoice's in the e-invoice section, the document QR otherwise", () => {
    const irn = { Irn: "abc123", qr: '{"SellerGstin":"24AAAAA0000A1Z5"}' };
    const documentQr = '{"Invoice No":"INV-1"}';
    const active = view((invoice) => {
      invoice.irn = irn;
      invoice.documentQr = documentQr;
    }).compliance.qr;
    const cancelled = view((invoice) => {
      invoice.irn = irn;
      invoice.einvoiceGeneratedStatus = "CANCELLED";
      invoice.documentQr = documentQr;
    }).compliance.qr;
    expect(active.document).toBe("");
    expect(active.irn).toMatch(/^data:image\/svg\+xml/);
    expect(cancelled.irn).toBe("");
    expect(cancelled.document).toMatch(/^data:image\/svg\+xml/);
    const html = render((invoice) => {
      invoice.irn = irn;
      invoice.documentQr = documentQr;
    });
    expect(
      html.match(/<img data-ceres-field="(?:qrCode|documentQr)" src=/g)
    ).toHaveLength(1);
    expect(section(html, "compliance")).toContain(
      'data-ceres-field="qrCode" src='
    );
  });

  it("writes the tax summaries' words in the document's currency, as Refrens", () => {
    expect(amountInCurrencyWords(5400.18, "USD")).toBe(
      "FIVE THOUSAND FOUR HUNDRED DOLLARS AND EIGHTEEN CENTS ONLY"
    );
    expect(amountInCurrencyWords(118, "SAR")).toBe(
      "ONE HUNDRED EIGHTEEN RIYALS ONLY"
    );
    expect(amountInCurrencyWords(1250000, "USD")).toBe(
      "ONE MILLION TWO HUNDRED FIFTY THOUSAND DOLLARS ONLY"
    );
    expect(amountInCurrencyWords(118, "INR")).toMatch(/RUPEES/);
  });
});

describe("Ecommerce template — frame split by a page break", () => {
  it("draws the frame's border on each page's piece", () => {
    const source = fs.readFileSync(
      path.join(TEMPLATE_DIR, "styles.css"),
      "utf8"
    );
    const frame = source.slice(source.indexOf(".ec-frame {"));
    expect(frame.slice(0, frame.indexOf("}"))).toMatch(
      /-webkit-box-decoration-break: clone;\s*box-decoration-break: clone;/
    );
  });
});
