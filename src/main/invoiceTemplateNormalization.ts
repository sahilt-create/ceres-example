import { normalizeInvoicePayload } from "./invoicePayloadContract";
import type {
  FlattenedInvoicePayload,
  InvoicePayloadInput,
} from "./invoicePayloadContract";

type UnknownRecord = Record<string, unknown>;

export interface InvoiceTemplateColumn {
  key: string;
  label: string;
  className: string;
  isHidden: boolean;
  dataType: string;
  fxReturnType: string;
  isCessColumn: boolean;
  summarise: boolean;
  semanticType?: "percentage" | "currency";
}

export interface InvoiceTemplateVisibility {
  shippedTo: boolean;
  shippedFrom: boolean;
  transport: boolean;
  showLogistics: boolean;
  singleLogistics: boolean;
  showBankAccount: boolean;
  showUpi: boolean;
  showBankUpiSection: boolean;
  contactStrip: boolean;
  showIgst: boolean;
  showCgstSgst: boolean;
  showTaxes: boolean;
  isUtgst: boolean;
  showTaxTable: boolean;
  showHsnSummary: boolean;
  showSummaryCess: boolean;
  showSku: boolean;
  showHsn: boolean;
  showThumbnailAsColumn: boolean;
  showInlineHsn: boolean;
  showInlineClassification: boolean;
  showSkuInName: boolean;
  showUnitInName: boolean;
  showUnitInQuantity: boolean;
  showTotals: boolean;
  showTotalsRow: boolean;
  showDueAmount: boolean;
  hideCurrencyCode: boolean;
  upiShrink: boolean;
  letterHeadOnFirstPage: boolean;
  footerOnLastPage: boolean;
  itemNameFullWidth: boolean;
  isDescriptionFullWidth: boolean;
  showStatusTagInPrint: boolean;
  showCountryOfSupply: boolean;
  showPlaceOfSupply: boolean;
  visibleColumnCount: number;
}

export interface InvoiceTemplateMappedState {
  qr: {
    top: string;
    upi: string;
  };
  upi: {
    id: string;
  };
  columns: InvoiceTemplateColumn[];
  irn: {
    isCancelled: boolean;
  };
  visibility: InvoiceTemplateVisibility;
}

export interface InvoiceTemplateDerivedState {
  showHsnColumn: boolean;
  showClassificationColumn: boolean;
  showInlineHsn: boolean;
  showInlineClassification: boolean;
  showSkuInName: boolean;
  showUnitInName: boolean;
  showUnitInQuantity: boolean;
}

export interface NormalizedInvoiceTemplateState {
  invoice: FlattenedInvoicePayload;
  advanceOptions: UnknownRecord;
  pdfOptions: UnknownRecord;
  mapped: InvoiceTemplateMappedState;
  derived: InvoiceTemplateDerivedState;
}

const COLUMN_CLASS_MAP: Record<string, string> = {
  sr: "col-index",
  srno: "col-index",
  sno: "col-index",
  rownumber: "col-index",
  index: "col-index",
  item: "col-item",
  name: "col-item",
  quantity: "col-qty",
  qty: "col-qty",
  rate: "col-rate",
  amount: "col-amount",
  discount: "col-discount",
  gstrate: "col-gst-rate",
  tax: "col-tax",
  igst: "col-igst",
  total: "col-total",
  hsn: "col-hsn-sac",
  cess: "col-cess",
  cessrate: "col-cess-rate",
  cessamount: "col-cess-amount",
};

const INDIA_GST_STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

const asRecord = (value: unknown): UnknownRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as UnknownRecord;
};

const asArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value;
};

const pickFirstValue = (...values: unknown[]): unknown => {
  return values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      (typeof value !== "string" || value.trim().length > 0)
  );
};

const toStringValue = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;
  }
  return fallback;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const getConfiguredFieldVisibility = (
  invoice: FlattenedInvoicePayload,
  key: string
): boolean | undefined => {
  const invoiceValueProps = asRecord(invoice.invoiceValueProps);
  const matchingKey = Object.keys(invoiceValueProps).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );
  if (!matchingKey) return undefined;

  const setting = invoiceValueProps[matchingKey];
  const directValue = toOptionalBoolean(setting);
  if (directValue !== undefined) return directValue;

  const settingRecord = asRecord(setting);
  return (
    toOptionalBoolean(settingRecord.visible) ??
    toOptionalBoolean(settingRecord.showInInvoice)
  );
};

const toNonEmptyString = (value: unknown): string | null => {
  const normalized = toStringValue(value);
  return normalized.length > 0 ? normalized : null;
};

