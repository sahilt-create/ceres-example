import formatCurrency from "../widgets/shared/formatCurrency";
import {
  normalizeInvoiceTemplateState,
  normalizePlaceOfSupply,
  type InvoiceTemplateColumn,
} from "../main/invoiceTemplateNormalization";
import { computeHsnSummary } from "../widgets/hsn-summary/utils";

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

const SOLVIN_OMITTED_ADDITIONAL_INFORMATION_FIELDS = [
  "customFooters",
  "footers",
  "customFields",
  "additionalInfo",
  "additionalInformation",
  "additionalInformationFields",
] as const;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizedName = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const firstText = (...values: any[]): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) || "";

const imageSource = (value: any): string => {
  const record = asRecord(value);
  const source = firstText(
    typeof value === "string" ? value : "",
    record.url,
    record.src,
    record.image,
    record.value,
    record.data,
    record.base64
  );
  if (!source) return "";
  if (/^(?:data:|https?:|blob:|\/)/i.test(source)) return source;

  return `data:image/png;base64,${source}`;
};

const firstImageSource = (...values: any[]): string =>
  values.map(imageSource).find(Boolean) ?? "";

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

type OrderedDisplayRow = {
  key: string;
  label: string;
  value: any;
  isPhone?: boolean;
  isDate?: boolean;
  isCountry?: boolean;
  isPlace?: boolean;
  supplyField?: "country-of-supply" | "place-of-supply";
};

const configuredOrderKeys = (...values: any[]): string[] =>
  values
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((entry) => {
      if (typeof entry === "string") return normalizedName(entry);
      const record = asRecord(entry);
      return normalizedName(
        firstText(
          record.key,
          record.field,
          record.fieldKey,
          record.name,
          record.label
        )
      );
    })
    .filter(Boolean);

const orderDisplayRows = <T extends { key: string; label: string }>(
  rows: T[],
  orderKeys: string[]
): T[] => {
  if (!orderKeys.length) return rows;

  const remaining = [...rows];
  const ordered: T[] = [];
  orderKeys.forEach((orderKey) => {
    const index = remaining.findIndex(
      (row) =>
        normalizedName(row.key) === orderKey ||
        normalizedName(row.label) === orderKey
    );
    if (index >= 0) ordered.push(...remaining.splice(index, 1));
  });
  return [...ordered, ...remaining];
};

const isPartyEntryVisible = (field: UnknownRecord): boolean =>
  isConfiguredFieldVisible(field) &&
  optionalBooleanValue(field.isArchived) !== true;

const mapPartyDetailRows = (
  partyValue: any,
  labelsValue?: any
): OrderedDisplayRow[] => {
  const party = asRecord(partyValue);
  const labels = asRecord(labelsValue);
  const builtInRows: OrderedDisplayRow[] = [
    {
      key: "gstin",
      label: firstText(labels.gstin, "GSTIN"),
      value: party.gstin,
    },
    {
      key: "panNumber",
      label: firstText(labels.pan, labels.panNumber, "PAN"),
      value: party.panNumber,
    },
    {
      key: "trnNumber",
      label: firstText(labels.trn, labels.trnNumber, "TRN"),
      value: party.trnNumber,
    },
    {
      key: "tinNumber",
      label: firstText(labels.tin, labels.tinNumber, "TIN"),
      value: party.tinNumber,
    },
    {
      key: "vatNumber",
      label: firstText(labels.vat, labels.vatNumber, party.vatLabel, "VAT"),
      value: party.vatNumber,
    },
    {
      key: "sstNumber",
      label: firstText(labels.sst, labels.sstNumber, "SST"),
      value: party.sstNumber,
    },
    {
      key: "phone",
      label: firstText(labels.phone, "Phone"),
      value: party.phone,
      isPhone: true,
    },
    {
      key: "email",
      label: firstText(labels.email, "Email"),
      value: party.email,
    },
  ].filter((row) => firstText(row.value));
  const configuredRows = [party.additionalIds, party.customFields]
    .flatMap(collectionRecords)
    .filter(isPartyEntryVisible)
    .map((field) => ({
      key: firstText(field.key, field.name, field.label),
      label: firstText(field.label, field.name, field.key),
      value: firstText(field.value, field.defaultValue),
    }))
    .filter((row) => row.label && row.value);

  return orderDisplayRows(
    [...builtInRows, ...configuredRows],
    configuredOrderKeys(
      party.fieldOrder,
      party.displayOrder,
      party.fieldSequence,
      party.customFieldOrder
    )
  );
};

