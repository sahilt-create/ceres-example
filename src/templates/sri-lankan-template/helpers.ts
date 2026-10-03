import { computeHsnSummary } from "../../widgets/hsn-summary/utils";
import { computePaymentColumns } from "../../widgets/payment-table/utils";
import { computeTaxSummary } from "../../widgets/tax-summary/utils";

// ---- Payload contract (template-local copy) ----

interface CeresTemplatePayload {
  invoice: InvoiceData;
  ownerBusiness: BusinessData;
  store?: {
    asideCollapsed: boolean;
  };
  business?: BusinessData;
  payUrl?: string;
  hideEarlyPay?: boolean;
  template?: string;
  showExpenseNumber?: boolean;
  isEarlyPayApplicable?: boolean;
  showItemNameFullWidth?: boolean;
  invoiceValueProps?: Record<
    string,
    | { visible?: boolean | string; showInInvoice?: boolean | string }
    | boolean
    | string
    | number
  >;
  ownerTimeZone?: string;
  businessTimeZone?: string;
  showBankAccount?: boolean;
  showUpi?: boolean;
  businessLocale?: string;
  businessCurrency?: string;
  isBusinessUser?: boolean;
  hideHashInDocumentNumber?: boolean;
  showPaymentsTable?: boolean;
  showDueAmount?: boolean | string | number;
  isPublicView?: boolean;
  isDescriptionFullWidth?: boolean | string | number;
  showDescriptionInFullWidth?: boolean | string | number;
  irnPosition?: "ABOVE_LINEITEMS" | "BELOW_LINEITEMS" | string;
  showStockSummary?: boolean;
  showVendorBankAccount?: boolean;
  defaultBatchColumns?: Array<{
    key: string;
    label: string;
    system?: boolean;
    isHidden?: boolean;
  }>;
  query?: Record<string, string>;
  copy?: string;
  ewayConfig?: EwayConfig;
  einvoiceConfig?: EinvoiceConfig;
}

interface InvoicePdfOptions {
  letterHeadOnFirstPage?: boolean;
  footerOnLastPage?: boolean;
  [key: string]: unknown;
}

interface InvoiceTemplateConfig {
  parentTemplate?: string;
  template?: string;
  upiShrink?: boolean;
  pdfOptions?: InvoicePdfOptions;
  [key: string]: unknown;
}

interface InvoiceAdvanceOptions {
  hideTaxes?: boolean;
  hideTotals?: boolean;
  hideCurrencyCode?: boolean;
  showHsnSummary?: boolean | string | number;
  showHSNSummaryInInvoice?: boolean | string | number;
  showSerialNumbersInDescription?: boolean | string | number;
  reverseCharge?: boolean;
  taxSummaryView?: "DETAILED" | "SUMMARY" | string;
  showSkuInInvoice?: boolean | string | number;
  showThumbnailAsColumn?: boolean;
  hideGroupSubTotal?: boolean;
  unitColumn?: string;
  unitDisplay?: string;
  showUnit?: boolean | string | number;
  showUnitInInvoice?: boolean | string | number;
  hideUnit?: boolean | string | number;
  showUnitInName?: boolean | string | number;
  showUnitInQuantity?: boolean | string | number;
  showUnitAsColumn?: boolean | string | number;
  showUnitColumn?: boolean | string | number;
  hsnView?: string;
  itemNameFullWidth?: boolean;
  isDescriptionFullWidth?: boolean | string | number;
  showDescriptionInFullWidth?: boolean | string | number;
  showCountryOfSupply?: boolean | string | number;
  hideCountryOfSupply?: boolean | string | number;
  showPlaceOfSupply?: boolean | string | number;
  hidePlaceOfSupply?: boolean | string | number;
  [key: string]: unknown;
}

interface InvoicePaymentOptions {
  accountTransfer?: boolean;
  upi?: boolean;
  vendorAccountTransfer?: boolean;
  [key: string]: unknown;
}

interface InvoiceData {
  _id: string;
  invoiceValueProps?: CeresTemplatePayload["invoiceValueProps"];
  billType: string;
  isExpenditure?: boolean;
  status: "DRAFT" | "UNPAID" | "PAID" | "PARTIAL" | "CANCELED" | string;
  isRemoved?: boolean;
  isOverdue?: boolean;
  invoiceNumber: string;
  expenseNumber?: string;
  expenseDate?: string | Date;
  creditNoteNumber?: string;
  creditNoteDate?: string | Date;
  debitNoteNumber?: string;
  debitNoteDate?: string | Date;
  salesOrderNumber?: string;
  salesOrderDate?: string | Date;
  orderNumber?: string;
  purchaseOrderNumber?: string;
  purchaseOrderDate?: string | Date;
  documentNumber?: string;
  documentDate?: string | Date;
  quotationNumber?: string;
  dueDate?: string | Date;
  invoiceDate?: string | Date;
  invoiceTitle?: string;
  invoiceSubTitle?: string;
  currency: string;
  businessLocale?: string;
  subUnitLength?: number;
  customCurrencySymbol?: string;
  showItemNameFullWidth?: boolean;
  isDescriptionFullWidth?: boolean | string | number;
  showDescriptionInFullWidth?: boolean | string | number;
  showCountryOfSupply?: boolean | string | number;
  hideCountryOfSupply?: boolean | string | number;
  showPlaceOfSupply?: boolean | string | number;
  hidePlaceOfSupply?: boolean | string | number;
  billedBy?: BillerDetails;
  billedTo?: BillerDetails;
  shippedFrom?: BillerDetails;
  shippedTo?: BillerDetails;
  items?: LineItem[];
  taxSummary?: TaxSummary | TaxSummary[];
  hsnSummary?: HsnSummary | HsnSummary[];
  additionalCharges?: AdditionalCharge[];
  extraTotalFields?:
    | Array<{
        _id?: string;
        key?: string;
        label?: string;
        name?: string;
        value?: any;
        defaultValue?: any;
        showInInvoice?: boolean;
        params?: { showInInvoice?: boolean; [key: string]: any };
        [key: string]: any;
      }>
    | Record<string, any>;
  cesses?: CessCharge[];
  latePaymentFee?: {
    enabled?: boolean;
    showInInvoice?: boolean;
    isApplied?: boolean;
    when?: number;
    finalAmount?: number;
  };
  allPayments?: Payment[];
  payments?: Payment[];
  columns?: ColumnDef[];
  subTotal: number;
  discount?: number;
  toPay?: number | { full: number; [key: string]: any };
  finalTotal: Record<string, any>;
  totals?: Record<string, any>;
  balance?: {
    paid?: number | string;
    due?: number | string;
    transactionCharge?: number | string;
    settledAmount?: number | string;
    tds?: number | string;
    credit?: number | string;
    [key: string]: any;
  };
  showDueAmount?: boolean | string | number;
  taxType?: string;
  taxName?: string;
  isIgst?: boolean;
  isUtgst?: boolean;
  igst?: number;
  cgst?: number;
  sgst?: number;
  utgst?: number;
  irn?: IrnDetails;
  notes?: string;
  hideNotes?: boolean | string | number;
  showNotes?: boolean | string | number;
  showNotesInInvoice?: boolean | string | number;
  notesShowInInvoice?: boolean | string | number;
  terms?: Array<{ label: string; terms: string[] }>;
  attachments?: string[];
  footers?: Array<{ _id: string; label: string; value: string }>;
  customFields?: CustomFieldValue[];
  customHeaders?: Array<{ label: string; value: string; [key: string]: any }>;
  customFooters?: Array<{
    label: string;
    value: string;
    defaultValue?: string;
    [key: string]: any;
  }>;
  customLabels?: Record<string, string>;
  contact?: { email?: string; phone?: string; [key: string]: any };
  owner?: BusinessData;
  invoiceAccepted?: string;
  roundOffQuantity?: boolean;
  roundOffRate?: boolean;
  showTotalsRow?: boolean;
  templateName?: string;
  transportDetails?: TransportDetails;
  bankAccount?: BankDetails;
  upi?: UpiDetails;
  signature?: string;
  advanceOptions?: InvoiceAdvanceOptions;
  paymentOptions?: InvoicePaymentOptions;
  reminders?: { sent?: boolean; [key: string]: any };
  creditNoteStatus?: string;
  linkedInvoices?: Array<any>;
  documentReason?: string;
  countryOfSupply?: string;
  placeOfSupply?: string;
  pos?: string;
  invoiceType?: string;
  invoiceDateUserInput?: string;
  ownerOffset?: string;
  letterHead?: string;
  letterHeadFooter?: string;
  showBranding?: boolean;
  template?: InvoiceTemplateConfig;
  pdfOptions?: InvoicePdfOptions;
  zatcaQrCode?: string;
  lhdnQrCode?: string;
  documentQr?: string;
}

interface BusinessData {
  _id: string;
  name?: string;
  country?: string;
  configuration?: {
    units?: any;
    einvoice?: any;
    eway?: any;
    indexedCustomFields?: any;
    [key: string]: any;
  };
  _systemMeta?: {
    indexedFieldsEnabled?: boolean;
    showExtraIndexedField?: boolean;
    [key: string]: any;
  };
}

interface BillerDetails {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  building?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  stateCode?: string;
  gstState?: string;
  country?: string;
  zipCode?: string;
  pincode?: string;
  gstin?: string;
  panNumber?: string;
  trnNumber?: string;
  tinNumber?: string;
  vatNumber?: string;
  vatLabel?: string;
  sstNumber?: string;
  emailShowInInvoice?: boolean;
  phoneShowInInvoice?: boolean;
  fieldVisibility?: Record<string, boolean>;
  logo?: string;
  additionalIds?: Array<{
    _id?: string;
    label: string;
    value: string;
    showInInvoice?: boolean;
  }>;
  customFields?: Array<{
    label: string;
    value: string;
    params?: { showInInvoice?: boolean; [key: string]: any };
  }>;
  customHeaders?: Array<{ label: string; value: string }>;
}

interface LineItem {
  _id: string;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  amount: number;
  subTotal?: number;
  discount?: number;
  hsn?: string;
  images?: string[];
  originalImages?: string[];
  thumbnail?: string;
  igst?: number;
  cgst?: number;
  sgst?: number;
  utgst?: number;
  cessAmount?: number;
  taxAmount?: number;
  gstRate?: number | string;
  taxRate?: number | string;
  tax?: number;
  group?: boolean;
  isGroupItemTotalRow?: boolean;
  isAdditionalCharge?: boolean;
  sku?: string;
  showSku?: boolean | string | number;
  unit?: string;
  classification?: string;
  inventoryTxn?: string;
  custom?: Record<string, any>;
  batchSummary?: Array<{
    _id?: string;
    itemName?: string;
    batchName?: string;
    quantity: number;
    manufacturingDate?: string;
    expiryDate?: string;
    warehouse?: string;
    warehouseName?: string;
  }>;
  customFields?: CustomFieldValue[];
}

interface AdditionalCharge {
  _id: string;
  name?: string;
  label?: string;
  amount: number;
  multiplier?: number;
  amountType?: string;
  tax?: number;
  taxAmount?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  utgst?: number;
  hsn?: string;
}

interface CessCharge {
  _id: string;
  amount?: number;
  name?: string;
  cessKey?: string;
  cessAmountKey?: string;
  cessName?: string;
  isApplied?: boolean;
}

interface TaxSummary {
  tax: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  utgst: number;
  cessAmount?: number;
}