const hasValue = (value: unknown): boolean => {
  const str = toStringValue(value);
  return str.length > 0 && str !== "null" && str !== "undefined";
};

const normalizeGstCode = (value: unknown): string => {
  const match = toStringValue(value).match(/^0?(\d{1,2})(?:\D|$)/);
  return match ? match[1].padStart(2, "0") : "";
};

const stateNameFromValue = (value: unknown): string => {
  const normalized = toStringValue(value);
  if (!normalized || /^\d{1,2}$/.test(normalized)) return "";

  const prefixedName = normalized.match(/^0?\d{1,2}\s*[-:]\s*(.+)$/);
  return toStringValue(prefixedName?.[1], normalized);
};

export const normalizeCountryOfSupply = (
  invoice: FlattenedInvoicePayload
): string =>
  toStringValue(
    pickFirstValue(invoice.countryOfSupply, asRecord(invoice.billedTo).country)
  );

export const normalizePlaceOfSupply = (
  invoice: FlattenedInvoicePayload
): string => {
  const billedTo = asRecord(invoice.billedTo);
  const placeOfSupply = toStringValue(
    pickFirstValue(
      invoice.placeOfSupply,
      invoice.pos,
      billedTo.gstState,
      billedTo.state,
      billedTo.stateCode
    )
  );

  const supplyCountry = normalizeCountryOfSupply(invoice).toUpperCase();
  const hasGstCode = /^0?\d{1,2}(?:\D|$)/.test(placeOfSupply);
  if (supplyCountry && supplyCountry !== "IN" && hasGstCode) {
    const destinationPlace = [billedTo.state, billedTo.city, supplyCountry]
      .map((value) => toStringValue(value))
      .find((value) => value && !/^0?\d{1,2}(?:\D|$)/.test(value));

    return destinationPlace || placeOfSupply;
  }

  if (!/^\d{1,2}$/.test(placeOfSupply)) return placeOfSupply;

  const code = normalizeGstCode(placeOfSupply);
  const billedToCode = normalizeGstCode(
    pickFirstValue(billedTo.stateCode, billedTo.gstState)
  );
  const billedToState =
    stateNameFromValue(billedTo.state) || stateNameFromValue(billedTo.gstState);

  if (billedToCode === code && billedToState) return billedToState;
  return INDIA_GST_STATE_NAMES[code] || placeOfSupply;
};

const getColumnClass = (key: string): string => {
  const normalizedKey = key.toLowerCase();
  return COLUMN_CLASS_MAP[normalizedKey] || `col-${normalizedKey}`;
};

const buildUpiPayload = (upiId: string): string => {
  return `upi://pay?pa=${upiId}`;
};

const hasTransportData = (value: unknown): boolean => {
  const transport = asRecord(value);
  const transporter = asRecord(transport.transporter);

  return (
    hasValue(transport.transport) ||
    hasValue(transport.challanDate) ||
    hasValue(transport.challanNumber) ||
    hasValue(transport.extraInformation) ||
    hasValue(transport.distance) ||
    hasValue(transport.vehicleNumber) ||
    hasValue(transport.vehicleType) ||
    hasValue(transport.transportMode) ||
    hasValue(transport.transactionType) ||
    hasValue(transport.subSupplyType) ||
    hasValue(pickFirstValue(transporter.name, transport.transporterName)) ||
    hasValue(pickFirstValue(transporter.transporterId, transport.transporterId))
  );
};

const getNestedSummaryEntries = (
  value: unknown,
  listKey: "taxList" | "hsnList"
): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return asArray(asRecord(value)[listKey]);
};

const getSummaryCessAmount = (
  value: unknown,
  listKey: "taxList" | "hsnList"
): number => {
  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => {
      const record = asRecord(entry);
      return (
        sum +
        toNumberValue(
          pickFirstValue(
            record.totalCessAmountValue,
            record.totalCessAmount,
            record.cessAmount,
            record.totalCess
          ),
          0
        )
      );
    }, 0);
  }

  const record = asRecord(value);
  const directAmount = toNumberValue(
    pickFirstValue(
      record.totalCessAmountValue,
      record.totalCessAmount,
      record.cessAmount,
      record.totalCess
    ),
    0
  );

  if (directAmount > 0) {
    return directAmount;
  }

  return getNestedSummaryEntries(record[listKey], listKey).reduce<number>(
    (sum, entry) => {
      const row = asRecord(entry);
      return (
        sum +
        toNumberValue(
          pickFirstValue(
            row.totalCessAmountValue,
            row.totalCessAmount,
            row.cessAmount,
            row.totalCess
          ),
          0
        )
      );
    },
    0
  );
};