const mapDocumentDetailRows = (invoiceValue: any): OrderedDisplayRow[] => {
  const invoice = asRecord(invoiceValue);
  const labels = asRecord(invoice.customLabels);
  const rows: OrderedDisplayRow[] = [
    {
      key: "invoiceNumber",
      label: firstText(labels.invoiceNumber, "Invoice No"),
      value: invoice.invoiceNumber,
    },
    {
      key: "invoiceDate",
      label: firstText(labels.invoiceDate, "Invoice Date"),
      value: invoice.invoiceDate,
      isDate: true,
    },
    {
      key: "dueDate",
      label: firstText(labels.dueDate, "Due Date"),
      value: invoice.dueDate,
      isDate: true,
    },
    {
      key: "countryOfSupply",
      label: firstText(labels.countryOfSupply, "Country of Supply"),
      value: invoice.countryOfSupply,
      isCountry: true,
      supplyField: "country-of-supply" as const,
    },
    {
      key: "placeOfSupply",
      label: firstText(labels.placeOfSupply, "Place of Supply"),
      value: invoice.placeOfSupply,
      isPlace: true,
      supplyField: "place-of-supply" as const,
    },
    {
      key: "purchaseOrderNumber",
      label: firstText(labels.purchaseOrderNumber, "PO No"),
      value: invoice.purchaseOrderNumber,
    },
    {
      key: "quotationNumber",
      label: firstText(labels.quotationNumber, "Quotation No"),
      value: invoice.quotationNumber,
    },
    {
      key: "salesOrderNumber",
      label: firstText(labels.salesOrderNumber, "Sales Order No"),
      value: invoice.salesOrderNumber,
    },
    {
      key: "documentNumber",
      label: firstText(labels.documentNumber, "Document No"),
      value: invoice.documentNumber,
    },
    {
      key: "documentDate",
      label: firstText(labels.documentDate, "Document Date"),
      value: invoice.documentDate,
      isDate: true,
    },
  ].filter((row) => firstText(row.value));
  const customRows = collectionRecords(invoice.customHeaders)
    .filter(isConfiguredFieldVisible)
    .map((field) => ({
      key: firstText(field.key, field.name, field.label),
      label: firstText(field.label, field.name, field.key),
      value: firstText(field.value, field.defaultValue),
    }))
    .filter((row) => row.label && row.value);
  const template = asRecord(invoice.template);

  return orderDisplayRows(
    [...rows, ...customRows],
    configuredOrderKeys(
      invoice.documentFieldOrder,
      invoice.documentDetailsOrder,
      invoice.headerFieldOrder,
      template.documentFieldOrder,
      template.documentDetailsOrder
    )
  );
};

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
      const params = asRecord(settingRecord.params);
      const shown =
        optionalBooleanValue(settingRecord.visible) ??
        optionalBooleanValue(settingRecord.isVisible) ??
        optionalBooleanValue(settingRecord.show) ??
        optionalBooleanValue(settingRecord.showInInvoice) ??
        optionalBooleanValue(params.visible) ??
        optionalBooleanValue(params.isVisible) ??
        optionalBooleanValue(params.show) ??
        optionalBooleanValue(params.showInInvoice);
      if (shown !== undefined) return shown;

      const hidden =
        optionalBooleanValue(settingRecord.hidden) ??
        optionalBooleanValue(settingRecord.isHidden) ??
        optionalBooleanValue(settingRecord.hide) ??
        optionalBooleanValue(settingRecord.hideInInvoice) ??
        optionalBooleanValue(params.hidden) ??
        optionalBooleanValue(params.isHidden) ??
        optionalBooleanValue(params.hide) ??
        optionalBooleanValue(params.hideInInvoice);
      return hidden === undefined ? undefined : !hidden;
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
  const visibleColumnCount = normalizedColumns.filter(
    (column) => !column.isHidden
  ).length;

  return {
    ...state,
    mapped: {
      ...state.mapped,
      columns: normalizedColumns,
      visibility: {
        ...state.mapped.visibility,
        visibleColumnCount,
        denseItemsTable: visibleColumnCount >= 11,
      },
    },
  };
};

