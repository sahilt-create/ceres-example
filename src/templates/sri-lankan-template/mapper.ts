import {
  mapSolvinTemplateData,
  getPartyAddressLines,
  solvinTaxAmountInWords,
} from "../helpers";

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
  rows: Array<{ label: string; value: string }>,
  pattern: RegExp
) => rows.find((row) => pattern.test(row.label))?.value || "";

const configuredField = (invoice: UnknownRecord, aliases: string[]) => {
  const fields = asRecord(invoice.invoiceValueProps);
  const normalizedAliases = aliases.map(normalizedName);
  const key = Object.keys(fields).find((candidate) =>
    normalizedAliases.includes(normalizedName(candidate))
  );
  return key ? fields[key] : undefined;
};

const configuredFieldLabel = (
  invoice: UnknownRecord,
  aliases: string[],
  ...fallbacks: any[]
): string => {
  const field = asRecord(configuredField(invoice, aliases));
  const params = asRecord(field.params);
  return firstText(
    field.label,
    field.displayName,
    field.title,
    params.label,
    params.displayName,
    params.title,
    ...fallbacks
  );
};

const configuredFieldVisibility = (
  invoice: UnknownRecord,
  aliases: string[]
): boolean | undefined => {
  const setting = configuredField(invoice, aliases);
  const direct = optionalBoolean(setting);
  if (direct !== undefined) return direct;

  const field = asRecord(setting);
  const params = asRecord(field.params);
  const shown =
    optionalBoolean(field.visible) ??
    optionalBoolean(field.isVisible) ??
    optionalBoolean(field.show) ??
    optionalBoolean(field.showInInvoice) ??
    optionalBoolean(params.visible) ??
    optionalBoolean(params.isVisible) ??
    optionalBoolean(params.show) ??
    optionalBoolean(params.showInInvoice);
  if (shown !== undefined) return shown;

  const hidden =
    optionalBoolean(field.hidden) ??
    optionalBoolean(field.isHidden) ??
    optionalBoolean(field.hide) ??
    optionalBoolean(field.hideInInvoice) ??
    optionalBoolean(params.hidden) ??
    optionalBoolean(params.isHidden) ??
    optionalBoolean(params.hide) ??
    optionalBoolean(params.hideInInvoice);
  return hidden === undefined ? undefined : !hidden;
};

const hasValue = (...values: any[]): boolean =>
  values.some(
    (value) =>
      value !== undefined && value !== null && String(value).trim() !== ""
  );

const meaningfulText = (...values: any[]): string => {
  const value = firstText(...values);
  return /^(?:-|n\/?a|null|undefined)$/i.test(value) ? "" : value;
};

const humanizeDocumentType = (value: any): string =>
  String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const documentMeta = (invoice: UnknownRecord) => {
  const labels = asRecord(invoice.customLabels);
  const type = normalizedName(
    firstText(invoice.billType, invoice.invoiceType, invoice.invoiceTitle)
  );
  const title = firstText(
    invoice.invoiceTitle,
    labels.documentTitle,
    labels.title,
    humanizeDocumentType(invoice.billType || invoice.invoiceType),
    "Tax Invoice"
  );

  let fallbackDateLabel = "Date of Invoice";
  let fallbackNumberLabel = "Tax Invoice No.";
  if (type.includes("quotation")) {
    fallbackDateLabel = "Date of Quotation";
    fallbackNumberLabel = "Quotation No.";
  } else if (type.includes("proforma")) {
    fallbackDateLabel = "Date of Proforma Invoice";
    fallbackNumberLabel = "Proforma Invoice No.";
  } else if (type.includes("salesorder")) {
    fallbackDateLabel = "Sales Order Date";
    fallbackNumberLabel = "Sales Order No.";
  } else if (type.includes("deliverychallan")) {
    fallbackDateLabel = "Delivery Challan Date";
    fallbackNumberLabel = "Delivery Challan No.";
  } else if (type.includes("creditnote")) {
    fallbackDateLabel = "Credit Note Date";
    fallbackNumberLabel = "Credit Note No.";
  } else if (type.includes("debitnote")) {
    fallbackDateLabel = "Debit Note Date";
    fallbackNumberLabel = "Debit Note No.";
  } else if (type.includes("purchaseorder")) {
    fallbackDateLabel = "Purchase Order Date";
    fallbackNumberLabel = "Purchase Order No.";
  } else if (type.includes("purchase") || type.includes("expenditure")) {
    fallbackDateLabel = "Purchase Date";
    fallbackNumberLabel = "Purchase No.";
  }

  return {
    title,
    dateLabel: firstText(
      labels.documentDate,
      type.includes("quotation") ? labels.quotationDate : labels.invoiceDate,
      fallbackDateLabel
    ),
    numberLabel: firstText(
      labels.documentNumber,
      type.includes("quotation")
        ? labels.quotationNumber
        : labels.invoiceNumber,
      fallbackNumberLabel
    ),
    date: firstText(invoice.invoiceDate, invoice.quotationDate),
    number: firstText(
      invoice.invoiceNumber,
      invoice.quotationNumber,
      invoice.expenseNumber,
      invoice.purchaseOrderNumber,
      invoice.salesOrderNumber,
      invoice.challanNumber,
      invoice.creditNoteNumber,
      invoice.debitNoteNumber
    ),
  };
};

