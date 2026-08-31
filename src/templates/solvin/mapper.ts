import {
  normalizeInvoiceTemplateState,
  type InvoiceTemplateColumn,
} from "../../main/invoiceTemplateNormalization";
import { computeHsnSummary } from "../../widgets/hsn-summary/utils";

type UnknownRecord = Record<string, any>;

const ROW_NUMBER_KEYS = new Set(["sr", "srno", "sno", "rownumber", "index"]);

/** The enabled display-property profile supplied for the Solvin template. */
export const SOLVIN_DISPLAY_PROPERTIES = Object.freeze({
  showHsnSummary: true,
  showSerialNumbersInDescription: true,
  showGroupSubTotal: true,
  showTotalsRow: true,
  showTotals: true,
  showTotalInWords: true,
});

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizedName = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const firstText = (...values: any[]): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) || "";

const resolveCurrencySymbol = (invoice: UnknownRecord): string =>
  firstText(invoice.customCurrencySymbol);

const buildNote = (invoice: UnknownRecord): string => {
  const note = firstText(invoice.notes);
  const currency = firstText(invoice.currency, invoice.businessCurrency, "INR");
  const symbol = resolveCurrencySymbol(invoice);
  const currencyLine = symbol ? `${currency} (${symbol})` : currency;

  return note
    ? `${note}\n\nCurrency: ${currencyLine}`
    : `Currency: ${currencyLine}`;
};

const numericValue = (value: any): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  const accountingNegative = /^\(.*\)$/.test(raw);
  const numericPart = raw.match(/[-+]?\d[\d,\s]*(?:\.\d+)?/);
  if (!numericPart) return undefined;

  // Permit formatted currency values such as "SAR 100" and "₹1,250.50",
  // but reject arbitrary mixed values rather than silently treating them as 0.
  const surroundingText = raw
    .replace(numericPart[0], "")
    .replace(/[()\s]/g, "");
  if (
    surroundingText &&
    !/^(?:[A-Za-z]{3}|[^A-Za-z0-9]+)$/.test(surroundingText)
  ) {
    return undefined;
  }

  const parsed = Number(numericPart[0].replace(/[,\s]/g, ""));
  if (!Number.isFinite(parsed)) return undefined;
  return accountingNegative ? -Math.abs(parsed) : parsed;
};

const firstMonetaryValue = (...values: any[]): any =>
  values.find((value) => numericValue(value) !== undefined);

const getHsnSummaryEntries = (value: any): any[] => {
  if (Array.isArray(value)) return value;

  const summary = asRecord(value);
  return Array.isArray(summary.hsnList) ? summary.hsnList : [];
};

/**
 * Uses the API's rounded HSN tax total when supplied. Individual IGST/CGST/
 * SGST cells can legitimately add up to a different paise value after the
 * invoice service applies its final rounding adjustment.
 */
const getAuthoritativeHsnTaxTotal = (value: any): number | undefined => {
  const summary = asRecord(value);
  const directTotal = numericValue(
    firstMonetaryValue(
      summary.totalTaxAmountValue,
      summary.totalTaxAmount,
      summary.totalTax,
      summary.tax
    )
  );
  if (directTotal !== undefined) return directTotal;

  const rowTotals = getHsnSummaryEntries(value)
    .map((entry) => {
      const row = asRecord(entry);
      return numericValue(
        firstMonetaryValue(
          row.tax,
          row.totalTaxAmountValue,
          row.totalTaxAmount,
          row.totalTax
        )
      );
    })
    .filter((amount): amount is number => amount !== undefined);

  if (!rowTotals.length) return undefined;
  return (
    Math.round(
      (rowTotals.reduce((sum, amount) => sum + amount, 0) + Number.EPSILON) *
        100
    ) / 100
  );
};

const optionalBooleanValue = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};

const collectionRecords = (value: any): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);

  return Object.entries(asRecord(value)).map(([key, entry]) => {
    const record = asRecord(entry);
    return Object.keys(record).length
      ? { key, ...record }
      : { key, label: key, value: entry };
  });
};

const isConfiguredFieldVisible = (field: UnknownRecord): boolean =>
  (optionalBooleanValue(field.showInInvoice) ??
    optionalBooleanValue(asRecord(field.params).showInInvoice) ??
    true) &&
  optionalBooleanValue(field.isHidden) !== true;