interface HsnSummary extends TaxSummary {
  hsn: string;
}

interface CustomFieldValue {
  _id?: string;
  label: string;
  name?: string;
  value: any;
  dataType: string;
  params?: {
    showInInvoice?: boolean;
    currency?: string;
    [key: string]: any;
  };
}

interface IrnDetails {
  Irn?: string;
  AckNo?: string;
  AckDt?: string;
  CancelDate?: string;
  EwbNo?: string;
  EwbDt?: string;
  EwbValidTill?: string;
  ewayCancelDate?: string;
  qrCode?: string;
}

interface EinvoiceConfig {
  irnNumber?: boolean;
  irnAcknowledgementNumber?: boolean;
  irnAcknowledgementDate?: boolean;
  irnCancelledDate?: boolean;
}

interface EwayConfig {
  billNumber?: boolean;
  billDate?: boolean;
  billValidTillDate?: boolean;
  billCancelledDate?: boolean;
}

interface TransportDetails {
  transport?: string;
  transportMode?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  challanNumber?: string;
  challanDate?: string;
  distance?: number | string;
  transactionType?: string;
  subSupplyType?: string;
  extraInformation?: string;
  transporterId?: string;
  transporterName?: string;
  transporter?: {
    name?: string;
    transporterId?: string;
  };
}

interface BankDetails {
  name?: string;
  accountHolderName?: string;
  accountNo?: string;
  accountNumber?: string;
  ifsc?: string;
  ifscCode?: string;
  iban?: string;
  swift?: string;
  swiftCode?: string;
  accountType?: string;
  bank?: string;
  bankName?: string;
  sortCode?: string;
  branch?: string;
  country?: string;
  customLabels?: Record<string, string>;
  customFields?: CustomFieldValue[];
}

interface UpiDetails {
  upiId?: string;
  upi?: string;
  vpa?: string;
  qrCode?: string;
  qr?: string;
}

interface Payment {
  paymentDate?: string;
  date?: string;
  createdAt?: string;
  paymentMethod?: string;
  mode?: string;
  method?: string;
  amount?: number | string;
  status?: string;
}

interface ColumnDef {
  key: string;
  label: string;
  dataType?: string;
  fxReturnType?: string;
  semanticType?: "percentage" | "currency";
  isCessColumn?: boolean;
  summarise?: boolean;
  isHidden?: boolean;
}

interface FlattenedInvoicePayload extends InvoiceData {
  business?: BusinessData;
  ownerBusiness?: BusinessData;
  store?: CeresTemplatePayload["store"];
  payUrl?: string;
  hideEarlyPay?: boolean;
  showExpenseNumber?: boolean;
  isEarlyPayApplicable?: boolean;
  showItemNameFullWidth?: boolean;
  invoiceValueProps?: CeresTemplatePayload["invoiceValueProps"];
  ownerTimeZone?: string;
  businessTimeZone?: string;
  showBankAccount?: boolean;
  showUpi?: boolean;
  businessLocale?: string;
  businessCurrency?: string;
  isBusinessUser?: boolean;
  hideHashInDocumentNumber?: boolean;
  showPaymentsTable?: boolean;
  showDueAmount?: boolean | string | number;
  isPublicView?: boolean;
  isDescriptionFullWidth?: boolean | string | number;
  irnPosition?: CeresTemplatePayload["irnPosition"];
  showStockSummary?: boolean;
  showVendorBankAccount?: boolean;
  defaultBatchColumns?: CeresTemplatePayload["defaultBatchColumns"];
  query?: Record<string, string>;
  copy?: string;
  ewayConfig?: EwayConfig;
  einvoiceConfig?: EinvoiceConfig;
}

type InvoicePayloadInput = CeresTemplatePayload | FlattenedInvoicePayload;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

const isWrappedInvoicePayload = (
  payload: InvoicePayloadInput
): payload is CeresTemplatePayload => {
  return isRecord(payload) && isRecord(payload.invoice);
};

const normalizeTemplateConfig = (
  templateName: CeresTemplatePayload["template"]
): InvoiceTemplateConfig | undefined => {
  if (typeof templateName !== "string") {
    return undefined;
  }

  const normalizedTemplateName = templateName.trim();
  if (!normalizedTemplateName) {
    return undefined;
  }

  return {
    template: normalizedTemplateName,
    parentTemplate: normalizedTemplateName,
  };
};

const normalizeInvoicePayload = (
  payload: InvoicePayloadInput
): FlattenedInvoicePayload => {
  if (!isWrappedInvoicePayload(payload)) {
    return payload;
  }

  return {
    ...payload.invoice,
    business: payload.business,
    ownerBusiness: payload.ownerBusiness,
    store: payload.store,
    payUrl: payload.payUrl,
    hideEarlyPay: payload.hideEarlyPay,
    showExpenseNumber: payload.showExpenseNumber,
    isEarlyPayApplicable: payload.isEarlyPayApplicable,
    showItemNameFullWidth:
      payload.showItemNameFullWidth ?? payload.invoice.showItemNameFullWidth,
    invoiceValueProps:
      payload.invoiceValueProps ?? payload.invoice.invoiceValueProps,
    ownerTimeZone: payload.ownerTimeZone,
    businessTimeZone: payload.businessTimeZone,
    showBankAccount: payload.showBankAccount,
    showUpi: payload.showUpi,
    businessLocale: payload.businessLocale ?? payload.invoice.businessLocale,
    businessCurrency: payload.businessCurrency,
    isBusinessUser: payload.isBusinessUser,
    hideHashInDocumentNumber: payload.hideHashInDocumentNumber,
    showPaymentsTable: payload.showPaymentsTable,
    showDueAmount: payload.showDueAmount ?? payload.invoice.showDueAmount,
    isPublicView: payload.isPublicView,
    isDescriptionFullWidth:
      payload.showDescriptionInFullWidth ??
      payload.isDescriptionFullWidth ??
      payload.invoice.showDescriptionInFullWidth ??
      payload.invoice.isDescriptionFullWidth,
    irnPosition: payload.irnPosition,
    showStockSummary: payload.showStockSummary,
    showVendorBankAccount: payload.showVendorBankAccount,
    defaultBatchColumns: payload.defaultBatchColumns,
    query: payload.query,
    copy: payload.copy,
    ewayConfig: payload.ewayConfig,
    einvoiceConfig: payload.einvoiceConfig,
    template:
      payload.invoice.template ?? normalizeTemplateConfig(payload.template),
  };
};

// ---- Template state normalization (template-local copy) ----

type NormalizedRecord = Record<string, unknown>;

interface InvoiceTemplateColumn {
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

interface InvoiceTemplateVisibility {
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

interface InvoiceTemplateMappedState {
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

interface InvoiceTemplateDerivedState {
  showHsnColumn: boolean;
  showClassificationColumn: boolean;
  showInlineHsn: boolean;
  showInlineClassification: boolean;
  showSkuInName: boolean;
  showUnitInName: boolean;
  showUnitInQuantity: boolean;
  showUnitAsColumn: boolean;
}

interface NormalizedInvoiceTemplateState {
  invoice: FlattenedInvoicePayload;
  advanceOptions: NormalizedRecord;
  pdfOptions: NormalizedRecord;
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

const asNormalizedRecord = (value: unknown): NormalizedRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as NormalizedRecord;
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
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

const getConfiguredFieldVisibility = (
  invoice: FlattenedInvoicePayload,
  key: string
): boolean | undefined => {
  const invoiceValueProps = asNormalizedRecord(invoice.invoiceValueProps);
  const matchingKey = Object.keys(invoiceValueProps).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );
  if (!matchingKey) return undefined;

  const setting = invoiceValueProps[matchingKey];
  const directValue = toOptionalBoolean(setting);
  if (directValue !== undefined) return directValue;

