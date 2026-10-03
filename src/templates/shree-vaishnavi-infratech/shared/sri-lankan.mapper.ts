/* Template-local copy of src/templates/sri-lankan.mapper.ts so this template ships
 * on its own without changing the shared mappers other templates use. */
import {
  mapSolvinTemplateData,
  getPartyAddressLines,
  getItemColumnValue,
  solvinTaxAmountInWords,
} from "./helpers";
import { computeHsnSummary } from "../../../widgets/hsn-summary/utils";
import { computePaymentColumns } from "../../../widgets/payment-table/utils";
import { computeTaxSummary } from "../../../widgets/tax-summary/utils";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const firstText = (...values: any[]): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) || "";

const normalizedName = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

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

const optionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return undefined;
};

const collectionRecords = (value: any): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);
  return Object.entries(asRecord(value)).map(([key, entry]) => ({
    key,
    ...asRecord(entry),
    ...(typeof entry === "object" ? {} : { value: entry }),
  }));
};

const isVisibleField = (field: UnknownRecord): boolean =>
  (optionalBoolean(field.showInInvoice) ??
    optionalBoolean(asRecord(field.params).showInInvoice) ??
    true) &&
  (optionalBoolean(field.visible) ??
    optionalBoolean(field.isVisible) ??
    true) &&
  optionalBoolean(field.isHidden) !== true &&
  optionalBoolean(field.isArchived) !== true;

const mapRows = (...values: any[]) =>
  values
    .flatMap(collectionRecords)
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

const sriLankanAmountInWords = (value: number): string =>
  solvinTaxAmountInWords(value, { currency: "LKR" }).replace(
    /\bLKR\b/g,
    "Sri Lankan Rupees"
  );

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
  const configuredColumns = collectionRecords(configuredColumnsValue)
    .filter(isVisibleField)
    .map((column) => ({
      key: firstText(column.key, column.name, column.label),
      label: firstText(column.label, column.name, column.key),
    }))
    .filter((column) => column.key && column.label);
  const batchEntries: UnknownRecord[] = items.flatMap((itemValue) => {
    const item = asRecord(itemValue);
    return collectionRecords(item.batchSummary).map(
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

const imageSource = (value: any): string => {
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
  const payments = collectionRecords(paymentSource).filter(
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
    optionalBoolean(advanceOptions.showDescriptionInFullWidth) ??
    optionalBoolean(advanceOptions.isDescriptionFullWidth) ??
    optionalBoolean(rawInvoice.showDescriptionInFullWidth) ??
    optionalBoolean(rawInvoice.isDescriptionFullWidth) ??
    mapped.mapped.visibility.isDescriptionFullWidth;
  const showSerialNumbersInDescription =
    optionalBoolean(advanceOptions.showSerialNumbersInDescription) ??
    optionalBoolean(advanceOptions.showSerialNumbersInInvoice) ??
    optionalBoolean(rawInvoice.showSerialNumbersInDescription) ??
    optionalBoolean(rawInvoice.showSerialNumbersInInvoice) ??
    true;
  const hideGroupSubTotal =
    optionalBoolean(advanceOptions.hideGroupSubTotal) ??
    optionalBoolean(rawInvoice.hideGroupSubTotal);
  const showGroupSubTotal =
    optionalBoolean(advanceOptions.showGroupSubTotal) ??
    optionalBoolean(rawInvoice.showGroupSubTotal) ??
    hideGroupSubTotal !== true;
  const showTotalsRow =
    optionalBoolean(advanceOptions.showSummarizedTotalQuantity) ??
    optionalBoolean(advanceOptions.showSummarisedTotalQuantity) ??
    optionalBoolean(advanceOptions.showTotalsRow) ??
    optionalBoolean(rawInvoice.showSummarizedTotalQuantity) ??
    optionalBoolean(rawInvoice.showSummarisedTotalQuantity) ??
    optionalBoolean(rawInvoice.showTotalsRow) ??
    mapped.mapped.visibility.showTotalsRow;
  const hideTotalInWords =
    optionalBoolean(advanceOptions.hideTotalInWords) ??
    optionalBoolean(rawInvoice.hideTotalInWords);
  const showTotalInWords =
    (optionalBoolean(advanceOptions.showTotalInWords) ??
      optionalBoolean(rawInvoice.showTotalInWords) ??
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
    optionalBoolean(rawPayload.showPaymentsTable) ??
    optionalBoolean(rawInvoice.showPaymentsTable) ??
    optionalBoolean(asRecord(invoice.advanceOptions).showPaymentsTable);
  const cessDefinitions = collectionRecords(
    firstValue(rawInvoice.cesses, invoice.cesses)
  ).filter(
    (cess) =>
      (optionalBoolean(cess.isApplied) ?? true) &&
      optionalBoolean(cess.isArchived) !== true
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
    optionalBoolean(rawPayload.showStockSummary) ??
    optionalBoolean(rawInvoice.showStockSummary) ??
    optionalBoolean(asRecord(invoice.advanceOptions).showStockSummary);
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
    ...collectionRecords(bankAccount.customFields)
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
  const suppliedUpiQr = imageSource(
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
      .map(optionalBoolean)
      .find((value) => value !== undefined);
    const explicitlyHidden = aliases
      .flatMap((alias) => {
        const capitalized = `${alias.charAt(0).toUpperCase()}${alias.slice(1)}`;
        return [party[`hide${capitalized}`], invoice[`hide${capitalized}`]];
      })
      .map(optionalBoolean)
      .find((value) => value !== undefined);
    if (explicitlyHidden === true) return false;
    if (directVisibility !== undefined) return directVisibility;

    const normalizedAliases = aliases.map(normalizedName);
    const configuredVisibility = [
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
          .map(optionalBoolean)
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
          .map(optionalBoolean)
          .find((value) => value !== undefined);
        return hidden === undefined ? undefined : !hidden;
      })
      .find((value) => value !== undefined);

    // GSTIN and PAN can be inherited from the saved customer record. In the
    // Sri Lankan template they must not appear unless the document explicitly
    // enables them.
    return configuredVisibility ?? false;
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
  if (mapped.mapped.visibility.showTaxes && vatAmount !== 0) {
    summaryRows.push({
      label: percentageLabel(
        summaryLabels.tax,
        uniqueRates.length === 1 ? uniqueRates[0] : 0
      ),
      value: vatAmount,
      isMonetary: true,
    });
  }
  mapped.display.cessRows.forEach((row) =>
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
      totalInWords: capitalizeFirstLetter(
        firstText(
          asRecord(invoice.customLabels).totalInWordsValue,
          invoice.amountInWords,
          sriLankanAmountInWords(total)
        )
      ),
      transportRows: mapTransportRows(rawInvoice),
      payments,
      showInvoiceStatus: Boolean(firstText(invoice.status)),
      showPayments: paymentTableWidget.hasRows && showPaymentsSetting !== false,
      showGstWidgets:
        taxName.toUpperCase() === "GST" ||
        firstText(invoice.taxType).toUpperCase() === "INDIA",
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
        qrCode: imageSource(irn.qrCode),
        zatcaQrCode: imageSource(invoice.zatcaQrCode),
        lhdnQrCode: imageSource(invoice.lhdnQrCode),
        documentQr: imageSource(invoice.documentQr),
      },
      upiId,
      upiQrImage,
      showDemoBadge:
        optionalBoolean(invoice.isDemo) === true ||
        optionalBoolean(rawPayload.isDemo) === true,
    },
  };
};

export type SriLankanTemplateState = ReturnType<
  typeof mapSriLankanTemplateData
>;