const mapInformationalRows = (value: any) =>
  collectionRecords(value)
    .filter(isConfiguredFieldVisible)
    .map((field) => {
      const label = firstText(field.label, field.name, field.key);
      const fieldValue = field.value ?? field.defaultValue;
      return {
        label,
        value: String(fieldValue ?? "").trim(),
        isMonetary:
          field.dataType === "currency" ||
          field.fxReturnType === "currency" ||
          field.isCurrency === true,
      };
    })
    .filter((row) => row.label && row.value);

const mapCessRows = (invoice: UnknownRecord) => {
  const finalTotal = asRecord(invoice.finalTotal);
  const invoiceTotals = asRecord(invoice.totals);
  const finalCessTotal = asRecord(finalTotal.cessTotal);
  const invoiceCessTotal = asRecord(invoiceTotals.cessTotal);

  return collectionRecords(invoice.cesses)
    .filter(
      (cess) =>
        (optionalBooleanValue(cess.isApplied) ?? true) &&
        optionalBooleanValue(cess.isArchived) !== true
    )
    .map((cess) => {
      const amountKey = firstText(cess.cessAmountKey, cess.amountKey);
      const cessKey = firstText(cess.cessKey, cess.key);
      const amount = firstMonetaryValue(
        cess.finalAmount,
        cess.calculatedAmount,
        cess.amount,
        finalCessTotal[amountKey],
        finalCessTotal[cessKey],
        invoiceCessTotal[amountKey],
        invoiceCessTotal[cessKey]
      );

      return {
        label: firstText(cess.cessName, cess.label, cess.name, "Cess"),
        amount,
      };
    })
    .filter((row) => numericValue(row.amount) !== undefined);
};

