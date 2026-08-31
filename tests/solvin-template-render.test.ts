import HandlebarsRuntime from "handlebars/runtime";
import template from "../src/templates/solvin/template.hbs";
import { normalizeInvoiceTemplateState } from "../src/main/invoiceTemplateNormalization";
import { mapSolvinTemplateData } from "../src/templates/solvin/mapper";
import {
  formatCountryName,
  formatQuantityWithUnit,
  formatSolvinCurrency,
  getItemSku,
  getPartyAddressLines,
  getItemSerialNumbers,
  getItemUnit,
  shouldShowItemSku,
} from "../src/templates/solvin/formatting";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" ? value : {};

const keyOf = (column: any): string =>
  String(asRecord(column).key ?? "").toLowerCase();

const hasKey = (column: any, keys: string[]): boolean =>
  keys.includes(keyOf(column));

const itemValue = (itemInput: any, columnValue: any): any => {
  const item = asRecord(itemInput);
  const key = String(asRecord(columnValue).key ?? "");
  return item[key] ?? "";
};

beforeAll(() => {
  HandlebarsRuntime.registerPartial(
    "InvoiceStatus",
    () => '<span class="invoice-status-marker">Overdue</span>'
  );
  HandlebarsRuntime.registerPartial(
    "MarkdownViewer",
    (value: unknown) =>
      `<span class="markdown-output">${String(value ?? "")}</span>`
  );
  HandlebarsRuntime.registerPartial(
    "HsnSummaryTable",
    () => '<div class="hsn-summary-marker">HSN Summary</div>'
  );
  HandlebarsRuntime.registerPartial("CeresImage", () => "");
  HandlebarsRuntime.registerPartial("RefrensBranding", () => "");

  HandlebarsRuntime.registerHelper(
    "formateShortDateWithOffset",
    (value: unknown) => String(value ?? "")
  );
  HandlebarsRuntime.registerHelper("formatPhoneNumber", (value: unknown) =>
    String(value ?? "")
  );
  HandlebarsRuntime.registerHelper(
    "prepareMarkdownViewerData",
    (value: unknown) => String(value ?? "")
  );
  HandlebarsRuntime.registerHelper(
    "addOne",
    (value: unknown) => Number(value) + 1
  );
  HandlebarsRuntime.registerHelper("columnAlignmentClass", () => "align-left");
  HandlebarsRuntime.registerHelper("isRowNumberColumn", (column: unknown) =>
    hasKey(column, ["sr", "srno", "sno", "rownumber", "index"])
  );
  HandlebarsRuntime.registerHelper("isDescriptionColumn", (column: unknown) =>
    hasKey(column, ["item", "name", "description"])
  );
  HandlebarsRuntime.registerHelper("isQuantityColumn", (column: unknown) =>
    hasKey(column, ["quantity", "qty"])
  );
  HandlebarsRuntime.registerHelper("isUnitColumn", (column: unknown) =>
    hasKey(column, ["unit", "uom", "unitname"])
  );
  HandlebarsRuntime.registerHelper("isHsnColumn", (column: unknown) =>
    hasKey(column, ["hsn", "sac", "hsncode", "hsnsac"])
  );
  HandlebarsRuntime.registerHelper("isCurrencyColumn", (column: unknown) =>
    hasKey(column, [
      "rate",
      "unitrate",
      "unitprice",
      "price",
      "amount",
      "subtotal",
      "total",
      "cgst",
      "sgst",
      "utgst",
      "igst",
    ])
  );
  HandlebarsRuntime.registerHelper("isRateColumn", (column: unknown) =>
    hasKey(column, ["gstrate", "tax", "taxrate", "cessrate"])
  );
  HandlebarsRuntime.registerHelper("isBooleanColumn", () => false);
  HandlebarsRuntime.registerHelper("isNumericColumn", () => false);
  HandlebarsRuntime.registerHelper("isAmountColumn", (column: unknown) =>
    hasKey(column, ["amount", "subtotal"])
  );
  HandlebarsRuntime.registerHelper("isTotalColumn", (column: unknown) =>
    hasKey(column, ["total"])
  );
  HandlebarsRuntime.registerHelper("itemColumnValue", itemValue);
  HandlebarsRuntime.registerHelper("itemCurrencyValue", itemValue);
  HandlebarsRuntime.registerHelper("itemSku", getItemSku);
  HandlebarsRuntime.registerHelper("itemHsn", () => "");
  HandlebarsRuntime.registerHelper("itemSerialNumbers", getItemSerialNumbers);
  HandlebarsRuntime.registerHelper("itemUnit", getItemUnit);
  HandlebarsRuntime.registerHelper(
    "showItemSku",
    (item: unknown, enabled: unknown) => shouldShowItemSku(item, enabled)
  );
  HandlebarsRuntime.registerHelper(
    "quantityWithUnit",
    (item: unknown, invoice: unknown, showUnit: unknown) =>
      formatQuantityWithUnit(item, showUnit, invoice)
  );
  HandlebarsRuntime.registerHelper("formatSolvinHsn", (value: unknown) =>
    String(value ?? "")
  );
  HandlebarsRuntime.registerHelper("formatBoolean", (value: unknown) =>
    value ? "Yes" : "No"
  );
  HandlebarsRuntime.registerHelper(
    "formatItemNumber",
    (value: unknown, column: unknown) =>
      String(
        typeof value === "number"
          ? value
          : Number(itemValue(value, column)) || 0
      )
  );
  HandlebarsRuntime.registerHelper(
    "formatSolvinCurrency",
    (value: unknown) => `money:${String(value ?? "")}`
  );
  HandlebarsRuntime.registerHelper(
    "formatSolvinCurrencyMarkup",
    (value: unknown) => `money:${String(value ?? "")}`
  );
  HandlebarsRuntime.registerHelper("formatTotalQuantity", () => "1");
  HandlebarsRuntime.registerHelper(
    "columnSummaryValue",
    (items: unknown[], column: unknown) =>
      (Array.isArray(items) ? items : []).reduce<number>(
        (sum, item) => sum + (Number(itemValue(item, column)) || 0),
        0
      )
  );
  HandlebarsRuntime.registerHelper(
    "columnRateSummaryValue",
    (items: unknown[], column: unknown) =>
      [
        ...new Set(
          (Array.isArray(items) ? items : []).map((item) =>
            Number(itemValue(item, column))
          )
        ),
      ]
        .filter(Number.isFinite)
        .map((rate) => `${rate}%`)
        .join(", ")
  );
  HandlebarsRuntime.registerHelper("titleCaseWords", (value: unknown) =>
    String(value ?? "")
  );
  HandlebarsRuntime.registerHelper("amountInWords", () => "One Hundred");
  HandlebarsRuntime.registerHelper(
    "solvinTaxAmountInWords",
    () => "Two Hundred Sixteen Thousand Rupees Only"
  );
  HandlebarsRuntime.registerHelper("formatCountryName", formatCountryName);
  HandlebarsRuntime.registerHelper("partyAddressLines", getPartyAddressLines);
  HandlebarsRuntime.registerHelper("computeHsnSummary", () => ({}));
});