export const mapSolvinTemplateData = (payload: any) => {
  const rawPayload = asRecord(payload);
  const normalizedState = addItemSerialNumberColumn(
    normalizeInvoiceTemplateState(payload)
  );
  const invoice = {
    ...normalizedState.invoice,
    items: Array.isArray(normalizedState.invoice.items)
      ? normalizedState.invoice.items
      : [],
  };
  const rawInvoice = asRecord(rawPayload.invoice);
  const invoiceRecord = invoice as UnknownRecord;

  // Letterhead artwork is an invoice/template choice in Lydia. Do not inherit
  // generic business or owner branding here: the hidden template hooks below
  // are populated later when Lydia explicitly sends a template update.
  invoice.letterHead = firstImageSource(
    rawInvoice.letterHead,
    invoiceRecord.letterHead,
    invoiceRecord.letterhead,
    rawInvoice.letterhead,
    invoiceRecord.headerImage,
    rawInvoice.headerImage
  );
  invoice.letterHeadFooter = firstImageSource(
    rawInvoice.letterHeadFooter,
    invoiceRecord.letterHeadFooter,
    invoiceRecord.letterheadFooter,
    rawInvoice.letterheadFooter,
    invoiceRecord.footerImage,
    rawInvoice.footerImage
  );
  SOLVIN_OMITTED_ADDITIONAL_INFORMATION_FIELDS.forEach((field) => {
    delete (invoice as UnknownRecord)[field];
  });
  const state = { ...normalizedState, invoice };
  const { columns } = state.mapped;
  const advanceOptions = asRecord(state.advanceOptions);
  const customLabels = asRecord(invoice.customLabels);
  const bankAccount = asRecord(invoice.bankAccount);
  const bankLabels = asRecord(bankAccount.customLabels);
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
  const configuredDueVisibility = configuredVisibility(invoice, [
    "dueAmount",
    "balanceDue",
    "due",
    "toPay",
  ]);
  const explicitDueShown =
    optionalBooleanValue(advanceOptions.showDueAmount) ??
    optionalBooleanValue(advanceOptions.showBalanceDue) ??
    optionalBooleanValue(invoice.showDueAmount) ??
    optionalBooleanValue((invoice as UnknownRecord).showBalanceDue);
  const explicitDueHidden =
    optionalBooleanValue(advanceOptions.hideDueAmount) ??
    optionalBooleanValue(advanceOptions.hideBalanceDue) ??
    optionalBooleanValue((invoice as UnknownRecord).hideDueAmount) ??
    optionalBooleanValue((invoice as UnknownRecord).hideBalanceDue);
  const explicitDueVisibility =
    configuredDueVisibility ??
    explicitDueShown ??
    (explicitDueHidden === undefined ? undefined : !explicitDueHidden);
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
  // A balance value alone must not add Due Amount to the template. Render the
  // row only when the invoice explicitly includes/enables that field.
  const numericDueAmount = numericValue(dueAmount);
  const hasOutstandingDueAmount =
    numericDueAmount !== undefined && numericDueAmount > 0;
  const showDueAmount =
    hasOutstandingDueAmount && explicitDueVisibility === true;
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
  const discountAmount = numericValue(
    firstMonetaryValue(
      finalTotal.discount,
      finalTotal.totalDiscount,
      invoice.discount,
      asRecord(invoice.totals).discount,
      asRecord(invoice.totals).totalDiscount
    )
  );
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
        showShippingParties:
          state.mapped.visibility.shippedFrom ||
          state.mapped.visibility.shippedTo,
        singleShippingParty:
          state.mapped.visibility.shippedFrom !==
          state.mapped.visibility.shippedTo,
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
      partyDetails: {
        billedBy: mapPartyDetailRows(invoice.billedBy, customLabels),
        billedTo: mapPartyDetailRows(invoice.billedTo, customLabels),
        shippedFrom: mapPartyDetailRows(invoice.shippedFrom, customLabels),
        shippedTo: mapPartyDetailRows(invoice.shippedTo, customLabels),
      },
      documentDetails: mapDocumentDetailRows(invoice),
      labels: {
        billedBy: firstText(customLabels.billedBy, "Billed By"),
        billedTo: firstText(customLabels.billedTo, "Billed To"),
        shippedFrom: firstText(customLabels.shippedFrom, "Shipped From"),
        shippedTo: firstText(customLabels.shippedTo, "Shipped To"),
        notes: firstText(customLabels.notes, "Notes"),
        terms: firstText(
          customLabels.terms,
          customLabels.termsAndConditions,
          (invoice as UnknownRecord).termsLabel,
          (invoice as UnknownRecord).termsAndConditionsLabel,
          "Terms and Conditions"
        ),
        purchaseOrderNumber: firstText(
          customLabels.purchaseOrderNumber,
          "PO No"
        ),
        totalInWords: firstText(customLabels.totalInWords, "Total In Words"),
        sku: firstText(customLabels.sku, "SKU"),
        serialNumber: firstText(customLabels.serialNumber, "Serial No."),
        hsn: firstText(customLabels.hsn, customLabels.hsnSac, "HSN/SAC"),
        hsnSummary: firstText(customLabels.hsn, customLabels.hsnSac, "HSN"),
        classification: firstText(
          customLabels.classification,
          "Classification"
        ),
        unit: firstText(customLabels.unit, "Unit"),
        bankDetails: firstText(
          customLabels.bankDetails,
          bankLabels.bankDetails,
          "Bank Details"
        ),
        accountName: firstText(
          customLabels.accountName,
          customLabels.accountHolderName,
          bankLabels.accountName,
          bankLabels.accountHolderName,
          "Account Name"
        ),
        accountNumber: firstText(
          customLabels.accountNumber,
          customLabels.accountNo,
          bankLabels.accountNumber,
          bankLabels.accountNo,
          "Account Number"
        ),
        ifsc: firstText(
          customLabels.ifsc,
          customLabels.ifscCode,
          bankLabels.ifsc,
          bankLabels.ifscCode,
          "IFSC"
        ),
        swift: firstText(
          customLabels.swift,
          customLabels.swiftCode,
          bankLabels.swift,
          bankLabels.swiftCode,
          "SWIFT"
        ),
        accountType: firstText(
          customLabels.accountType,
          bankLabels.accountType,
          "Account Type"
        ),
        bank: firstText(
          customLabels.bank,
          customLabels.bankName,
          bankLabels.bank,
          bankLabels.bankName,
          "Bank"
        ),
        taxableValue: firstText(customLabels.taxableValue, "Taxable Value"),
        rate: firstText(customLabels.rate, "Rate"),
        amount: firstText(customLabels.amount, "Amount"),
        totalTaxInWords: firstText(
          customLabels.totalTaxInWords,
          "Total Tax In Words"
        ),
        signature: firstText(customLabels.signature, "Authorized Signatory"),
        signatureFor: firstText(customLabels.for, "For"),
        subTotal:
          amountColumn?.label || String(customLabels.subTotal || "Sub Total"),
        discount: firstText(customLabels.discount, "Discount"),
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
          customLabels.paidAmount,
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
      discountAmount:
        discountAmount && Number.isFinite(discountAmount)
          ? Math.abs(discountAmount)
          : undefined,
    },
    totals: { subTotal, dueAmount },
  };
};