const totalRowKey = (row: UnknownRecord): string =>
  `${normalizedName(row.label)}|${numberValue(row.amount ?? row.value)}`;

const uniqueTotalRows = (
  rows: any[],
  seen = new Set<string>()
): UnknownRecord[] =>
  rows.map(asRecord).filter((row) => {
    const key = totalRowKey(row);
    if (!normalizedName(row.label) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

const taxAmount = (invoice: UnknownRecord): number => {
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
  const source = firstText(
    typeof value === "string" ? value : "",
    record.url,
    record.src,
    record.image,
    record.value,
    record.data,
    record.base64
  );
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
    expenseNumber: firstText(
      mapped.invoice.expenseNumber,
      rawInvoice.expenseNumber
    ),
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
  const displayedInformationRows = informationRows.filter(
    (row) =>
      !/date\s+of\s+supply/i.test(row.label) &&
      !/mode\s+of\s+payment/i.test(row.label) &&
      !/additional\s+information/i.test(row.label)
  );
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const configuredColumns = mapped.mapped.columns;
  const visibleConfiguredColumns = configuredColumns.filter(
    (column) => !column.isHidden
  );
  const fallbackColumns = [
    {
      key: "index",
      label: "Reference",
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
  const columns = (
    visibleConfiguredColumns.length > 1 ? configuredColumns : fallbackColumns
  ).map((column) =>
    column.className === "col-index"
      ? { ...column, label: "Reference" }
      : column
  );
  const visibleColumnCount = columns.filter(
    (column) => !column.isHidden
  ).length;
  const rates = items
    .map((item) => numberValue(item.gstRate ?? item.taxRate ?? item.tax))
    .filter((rate) => rate > 0);
  const uniqueRates = Array.from(new Set(rates));
  const vatRate = uniqueRates.length === 1 ? `${uniqueRates[0]}%` : "VAT Rate";
  const toPay = asRecord(invoice.toPay);
  const invoiceTotals = asRecord(invoice.totals);
  const totalSource =
    finalTotal.total ??
    invoiceTotals.total ??
    toPay.full ??
    toPay.amount ??
    (typeof invoice.toPay === "object" ? undefined : invoice.toPay);
  const total = numberValue(totalSource);
  const irn = asRecord(invoice.irn);
  const taxName = firstText(invoice.taxName, invoice.taxType);
  const customLabels = asRecord(invoice.customLabels);
  const valueOfSupply = numberValue(
    finalTotal.subTotal ??
      invoice.subTotal ??
      invoiceTotals.subTotal ??
      mapped.totals.subTotal
  );
  const vatAmount = taxAmount(invoice);
  const subTotalAliases = [
    "subTotal",
    "subtotal",
    "valueOfSupply",
    "totalValueOfSupply",
  ];
  const vatAliases = ["vat", "vatAmount", "tax", "taxAmount"];
  const totalAliases = [
    "total",
    "grandTotal",
    "totalAmount",
    "totalAmountIncludingVat",
  ];
  const hasSubTotalData =
    items.length > 0 ||
    hasValue(finalTotal.subTotal, invoice.subTotal, invoiceTotals.subTotal);
  const hasVatData = hasValue(
    finalTotal.vat,
    finalTotal.vatAmount,
    finalTotal.tax,
    finalTotal.taxAmount,
    finalTotal.igst,
    finalTotal.cgst,
    finalTotal.sgst,
    finalTotal.utgst,
    invoiceTotals.vat,
    invoiceTotals.vatAmount,
    invoiceTotals.tax,
    invoiceTotals.taxAmount
  );
  const hasTotalData = hasValue(totalSource);
  const showPaymentsSetting =
    optionalBoolean(rawPayload.showPaymentsTable) ??
    optionalBoolean(rawInvoice.showPaymentsTable) ??
    optionalBoolean(asRecord(invoice.advanceOptions).showPaymentsTable);
  const meta = documentMeta(invoice);
  const additionalInformationRow = informationRows.find((row) =>
    /additional\s+information/i.test(row.label)
  );
  const additionalInformation = meaningfulText(
    additionalInformationRow?.value,
    rawInvoice.additionalInformation,
    rawInvoice.additionalInfo
  );
  const totalRowsSeen = new Set<string>();
  const additionalChargeRows = uniqueTotalRows(
    mapped.display.additionalChargeRows,
    totalRowsSeen
  );
  const extraTotalRows = uniqueTotalRows(
    mapped.display.extraTotalRows,
    totalRowsSeen
  );

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
        denseItemsTable: visibleColumnCount >= 9,
      },
    },
    display: {
      ...mapped.display,
      additionalChargeRows,
      extraTotalRows,
    },
    invoice,
    sri: {
      documentMeta: meta,
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
          ![
            "invoiceNumber",
            "invoiceDate",
            "countryOfSupply",
            "placeOfSupply",
          ].includes(row.key) &&
          !/(?:country|place)\s+of\s+supply/i.test(row.label) &&
          !/additional\s+information/i.test(row.label)
      ),
      informationRows: displayedInformationRows,
      additionalInformation,
      additionalInformationLabel: firstText(
        additionalInformationRow?.label,
        asRecord(invoice.customLabels).additionalInformation,
        "Additional Information"
      ),
      showAdditionalInformation:
        Boolean(additionalInformation) || displayedInformationRows.length > 0,
      dateOfSupply: firstText(
        findRowValue(informationRows, /date\s+of\s+supply/i),
        rawInvoice.supplyDate,
        invoice.invoiceDateUserInput,
        invoice.invoiceDate
      ),
      modeOfPayment: firstText(
        findRowValue(informationRows, /mode\s+of\s+payment/i),
        payments[0]?.paymentMethod,
        payments[0]?.mode,
        payments[0]?.method,
        asRecord(invoice.paymentOptions).accountTransfer ? "Bank Transfer" : ""
      ),
      blankRows: Array.from({ length: Math.max(0, 5 - items.length) }),
      vatRate,
      valueOfSupply,
      vatAmount,
      total,
      totalLabels: {
        valueOfSupply: configuredFieldLabel(
          invoice,
          subTotalAliases,
          customLabels.valueOfSupply,
          customLabels.totalValueOfSupply,
          mapped.display.labels.subTotal
        ),
        vatAmount: configuredFieldLabel(
          invoice,
          vatAliases,
          customLabels.vatAmount,
          customLabels.taxAmount,
          customLabels.vat,
          taxName ? `${taxName} Amount` : "VAT Amount"
        ),
        total: configuredFieldLabel(
          invoice,
          totalAliases,
          customLabels.totalAmountIncludingVat,
          customLabels.totalAmount,
          mapped.display.labels.total
        ),
      },
      totalVisibility: {
        valueOfSupply:
          hasSubTotalData &&
          configuredFieldVisibility(invoice, subTotalAliases) !== false,
        vatAmount:
          hasVatData &&
          configuredFieldVisibility(invoice, vatAliases) !== false,
        total:
          hasTotalData &&
          configuredFieldVisibility(invoice, totalAliases) !== false,
      },
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
      compliance: {
        irn: firstText(irn.Irn, irn.irn),
        qrCode: imageSource(irn.qrCode),
        zatcaQrCode: imageSource(invoice.zatcaQrCode),
        lhdnQrCode: imageSource(invoice.lhdnQrCode),
        documentQr: imageSource(invoice.documentQr),
      },
      upiId: firstText(
        asRecord(invoice.upi).upi,
        asRecord(invoice.upi).upiId,
        asRecord(invoice.upi).vpa
      ),
      upiQrImage: /^(?:data:image\/|https?:|blob:)/i.test(mapped.mapped.qr.upi)
        ? mapped.mapped.qr.upi
        : "",
      showDemoBadge:
        optionalBoolean(invoice.isDemo) === true ||
        optionalBoolean(rawPayload.isDemo) === true,
    },
  };
};

export type SriLankanTemplateState = ReturnType<
  typeof mapSriLankanTemplateData
>;