const payload = (isDescriptionFullWidth: boolean) => ({
  invoice: {
    _id: "invoice-1",
    billType: "INVOICE",
    invoiceType: "INVOICE",
    status: "UNPAID",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-08-27",
    currency: "INR",
    taxName: "VAT",
    taxType: "GLOBAL",
    igst: true,
    isDescriptionFullWidth,
    billedBy: {
      name: "Seller",
      city: "Mumbai",
      state: "Maharashtra",
      country: "IN",
      pincode: "395007",
    },
    billedTo: {
      name: "Buyer",
      city: "Austin",
      country: "US",
      pincode: "78701",
    },
    items: [
      {
        name: "Consulting",
        description: "Rendered once",
        quantity: 1,
        amount: 100,
        igst: 18,
        total: 118,
      },
    ],
    columns: [
      { key: "item", label: "Service" },
      { key: "quantity", label: "Qty" },
      { key: "amount", label: "Taxable Value" },
      { key: "igst", label: "PPN" },
      { key: "total", label: "Payable", isHidden: true },
    ],
    subTotal: 100,
    finalTotal: { igst: 18, total: 118 },
    advanceOptions: { isDescriptionFullWidth },
  },
});

describe("Solvin compiled template", () => {
  it("renders integer item and total amounts with invoice precision", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      subUnitLength: 2,
      subTotal: 135000,
      finalTotal: { igst: 24300, total: 159300 },
      items: [
        {
          ...input.invoice.items[0],
          amount: 135000,
          igst: 24300,
          total: 159300,
        },
      ],
    });

    const model = mapSolvinTemplateData(input as any);
    expect(formatSolvinCurrency(model.totals.subTotal, model.invoice)).toBe(
      "₹1,35,000.00"
    );
    expect(
      formatSolvinCurrency(model.invoice.finalTotal.total, model.invoice)
    ).toBe("₹1,59,300.00");
  });

  it("maps and renders invoice notes with the editable heading", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      currency: "RC",
      customCurrencySymbol: "RCoins",
      notes: `**Delivery & Taxes**\n• First condition.\n${"• A lengthy condition that must remain visible.\n".repeat(
        80
      )}`,
      terms: [],
      customLabels: { notes: "TERMS AND CONDITIONS" },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.display.currency).toBe("RC");
    expect(model.display.currencySymbol).toBe("RCoins");
    expect(model.display.note).toContain("Currency: RC (RCoins)");
    expect(model.mapped.visibility.showNotes).toBe(true);
    expect(html).toContain('class="notes-section"');
    expect(html).toContain("TERMS AND CONDITIONS");
    expect(html).toContain("A lengthy condition that must remain visible.");
    expect(html).not.toContain('class="terms-panel"');
  });

  it("honors the notes visibility controls", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      notes: "Private internal note",
      hideNotes: true,
      customLabels: { notes: "Notes" },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showNotes).toBe(false);
    expect(html).not.toContain("Private internal note");
  });

  it("continues to render grouped terms when supplied", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      terms: [{ label: "Payment", terms: ["Pay before dispatch."] }],
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showTerms).toBe(true);
    expect(html).toContain('class="terms-panel"');
    expect(html).toContain("Pay before dispatch.");
  });

  it("renders the payment balance rows below total in their accounting order", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      balance: {
        tds: 10,
        paid: 510,
        settledAmount: 500,
        transactionCharge: 10,
        due: 660,
      },
      showDueAmount: true,
    });

    const visibleHtml = template(mapSolvinTemplateData(input as any));
    expect(visibleHtml).toMatch(
      /TDS Amount Withheld[\s\S]*\(money:10\)[\s\S]*Amount Paid[\s\S]*\(money:510\)[\s\S]*Amount Received[\s\S]*money:500[\s\S]*Transaction Charge[\s\S]*money:10[\s\S]*Due Amount[\s\S]*money:660/
    );

    Object.assign(input.invoice, { showDueAmount: false });
    const hiddenHtml = template(mapSolvinTemplateData(input as any));
    expect(hiddenHtml).not.toContain("Due Amount");
    expect(hiddenHtml).toContain("Amount Received");
  });

  it("does not infer due-amount visibility from a payload value", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      balance: { due: 660 },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showDueAmount).toBe(false);
    expect(model.totals.dueAmount).toBe(660);
    expect(html).not.toContain("Due Amount");
    expect(html).not.toContain("money:660");
  });

  it("resolves due amount from toPay when the field is enabled", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      balance: {},
      toPay: { full: 660 },
      showDueAmount: true,
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.totals.dueAmount).toBe(660);
    expect(html).toContain("money:660");
  });

  it("honors an explicit invoiceValueProps setting for due amount", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      balance: { due: 660 },
    });
    Object.assign(input, {
      invoiceValueProps: { dueAmount: { showInInvoice: false } },
    });

    const hiddenHtml = template(mapSolvinTemplateData(input as any));
    expect(hiddenHtml).not.toContain("Due Amount");

    Object.assign(input, {
      invoiceValueProps: { dueAmount: { showInInvoice: true } },
    });
    const visibleHtml = template(mapSolvinTemplateData(input as any));
    expect(visibleHtml).toContain("Due Amount");
    expect(visibleHtml).toContain("money:660");
  });

  it("uses editable labels for the payment balance rows", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      balance: {
        tds: 10,
        paid: 510,
        settledAmount: 500,
        transactionCharge: 10,
        due: 660,
      },
      showDueAmount: true,
      customLabels: {
        tdsAmountWithheld: "Withholding Tax",
        amountPaid: "Paid So Far",
        amountReceived: "Cash Received",
        transactionCharge: "Processing Fee",
        dueAmount: "Still Due",
      },
    });

    const html = template(mapSolvinTemplateData(input as any));
    expect(html).toContain("Withholding Tax");
    expect(html).toContain("Paid So Far");
    expect(html).toContain("Cash Received");
    expect(html).toContain("Processing Fee");
    expect(html).toContain("Still Due");
  });

  it("renders a leading Item column with one-based serial numbers", () => {
    const model = mapSolvinTemplateData(payload(false) as any);
    const html = template(model);

    expect(model.mapped.columns[0]).toMatchObject({
      key: "index",
      label: "Item",
      className: "col-index",
      isHidden: false,
    });
    expect(model.mapped.visibility.visibleColumnCount).toBe(5);
    expect(html).toMatch(
      /<th class="col-index [^"]+">Item<\/th>[\s\S]*<th class="col-item [^"]+">Service<\/th>/
    );
    expect(html).toMatch(
      /<td class="col-index [^"]+">\s*1\s*<\/td>[\s\S]*<td class="col-item [^"]+">/
    );
  });

  it("applies the complete enabled Solvin display profile", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "29",
      hsnSummary: [{ hsn: "998311", taxableValue: 100, tax: 18, igst: 18 }],
      hideTotals: true,
      hideTotalInWords: true,
      showTotalsRow: false,
      advanceOptions: {
        isDescriptionFullWidth: false,
        showSkuInInvoice: false,
        showHSNSummaryInInvoice: false,
        hideCountryOfSupply: true,
        hidePlaceOfSupply: true,
        hideGroupSubTotal: true,
        showSerialNumbersInDescription: false,
      },
    });
    Object.assign(input.invoice.items[0], {
      hsn: "998311",
      sku: "SOL-001",
      serialNumbers: ["SN-001", { serialNo: "SN-002" }],
    });
    input.invoice.items.push({
      name: "Consulting subtotal",
      quantity: 1,
      amount: 100,
      total: 118,
      isGroupItemTotalRow: true,
    } as any);

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility).toMatchObject({
      showHsnSummary: true,
      showCountryOfSupply: false,
      showPlaceOfSupply: false,
      isDescriptionFullWidth: false,
      showSkuInName: false,
      showTotalsRow: true,
      showTotals: true,
      showTotalInWords: true,
      showSerialNumbersInDescription: true,
    });
    expect(html).toContain('class="solvin-hsn-table"');
    expect(html).toContain("data-ceres-hsn-summary");
    expect(html).toContain(
      'data-ceres-country-of-supply style="display: none;"'
    );
    expect(html).toContain('data-ceres-place-of-supply style="display: none;"');
    expect(html).not.toContain('class="item-description-row"');
    expect(html).not.toContain("SKU</b> : SOL-001");
    expect(html).toContain("Serial No.</b> : SN-001, SN-002");
    expect(html).toContain("Consulting subtotal");
    expect(html).toContain('class="items-total-row"');
    expect(html).toContain('class="totals-wrap"');
    expect(html).toContain('class="amount-words-row"');
  });

  it.each([true, "true", 1])(
    "renders the SKU when the invoice setting is enabled as %p",
    (showSkuInInvoice) => {
      const input = payload(false);
      Object.assign(input.invoice.items[0], { sku: " SKU-001 " });
      Object.assign(input.invoice, {
        advanceOptions: { showSkuInInvoice },
      });

      const model = mapSolvinTemplateData(input as any);
      const html = template(model);

      expect(model.mapped.visibility.showSkuInName).toBe(true);
      expect(html).toContain("SKU</b> : SKU-001");
    }
  );

  it.each([false, "false", 0])(
    "hides the SKU when the invoice setting is disabled as %p",
    (showSkuInInvoice) => {
      const input = payload(false);
      Object.assign(input.invoice.items[0], {
        sku: "SKU-001",
        showSku: true,
      });
      Object.assign(input.invoice, {
        advanceOptions: { showSkuInInvoice },
      });

      const model = mapSolvinTemplateData(input as any);
      const html = template(model);

      expect(model.mapped.visibility.showSkuInName).toBe(false);
      expect(html).not.toContain("SKU-001");
    }
  );

  it.each([false, "false", 0])(
    "honors the item-level SKU setting %p when the invoice setting is enabled",
    (showSku) => {
      const input = payload(false);
      Object.assign(input.invoice.items[0], { sku: "SKU-001", showSku });
      Object.assign(input.invoice, {
        advanceOptions: { showSkuInInvoice: true },
      });

      const html = template(mapSolvinTemplateData(input as any));
      expect(html).not.toContain("SKU-001");
    }
  );

  it("never renders an invoice payment-status badge", () => {
    const html = template(mapSolvinTemplateData(payload(false) as any));

    expect(html).not.toContain("invoice-status-marker");
    expect(html).not.toContain("Overdue");
  });

  it("renders the HSN summary as a stacked vertical tax table", () => {
    const input = payload(false);
    Object.assign(input.invoice.items[0], {
      hsn: "998311",
      gstRate: 18,
      amount: 100,
      igst: 18,
    });

    const html = template(mapSolvinTemplateData(input as any));

    expect(html).toMatch(/<th>HSN<\/th><td>998311<\/td>/);
    expect(html).toMatch(/<th>Taxable Value<\/th><td>money:100<\/td>/);
    expect(html).toMatch(/<th colspan="2">VAT<\/th>/);
    expect(html).toMatch(/<th>Rate<\/th><th>Amount<\/th>/);
    expect(html).toMatch(/<td>18%<\/td><td>money:18<\/td>/);
    expect(html).toContain("998311");
    expect(html).toContain('class="solvin-hsn-total-row"');
    expect(html).toContain("Total Tax In Words :");
    expect(html).toContain("Two Hundred Sixteen Thousand Rupees Only");
  });

  it("normalizes API string values and HSN aliases for the HSN summary", () => {
    const input = payload(false);
    Object.assign(input.invoice.items[0], {
      hsnCode: "540710",
      taxRate: "5",
      amount: "SAR 49.00",
      igst: "SAR 2.45",
    });

    const model = mapSolvinTemplateData(input as any);

    expect(model.mapped.hsnSummary.hsnList[0]).toMatchObject({
      hsn: "540710",
      taxableValue: 49,
      igstRate: 5,
      igstAmount: 2.45,
    });
  });

  it("uses the API-rounded HSN tax total without changing the line tax amount", () => {
    const input = payload(false);
    Object.assign(input.invoice.items[0], {
      hsnCode: "540710",
      taxRate: 5,
      amount: 49,
      igst: 2.45,
    });
    Object.assign(input.invoice, {
      hsnSummary: [
        {
          hsn: "540710",
          taxableValue: 49,
          igst: 2.45,
          tax: 2.46,
        },
      ],
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.hsnSummary.hsnList[0].igstAmount).toBe(2.45);
    expect(model.mapped.hsnSummary.totalTaxAmount).toBe(2.46);
    expect(html).toMatch(/<td>5%<\/td><td>money:2\.45<\/td>/);
    expect(html).toMatch(
      /class="solvin-hsn-total-row"><th>Total<\/th><td>money:2\.46<\/td>/
    );
  });

  it("renames an accidental Amount label on the total column", () => {
    const input = payload(false);
    input.invoice.columns[4] = {
      ...input.invoice.columns[4],
      label: "Amount",
      isHidden: false,
    } as any;

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);
    const totalColumn = model.mapped.columns.find(
      (column) => column.key === "total"
    );

    expect(totalColumn?.label).toBe("Total");
    expect(html).toMatch(/<th class="col-total [^"]+">Total<\/th>/);
  });

  it("follows the full-width description setting from advanced options", () => {
    const disabled = mapSolvinTemplateData(payload(false) as any);
    const enabled = mapSolvinTemplateData(payload(true) as any);

    expect(disabled.mapped.visibility.isDescriptionFullWidth).toBe(false);
    expect(template(disabled)).not.toContain('class="item-description-row"');
    expect(enabled.mapped.visibility.isDescriptionFullWidth).toBe(true);
    expect(template(enabled)).toContain('class="item-description-row"');
  });

  it.each([true, "true", 1, "yes", "on"])(
    "honors hide-country/place settings expressed as %p",
    (hidden) => {
      const input = payload(false);
      Object.assign(input.invoice, {
        countryOfSupply: "IN",
        placeOfSupply: "Karnataka",
        advanceOptions: {
          hideCountryOfSupply: hidden,
          hidePlaceOfSupply: hidden,
        },
      });

      const model = mapSolvinTemplateData(input as any);
      const html = template(model);

      expect(model.mapped.visibility.showCountryOfSupply).toBe(false);
      expect(model.mapped.visibility.showPlaceOfSupply).toBe(false);
      expect(html).toContain(
        'data-ceres-country-of-supply style="display: none;"'
      );
      expect(html).toContain(
        'data-ceres-place-of-supply style="display: none;"'
      );
    }
  );

  it.each([false, "false", 0, "no", "off"])(
    "keeps country/place hidden in Solvin even when hide settings are %p",
    (hidden) => {
      const input = payload(false);
      Object.assign(input.invoice, {
        countryOfSupply: "IN",
        placeOfSupply: "Karnataka",
        advanceOptions: {
          hideCountryOfSupply: hidden,
          hidePlaceOfSupply: hidden,
        },
      });

      const model = mapSolvinTemplateData(input as any);

      expect(model.mapped.visibility.showCountryOfSupply).toBe(false);
      expect(model.mapped.visibility.showPlaceOfSupply).toBe(false);
    }
  );

  it("hides country and place of supply by default in Solvin", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "Karnataka",
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.showCountryOfSupply).toBe(false);
    expect(model.mapped.visibility.showPlaceOfSupply).toBe(false);
    expect(html).toContain(
      'data-ceres-country-of-supply style="display: none;"'
    );
    expect(html).toContain('data-ceres-place-of-supply style="display: none;"');
  });

  it("honors explicit show-country/place settings and invoiceValueProps", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "Karnataka",
      advanceOptions: {
        showCountryOfSupply: false,
        showPlaceOfSupply: true,
      },
    });
    Object.assign(input, {
      invoiceValueProps: {
        placeOfSupply: { showInInvoice: false },
      },
    });

    const model = mapSolvinTemplateData(input as any);

    expect(model.mapped.visibility.showCountryOfSupply).toBe(false);
    expect(model.mapped.visibility.showPlaceOfSupply).toBe(false);
  });

  it.each([
    { value: true, fullWidth: true },
    { value: "true", fullWidth: true },
    { value: 1, fullWidth: true },
    { value: false, fullWidth: false },
    { value: "false", fullWidth: false },
    { value: 0, fullWidth: false },
  ])("honors showDescriptionInFullWidth=$value", ({ value, fullWidth }) => {
    const input = payload(false);
    Object.assign(input.invoice, {
      isDescriptionFullWidth: undefined,
      advanceOptions: { showDescriptionInFullWidth: value },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.mapped.visibility.isDescriptionFullWidth).toBe(fullWidth);
    expect(html.includes('class="item-description-row"')).toBe(fullWidth);
    expect(html.match(/Rendered once/g)).toHaveLength(1);
  });

  it.each([
    {
      mode: "SEPARATE",
      visibleUnitColumn: true,
      quantityText: "2",
      nameUnitText: false,
    },
    {
      mode: "MERGE_QUANTITY",
      visibleUnitColumn: false,
      quantityText: "2 Boxes",
      nameUnitText: false,
    },
    {
      mode: "MERGE_NAME",
      visibleUnitColumn: false,
      quantityText: "2",
      nameUnitText: true,
    },
    {
      mode: "Merge with name",
      visibleUnitColumn: false,
      quantityText: "2",
      nameUnitText: true,
    },
    {
      mode: "MERGE_WITH_QUANTITY",
      visibleUnitColumn: false,
      quantityText: "2 Boxes",
      nameUnitText: false,
    },
    {
      mode: "Separate column",
      visibleUnitColumn: true,
      quantityText: "2",
      nameUnitText: false,
    },
    {
      mode: "HIDE",
      visibleUnitColumn: false,
      quantityText: "2",
      nameUnitText: false,
    },
  ])(
    "renders units using the $mode mode",
    ({ mode, visibleUnitColumn, quantityText, nameUnitText }) => {
      const input = payload(false);
      input.invoice.columns.splice(2, 0, {
        key: "unit",
        label: "Unit",
      } as any);
      Object.assign(input.invoice.items[0], { quantity: 2, unit: "unit-box" });
      Object.assign(input.invoice, {
        advanceOptions: { unitColumn: mode },
        owner: {
          configuration: {
            units: [{ value: "unit-box", label: "Boxes" }],
          },
        },
      });

      const model = mapSolvinTemplateData(input as any);
      const html = template(model);
      const unitColumn = model.mapped.columns.find(
        (column) => column.key === "unit"
      );

      expect(unitColumn?.isHidden).toBe(!visibleUnitColumn);
      expect(html).toMatch(
        new RegExp(`<td class="col-qty [^"]+">\\s*${quantityText}\\s*</td>`)
      );
      expect(html.includes("Unit : Boxes")).toBe(nameUnitText);
      if (visibleUnitColumn) {
        expect(html).toMatch(/<td class="col-unit [^"]+">\s*Boxes\s*<\/td>/);
      }
    }
  );

  it("honors the explicit show-unit boolean", () => {
    const input = payload(false);
    input.invoice.columns.splice(2, 0, {
      key: "unit",
      label: "Unit",
    } as any);
    Object.assign(input.invoice.items[0], { quantity: 2, unit: "unit-box" });
    Object.assign(input.invoice, {
      advanceOptions: { unitColumn: "SEPARATE", showUnit: false },
      owner: {
        configuration: {
          units: [{ value: "unit-box", label: "Boxes" }],
        },
      },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);
    const unitColumn = model.mapped.columns.find(
      (column) => column.key === "unit"
    );

    expect(model.mapped.visibility.showUnitInName).toBe(false);
    expect(model.mapped.visibility.showUnitInQuantity).toBe(false);
    expect(model.mapped.visibility.showUnitAsColumn).toBe(false);
    expect(unitColumn?.isHidden).toBe(true);
    expect(html).not.toContain("Boxes");
  });

  it("creates a Unit column in separate mode when the API omits it", () => {
    const input = payload(false);
    Object.assign(input.invoice.items[0], { quantity: 2, unit: "unit-box" });
    Object.assign(input.invoice, {
      advanceOptions: { unitColumn: "Separate column" },
      owner: {
        configuration: {
          units: [{ value: "unit-box", label: "Boxes" }],
        },
      },
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);
    const unitColumn = model.mapped.columns.find(
      (column) => column.key === "unit"
    );

    expect(unitColumn).toMatchObject({ label: "Unit", isHidden: false });
    expect(html).toMatch(/<th class="col-unit [^"]+">Unit<\/th>/);
    expect(html).toMatch(/<td class="col-unit [^"]+">\s*Boxes\s*<\/td>/);
  });

  it("renders a full-width description exactly once across visible columns", () => {
    const model = normalizeInvoiceTemplateState(payload(true) as any);
    const html = template(model);

    expect(model.mapped.visibility.visibleColumnCount).toBe(4);
    expect(html.match(/class="item-description-row"/g)).toHaveLength(1);
    expect(html).toContain('<td colspan="4">');
    expect(html.match(/Rendered once/g)).toHaveLength(1);
  });

  it("keeps the description inline without creating an extra row", () => {
    const html = template(normalizeInvoiceTemplateState(payload(false) as any));

    expect(html).not.toContain('class="item-description-row"');
    expect(html.match(/Rendered once/g)).toHaveLength(1);
  });

  it("calculates subtotal from rendered item values and mirrors editable labels", () => {
    const input = payload(false);
    input.invoice.subTotal = 0;
    const html = template(mapSolvinTemplateData(input as any));

    expect(html).toContain('<div class="totals-label">Taxable Value</div>');
    expect(html).toContain('<div class="totals-label">PPN</div>');
    expect(html).toContain("money:100");
    expect(html).toContain("money:118");
  });

  it("shows the full tax percentage beside the IGST/global tax label", () => {
    const input = payload(false);
    Object.assign(input.invoice.items[0], { tax: 18 });

    const html = template(mapSolvinTemplateData(input as any));

    expect(html).toContain('<div class="totals-label">PPN (18%)</div>');
  });

  it("shows half of each GST rate beside split CGST and SGST labels", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      taxName: "GST",
      taxType: "INDIA",
      igst: false,
      items: [
        { ...input.invoice.items[0], gstRate: 18, cgst: 9, sgst: 9 },
        { ...input.invoice.items[0], gstRate: 5, cgst: 2.5, sgst: 2.5 },
      ],
      columns: [
        { key: "item", label: "Service" },
        { key: "amount", label: "Taxable Value" },
        { key: "cgst", label: "CGST" },
        { key: "sgst", label: "SGST" },
      ],
      finalTotal: { cgst: 11.5, sgst: 11.5, total: 223 },
    });

    const html = template(mapSolvinTemplateData(input as any));

    expect(html).toContain('<div class="totals-label">CGST (2.5%, 9%)</div>');
    expect(html).toContain('<div class="totals-label">SGST (2.5%, 9%)</div>');
  });

  it("formats the item rate as currency", () => {
    const input = payload(false);
    input.invoice.columns.splice(2, 0, {
      key: "rate",
      label: "Rate",
      dataType: "number",
    } as any);
    Object.assign(input.invoice.items[0], { rate: 100 });

    const html = template(mapSolvinTemplateData(input as any));
    expect(html).toMatch(/<td class="col-rate [^"]+">\s*money:100\s*<\/td>/);
  });

  it("keeps the percent sign on summarised tax-rate columns", () => {
    const input = payload(false);
    input.invoice.columns[3] = {
      ...input.invoice.columns[3],
      key: "gstRate",
      label: "GST Rate",
      summarise: false,
    } as any;
    Object.assign(input.invoice.items[0], { gstRate: 18 });

    const html = template(mapSolvinTemplateData(input as any));
    expect(html).toMatch(
      /class="items-total-row"[\s\S]*<td class="col-gst-rate [^"]+">\s*18%\s*<\/td>/
    );
  });

  it("includes an amount column backed by item custom fields", () => {
    const input = payload(false);
    input.invoice.subTotal = 0;
    input.invoice.columns[2] = {
      key: "billableValue",
      label: "Billable Value",
      dataType: "number",
      semanticType: "currency",
      summarise: true,
    } as any;
    Object.assign(input.invoice.items[0], {
      amount: 999,
      customFields: [
        {
          key: "billableValue",
          label: "Billable Value",
          value: "125.50",
          dataType: "number",
          params: { showInInvoice: true },
        },
      ],
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.totals.subTotal).toBe(125.5);
    expect(html).toContain('<div class="totals-label">Billable Value</div>');
    expect(html).toContain("money:125.5");
  });

  it("uses only valid numeric item amounts for the subtotal", () => {
    const input = payload(false);
    input.invoice.subTotal = 999;
    input.invoice.items = [
      { ...input.invoice.items[0], amount: "SAR 100" as any },
      { ...input.invoice.items[0], amount: "not-an-amount" as any },
      { ...input.invoice.items[0], amount: "(SAR 25.50)" as any },
    ];

    expect(mapSolvinTemplateData(input as any).totals.subTotal).toBe(74.5);
  });

  it("falls back to the invoice subtotal when item amounts are invalid", () => {
    const input = payload(false);
    input.invoice.subTotal = 100;
    input.invoice.items[0].amount = "not-an-amount" as any;

    expect(mapSolvinTemplateData(input as any).totals.subTotal).toBe(100);
  });

  it("maps configured subtotal fields in document order without custom footers", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      items: [
        {
          ...input.invoice.items[0],
          amount: 600001,
          igst: 60000.1,
          total: 672001.1,
        },
      ],
      finalTotal: {
        subTotal: 600001,
        igst: 60000.1,
        cessTotal: { cessAmount: 12000 },
        total: 604399.99,
      },
      totals: {
        subTotal: 600001,
        igst: 60000.1,
        cessTotal: { cessAmount: 12000 },
        total: 604399.99,
      },
      cesses: [
        {
          cessName: "Cess 1",
          cessAmountKey: "cessAmount",
          isApplied: true,
        },
      ],
      extraTotalFields: [{ label: "Packing Charges", value: "None" }],
      additionalCharges: [
        {
          label: "Promo Discount (10%)",
          amount: 10,
          amountType: "PERCENTAGE",
          multiplier: -1,
        },
        {
          label: "Instant Discount",
          amount: 500,
          amountType: "FIXED_AMOUNT",
          multiplier: -1,
        },
        {
          label: "Secure Packing Charges",
          amount: 99,
          amountType: "FIXED_AMOUNT",
          multiplier: 1,
        },
      ],
      customFooters: [
        { label: "Brand", value: "MSI, LG" },
        { label: "Warranty", value: "3 Years" },
      ],
      footers: [{ label: "Material", value: "Plastic" }],
      customFields: [{ label: "Colour", value: "Black" }],
      additionalInformation: [
        { label: "Additional Reference", value: "REF-123" },
      ],
    });

    const model = mapSolvinTemplateData(input as any);
    const html = template(model);

    expect(model.display.cessRows).toEqual([
      { label: "Cess 1", amount: 12000 },
    ]);
    expect(model.display.additionalChargeRows).toEqual([
      { label: "Promo Discount (10%)", amount: -67200.11 },
      { label: "Instant Discount", amount: -500 },
      { label: "Secure Packing Charges", amount: 99 },
    ]);
    expect(html).toContain("Packing Charges");
    expect(html).toContain("None");
    expect(html).toContain("money:-67200.11");
    expect(html).toContain("money:-500");
    expect(html).toContain("money:99");
    expect(html).not.toContain("Brand");
    expect(html).not.toContain("MSI, LG");
    expect(html).not.toContain("Warranty");
    expect(html).not.toContain("3 Years");
    expect(html).not.toContain("Material");
    expect(html).not.toContain("Plastic");
    expect(html).not.toContain("Colour");
    expect(html).not.toContain("Black");
    expect(html).not.toContain("Additional Reference");
    expect(html).not.toContain("REF-123");
    expect(model.invoice).not.toHaveProperty("customFooters");
    expect(model.invoice).not.toHaveProperty("footers");
    expect(model.invoice).not.toHaveProperty("customFields");
    expect(model.invoice).not.toHaveProperty("additionalInformation");

    expect(html.indexOf("Cess 1")).toBeLessThan(
      html.indexOf("Promo Discount (10%)")
    );
    expect(html.indexOf("Promo Discount (10%)")).toBeLessThan(
      html.indexOf("Instant Discount")
    );
    expect(html.indexOf("Instant Discount")).toBeLessThan(
      html.indexOf("Secure Packing Charges")
    );
    expect(html.indexOf("Secure Packing Charges")).toBeLessThan(
      html.indexOf(">Packing Charges</div>")
    );
  });

  it("does not render a standalone discount row in the totals section", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      discount: "10",
      customLabels: { discount: "Promotional Discount" },
    });

    const html = template(mapSolvinTemplateData(input as any));
    expect(html).not.toContain("Promotional Discount");
    expect(html).not.toContain("Discount");
  });

  it("renders country values from the shared normalized invoice", () => {
    const html = template(normalizeInvoiceTemplateState(payload(false) as any));

    expect(html).toContain("Mumbai, Maharashtra, India 395007");
    expect(html).toContain("Austin, United States 78701");
  });

  it("renders city, state, country and pincode on a single line", () => {
    const html = template(normalizeInvoiceTemplateState(payload(false) as any));

    expect(html).toContain("<p>Mumbai, Maharashtra, India 395007</p>");
    expect(html).toContain("<p>Austin, United States 78701</p>");
  });

  it("renders billed-to stateName aliases in the address", () => {
    const input = payload(false);
    Object.assign(input.invoice.billedTo, {
      city: "Pune",
      stateName: "Maharashtra",
      country: "IN",
      pincode: "411001",
    });

    const html = template(mapSolvinTemplateData(input as any));

    expect(html).toContain("<p>Pune, Maharashtra, India 411001</p>");
  });

  it.each([
    "INVOICE",
    "QUOTATION",
    "PROFORMA",
    "SALESORDER",
    "PURCHASEORDER",
    "DELIVERYCHALLAN",
    "CREDITNOTE",
    "DEBITNOTE",
    "EXPENSE",
  ])("renders the billed-by city for %s documents", (billType) => {
    const input = payload(false);
    Object.assign(input.invoice, { billType });
    Object.assign(input.invoice.billedBy, {
      address: "12 Marine Drive",
      city: "Mumbai",
      state: "Maharashtra",
      country: "IN",
      pincode: "400001",
    });

    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).toContain("<p>12 Marine Drive</p>");
    expect(html).toContain("<p>Mumbai, Maharashtra, India 400001</p>");
  });

  it("renders country and place of supply in the invoice metadata", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "29",
      billedTo: {
        name: "Buyer",
        country: "US",
        state: "Karnataka",
        stateCode: "29",
      },
    });

    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).toContain(
      '<div class="meta-label" data-ceres-country-of-supply>Country of Supply</div>'
    );
    expect(html).toContain("<div data-ceres-country-of-supply>India</div>");
    expect(html).toContain(
      '<div class="meta-label" data-ceres-place-of-supply>Place of Supply</div>'
    );
    expect(html).toContain("<div data-ceres-place-of-supply>Karnataka</div>");
  });

  it("omits empty supply metadata", () => {
    const input = payload(false);
    Object.assign(input.invoice.billedTo, {
      country: "",
      state: "",
      stateCode: "",
      gstState: "",
    });
    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).not.toContain("Country of Supply");
    expect(html).not.toContain("Place of Supply");
  });

  it("fetches supply metadata from billedTo and pos fallbacks", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      pos: "27",
      billedTo: {
        name: "Buyer",
        country: "IN",
        state: "Maharashtra",
        stateCode: "27",
      },
    });

    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).toContain("<div data-ceres-country-of-supply>India</div>");
    expect(html).toContain("<div data-ceres-place-of-supply>Maharashtra</div>");
  });

  it("renders Hong Kong correctly without applying an Indian GST state code", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "HK",
      placeOfSupply: "99",
      billedTo: {
        name: "Buyer",
        country: "HK",
        state: "Hong Kong",
      },
    });

    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).toContain("<div data-ceres-country-of-supply>Hong Kong</div>");
    expect(html).not.toContain("Centre Jurisdiction");
  });

  it("honors the advanced supply visibility flags", () => {
    const input = payload(false);
    Object.assign(input.invoice, {
      countryOfSupply: "IN",
      placeOfSupply: "Karnataka",
      advanceOptions: {
        isDescriptionFullWidth: false,
        hideCountryOfSupply: true,
        hidePlaceOfSupply: true,
      },
    });

    const html = template(normalizeInvoiceTemplateState(input as any));

    expect(html).toContain(
      'data-ceres-country-of-supply style="display: none;"'
    );
    expect(html).toContain('data-ceres-place-of-supply style="display: none;"');
  });
});