export type SolvinTemplateState = ReturnType<typeof mapSolvinTemplateData>;

// Shared formatting helpers used by the Solvin and SR Trading templates.
const serialNumberText = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value).trim();

  const serial = asRecord(value);
  return String(
    serial.serialNumber ??
      serial.serialNo ??
      serial.serial ??
      serial.code ??
      serial.value ??
      serial.name ??
      serial.label ??
      ""
  ).trim();
};

const asOptionalArray = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

const optionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};

/** Converts uppercase amount-in-words output to title case. */
export const toTitleCaseWords = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const internationalOnes = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const internationalTens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const internationalBelowThousand = (value: number): string => {
  if (value < 20) return internationalOnes[value];
  if (value < 100) {
    return `${internationalTens[Math.floor(value / 10)]}${
      value % 10 ? ` ${internationalOnes[value % 10]}` : ""
    }`;
  }
  return `${internationalOnes[Math.floor(value / 100)]} Hundred${
    value % 100 ? ` ${internationalBelowThousand(value % 100)}` : ""
  }`;
};

const internationalIntegerWords = (value: number): string => {
  if (!value) return "Zero";
  const scales = [
    { value: 1_000_000_000, label: "Billion" },
    { value: 1_000_000, label: "Million" },
    { value: 1_000, label: "Thousand" },
  ];
  let remainder = value;
  const words: string[] = [];

  scales.forEach((scale) => {
    if (remainder < scale.value) return;
    words.push(
      `${internationalIntegerWords(Math.floor(remainder / scale.value))} ${
        scale.label
      }`
    );
    remainder %= scale.value;
  });
  if (remainder) words.push(internationalBelowThousand(remainder));
  return words.join(" ");
};

type CurrencyWordForms = {
  singular: string;
  plural: string;
  fractionalSingular: string;
  fractionalPlural: string;
};