const roundMoney = (value: number, invoice: UnknownRecord): number => {
  const requestedPrecision = Number(invoice.subUnitLength ?? 2);
  const precision =
    Number.isInteger(requestedPrecision) && requestedPrecision >= 0
      ? requestedPrecision
      : 2;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const mapAdditionalChargeRows = (
  invoice: UnknownRecord,
  calculationBase: number
) =>
  collectionRecords(invoice.additionalCharges)
    .filter(isConfiguredFieldVisible)
    .map((charge) => {
      const multiplier = numericValue(charge.multiplier) ?? 1;
      const explicitAmount = numericValue(
        firstMonetaryValue(
          charge.finalAmount,
          charge.calculatedAmount,
          charge.totalAmount,
          charge.amountValue
        )
      );
      const configuredAmount = numericValue(charge.amount);
      const isPercentage = ["percentage", "percent", "%"].includes(
        firstText(charge.amountType, charge.type).toLowerCase()
      );
      let unsignedAmount = explicitAmount;
      if (unsignedAmount === undefined && configuredAmount !== undefined) {
        unsignedAmount = isPercentage
          ? (calculationBase * configuredAmount) / 100
          : configuredAmount;
      }

      return {
        label: firstText(charge.label, charge.name, charge.key),
        amount:
          unsignedAmount === undefined
            ? undefined
            : roundMoney(unsignedAmount * multiplier, invoice),
      };
    })
    .filter((row) => row.label && row.amount !== undefined);

const configuredVisibility = (
  invoice: UnknownRecord,
  keys: string[]
): boolean | undefined => {
  const invoiceValueProps = asRecord(invoice.invoiceValueProps);

  return keys
    .map((key) => {
      const matchingKey = Object.keys(invoiceValueProps).find(
        (candidate) => normalizedName(candidate) === normalizedName(key)
      );
      if (!matchingKey) return undefined;

      const setting = invoiceValueProps[matchingKey];
      const directValue = optionalBooleanValue(setting);
      if (directValue !== undefined) return directValue;

      const settingRecord = asRecord(setting);
      return (
        optionalBooleanValue(settingRecord.visible) ??
        optionalBooleanValue(settingRecord.showInInvoice)
      );
    })
    .find((value) => value !== undefined);
};

/** Resolves built-in properties and document-configured item custom fields. */
export const getItemColumnValue = (itemValue: any, columnValue: any): any => {
  const item = asRecord(itemValue);
  const column = asRecord(columnValue);
  const key = String(column.key ?? "");
  const normalizedKey = normalizedName(key);

  if (key && item[key] !== undefined) return item[key];

  const matchingItemKey = Object.keys(item).find(
    (candidate) => normalizedName(candidate) === normalizedKey
  );
  if (matchingItemKey) return item[matchingItemKey];

  const custom = asRecord(item.custom);
  const matchingCustomKey = Object.keys(custom).find(
    (candidate) => normalizedName(candidate) === normalizedKey
  );
  if (matchingCustomKey) return custom[matchingCustomKey];

  const customFields = Array.isArray(item.customFields)
    ? item.customFields
    : Object.values(asRecord(item.customFields));
  const customField = customFields.find((field: any) => {
    const record = asRecord(field);
    return [record.key, record.label, record.name]
      .map(normalizedName)
      .includes(normalizedKey);
  });
  const customFieldRecord = asRecord(customField);
  return customFieldRecord.value ?? customFieldRecord.defaultValue ?? "";
};

const findVisibleColumn = (
  columns: InvoiceTemplateColumn[],
  keys: string[],
  fallbackLabels: any[] = [],
  allowSummarisedCurrency = false
): InvoiceTemplateColumn | undefined => {
  const normalizedKeys = keys.map(normalizedName);
  const visibleColumns = columns.filter((column) => !column.isHidden);
  return (
    visibleColumns.find((column) =>
      normalizedKeys.includes(normalizedName(column.key))
    ) ||
    visibleColumns.find((column) =>
      [...normalizedKeys, ...fallbackLabels.map(normalizedName)].includes(
        normalizedName(column.label)
      )
    ) ||
    (allowSummarisedCurrency &&
      visibleColumns.find(
        (column) =>
          column.summarise &&
          (column.semanticType === "currency" ||
            column.fxReturnType.toLowerCase() === "currency") &&
          ![
            "discount",
            "tax",
            "igst",
            "cgst",
            "sgst",
            "utgst",
            "total",
          ].includes(normalizedName(column.key))
      )) ||
    undefined
  );
};

const labelFor = (
  columns: InvoiceTemplateColumn[],
  keys: string[],
  fallback: any,
  defaultLabel: string
): string =>
  findVisibleColumn(columns, keys, [fallback, defaultLabel])?.label ||
  String(fallback || defaultLabel);

const isRealLineItem = (itemValue: any): boolean => {
  const item = asRecord(itemValue);
  return !item.isGroupItemTotalRow && !item.isAdditionalCharge && !item.group;
};

const getTaxRates = (
  items: any[],
  taxRateColumn?: InvoiceTemplateColumn
): number[] => {
  const rates = items
    .filter(isRealLineItem)
    .map((itemValue) => {
      const item = asRecord(itemValue);
      const value =
        item.gstRate ??
        item.taxRate ??
        item.tax ??
        (taxRateColumn
          ? getItemColumnValue(itemValue, taxRateColumn)
          : undefined);
      return numericValue(value);
    })
    .filter((rate): rate is number => rate !== undefined);

  return [...new Set(rates)].sort((left, right) => left - right);
};

const appendTaxRates = (
  label: string,
  rates: number[],
  divisor = 1
): string => {
  if (!rates.length || label.includes("%")) return label;

  const formattedRates = rates.map((rate) => {
    const applicableRate = Math.round((rate / divisor) * 10000) / 10000;
    return `${applicableRate}%`;
  });

  return `${label} (${formattedRates.join(", ")})`;
};

/** Ensures the rendered items table starts with a visible serial-number column. */
export const addItemSerialNumberColumn = (
  state: ReturnType<typeof normalizeInvoiceTemplateState>
) => {
  const columns = [...state.mapped.columns];
  const existingIndex = columns.findIndex((column) =>
    ROW_NUMBER_KEYS.has(column.key.toLowerCase())
  );

  if (existingIndex >= 0) {
    const [existingColumn] = columns.splice(existingIndex, 1);
    columns.unshift({
      ...existingColumn,
      label: "Item",
      className: "col-index",
      isHidden: false,
    });
  } else {
    columns.unshift({
      key: "index",
      label: "Item",
      className: "col-index",
      isHidden: false,
      dataType: "number",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    });
  }

  const unitColumnIndex = columns.findIndex((column) =>
    ["unit", "uom", "unitname"].includes(normalizedName(column.key))
  );
  if (state.mapped.visibility.showUnitAsColumn && unitColumnIndex < 0) {
    const quantityIndex = columns.findIndex((column) =>
      ["quantity", "qty"].includes(normalizedName(column.key))
    );
    columns.splice(quantityIndex >= 0 ? quantityIndex + 1 : 2, 0, {
      key: "unit",
      label: "Unit",
      className: "col-unit",
      isHidden: false,
      dataType: "string",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    });
  }

  const normalizedColumns = columns.map((column) =>
    normalizedName(column.key) === "total" &&
    ["", "amount"].includes(normalizedName(column.label))
      ? { ...column, label: "Total" }
      : column
  );

  return {
    ...state,
    mapped: {
      ...state.mapped,
      columns: normalizedColumns,
      visibility: {
        ...state.mapped.visibility,
        visibleColumnCount: normalizedColumns.filter(
          (column) => !column.isHidden
        ).length,
      },
    },
  };
};

export const mapSolvinTemplateData = (payload: any) => {
  const normalizedState = addItemSerialNumberColumn(
    normalizeInvoiceTemplateState(payload)
  );
  const invoice = {
    ...normalizedState.invoice,
    items: Array.isArray(normalizedState.invoice.items)
      ? normalizedState.invoice.items
      : [],
  };
  const state = { ...normalizedState, invoice };
  const { columns } = state.mapped;
  const advanceOptions = asRecord(state.advanceOptions);
  const customLabels = asRecord(invoice.customLabels);
  const balance = asRecord(invoice.balance);
  const toPay = asRecord(invoice.toPay);
  const finalTotal = asRecord(invoice.finalTotal);
  const invoiceTotals = asRecord(invoice.totals);
  const dueAmount = firstMonetaryValue(
    balance.due,
    balance.dueAmount,
    balance.balanceDue,
    toPay.full,
    toPay.amount,
    typeof invoice.toPay === "object" ? undefined : invoice.toPay,
    finalTotal.due,
    finalTotal.dueAmount,
    invoiceTotals.due,
    invoiceTotals.dueAmount
  );
  const explicitDueVisibility =
    configuredVisibility(invoice, ["dueAmount", "balanceDue"]) ??
    optionalBooleanValue(invoice.showDueAmount);
  const notes = firstText(invoice.notes);
  const showTerms =
    Array.isArray(invoice.terms) &&
    invoice.terms.some((group) => {
      const { terms } = asRecord(group);
      return (
        Array.isArray(terms) && terms.some((term) => Boolean(firstText(term)))
      );
    });
  const showNotes =
    Boolean(notes) &&
    (configuredVisibility(invoice, ["notes"]) ??
      optionalBooleanValue(invoice.notesShowInInvoice) ??
      optionalBooleanValue(invoice.showNotesInInvoice) ??
      optionalBooleanValue(invoice.showNotes) ??
      !(optionalBooleanValue(invoice.hideNotes) ?? false));
  // `toPay`/balance values are also used for payment calculations, so their
  // presence does not mean the Due Amount field was added to the invoice.
  // Only render it when the invoice configuration explicitly enables it.
  const showDueAmount = explicitDueVisibility ?? false;
  const isDescriptionFullWidth =
    optionalBooleanValue(advanceOptions.showDescriptionInFullWidth) ??
    optionalBooleanValue(advanceOptions.isDescriptionFullWidth) ??
    optionalBooleanValue(
      (invoice as UnknownRecord).showDescriptionInFullWidth
    ) ??
    optionalBooleanValue(invoice.isDescriptionFullWidth) ??
    state.mapped.visibility.isDescriptionFullWidth;
  const hasHsnItems = invoice.items.some((itemValue) => {
    const item = asRecord(itemValue);
    return Boolean(firstText(item.hsn, item.sac, item.hsnCode));
  });
  const showHsnSummary =
    SOLVIN_DISPLAY_PROPERTIES.showHsnSummary &&
    state.mapped.visibility.showTaxes &&
    (state.mapped.visibility.showHsnSummary || hasHsnItems);
  const hsnItems = invoice.items.map((itemValue) => {
    const item = asRecord(itemValue);
    return {
      ...item,
      hsn: firstText(item.hsn, item.sac, item.hsnCode),
      gstRate: numericValue(item.gstRate ?? item.taxRate ?? item.tax) ?? 0,
      amount: numericValue(item.amount ?? item.taxableValue) ?? 0,
      igst: numericValue(item.igst) ?? 0,
      cgst: numericValue(item.cgst) ?? 0,
      sgst: numericValue(item.sgst ?? item.utgst) ?? 0,
    };
  });
  const computedHsnSummary = computeHsnSummary(hsnItems, {
    isIgst: state.mapped.visibility.showIgst,
    isUtgst: state.mapped.visibility.isUtgst,
  });
  const hsnSummary = {
    ...computedHsnSummary,
    totalTaxAmount:
      getAuthoritativeHsnTaxTotal(invoice.hsnSummary) ??
      computedHsnSummary.totalTaxAmount,
  };
  const amountColumn = findVisibleColumn(
    columns,
    ["amount", "subtotal"],
    [customLabels.subTotal, "Sub Total", "Amount", "Taxable Value"],
    true
  );
  const taxRateColumn = findVisibleColumn(
    columns,
    ["gstRate", "gst", "taxRate", "tax"],
    ["GST Rate", "Tax Rate"]
  );
  const taxRates = getTaxRates(
    Array.isArray(invoice.items) ? invoice.items : [],
    taxRateColumn
  );

  // The rows and values rendered in the document are authoritative. This also
  // handles an amount column whose values live in item.customFields.
  const itemAmounts = amountColumn
    ? (Array.isArray(invoice.items) ? invoice.items : [])
        .filter(isRealLineItem)
        .map((item) => numericValue(getItemColumnValue(item, amountColumn)))
        .filter((value): value is number => value !== undefined)
    : [];
  const subTotal = itemAmounts.length
    ? itemAmounts.reduce((sum, amount) => sum + amount, 0)
    : numericValue(invoice.subTotal) ?? 0;
  const cessRows = mapCessRows(invoice);
  const taxAmount = state.mapped.visibility.showIgst
    ? numericValue(finalTotal.igst) ?? 0
    : (numericValue(finalTotal.cgst) ?? 0) +
      (numericValue(
        state.mapped.visibility.isUtgst ? finalTotal.utgst : finalTotal.sgst
      ) ?? 0);
  const cessAmount = cessRows.reduce(
    (sum, row) => sum + (numericValue(row.amount) ?? 0),
    0
  );
  const additionalChargeRows = mapAdditionalChargeRows(
    invoice,
    subTotal + taxAmount + cessAmount
  );
  const extraTotalRows = mapInformationalRows(invoice.extraTotalFields);

  return {
    ...state,
    mapped: {
      ...state.mapped,
      visibility: {
        ...state.mapped.visibility,
        showDueAmount,
        showHsnSummary,
        showCountryOfSupply: false,
        showPlaceOfSupply: false,
        isDescriptionFullWidth,
        showSku: state.mapped.visibility.showSku,
        showSkuInName: state.mapped.visibility.showSkuInName,
        showSerialNumbersInDescription:
          SOLVIN_DISPLAY_PROPERTIES.showSerialNumbersInDescription,
        showTotalsRow: SOLVIN_DISPLAY_PROPERTIES.showTotalsRow,
        showTotals: SOLVIN_DISPLAY_PROPERTIES.showTotals,
        showTotalInWords: SOLVIN_DISPLAY_PROPERTIES.showTotalInWords,
        showNotes,
        showTerms,
      },
      hsnSummary,
    },
    display: {
      currency: firstText(
        invoice.currency,
        invoice.businessCurrency,
        "INR"
      ).toUpperCase(),
      currencySymbol: resolveCurrencySymbol(invoice),
      note: buildNote(invoice),
      notes,
      labels: {
        notes: firstText(customLabels.notes, "Notes"),
        subTotal:
          amountColumn?.label || String(customLabels.subTotal || "Sub Total"),
        igst: appendTaxRates(
          labelFor(
            columns,
            ["igst", "taxamount", "tax"],
            customLabels.igst || invoice.taxName,
            "IGST"
          ),
          taxRates
        ),
        cgst: appendTaxRates(
          labelFor(columns, ["cgst"], customLabels.cgst, "CGST"),
          taxRates,
          2
        ),
        sgst: appendTaxRates(
          labelFor(columns, ["sgst"], customLabels.sgst, "SGST"),
          taxRates,
          2
        ),
        utgst: appendTaxRates(
          labelFor(columns, ["utgst", "sgst"], customLabels.utgst, "UTGST"),
          taxRates,
          2
        ),
        total: labelFor(columns, ["total"], customLabels.total, "Total"),
        tdsAmountWithheld: firstText(
          customLabels.tdsAmountWithheld,
          customLabels.tds,
          "TDS Amount Withheld"
        ),
        amountPaid: firstText(
          customLabels.amountPaid,
          customLabels.paid,
          "Amount Paid"
        ),
        amountReceived: firstText(
          customLabels.amountReceived,
          customLabels.settledAmount,
          "Amount Received"
        ),
        transactionCharge: firstText(
          customLabels.transactionCharge,
          "Transaction Charge"
        ),
        dueAmount: firstText(
          customLabels.dueAmount,
          customLabels.balanceDue,
          "Due Amount"
        ),
      },
      cessRows,
      additionalChargeRows,
      extraTotalRows,
    },
    totals: { subTotal, dueAmount },
  };
};

export type SolvinTemplateState = ReturnType<typeof mapSolvinTemplateData>;