  const settingRecord = asNormalizedRecord(setting);
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

const resolvePopulatedFieldVisibility = (
  invoice: FlattenedInvoicePayload,
  advanceOptions: NormalizedRecord,
  field: "countryOfSupply" | "placeOfSupply"
): boolean => {
  if (!hasValue(invoice[field])) return false;

  const suffix =
    field === "countryOfSupply" ? "CountryOfSupply" : "PlaceOfSupply";
  const configured = getConfiguredFieldVisibility(invoice, field);
  const shown = toOptionalBoolean(
    advanceOptions[`show${suffix}`] ?? invoice[`show${suffix}`]
  );
  const hidden = toOptionalBoolean(
    advanceOptions[`hide${suffix}`] ?? invoice[`hide${suffix}`]
  );

  return configured ?? shown ?? (hidden === undefined ? true : !hidden);
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

const normalizeCountryOfSupply = (invoice: FlattenedInvoicePayload): string =>
  toStringValue(
    pickFirstValue(
      invoice.countryOfSupply,
      asNormalizedRecord(invoice.billedTo).country
    )
  );

const normalizePlaceOfSupply = (invoice: FlattenedInvoicePayload): string => {
  const billedTo = asNormalizedRecord(invoice.billedTo);
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
  const transport = asNormalizedRecord(value);
  const transporter = asNormalizedRecord(transport.transporter);

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

  return asArray(asNormalizedRecord(value)[listKey]);
};

const getSummaryCessAmount = (
  value: unknown,
  listKey: "taxList" | "hsnList"
): number => {
  if (Array.isArray(value)) {
    return value.reduce((sum, entry) => {
      const record = asNormalizedRecord(entry);
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

  const record = asNormalizedRecord(value);
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
      const row = asNormalizedRecord(entry);
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
  const totals = asNormalizedRecord(invoice.totals);
  const finalTotal = asNormalizedRecord(invoice.finalTotal);
  const cessTotalRecord = asNormalizedRecord(
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
  const invoiceTemplate = asNormalizedRecord(invoice.template);
  const pdfOptions = asNormalizedRecord(
    pickFirstValue(invoiceTemplate.pdfOptions, invoice.pdfOptions)
  );
  const advanceOptions = asNormalizedRecord(invoice.advanceOptions);
  const finalTotal = asNormalizedRecord(invoice.finalTotal);
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
    toStringValue(asNormalizedRecord(invoice.owner).country) ||
    toStringValue(asNormalizedRecord(invoice.billedBy).country);
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
  const showUnitSetting = toOptionalBoolean(
    pickFirstValue(advanceOptions.showUnitInInvoice, advanceOptions.showUnit)
  );
  const hideUnitSetting = toOptionalBoolean(advanceOptions.hideUnit);
  const unitHidden = hideUnitSetting === true || showUnitSetting === false;
  const explicitName = toOptionalBoolean(advanceOptions.showUnitInName);
  const explicitQuantity = toOptionalBoolean(advanceOptions.showUnitInQuantity);
  const explicitColumn = toOptionalBoolean(
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
    showUnitAsColumn,
  };
};

const normalizeInvoiceColumns = (
  invoice: FlattenedInvoicePayload,
  context: ReturnType<typeof getTemplateLayoutContext>
): InvoiceTemplateColumn[] => {
  return asArray(invoice.columns)
    .map((entry) => asNormalizedRecord(entry))
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
        visible = context.showUnitAsColumn;
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

const normalizeInvoiceTemplateState = (
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
  const irn = asNormalizedRecord(invoice.irn);
  const upi = asNormalizedRecord(invoice.upi);
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
  const paymentOptions = asNormalizedRecord(invoice.paymentOptions);
  const bankAccount = asNormalizedRecord(invoice.bankAccount);
  const bankAccountNo = toStringValue(
    pickFirstValue(bankAccount.accountNo, bankAccount.accountNumber)
  );
  const contact = asNormalizedRecord(invoice.contact);
  const shippedTo = hasValue(asNormalizedRecord(invoice.shippedTo).name);
  const shippedFrom = hasValue(asNormalizedRecord(invoice.shippedFrom).name);
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
      toBooleanValue(asNormalizedRecord(entry).isApplied)
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
        showUnitAsColumn: context.showUnitAsColumn,
        showTotals,
        showTotalsRow,
        showDueAmount: toBooleanValue(invoice.showDueAmount),
        hideCurrencyCode: toBooleanValue(
          context.advanceOptions.hideCurrencyCode
        ),
        upiShrink: toBooleanValue(
          asNormalizedRecord(invoice.template).upiShrink
        ),
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
            context.advanceOptions.showDescriptionInFullWidth,
            context.advanceOptions.isDescriptionFullWidth,
            invoice.showDescriptionInFullWidth,
            invoice.isDescriptionFullWidth
          )
        ),
        showStatusTagInPrint: billType === "INVOICE" && status === "PAID",
        showCountryOfSupply: resolvePopulatedFieldVisibility(
          invoice,
          context.advanceOptions,
          "countryOfSupply"
        ),
        showPlaceOfSupply: resolvePopulatedFieldVisibility(
          invoice,
          context.advanceOptions,
          "placeOfSupply"
        ),
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
      showUnitAsColumn: context.showUnitAsColumn,
    },
  };
};

// ---- Currency formatting (template-local copy) ----

const SPECIAL_SYMBOLS: Record<string, string> = {
  SLE: "SLE",
  SAR: "⃁",
};

function isHbOptions(val: any): boolean {
  return (
    val != null && typeof val === "object" && "hash" in val && "data" in val
  );
}

function formatCurrency(
  number?: any,
  currency?: any,
  locale?: any,
  subUnitLength?: any,
  customCurrencySymbol?: any
): string {
  // When called directly by handlebars-loader, the HB options object is passed as `currency`.
  // Detect this and extract the real currency/locale values from data.root or ceresInvoiceData.
  if (isHbOptions(currency)) {
    const root =
      currency?.data?.root ||
      (typeof window !== "undefined" && (window as any).ceresInvoiceData) ||
      {};
    customCurrencySymbol = root.customCurrencySymbol ?? null;
    subUnitLength = root.subUnitLength ?? null;
    locale = root.locale;
    currency = root.currency;
  }

  let c = parseFloat(number);
  const localString = typeof locale === "string" && locale ? locale : "en-IN";
  if (!c) c = 0;

  const resolvedCurrency =
    typeof currency === "string" && currency ? currency : "INR";
  const currencySymbol =
    typeof customCurrencySymbol === "string" && customCurrencySymbol
      ? customCurrencySymbol
      : SPECIAL_SYMBOLS[resolvedCurrency] || null;

  if (resolvedCurrency === "RC") {
    return `🅲 ${c.toLocaleString(localString, {})}`;
  }

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency: resolvedCurrency,
  };

  if (Number.isInteger(c)) {
    formatOptions.minimumFractionDigits = 0;
  }

  if (typeof subUnitLength === "number" && Number.isInteger(subUnitLength)) {
    formatOptions.minimumFractionDigits = subUnitLength;
    formatOptions.maximumFractionDigits = subUnitLength;
  }

  let result: string;
  try {
    result = Math.abs(c).toLocaleString(localString, formatOptions);
  } catch (_) {
    result = `${resolvedCurrency} ${Math.abs(c).toFixed(2)}`;
  }

  if (currencySymbol) {
    const numberMatch = /[\d,. ]+/;
    const matchedElements = result.match(numberMatch);
    /* istanbul ignore else */
    if (matchedElements) {
      result = `${currencySymbol} ${matchedElements.join("").trim()}`;
    }
  }

  if (c < 0) return `(${result})`;
  return result;
}

type UnknownRecord = Record<string, any>;

const ROW_NUMBER_KEYS = new Set(["sr", "srno", "sno", "rownumber", "index"]);

/** The enabled display-property profile supplied for the Solvin template. */
const SOLVIN_DISPLAY_PROPERTIES = Object.freeze({
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

const isRealLineItem = (itemValue: any): boolean => {
  const item = asRecord(itemValue);
  return !item.isGroupItemTotalRow && !item.isAdditionalCharge && !item.group;
};

const mapCessRows = (invoice: UnknownRecord) => {
  const finalTotal = asRecord(invoice.finalTotal);
  const invoiceTotals = asRecord(invoice.totals);
  const finalCessTotal = asRecord(finalTotal.cessTotal);
  const invoiceCessTotal = asRecord(invoiceTotals.cessTotal);
  const items = Array.isArray(invoice.items)
    ? invoice.items.filter(isRealLineItem)
    : [];

  return collectionRecords(invoice.cesses)
    .filter(
      (cess) =>
        (optionalBooleanValue(cess.isApplied) ?? true) &&
        optionalBooleanValue(cess.isArchived) !== true
    )
    .map((cess) => {
      const amountKey = firstText(cess.cessAmountKey, cess.amountKey);
      const cessKey = firstText(cess.cessKey, cess.key);
      const rates = [
        ...new Set(
          items
            .map((itemValue) => {
              const item = asRecord(itemValue);
              const custom = asRecord(item.custom);
              const matchingCustomKey = Object.keys(custom).find(
                (candidate) =>
                  normalizedName(candidate) === normalizedName(cessKey)
              );
              return numericValue(
                item[cessKey] ??
                  custom[cessKey] ??
                  (matchingCustomKey ? custom[matchingCustomKey] : undefined)
              );
            })
            .filter((rate): rate is number => rate !== undefined)
        ),
      ].sort((left, right) => left - right);
      const amount = firstMonetaryValue(
        cess.finalAmount,
        cess.calculatedAmount,
        cess.amount,
        finalCessTotal[amountKey],
        finalCessTotal[cessKey],
        invoiceCessTotal[amountKey],
        invoiceCessTotal[cessKey]
      );
      const baseLabel = firstText(cess.cessName, cess.label, cess.name, "Cess");
      const label = rates.length
        ? `${baseLabel} (${rates.map((rate) => `${rate}%`).join(", ")})`
        : baseLabel;

      return {
        label,
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
const addItemSerialNumberColumn = (
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

const mapSolvinTemplateData = (payload: any) => {
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
const solvinTaxAmountInWords = (
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
const formatSolvinCurrency = (amount: any, invoiceValue?: any): string => {
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
const formatSrTradingCurrency = (amount: any, invoiceValue?: any): string => {
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
  symbolClass = "solvin-currency-symbol"
): string => {
  const labelPattern = /[^\d.,\s()-]+/gu;
  let cursor = 0;
  const markup = Array.from(formatted.matchAll(labelPattern)).reduce(
    (result, match) => {
      const index = match.index ?? cursor;
      const precedingText = escapeHtml(formatted.slice(cursor, index));
      const currencyLabel = escapeHtml(match[0]);
      cursor = index + match[0].length;
      return `${result}${precedingText}<span class="${symbolClass}">${currencyLabel}</span>`;
    },
    ""
  );

  return markup + escapeHtml(formatted.slice(cursor));
};

/**
 * Gives SR Trading-family templates a separately styled currency glyph. Lydia
 * fonts can omit symbols such as the Indian rupee even though they render the
 * amount digits correctly.
 */
export const formatSrTradingCurrencyMarkup = (
  amount: any,
  invoiceValue?: any
): string => {
  const formatted = formatSrTradingCurrency(amount, invoiceValue);

  return `<span class="sri-money">${wrapCurrencyLabels(
    formatted,
    "sri-currency-symbol"
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

const DOCUMENT_NAMES: Record<string, string> = {
  invoice: "Invoice",
  taxinvoice: "Tax Invoice",
  quotation: "Quotation",
  estimate: "Estimate",
  salesorder: "Sales Order",
  purchaseorder: "Purchase Order",
  creditnote: "Credit Note",
  debitnote: "Debit Note",
  deliverychallan: "Delivery Challan",
  proforma: "Proforma Invoice",
  proformainvoice: "Proforma Invoice",
  expense: "Expense",
};

const capitalizeFirstLetter = (value: string): string =>
  value.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ACCOUNT_TRANSFER: "Account Transfer",
  UPI: "UPI",
  CASH: "Cash Payment",
  CHEQUE: "Cheque",
  DD: "Demand Draft",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  WALLET: "Digital Wallet",
  PREPAID_CARD: "Prepaid Card",
  PROFORMA_PAYMENT: "Proforma Payment",
  OTHER: "Other",
  PAYMENT_RECEIPT: "Payment Receipt",
};

const formatPaymentMethod = (value: any): string => {
  const text = firstText(value);
  if (!text) return "";

  const enumKey = text.toUpperCase();
  if (PAYMENT_METHOD_LABELS[enumKey]) return PAYMENT_METHOD_LABELS[enumKey];

  if (/^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/.test(text)) {
    return text
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  return text;
};

const firstValue = (...values: any[]): any =>
  values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      (typeof value !== "string" || value.trim() !== "")
  );

const numberValue = (value: any): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value ?? "").match(/-?\d[\d,]*(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) || 0 : 0;
};

const percentageSource = (value: any, depth = 0): any => {
  if (depth > 3 || value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "string") return value;

  const record = asRecord(value);
  const amountType = firstText(record.amountType, record.type).toLowerCase();
  const candidates = [
    record.percentage,
    record.percent,
    record.rate,
    record.discountPercentage,
    record.discountPercent,
    record.discountRate,
    record.value,
    record.defaultValue,
    amountType.includes("percent") ? record.amount : undefined,
  ];
  return candidates.reduce<any>(
    (resolved, candidate) =>
      resolved !== "" ? resolved : percentageSource(candidate, depth + 1),
    ""
  );
};

const percentageNumber = (value: any): number =>
  numberValue(percentageSource(value));

export const formatSriPercentage = (value: any): string => {
  const source = percentageSource(value);
  const text = firstText(source);
  if (!text) return "";
  const match = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return text;
  const numeric = Number(match[0].replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return text;
  const formatted = Number.isInteger(numeric)
    ? String(numeric)
    : String(Number(numeric.toFixed(2)));
  return `${formatted}%`;
};

const percentageLabel = (label: string, rate: number): string => {
  if (!rate || /\d+(?:\.\d+)?\s*%/.test(label)) return label;
  const formattedRate = Number.isInteger(rate)
    ? String(rate)
    : String(Number(rate.toFixed(2)));
  return `${label} (${formattedRate}%)`;
};

const sriOptionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return undefined;
};

const sriCollectionRecords = (value: any): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);
  return Object.entries(asRecord(value)).map(([key, entry]) => ({
    key,
    ...asRecord(entry),
    ...(typeof entry === "object" ? {} : { value: entry }),
  }));
};

const isVisibleField = (field: UnknownRecord): boolean =>
  (sriOptionalBoolean(field.showInInvoice) ??
    sriOptionalBoolean(asRecord(field.params).showInInvoice) ??
    true) &&
  (sriOptionalBoolean(field.visible) ??
    sriOptionalBoolean(field.isVisible) ??
    true) &&
  sriOptionalBoolean(field.isHidden) !== true &&
  sriOptionalBoolean(field.isArchived) !== true;

const mapRows = (...values: any[]) =>
  values
    .flatMap(sriCollectionRecords)
    .filter(isVisibleField)
    .map((field) => ({
      key: firstText(field.key, field.name, field.label),
      label: firstText(field.label, field.name, field.key),
      value: firstText(
        field.value,
        field.fieldValue,
        field.defaultValue,
        field.content,
        field.text
      ),
      isMonetary:
        field.dataType === "currency" ||
        field.fxReturnType === "currency" ||
        field.isCurrency === true,
      isDate:
        [field.dataType, field.fxReturnType, field.semanticType]
          .map((value) => firstText(value).toLowerCase())
          .some((value) => ["date", "datetime", "timestamp"].includes(value)) ||
        /date/i.test(firstText(field.key, field.name, field.label)),
    }))
    .filter((row) => row.label && row.value);

const mergeDisplayRows = (...rowGroups: any[][]) => {
  const seen = new Set<string>();
  return rowGroups.flat().filter((row) => {
    const identity = firstText(row.key, row.label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const findRowValue = (
  rows: Array<{ key: string; label: string; value: string }>,
  pattern: RegExp
) => rows.find((row) => pattern.test(`${row.key} ${row.label}`))?.value || "";

const findRow = (
  rows: Array<{ key: string; label: string; value: string }>,
  pattern: RegExp
) => rows.find((row) => pattern.test(`${row.key} ${row.label}`));

const normalizedColumnKey = (column: any): string =>
  firstText(asRecord(column).key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizedColumnLabel = (column: any): string =>
  firstText(asRecord(column).label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const ROW_NUMBER_COLUMN_KEYS = new Set([
  "sr",
  "srno",
  "sno",
  "rownumber",
  "index",
]);

const REFERENCE_COLUMN_KEYS = new Set([
  "reference",
  "ref",
  "itemreference",
  "itemref",
]);

const isRowNumberColumn = (column: any): boolean =>
  ROW_NUMBER_COLUMN_KEYS.has(normalizedColumnKey(column));

const isReferenceColumn = (column: any): boolean =>
  !isRowNumberColumn(column) &&
  (REFERENCE_COLUMN_KEYS.has(normalizedColumnKey(column)) ||
    REFERENCE_COLUMN_KEYS.has(normalizedColumnLabel(column)));

const ITEM_DESCRIPTION_COLUMN_KEYS = new Set(["item", "name", "description"]);

const STANDARD_LINE_ITEM_COLUMN_KEYS = new Set([
  "quantity",
  "qty",
  "unit",
  "uom",
  "unitname",
  "rate",
  "unitrate",
  "unitprice",
  "price",
  "amount",
  "subtotal",
  "discount",
  "discountrate",
  "discountpercent",
  "discountpercentage",
  "hsn",
  "sac",
  "classification",
  "gstrate",
  "taxrate",
  "gst",
  "tax",
  "vat",
  "igst",
  "cgst",
  "sgst",
  "utgst",
  "cess",
  "cessrate",
  "cessamount",
  "taxamount",
  "total",
]);

const isItemDescriptionColumn = (column: any): boolean =>
  ITEM_DESCRIPTION_COLUMN_KEYS.has(normalizedColumnKey(column));

const isCustomLineItemColumn = (column: any): boolean => {
  const key = normalizedColumnKey(column);
  return (
    !isRowNumberColumn(column) &&
    !ITEM_DESCRIPTION_COLUMN_KEYS.has(key) &&
    !STANDARD_LINE_ITEM_COLUMN_KEYS.has(key)
  );
};

const taxAmount = (
  invoice: UnknownRecord,
  items: UnknownRecord[],
  columns: any[]
): number => {
  const finalTotal = asRecord(invoice.finalTotal);
  const totals = asRecord(invoice.totals);
  const direct = [
    finalTotal.vat,
    finalTotal.vatAmount,
    finalTotal.tax,
    finalTotal.taxAmount,
    totals.vat,
    totals.vatAmount,
    totals.tax,
    totals.taxAmount,
  ]
    .map(numberValue)
    .find((value) => value !== 0);

  if (direct !== undefined) return direct;

  const componentTotal = [
    finalTotal.igst,
    finalTotal.cgst,
    finalTotal.sgst,
    finalTotal.utgst,
  ]
    .map(numberValue)
    .reduce((sum, value) => sum + value, 0);
  if (componentTotal !== 0) return componentTotal;

  const itemTaxColumn = columns.find((column) => {
    const key = normalizedColumnKey(column);
    const label = normalizedColumnLabel(column);
    const type = firstText(
      asRecord(column).dataType,
      asRecord(column).fxReturnType,
      asRecord(column).semanticType
    ).toLowerCase();
    const isRate = key.endsWith("rate") || label.endsWith("rate");
    const isPercentage = ["percentage", "percent"].includes(type);
    return (
      !isRate &&
      !isPercentage &&
      (["gst", "tax", "vat", "gstamount", "taxamount", "vatamount"].includes(
        key
      ) ||
        ["gst", "tax", "vat"].includes(label))
    );
  });
  if (itemTaxColumn) {
    const itemTaxes = items
      .map((item) => firstText(getItemColumnValue(item, itemTaxColumn)))
      .filter(Boolean)
      .map(numberValue);
    if (itemTaxes.length) {
      return itemTaxes.reduce((sum, value) => sum + value, 0);
    }
  }

  return 0;
};

// Words follow the document currency; LKR has no built-in word form, so it is
// spelled out here instead of printing the bare code.
const sriLankanAmountInWords = (
  value: number,
  invoice: UnknownRecord
): string =>
  solvinTaxAmountInWords(value, {
    currency: firstText(invoice.currency, invoice.businessCurrency, "LKR"),
    subUnitLength: invoice.subUnitLength,
  }).replace(/\bLKR\b/g, "Sri Lankan Rupees");

const SUMMABLE_COLUMN_KEYS = new Set([
  "amount",
  "subtotal",
  "total",
  "tax",
  "taxamount",
  "vat",
  "vatamount",
  "gstamount",
  "igst",
  "cgst",
  "sgst",
  "utgst",
  "cess",
  "cessamount",
]);

// Footer values for the items "Total" row: the authoritative subtotal for the
// amount column and real line-item sums for every other summable column.
// Rates, prices and percentages have no meaningful total and stay blank.
const mapColumnTotals = (
  columns: any[],
  items: UnknownRecord[],
  subTotal: number
): Record<string, number> => {
  const lineItems = items.filter(isRealLineItem);
  return Object.fromEntries(
    columns
      .filter((column) => {
        const record = asRecord(column);
        const key = normalizedColumnKey(column);
        const type = firstText(
          record.dataType,
          record.fxReturnType,
          record.semanticType
        ).toLowerCase();
        return (
          !record.isHidden &&
          !ROW_NUMBER_COLUMN_KEYS.has(key) &&
          !ITEM_DESCRIPTION_COLUMN_KEYS.has(key) &&
          ![
            "quantity",
            "qty",
            "rate",
            "unitrate",
            "unitprice",
            "price",
          ].includes(key) &&
          !["percentage", "percent"].includes(type) &&
          !key.endsWith("rate") &&
          (SUMMABLE_COLUMN_KEYS.has(key) ||
            sriOptionalBoolean(record.summarise) === true)
        );
      })
      .map((column) => {
        const key = firstText(asRecord(column).key);
        if (["amount", "subtotal"].includes(normalizedColumnKey(column))) {
          return [key, subTotal];
        }
        const values = lineItems
          .map((item) => getItemColumnValue(item, column))
          .filter((value) => firstText(value) !== "");
        if (!values.length) return [key, undefined];
        return [
          key,
          values.reduce((sum: number, value) => sum + numberValue(value), 0),
        ];
      })
      .filter(([, value]) => value !== undefined)
  );
};

const meaningfulTransportText = (...values: any[]): string => {
  const value = firstText(...values);
  return /^(?:-|n\/?a|null|undefined)$/i.test(value) ? "" : value;
};

const mapTransportRows = (invoice: UnknownRecord) => {
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);
  const labels = asRecord(invoice.customLabels);
  return [
    {
      label: firstText(labels.transportName, labels.transporter, "Transporter"),
      value: meaningfulTransportText(
        transporter.name,
        transport.transporterName,
        transport.transport
      ),
    },
    {
      label: firstText(labels.transportMode, "Transport Mode"),
      value: meaningfulTransportText(transport.transportMode),
    },
    {
      label: firstText(labels.challanNumber, "Challan No."),
      value: meaningfulTransportText(transport.challanNumber),
    },
    {
      label: firstText(labels.challanDate, "Challan Date"),
      value: meaningfulTransportText(transport.challanDate),
      isDate: true,
    },
    {
      label: firstText(
        labels.transportInformation,
        labels.extraInformation,
        "Transport Notes"
      ),
      value: meaningfulTransportText(transport.extraInformation),
    },
  ].filter((row) => row.value);
};

const mapBatchSummary = (
  items: UnknownRecord[],
  configuredColumnsValue: any
) => {
  const configuredColumns = sriCollectionRecords(configuredColumnsValue)
    .filter(isVisibleField)
    .map((column) => ({
      key: firstText(column.key, column.name, column.label),
      label: firstText(column.label, column.name, column.key),
    }))
    .filter((column) => column.key && column.label);
  const batchEntries: UnknownRecord[] = items.flatMap((itemValue) => {
    const item = asRecord(itemValue);
    return sriCollectionRecords(item.batchSummary).map(
      (batch): UnknownRecord => ({
        ...batch,
        itemName: firstText(batch.itemName, item.name),
      })
    );
  });
  const columns = configuredColumns.length
    ? configuredColumns
    : [
        { key: "itemName", label: "Item" },
        { key: "batchName", label: "Batch" },
        { key: "quantity", label: "Quantity" },
        { key: "manufacturingDate", label: "Mfg. Date" },
        { key: "expiryDate", label: "Exp. Date" },
      ];
  const rows = batchEntries.map((batch) => ({
    cells: columns.map((column) => ({
      key: column.key,
      value: firstValue(batch[column.key], asRecord(batch.custom)[column.key]),
      isDate: /date$/i.test(column.key),
      isNumeric: /^(?:quantity|qty)$/i.test(column.key),
    })),
  }));

  return { columns, rows, hasRows: rows.length > 0 };
};

const sriImageSource = (value: any): string => {
  const record = asRecord(value);
  const source =
    [
      value,
      record.url,
      record.src,
      record.image,
      record.value,
      record.data,
      record.base64,
    ]
      .filter((candidate) => typeof candidate === "string")
      .map((candidate) => candidate.trim())
      .find(Boolean) || "";
  if (!source || /^(?:data:|https?:|blob:|\/)/i.test(source)) return source;
  return `data:image/png;base64,${source}`;
};

const attachmentFileName = (source: string, index: number): string => {
  const cleanSource = source.split(/[?#]/)[0];
  const encodedName = cleanSource.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(encodedName) || `Attachment ${index + 1}`;
  } catch {
    return encodedName || `Attachment ${index + 1}`;
  }
};

const mapAttachments = (value: any) => {
  const entries = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) && value) entries.push(value);
  return entries
    .map((entry, index) => {
      const record = asRecord(entry);
      const url = firstText(
        typeof entry === "string" ? entry : "",
        record.url,
        record.src,
        record.fileUrl,
        record.downloadUrl,
        record.link,
        record.value
      );
      const mimeType = firstText(
        record.mimeType,
        record.contentType,
        record.type
      );
      return {
        number: index + 1,
        url,
        label: firstText(
          record.label,
          record.name,
          record.fileName,
          record.title,
          attachmentFileName(url, index)
        ),
        isImage:
          /^image\//i.test(mimeType) ||
          /^data:image\//i.test(url) ||
          /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(url.split(/[?#]/)[0]),
      };
    })
    .filter((attachment) => attachment.url);
};

const firstBooleanSetting = (...values: any[]): boolean | undefined =>
  values.map(sriOptionalBoolean).find((value) => value !== undefined);

// Text scale arrives as a ratio (1.1) or a percentage (110); anything unusable
// keeps the normal size, and extremes are clamped to a readable range.
const printTextScale = (value: any): string => {
  const parsed = Number(firstText(value));
  if (!firstText(value) || !Number.isFinite(parsed) || parsed <= 0) return "1";
  const ratio = parsed > 2 ? parsed / 100 : parsed;
  return String(Number(Math.min(2, Math.max(0.3, ratio)).toFixed(4)));
};

/** Sidebar print settings that the template applies itself. */
export const mapSriLankanPrintOptions = (
  rawPayload: UnknownRecord,
  rawInvoice: UnknownRecord
) => {
  const templateOptions = {
    ...asRecord(rawPayload.template),
    ...asRecord(rawInvoice.template),
  };
  const pdfOptions = {
    ...asRecord(rawPayload.pdfOptions),
    ...asRecord(templateOptions.pdfOptions),
    ...asRecord(rawInvoice.pdfOptions),
  };
  const direction = normalizedName(
    firstText(
      templateOptions.direction,
      templateOptions.textDirection,
      rawInvoice.direction,
      rawInvoice.textDirection
    )
  );
  const isRtl =
    firstBooleanSetting(
      templateOptions.enableRtl,
      templateOptions.enableRTL,
      templateOptions.isRtl,
      templateOptions.isRTL,
      templateOptions.rightToLeft,
      rawInvoice.enableRtl,
      rawInvoice.enableRTL,
      rawInvoice.isRtl,
      rawInvoice.isRTL,
      rawInvoice.rightToLeft
    ) ?? direction === "rtl";

  return {
    // The shared normalizer only reads these from invoice.template; the API
    // also sends them on the top-level template object.
    letterHeadOnFirstPage: firstBooleanSetting(
      pdfOptions.letterHeadOnFirstPage
    ),
    footerOnLastPage: firstBooleanSetting(pdfOptions.footerOnLastPage),
    textScale: printTextScale(
      firstValue(pdfOptions.textScale, pdfOptions.scale)
    ),
    pageless:
      firstBooleanSetting(
        pdfOptions.pageless,
        pdfOptions.isPageless,
        pdfOptions.longPdf
      ) ?? false,
    hideFooter:
      firstBooleanSetting(
        pdfOptions.hideFooter,
        templateOptions.hideFooter,
        rawInvoice.hideFooter,
        rawPayload.hideFooter
      ) ?? false,
    direction: isRtl ? "rtl" : "ltr",
    language: firstText(
      templateOptions.languageCode,
      templateOptions.locale,
      templateOptions.language,
      rawInvoice.languageCode,
      rawInvoice.locale
    ),
    script: firstText(
      templateOptions.languageScript,
      templateOptions.script,
      rawInvoice.languageScript,
      rawInvoice.script
    ),
  };
};

export const mapSriLankanTemplateData = (payload: any) => {
  const rawPayload = asRecord(payload);
  const rawInvoice = Object.keys(asRecord(rawPayload.invoice)).length
    ? asRecord(rawPayload.invoice)
    : rawPayload;
  const mapped = mapSolvinTemplateData(payload);
  const invoice = {
    ...mapped.invoice,
    billedBy: {
      ...asRecord(mapped.invoice.billedBy),
      ...asRecord(rawInvoice.billedBy),
    },
    billedTo: {
      ...asRecord(mapped.invoice.billedTo),
      ...asRecord(rawInvoice.billedTo),
    },
    shippedFrom: {
      ...asRecord(mapped.invoice.shippedFrom),
      ...asRecord(rawInvoice.shippedFrom),
    },
    shippedTo: {
      ...asRecord(mapped.invoice.shippedTo),
      ...asRecord(rawInvoice.shippedTo),
    },
    customFields: rawInvoice.customFields,
    customHeaders: rawInvoice.customHeaders,
    documentCustomFields: rawInvoice.documentCustomFields,
    customFooters: rawInvoice.customFooters,
    footers: rawInvoice.footers,
    additionalInfo: rawInvoice.additionalInfo,
    additionalInformation: rawInvoice.additionalInformation,
    additionalInformationFields: rawInvoice.additionalInformationFields,
  } as UnknownRecord;
  const finalTotal = asRecord(invoice.finalTotal);
  const paymentSource = firstValue(
    rawInvoice.allPayments,
    rawInvoice.payments,
    invoice.allPayments,
    invoice.payments
  );
  const payments = sriCollectionRecords(paymentSource).filter(
    (payment) => Object.keys(payment).length > 0
  );
  const informationRows = mapRows(
    rawInvoice.customFields,
    rawInvoice.customFooters,
    rawInvoice.footers,
    rawInvoice.additionalInformationFields
  );
  const configuredDateOfSupplyRow = findRow(
    informationRows,
    /date\s+of\s+supply/i
  );
  const dateOfSupply = firstValue(
    configuredDateOfSupplyRow?.value,
    rawInvoice.dateOfSupply,
    rawInvoice.supplyDate,
    invoice.dateOfSupply,
    invoice.supplyDate
  );
  const configuredAdditionalInformationRows = mapRows(
    rawInvoice.additionalInformationFields
  );
  const additionalInformationRow = findRow(
    configuredAdditionalInformationRows,
    /additional\s*information/i
  );
  const displayedInformationRows = mapRows(
    rawInvoice.customFooters,
    rawInvoice.footers,
    rawInvoice.additionalInformationFields
  ).filter(
    (row) =>
      !/date\s+of\s+supply/i.test(`${row.key} ${row.label}`) &&
      !/mode\s+of\s+payment/i.test(`${row.key} ${row.label}`) &&
      !/additional\s*information/i.test(`${row.key} ${row.label}`)
  );
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const advanceOptions = {
    ...asRecord(mapped.advanceOptions),
    ...asRecord(invoice.advanceOptions),
    ...asRecord(rawInvoice.advanceOptions),
  };
  const isDescriptionFullWidth =
    sriOptionalBoolean(advanceOptions.showDescriptionInFullWidth) ??
    sriOptionalBoolean(advanceOptions.isDescriptionFullWidth) ??
    sriOptionalBoolean(rawInvoice.showDescriptionInFullWidth) ??
    sriOptionalBoolean(rawInvoice.isDescriptionFullWidth) ??
    mapped.mapped.visibility.isDescriptionFullWidth;
  const showSerialNumbersInDescription =
    sriOptionalBoolean(advanceOptions.showSerialNumbersInDescription) ??
    sriOptionalBoolean(advanceOptions.showSerialNumbersInInvoice) ??
    sriOptionalBoolean(rawInvoice.showSerialNumbersInDescription) ??
    sriOptionalBoolean(rawInvoice.showSerialNumbersInInvoice) ??
    true;
  const hideGroupSubTotal =
    sriOptionalBoolean(advanceOptions.hideGroupSubTotal) ??
    sriOptionalBoolean(rawInvoice.hideGroupSubTotal);
  const showGroupSubTotal =
    sriOptionalBoolean(advanceOptions.showGroupSubTotal) ??
    sriOptionalBoolean(rawInvoice.showGroupSubTotal) ??
    hideGroupSubTotal !== true;
  const showTotalsRow =
    sriOptionalBoolean(advanceOptions.showSummarizedTotalQuantity) ??
    sriOptionalBoolean(advanceOptions.showSummarisedTotalQuantity) ??
    sriOptionalBoolean(advanceOptions.showTotalsRow) ??
    sriOptionalBoolean(rawInvoice.showSummarizedTotalQuantity) ??
    sriOptionalBoolean(rawInvoice.showSummarisedTotalQuantity) ??
    sriOptionalBoolean(rawInvoice.showTotalsRow) ??
    mapped.mapped.visibility.showTotalsRow;
  const hideTotalInWords =
    sriOptionalBoolean(advanceOptions.hideTotalInWords) ??
    sriOptionalBoolean(rawInvoice.hideTotalInWords);
  const showTotalInWords =
    (sriOptionalBoolean(advanceOptions.showTotalInWords) ??
      sriOptionalBoolean(rawInvoice.showTotalInWords) ??
      true) &&
    hideTotalInWords !== true;
  const renderedItems = showGroupSubTotal
    ? items
    : items.filter((item) => !asRecord(item).isGroupItemTotalRow);
  const additionalInformationRecord = asRecord(
    firstValue(rawInvoice.additionalInformation, rawInvoice.additionalInfo)
  );
  const directAdditionalInformation = (...values: any[]) =>
    firstText(
      ...values.filter(
        (value) =>
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
      )
    );
  const additionalInformationValue = firstText(
    additionalInformationRow?.value,
    additionalInformationRecord.value,
    additionalInformationRecord.defaultValue,
    additionalInformationRecord.content,
    additionalInformationRecord.text,
    directAdditionalInformation(
      rawInvoice.additionalInformation,
      rawInvoice.additionalInfo,
      invoice.additionalInformation,
      invoice.additionalInfo
    )
  );
  const additionalInformationLabel = firstText(
    additionalInformationRow?.label,
    additionalInformationRecord.label,
    additionalInformationRecord.name,
    rawInvoice.additionalInformationLabel,
    asRecord(invoice.customLabels).additionalInformation,
    "Additional Information"
  );
  const showAdditionalInformation = Boolean(
    additionalInformationValue || displayedInformationRows.length
  );
  const configuredColumns = mapped.mapped.columns;
  // The first field added through Customize Columns leads the table. The
  // combined item/description field follows it, and every remaining field
  // keeps its original form order after the item field.
  const visibleConfiguredColumns = configuredColumns
    .filter((column) => !isRowNumberColumn(column))
    .map((column) =>
      isReferenceColumn(column)
        ? { ...column, className: "col-reference" }
        : column
    );
  const firstAddedColumn = visibleConfiguredColumns.find(
    isCustomLineItemColumn
  );
  const columns = firstAddedColumn
    ? [
        firstAddedColumn,
        ...visibleConfiguredColumns.filter(isItemDescriptionColumn),
        ...visibleConfiguredColumns.filter(
          (column) =>
            column !== firstAddedColumn && !isItemDescriptionColumn(column)
        ),
      ]
    : visibleConfiguredColumns;
  const configuredColumnLabel = (keys: string[], fallback: any): string => {
    const normalizedKeys = keys.map((key) =>
      key.toLowerCase().replace(/[^a-z0-9]+/g, "")
    );
    const column = configuredColumns.find((candidate) =>
      normalizedKeys.includes(normalizedColumnKey(candidate))
    );
    return firstText(column?.label, fallback);
  };
  const configuredTaxColumn = configuredColumns.find((column) => {
    const key = normalizedColumnKey(column);
    const label = normalizedColumnLabel(column);
    const type = firstText(
      asRecord(column).dataType,
      asRecord(column).fxReturnType,
      asRecord(column).semanticType
    ).toLowerCase();
    return (
      !key.endsWith("rate") &&
      !label.endsWith("rate") &&
      !["percentage", "percent"].includes(type) &&
      (["gst", "tax", "vat", "gstamount", "taxamount", "vatamount"].includes(
        key
      ) ||
        ["gst", "tax", "vat"].includes(label))
    );
  });
  const customLabels = asRecord(invoice.customLabels);
  const contact = asRecord(invoice.contact);
  const contactEmail = firstText(contact.email);
  const contactPhone = firstText(contact.phone);
  const documentType = normalizedName(
    firstText(invoice.billType, invoice.invoiceType, "document")
  );
  const documentName = DOCUMENT_NAMES[documentType] || "Document";
  const documentTitle = firstText(
    invoice.invoiceTitle,
    customLabels.documentTitle,
    customLabels.title,
    documentType === "invoice" ? "Tax Invoice" : documentName
  );
  const documentNumber = firstText(
    documentType === "quotation" || documentType === "estimate"
      ? invoice.quotationNumber
      : undefined,
    documentType === "salesorder" ? invoice.salesOrderNumber : undefined,
    documentType === "salesorder" ? invoice.orderNumber : undefined,
    documentType === "purchaseorder" ? invoice.purchaseOrderNumber : undefined,
    documentType === "creditnote" ? invoice.creditNoteNumber : undefined,
    documentType === "debitnote" ? invoice.debitNoteNumber : undefined,
    documentType === "expense" ? invoice.expenseNumber : undefined,
    invoice.invoiceNumber,
    invoice.documentNumber,
    invoice.quotationNumber
  );
  const documentDate = firstValue(
    documentType === "quotation" || documentType === "estimate"
      ? invoice.quotationDate
      : undefined,
    documentType === "salesorder" ? invoice.salesOrderDate : undefined,
    documentType === "salesorder" ? invoice.orderDate : undefined,
    documentType === "purchaseorder" ? invoice.purchaseOrderDate : undefined,
    documentType === "creditnote" ? invoice.creditNoteDate : undefined,
    documentType === "debitnote" ? invoice.debitNoteDate : undefined,
    documentType === "expense" ? invoice.expenseDate : undefined,
    invoice.invoiceDate,
    invoice.documentDate
  );
  const documentNumberLabel = firstText(
    documentType === "quotation" || documentType === "estimate"
      ? customLabels.quotationNumber
      : undefined,
    documentType === "salesorder" ? customLabels.salesOrderNumber : undefined,
    documentType === "purchaseorder"
      ? customLabels.purchaseOrderNumber
      : undefined,
    documentType === "creditnote" ? customLabels.creditNoteNumber : undefined,
    documentType === "debitnote" ? customLabels.debitNoteNumber : undefined,
    documentType === "expense" ? customLabels.expenseNumber : undefined,
    documentType === "invoice" ? customLabels.invoiceNumber : undefined,
    customLabels.documentNumber,
    `${documentType === "invoice" ? documentTitle : documentName} No.`
  );
  const documentDateLabel = firstText(
    documentType === "quotation" || documentType === "estimate"
      ? customLabels.quotationDate
      : undefined,
    documentType === "salesorder" ? customLabels.salesOrderDate : undefined,
    documentType === "purchaseorder"
      ? customLabels.purchaseOrderDate
      : undefined,
    documentType === "creditnote" ? customLabels.creditNoteDate : undefined,
    documentType === "debitnote" ? customLabels.debitNoteDate : undefined,
    documentType === "expense" ? customLabels.expenseDate : undefined,
    documentType === "invoice" ? customLabels.invoiceDate : undefined,
    customLabels.documentDate,
    `Date of ${documentName}`
  );
  const customSubtotalLabel = firstText(
    customLabels.subTotal,
    customLabels.subtotal
  );
  const mappedSubtotalLabel = firstText(mapped.display.labels.subTotal);
  const amountColumnLabel = firstText(
    configuredColumns.find((column) =>
      ["amount", "subtotal"].includes(normalizedColumnKey(column))
    )?.label
  );
  const subtotalLabel = firstText(
    amountColumnLabel,
    mappedSubtotalLabel,
    customSubtotalLabel,
    "Sub Total"
  );
  const summaryLabels = {
    subTotal: subtotalLabel,
    discount: configuredColumnLabel(
      ["discount"],
      firstText(customLabels.discount, mapped.display.labels.discount)
    ),
    tax: firstText(
      configuredTaxColumn?.label,
      customLabels.vat,
      customLabels.tax,
      customLabels.igst,
      invoice.taxName,
      invoice.taxType
    ),
    total: configuredColumnLabel(
      ["total"],
      firstText(customLabels.total, mapped.display.labels.total)
    ),
  };
  const attachments = mapAttachments(
    firstValue(
      rawInvoice.attachments,
      rawInvoice.attachment,
      invoice.attachments,
      invoice.attachment
    )
  );
  const visibleColumnCount = columns.filter(
    (column) => !column.isHidden
  ).length;
  const rates = items
    .map((item) => percentageNumber(item.gstRate ?? item.taxRate ?? item.tax))
    .filter((rate) => rate > 0);
  const uniqueRates = Array.from(new Set(rates));
  const vatRate = uniqueRates.length === 1 ? `${uniqueRates[0]}%` : "VAT Rate";
  const valueOfSupply = numberValue(
    firstValue(
      finalTotal.subTotal,
      rawInvoice.subTotal,
      invoice.subTotal,
      asRecord(rawInvoice.totals).subTotal,
      mapped.totals.subTotal
    )
  );
  const vatAmount = taxAmount(invoice, items, configuredColumns);
  const explicitDiscountRate = numberValue(
    firstValue(
      rawInvoice.discountRate,
      rawInvoice.discountPercent,
      rawInvoice.discountPercentage,
      asRecord(rawInvoice.finalTotal).discountRate,
      asRecord(rawInvoice.finalTotal).discountPercent,
      asRecord(rawInvoice.finalTotal).discountPercentage
    )
  );
  const itemDiscountRates = items
    .map((item) =>
      percentageNumber(
        firstValue(
          item.discountRate,
          item.discountPercent,
          item.discountPercentage,
          item.discount
        )
      )
    )
    .filter((rate) => rate > 0);
  const uniqueDiscountRates = Array.from(new Set(itemDiscountRates));
  const effectiveDiscountRate =
    valueOfSupply > 0 && mapped.display.discountAmount
      ? (Math.abs(mapped.display.discountAmount) / valueOfSupply) * 100
      : 0;
  const discountRate =
    explicitDiscountRate ||
    (uniqueDiscountRates.length === 1 ? uniqueDiscountRates[0] : 0) ||
    effectiveDiscountRate;
  const total = numberValue(
    firstValue(
      finalTotal.total,
      asRecord(rawInvoice.finalTotal).total,
      asRecord(invoice.totals).total,
      asRecord(rawInvoice.totals).total,
      asRecord(invoice.toPay).full,
      invoice.toPay
    )
  );
  const irn = asRecord(invoice.irn);
  const taxName = firstText(invoice.taxName, invoice.taxType);
  const isVatTax = /\bvat\b/i.test(taxName);
  const isGstDocument =
    taxName.toUpperCase() === "GST" ||
    firstText(invoice.taxType).toUpperCase() === "INDIA";
  const vatTaxMap = new Map<number, number>();
  items.forEach((item) => {
    const rate = percentageNumber(item.gstRate ?? item.taxRate ?? item.vatRate);
    if (!rate) return;
    const amount = numberValue(
      firstValue(
        item.vatAmount,
        item.taxAmount,
        item.vat,
        configuredTaxColumn
          ? getItemColumnValue(item, configuredTaxColumn)
          : undefined,
        item.tax
      )
    );
    vatTaxMap.set(rate, (vatTaxMap.get(rate) || 0) + amount);
  });
  const vatTaxRows = Array.from(vatTaxMap.entries())
    .map(([rate, amount]) => ({ rate, amount }))
    .sort((left, right) => right.rate - left.rate);
  const taxSummaryView = firstText(advanceOptions.taxSummaryView)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const showDetailedTaxSummary = taxSummaryView
    ? [
        "both",
        "table",
        "detailed",
        "summaryandtable",
        "summaryanddetailed",
      ].includes(taxSummaryView)
    : mapped.mapped.visibility.showTaxTable;
  const showPaymentsSetting =
    sriOptionalBoolean(rawPayload.showPaymentsTable) ??
    sriOptionalBoolean(rawInvoice.showPaymentsTable) ??
    sriOptionalBoolean(asRecord(invoice.advanceOptions).showPaymentsTable);
  const cessDefinitions = sriCollectionRecords(
    firstValue(rawInvoice.cesses, invoice.cesses)
  ).filter(
    (cess) =>
      (sriOptionalBoolean(cess.isApplied) ?? true) &&
      sriOptionalBoolean(cess.isArchived) !== true
  );
  const widgetItems = items.map((itemValue) => {
    const item = asRecord(itemValue);
    const custom = asRecord(item.custom);
    const customValue = (keyValue: any): any => {
      const key = firstText(keyValue);
      if (!key) return undefined;
      const matchingKey = Object.keys(custom).find(
        (candidate) => normalizedName(candidate) === normalizedName(key)
      );
      return firstValue(
        item[key],
        custom[key],
        matchingKey && custom[matchingKey]
      );
    };
    const cess = cessDefinitions.reduce(
      (summary, definition) => ({
        rate:
          summary.rate +
          percentageNumber(customValue(definition.cessKey ?? definition.key)),
        amount:
          summary.amount +
          numberValue(
            customValue(definition.cessAmountKey ?? definition.amountKey)
          ),
      }),
      { rate: 0, amount: 0 }
    );
    return {
      ...item,
      hsn: firstText(item.hsn, item.sac, item.hsnCode),
      gstRate: percentageNumber(item.gstRate ?? item.taxRate ?? item.tax),
      amount: numberValue(item.amount ?? item.taxableValue),
      igst: numberValue(item.igst),
      cgst: numberValue(item.cgst),
      sgst: numberValue(item.sgst ?? item.utgst),
      cessRate: cess.rate,
      cessAmount: cess.amount,
    };
  });
  const taxSummaryWidget = computeTaxSummary(widgetItems, {
    isIgst: mapped.mapped.visibility.showIgst,
    isUtgst: mapped.mapped.visibility.isUtgst,
  });
  const hsnSummaryWidget = computeHsnSummary(widgetItems, {
    isIgst: mapped.mapped.visibility.showIgst,
    isUtgst: mapped.mapped.visibility.isUtgst,
  });
  const paymentTableWidget = computePaymentColumns(payments, {
    businessCurrency: firstText(
      invoice.businessCurrency,
      rawInvoice.businessCurrency
    ),
    currency: firstText(invoice.currency, rawInvoice.currency),
  });
  const batchSummaryWidget = mapBatchSummary(
    items,
    firstValue(
      rawPayload.defaultBatchColumns,
      rawInvoice.defaultBatchColumns,
      invoice.defaultBatchColumns
    )
  );
  const showBatchSummarySetting =
    sriOptionalBoolean(rawPayload.showStockSummary) ??
    sriOptionalBoolean(rawInvoice.showStockSummary) ??
    sriOptionalBoolean(asRecord(invoice.advanceOptions).showStockSummary);
  const bankAccount = asRecord(invoice.bankAccount);
  const bankRows = [
    {
      label: mapped.display.labels.accountName,
      value: firstText(bankAccount.name, bankAccount.accountHolderName),
      nowrap: false,
    },
    {
      label: mapped.display.labels.accountNumber,
      value: firstText(bankAccount.accountNo, bankAccount.accountNumber),
      nowrap: true,
    },
    {
      label: mapped.display.labels.ifsc,
      value: firstText(bankAccount.ifsc, bankAccount.ifscCode),
      nowrap: true,
    },
    {
      label: mapped.display.labels.swift,
      value: firstText(bankAccount.swift, bankAccount.swiftCode),
      nowrap: true,
    },
    {
      label: mapped.display.labels.accountType,
      value: firstText(bankAccount.accountType),
      nowrap: false,
    },
    {
      label: mapped.display.labels.bank,
      value: firstText(bankAccount.bank, bankAccount.bankName),
      nowrap: false,
    },
    ...sriCollectionRecords(bankAccount.customFields)
      .filter(isVisibleField)
      .map((field) => ({
        label: firstText(field.label, field.name, field.key),
        value: firstText(field.value, field.defaultValue),
        nowrap:
          field.dataType === "number" ||
          field.dataType === "currency" ||
          field.fxReturnType === "currency",
      })),
  ].filter((row) => row.label && row.value);
  const rawUpiRecord = asRecord(rawInvoice.upi);
  const upiRecord = asRecord(invoice.upi);
  const upiId = firstText(
    rawUpiRecord.upi,
    rawUpiRecord.upiId,
    rawUpiRecord.vpa,
    rawUpiRecord.name,
    upiRecord.upi,
    upiRecord.upiId,
    upiRecord.vpa,
    upiRecord.name
  );
  const suppliedUpiQr = sriImageSource(
    firstValue(
      rawUpiRecord.qr,
      rawUpiRecord.qrCode,
      rawUpiRecord.qrImage,
      rawUpiRecord.qrImageUrl,
      rawUpiRecord.qrCodeUrl,
      rawUpiRecord.image,
      upiRecord.qr,
      upiRecord.qrCode,
      upiRecord.qrImage,
      upiRecord.qrImageUrl,
      upiRecord.qrCodeUrl,
      upiRecord.image,
      rawInvoice.upiQr,
      rawInvoice.upiQrCode,
      invoice.upiQr,
      invoice.upiQrCode
    )
  );
  // Render only the QR supplied with the document. Generating a new image from
  // the UPI ID can make a template preview look authoritative even when that
  // QR was never saved on the source document.
  const upiQrImage = suppliedUpiQr;
  const telephoneRows = (rows: any[]) => {
    const normalizedRows = rows.map((row) =>
      row.isPhone ? { ...row, label: "Telephone No" } : row
    );
    return [
      ...normalizedRows.filter((row) => !row.isPhone),
      ...normalizedRows.filter((row) => row.isPhone),
    ];
  };
  const builtInTaxIdVisibility = (partyValue: any, rowValue: any): boolean => {
    const party = asRecord(partyValue);
    const row = asRecord(rowValue);
    const normalizedField = normalizedName(firstText(row.key, row.label));
    let aliases: string[] = [];
    if (normalizedField === "gstin") {
      aliases = ["gstin", "gst"];
    } else if (normalizedField === "pannumber" || normalizedField === "pan") {
      aliases = ["panNumber", "pan"];
    }
    if (!aliases.length) return true;

    const directVisibility = aliases
      .flatMap((alias) => {
        const capitalized = `${alias.charAt(0).toUpperCase()}${alias.slice(1)}`;
        return [
          party[`${alias}ShowInInvoice`],
          party[`show${capitalized}InInvoice`],
          party[`show${capitalized}`],
          invoice[`${alias}ShowInInvoice`],
          invoice[`show${capitalized}InInvoice`],
          invoice[`show${capitalized}`],
        ];
      })
      .map(sriOptionalBoolean)
      .find((value) => value !== undefined);
    const explicitlyHidden = aliases
      .flatMap((alias) => {
        const capitalized = `${alias.charAt(0).toUpperCase()}${alias.slice(1)}`;
        return [party[`hide${capitalized}`], invoice[`hide${capitalized}`]];
      })
      .map(sriOptionalBoolean)
      .find((value) => value !== undefined);
    if (explicitlyHidden === true) return false;
    if (directVisibility !== undefined) return directVisibility;

    const normalizedAliases = aliases.map(normalizedName);
    const partyConfiguredVisibility = [
      party.fieldVisibility,
      party.invoiceValueProps,
      invoice.partyFieldVisibility,
      invoice.fieldVisibility,
      invoice.invoiceValueProps,
    ]
      .map(asRecord)
      .map((visibility) => {
        const key = Object.keys(visibility).find((candidate) =>
          normalizedAliases.includes(normalizedName(candidate))
        );
        if (!key) return undefined;
        const setting = visibility[key];
        const record = asRecord(setting);
        const params = asRecord(record.params);
        const shown = [
          setting,
          record.visible,
          record.isVisible,
          record.show,
          record.showInInvoice,
          params.visible,
          params.isVisible,
          params.show,
          params.showInInvoice,
        ]
          .map(sriOptionalBoolean)
          .find((value) => value !== undefined);
        if (shown !== undefined) return shown;
        const hidden = [
          record.hidden,
          record.isHidden,
          record.hide,
          record.hideInInvoice,
          params.hidden,
          params.isHidden,
          params.hide,
          params.hideInInvoice,
        ]
          .map(sriOptionalBoolean)
          .find((value) => value !== undefined);
        return hidden === undefined ? undefined : !hidden;
      })
      .find((value) => value !== undefined);

    // GSTIN and PAN can be inherited from the saved customer record. In the
    // Sri Lankan template they must not appear unless the document explicitly
    // enables them.
    return partyConfiguredVisibility ?? false;
  };
  const partyRows = (partyValue: any, mappedRows: any[]) => {
    const party = asRecord(partyValue);
    return telephoneRows(
      mergeDisplayRows(
        mappedRows.filter((row) => builtInTaxIdVisibility(party, row)),
        mapRows(
          party.additionalIds,
          party.customFields,
          party.customHeaders,
          party.additionalFields
        )
      )
    );
  };
  const partyDetails = {
    billedBy: partyRows(invoice.billedBy, mapped.display.partyDetails.billedBy),
    billedTo: partyRows(invoice.billedTo, mapped.display.partyDetails.billedTo),
    shippedFrom: partyRows(
      invoice.shippedFrom,
      mapped.display.partyDetails.shippedFrom
    ),
    shippedTo: partyRows(
      invoice.shippedTo,
      mapped.display.partyDetails.shippedTo
    ),
  };
  const isTinRow = (row: any): boolean => {
    const identifiers = [row.key, row.label].map((value) =>
      firstText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
    );
    return identifiers.some((identifier) =>
      [
        "tin",
        "tinnumber",
        "supplierstin",
        "supplierstinnumber",
        "purchaserstin",
        "purchaserstinnumber",
        "taxidentificationnumber",
      ].includes(identifier)
    );
  };
  const billingPartyRows = (rows: any[], tinLabel: string) => ({
    tinRows: rows.filter(isTinRow).map((row) => ({ ...row, label: tinLabel })),
    detailRows: rows.filter((row) => !isTinRow(row)),
  });
  const supplierRows = billingPartyRows(
    partyDetails.billedBy,
    "Supplier's TIN"
  );
  const purchaserRows = billingPartyRows(
    partyDetails.billedTo,
    "Purchaser's TIN"
  );
  const hiddenDocumentField = (row: any): boolean => {
    const key = firstText(row.key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const supplyField = firstText(row.supplyField)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const searchable = `${row.key || ""} ${row.label || ""}`;
    return (
      [
        "invoicenumber",
        "invoicedate",
        "placeofsupply",
        "countryofsupply",
      ].includes(key || supplyField) ||
      /mode\s+of\s+payment|additional\s*information/i.test(searchable)
    );
  };
  const documentRows = mergeDisplayRows(
    mapped.display.documentDetails,
    mapRows(
      rawInvoice.customHeaders,
      rawInvoice.customFields,
      rawInvoice.documentCustomFields,
      asRecord(rawInvoice.documentDetails).customFields
    )
  ).filter((row) => !hiddenDocumentField(row));
  const summaryRows: Array<{
    label: string;
    value: any;
    isMonetary: boolean;
    isGrandTotal?: boolean;
    isDeduction?: boolean;
  }> = [];
  summaryRows.push({
    label: summaryLabels.subTotal,
    value: valueOfSupply,
    isMonetary: true,
  });
  if (mapped.display.discountAmount) {
    summaryRows.push({
      label: percentageLabel(summaryLabels.discount, discountRate),
      value: -Math.abs(mapped.display.discountAmount),
      isMonetary: true,
    });
  }
  // GST documents carry their split in finalTotal (IGST, or CGST + SGST/UTGST).
  // Show those real components like the source document does; every other tax
  // keeps the single authoritative tax row.
  const gstComponent = (value: any): number | undefined => {
    const amount = numberValue(value);
    return amount !== 0 ? amount : undefined;
  };
  const stripMixedRates = (label: any): string =>
    uniqueRates.length > 1
      ? firstText(label)
          .replace(/\s*\([^)]*%[^)]*\)\s*$/, "")
          .trim()
      : firstText(label);
  const { isUtgst } = mapped.mapped.visibility;
  const gstRows = [
    mapped.mapped.visibility.showIgst
      ? {
          label: mapped.display.labels.igst,
          value: gstComponent(finalTotal.igst),
        }
      : undefined,
    mapped.mapped.visibility.showCgstSgst
      ? {
          label: mapped.display.labels.cgst,
          value: gstComponent(finalTotal.cgst),
        }
      : undefined,
    mapped.mapped.visibility.showCgstSgst
      ? {
          label: isUtgst
            ? mapped.display.labels.utgst
            : mapped.display.labels.sgst,
          value: gstComponent(isUtgst ? finalTotal.utgst : finalTotal.sgst),
        }
      : undefined,
  ].filter(
    (row): row is { label: string; value: number } =>
      row !== undefined && row.value !== undefined
  );
  const showGstSplit = !isVatTax && isGstDocument && gstRows.length > 0;
  if (mapped.mapped.visibility.showTaxes && showGstSplit) {
    gstRows.forEach((row) =>
      summaryRows.push({
        label: stripMixedRates(row.label),
        value: row.value,
        isMonetary: true,
      })
    );
  } else if (mapped.mapped.visibility.showTaxes && vatAmount !== 0) {
    summaryRows.push({
      label: percentageLabel(
        summaryLabels.tax,
        uniqueRates.length === 1 ? uniqueRates[0] : 0
      ),
      value: vatAmount,
      isMonetary: true,
    });
  }
  mapped.display.cessRows
    .filter((row) => numberValue(row.amount) !== 0)
    .forEach((row) =>
      summaryRows.push({ ...row, value: row.amount, isMonetary: true })
    );
  mapped.display.additionalChargeRows.forEach((row) =>
    summaryRows.push({ ...row, value: row.amount, isMonetary: true })
  );
  mapped.display.extraTotalRows.forEach((row) =>
    summaryRows.push({
      label: row.label,
      value: row.value,
      isMonetary: row.isMonetary,
    })
  );
  summaryRows.push({
    label: summaryLabels.total,
    value: total,
    isMonetary: true,
    isGrandTotal: true,
  });
  // Payments recorded against the document follow the grand total, each shown
  // only when the API has a non-zero amount and the field is not hidden.
  const balance = asRecord(firstValue(invoice.balance, rawInvoice.balance));
  const balanceFieldHidden = (aliases: string[]): boolean =>
    (configuredVisibility(invoice, aliases) ??
      configuredVisibility(rawInvoice, aliases)) === false;
  [
    {
      aliases: ["tdsAmountWithheld", "tdsAmount", "tds"],
      label: mapped.display.labels.tdsAmountWithheld,
      value: firstValue(balance.tds, balance.tdsAmount, invoice.tdsAmount),
      isDeduction: true,
    },
    {
      aliases: ["paidAmount", "amountPaid", "paid", "partPaid", "partialPaid"],
      label: mapped.display.labels.amountPaid,
      value: firstValue(
        balance.paid,
        balance.paidAmount,
        balance.amountPaid,
        balance.partPaid,
        balance.partialPaid,
        invoice.paidAmount,
        invoice.amountPaid
      ),
      isDeduction: true,
    },
    {
      aliases: ["amountReceived", "settledAmount", "receivedAmount"],
      label: mapped.display.labels.amountReceived,
      value: firstValue(
        balance.settledAmount,
        balance.amountReceived,
        balance.receivedAmount
      ),
      isDeduction: false,
    },
    {
      aliases: ["transactionCharge", "paymentTransactionCharge"],
      label: mapped.display.labels.transactionCharge,
      value: firstValue(
        balance.transactionCharge,
        balance.paymentTransactionCharge
      ),
      isDeduction: false,
    },
  ]
    .filter(
      (row) => numberValue(row.value) !== 0 && !balanceFieldHidden(row.aliases)
    )
    .forEach((row) =>
      summaryRows.push({
        label: row.label,
        value: Math.abs(numberValue(row.value)),
        isMonetary: true,
        isDeduction: row.isDeduction,
      })
    );
  if (mapped.mapped.visibility.showDueAmount) {
    summaryRows.push({
      label: mapped.display.labels.dueAmount,
      value: numberValue(mapped.totals.dueAmount),
      isMonetary: true,
    });
  }

  const printOptions = mapSriLankanPrintOptions(rawPayload, rawInvoice);

  return {
    ...mapped,
    currency: invoice.currency,
    businessCurrency: invoice.businessCurrency,
    locale: invoice.locale || invoice.businessLocale || "en-LK",
    businessLocale: invoice.businessLocale || "en-LK",
    subUnitLength: invoice.subUnitLength,
    customCurrencySymbol: invoice.customCurrencySymbol,
    display: {
      ...mapped.display,
      partyDetails,
    },
    mapped: {
      ...mapped.mapped,
      columns,
      visibility: {
        ...mapped.mapped.visibility,
        visibleColumnCount,
        denseItemsTable: visibleColumnCount >= 6,
        isDescriptionFullWidth,
        showCountryOfSupply: false,
        showPlaceOfSupply: false,
        showSerialNumbersInDescription,
        showGroupSubTotal,
        showTotalsRow,
        showTotalInWords,
        letterHeadOnFirstPage:
          printOptions.letterHeadOnFirstPage ??
          mapped.mapped.visibility.letterHeadOnFirstPage,
        footerOnLastPage:
          printOptions.footerOnLastPage ??
          mapped.mapped.visibility.footerOnLastPage,
      },
    },
    invoice: { ...invoice, items: renderedItems },
    sri: {
      document: {
        title: documentTitle,
        number: documentNumber,
        date: documentDate,
        numberLabel: documentNumberLabel,
        dateLabel: documentDateLabel,
      },
      supplier: {
        ...asRecord(invoice.billedBy),
        addressLines: getPartyAddressLines(invoice.billedBy),
        ...supplierRows,
      },
      purchaser: {
        ...asRecord(invoice.billedTo),
        addressLines: getPartyAddressLines(invoice.billedTo),
        ...purchaserRows,
      },
      documentRows,
      informationRows: displayedInformationRows,
      showAdditionalInformation,
      showClosingInformation:
        showAdditionalInformation || attachments.length > 0,
      additionalInformationLabel,
      additionalInformation: additionalInformationValue,
      dateOfSupply,
      modeOfPayment: formatPaymentMethod(
        firstText(
          findRowValue(informationRows, /mode\s+of\s+payment/i),
          payments[0]?.paymentMethod,
          payments[0]?.mode,
          payments[0]?.method,
          asRecord(invoice.paymentOptions).accountTransfer
            ? "Bank Transfer"
            : ""
        )
      ),
      vatRate,
      valueOfSupply,
      vatAmount,
      total,
      totalsLabelColspan: Math.max(1, visibleColumnCount - 1),
      summaryRows,
      columnTotals: mapColumnTotals(
        columns,
        items,
        numberValue(mapped.totals.subTotal)
      ),
      totalInWords: capitalizeFirstLetter(
        firstText(
          asRecord(invoice.customLabels).totalInWordsValue,
          invoice.amountInWords,
          sriLankanAmountInWords(total, invoice)
        )
      ),
      transportRows: mapTransportRows(rawInvoice),
      payments,
      showInvoiceStatus: Boolean(firstText(invoice.status)),
      showPayments: paymentTableWidget.hasRows && showPaymentsSetting !== false,
      showGstWidgets: isGstDocument,
      showTaxSummary:
        (isVatTax ? vatTaxRows.length > 0 : taxSummaryWidget.hasRows) &&
        showDetailedTaxSummary,
      showHsnSummary:
        hsnSummaryWidget.hasRows && mapped.mapped.visibility.showHsnSummary,
      showBatchSummary:
        batchSummaryWidget.hasRows && showBatchSummarySetting !== false,
      summaryLabels: {
        tax: firstText(customLabels.taxSummary, "Tax Summary"),
        hsn: firstText(customLabels.hsnSummary, "HSN Summary"),
        batch: firstText(customLabels.batchSummary, "Batch Summary"),
        payments: firstText(customLabels.paymentsSummary, "Payments Summary"),
      },
      isVatTax,
      vatTaxLabel: firstText(
        configuredTaxColumn?.label,
        customLabels.vat,
        invoice.taxName,
        "VAT"
      ),
      vatTaxRows,
      vatTaxInWords: solvinTaxAmountInWords(vatAmount, {
        currency: firstText(invoice.currency, "LKR"),
        subUnitLength: invoice.subUnitLength,
      }),
      contact: {
        show: Boolean(contactEmail || contactPhone),
        email: contactEmail,
        phone: contactPhone,
        intro: firstText(
          customLabels.contactIntro,
          customLabels.contactDetails,
          "For any enquiry, reach out via"
        ),
        emailLabel: firstText(customLabels.contactEmail, "email at"),
        phoneLabel: firstText(customLabels.contactPhone, "call on"),
      },
      attachments: {
        show: attachments.length > 0,
        label: firstText(
          customLabels.attachment,
          asRecord(mapped.display.labels).attachment,
          "Attachments"
        ),
        items: attachments,
      },
      widgets: {
        taxSummary: taxSummaryWidget,
        hsnSummary: hsnSummaryWidget,
        batchSummary: batchSummaryWidget,
        paymentTable: paymentTableWidget,
      },
      bankRows,
      compliance: {
        irn: firstText(irn.Irn, irn.irn),
        qrCode: sriImageSource(irn.qrCode),
        zatcaQrCode: sriImageSource(invoice.zatcaQrCode),
        lhdnQrCode: sriImageSource(invoice.lhdnQrCode),
        documentQr: sriImageSource(invoice.documentQr),
      },
      upiId,
      upiQrImage,
      print: printOptions,
      showDemoBadge:
        sriOptionalBoolean(invoice.isDemo) === true ||
        sriOptionalBoolean(rawPayload.isDemo) === true,
    },
  };
};

const PAGED_PRINT_CLASS = "is-sri-paged-print";
const PAGELESS_PRINT_CLASS = "is-sri-lydia-pageless-print";
type MeasuredCell = {
  clientWidth: number;
  scrollWidth: number;
};

export const hasSriLankanMultipleRenderedTextLines = (
  rects: Iterable<TextRect>
): boolean => {
  const lineTops = new Set(
    Array.from(rects)
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => Math.round(rect.top * 2) / 2)
  );
  return lineTops.size > 1;
};

export const hasSriLankanPrintTableOverflow = (
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

export const hasSriLankanPrintCellOverflow = (
  cells: Iterable<MeasuredCell>
): boolean =>
  Array.from(cells).some(
    (cell) =>
      cell.clientWidth > 0 &&
      cell.scrollWidth > cell.clientWidth + FIT_TOLERANCE_PX
  );

const hasWrappedHeaders = (table: HTMLElement): boolean =>
  Array.from(table.querySelectorAll("thead th")).some((header) => {
    const range = table.ownerDocument.createRange();
    range.selectNodeContents(header);
    return hasSriLankanMultipleRenderedTextLines(
      Array.from(range.getClientRects())
    );
  });

const updateSriLankanPrintFit = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".sri-lankan-invoice")
    .forEach((invoice) => {
      const wrapper = invoice.querySelector<HTMLElement>(".items-table-wrap");
      const table = invoice.querySelector<HTMLElement>(".line-items");

      invoice.classList.remove(COMPACT_PRINT_CLASS);
      if (!wrapper || !table) return;

      invoice.classList.add(MEASURING_PRINT_CLASS);
      const fixedWidthCells = table.querySelectorAll<HTMLElement>(
        "thead th, tbody .item-row > td:not(.col-item), tbody .items-total-row > td"
      );
      const shouldCompact =
        hasWrappedHeaders(table) ||
        hasSriLankanPrintTableOverflow(wrapper, table) ||
        hasSriLankanPrintCellOverflow(fixedWidthCells);
      invoice.classList.remove(MEASURING_PRINT_CLASS);
      invoice.classList.toggle(COMPACT_PRINT_CLASS, shouldCompact);
    });
};

const resetSriLankanPrintFit = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".sri-lankan-invoice")
    .forEach((invoice) =>
      invoice.classList.remove(COMPACT_PRINT_CLASS, MEASURING_PRINT_CLASS)
    );
};

export const isSriLankanLydiaPagelessMode = (search: string): boolean =>
  new URLSearchParams(search).has("isLydiaMode");

const setSriLankanPrintMode = (enabled: boolean): void => {
  if (!document.body) return;

  // Long-PDF mode comes from Lydia's URL flag or the template's pdfOptions
  // (rendered onto the invoice as is-pageless-print).
  const isPageless =
    isSriLankanLydiaPagelessMode(window.location.search) ||
    Boolean(document.querySelector(".sri-lankan-invoice.is-pageless-print"));
  document.body.classList.toggle(PAGED_PRINT_CLASS, enabled && !isPageless);
  document.body.classList.toggle(PAGELESS_PRINT_CLASS, enabled && isPageless);
};

export const registerSriLankanPrintMode = (): void => {
  const state = window as typeof window & {
    sriLankanPrintModeRegistered?: boolean;
  };
  if (state.sriLankanPrintModeRegistered) return;

  state.sriLankanPrintModeRegistered = true;
  window.addEventListener("beforeprint", () => {
    setSriLankanPrintMode(true);
    updateSriLankanPrintFit();
  });
  window.addEventListener("afterprint", () => {
    resetSriLankanPrintFit();
    setSriLankanPrintMode(false);
  });

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", (event) => {
    setSriLankanPrintMode(event.matches);
    if (event.matches) {
      updateSriLankanPrintFit();
      return;
    }
    resetSriLankanPrintFit();
  });
};