const HSN_CURRENCY_WORD_FORMS: Record<string, CurrencyWordForms> = {
  INR: {
    singular: "Rupee",
    plural: "Rupees",
    fractionalSingular: "Paisa",
    fractionalPlural: "Paise",
  },
  USD: {
    singular: "Dollar",
    plural: "Dollars",
    fractionalSingular: "Cent",
    fractionalPlural: "Cents",
  },
  SAR: {
    singular: "Saudi Riyal",
    plural: "Saudi Riyals",
    fractionalSingular: "Halala",
    fractionalPlural: "Halalas",
  },
  AED: {
    singular: "UAE Dirham",
    plural: "UAE Dirhams",
    fractionalSingular: "Fil",
    fractionalPlural: "Fils",
  },
  EUR: {
    singular: "Euro",
    plural: "Euros",
    fractionalSingular: "Cent",
    fractionalPlural: "Cents",
  },
  GBP: {
    singular: "Pound",
    plural: "Pounds",
    fractionalSingular: "Penny",
    fractionalPlural: "Pence",
  },
};

const getHsnCurrencyWordForms = (invoiceValue: any): CurrencyWordForms => {
  const invoice = asRecord(invoiceValue);
  const currency = String(invoice.currency ?? invoice.businessCurrency ?? "INR")
    .trim()
    .toUpperCase();
  return (
    HSN_CURRENCY_WORD_FORMS[currency] ?? {
      singular: currency || "Currency",
      plural: currency || "Currency",
      fractionalSingular: "Subunit",
      fractionalPlural: "Subunits",
    }
  );
};

