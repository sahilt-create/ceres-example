import {
  mapSolvinTemplateData,
  getPartyAddressLines,
  getItemColumnValue,
  solvinTaxAmountInWords,
} from "./helpers";
import generateUpiQrDataUrl from "./sr-trading-2-0.upiQr";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const firstText = (...values: any[]): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) || "";

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
  optionalBoolean(field.isHidden) !== true &&
  optionalBoolean(field.isArchived) !== true;

const mapRows = (...values: any[]) =>
  values
    .flatMap(collectionRecords)
    .filter(isVisibleField)
    .map((field) => ({
      key: firstText(field.key, field.name, field.label),
      label: firstText(field.label, field.name, field.key),
      value: firstText(field.value, field.defaultValue),
      isMonetary:
        field.dataType === "currency" ||
        field.fxReturnType === "currency" ||
        field.isCurrency === true,
    }))
    .filter((row) => row.label && row.value);

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

const taxAmount = (
  invoice: UnknownRecord,
  items: UnknownRecord[],
  columns: any[]
): number => {
  const finalTotal = asRecord(invoice.finalTotal);
  const totals = asRecord(invoice.totals);
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
  return [finalTotal.igst, finalTotal.cgst, finalTotal.sgst, finalTotal.utgst]
    .map(numberValue)
    .reduce((sum, value) => sum + value, 0);
};

const sriLankanAmountInWords = (value: number): string =>
  solvinTaxAmountInWords(value, { currency: "LKR" }).replace(
    /\bLKR\b/g,
    "Sri Lankan Rupees"
  );

