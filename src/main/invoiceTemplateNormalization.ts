import { normalizeInvoicePayload } from "./invoicePayloadContract";
import { resolveTaxVisibility } from "../widgets/shared/taxVisibility";
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
  isCessColumn?: boolean;
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
  showUnitAsColumn: boolean;
  upiShrink: boolean;
  letterHeadOnFirstPage: boolean;
  footerOnLastPage: boolean;
  itemNameFullWidth: boolean;
  isDescriptionFullWidth: boolean;
  showTotals: boolean;
  showTotalsRow: boolean;
  showDueAmount: boolean;
  hideCurrencyCode: boolean;
  showStatusTagInPrint: boolean;
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
}

export interface NormalizedInvoiceTemplateState {
  invoice: FlattenedInvoicePayload;
  advanceOptions: UnknownRecord;
  pdfOptions: UnknownRecord;
  mapped: InvoiceTemplateMappedState;
  derived: InvoiceTemplateDerivedState;
}

const COLUMN_CLASS_MAP: Record<string, string> = {
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
  cessrate: "col-cess",
  cessamount: "col-cess",
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

const pickFirstValue = (...values: unknown[]): unknown =>
  values.find((value) => {
    if (value === null || value === undefined) {
      return false;
    }

    return !(typeof value === "string" && value.trim().length === 0);
  });

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

  return getNestedSummaryEntries(record, listKey).reduce<number>(
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
  const discountEnabled = Boolean(
    toNumberValue(
      pickFirstValue(finalTotal.discount, finalTotal.totalDiscount),
      0
    )
  );
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
  const showSkuInName = Boolean(advanceOptions.showSkuInInvoice);
  const rawUnitMode = toStringValue(
    pickFirstValue(
      advanceOptions.unitColumn,
      advanceOptions.unitDisplay,
      advanceOptions.showUnit
    ),
    "MERGE_QUANTITY"
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  const normalizedUnitMode = rawUnitMode.replace(/_/g, "");
  const showUnitSetting =
    pickFirstValue(
      advanceOptions.showUnitInInvoice,
      advanceOptions.showUnit
    ) === undefined
      ? undefined
      : Boolean(
          pickFirstValue(
            advanceOptions.showUnitInInvoice,
            advanceOptions.showUnit
          )
        );
  const hideUnitSetting =
    advanceOptions.hideUnit === undefined
      ? undefined
      : Boolean(advanceOptions.hideUnit);
  const unitHidden = hideUnitSetting === true || showUnitSetting === false;
  const explicitName =
    advanceOptions.showUnitInName === undefined
      ? undefined
      : Boolean(advanceOptions.showUnitInName);
  const explicitQuantity =
    advanceOptions.showUnitInQuantity === undefined
      ? undefined
      : Boolean(advanceOptions.showUnitInQuantity);
  const explicitColumn =
    pickFirstValue(
      advanceOptions.showUnitAsColumn,
      advanceOptions.showUnitColumn
    ) === undefined
      ? undefined
      : Boolean(
          pickFirstValue(
            advanceOptions.showUnitAsColumn,
            advanceOptions.showUnitColumn
          )
        );
  const showUnitInName =
    !unitHidden &&
    (explicitName === true ||
      (explicitQuantity !== true &&
        explicitColumn !== true &&
        explicitName !== false &&
        normalizedUnitMode.includes("NAME")));
  const showUnitAsColumn =
    !unitHidden &&
    !showUnitInName &&
    (explicitColumn === true ||
      (explicitColumn !== false &&
        (normalizedUnitMode.includes("SEPARATE") ||
          normalizedUnitMode.includes("COLUMN"))));
  const showUnitInQuantity =
    !unitHidden &&
    !showUnitInName &&
    !showUnitAsColumn &&
    explicitQuantity !== false &&
    (explicitQuantity === true ||
      normalizedUnitMode.includes("QUANTITY") ||
      normalizedUnitMode.includes("QTY") ||
      !["HIDE", "HIDDEN", "NONE", "DONOTSHOW", "OFF"].includes(
        normalizedUnitMode
      ));

  // Structural only — no `hideTaxes` and no export suppression. The item-table columns are
  // a property of the document's shape, so they must not move when a user toggles a
  // display setting; the totals rows apply both suppressions on top of this.
  const taxVisibility = resolveTaxVisibility({
    invoiceType,
    taxType,
    // `igst` is the document's inter-state boolean; `isIgst` never existed on a real
    // document and stays only as a fallback for a host on the older ceres contract.
    isInterState: pickFirstValue(invoice.igst, invoice.isIgst),
  });

  return {
    invoiceTemplate,
    pdfOptions,
    advanceOptions,
    isTaxInvoice,
    discountEnabled,
    taxType,
    showHsnColumn,
    taxVisibility,
    showClassificationColumn,
    showInlineHsn,
    showInlineClassification,
    showSkuInName,
    showUnitInName,
    showUnitInQuantity,
    showUnitAsColumn,
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
      const dataType = toStringValue(column.dataType);
      const fxReturnType = toStringValue(column.fxReturnType);

      let visible = true;
      if (key === "msic") {
        visible = false;
      } else if (key === "hsn") {
        visible = context.showHsnColumn;
      } else if (key === "classification") {
        visible = context.showClassificationColumn;
      } else if (key === "gstRate") {
        visible = context.isTaxInvoice;
      } else if (key === "discount") {
        visible = context.discountEnabled;
      } else if (key === "sgst" || key === "cgst") {
        visible = context.taxVisibility.showCgstSgst;
      } else if (key === "igst") {
        visible = context.taxVisibility.showIgst;
      } else if (key === "total") {
        visible = context.isTaxInvoice;
      }

      return {
        key,
        // `utgst` is the document field (talos/src/invoices.js:1454); `isUtgst` is the
        // deprecated ceres-only name no producer sends. Kept in step with
        // `mapped.visibility.isUtgst` below and with the widget's own label resolver
        // (src/widgets/shared/taxRowLabels.ts), so a template printing these headers cannot
        // disagree with one printing the totals block.
        label:
          key === "sgst" &&
          Boolean(pickFirstValue(invoice.utgst, invoice.isUtgst))
            ? "UTGST"
            : toStringValue(column.label),
        className: getColumnClass(key),
        isHidden: Boolean(column.isHidden) || !visible,
        dataType,
        fxReturnType,
        summarise: Boolean(column.summarise),
      };
    });
};

export const normalizeInvoiceTemplateState = (
  payload: InvoicePayloadInput
): NormalizedInvoiceTemplateState => {
  const invoice = normalizeInvoicePayload(payload);
  const context = getTemplateLayoutContext(invoice);
  const columns = normalizeInvoiceColumns(invoice, context);
  const irn = asRecord(invoice.irn);
  const upi = asRecord(invoice.upi);
  const irnCancelDate = toNonEmptyString(irn.CancelDate);
  // Root qrCode is the same IRN QR delivered by the Lydia host overlay, so the
  // CancelDate guard below applies to it equally.
  const irnQr = toNonEmptyString(pickFirstValue(invoice.qrCode, irn.qrCode));
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
  const isExpenditure = Boolean(invoice.isExpenditure);
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
    Boolean(paymentOptions.accountTransfer) &&
    hasValue(bankAccountNo);
  const showUpi =
    (!isExpenditure || invoiceAccepted === "ACCEPTED") &&
    Boolean(paymentOptions.upi) &&
    hasValue(upiId);
  const showTaxTable = ["TABLE", "BOTH"].includes(
    toStringValue(context.advanceOptions.taxSummaryView)
  );
  // The business toggle gates the section; the data check only avoids rendering an
  // empty table. The alias is checked first because it is what the Lydia live-update
  // bridge emits, so when both keys are present it carries the newer user action —
  // an explicit false from either key still hides the section.
  const hsnSummaryEnabled = Boolean(
    pickFirstValue(
      context.advanceOptions.showHsnSummary,
      context.advanceOptions.showHSNSummaryInInvoice
    )
  );
  const showHsnSummary =
    hsnSummaryEnabled &&
    getNestedSummaryEntries(invoice.hsnSummary, "hsnList").length > 0;
  const showSummaryCess =
    asArray(invoice.cesses).some((entry) =>
      Boolean(asRecord(entry).isApplied)
    ) &&
    (getInvoiceCessTotal(invoice) > 0 ||
      getSummaryCessAmount(invoice.taxSummary, "taxList") > 0 ||
      getSummaryCessAmount(invoice.hsnSummary, "hsnList") > 0);
  // Same predicate the item-table columns use, so a template gating cells on
  // mapped.visibility and headers on mapped.columns can never disagree.
  const { showIgst, showCgstSgst } = context.taxVisibility;

   const hideTaxes = Boolean(context.advanceOptions.hideTaxes);
   const showTotals = !Boolean(context.advanceOptions.hideTotals);
   const showTotalsRow =
     showTotals && Boolean(invoice.showTotalsRow ?? true);

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
        isUtgst: Boolean(pickFirstValue(invoice.utgst, invoice.isUtgst)),
        showTaxTable,
        showHsnSummary,
        showSummaryCess,
        showSku: context.showSkuInName,
        showHsn: context.showHsnColumn,
        showThumbnailAsColumn: Boolean(
          context.advanceOptions.showThumbnailAsColumn
        ),
        showInlineHsn: context.showInlineHsn,
        showInlineClassification: context.showInlineClassification,
        showSkuInName: context.showSkuInName,
        showUnitInName: context.showUnitInName,
        showUnitInQuantity: context.showUnitInQuantity,
        showUnitAsColumn: context.showUnitAsColumn,
        upiShrink: Boolean(asRecord(invoice.template).upiShrink),
        letterHeadOnFirstPage: Boolean(
          context.pdfOptions.letterHeadOnFirstPage
        ),
        footerOnLastPage: Boolean(context.pdfOptions.footerOnLastPage),
        itemNameFullWidth: Boolean(
          pickFirstValue(
            context.advanceOptions.itemNameFullWidth,
            invoice.showItemNameFullWidth
          )
        ),
        isDescriptionFullWidth: Boolean(
          pickFirstValue(
            context.advanceOptions.isDescriptionFullWidth,
            invoice.isDescriptionFullWidth
          )
        ),
        showTotals,
        showTotalsRow,
        showDueAmount: Boolean(invoice.showDueAmount),
        hideCurrencyCode: Boolean(
          context.advanceOptions.hideCurrencyCode
        ),
        showStatusTagInPrint: billType === "INVOICE" && status === "PAID",
        visibleColumnCount:
          columns.filter((column) => !column.isHidden).length + 1,
      },
    },
    derived: {
      showHsnColumn: context.showHsnColumn,
      showClassificationColumn: context.showClassificationColumn,
      showInlineHsn: context.showInlineHsn,
      showInlineClassification: context.showInlineClassification,
      showSkuInName: context.showSkuInName,
      showUnitInName: context.showUnitInName,
    },
  };
};