/** Formats HSN tax totals with the invoice currency and international scale. */
export const solvinTaxAmountInWords = (
  amountValue: any,
  invoiceValue?: any
): string => {
  const amount = Number(amountValue);
  const currency = getHsnCurrencyWordForms(invoiceValue);
  if (!Number.isFinite(amount)) return `Zero ${currency.plural} Only`;
  if (amount < 0) {
    return `Minus ${solvinTaxAmountInWords(Math.abs(amount), invoiceValue)}`;
  }

  let rupees = Math.floor(amount);
  let paise = Math.round((amount - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  const majorUnitWords = `${internationalIntegerWords(rupees)} ${
    rupees === 1 ? currency.singular : currency.plural
  }`;
  const fractionalWords = paise
    ? ` And ${internationalIntegerWords(paise)} ${
        paise === 1 ? currency.fractionalSingular : currency.fractionalPlural
      }`
    : "";
  return `${majorUnitWords}${fractionalWords} Only`;
};

/** Resolves the supported item SKU aliases without leaking null-like text. */
export const getItemSku = (itemValue: any): string => {
  const item = asRecord(itemValue);
  const sku = String(
    item.sku ?? item.itemSku ?? item.stockKeepingUnit ?? ""
  ).trim();
  return ["", "null", "undefined", "n/a"].includes(sku.toLowerCase())
    ? ""
    : sku;
};

/** Applies both document-level and item-level SKU visibility switches. */
export const shouldShowItemSku = (
  itemValue: any,
  invoiceSetting: any
): boolean => {
  const item = asRecord(itemValue);
  const documentVisible = optionalBoolean(invoiceSetting) ?? false;
  const itemVisible =
    optionalBoolean(item.showSku) ??
    optionalBoolean(item.showSkuInInvoice) ??
    true;
  return documentVisible && itemVisible && Boolean(getItemSku(item));
};

/** Resolves serial numbers from supported direct and batch item shapes. */
export const getItemSerialNumbers = (itemValue: any): string => {
  const item = asRecord(itemValue);
  const batchSerialNumbers = (
    Array.isArray(item.batchSummary) ? item.batchSummary : []
  ).flatMap((batchValue: any) => {
    const batch = asRecord(batchValue);
    const values =
      batch.serialNumbers ?? batch.serials ?? batch.inventorySerialNumbers;
    return asOptionalArray(values);
  });
  const directValues =
    item.serialNumbers ??
    item.serials ??
    item.inventorySerialNumbers ??
    item.serialNumber ??
    item.serialNo;
  const values = [...asOptionalArray(directValues), ...batchSerialNumbers];

  return [...new Set(values.map(serialNumberText).filter(Boolean))].join(", ");
};

/** Sums real line items without double-counting synthetic subtotal rows. */
export const summarizeItemQuantity = (itemsValue: any): number =>
  (Array.isArray(itemsValue) ? itemsValue : []).reduce((sum, itemValue) => {
    const item = asRecord(itemValue);
    if (item.isGroupItemTotalRow || item.isAdditionalCharge || item.group) {
      return sum;
    }

    const quantity = Number(item.quantity ?? item.qty ?? 0);
    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);

const fallbackCountryNames: Record<string, string> = {
  HK: "Hong Kong",
  IN: "India",
  US: "United States",
};

/** Converts an ISO 3166-1 alpha-2 country code to a readable country name. */
export const formatCountryName = (value: unknown): string => {
  const country = String(value ?? "").trim();
  if (!/^[a-z]{2}$/i.test(country)) return country;

  const countryCode = country.toUpperCase();
  const stableName = fallbackCountryNames[countryCode];
  if (stableName) return stableName;

  try {
    const { DisplayNames } = Intl as typeof Intl & {
      DisplayNames?: new (
        locales: string | string[],
        options: { type: "region" }
      ) => { of(code: string): string | undefined };
    };
    const displayName = DisplayNames
      ? new DisplayNames("en", { type: "region" }).of(countryCode)
      : undefined;

    if (displayName && displayName !== countryCode) return displayName;
  } catch {
    // Use the stable fallback below on runtimes without Intl.DisplayNames.
  }

  return country;
};

const uniqueTexts = (values: any[]): string[] => {
  const seen = new Set<string>();

  return values
    .map((value) => String(value ?? "").trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const partyLocationText = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value).trim();

  const location = asRecord(value);
  return String(
    location.name ??
      location.stateName ??
      location.label ??
      location.value ??
      location.code ??
      ""
  ).trim();
};

const partyStateText = (party: UnknownRecord): string => {
  const explicitState = partyLocationText(
    party.stateName ??
      party.state_name ??
      party.state ??
      party.province ??
      party.region
  );
  if (explicitState && !/^0?\d{1,2}$/.test(explicitState)) {
    return explicitState;
  }

  const gstState = partyLocationText(
    party.gstState ?? party.stateCode ?? explicitState
  );
  if (!gstState) return "";
  if (!/^0?\d{1,2}$/.test(gstState)) return gstState;

  return normalizePlaceOfSupply({
    billedTo: party,
    countryOfSupply: party.country,
    placeOfSupply: gstState,
  } as any);
};

/** Builds consistent party-address lines for every supported document type. */
export const getPartyAddressLines = (partyValue: any): string[] => {
  const party = asRecord(partyValue);
  const addressLines = uniqueTexts([
    party.building,
    party.street,
    party.address,
  ]);
  const locality = uniqueTexts([
    party.city,
    party.district,
    partyStateText(party),
    formatCountryName(party.country),
  ]).join(", ");
  const postalCode = String(party.pincode ?? party.zipCode ?? "").trim();
  const localityLine = [locality, postalCode].filter(Boolean).join(" ");

  return uniqueTexts([...addressLines, localityLine]);
};

const unitText = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value).trim();

  const unit = asRecord(value);
  return String(
    unit.value ??
      unit.code ??
      unit.symbol ??
      unit.name ??
      unit.label ??
      unit.unitName ??
      ""
  ).trim();
};

const configuredUnitText = (value: any, rawUnit: string): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") {
    const text = String(value).trim();
    return text === rawUnit ? "" : text;
  }

  const unit = asRecord(value);
  return String(
    unit.displayName ??
      unit.label ??
      unit.name ??
      unit.symbol ??
      unit.unitName ??
      unit.code ??
      (unit.value === rawUnit ? "" : unit.value) ??
      ""
  ).trim();
};

const findConfiguredUnit = (
  unitsValue: any,
  rawUnit: string,
  depth = 0
): string => {
  if (!unitsValue || depth > 3) return "";

  if (Array.isArray(unitsValue)) {
    const arrayMatch = unitsValue
      .map((entryValue) => {
        const entry = asRecord(entryValue);
        const identifiers = [
          entry._id,
          entry.id,
          entry.key,
          entry.value,
          entry.code,
          entry.unit,
        ].map((value) => String(value ?? "").trim());

        return identifiers.includes(rawUnit)
          ? configuredUnitText(entry, rawUnit)
          : "";
      })
      .find(Boolean);
    if (arrayMatch) return arrayMatch;
  }

  const units = asRecord(unitsValue);
  if (Object.prototype.hasOwnProperty.call(units, rawUnit)) {
    const displayValue = configuredUnitText(units[rawUnit], rawUnit);
    if (displayValue) return displayValue;
  }

  return (
    Object.entries(units)
      .map(([key, entryValue]) => {
        if (
          (typeof entryValue === "string" || typeof entryValue === "number") &&
          String(entryValue).trim() === rawUnit
        ) {
          return key;
        }

        const entry = asRecord(entryValue);
        const identifiers = [
          entry._id,
          entry.id,
          entry.key,
          entry.value,
          entry.code,
          entry.unit,
        ].map((value) => String(value ?? "").trim());
        if (identifiers.includes(rawUnit)) {
          return configuredUnitText(entry, rawUnit);
        }

        return entryValue && typeof entryValue === "object"
          ? findConfiguredUnit(entryValue, rawUnit, depth + 1)
          : "";
      })
      .find(Boolean) || ""
  );
};