const getInvoiceCessTotal = (invoice: FlattenedInvoicePayload): number => {
  const totals = asRecord(invoice.totals);
  const finalTotal = asRecord(invoice.finalTotal);
  const cessTotalRecord = asRecord(
    pickFirstValue(totals.cessTotal, finalTotal.cessTotal)
  );

  const recordSum = (
    Object.values(cessTotalRecord) as unknown[]
  ).reduce<number>((sum, value) => sum + toNumberValue(value, 0), 0);

  if (recordSum > 0) {
    return recordSum;
  }

  return toNumberValue(
    pickFirstValue(
      totals.totalCess,
      totals.cess,
      finalTotal.totalCess,
      finalTotal.cess
    ),
    0
  );
};

const getTemplateLayoutContext = (invoice: FlattenedInvoicePayload) => {
  const invoiceTemplate = asRecord(invoice.template);
  const pdfOptions = asRecord(
    pickFirstValue(invoiceTemplate.pdfOptions, invoice.pdfOptions)
  );
  const advanceOptions = asRecord(invoice.advanceOptions);
  const finalTotal = asRecord(invoice.finalTotal);
  const invoiceType = toStringValue(invoice.invoiceType);
  const taxType = toStringValue(invoice.taxType);
  const isTaxInvoice = invoiceType === "INVOICE";
  const igstTax = toBooleanValue(pickFirstValue(invoice.igst, invoice.isIgst));
  const discountEnabled = toBooleanValue(
    toNumberValue(
      pickFirstValue(finalTotal.discount, finalTotal.totalDiscount),
      0
    )
  );
  const hideTaxes = toBooleanValue(advanceOptions.hideTaxes);
  const hsnView = toStringValue(advanceOptions.hsnView, "DEFAULT");
  const ownerCountry =
    toStringValue(asRecord(invoice.owner).country) ||
    toStringValue(asRecord(invoice.billedBy).country);
  const templateName = toStringValue(
    pickFirstValue(
      invoiceTemplate.parentTemplate,
      invoiceTemplate.template,
      invoice.templateName,
      "default"
    ),
    "default"
  );
  const allowRenderHSN = [
    "classic",
    "crisp",
    "minimal",
    "simple",
    "minimal_v2",
    "enterprise",
  ].includes(templateName);

  const showHsnColumn =
    isTaxInvoice &&
    ownerCountry === "IN" &&
    taxType === "INDIA" &&
    (hsnView === "SPLIT" || (hsnView === "DEFAULT" && allowRenderHSN));
  const showClassificationColumn =
    ownerCountry === "MY" &&
    (hsnView === "SPLIT" || (hsnView === "DEFAULT" && allowRenderHSN));
  const showInlineHsn =
    isTaxInvoice &&
    taxType === "INDIA" &&
    (hsnView === "MERGE" || (hsnView === "DEFAULT" && !allowRenderHSN));
  const showInlineClassification =
    ownerCountry === "MY" &&
    (hsnView === "MERGE" || (hsnView === "DEFAULT" && !allowRenderHSN));
  const showSkuInName = toBooleanValue(advanceOptions.showSkuInInvoice);
  const unitColumn = toStringValue(
    advanceOptions.unitColumn,
    "MERGE_QUANTITY"
  ).toUpperCase();
  const showUnitInName = unitColumn === "MERGE_NAME";
  const showUnitInQuantity = unitColumn === "MERGE_QUANTITY";

  return {
    invoiceTemplate,
    pdfOptions,
    advanceOptions,
    isTaxInvoice,
    igstTax,
    discountEnabled,
    hideTaxes,
    taxType,
    showHsnColumn,
    showClassificationColumn,
    showInlineHsn,
    showInlineClassification,
    showSkuInName,
    showUnitInName,
    showUnitInQuantity,
  };
};