const mapTransportRows = (invoice: UnknownRecord) => {
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);
  return [
    {
      label: "Transporter",
      value: firstText(transporter.name, transport.transporterName),
    },
    {
      label: "Transporter ID",
      value: firstText(transporter.transporterId, transport.transporterId),
    },
    {
      label: "Transport Mode",
      value: firstText(transport.transportMode, transport.transport),
    },
    { label: "Challan No.", value: firstText(transport.challanNumber) },
    {
      label: "Challan Date",
      value: firstText(transport.challanDate),
      isDate: true,
    },
    { label: "Vehicle No.", value: firstText(transport.vehicleNumber) },
    { label: "Vehicle Type", value: firstText(transport.vehicleType) },
    { label: "Distance", value: firstText(transport.distance) },
    { label: "Transaction Type", value: firstText(transport.transactionType) },
    { label: "Supply Type", value: firstText(transport.subSupplyType) },
    { label: "Transport Notes", value: firstText(transport.extraInformation) },
  ].filter((row) => row.value);
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
    customFooters: rawInvoice.customFooters,
    footers: rawInvoice.footers,
    additionalInfo: rawInvoice.additionalInfo,
    additionalInformation: rawInvoice.additionalInformation,
    additionalInformationFields: rawInvoice.additionalInformationFields,
  } as UnknownRecord;
  const finalTotal = asRecord(invoice.finalTotal);
  let payments: any[] = [];
  if (Array.isArray(invoice.allPayments)) payments = invoice.allPayments;
  else if (Array.isArray(invoice.payments)) payments = invoice.payments;
  const informationRows = mapRows(
    rawInvoice.customFields,
    rawInvoice.customFooters,
    rawInvoice.footers,
    rawInvoice.additionalInformationFields
  );
  const configuredAdditionalInformationRows = mapRows(
    rawInvoice.additionalInformationFields
  );
  const additionalInformationRow = findRow(
    configuredAdditionalInformationRows,
    /additional\s*information/i
  );
  const displayedInformationRows = informationRows.filter(
    (row) =>
      !/date\s+of\s+supply/i.test(`${row.key} ${row.label}`) &&
      !/mode\s+of\s+payment/i.test(`${row.key} ${row.label}`) &&
      !/additional\s*information/i.test(`${row.key} ${row.label}`)
  );
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const configuredColumns = mapped.mapped.columns;
  const fallbackColumns = [
    {
      key: "index",
      label: "Reference*",
      className: "col-index",
      isHidden: false,
      dataType: "number",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    },
    {
      key: "item",
      label: "Description of Goods or Services",
      className: "col-item",
      isHidden: false,
      dataType: "string",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    },
    {
      key: "quantity",
      label: "Quantity",
      className: "col-qty",
      isHidden: false,
      dataType: "number",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    },
    {
      key: "rate",
      label: "Unit Price",
      className: "col-rate",
      isHidden: false,
      dataType: "currency",
      fxReturnType: "currency",
      semanticType: "currency" as const,
      isCessColumn: false,
      summarise: false,
    },
    {
      key: "amount",
      label: "Amount Excluding VAT (Rs.)",
      className: "col-amount",
      isHidden: false,
      dataType: "currency",
      fxReturnType: "currency",
      semanticType: "currency" as const,
      isCessColumn: false,
      summarise: true,
    },
  ];
  // The Sri Lankan statutory layout is a fixed five-column table. Payload
  // columns can still be used for calculations, but must not alter its grid.
  const columns = fallbackColumns;
  const visibleColumnCount = columns.filter(
    (column) => !column.isHidden
  ).length;
  const rates = items
    .map((item) => numberValue(item.gstRate ?? item.taxRate ?? item.tax))
    .filter((rate) => rate > 0);
  const uniqueRates = Array.from(new Set(rates));
  const vatRate = uniqueRates.length === 1 ? `${uniqueRates[0]}%` : "VAT Rate";
  const total = numberValue(finalTotal.total ?? invoice.toPay);
  const irn = asRecord(invoice.irn);
  const taxName = firstText(invoice.taxName, invoice.taxType);
  const showPaymentsSetting =
    optionalBoolean(rawPayload.showPaymentsTable) ??
    optionalBoolean(rawInvoice.showPaymentsTable) ??
    optionalBoolean(asRecord(invoice.advanceOptions).showPaymentsTable);
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
  const upiRecord = asRecord(invoice.upi);
  const upiId = firstText(
    upiRecord.upi,
    upiRecord.upiId,
    upiRecord.vpa,
    upiRecord.name
  );
  const suppliedUpiQr = imageSource(
    firstValue(
      upiRecord.qr,
      upiRecord.qrCode,
      upiRecord.qrImage,
      upiRecord.qrImageUrl,
      upiRecord.qrCodeUrl,
      upiRecord.image,
      invoice.upiQr,
      invoice.upiQrCode
    )
  );
  const upiQrImage = suppliedUpiQr || generateUpiQrDataUrl(upiId);

  return {
    ...mapped,
    currency: invoice.currency,
    businessCurrency: invoice.businessCurrency,
    locale: invoice.locale || invoice.businessLocale || "en-LK",
    businessLocale: invoice.businessLocale || "en-LK",
    subUnitLength: invoice.subUnitLength,
    customCurrencySymbol: invoice.customCurrencySymbol,
    mapped: {
      ...mapped.mapped,
      columns,
      visibility: {
        ...mapped.mapped.visibility,
        visibleColumnCount,
        denseItemsTable: false,
      },
    },
    invoice,
    sri: {
      supplier: {
        ...asRecord(invoice.billedBy),
        addressLines: getPartyAddressLines(invoice.billedBy),
        detailRows: mapped.display.partyDetails.billedBy,
      },
      purchaser: {
        ...asRecord(invoice.billedTo),
        addressLines: getPartyAddressLines(invoice.billedTo),
        detailRows: mapped.display.partyDetails.billedTo,
      },
      documentRows: mapped.display.documentDetails.filter(
        (row) =>
          !["invoiceNumber", "invoiceDate", "placeOfSupply"].includes(row.key)
      ),
      informationRows: displayedInformationRows,
      showAdditionalInformation: Boolean(additionalInformationRow),
      additionalInformationLabel: firstText(additionalInformationRow?.label),
      additionalInformation: firstText(additionalInformationRow?.value),
      dateOfSupply: firstValue(
        findRowValue(informationRows, /date\s+of\s+supply/i),
        rawInvoice.dateOfSupply,
        rawInvoice.supplyDate,
        invoice.dateOfSupply,
        invoice.supplyDate,
        rawInvoice.invoiceDateUserInput,
        rawInvoice.invoiceDate,
        invoice.invoiceDateUserInput,
        invoice.invoiceDate
      ),
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
      valueOfSupply: numberValue(
        finalTotal.subTotal ??
          invoice.subTotal ??
          asRecord(invoice.totals).subTotal
      ),
      vatAmount: taxAmount(invoice, items, configuredColumns),
      total,
      totalInWords: firstText(
        asRecord(invoice.customLabels).totalInWordsValue,
        invoice.amountInWords,
        sriLankanAmountInWords(total)
      ),
      transportRows: mapTransportRows(invoice),
      payments,
      showPayments: payments.length > 0 && showPaymentsSetting !== false,
      showGstWidgets:
        taxName.toUpperCase() === "GST" ||
        firstText(invoice.taxType).toUpperCase() === "INDIA",
      showTaxSummary: mapped.mapped.visibility.showTaxTable,
      showHsnSummary: mapped.mapped.visibility.showHsnSummary,
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