const isOpaqueUnitKey = (value: string): boolean =>
  value.length >= 8 && /[a-z]/i.test(value) && /\d/.test(value);

/** Resolves custom unit keys through the business unit configuration. */
export const getItemUnit = (itemValue: any, invoiceValue?: any): string => {
  const item = asRecord(itemValue);
  const invoice = asRecord(invoiceValue);
  const rawUnit = unitText(item.unit);
  const unitConfigurations = [
    asRecord(asRecord(invoice.owner).configuration).units,
    asRecord(asRecord(invoice.business).configuration).units,
    asRecord(asRecord(invoice.ownerBusiness).configuration).units,
    asRecord(invoice.configuration).units,
    invoice.units,
  ];

  const configuredUnit = rawUnit
    ? unitConfigurations
        .map((units) => findConfiguredUnit(units, rawUnit))
        .find(Boolean)
    : "";
  if (configuredUnit) return configuredUnit;

  const fallbackUnit = unitText(item.unitName ?? item.uomName ?? item.uom);
  if (fallbackUnit) return fallbackUnit;

  return isOpaqueUnitKey(rawUnit) ? "" : rawUnit;
};

export const formatQuantityWithUnit = (
  itemValue: any,
  showUnit: any,
  invoiceValue?: any
): string => {
  const item = asRecord(itemValue);
  const quantity = item.quantity ?? item.qty ?? 0;
  const unit = getItemUnit(item, invoiceValue);

  return showUnit && unit ? `${quantity} ${unit}` : String(quantity);
};

/**
 * Formats every monetary value in Solvin with the invoice's configured
 * precision. Solvin defaults to two decimal places even for integer amounts.
 */
export const formatSolvinCurrency = (
  amount: any,
  invoiceValue?: any
): string => {
  const invoice = asRecord(invoiceValue);
  const subUnitLength = Number(invoice.subUnitLength ?? 2);
  const precision =
    Number.isInteger(subUnitLength) && subUnitLength >= 0 ? subUnitLength : 2;
  const currency = String(invoice.currency || invoice.businessCurrency || "INR")
    .trim()
    .toUpperCase();

  return formatCurrency(
    amount,
    currency === "RC" ? "USD" : currency,
    invoice.locale || invoice.businessLocale || "en-IN",
    precision,
    invoice.customCurrencySymbol
  ).replace(/\u00a0/g, " ");
};

/**
 * SR Trading uses the currency's standard minor unit for printed money. This
 * prevents a calculation precision (for example USD subUnitLength=4) from
 * leaking into customer-facing values while still supporting 0/3-decimal
 * currencies through Intl rather than a fixed decimal count.
 */
export const formatSrTradingCurrency = (
  amount: any,
  invoiceValue?: any
): string => {
  const invoice = asRecord(invoiceValue);
  const currency = String(invoice.currency || invoice.businessCurrency || "INR")
    .trim()
    .toUpperCase();
  const isoCurrency = currency === "RC" ? "USD" : currency;
  const locale = String(invoice.locale || invoice.businessLocale || "en-IN");
  let precision: number | undefined;

  try {
    precision = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: isoCurrency,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    precision = undefined;
  }

  return formatSolvinCurrency(amount, {
    ...invoice,
    subUnitLength:
      Number.isInteger(precision) && Number(precision) >= 0
        ? precision
        : invoice.subUnitLength,
  });
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[character] || character)
  );