const normalizeInvoiceColumns = (
  invoice: FlattenedInvoicePayload,
  context: ReturnType<typeof getTemplateLayoutContext>
): InvoiceTemplateColumn[] => {
  return asArray(invoice.columns)
    .map((entry) => asRecord(entry))
    .map((column) => {
      const key = toStringValue(column.key);
      const normalizedKey = key.toLowerCase();
      const dataType = toStringValue(column.dataType);
      const fxReturnType = toStringValue(column.fxReturnType);
      const semanticTypeValue = toStringValue(
        column.semanticType
      ).toLowerCase();
      const semanticType = ["percentage", "currency"].includes(
        semanticTypeValue
      )
        ? (semanticTypeValue as "percentage" | "currency")
        : undefined;

      let visible = true;
      if (normalizedKey === "msic") {
        visible = false;
      } else if (normalizedKey === "hsn") {
        visible = context.showHsnColumn;
      } else if (normalizedKey === "classification") {
        visible = context.showClassificationColumn;
      } else if (["gstrate", "gst", "taxrate"].includes(normalizedKey)) {
        visible = context.isTaxInvoice && !context.hideTaxes;
      } else if (normalizedKey === "discount") {
        visible = context.discountEnabled;
      } else if (normalizedKey === "unit") {
        visible = !context.showUnitInName && !context.showUnitInQuantity;
      } else if (normalizedKey === "sgst" || normalizedKey === "cgst") {
        visible =
          context.isTaxInvoice &&
          !context.hideTaxes &&
          !context.igstTax &&
          context.taxType === "INDIA";
      } else if (normalizedKey === "igst") {
        visible =
          context.isTaxInvoice &&
          !context.hideTaxes &&
          (context.igstTax || context.taxType === "GLOBAL");
      } else if (normalizedKey === "total") {
        visible = context.isTaxInvoice;
      }

      const configuredVisibility = getConfiguredFieldVisibility(invoice, key);
      if (configuredVisibility === false) visible = false;

      return {
        key,
        label:
          normalizedKey === "sgst" &&
          toBooleanValue(pickFirstValue(invoice.utgst, invoice.isUtgst))
            ? "UTGST"
            : toStringValue(column.label),
        className: getColumnClass(key),
        isHidden: toBooleanValue(column.isHidden) || !visible,
        dataType,
        fxReturnType,
        isCessColumn: toBooleanValue(column.isCessColumn),
        summarise: toBooleanValue(column.summarise),
        semanticType,
      };
    });
};

