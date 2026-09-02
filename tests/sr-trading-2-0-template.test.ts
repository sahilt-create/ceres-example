import HandlebarsRuntime from "handlebars/runtime";
import { readFileSync } from "fs";
import { join } from "path";
import template from "../src/templates/sr-trading-2-0/template.hbs";
import {
  isSrPartyFieldVisible,
  mapSrTradingTemplateData,
} from "../src/templates/sr-trading-2-0.mapper";
import {
  formatCountryName,
  formatQuantityWithUnit,
  formatSolvinCurrency,
  formatSrTradingCurrency,
  getItemColumnValue,
  getItemSerialNumbers,
  getItemSku,
  getItemUnit,
  getPartyAddressLines,
  shouldShowItemSku,
  solvinTaxAmountInWords,
  summarizeItemQuantity,
  toTitleCaseWords,
} from "../src/templates/helpers";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" ? value : {};

const keyOf = (column: any): string =>
  String(asRecord(column).key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isKey = (column: any, keys: string[]): boolean =>
  keys.includes(keyOf(column));

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};

beforeAll(() => {
  HandlebarsRuntime.registerPartial(
    "MarkdownViewer",
    (value: unknown) =>
      `<span class="markdown-output">${String(value ?? "")}</span>`
  );
  HandlebarsRuntime.registerPartial("RefrensBranding", () => "");
  HandlebarsRuntime.registerHelper(
    "prepareMarkdownViewerData",
    (value: unknown) => String(value ?? "")
  );
  HandlebarsRuntime.registerHelper(
    "formateShortDateWithOffset",
    (value: unknown) => String(value ?? "")
  );
  HandlebarsRuntime.registerHelper("formatPhoneNumber", (value: unknown) =>
    String(value ?? "")
  );
  HandlebarsRuntime.registerHelper("partyAddressLines", getPartyAddressLines);
  HandlebarsRuntime.registerHelper("formatCountryName", formatCountryName);
  HandlebarsRuntime.registerHelper(
    "addOne",
    (value: unknown) => Number(value) + 1
  );
  HandlebarsRuntime.registerHelper("titleCaseWords", toTitleCaseWords);
  HandlebarsRuntime.registerHelper(
    "amountInWords",
    () => "Two Hundred Thirty Six"
  );
  HandlebarsRuntime.registerHelper(
    "srTaxAmountInWords",
    solvinTaxAmountInWords
  );
  HandlebarsRuntime.registerHelper("itemSerialNumbers", getItemSerialNumbers);
  HandlebarsRuntime.registerHelper("itemUnit", getItemUnit);
  HandlebarsRuntime.registerHelper("itemHsn", (item: unknown) =>
    String(
      asRecord(item).hsn ?? asRecord(item).sac ?? asRecord(item).hsnCode ?? ""
    )
  );
  HandlebarsRuntime.registerHelper("itemColumnValue", getItemColumnValue);
  HandlebarsRuntime.registerHelper(
    "itemNameValue",
    (itemValue: unknown, columnValue: unknown) => {
      const item = asRecord(itemValue);
      const key = keyOf(columnValue);
      if (["item", "name", "description"].includes(key)) {
        return item.name ?? item.title ?? getItemColumnValue(item, columnValue);
      }
      return getItemColumnValue(item, columnValue);
    }
  );
  HandlebarsRuntime.registerHelper("itemSku", getItemSku);
  HandlebarsRuntime.registerHelper("showItemSku", shouldShowItemSku);
  HandlebarsRuntime.registerHelper("isRowNumberColumn", (column: unknown) =>
    isKey(column, ["sr", "srno", "sno", "rownumber", "index"])
  );
  HandlebarsRuntime.registerHelper("isDescriptionColumn", (column: unknown) =>
    isKey(column, ["item", "name", "description"])
  );
  HandlebarsRuntime.registerHelper("isQuantityColumn", (column: unknown) =>
    isKey(column, ["quantity", "qty"])
  );
  HandlebarsRuntime.registerHelper("isRateColumn", (column: unknown) =>
    isKey(column, ["rate", "unitrate", "unitprice", "price"])
  );
  HandlebarsRuntime.registerHelper("isUnitColumn", (column: unknown) =>
    isKey(column, ["unit", "uom", "unitname"])
  );
  HandlebarsRuntime.registerHelper("isHsnColumn", (column: unknown) =>
    isKey(column, ["hsn", "sac", "hsncode", "hsnsac"])
  );
  HandlebarsRuntime.registerHelper("isDateColumn", (column: unknown) => {
    const record = asRecord(column);
    const dataType = String(
      record.dataType ?? record.fxReturnType ?? record.semanticType ?? ""
    ).toLowerCase();
    const key = keyOf(column);
    return (
      ["date", "datetime", "timestamp"].includes(dataType) ||
      key === "date" ||
      key.endsWith("date")
    );
  });
  HandlebarsRuntime.registerHelper("isCurrencyColumn", (column: unknown) =>
    isKey(column, [
      "rate",
      "amount",
      "subtotal",
      "total",
      "igst",
      "cgst",
      "sgst",
      "utgst",
    ])
  );
  HandlebarsRuntime.registerHelper("isAmountColumn", (column: unknown) =>
    isKey(column, ["amount", "subtotal"])
  );
  HandlebarsRuntime.registerHelper("isTotalColumn", (column: unknown) =>
    isKey(column, ["total"])
  );
  HandlebarsRuntime.registerHelper("isPercentageColumn", (column: unknown) =>
    isKey(column, ["gstrate", "taxrate", "cessrate"])
  );
  HandlebarsRuntime.registerHelper("isBooleanColumn", (column: unknown) =>
    ["boolean", "bool"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  HandlebarsRuntime.registerHelper("isNumericColumn", (column: unknown) =>
    ["number", "numeric", "decimal", "integer"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  HandlebarsRuntime.registerHelper("formatBoolean", (value: unknown) =>
    value ? "Yes" : "No"
  );
  HandlebarsRuntime.registerHelper(
    "hasDisplayValue",
    (value: unknown) =>
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.trim().length > 0)
  );
  HandlebarsRuntime.registerHelper("formatSrBoolean", (value: unknown) => {
    const parsed = optionalBoolean(value);
    if (parsed === undefined) return "";
    return parsed ? "Yes" : "No";
  });
  HandlebarsRuntime.registerHelper(
    "formatItemNumber",
    (item: unknown, column: unknown) =>
      String(getItemColumnValue(item, column)).replace(/%/g, "")
  );
  HandlebarsRuntime.registerHelper(
    "formatSrCurrency",
    (value: unknown) => `money:${String(value ?? "")}`
  );
  HandlebarsRuntime.registerHelper(
    "formatDeductionCurrency",
    (value: unknown) => `money:-${Math.abs(Number(value) || 0)}`
  );
  HandlebarsRuntime.registerHelper("partyFieldVisible", isSrPartyFieldVisible);
  HandlebarsRuntime.registerHelper("partyEntryVisible", (value: unknown) => {
    const entry = asRecord(value);
    const shown =
      optionalBoolean(entry.showInInvoice) ??
      optionalBoolean(asRecord(entry.params).showInInvoice);
    if (shown === false) return false;
    const hidden =
      optionalBoolean(entry.isHidden) ??
      optionalBoolean(entry.hideInInvoice) ??
      optionalBoolean(asRecord(entry.params).isHidden) ??
      optionalBoolean(asRecord(entry.params).hideInInvoice);
    return hidden !== true;
  });
  HandlebarsRuntime.registerHelper("quantityWithUnit", formatQuantityWithUnit);
  HandlebarsRuntime.registerHelper(
    "quantityOnly",
    (item: unknown, invoice: unknown) =>
      formatQuantityWithUnit(item, false, invoice)
  );
  HandlebarsRuntime.registerHelper(
    "formatTotalQuantity",
    summarizeItemQuantity
  );
  HandlebarsRuntime.registerHelper(
    "columnSummaryValue",
    (items: unknown[], column: unknown) =>
      (Array.isArray(items) ? items : []).reduce<number>(
        (sum, item) => sum + Number(getItemColumnValue(item, column) || 0),
        0
      )
  );
  HandlebarsRuntime.registerHelper(
    "columnRateSummaryValue",
    (items: unknown[], column: unknown) =>
      [
        ...new Set(
          (Array.isArray(items) ? items : []).map((item) =>
            Number(getItemColumnValue(item, column) || 0)
          )
        ),
      ]
        .map((value) => `${value}%`)
        .join(", ")
  );
  HandlebarsRuntime.registerHelper(
    "columnAlignmentClass",
    (column: unknown) => {
      const record = asRecord(column);
      const key = keyOf(column);
      const dataType = String(
        record.dataType ?? record.fxReturnType ?? record.semanticType ?? ""
      ).toLowerCase();
      return ["date", "datetime", "timestamp"].includes(dataType) ||
        key === "date" ||
        key.endsWith("date")
        ? "align-left is-date-column"
        : "align-left";
    }
  );
});

const payload = () => ({
  invoice: {
    _id: "quotation-1",
    billType: "QUOTATION",
    invoiceType: "QUOTATION",
    status: "DRAFT",
    invoiceNumber: "A00002",
    quotationNumber: "QT-2002",
    invoiceTitle: "Quotation",
    invoiceDate: "2026-07-06",
    dueDate: "2026-07-21",
    currency: "INR",
    subUnitLength: 2,
    billedTo: {
      name: "AE INDUSTRIES",
      city: "Faridabad",
      state: "Haryana",
      country: "IN",
      pincode: "121004",
      gstin: "06AAAAA0000A1Z5",
    },
    billedBy: {
      logo: "data:image/png;base64,catalogue-logo",
    },
    documentQr: "data:image/png;base64,document-qr-is-not-the-logo",
    items: [
      {
        name: "Power Press",
        description: "Steel Body",
        hsn: "121213",
        quantity: 1,
        unit: "pcs",
        rate: 100000,
        amount: 100000,
      },
    ],
    columns: [
      { key: "item", label: "Item" },
      { key: "hsn", label: "HSN/SAC" },
      { key: "quantity", label: "Quantity" },
      { key: "rate", label: "Rate" },
      { key: "amount", label: "Taxable Value" },
    ],
    subTotal: 5,
    finalTotal: { cgst: 9000, sgst: 9000, total: 118000 },
    taxName: "GST",
    taxType: "INDIA",
    igst: false,
    terms: [{ label: "Terms", terms: ["100% payment in advance."] }],
    bankAccount: {
      name: "S.R. Trading Company",
      accountNo: "661305602062",
      ifsc: "ICIC0006613",
      accountType: "Current account",
      bank: "ICICI Bank",
      customFields: [
        { label: "Branch", value: "Faridabad", dataType: "string" },
        { label: "Branch", value: "New Delhi", dataType: "string" },
      ],
    },
    paymentOptions: { accountTransfer: true, upi: false },
    advanceOptions: { unitColumn: "MERGE_QUANTITY" },
  },
  ownerBusiness: { _id: "business-1" },
});

describe("SR Trading 2.0 template", () => {
  it("fits the items table to the document without a horizontal scroller", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const itemsTableWrapRule = css.match(
      /\.items-table-wrap\s*\{([^}]*)\}/
    )?.[1];

    expect(itemsTableWrapRule).toContain("overflow-x: visible;");
    expect(css).toMatch(
      /\.items-table\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?table-layout:\s*auto;[\s\S]*?width:\s*100%;[\s\S]*?\}/
    );
    expect(css).toMatch(
      /\.items-table col:not\(\.col-index, \.col-item\)\s*\{[^}]*width:\s*1%;/
    );
    expect(itemsTableWrapRule).not.toContain("overflow-x: auto;");
    expect(css).toMatch(
      /\.totals-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) clamp\(135px, 18%, 180px\);/
    );
    expect(css).toMatch(
      /\.totals-row > :last-child\s*\{[^}]*overflow-wrap:\s*normal;[^}]*white-space:\s*nowrap;/
    );
  });

  it("uses Lydia template color and font variables", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );

    expect(css).toContain("background: var(--primary-background, #fff);");
    expect(css).toContain("color: var(--secondary-color, #000);");
    expect(css).toContain(
      "font-family: var(--subtitle-font, Inter, Arial, Helvetica, sans-serif);"
    );
    expect(css).toContain("color: var(--primary-color, #000);");
    expect(css).toContain(
      "background: var(--secondary-background, transparent);"
    );
    expect(css).toContain(
      "font-family: var(--title-font, Inter, Arial, Helvetica, sans-serif);"
    );
  });

  it("keeps UPI and Lydia compliance QR targets separate", () => {
    const input = payload();
    Object.assign(input.invoice, {
      irn: {
        Irn: "IRN-123",
        qrCode: "data:image/png;base64,e-invoice-qr",
      },
      zatcaQrCode: "data:image/png;base64,zatca-qr",
      lhdnQrCode: "data:image/png;base64,lhdn-qr",
      documentQr: "data:image/png;base64,document-qr",
      paymentOptions: { accountTransfer: true, upi: true },
      upi: {
        vpa: "srtrading@upi",
        qrCode: "data:image/png;base64,upi-qr",
      },
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).toContain('data-ceres-field="irn">IRN-123</span>');
    expect(html).toContain('data-ceres-field="qrCode"');
    expect(html).toContain('data-ceres-field="zatcaQrCode"');
    expect(html).toContain('data-ceres-field="lhdnQrCode"');
    expect(html).not.toContain('data-ceres-field="documentQr"');
    expect(html).not.toContain('data-ceres-field-container="documentQr"');
    expect(html).not.toContain('alt="Document QR Code"');
    expect(html).toContain('src="data:image/png;base64,upi-qr" alt="UPI QR"');
    expect(html).not.toContain('alt="UPI QR" data-ceres-field="qrCode"');
  });

  it("keeps description Markdown tables inside the item cell", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const nestedTableRule = css.match(
      /\.item-description \.markdown-viewer-widget table,[^{]*\{([^}]*)\}/
    )?.[1];
    const nestedCellRule = css.match(
      /\.item-description \.markdown-viewer-widget table th,[^{]*\{([^}]*)\}/
    )?.[1];
    const descriptionRule = css.match(/\.item-description\s*\{([^}]*)\}/)?.[1];
    const viewerRule = css.match(
      /\.item-description \.markdown-viewer-widget,\s*\.item-description \.toastui-editor-contents\s*\{([^}]*)\}/
    )?.[1];

    expect(descriptionRule).toContain("max-width: 100%;");
    expect(descriptionRule).toContain("min-width: 0;");
    expect(descriptionRule).toContain("overflow: hidden;");
    expect(viewerRule).toContain("max-width: 100%;");
    expect(viewerRule).toContain("overflow: hidden;");
    expect(nestedTableRule).toContain("box-sizing: border-box;");
    expect(nestedTableRule).toContain("max-width: 100%;");
    expect(nestedTableRule).toContain("min-width: 0;");
    expect(nestedTableRule).toContain("table-layout: fixed;");
    expect(nestedTableRule).toContain("width: 100%;");
    expect(nestedCellRule).toContain("overflow-wrap: anywhere;");
    expect(nestedCellRule).toContain("white-space: normal;");
  });

  it("keeps every table cell at 6px padding on screen and in print", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const tableCellPaddingValues = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector]) =>
        [".items-table", ".summary-table", ".bank-table"].some(
          (tableSelector) =>
            selector.includes(tableSelector) &&
            (selector.includes(" td") || selector.includes(" th"))
        )
      )
      .flatMap(([, , declarations]) =>
        [
          ...declarations.matchAll(
            /padding(?:-(?:top|right|bottom|left))?:\s*([^;]+);/g
          ),
        ].map(([, value]) => value.trim())
      );

    expect(tableCellPaddingValues.length).toBeGreaterThan(0);
    expect(new Set(tableCellPaddingValues)).toEqual(new Set(["6px"]));
    expect(css).toMatch(
      /\.summary-table \.summary-code\s*\{[^}]*font-size:\s*13px;/
    );
  });

  it("aligns bank and UPI headings with the bank-table text inset", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const alignmentRule = css.match(
      /\.bank-panel\s*>\s*h2,\s*\.bank-panel\s*>\s*\.upi-block\s*\{([^}]*)\}/
    )?.[1];

    expect(alignmentRule).toContain("margin-left: 6px;");
  });

  it("separates the lower details from visible summary tables with a border", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const summaryTablesRule = css.match(/\.summary-tables\s*\{([^}]*)\}/)?.[1];

    expect(summaryTablesRule).toContain(
      "border-top: 1px solid var(--sr-border-color);"
    );
    expect(summaryTablesRule).not.toContain("border-bottom:");

    const signatureRule = css.match(/\.signature-section\s*\{([^}]*)\}/)?.[1];
    expect(signatureRule).not.toContain("border-top:");
    expect(css).toMatch(
      /\.lower-grid\s*\+\s*\.summary-tables\.is-empty\s*\+\s*\.signature-section\s*\{[\s\S]*?border-top:\s*1px solid var\(--sr-border-color\);/
    );
  });

  it("keeps the UPI QR container and image at 100 by 100 pixels", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const containerRule = css.match(/\.upi-qr-container\s*\{([^}]*)\}/)?.[1];
    const imageRule = css.match(/\.upi-qr-container img\s*\{([^}]*)\}/)?.[1];

    expect(containerRule).toContain("height: 100px;");
    expect(containerRule).toContain("margin-left: -8px;");
    expect(containerRule).toContain("width: 100px;");
    expect(imageRule).toContain("height: 100px;");
    expect(imageRule).toContain("width: 100px;");
  });

  it("uses consistent 12px padding across the quotation detail sections", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );

    [
      "quotation-to",
      "shipping-block",
      "details-list",
      "catalogue-block",
    ].forEach((className) => {
      const rule = css.match(
        new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`)
      )?.[1];
      expect(rule).toContain("padding: 12px;");
    });
  });

  it("keeps the screen's two-column structure in print", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));

    expect(printCss).toContain(".quotation-meta,\n  .lower-grid");
    expect(printCss).toContain(
      "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);"
    );
    expect(printCss).toContain(
      "border-right: 1px solid var(--sr-border-color)"
    );
    expect(printCss).toContain('[id="ceresManifestBadge"]');
    expect(printCss).toContain("display: none !important");
    expect(printCss).not.toContain("@page {");
    expect(printCss).toContain(".quotation-to,\n  .catalogue-block,");
    expect(printCss).toContain(".invoice-letterhead-footer {");
    expect(printCss).toContain("break-before: avoid-page;");
  });

  it("attaches print caps to sections without cloning them at page edges", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));
    const frameRule = printCss.match(/\.document-frame\s*\{([^}]*)\}/)?.[1];

    expect(frameRule).toContain("border-right: 0;");
    expect(frameRule).toContain("border-left: 0;");
    expect(frameRule).toContain("-webkit-box-decoration-break: slice;");
    expect(frameRule).toContain("box-decoration-break: slice;");
    expect(frameRule).not.toContain("box-decoration-break: clone;");
    expect(printCss).toMatch(
      /\.invoice-letterhead,[\s\S]*?\.invoice-letterhead-footer\s*\{[\s\S]*?border-right:\s*1px solid var\(--sr-border-color\);[\s\S]*?border-left:\s*1px solid var\(--sr-border-color\);/
    );
    const lowerGridRules = [
      ...printCss.matchAll(/\.lower-grid\s*\{([^}]*)\}/g),
    ];
    const lowerGridCapRule = lowerGridRules.find((match) =>
      match[1].includes("border-bottom")
    )?.[1];

    expect(lowerGridCapRule).toContain(
      "border-bottom: 1px solid var(--sr-border-color);"
    );
    expect(printCss).toMatch(
      /\.lower-grid\s*\+\s*\.summary-tables\s*\{[\s\S]*?margin-top:\s*-0\.5px;/
    );
    expect(printCss).toMatch(
      /body\.is-lydia-pageless-print \.items-table-wrap,[\s\S]*?body\.is-lydia-pageless-print \.totals-section\s*\{[\s\S]*?margin-top:\s*0;/
    );
    expect(printCss).toMatch(
      /body\.is-lydia-pageless-print \.items-table thead th\s*\{[^}]*background-image:\s*none;/
    );
    expect(printCss).toMatch(
      /body\.is-lydia-pageless-print \.totals-section,[\s\S]*?body\.is-lydia-pageless-print \.lower-grid\s*\{[^}]*border-top-width:\s*0;[^}]*border-bottom-width:\s*0;/
    );
  });

  it("paints one top cap when the items header repeats after a PDF break", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));
    const headerCapRule = printCss.match(
      /\.items-table thead th\s*\{([^}]*)\}/
    )?.[1];

    expect(headerCapRule).toContain("background-image: linear-gradient(");
    expect(headerCapRule).toContain("background-position: top left;");
    expect(headerCapRule).toContain("background-repeat: no-repeat;");
    expect(headerCapRule).toContain("background-size: 100% 0.5px;");
    expect(printCss).toMatch(
      /\.items-table-wrap\s*\{[\s\S]*?margin-top:\s*-0\.5px;[\s\S]*?overflow:\s*visible;/
    );
  });

  it("removes host spacing that can create a trailing blank PDF page", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));
    const printRootRule = printCss.match(
      /html,\s*body,\s*\[id="documentOutput"\]\s*\{([^}]*)\}/
    )?.[1];

    expect(printRootRule).toContain("min-height: 0;");
    expect(printRootRule).not.toContain("min-height: 0 !important;");
    expect(printRootRule).toContain("margin: 0 !important;");
    expect(printRootRule).toContain("padding: 0 !important;");
    expect(printRootRule).toContain("overflow: visible !important;");
    expect(printCss).toMatch(
      /html,\s*body\s*\{[\s\S]*?max-height:\s*none !important;/
    );
  });

  it("keeps Lydia print height authoritative and compacts the PDF signature", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));
    const printRootRule = printCss.match(
      /html,\s*body,\s*\[id="documentOutput"\]\s*\{([^}]*)\}/
    )?.[1];
    const signatureRules = [
      ...printCss.matchAll(/\.signature-section\s*\{([^}]*)\}/g),
    ].map((match) => match[1]);
    const compactSignatureRule = signatureRules.find((rule) =>
      rule.includes("min-height: 125px;")
    );

    expect(printRootRule).toContain("min-height: 0;");
    expect(printRootRule).not.toContain("min-height: 0 !important;");
    expect(compactSignatureRule).toContain("padding: 12px 16px 10px;");
    expect(printCss).toMatch(
      /\.signature-image\s*\{[\s\S]*?height:\s*56px;[\s\S]*?width:\s*86px;/
    );
  });

  it("allows long business document titles to wrap without overlap", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const titleRule = css.match(/\.document-title h1\s*\{([^}]*)\}/)?.[1];

    expect(titleRule).toContain("max-width: 100%;");
    expect(titleRule).toContain("overflow-wrap: break-word;");
    expect(titleRule).toContain("word-break: normal;");
  });

  it("gives a page-starting totals section one clean top border", () => {
    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    const printCss = css.slice(css.lastIndexOf("@media print"));
    const totalsRule = [...printCss.matchAll(/\.totals-section\s*\{([^}]*)\}/g)]
      .map((match) => match[1])
      .find((rule) => rule.includes("border-top:"));

    expect(totalsRule).toContain(
      "border-top: 1px solid var(--sr-border-color);"
    );
    expect(totalsRule).toContain("margin-top: -0.5px;");
  });

  it("maps quotation metadata, derives the visible subtotal, and keeps descriptions inline", () => {
    const model = mapSrTradingTemplateData(payload() as any);

    expect(model.display.document.number).toBe("QT-2002");
    expect(model.display.document.validTill).toBe("2026-07-21");
    expect(model.display.document.catalogueLogo).toBe(
      "data:image/png;base64,catalogue-logo"
    );
    expect(model.totals.subTotal).toBe(100000);
    expect(model.display.labels.subTotal).toBe("Taxable Value");
    expect(model.mapped.visibility.isDescriptionFullWidth).toBe(false);

    const html = template(model);
    expect(html).toContain("Power Press");
    expect(html).toContain("Steel Body");
    expect(html).toContain('class="item-quantity-unit"');
    expect(html).not.toContain('class="item-inner-index"');
    expect(html.match(/Steel Body/g)).toHaveLength(1);
    expect(html).toContain('data-ceres-field-container="logo"');
    expect(html).toContain('data-ceres-field="logo"');
    expect(html).toContain("invoice-letterhead");
    expect(html).toContain("invoice-letterhead-footer");
  });

  it("keeps preview typography fixed and reduces overflowing PDF tables uniformly", () => {
    const model = mapSrTradingTemplateData(payload() as any);
    model.invoice.items[0].sku = "PRESS-001";
    model.mapped.visibility.showSkuInName = true;
    model.mapped.visibility.showInlineHsn = true;
    model.mapped.visibility.showUnitInName = true;

    const html = template(model);

    expect(html).toContain('class="item-code item-code-sku"');
    expect(html).toContain('class="item-code item-code-hsn"');
    expect(html).toContain('class="item-code item-code-unit"');
    expect(html).toMatch(
      /class="item-code item-code-sku"><span class="item-code-label">SKU:<\/span> <span class="item-code-value">PRESS-001<\/span>/
    );
    expect(html).toMatch(
      /class="item-code item-code-hsn"><span class="item-code-label">HSN\/SAC:<\/span> <span class="item-code-value">121213<\/span>/
    );
    expect(html).toMatch(
      /class="item-code item-code-unit"><span class="item-code-label">Unit:<\/span> <span class="item-code-value">pcs<\/span>/
    );
    expect(html).toContain('class="item-name"');

    const itemNamePosition = html.indexOf('class="item-name"');
    const itemCodesPosition = html.indexOf('class="item-codes"');
    const descriptionPosition = html.indexOf('class="item-description"');
    expect(itemNamePosition).toBeLessThan(itemCodesPosition);
    expect(itemCodesPosition).toBeLessThan(descriptionPosition);

    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    expect(css).toMatch(
      /\.item-codes\s*\{[\s\S]*?font-size:\s*11px;[\s\S]*?margin-top:\s*8px\s*!important;/
    );
    expect(css).toMatch(/\.item-code\s*\{[\s\S]*?font-size:\s*11px;/);
    expect(css).toMatch(
      /\.item-code-label\s*\{[^}]*color:\s*#000;[^}]*font-weight:\s*500;/
    );
    expect(css).toMatch(/\.items-table\s*\{[\s\S]*?font-size:\s*13px;/);
    expect(css).toMatch(
      /\.sr-trading-document\.is-compact-print-table \.items-table,[\s\S]*?font-size:\s*var\(--sr-print-table-font-size, 11px\);/
    );
    expect(css).not.toMatch(
      /\.items-table (?:th|td)\.col-(?:hsn-sac|sku|unit)[^}]*font-size:\s*11px;/
    );
    expect(css).toContain(
      ".sr-trading-document.is-compact-print-table .items-table *"
    );
    expect(css).toMatch(
      /\.items-table tbody \.item-row > td:not\(\.col-item, \.col-index\)\s*\{[\s\S]*?text-align:\s*center;[\s\S]*?vertical-align:\s*top;/
    );

    const printCss = css.slice(css.lastIndexOf("@media print"));
    expect(printCss).toMatch(
      /\.items-table\s*\{[^}]*max-width:\s*100%;[^}]*table-layout:\s*auto;/
    );
    expect(printCss).toMatch(
      /\.items-table col\.col-index\s*\{[^}]*width:\s*42px;/
    );
    expect(printCss).toMatch(
      /\.items-table col:not\(\.col-index, \.col-item\)\s*\{[^}]*width:\s*1%;/
    );
    expect(printCss).toMatch(
      /\.items-table td\.col-index,[\s\S]*?\.items-table th\.col-index\s*\{[^}]*min-width:\s*42px;[^}]*width:\s*42px;[^}]*white-space:\s*nowrap;/
    );
    expect(printCss).toMatch(
      /\.item-description table\s*\{[^}]*max-width:\s*100%\s*!important;[^}]*table-layout:\s*fixed\s*!important;/
    );
    expect(printCss).toMatch(
      /\.sr-trading-document,[\s\S]*?\.sr-trading-document \*\s*\{[^}]*border-width:\s*0\.5px;/
    );
  });

  it("shows HSN/SAC as a separate column by default without duplicating it", () => {
    const model = mapSrTradingTemplateData(payload() as any);
    const visibleColumns = model.mapped.columns.filter(
      (column: any) => !column.isHidden
    );
    const hsnColumns = visibleColumns.filter((column: any) =>
      ["hsn", "sac", "hsncode", "hsnsac"].includes(
        String(column.key)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
      )
    );
    const itemIndex = visibleColumns.findIndex((column: any) =>
      ["item", "name", "description"].includes(String(column.key).toLowerCase())
    );

    expect(hsnColumns).toHaveLength(1);
    expect(visibleColumns[itemIndex + 1]).toBe(hsnColumns[0]);
    expect(model.mapped.visibility.showHsn).toBe(true);
    expect(model.mapped.visibility.showInlineHsn).toBe(false);
    expect(model.mapped.visibility.visibleColumnCount).toBe(
      visibleColumns.length
    );

    const html = template(model);
    expect(html).toContain("HSN/SAC");
    expect(html).toContain("121213");
    expect(html).not.toContain('class="item-code item-code-hsn"');
  });

  it("renders HSN/SAC as an exact code without numeric separators", () => {
    const input = payload();
    input.invoice.items[0].hsn = "0852580";
    const hsnColumn: any = input.invoice.columns.find((column: any) =>
      ["hsn", "sac", "hsncode", "hsnsac"].includes(
        String(column.key)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
      )
    );
    expect(hsnColumn).toBeDefined();
    Object.assign(hsnColumn, { dataType: "number", semanticType: "number" });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).toContain(">0852580</td>");
    expect(html).not.toContain("8,52,580");
    expect(html).not.toContain("852,580");
  });

  it("keeps HSN/SAC placement separate while honoring explicit hide settings", () => {
    const mergedInput = payload();
    (mergedInput.invoice.advanceOptions as any).hsnView = "MERGE";
    const mergedModel = mapSrTradingTemplateData(mergedInput as any);

    expect(mergedModel.mapped.visibility.showHsn).toBe(true);
    expect(mergedModel.mapped.visibility.showInlineHsn).toBe(false);
    expect(template(mergedModel)).toContain('class="col-hsn-sac align-left"');
    expect(template(mergedModel)).not.toContain(
      'class="item-code item-code-hsn"'
    );

    const hiddenInput = payload();
    (hiddenInput.invoice as any).invoiceValueProps = {
      hsn: { visible: false },
    };
    const hiddenModel = mapSrTradingTemplateData(hiddenInput as any);

    expect(hiddenModel.mapped.visibility.showHsn).toBe(false);
    expect(hiddenModel.mapped.visibility.showInlineHsn).toBe(false);

    const hiddenViewInput = payload();
    (hiddenViewInput.invoice.advanceOptions as any).hsnView = "HIDE";
    const hiddenViewModel = mapSrTradingTemplateData(hiddenViewInput as any);

    expect(hiddenViewModel.mapped.visibility.showHsn).toBe(false);
    expect(hiddenViewModel.mapped.visibility.showInlineHsn).toBe(false);

    const hiddenSacInput = payload();
    (hiddenSacInput.invoice as any).invoiceValueProps = {
      sac: { hideInInvoice: true },
    };
    const hiddenSacModel = mapSrTradingTemplateData(hiddenSacInput as any);

    expect(hiddenSacModel.mapped.visibility.showHsn).toBe(false);
    expect(hiddenSacModel.mapped.visibility.showInlineHsn).toBe(false);
  });

  it("maps and renders API-driven tax and HSN summary tables", () => {
    const input = payload();
    Object.assign(input.invoice.advanceOptions as any, {
      taxSummaryView: "BOTH",
      showHsnSummary: true,
    });
    (input.invoice as any).taxSummary = [
      { tax: 18, taxableValue: 100, cgst: 9, sgst: 9, igst: 0 },
    ];
    (input.invoice as any).hsnSummary = [
      {
        hsn: "121213",
        tax: 18,
        taxableValue: 100,
        cgst: 9,
        sgst: 9,
        igst: 0,
      },
    ];

    const model = mapSrTradingTemplateData(input as any);
    expect(model.mapped.visibility.showTaxSummary).toBe(true);
    expect(model.mapped.visibility.showHsnSummary).toBe(true);
    expect(model.mapped.visibility.showSummaryTables).toBe(true);
    expect(model.mapped.taxSummary.taxList[0]).toMatchObject({
      gstRate: 18,
      cgstAmount: 9,
      sgstAmount: 9,
      taxAmount: 18,
    });
    expect(model.mapped.hsnSummary.hsnList[0]).toMatchObject({
      hsn: "121213",
      taxableValue: 100,
      taxAmount: 18,
    });

    const html = template(model);
    expect(html).toContain("data-ceres-tax-summary");
    expect(html).toContain("data-ceres-hsn-summary");
    expect(html).toContain("Tax Summary");
    expect(html).toContain("HSN/SAC Summary");
    expect(html).toContain("121213");
    expect(html.indexOf('class="lower-grid"')).toBeLessThan(
      html.indexOf("Tax Summary")
    );
    expect(html.indexOf('class="amount-in-words"')).toBeLessThan(
      html.indexOf('class="lower-grid"')
    );
    expect(html.match(/class="summary-words-row"/g)).toHaveLength(2);
    expect(html.match(/Eighteen Rupees Only/g)).toHaveLength(2);
  });

  it("preserves authoritative supplied HSN rates and rounded totals", () => {
    const input = payload();
    Object.assign(input.invoice, {
      igst: true,
      hsnSummary: {
        hsnList: [
          {
            hsn: "84733020",
            taxableValue: 3965,
            igstRate: 10.32,
            igstAmount: 409.19,
            taxAmount: 409.18,
          },
        ],
        totalTaxableValue: 3965,
        totalIgstAmount: 409.19,
        totalTaxAmount: 409.18,
      },
      advanceOptions: {
        ...input.invoice.advanceOptions,
        showHSNSummaryInInvoice: true,
      },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.mapped.hsnSummary.hsnList[0]).toMatchObject({
      hsn: "84733020",
      taxableValue: 3965,
      igstRate: 10.32,
      igstAmount: 409.19,
      taxAmount: 409.18,
    });
    expect(model.mapped.hsnSummary.totalIgstAmount).toBe(409.19);
    expect(model.mapped.hsnSummary.totalTaxAmount).toBe(409.18);
  });

  it("keeps disabled summary tables mounted but hidden", () => {
    const input = payload();
    Object.assign(input.invoice.advanceOptions as any, {
      taxSummaryView: "SUMMARY",
      showHsnSummary: false,
    });
    (input.invoice as any).taxSummary = [
      { tax: 18, taxableValue: 100, cgst: 9, sgst: 9 },
    ];

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showTaxSummary).toBe(false);
    expect(model.mapped.visibility.showHsnSummary).toBe(false);
    expect(model.mapped.visibility.showSummaryTables).toBe(false);
    expect(html).toContain('data-ceres-tax-summary style="display:none"');
    expect(html).toContain('data-ceres-hsn-summary style="display:none"');
  });

  it("renders a full-width description exactly once with the visible-column colspan", () => {
    const input = payload();
    (input.invoice.advanceOptions as any).isDescriptionFullWidth = true;
    input.invoice.columns.push({
      key: "total",
      label: "Hidden Total",
      isHidden: true,
    } as any);

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.isDescriptionFullWidth).toBe(true);
    expect(html.match(/Steel Body/g)).toHaveLength(1);
    expect(html).toContain('class="item-description-row"');
    expect(html).toContain(
      `colspan="${model.mapped.visibility.visibleColumnCount}"`
    );
    expect(html).toContain("data-ceres-description-inline");
    expect(html).toContain("data-ceres-description-full-width");
    expect(html).toContain("data-ceres-description-content");
  });

  it("accepts the system full-width-description alias", () => {
    const input = payload();
    (input.invoice.advanceOptions as any).showDescriptionInFullWidth = true;

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.isDescriptionFullWidth).toBe(true);
    expect(html.match(/Steel Body/g)).toHaveLength(1);
    expect(html).toContain('class="item-description-row"');
  });

  it("renders the configured item summary row from visible item data", () => {
    const input = payload();
    Object.assign(input.invoice, {
      showTotalsRow: true,
      items: [
        { name: "Press", quantity: 2, rate: 100, amount: 200 },
        { name: "Lathe", quantity: 3, rate: 50, amount: 150 },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showTotalsRow).toBe(true);
    expect(html).toContain('class="items-total-row"');
    expect(html).toMatch(/items-total-row[\s\S]*money:350/);
  });

  it("renders many long line items without dropping or duplicating descriptions", () => {
    const input = payload();
    input.invoice.items = Array.from({ length: 75 }, (_, index) => ({
      name: `Machine ${index + 1} with a deliberately long printable item name`,
      description: `Description ${index + 1} ${"long printable detail ".repeat(
        12
      )}`,
      hsn: `84${String(index).padStart(4, "0")}`,
      quantity: index + 1,
      unit: "pcs",
      rate: 1000 + index,
      amount: (1000 + index) * (index + 1),
    }));
    (input.invoice.advanceOptions as any).showDescriptionInFullWidth = true;

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html.match(/class="item-row"/g)).toHaveLength(75);
    expect(html.match(/class="item-description-row"/g)).toHaveLength(75);
    expect(html.match(/Description \d+/g)).toHaveLength(75);
  });

  it("keeps reverse-charge metadata hidden in this template", () => {
    const yesInput = payload();
    Object.assign(yesInput.invoice, { reverseCharge: true });
    const yesHtml = template(mapSrTradingTemplateData(yesInput as any));
    expect(yesHtml).not.toContain("Reverse Charge");

    const noInput = payload();
    Object.assign(noInput.invoice, { isReverseCharge: false });
    const noHtml = template(mapSrTradingTemplateData(noInput as any));
    expect(noHtml).not.toContain("Reverse Charge");

    const missingHtml = template(mapSrTradingTemplateData(payload() as any));
    expect(missingHtml).not.toContain("Reverse Charge");
  });

  it("omits the empty lower section instead of adding printable blank space", () => {
    const input = payload();
    Object.assign(input.invoice, {
      showTerms: false,
      showNotes: false,
      terms: [],
      notes: "",
      bankAccount: {},
      paymentOptions: { accountTransfer: false, upi: false },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showLowerSection).toBe(false);
    expect(html).not.toContain('class="lower-grid"');
  });

  it("reserves stable table tracks when tax columns are added by the API", () => {
    const input = payload();
    Object.assign(input.invoice, {
      billType: "INVOICE",
      invoiceType: "INVOICE",
      igst: true,
      taxType: "GLOBAL",
      columns: [
        { key: "item", label: "Item" },
        { key: "gstRate", label: "GST Rate", semanticType: "percentage" },
        { key: "quantity", label: "Quantity" },
        { key: "rate", label: "Rate", semanticType: "currency" },
        { key: "amount", label: "Amount", semanticType: "currency" },
        { key: "igst", label: "IGST Total", semanticType: "currency" },
        { key: "total", label: "Total", semanticType: "currency" },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.visibleColumnCount).toBe(9);
    expect(model.display.tableMinWidth).toBeGreaterThanOrEqual(936);
    expect(html).toContain(
      `style="--sr-items-table-min-width: ${model.display.tableMinWidth}px"`
    );
    expect(html).toContain('class="col-gst-rate align-left"');
    expect(html).toContain('class="col-igst align-left"');
  });

  it("hides the catalogue block without a logo even when document QR exists", () => {
    const input = payload();
    delete (input.invoice as any).billedBy.logo;
    Object.assign(input.invoice, {
      owner: { logo: "data:image/png;base64,owner-logo-must-not-fallback" },
      ownerBusiness: {
        logo: "data:image/png;base64,business-logo-must-not-fallback",
      },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.document.catalogueLogo).toBe("");
    expect(html).toMatch(
      /class="catalogue-block is-empty" data-ceres-field-container="logo"/
    );
    expect(html).toMatch(
      /<img alt="Product catalogue QR logo" data-ceres-field="logo" \/>/
    );
    expect(html).not.toContain("document-qr-is-not-the-logo");
    expect(html).not.toContain("owner-logo-must-not-fallback");
    expect(html).not.toContain("business-logo-must-not-fallback");
  });

  it("resolves payload artwork without hardcoding business images", () => {
    const input = payload();
    Object.assign(input.invoice, {
      letterHead: { url: "https://cdn.example.com/sr-header.png" },
      letterHeadFooter: "footer-base64",
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.assets.letterHead).toBe(
      "https://cdn.example.com/sr-header.png"
    );
    expect(model.display.assets.letterHeadFooter).toBe(
      "data:image/png;base64,footer-base64"
    );
    expect(html).toContain('src="https://cdn.example.com/sr-header.png"');
    expect(html).toContain('src="data:image/png;base64,footer-base64"');
  });

  it("renders the payload logo only in the catalogue section", () => {
    const input = payload();
    Object.assign(input.invoice, {
      billedBy: { logo: { src: "https://cdn.example.com/business-logo.png" } },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.display.assets.letterHead).toBe("");
    expect(model.display.document.catalogueLogo).toBe(
      "https://cdn.example.com/business-logo.png"
    );
  });

  it("does not borrow letterhead or footer artwork from owner/business fallbacks", () => {
    const input = payload();
    Object.assign(input.invoice, {
      letterHead: null,
      letterHeadFooter: null,
      footerImage: null,
      headerImage: null,
      billedBy: { logo: "" },
      owner: {
        letterHead: "https://cdn.example.com/owner-header.png",
        letterHeadFooter: "https://cdn.example.com/owner-footer.png",
      },
      ownerBusiness: {
        letterHead: "https://cdn.example.com/business-header.png",
        letterHeadFooter: "https://cdn.example.com/business-footer.png",
      },
      business: {
        letterHead: "https://cdn.example.com/fallback-header.png",
        letterHeadFooter: "https://cdn.example.com/fallback-footer.png",
      },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.display.assets.letterHead).toBe("");
    expect(model.display.assets.letterHeadFooter).toBe("");

    const html = template(model);
    expect(html).toContain('class="no-dibella invoice-letterhead is-empty"');
    expect(html).toContain(
      'class="no-dibella invoice-letterhead-footer is-empty"'
    );
    expect(html).not.toContain("owner-header.png");
    expect(html).not.toContain("owner-footer.png");
    expect(html).not.toContain("business-header.png");
    expect(html).not.toContain("business-footer.png");
  });

  it("uses an explicitly supplied invoice letterhead", () => {
    const input = payload();
    Object.assign(input.invoice, {
      letterHead: "https://cdn.example.com/invoice-header.png",
      owner: { letterHead: "https://cdn.example.com/owner-header.png" },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.display.assets.letterHead).toBe(
      "https://cdn.example.com/invoice-header.png"
    );
  });

  it("groups repeated bank labels into adjacent value columns", () => {
    const model = mapSrTradingTemplateData(payload() as any);
    const branch = model.display.bankRows.find((row) => row.label === "Branch");

    expect(model.mapped.visibility.showBankUpiSection).toBe(true);
    expect(model.display.bankColumnCount).toBe(2);
    expect(branch?.values).toEqual(["Faridabad", "New Delhi"]);

    const html = template(model);
    expect(html).toContain('<table class="bank-table">');
    expect(html).toContain('<th scope="row">Account Number</th>');
    expect(html).toMatch(/Branch[\s\S]*Faridabad[\s\S]*New Delhi/);
  });

  it("merges same-name standard and custom bank fields into one row", () => {
    const input = payload();
    Object.assign(input.invoice.bankAccount, {
      customFields: [
        {
          label: "Account Number",
          value: "203038547765",
          dataType: "string",
        },
        { label: "IFSC Code", value: "IDBI00N604", dataType: "string" },
        { label: "Bank", value: "Indian Bank", dataType: "string" },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const accountRows = model.display.bankRows.filter(
      (row) => row.label === "Account Number"
    );
    const ifscRows = model.display.bankRows.filter(
      (row) => row.label === "IFSC"
    );
    const bankRows = model.display.bankRows.filter(
      (row) => row.label === "Bank"
    );

    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].values).toEqual(["661305602062", "203038547765"]);
    expect(ifscRows).toHaveLength(1);
    expect(ifscRows[0].values).toEqual(["ICIC0006613", "IDBI00N604"]);
    expect(bankRows).toHaveLength(1);
    expect(bankRows[0].values).toEqual(["ICICI Bank", "Indian Bank"]);
    expect(model.display.bankColumnCount).toBe(2);
  });

  it("accepts object-shaped repeated custom bank fields", () => {
    const input = payload();
    (input.invoice.bankAccount as any).customFields = {
      firstBranch: { label: "Branch", value: "Faridabad" },
      secondBranch: { label: "Branch", value: "New Delhi" },
    };

    const model = mapSrTradingTemplateData(input as any);
    const branch = model.display.bankRows.find((row) => row.label === "Branch");

    expect(branch?.values).toEqual(["Faridabad", "New Delhi"]);
  });

  it("shows requested custom-only bank details without requiring an account number", () => {
    const input = payload();
    (input.invoice as any).bankAccount = {
      customFields: [{ label: "Payment Reference", value: "SR-NEFT-01" }],
    };

    const model = mapSrTradingTemplateData(input as any);

    expect(model.mapped.visibility.showBankAccount).toBe(true);
    expect(model.display.bankRows).toEqual([
      { label: "Payment Reference", values: ["SR-NEFT-01"], nowrap: false },
    ]);
  });

  it("honors explicit bank visibility over payment-option defaults", () => {
    const input = payload();
    Object.assign(input.invoice, {
      showBankAccount: false,
      paymentOptions: { accountTransfer: true, upi: false },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.mapped.visibility.showBankAccount).toBe(false);
    expect(model.mapped.visibility.showBankUpiSection).toBe(false);
  });

  it("aligns the same standard bank field across multiple accounts", () => {
    const input = payload();
    (input.invoice as any).bankAccounts = [
      input.invoice.bankAccount,
      {
        name: "S.R. Trading Company",
        accountNo: "203038547765",
        ifsc: "IDBI00N604",
        accountType: "Current account",
        bank: "Indian Bank",
        customFields: [],
      },
    ];

    const model = mapSrTradingTemplateData(input as any);
    const accountNumbers = model.display.bankRows.find(
      (row) => row.label === "Account Number"
    );

    expect(accountNumbers?.values).toEqual(["661305602062", "203038547765"]);
    expect(accountNumbers?.nowrap).toBe(true);
  });

  it("preserves every repeated custom-bank value across multiple accounts", () => {
    const input = payload();
    (input.invoice as any).bankAccounts = [
      {
        ...input.invoice.bankAccount,
        customFields: [
          { label: "Branch", value: "Faridabad", dataType: "string" },
          { label: "Branch", value: "Gurugram", dataType: "string" },
        ],
      },
      {
        ...input.invoice.bankAccount,
        accountNo: "203038547765",
        customFields: [
          { label: "Branch", value: "New Delhi", dataType: "string" },
        ],
      },
    ];

    const model = mapSrTradingTemplateData(input as any);
    const branch = model.display.bankRows.find((row) => row.label === "Branch");

    expect(branch?.values).toEqual(["Faridabad", "Gurugram", "New Delhi"]);
  });

  it("hides bank and UPI details for canceled documents", () => {
    const input = payload();
    input.invoice.status = "CANCELED";
    Object.assign(input.invoice, {
      upi: { upi: "srtrading@upi", qr: "base64qr" },
      paymentOptions: { accountTransfer: true, upi: true },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showBankAccount).toBe(false);
    expect(model.mapped.visibility.showUpi).toBe(false);
    expect(model.mapped.visibility.showBankUpiSection).toBe(false);
    expect(html).not.toContain("Bank and UPI details");
    expect(html).not.toContain("Scan To Pay");
  });

  it("keeps bank and UPI hidden for credit notes and rejected expenditures", () => {
    const creditNote = payload();
    Object.assign(creditNote.invoice, {
      billType: "CREDITNOTE",
      upi: { upi: "srtrading@upi", qr: "base64qr" },
      paymentOptions: { accountTransfer: true, upi: true },
    });
    const creditModel = mapSrTradingTemplateData(creditNote as any);

    expect(creditModel.mapped.visibility.showBankUpiSection).toBe(false);
    expect(creditModel.mapped.visibility.showUpi).toBe(false);

    const expenditure = payload();
    Object.assign(expenditure.invoice, {
      isExpenditure: true,
      invoiceAccepted: "REJECTED",
    });
    const expenditureModel = mapSrTradingTemplateData(expenditure as any);

    expect(expenditureModel.mapped.visibility.showBankAccount).toBe(false);
    expect(expenditureModel.mapped.visibility.showBankUpiSection).toBe(false);
  });

  it("honors party and custom-field visibility settings", () => {
    const input = payload();
    Object.assign(input.invoice.billedTo, {
      email: "hidden@example.com",
      emailShowInInvoice: false,
      additionalIds: [
        { label: "Visible ID", value: "VISIBLE", showInInvoice: true },
        { label: "Hidden ID", value: "HIDDEN", showInInvoice: false },
        { label: "Also hidden", value: "HIDE-ME", hideInInvoice: true },
      ],
      customFields: [
        {
          label: "Hidden custom",
          value: "SECRET",
          params: { showInInvoice: false },
        },
      ],
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).not.toContain("hidden@example.com");
    expect(html).toContain("VISIBLE");
    expect(html).not.toContain("HIDDEN");
    expect(html).not.toContain("HIDE-ME");
    expect(html).not.toContain("SECRET");
  });

  it("prints invoice-party GSTIN and PAN while respecting explicit visibility", () => {
    const input = payload();
    Object.assign(input.invoice.billedTo, {
      gstin: "27AAAAA0000A1Z5",
      panNumber: "PANNOTGST1Z",
      additionalIds: [
        {
          label: "Selected Tax ID",
          value: "VISIBLE-ID",
          showInInvoice: true,
        },
      ],
    });

    const populatedOnlyHtml = template(mapSrTradingTemplateData(input as any));
    expect(populatedOnlyHtml).toContain("27AAAAA0000A1Z5");
    expect(populatedOnlyHtml).toContain("PANNOTGST1Z");
    expect(populatedOnlyHtml).toContain("VISIBLE-ID");

    Object.assign(input.invoice.billedTo, {
      showGstInInvoice: false,
      panShowInInvoice: false,
    });
    const explicitlyHiddenHtml = template(
      mapSrTradingTemplateData(input as any)
    );
    expect(explicitlyHiddenHtml).not.toContain("27AAAAA0000A1Z5");
    expect(explicitlyHiddenHtml).not.toContain("PANNOTGST1Z");

    Object.assign(input.invoice.billedTo, {
      showGstInInvoice: true,
      panShowInInvoice: true,
    });
    const explicitlyVisibleHtml = template(
      mapSrTradingTemplateData(input as any)
    );
    expect(explicitlyVisibleHtml).toContain("27AAAAA0000A1Z5");
    expect(explicitlyVisibleHtml).toContain("PANNOTGST1Z");

    Object.assign(input.invoice.billedTo, {
      showGstInInvoice: undefined,
      panShowInInvoice: undefined,
      fieldVisibility: {
        gstin: { showInInvoice: true },
        pan: { showInInvoice: false },
      },
    });
    const configuredHtml = template(mapSrTradingTemplateData(input as any));
    expect(configuredHtml).toContain("27AAAAA0000A1Z5");
    expect(configuredHtml).not.toContain("PANNOTGST1Z");

    delete (input.invoice.billedTo as any).gstin;
    delete (input.invoice.billedTo as any).panNumber;
    Object.assign(input as any, {
      business: {
        gstin: "BUSINESS-FALLBACK-GSTIN",
        panNumber: "BUSINESS-FALLBACK-PAN",
      },
    });
    const businessOnlyHtml = template(mapSrTradingTemplateData(input as any));
    expect(businessOnlyHtml).not.toContain("BUSINESS-FALLBACK-GSTIN");
    expect(businessOnlyHtml).not.toContain("BUSINESS-FALLBACK-PAN");
  });

  it("formats supply names and renders the complete balance breakdown", () => {
    const input = payload();
    Object.assign(input.invoice, {
      status: "PARTIAL",
      countryOfSupply: "IN",
      placeOfSupply: "06",
      balance: {
        tds: 100,
        paid: 1000,
        settledAmount: 500,
        transactionCharge: 25,
        credit: 40,
        refund: 10,
        due: 116475,
      },
      showDueAmount: true,
      customLabels: {
        ...((input.invoice as any).customLabels as Record<string, unknown>),
        paidAmount: "Paid So Far",
        tdsAmount: "Tax Withheld",
        creditAmount: "Applied Credit",
        refundAmount: "Refund Issued",
      },
    });
    Object.assign(input.invoice.billedTo, {
      state: "Haryana",
      stateCode: "06",
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.invoice.placeOfSupply).toBe("Haryana");
    expect(html).toContain("India");
    expect(html).toContain("Haryana");
    expect(html).toContain("Tax Withheld");
    expect(html).toContain("Paid So Far");
    expect(html).toContain("Amount Received");
    expect(html).toContain("Transaction Charge");
    expect(html).toContain("Applied Credit");
    expect(html).toContain("Refund Issued");
    expect(html).toContain("Due Amount");
    expect(model.display.paymentBalanceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Paid So Far", amount: 1000 }),
        expect.objectContaining({ label: "Tax Withheld", amount: 100 }),
      ])
    );
  });

  it("maps partial-payment aliases and honors their configured visibility", () => {
    const input = payload();
    Object.assign(input.invoice, {
      balance: { partialPaidAmount: 201 },
      customLabels: { paidAmount: "Paid Amount" },
    });

    const visibleModel = mapSrTradingTemplateData(input as any);
    const visibleHtml = template(visibleModel);
    expect(visibleModel.display.paymentBalanceRows).toContainEqual(
      expect.objectContaining({
        label: "Paid Amount",
        amount: 201,
        deduction: true,
      })
    );
    expect(visibleHtml).toContain("Paid Amount");
    expect(visibleHtml).toContain("money:-201");

    Object.assign(input, {
      invoiceValueProps: { paidAmount: { showInInvoice: false } },
    });
    const hiddenModel = mapSrTradingTemplateData(input as any);
    const hiddenHtml = template(hiddenModel);
    expect(hiddenModel.display.paymentBalanceRows).toEqual([]);
    expect(hiddenHtml).not.toContain("Paid Amount");
  });

  it("maps the complete Due Amount visibility contract without hardcoding", () => {
    const input = payload();
    Object.assign(input.invoice, {
      balance: { due: 660 },
      customLabels: {
        ...((input.invoice as any).customLabels as Record<string, unknown>),
        dueAmount: "Balance payable",
      },
    });

    const unconfiguredModel = mapSrTradingTemplateData(input as any);
    const unconfiguredHtml = template(unconfiguredModel);

    expect(unconfiguredModel.totals.dueAmount).toBe(660);
    expect(unconfiguredModel.mapped.visibility.showDueAmount).toBe(false);
    expect(unconfiguredHtml).not.toContain("Balance payable");

    Object.assign(input.invoice, { status: "PARTIAL" });
    const partialModel = mapSrTradingTemplateData(input as any);
    const partialHtml = template(partialModel);
    expect(partialModel.mapped.visibility.showDueAmount).toBe(true);
    expect(partialHtml).toContain("Balance payable");
    expect(partialHtml).toContain("money:660");

    Object.assign(input.invoice, { status: "PAID" });
    const paidHtml = template(mapSrTradingTemplateData(input as any));
    expect(paidHtml).not.toContain("Balance payable");

    Object.assign(input, { showDueAmount: true });
    Object.assign(input.invoice, { status: "PAYMENT_PENDING" });
    const visibleModel = mapSrTradingTemplateData(input as any);
    const visibleHtml = template(visibleModel);
    expect(visibleModel.mapped.visibility.showDueAmount).toBe(true);
    expect(visibleHtml).toContain("Balance payable");
    expect(visibleHtml).toContain("money:660");

    Object.assign(input, {
      invoiceValueProps: { dueAmount: { showInInvoice: false } },
    });
    Object.assign(input.invoice, { status: "PARTIAL" });
    const explicitlyHiddenHtml = template(
      mapSrTradingTemplateData(input as any)
    );
    expect(explicitlyHiddenHtml).not.toContain("Balance payable");
    expect(explicitlyHiddenHtml).not.toContain("money:660");

    Object.assign(input, {
      invoiceValueProps: { dueAmount: { showInInvoice: true } },
    });
    Object.assign(input.invoice, { balance: {}, toPay: { full: 660 } });
    const toPayHtml = template(mapSrTradingTemplateData(input as any));
    expect(toPayHtml).toContain("Balance payable");
    expect(toPayHtml).toContain("money:660");

    Object.assign(input.invoice, { balance: { due: 0 }, toPay: undefined });
    const settledHtml = template(mapSrTradingTemplateData(input as any));
    expect(settledHtml).not.toContain("Balance payable");

    Object.assign(input, {
      showDueAmount: undefined,
      invoiceValueProps: {},
    });
    Object.assign(input.invoice, {
      balance: { due: 660 },
      advanceOptions: { hideDueAmount: true },
    });
    const hiddenByAliasHtml = template(mapSrTradingTemplateData(input as any));
    expect(hiddenByAliasHtml).not.toContain("Balance payable");

    Object.assign(input.invoice, {
      showBalanceDue: "yes",
      advanceOptions: {},
    });
    const shownByAliasHtml = template(mapSrTradingTemplateData(input as any));
    expect(shownByAliasHtml).toContain("Balance payable");
    expect(shownByAliasHtml).toContain("money:660");
  });

  it("hides Due Amount on a newly issued invoice until it is overdue or part-paid", () => {
    const input = payload();
    Object.assign(input, { showDueAmount: true });
    Object.assign(input.invoice, {
      status: "UNPAID",
      isOverdue: false,
      balance: { due: 660 },
    });

    const issuedModel = mapSrTradingTemplateData(input as any);
    expect(issuedModel.mapped.visibility.showDueAmount).toBe(false);

    Object.assign(input.invoice, { isOverdue: true });
    const overdueModel = mapSrTradingTemplateData(input as any);
    expect(overdueModel.mapped.visibility.showDueAmount).toBe(true);

    Object.assign(input.invoice, {
      status: "PARTIALLY_PAID",
      isOverdue: false,
    });
    const partPaidModel = mapSrTradingTemplateData(input as any);
    expect(partPaidModel.mapped.visibility.showDueAmount).toBe(true);

    Object.assign(input.invoice, { status: "ISSUED" });
    const explicitlyIssuedModel = mapSrTradingTemplateData(input as any);
    expect(explicitlyIssuedModel.mapped.visibility.showDueAmount).toBe(false);
  });

  it("uses the primary Due Amount label when the API appends Arabic text", () => {
    const input = payload();
    Object.assign(input.invoice, {
      status: "PARTIAL",
      balance: { due: 14 },
      customLabels: {
        ...((input.invoice as any).customLabels as Record<string, unknown>),
        dueAmount: "Due Amount / المبلغ المستحق",
      },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.labels.dueAmount).toBe("Due Amount");
    expect(html).toContain("Due Amount");
    expect(html).not.toContain("المبلغ المستحق");

    Object.assign((input.invoice as any).customLabels, {
      dueAmount: "Due / Balance",
    });
    expect(
      mapSrTradingTemplateData(input as any).display.labels.dueAmount
    ).toBe("Due / Balance");
  });

  it("keeps country and place of supply hidden in this template", () => {
    const input = payload();
    Object.assign(input.invoice, {
      status: "PARTIAL",
      countryOfSupply: "IN",
      placeOfSupply: "06",
      advanceOptions: {
        showCountryOfSupply: true,
        showPlaceOfSupply: true,
      },
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).not.toContain("Country of Supply");
    expect(html).not.toContain("Place of Supply");
    expect(html).not.toContain("data-ceres-country-of-supply");
    expect(html).not.toContain("data-ceres-place-of-supply");
  });

  it("preserves editable total labels and column value semantics", () => {
    const input = payload();
    Object.assign(input.invoice, {
      invoiceType: "INVOICE",
      igst: true,
      taxType: "GLOBAL",
      items: [
        {
          ...input.invoice.items[0],
          gstRate: "18%",
          igst: 18000,
          approved: true,
        },
      ],
      columns: [
        { key: "item", label: "Item" },
        { key: "rate", label: "Rate", dataType: "number" },
        { key: "amount", label: "Taxable Value" },
        {
          key: "gstRate",
          label: "Tax Rate",
          dataType: "number",
          semanticType: "percentage",
        },
        { key: "igst", label: "PPN" },
        { key: "approved", label: "Approved", dataType: "boolean" },
      ],
      finalTotal: { igst: 18000, total: 118000 },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.labels.subTotal).toBe("Taxable Value");
    expect(model.display.labels.igst).toContain("PPN");
    expect(html).toContain("money:100000");
    expect(html).toContain("18%");
    expect(html).toContain("Yes");
  });

  it("preserves API-configured table column labels and currency precision", () => {
    const input = payload();
    Object.assign(input.invoice, {
      billType: "INVOICE",
      invoiceType: "INVOICE",
      currency: "USD",
      locale: "en-US",
      subUnitLength: 4,
      customLabels: {
        ...((input.invoice as any).customLabels as Record<string, unknown>),
        total: "Total",
      },
      columns: [
        { key: "name", label: "Product", dataType: "text" },
        { key: "quantity", label: "Nos", dataType: "number" },
        { key: "rate", label: "Unit Price", dataType: "currency" },
        { key: "amount", label: "Line Amount", dataType: "number" },
        { key: "total", label: "Invoice Value", dataType: "number" },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const rateColumn = model.mapped.columns.find(
      (column) => column.key === "rate"
    );

    expect(rateColumn?.label).toBe("Unit Price");
    expect(formatSrTradingCurrency(1000, model.invoice)).toBe("$1,000.00");
    expect(formatSrTradingCurrency(1180, model.invoice)).toBe("$1,180.00");

    const html = template(model);
    expect(html).toContain(">Product</th>");
    expect(html).toContain(">Nos</th>");
    expect(html).toContain(">Unit Price</th>");
    expect(html).toContain(">Line Amount</th>");
    expect(html).toContain(">Invoice Value</th>");
  });

  it("honors totals and notes visibility options", () => {
    const input = payload();
    Object.assign(input.invoice, {
      notes: "Private note",
      hideNotes: true,
      advanceOptions: {
        ...input.invoice.advanceOptions,
        hideTotals: true,
      },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showTotals).toBe(false);
    expect(model.mapped.visibility.showNotes).toBe(false);
    expect(html).not.toContain('class="totals-section"');
    expect(html).not.toContain("Private note");
  });

  it("honors root-level tax, total, and currency-code form toggles", () => {
    const input = payload();
    Object.assign(input.invoice, {
      hideTaxes: true,
      hideTotals: true,
      hideCurrencyCode: true,
      cesses: [{ cessName: "Hidden tax cess", amount: 12, isApplied: true }],
      advanceOptions: { ...input.invoice.advanceOptions },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);
    const visibleKeys = model.mapped.columns
      .filter((column: any) => !column.isHidden)
      .map((column: any) => String(column.key).toLowerCase());

    expect(model.mapped.visibility.showTaxes).toBe(false);
    expect(model.mapped.visibility.showTotals).toBe(false);
    expect(model.mapped.visibility.hideCurrencyCode).toBe(true);
    expect(model.mapped.visibility.showSummaryTables).toBe(false);
    expect(visibleKeys).not.toEqual(
      expect.arrayContaining(["gstrate", "igst", "cgst", "sgst", "utgst"])
    );
    expect(html).not.toContain('class="totals-section"');
    expect(html).not.toContain("Hidden tax cess");
  });

  it("does not invent zeroes or truthy booleans for missing item values", () => {
    const input = payload();
    Object.assign(input.invoice, {
      items: [{ name: "Sparse row", approved: "false" }],
      columns: [
        { key: "name", label: "Item", dataType: "text" },
        { key: "amount", label: "Amount", dataType: "currency" },
        { key: "gstRate", label: "GST Rate", dataType: "number" },
        { key: "approved", label: "Approved", dataType: "boolean" },
      ],
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).toContain("Sparse row");
    expect(html).toContain("No");
    expect(html).not.toContain("money:0");
    expect(html).not.toMatch(/<td[^>]*>\s*0%\s*<\/td>/);
  });

  it("renders configured cess rows including zero values", () => {
    const input = payload();
    Object.assign(input.invoice, {
      cesses: [
        {
          _id: "cess-1",
          cessName: "Environment Cess",
          amount: 0,
          isApplied: true,
        },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.cessRows).toEqual([
      {
        label: "Environment Cess",
        amount: 0,
        hasAmount: true,
      },
    ]);
    expect(html).toContain("Environment Cess");
    expect(html).toContain("money:0");
  });

  it("formats monetary values with the shared printable currency formatter", () => {
    const model = mapSrTradingTemplateData(payload() as any);
    expect(formatSolvinCurrency(model.totals.subTotal, model.invoice)).toBe(
      "₹1,00,000.00"
    );
  });

  it("preserves custom and PDF-safe currency formatting", () => {
    const model = mapSrTradingTemplateData(payload() as any);
    const sarInput = payload();
    sarInput.invoice.currency = "SAR";
    const sarModel = mapSrTradingTemplateData(sarInput as any);

    expect(
      formatSolvinCurrency(-1250, {
        ...model.invoice,
        currency: "RC",
        customCurrencySymbol: "RCoins",
      })
    ).toBe("(RCoins 1,250.00)");
    expect(formatSolvinCurrency(1250, sarModel.invoice)).toBe("⃁ 1,250.00");
  });

  it("shows a multi-account-only payload and keeps account columns aligned", () => {
    const input = payload();
    const firstAccount = input.invoice.bankAccount;
    delete (input.invoice as any).bankAccount;
    (input.invoice as any).bankAccounts = [
      firstAccount,
      {
        name: "S.R. Trading Company",
        accountNo: "203038547765",
        ifsc: "IDBI00N604",
        bank: "Indian Bank",
      },
    ];

    const model = mapSrTradingTemplateData(input as any);
    const accountNumbers = model.display.bankRows.find(
      (row) => row.label === "Account Number"
    );

    expect(model.mapped.visibility.showBankAccount).toBe(true);
    expect(accountNumbers?.values).toEqual(["661305602062", "203038547765"]);
  });

  it("renders full bank-country names and preserves user-provided text casing", () => {
    const input = payload();
    Object.assign(input.invoice, {
      currency: "inr",
      customLabels: { bankDetails: "bank and upi details" },
    });
    Object.assign(input.invoice.bankAccount, {
      accountType: "current account",
      bank: "icici bank",
      country: "IN",
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);
    const countryRow = model.display.bankRows.find(
      (row) => row.label === "Country"
    );

    expect(countryRow?.isCountry).toBe(true);
    expect(countryRow?.values[0]).toBe("IN");
    expect(model.display.currency).toBe("inr");
    expect(html).toContain(">India</td>");
    expect(html).toContain("bank and upi details");
    expect(html).toContain("current account");
    expect(html).toContain("icici bank");
    expect(html).toContain("Total<span data-ceres-currency-code> (inr)</span>");
  });

  it("prefers bank-account labels and renders a positive UPI state", () => {
    const input = payload();
    Object.assign(input.invoice.bankAccount, {
      customLabels: { accountNumber: "A/C Ref" },
    });
    Object.assign(input.invoice, {
      customLabels: { accountNumber: "Invoice Account" },
      upi: { upi: "srtrading@upi", qr: "base64qr" },
      paymentOptions: { accountTransfer: true, upi: true },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.bankRows[1].label).toBe("A/C Ref");
    expect(model.mapped.visibility.showUpi).toBe(true);
    expect(model.display.upiId).toBe("srtrading@upi");
    expect(model.display.upiQr).toBe("data:image/png;base64,base64qr");
    expect(html).toContain("Scan To Pay");
    expect(html).not.toContain("UPI ID:");
    expect(html).not.toContain("srtrading@upi");
    expect(html).toContain("data:image/png;base64,base64qr");
    expect(html).not.toContain('class="upi-id"');
    expect(html).toContain('data-ceres-field-container="qrCode"');
    expect(html).toContain('data-ceres-field="qrCode"');
  });

  it("generates an offline QR when the API initially supplies only a UPI ID", () => {
    const input = payload();
    Object.assign(input.invoice, {
      upi: {
        upi: "ROCKDECOR.STONE@OKHDFCBANK",
        vpa: "ROCKDECOR.STONE@OKHDFCBANK",
        isRemoved: false,
        isHardRemoved: false,
      },
      paymentOptions: { accountTransfer: true, upi: true },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showUpi).toBe(true);
    expect(model.display.upiId).toBe("ROCKDECOR.STONE@OKHDFCBANK");
    expect(model.display.upiQr).toMatch(/^data:image\/svg\+xml,/);
    expect(html).not.toContain("UPI ID:");
    expect(html).not.toContain("ROCKDECOR.STONE@OKHDFCBANK");
    expect(html).toContain('class="upi-qr-container"');
    expect(html).toContain('data-ceres-field="qrCode"');
    expect(html).not.toContain('class="upi-qr-container is-empty"');
  });

  it("accepts invoice-level UPI QR image aliases without inventing data", () => {
    const input = payload();
    Object.assign(input.invoice, {
      upi: { upi: "srtrading@upi" },
      upiQrCode: { url: "https://cdn.example.com/upi-qr.png" },
      paymentOptions: { accountTransfer: true, upi: true },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.upiQr).toBe("https://cdn.example.com/upi-qr.png");
    expect(html).toContain('src="https://cdn.example.com/upi-qr.png"');
    expect(html).not.toContain('class="upi-qr-container is-empty"');
  });

  it("renders the supplied signature with editable labels and honors hide settings", () => {
    const input = payload();
    Object.assign(input.invoice, {
      signature: { url: "https://cdn.example.com/signature.png" },
      customLabels: {
        signature: "Approved By",
        for: "On Behalf Of",
      },
    });
    Object.assign(input.invoice.billedBy, {
      name: "S.R. Trading Company",
    });

    let model = mapSrTradingTemplateData(input as any);
    let html = template(model);

    expect(model.mapped.visibility.showSignature).toBe(true);
    expect(model.display.signature).toBe(
      "https://cdn.example.com/signature.png"
    );
    expect(html).toContain('class="signature-section"');
    expect(html).toContain("On Behalf Of S.R. Trading Company");
    expect(html).toContain("Approved By");
    expect(html).toContain('src="https://cdn.example.com/signature.png"');

    (input.invoice as any).hideSignature = true;
    model = mapSrTradingTemplateData(input as any);
    html = template(model);

    expect(model.mapped.visibility.showSignature).toBe(false);
    expect(html).not.toContain('class="signature-section"');
  });

  it("maps editable terms, compliance, tax, and signature labels from payload properties", () => {
    const input = payload();
    Object.assign(input.invoice, {
      signature: { url: "https://cdn.example.com/signature.png" },
      termsLabel: "Commercial Conditions",
      customLabels: {
        irn: "Invoice Reference Number",
        igst: "Integrated Tax",
        cgst: "Central Tax",
        sgst: "State Tax",
        utgst: "Union Territory Tax",
        signature: "Approved By",
        for: "For and on behalf of",
      },
    });

    let model = mapSrTradingTemplateData(input as any);
    let html = template(model);

    expect(model.display.labels.terms).toBe("Commercial Conditions");
    expect(model.display.document.labels.terms).toBe("Commercial Conditions");
    expect(model.display.document.labels).toMatchObject({
      irn: "Invoice Reference Number",
      igst: "Integrated Tax",
      cgst: "Central Tax",
      sgst: "State Tax",
      utgst: "Union Territory Tax",
    });
    expect(html).toContain("Commercial Conditions");
    expect(html).toContain("Central Tax");
    expect(html).toContain("State Tax");
    expect(html).toContain("For and on behalf of");
    expect(html).toContain("Approved By");
    expect(html).not.toMatch(/<strong>IRN:<\/strong>/);

    (input.invoice as any).showSignatureInInvoice = false;
    model = mapSrTradingTemplateData(input as any);
    html = template(model);
    expect(model.mapped.visibility.showSignature).toBe(false);
    expect(html).not.toContain('class="signature-section"');
  });

  it("derives subtotal from a summarised custom-field currency column", () => {
    const input = payload();
    Object.assign(input.invoice, {
      subTotal: 1,
      items: [
        {
          name: "Power Press",
          customFields: [{ key: "customTaxable", value: 75000 }],
        },
        {
          name: "Lathe",
          customFields: [{ label: "Custom Taxable", value: 25000 }],
        },
      ],
      columns: [
        { key: "item", label: "Item" },
        {
          key: "customTaxable",
          label: "Custom Taxable",
          semanticType: "currency",
          summarise: true,
        },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.totals.subTotal).toBe(100000);
    expect(model.display.labels.subTotal).toBe("Custom Taxable");
  });

  it("accepts common string visibility forms for party fields", () => {
    const input = payload();
    Object.assign(input.invoice.billedTo, {
      phone: "+91 99999 99999",
      phoneShowInInvoice: "off",
      additionalIds: [
        { label: "Yes ID", value: "VISIBLE-YES", showInInvoice: "yes" },
        { label: "No ID", value: "HIDDEN-NO", showInInvoice: "no" },
      ],
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).not.toContain("99999");
    expect(html).toContain("VISIBLE-YES");
    expect(html).not.toContain("HIDDEN-NO");
  });

  it("maps supported true visibility flags without force-enabling unrelated fields", () => {
    const input = payload();
    Object.assign(input.invoice, {
      status: "PARTIAL",
      countryOfSupply: "IN",
      placeOfSupply: "06",
      showBankAccount: true,
      showUpi: true,
      showTotalsRow: true,
      showTotalInWords: true,
      showTerms: true,
      showNotes: true,
      showDueAmount: true,
      notes: "Visible note",
      balance: { due: 118000 },
      upi: { vpa: "srtrading@upi" },
      paymentOptions: { accountTransfer: false, upi: false },
      template: {
        upiShrink: true,
        pdfOptions: {
          letterHeadOnFirstPage: true,
          footerOnLastPage: true,
        },
      },
      advanceOptions: {
        unitColumn: "MERGE_QUANTITY",
        showCountryOfSupply: true,
        showPlaceOfSupply: true,
        showSerialNumbersInDescription: true,
        showSkuInInvoice: true,
        hideTaxes: false,
        hideTotals: false,
        hideCurrencyCode: true,
      },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.mapped.visibility).toEqual(
      expect.objectContaining({
        showBankAccount: true,
        showUpi: true,
        showBankUpiSection: true,
        showCountryOfSupply: true,
        showPlaceOfSupply: true,
        showSerialNumbersInDescription: true,
        showSkuInName: true,
        showUnitInQuantity: true,
        showTotals: true,
        showTotalsRow: true,
        showTotalInWords: true,
        showTerms: true,
        showNotes: true,
        showDueAmount: true,
        showTaxes: true,
        hideCurrencyCode: true,
        upiShrink: true,
        letterHeadOnFirstPage: true,
        footerOnLastPage: true,
      })
    );
  });

  it("preserves explicit false visibility flags instead of enabling everything", () => {
    const input = payload();
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "06",
      showBankAccount: false,
      showUpi: false,
      showTotalsRow: false,
      showTotalInWords: false,
      showTerms: false,
      showNotes: false,
      showDueAmount: false,
      notes: "Hidden note",
      balance: { due: 118000 },
      upi: { vpa: "srtrading@upi" },
      paymentOptions: { accountTransfer: true, upi: true },
      template: {
        upiShrink: false,
        pdfOptions: {
          letterHeadOnFirstPage: false,
          footerOnLastPage: false,
        },
      },
      advanceOptions: {
        unitColumn: "HIDE",
        showCountryOfSupply: false,
        showPlaceOfSupply: false,
        showSerialNumbersInDescription: false,
        showSkuInInvoice: false,
        hideTaxes: true,
        hideTotals: true,
        hideCurrencyCode: false,
      },
    });

    const model = mapSrTradingTemplateData(input as any);

    expect(model.mapped.visibility).toEqual(
      expect.objectContaining({
        showBankAccount: false,
        showUpi: false,
        showBankUpiSection: false,
        showCountryOfSupply: false,
        showPlaceOfSupply: false,
        showSerialNumbersInDescription: false,
        showSkuInName: false,
        showUnitInName: false,
        showUnitInQuantity: false,
        showUnitAsColumn: false,
        showTotals: false,
        showTotalsRow: false,
        showTotalInWords: false,
        showTerms: false,
        showNotes: false,
        showDueAmount: false,
        showTaxes: false,
        hideCurrencyCode: false,
        upiShrink: false,
        letterHeadOnFirstPage: false,
        footerOnLastPage: false,
      })
    );
  });

  it("derives document metadata from the actual document type and custom labels", () => {
    const input = payload();
    delete (input.invoice as any).quotationNumber;
    Object.assign(input.invoice, {
      billType: "INVOICE",
      invoiceType: "INVOICE",
      invoiceTitle: "Tax Invoice",
      customLabels: {
        invoiceNumber: "Bill Reference",
        invoiceDate: "Issued On",
        dueDate: "Pay By",
        billedTo: "Customer",
      },
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.document.title).toBe("Tax Invoice");
    expect(model.display.document.number).toBe("A00002");
    expect(model.display.document.labels.number).toBe("Bill Reference");
    expect(model.display.document.labels.date).toBe("Issued On");
    expect(model.display.document.labels.validTill).toBe("Pay By");
    expect(html).toContain("Customer");
    expect(html).not.toContain("Quotation No");
  });

  it("uses payload catalogue copy without hardcoding business content", () => {
    const input = payload();
    Object.assign(input.invoice, {
      documentQrTitle: "Open the current catalogue",
      documentQrDescription: "Products and specifications from the payload.",
      customLabels: {
        catalogueTitle: "Payload catalogue heading",
        catalogueDescription: "Payload catalogue description",
      },
    });
    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.display.document.labels.catalogueTitle).toBe(
      "Open the current catalogue"
    );
    expect(model.display.document.labels.catalogueDescription).toBe(
      "Products and specifications from the payload."
    );
    expect(html).toContain("Open the current catalogue");
    expect(html).toContain("Products and specifications from the payload.");
  });

  it("keeps payload letterhead artwork in preview and lets Dibella own PDF placement", () => {
    const input = payload();
    Object.assign(input.invoice, {
      letterHead: "https://cdn.example.com/sr-header.png",
      letterHeadFooter: "https://cdn.example.com/sr-footer.png",
    });

    const html = template(mapSrTradingTemplateData(input as any));

    expect(html).toContain('class="no-dibella invoice-letterhead"');
    expect(html).toContain('class="no-dibella invoice-letterhead-footer"');

    const css = readFileSync(
      join(process.cwd(), "src/templates/sr-trading-2-0/styles.css"),
      "utf8"
    );
    expect(css).toContain("body.isDibella");
    expect(css).toContain(
      ".no-dibella:is(.invoice-letterhead, .invoice-letterhead-footer)"
    );
  });

  it("restores and renders source-driven additional details and total rows", () => {
    const input = payload();
    Object.assign(input.invoice, {
      customFooters: [
        { label: "Dispatch From", value: "Faridabad", showInInvoice: true },
        { label: "Internal", value: "SECRET", showInInvoice: false },
      ],
      additionalInformation: {
        carrierReference: {
          label: "Carrier Reference",
          value: "CR-9021",
        },
      },
      additionalCharges: [
        { label: "Freight", finalAmount: 250, showInInvoice: true },
      ],
      extraTotalFields: [
        {
          label: "Rounded Adjustment",
          value: 5,
          dataType: "currency",
        },
        { label: "Payment Mode", value: "Bank transfer" },
      ],
    });

    const model = mapSrTradingTemplateData(input as any);
    const html = template(model);

    expect(model.invoice.customFooters).toHaveLength(2);
    expect(model.display.additionalInformationRows).toEqual([
      { label: "Dispatch From", value: "Faridabad" },
      { label: "Carrier Reference", value: "CR-9021" },
    ]);
    expect(html).toContain("Dispatch From");
    expect(html).toContain("Carrier Reference");
    expect(html).not.toContain("SECRET");
    expect(html).toMatch(/Freight[\s\S]*money:250/);
    expect(html).toMatch(/Rounded Adjustment[\s\S]*money:5/);
    expect(html).toMatch(/Payment Mode[\s\S]*Bank transfer/);
  });

  it("renders the main total-in-words as an inline label with a bold value", () => {
    const input = payload();
    Object.assign(input.invoice, {
      customLabels: {
        totalInWords: "Payable in words",
        totalInWordsValue: "exact SOURCE casing",
      },
    });

    let model = mapSrTradingTemplateData(input as any);
    let html = template(model);

    expect(html).toContain("Payable in words");
    expect(html).toContain("Exact Source Casing");
    expect(html).toMatch(
      /class="amount-in-words"[\s\S]*?<span>Payable in words:<\/span>[\s\S]*?<strong>Exact Source Casing<\/strong>/
    );

    (input.invoice as any).hideTotalInWords = true;
    model = mapSrTradingTemplateData(input as any);
    html = template(model);

    expect(model.mapped.visibility.showTotalInWords).toBe(false);
    expect(html).not.toContain('class="amount-in-words"');
  });
});