const wrapCurrencyLabels = (
  formatted: string,
  symbolClassName = "solvin-currency-symbol"
): string => {
  const labelPattern = /[^\d.,\s()-]+/gu;
  let cursor = 0;
  const markup = Array.from(formatted.matchAll(labelPattern)).reduce(
    (result, match) => {
      const index = match.index ?? cursor;
      const precedingText = escapeHtml(formatted.slice(cursor, index));
      const currencyLabel = escapeHtml(match[0]);
      cursor = index + match[0].length;
      return `${result}${precedingText}<span class="${symbolClassName}">${currencyLabel}</span>`;
    },
    ""
  );

  return markup + escapeHtml(formatted.slice(cursor));
};

/**
 * Wraps the shared currency widget's formatted value so its actual symbol and
 * configured precision stay consistent in preview, paged, and Pageless PDFs.
 */
export const formatSolvinCurrencyMarkup = (
  amount: any,
  invoiceValue?: any
): string => {
  const formatted = formatSolvinCurrency(amount, invoiceValue);

  return `<span class="solvin-money">${wrapCurrencyLabels(formatted)}</span>`;
};

/**
 * Keeps SR Trading currency glyphs on a known PDF-safe font while preserving
 * the template's ISO-driven precision and locale-specific symbol placement.
 */
export const formatSrTradingCurrencyMarkup = (
  amount: any,
  invoiceValue?: any
): string => {
  const formatted = formatSrTradingCurrency(amount, invoiceValue);

  return `<span class="sr-money">${wrapCurrencyLabels(
    formatted,
    "sr-currency-symbol"
  )}</span>`;
};

// Shared print-fit helpers used by the Solvin template.
const COMPACT_PRINT_CLASS = "is-compact-print-table";
const MEASURING_PRINT_CLASS = "is-measuring-print-fit";
const FIT_TOLERANCE_PX = 1;

type MeasuredWidth = {
  clientWidth: number;
  scrollWidth: number;
  getBoundingClientRect: () => { width: number };
};

type TextRect = {
  top: number;
  width: number;
  height: number;
};

export const hasMultipleRenderedTextLines = (
  rects: Iterable<TextRect>
): boolean => {
  const lineTops = new Set(
    Array.from(rects)
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => Math.round(rect.top * 2) / 2)
  );

  return lineTops.size > 1;
};

const hasWrappedSolvinTableHeaders = (table: HTMLElement): boolean =>
  Array.from(table.querySelectorAll("thead th")).some((header) => {
    const range = table.ownerDocument.createRange();
    range.selectNodeContents(header);
    return hasMultipleRenderedTextLines(Array.from(range.getClientRects()));
  });

export const hasSolvinPrintTableOverflow = (
  wrapper: MeasuredWidth,
  table: MeasuredWidth
): boolean => {
  const availableWidth = Math.max(
    wrapper.clientWidth,
    wrapper.getBoundingClientRect().width
  );
  const requiredWidth = Math.max(
    table.scrollWidth,
    table.getBoundingClientRect().width
  );

  return (
    availableWidth > 0 && requiredWidth > availableWidth + FIT_TOLERANCE_PX
  );
};

export const updateSolvinPrintFit = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(".solvin-invoice").forEach((invoice) => {
    const wrapper = invoice.querySelector<HTMLElement>(".items-table-wrap");
    const table = invoice.querySelector<HTMLElement>(".items-table");

    invoice.classList.remove(COMPACT_PRINT_CLASS);
    if (!wrapper || !table) return;

    const hasWrappedHeaders = hasWrappedSolvinTableHeaders(table);
    invoice.classList.add(MEASURING_PRINT_CLASS);
    const shouldCompact =
      hasWrappedHeaders || hasSolvinPrintTableOverflow(wrapper, table);
    invoice.classList.remove(MEASURING_PRINT_CLASS);
    invoice.classList.toggle(COMPACT_PRINT_CLASS, shouldCompact);
  });
};

export const resetSolvinPrintFit = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(".solvin-invoice").forEach((invoice) => {
    invoice.classList.remove(COMPACT_PRINT_CLASS, MEASURING_PRINT_CLASS);
  });
};

export const registerSolvinPrintFit = (): void => {
  const state = window as typeof window & {
    solvinPrintFitRegistered?: boolean;
  };
  if (state.solvinPrintFitRegistered) return;

  state.solvinPrintFitRegistered = true;
  window.addEventListener("beforeprint", () => updateSolvinPrintFit());
  window.addEventListener("afterprint", () => resetSolvinPrintFit());

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", (event) => {
    if (event.matches) {
      updateSolvinPrintFit();
      return;
    }

    resetSolvinPrintFit();
  });
};