export const normalizeInvoiceTemplateState = (
  payload: InvoicePayloadInput
): NormalizedInvoiceTemplateState => {
  const sourceInvoice = normalizeInvoicePayload(payload);
  const invoice = {
    ...sourceInvoice,
    countryOfSupply: normalizeCountryOfSupply(sourceInvoice),
    placeOfSupply: normalizePlaceOfSupply(sourceInvoice),
  };
  const context = getTemplateLayoutContext(invoice);
  const columns = normalizeInvoiceColumns(invoice, context);
  const irn = asRecord(invoice.irn);
  const upi = asRecord(invoice.upi);
  const irnCancelDate = toNonEmptyString(irn.CancelDate);
  const irnQr = toNonEmptyString(irn.qrCode);
  const topQr =
    (irnQr && !irnCancelDate ? irnQr : null) ??
    toNonEmptyString(invoice.zatcaQrCode) ??
    toNonEmptyString(invoice.lhdnQrCode) ??
    toNonEmptyString(invoice.documentQr) ??
    "";

  const upiId =
    toNonEmptyString(pickFirstValue(upi.upi, upi.vpa, upi.upiId)) ?? "";
  const upiQr =
    toNonEmptyString(pickFirstValue(upi.qr, upi.qrCode)) ??
    (upiId ? buildUpiPayload(upiId) : "");

  const billType = toStringValue(invoice.billType);
  const status = toStringValue(invoice.status);
  const isExpenditure = toBooleanValue(invoice.isExpenditure);
  const invoiceAccepted = toStringValue(invoice.invoiceAccepted);
  const paymentOptions = asRecord(invoice.paymentOptions);
  const bankAccount = asRecord(invoice.bankAccount);
  const bankAccountNo = toStringValue(
    pickFirstValue(bankAccount.accountNo, bankAccount.accountNumber)
  );
  const contact = asRecord(invoice.contact);
  const shippedTo = hasValue(asRecord(invoice.shippedTo).name);
  const shippedFrom = hasValue(asRecord(invoice.shippedFrom).name);
  const transport = hasTransportData(invoice.transportDetails);
  const showBankAccount =
    (!isExpenditure || invoiceAccepted === "ACCEPTED") &&
    toBooleanValue(paymentOptions.accountTransfer) &&
    hasValue(bankAccountNo);
  const showUpi =
    (!isExpenditure || invoiceAccepted === "ACCEPTED") &&
    toBooleanValue(paymentOptions.upi) &&
    hasValue(upiId);
  const hideTaxes = toBooleanValue(context.advanceOptions.hideTaxes);
  const showTaxTable =
    ["TABLE", "BOTH"].includes(
      toStringValue(context.advanceOptions.taxSummaryView)
    ) && !hideTaxes;
  const showHsnSummary =
    !hideTaxes &&
    getNestedSummaryEntries(invoice.hsnSummary, "hsnList").length > 0;
  const showSummaryCess =
    asArray(invoice.cesses).some((entry) =>
      toBooleanValue(asRecord(entry).isApplied)
    ) &&
    (getInvoiceCessTotal(invoice) > 0 ||
      getSummaryCessAmount(invoice.taxSummary, "taxList") > 0 ||
      getSummaryCessAmount(invoice.hsnSummary, "hsnList") > 0);
  const showIgst =
    !hideTaxes &&
    (toBooleanValue(pickFirstValue(invoice.igst, invoice.isIgst)) ||
      toStringValue(invoice.taxName) !== "GST");
  const showCgstSgst =
    !hideTaxes && !showIgst && toStringValue(invoice.taxName) === "GST";
  const showTotals = !toBooleanValue(context.advanceOptions.hideTotals);
  const showTotalsRow =
    showTotals && toBooleanValue(invoice.showTotalsRow, true);

  return {
    invoice,
    advanceOptions: context.advanceOptions,
    pdfOptions: context.pdfOptions,
    mapped: {
      qr: {
        top: topQr,
        upi: upiQr,
      },
      upi: {
        id: upiId,
      },
      columns,
      irn: {
        isCancelled: Boolean(irnCancelDate),
      },
      visibility: {
        shippedTo,
        shippedFrom,
        transport,
        showLogistics: shippedFrom || transport,
        singleLogistics:
          (shippedFrom && !transport) || (!shippedFrom && transport),
        showBankAccount,
        showUpi,
        showBankUpiSection:
          !["CREDITNOTE", "DEBITNOTE"].includes(billType) &&
          status !== "CANCELED" &&
          (showBankAccount || showUpi),
        contactStrip: hasValue(contact.email) || hasValue(contact.phone),
        showIgst,
        showCgstSgst,
        showTaxes: !hideTaxes,
        isUtgst: toBooleanValue(pickFirstValue(invoice.utgst, invoice.isUtgst)),
        showTaxTable,
        showHsnSummary,
        showSummaryCess,
        showSku: context.showSkuInName,
        showHsn: context.showHsnColumn,
        showThumbnailAsColumn: toBooleanValue(
          context.advanceOptions.showThumbnailAsColumn
        ),
        showInlineHsn: context.showInlineHsn,
        showInlineClassification: context.showInlineClassification,
        showSkuInName: context.showSkuInName,
        showUnitInName: context.showUnitInName,
        showUnitInQuantity: context.showUnitInQuantity,
        showTotals,
        showTotalsRow,
        showDueAmount: toBooleanValue(invoice.showDueAmount),
        hideCurrencyCode: toBooleanValue(
          context.advanceOptions.hideCurrencyCode
        ),
        upiShrink: toBooleanValue(asRecord(invoice.template).upiShrink),
        letterHeadOnFirstPage: toBooleanValue(
          context.pdfOptions.letterHeadOnFirstPage
        ),
        footerOnLastPage: toBooleanValue(context.pdfOptions.footerOnLastPage),
        itemNameFullWidth: toBooleanValue(
          pickFirstValue(
            context.advanceOptions.itemNameFullWidth,
            invoice.showItemNameFullWidth
          )
        ),
        isDescriptionFullWidth: toBooleanValue(
          pickFirstValue(
            context.advanceOptions.isDescriptionFullWidth,
            invoice.isDescriptionFullWidth
          )
        ),
        showStatusTagInPrint: billType === "INVOICE" && status === "PAID",
        showCountryOfSupply:
          hasValue(invoice.countryOfSupply) &&
          !toBooleanValue(context.advanceOptions.hideCountryOfSupply),
        showPlaceOfSupply:
          hasValue(invoice.placeOfSupply) &&
          !toBooleanValue(context.advanceOptions.hidePlaceOfSupply),
        visibleColumnCount: columns.filter((column) => !column.isHidden).length,
      },
    },
    derived: {
      showHsnColumn: context.showHsnColumn,
      showClassificationColumn: context.showClassificationColumn,
      showInlineHsn: context.showInlineHsn,
      showInlineClassification: context.showInlineClassification,
      showSkuInName: context.showSkuInName,
      showUnitInName: context.showUnitInName,
      showUnitInQuantity: context.showUnitInQuantity,
    },
  };
};
