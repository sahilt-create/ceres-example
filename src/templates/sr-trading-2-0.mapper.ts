import { mapSolvinTemplateData } from "./helpers";
import { normalizeInvoiceTemplateState } from "../main/invoiceTemplateNormalization";
import { computeHsnSummary } from "../widgets/hsn-summary/utils";
import { computeTaxSummary } from "../widgets/tax-summary/utils";
import generateUpiQrDataUrl from "./sr-trading-2-0.upiQr";

type UnknownRecord = Record<string, any>;

export interface SrTradingBankRow {
  label: string;
  values: string[];
  isCountry?: boolean;
  nowrap?: boolean;
}

export interface SrTradingInformationRow {
  label: string;
  value: string;
}

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const asArray = <T = any>(value: any): T[] =>
  Array.isArray(value) ? value : [];

const firstText = (...values: any[]): string => {
  const value = values.find(
    (candidate) =>
      candidate !== undefined && candidate !== null && String(candidate).trim()
  );
  return value === undefined ? "" : String(value).trim();
};

const primaryLabelText = (value: any): string => {
  const label = firstText(value);
  if (!label) return "";

  const segments = label.split(/\s*\/\s*/).filter(Boolean);
  if (
    segments.length > 1 &&
    segments.slice(1).some((segment) => /[\u0600-\u06ff]/.test(segment))
  ) {
    return segments[0];
  }

  return label;
};

const normalizeName = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const humanize = (value: any): string =>
  String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const optionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};

const optionalNumericValue = (value: any): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const match = String(value ?? "").match(/[-+]?\d[\d,\s]*(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0].replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const numericValue = (value: any): number => {
  return optionalNumericValue(value) ?? 0;
};

const firstNumber = (...values: any[]): number | undefined =>
  values.map(optionalNumericValue).find((value) => value !== undefined);

const roundSummary = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const summaryEntries = (value: any, key: string): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);
  return asArray(asRecord(value)[key]).map(asRecord);
};

const summaryLineItems = (
  invoice: UnknownRecord,
  summaryValue: any,
  summaryKey: "taxList" | "hsnList"
): UnknownRecord[] => {
  const entries = summaryEntries(summaryValue, summaryKey);
  const source = entries.length
    ? entries
    : asArray(invoice.items).map(asRecord);

  return source.map((item) => ({
    ...item,
    hsn: firstText(item.hsn, item.sac, item.hsnCode),
    gstRate: numericValue(item.gstRate ?? item.taxRate ?? item.tax),
    amount: numericValue(item.amount ?? item.taxableValue),
    igst: numericValue(item.igst ?? item.igstAmount),
    cgst: numericValue(item.cgst ?? item.cgstAmount),
    sgst: numericValue(
      item.sgst ?? item.utgst ?? item.sgstAmount ?? item.utgstAmount
    ),
  }));
};

const configuredFieldVisibility = (
  invoiceValue: UnknownRecord,
  fieldName: string
): boolean | undefined => {
  const invoiceValueProps = asRecord(invoiceValue.invoiceValueProps);
  const matchingKey = Object.keys(invoiceValueProps).find(
    (key) => normalizeName(key) === normalizeName(fieldName)
  );
  if (!matchingKey) return undefined;

  const setting = invoiceValueProps[matchingKey];
  const settingRecord = asRecord(setting);
  const params = asRecord(settingRecord.params);
  const shown =
    optionalBoolean(setting) ??
    optionalBoolean(settingRecord.visible) ??
    optionalBoolean(settingRecord.isVisible) ??
    optionalBoolean(settingRecord.show) ??
    optionalBoolean(settingRecord.showInInvoice) ??
    optionalBoolean(params.visible) ??
    optionalBoolean(params.isVisible) ??
    optionalBoolean(params.show) ??
    optionalBoolean(params.showInInvoice);
  if (shown !== undefined) return shown;

  const hidden =
    optionalBoolean(settingRecord.hidden) ??
    optionalBoolean(settingRecord.isHidden) ??
    optionalBoolean(settingRecord.hide) ??
    optionalBoolean(settingRecord.hideInInvoice) ??
    optionalBoolean(params.hidden) ??
    optionalBoolean(params.isHidden) ??
    optionalBoolean(params.hide) ??
    optionalBoolean(params.hideInInvoice);
  return hidden === undefined ? undefined : !hidden;
};

export const isSrPartyFieldVisible = (
  partyValue: any,
  invoiceValue: any,
  fieldValue: any
): boolean => {
  const party = asRecord(partyValue);
  const invoice = asRecord(invoiceValue);
  const field = String(fieldValue ?? "");
  const normalizedField = normalizeName(field);
  let aliases = [field];
  if (normalizedField === "gstin") {
    aliases = ["gstin", "gst"];
  } else if (normalizedField === "pannumber") {
    aliases = ["panNumber", "pan"];
  }

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
  const directlyHidden = aliases
    .flatMap((alias) => {
      const capitalized = `${alias.charAt(0).toUpperCase()}${alias.slice(1)}`;
      return [party[`hide${capitalized}`], invoice[`hide${capitalized}`]];
    })
    .map(optionalBoolean)
    .find((value) => value !== undefined);
  if (directlyHidden === true) return false;
  if (directVisibility !== undefined) return directVisibility;

  const normalizedAliases = aliases.map(normalizeName);
  const configured = [
    party.fieldVisibility,
    party.invoiceValueProps,
    invoice.partyFieldVisibility,
    invoice.fieldVisibility,
    invoice.invoiceValueProps,
  ]
    .map(asRecord)
    .map((visibility) => {
      const key = Object.keys(visibility).find((candidate) =>
        normalizedAliases.includes(normalizeName(candidate))
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
  if (configured !== undefined) return configured;

  // A value on the invoice's own party is authoritative. The template does
  // not read GSTIN/PAN from owner/business fallbacks, while any explicit party
  // or invoice visibility setting above can still hide the field.
  return true;
};

const itemsTableColumnWidth = (column: UnknownRecord): number => {
  const key = normalizeName(column.key);
  if (["sr", "srno", "sno", "rownumber", "index"].includes(key)) return 34;
  if (["item", "name", "description"].includes(key)) return 0;
  if (
    column.semanticType === "percentage" ||
    [
      "hsn",
      "sac",
      "hsncode",
      "hsnsac",
      "quantity",
      "qty",
      "unit",
      "uom",
      "unitname",
      "gstrate",
      "taxrate",
      "cessrate",
    ].includes(key)
  )
    return 75;
  return 96;
};

const itemsTableMinWidth = (columns: UnknownRecord[]): number => {
  const visibleColumns = columns.filter(
    (column) => optionalBoolean(column.isHidden) !== true
  );
  const fixedWidth = visibleColumns.reduce(
    (total, column) => total + itemsTableColumnWidth(column),
    0
  );
  const hasFlexibleItemColumn = visibleColumns.some((column) =>
    ["item", "name", "description"].includes(normalizeName(column.key))
  );

  // The Figma document is 936px wide. Preserve at least 320px for item prose
  // when API-defined columns add more numeric/code tracks.
  return Math.max(936, fixedWidth + (hasFlexibleItemColumn ? 320 : 0));
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
  if (!source) return "";
  if (/^(?:data:|https?:|blob:|\/)/i.test(source)) return source;
  return `data:image/png;base64,${source}`;
};

const firstImageSource = (...values: any[]): string =>
  values.map(imageSource).find(Boolean) ?? "";

const bankAccountsFor = (invoice: UnknownRecord): UnknownRecord[] => {
  const bankAccounts = asArray(invoice.bankAccounts).map(asRecord);
  if (bankAccounts.length) return bankAccounts;
  if (Array.isArray(invoice.bankAccount))
    return invoice.bankAccount.map(asRecord);
  const bankAccount = asRecord(invoice.bankAccount);
  return Object.keys(bankAccount).length ? [bankAccount] : [];
};

const bankLabel = (
  invoice: UnknownRecord,
  accounts: UnknownRecord[],
  keys: string[],
  fallback: string
): string => {
  const accountLabels = accounts.map((account) =>
    asRecord(account.customLabels)
  );
  const invoiceBankLabels = asRecord(
    asRecord(invoice.bankAccount).customLabels
  );
  const invoiceLabels = asRecord(invoice.customLabels);
  const match = keys
    .flatMap((key) =>
      [...accountLabels, invoiceBankLabels, invoiceLabels].map(
        (labels) => labels[key]
      )
    )
    .find((value) => firstText(value));
  return match === undefined ? fallback : firstText(match);
};

const accountValue = (account: UnknownRecord, keys: string[]): string =>
  firstText(...keys.map((key) => account[key]));

const collectionRecords = (value: any): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);

  return Object.entries(asRecord(value)).map(([key, entry]) => {
    const record = asRecord(entry);
    return Object.keys(record).length
      ? { key, ...record }
      : { key, label: humanize(key), value: entry };
  });
};

const visibleEntry = (entry: UnknownRecord): boolean =>
  (optionalBoolean(entry.showInInvoice) ??
    optionalBoolean(asRecord(entry.params).showInInvoice) ??
    true) &&
  !(
    optionalBoolean(entry.isHidden) ??
    optionalBoolean(entry.hideInInvoice) ??
    optionalBoolean(asRecord(entry.params).isHidden) ??
    optionalBoolean(asRecord(entry.params).hideInInvoice) ??
    false
  );

const suppliedSummaryRate = (row: UnknownRecord, isIgst: boolean): number => {
  const cgstRate = firstNumber(row.cgstRate);
  const sgstRate = firstNumber(row.sgstRate, row.utgstRate);
  const splitRate =
    cgstRate === undefined && sgstRate === undefined
      ? undefined
      : (cgstRate ?? 0) + (sgstRate ?? 0);

  return (
    firstNumber(
      row.gstRate,
      row.taxRate,
      isIgst ? row.igstRate : undefined,
      !isIgst ? splitRate : undefined,
      row.tax
    ) ?? 0
  );
};

const suppliedTaxSummary = (
  invoice: UnknownRecord,
  isIgst: boolean,
  isUtgst: boolean
) => {
  const sourceValue = invoice.taxSummary;
  const entries = summaryEntries(sourceValue, "taxList");
  if (!entries.length) {
    return computeTaxSummary(
      summaryLineItems(invoice, sourceValue, "taxList"),
      { isIgst, isUtgst }
    );
  }

  const taxList = entries.map((entry) => {
    const gstRate = suppliedSummaryRate(entry, isIgst);
    const igstAmount = firstNumber(entry.igstAmount, entry.igst) ?? 0;
    const cgstAmount = firstNumber(entry.cgstAmount, entry.cgst) ?? 0;
    const sgstAmount =
      firstNumber(
        entry.sgstAmount,
        entry.utgstAmount,
        entry.sgst,
        entry.utgst
      ) ?? 0;
    return {
      gstRate,
      igstRate: firstNumber(entry.igstRate) ?? (isIgst ? gstRate : 0),
      igstAmount,
      cgstRate: firstNumber(entry.cgstRate) ?? (isIgst ? 0 : gstRate / 2),
      cgstAmount,
      sgstRate:
        firstNumber(entry.sgstRate, entry.utgstRate) ??
        (isIgst ? 0 : gstRate / 2),
      sgstAmount,
      cessRate: firstNumber(entry.cessRate) ?? 0,
      cessAmount:
        firstNumber(entry.cessAmount, entry.totalCessAmount, entry.totalCess) ??
        0,
      taxAmount:
        firstNumber(entry.taxAmount, entry.totalTaxAmount, entry.totalTax) ??
        (isIgst ? igstAmount : cgstAmount + sgstAmount),
    };
  });
  const summary = asRecord(sourceValue);
  const total = (key: string, rowKey: string): number =>
    firstNumber(summary[key]) ??
    roundSummary(
      taxList.reduce(
        (sum, row) => sum + Number(row[rowKey as keyof typeof row] ?? 0),
        0
      )
    );

  return {
    taxList,
    isIgst,
    isUtgst,
    hasCess: taxList.some((row) => row.cessAmount !== 0),
    hasRows: taxList.length > 0,
    totalIgstAmount: total("totalIgstAmount", "igstAmount"),
    totalCgstAmount: total("totalCgstAmount", "cgstAmount"),
    totalSgstAmount: total("totalSgstAmount", "sgstAmount"),
    totalCessAmount: total("totalCessAmount", "cessAmount"),
    totalTaxAmount: total("totalTaxAmount", "taxAmount"),
  };
};

const suppliedHsnSummary = (
  invoice: UnknownRecord,
  isIgst: boolean,
  isUtgst: boolean
) => {
  const sourceValue = invoice.hsnSummary;
  const entries = summaryEntries(sourceValue, "hsnList");
  if (!entries.length) {
    return computeHsnSummary(
      summaryLineItems(invoice, sourceValue, "hsnList"),
      { isIgst, isUtgst }
    );
  }

  const hsnList = entries.map((entry) => {
    const gstRate = suppliedSummaryRate(entry, isIgst);
    const igstAmount = firstNumber(entry.igstAmount, entry.igst) ?? 0;
    const cgstAmount = firstNumber(entry.cgstAmount, entry.cgst) ?? 0;
    const sgstAmount =
      firstNumber(
        entry.sgstAmount,
        entry.utgstAmount,
        entry.sgst,
        entry.utgst
      ) ?? 0;
    return {
      hsn: firstText(entry.hsn, entry.sac, entry.hsnCode),
      taxableValue: firstNumber(entry.taxableValue, entry.amount) ?? 0,
      igstRate: firstNumber(entry.igstRate) ?? (isIgst ? gstRate : 0),
      igstAmount,
      cgstRate: firstNumber(entry.cgstRate) ?? (isIgst ? 0 : gstRate / 2),
      cgstAmount,
      sgstRate:
        firstNumber(entry.sgstRate, entry.utgstRate) ??
        (isIgst ? 0 : gstRate / 2),
      sgstAmount,
      cessRate: firstNumber(entry.cessRate) ?? 0,
      cessAmount:
        firstNumber(entry.cessAmount, entry.totalCessAmount, entry.totalCess) ??
        0,
      taxAmount:
        firstNumber(entry.taxAmount, entry.totalTaxAmount, entry.totalTax) ??
        (isIgst ? igstAmount : cgstAmount + sgstAmount),
    };
  });
  const summary = asRecord(sourceValue);
  const total = (key: string, rowKey: string): number =>
    firstNumber(summary[key]) ??
    roundSummary(
      hsnList.reduce(
        (sum, row) => sum + Number(row[rowKey as keyof typeof row] ?? 0),
        0
      )
    );

  return {
    hsnList,
    isIgst,
    isUtgst,
    hasCess: hsnList.some((row) => row.cessAmount !== 0),
    hasRows: hsnList.length > 0,
    totalTaxableValue: total("totalTaxableValue", "taxableValue"),
    totalIgstAmount: total("totalIgstAmount", "igstAmount"),
    totalCgstAmount: total("totalCgstAmount", "cgstAmount"),
    totalSgstAmount: total("totalSgstAmount", "sgstAmount"),
    totalCessAmount: total("totalCessAmount", "cessAmount"),
    totalTaxAmount: total("totalTaxAmount", "taxAmount"),
  };
};

const mapAdditionalInformationRows = (
  invoice: UnknownRecord
): SrTradingInformationRow[] => {
  const sources = [
    invoice.customFooters,
    invoice.footers,
    invoice.customFields,
    invoice.additionalInfo,
    invoice.additionalInformation,
    invoice.additionalInformationFields,
  ];

  return sources
    .flatMap(collectionRecords)
    .filter(visibleEntry)
    .map((entry) => ({
      label: firstText(entry.label, entry.name, humanize(entry.key)),
      value: firstText(
        entry.value,
        entry.defaultValue,
        entry.text,
        entry.content
      ),
    }))
    .filter((entry) => entry.label && entry.value);
};

export const mapBankRows = (
  invoice: UnknownRecord,
  accounts: UnknownRecord[]
): SrTradingBankRow[] => {
  const standardFields = [
    {
      id: "accountname",
      keys: ["name", "accountHolderName"],
      labels: ["accountName", "accountHolderName"],
      aliases: ["accountname", "accountholdername", "beneficiaryname"],
      fallback: "Account Name",
    },
    {
      id: "accountnumber",
      keys: ["accountNo", "accountNumber"],
      labels: ["accountNumber", "accountNo"],
      aliases: ["accountnumber", "accountno", "acnumber", "acno"],
      fallback: "Account Number",
      nowrap: true,
    },
    {
      id: "ifsc",
      keys: ["ifsc", "ifscCode"],
      labels: ["ifsc", "ifscCode"],
      aliases: ["ifsc", "ifsccode"],
      fallback: "IFSC",
      nowrap: true,
    },
    {
      id: "iban",
      keys: ["iban"],
      labels: ["iban"],
      aliases: ["iban", "ibannumber"],
      fallback: "IBAN",
      nowrap: true,
    },
    {
      id: "swift",
      keys: ["swift", "swiftCode"],
      labels: ["swift", "swiftCode"],
      aliases: ["swift", "swiftcode", "bic", "biccode"],
      fallback: "SWIFT",
      nowrap: true,
    },
    {
      id: "accounttype",
      keys: ["accountType"],
      labels: ["accountType"],
      aliases: ["accounttype"],
      fallback: "Account Type",
    },
    {
      id: "bank",
      keys: ["bank", "bankName"],
      labels: ["bank", "bankName"],
      aliases: ["bank", "bankname"],
      fallback: "Bank",
    },
    {
      id: "branch",
      keys: ["branch", "branchName"],
      labels: ["branch", "branchName"],
      aliases: ["branch", "branchname"],
      fallback: "Branch",
    },
    {
      id: "sortcode",
      keys: ["sortCode"],
      labels: ["sortCode"],
      aliases: ["sortcode"],
      fallback: "Sort Code",
      nowrap: true,
    },
    {
      id: "country",
      keys: ["country"],
      labels: ["bankCountry", "country"],
      aliases: ["bankcountry", "country"],
      fallback: "Country",
    },
  ];

  const standard = standardFields.map((field) => {
    const label = bankLabel(invoice, accounts, field.labels, field.fallback);
    const accountValues = accounts.map((account) =>
      accountValue(account, field.keys)
    );
    return {
      id: field.id,
      aliases: new Set([
        field.id,
        ...field.aliases,
        normalizeName(field.fallback),
        normalizeName(label),
      ]),
      row: {
        label,
        values: accountValues.some(Boolean) ? accountValues : [],
        isCountry: field.id === "country",
        nowrap: field.nowrap,
      } as SrTradingBankRow,
    };
  });

  // Repeated labels are one logical row. This also merges a custom field named
  // e.g. "Account Number" into the standard Account Number row, which is how
  // the API represents additional side-by-side bank values in some invoices.
  const customRows = new Map<string, SrTradingBankRow>();
  accounts.forEach((account) => {
    collectionRecords(account.customFields).forEach((fieldValue) => {
      const field = asRecord(fieldValue);
      const label = firstText(field.label, field.name, field.key);
      const value = firstText(field.value, field.defaultValue);
      if (!visibleEntry(field) || !label || !value) return;
      const key = normalizeName(label);
      const nowrap =
        /(?:account(?:number|no)|ifsc|swift|routing|iban|micr|upi|vpa)/.test(
          key
        ) ||
        ["number", "numeric", "integer", "decimal"].includes(
          normalizeName(field.dataType)
        );
      const standardMatch = standard.find((entry) => entry.aliases.has(key));
      if (standardMatch) {
        standardMatch.row.values.push(value);
        standardMatch.row.nowrap = standardMatch.row.nowrap || nowrap;
        return;
      }
      const row = customRows.get(key) ?? { label, values: [], nowrap };
      row.values.push(value);
      row.nowrap = row.nowrap || nowrap;
      customRows.set(key, row);
    });
  });

  return [
    ...standard
      .map((entry) => entry.row)
      .filter((row) => row.values.some(Boolean)),
    ...customRows.values(),
  ];
};

export const mapSrTradingTemplateData = (payload: any) => {
  const rawPayload = asRecord(payload);
  const rawInvoice = Object.keys(asRecord(rawPayload.invoice)).length
    ? asRecord(rawPayload.invoice)
    : rawPayload;
  const explicitBankVisibility =
    optionalBoolean(rawPayload.showBankAccount) ??
    optionalBoolean(rawInvoice.showBankAccount);
  const explicitUpiVisibility =
    optionalBoolean(rawPayload.showUpi) ?? optionalBoolean(rawInvoice.showUpi);
  const base = mapSolvinTemplateData(payload);
  const normalized = normalizeInvoiceTemplateState(payload);
  // Solvin deliberately removes invoice-level additional-information fields.
  // SR Trading renders those fields, so restore the complete normalized invoice
  // while retaining Solvin's normalized/derived values where they overlap.
  const invoice = {
    ...asRecord(normalized.invoice),
    ...asRecord(base.invoice),
  };
  const invoiceCurrencyText = firstText(
    invoice.currency,
    invoice.businessCurrency
  );
  const billedBy = asRecord(invoice.billedBy);
  const letterHead = firstImageSource(
    rawInvoice.letterHead,
    rawInvoice.letterhead,
    rawInvoice.headerImage
  );
  const letterHeadFooter = firstImageSource(
    rawInvoice.letterHeadFooter,
    rawInvoice.letterheadFooter,
    rawInvoice.footerImage
  );
  const labels = asRecord(invoice.customLabels);
  const accounts = bankAccountsFor(invoice);
  const rawBankRows = mapBankRows(invoice, accounts);
  const bankColumnCount = Math.max(
    1,
    accounts.length,
    ...rawBankRows.map((row) => row.values.length)
  );
  const bankRows = rawBankRows.map((row) => ({
    ...row,
    values: Array.from(
      { length: bankColumnCount },
      (_, index) => row.values[index] ?? ""
    ),
  }));

  const paymentOptions = asRecord(invoice.paymentOptions);
  const accountTransferRequested =
    explicitBankVisibility ??
    optionalBoolean(invoice.showBankAccount) ??
    optionalBoolean(paymentOptions.accountTransfer) ??
    base.mapped.visibility.showBankAccount;
  const upiRequested =
    explicitUpiVisibility ??
    optionalBoolean(invoice.showUpi) ??
    optionalBoolean(paymentOptions.upi) ??
    base.mapped.visibility.showUpi;
  const documentAllowed =
    !["creditnote", "debitnote"].includes(normalizeName(invoice.billType)) &&
    normalizeName(invoice.status) !== "canceled";
  const expenditureAllowed =
    optionalBoolean(invoice.isExpenditure) !== true ||
    normalizeName(invoice.invoiceAccepted) === "accepted";
  const hasBankDetails = bankRows.some((row) => row.values.some(Boolean));
  const showBankAccount =
    documentAllowed &&
    expenditureAllowed &&
    accountTransferRequested &&
    hasBankDetails;
  const upiRecord = asRecord(invoice.upi);
  const upiId = firstText(
    upiRecord.upi,
    upiRecord.vpa,
    upiRecord.upiId,
    upiRecord.name
  );
  const suppliedUpiQr = imageSource(
    upiRecord.qr ||
      upiRecord.qrCode ||
      upiRecord.qrImage ||
      upiRecord.qrImageUrl ||
      upiRecord.qrCodeUrl ||
      upiRecord.image ||
      invoice.upiQr ||
      invoice.upiQrCode
  );
  const upiQr = suppliedUpiQr || generateUpiQrDataUrl(upiId);
  const irn = asRecord(invoice.irn);
  const irnCancelled = Boolean(firstText(irn.CancelDate, irn.cancelDate));
  const irnValue = firstText(irn.Irn, irn.irn, invoice.irnNumber);
  const eInvoiceQr = irnCancelled
    ? ""
    : firstImageSource(irn.qrCode, irn.qr, invoice.qrCode);
  const zatcaQrCode = firstImageSource(invoice.zatcaQrCode);
  const lhdnQrCode = firstImageSource(invoice.lhdnQrCode);
  const signature = firstImageSource(
    invoice.signature,
    invoice.signatureImage,
    invoice.authorizedSignature,
    invoice.authorisedSignature
  );
  const signatureRequested =
    optionalBoolean(invoice.showSignature) ??
    optionalBoolean(invoice.showSignatureInInvoice) ??
    optionalBoolean(invoice.signatureShowInInvoice) ??
    configuredFieldVisibility(invoice, "signature");
  const signatureHidden =
    optionalBoolean(invoice.hideSignature) ??
    optionalBoolean(invoice.hideSignatureInInvoice) ??
    false;
  const showSignature =
    !signatureHidden && (signatureRequested ?? Boolean(signature));
  const upiAvailable =
    optionalBoolean(upiRecord.isRemoved) !== true &&
    optionalBoolean(upiRecord.isHardRemoved) !== true;
  const hasUpiDetails = upiAvailable && Boolean(upiId || upiQr);
  const showUpi =
    documentAllowed && expenditureAllowed && upiRequested && hasUpiDetails;

  const hideTaxes =
    optionalBoolean(asRecord(base.advanceOptions).hideTaxes) ??
    optionalBoolean(invoice.hideTaxes) ??
    false;
  const showTaxes = !hideTaxes;
  const taxColumnKeys = new Set([
    "gst",
    "gstrate",
    "tax",
    "taxrate",
    "igst",
    "cgst",
    "sgst",
    "utgst",
    "cess",
    "cessrate",
    "cessamount",
  ]);
  const rawColumns = asArray<UnknownRecord>(invoice.columns);
  const sourceColumns = base.mapped.columns.map((column) => {
    const key = normalizeName(column.key);
    const rawColumn = rawColumns.find(
      (candidate) => normalizeName(candidate.key) === key
    );
    const configuredColumn = {
      ...column,
      label: firstText(asRecord(rawColumn).label, column.label),
    };
    if (["sr", "srno", "sno", "rownumber", "index"].includes(key)) {
      return { ...configuredColumn, label: "" };
    }
    if (!showTaxes && (taxColumnKeys.has(key) || column.isCessColumn)) {
      return { ...configuredColumn, isHidden: true };
    }
    return configuredColumn;
  });
  const hsnKeys = ["hsn", "sac", "hsncode", "hsnsac"];
  const rawHsnColumn = asArray<UnknownRecord>(invoice.columns).find((column) =>
    hsnKeys.includes(normalizeName(column.key))
  );
  const hsnExplicitlyHidden =
    hsnKeys.some((key) => configuredFieldVisibility(invoice, key) === false) ||
    optionalBoolean(asRecord(rawHsnColumn).isHidden) === true;
  const hsnView = normalizeName(asRecord(invoice.advanceOptions).hsnView);
  const hsnViewHidden = ["hide", "hidden", "none", "donotshow", "off"].includes(
    hsnView
  );
  // SR Trading has a fixed visual contract: visible HSN/SAC values always use
  // their own line-item column. Placement settings such as MERGE must not move
  // them into the Item cell; explicit visibility settings still remain valid.
  const showInlineHsn = false;
  const showHsnColumn = !hsnExplicitlyHidden && !hsnViewHidden;
  const columns = [...sourceColumns];
  const hsnColumnIndex = columns.findIndex((column) =>
    hsnKeys.includes(normalizeName(column.key))
  );

  if (showHsnColumn && hsnColumnIndex >= 0) {
    columns[hsnColumnIndex] = {
      ...columns[hsnColumnIndex],
      label: firstText(
        columns[hsnColumnIndex].label,
        labels.hsn,
        labels.hsnSac,
        "HSN/SAC"
      ),
      className: "col-hsn-sac",
      isHidden: false,
    };
  } else if (showHsnColumn) {
    const itemColumnIndex = columns.findIndex((column) =>
      ["item", "name", "description"].includes(normalizeName(column.key))
    );
    columns.splice(itemColumnIndex >= 0 ? itemColumnIndex + 1 : 1, 0, {
      key: "hsn",
      label: firstText(labels.hsn, labels.hsnSac, "HSN/SAC"),
      className: "col-hsn-sac",
      isHidden: false,
      dataType: "string",
      fxReturnType: "",
      isCessColumn: false,
      summarise: false,
    });
  }

  const visibleColumnCount = columns.filter(
    (column) => optionalBoolean(column.isHidden) !== true
  ).length;
  const tableMinWidth = itemsTableMinWidth(columns);
  const isDescriptionFullWidth =
    optionalBoolean(
      asRecord(invoice.advanceOptions).showDescriptionInFullWidth
    ) ??
    optionalBoolean(asRecord(invoice.advanceOptions).isDescriptionFullWidth) ??
    optionalBoolean(invoice.showDescriptionInFullWidth) ??
    optionalBoolean(invoice.isDescriptionFullWidth) ??
    false;
  const showTotals = !(
    optionalBoolean(asRecord(base.advanceOptions).hideTotals) ??
    optionalBoolean(invoice.hideTotals) ??
    false
  );
  const configuredDueVisibility = ["dueAmount", "balanceDue", "due", "toPay"]
    .map((fieldName) => configuredFieldVisibility(invoice, fieldName))
    .find((value) => value !== undefined);
  const explicitlyShownDueAmount =
    optionalBoolean(asRecord(base.advanceOptions).showDueAmount) ??
    optionalBoolean(asRecord(base.advanceOptions).showBalanceDue) ??
    optionalBoolean(invoice.showDueAmount) ??
    optionalBoolean(invoice.showBalanceDue);
  const explicitlyHiddenDueAmount =
    optionalBoolean(asRecord(base.advanceOptions).hideDueAmount) ??
    optionalBoolean(asRecord(base.advanceOptions).hideBalanceDue) ??
    optionalBoolean(invoice.hideDueAmount) ??
    optionalBoolean(invoice.hideBalanceDue);
  const explicitDueVisibility =
    configuredDueVisibility ??
    explicitlyShownDueAmount ??
    (explicitlyHiddenDueAmount === undefined
      ? undefined
      : !explicitlyHiddenDueAmount);
  const dueStatus = normalizeName(invoice.status);
  const isOverdue = optionalBoolean(invoice.isOverdue) === true;
  const statusRequiresDueAmount =
    ["partial", "partpaid", "partiallypaid", "overdue"].includes(dueStatus) ||
    isOverdue;
  const statusSuppressesDueAmount =
    !isOverdue &&
    [
      "draft",
      "issued",
      "unpaid",
      "paid",
      "canceled",
      "cancelled",
      "rejected",
    ].includes(dueStatus);
  const outstandingDueAmount = optionalNumericValue(base.totals.dueAmount);
  // A newly issued UNPAID invoice has an outstanding balance, but it is not
  // yet a meaningful Due Amount. Show it for overdue/part-paid states, or for
  // a non-terminal custom state that explicitly enables the field. An
  // explicit hide remains authoritative in every state.
  const showDueAmount =
    showTotals &&
    outstandingDueAmount !== undefined &&
    outstandingDueAmount > 0 &&
    explicitDueVisibility !== false &&
    (statusRequiresDueAmount ||
      (explicitDueVisibility === true && !statusSuppressesDueAmount));
  const balance = asRecord(invoice.balance);
  const paymentBalanceRows = [
    {
      aliases: ["tdsAmountWithheld", "tdsAmount", "tds"],
      label: firstText(
        labels.tdsAmountWithheld,
        labels.tdsAmount,
        labels.tds,
        base.display.labels.tdsAmountWithheld
      ),
      amount: firstNumber(balance.tds, balance.tdsAmount, invoice.tdsAmount),
      deduction: true,
    },
    {
      aliases: [
        "paidAmount",
        "amountPaid",
        "paid",
        "partPaid",
        "partialPaid",
        "partPaidAmount",
        "partialPaidAmount",
      ],
      label: firstText(
        labels.paidAmount,
        labels.amountPaid,
        labels.partPaid,
        labels.partialPaid,
        labels.paid,
        base.display.labels.amountPaid
      ),
      amount: firstNumber(
        balance.paid,
        balance.paidAmount,
        balance.amountPaid,
        balance.partPaid,
        balance.partialPaid,
        balance.partPaidAmount,
        balance.partialPaidAmount,
        invoice.paidAmount,
        invoice.amountPaid
      ),
      deduction: true,
    },
    {
      aliases: ["amountReceived", "settledAmount", "receivedAmount"],
      label: firstText(
        labels.amountReceived,
        labels.receivedAmount,
        labels.settledAmount,
        base.display.labels.amountReceived
      ),
      amount: firstNumber(
        balance.settledAmount,
        balance.amountReceived,
        balance.receivedAmount
      ),
      deduction: false,
    },
    {
      aliases: ["transactionCharge", "paymentTransactionCharge"],
      label: firstText(
        labels.transactionCharge,
        labels.paymentTransactionCharge,
        base.display.labels.transactionCharge
      ),
      amount: firstNumber(
        balance.transactionCharge,
        balance.paymentTransactionCharge
      ),
      deduction: false,
    },
    {
      aliases: ["creditAmount", "credit"],
      label: firstText(labels.creditAmount, labels.credit, "Credit"),
      amount: firstNumber(balance.credit, balance.creditAmount),
      deduction: true,
    },
    {
      aliases: ["refundAmount", "refund"],
      label: firstText(labels.refundAmount, labels.refund, "Refund"),
      amount: firstNumber(balance.refund, balance.refundAmount),
      deduction: false,
    },
  ]
    .filter(({ aliases, amount }) => {
      const visibility = aliases
        .map((fieldName) => configuredFieldVisibility(invoice, fieldName))
        .find((value) => value !== undefined);
      return amount !== undefined && amount !== 0 && visibility !== false;
    })
    .map(({ label, amount, deduction }) => ({ label, amount, deduction }));
  const showTotalsRow =
    showTotals &&
    (optionalBoolean(invoice.showTotalsRow) ??
      optionalBoolean(asRecord(base.advanceOptions).showTotalsRow) ??
      false);
  const showTotalInWords =
    (optionalBoolean(asRecord(base.advanceOptions).showTotalInWords) ??
      optionalBoolean(invoice.showTotalInWords) ??
      true) &&
    optionalBoolean(asRecord(base.advanceOptions).hideTotalInWords) !== true &&
    optionalBoolean(invoice.hideTotalInWords) !== true;
  const showTerms =
    base.mapped.visibility.showTerms &&
    (optionalBoolean(asRecord(base.advanceOptions).showTerms) ??
      optionalBoolean(invoice.showTermsInInvoice) ??
      optionalBoolean(invoice.showTerms) ??
      true) &&
    optionalBoolean(asRecord(base.advanceOptions).hideTerms) !== true &&
    optionalBoolean(invoice.hideTerms) !== true;
  const advanceOptions = asRecord(invoice.advanceOptions);
  const taxSummary = suppliedTaxSummary(
    invoice,
    base.mapped.visibility.showIgst,
    base.mapped.visibility.isUtgst
  );
  const hsnSummary = suppliedHsnSummary(
    invoice,
    base.mapped.visibility.showIgst,
    base.mapped.visibility.isUtgst
  );
  const taxSummaryView = normalizeName(advanceOptions.taxSummaryView);
  const showTaxSummary =
    showTaxes &&
    taxSummary.hasRows &&
    (taxSummaryView
      ? ["table", "both"].includes(taxSummaryView)
      : base.mapped.visibility.showTaxTable);
  const showHsnSummary =
    showTaxes &&
    hsnSummary.hasRows &&
    (optionalBoolean(advanceOptions.showHsnSummary) ??
      optionalBoolean(advanceOptions.showHSNSummaryInInvoice) ??
      base.mapped.visibility.showHsnSummary);
  const documentType = firstText(
    invoice.billType,
    invoice.invoiceType,
    "Document"
  );
  const documentTitle = firstText(
    invoice.invoiceTitle,
    labels.documentTitle,
    labels.title,
    humanize(documentType),
    "Document"
  );
  const isQuotation = normalizeName(documentType).includes("quotation");
  const documentNumber = isQuotation
    ? firstText(invoice.quotationNumber, invoice.invoiceNumber)
    : firstText(invoice.invoiceNumber, invoice.quotationNumber);
  const numberLabel = isQuotation
    ? firstText(
        labels.quotationNumber,
        labels.documentNumber,
        `${documentTitle} No`
      )
    : firstText(
        labels.invoiceNumber,
        labels.documentNumber,
        `${documentTitle} No`
      );
  const dateLabel = isQuotation
    ? firstText(
        labels.quotationDate,
        labels.documentDate,
        `${documentTitle} Date`
      )
    : firstText(
        labels.invoiceDate,
        labels.documentDate,
        `${documentTitle} Date`
      );
  const catalogueLogo = firstImageSource(invoice.logo, billedBy.logo);
  const reverseChargeSetting = [
    invoice.reverseCharge,
    invoice.isReverseCharge,
    invoice.reverseChargeApplicable,
    invoice.reverseChargeBasis,
  ]
    .map(optionalBoolean)
    .find((value) => value !== undefined);
  const additionalInformationRows = mapAdditionalInformationRows(invoice);
  let reverseChargeValue = "";
  if (reverseChargeSetting !== undefined) {
    reverseChargeValue = reverseChargeSetting ? "Yes" : "No";
  }
  const showLowerSection =
    showTerms ||
    base.mapped.visibility.showNotes ||
    additionalInformationRows.length > 0 ||
    (documentAllowed && expenditureAllowed && (showBankAccount || showUpi));
  return {
    ...base,
    invoice,
    mapped: {
      ...base.mapped,
      columns,
      taxSummary,
      hsnSummary,
      visibility: {
        ...base.mapped.visibility,
        showTaxes,
        showIgst: showTaxes && base.mapped.visibility.showIgst,
        showCgstSgst: showTaxes && base.mapped.visibility.showCgstSgst,
        showBankAccount,
        showUpi,
        showBankUpiSection:
          documentAllowed && expenditureAllowed && (showBankAccount || showUpi),
        showCountryOfSupply: normalized.mapped.visibility.showCountryOfSupply,
        showPlaceOfSupply: normalized.mapped.visibility.showPlaceOfSupply,
        showSerialNumbersInDescription:
          optionalBoolean(
            asRecord(invoice.advanceOptions).showSerialNumbersInDescription
          ) ??
          optionalBoolean(invoice.showSerialNumbersInDescription) ??
          false,
        isDescriptionFullWidth,
        showTotals,
        showDueAmount,
        showTotalsRow,
        showTotalInWords,
        showSignature,
        showTerms,
        showTaxSummary,
        showHsnSummary,
        showSummaryTables: showTaxSummary || showHsnSummary,
        showLowerSection,
        showHsn: showHsnColumn,
        showInlineHsn,
        visibleColumnCount,
        hideCurrencyCode:
          optionalBoolean(asRecord(base.advanceOptions).hideCurrencyCode) ??
          optionalBoolean(invoice.hideCurrencyCode) ??
          false,
        denseItemsTable: visibleColumnCount >= 11,
      },
    },
    display: {
      ...base.display,
      currency: invoiceCurrencyText || base.display.currency,
      labels: {
        ...base.display.labels,
        dueAmount: firstText(
          primaryLabelText(labels.dueAmount),
          primaryLabelText(labels.balanceDue),
          base.display.labels.dueAmount
        ),
      },
      assets: {
        letterHead,
        letterHeadFooter,
      },
      tableMinWidth,
      paymentBalanceRows,
      document: {
        title: documentTitle,
        number: documentNumber,
        date: firstText(invoice.invoiceDate, invoice.invoiceDateUserInput),
        validTill: firstText(invoice.dueDate),
        labels: {
          quotationTo: firstText(
            labels.billedTo,
            labels.quotationTo,
            `${documentTitle} To:`
          ),
          number: numberLabel,
          date: dateLabel,
          validTill: firstText(
            labels.validTillDate,
            labels.dueDate,
            isQuotation ? "Valid Till Date" : "Due Date"
          ),
          catalogueTitle: firstText(
            invoice.documentQrTitle,
            labels.catalogueTitle,
            "Scan here to view our product catalogue"
          ),
          catalogueDescription: firstText(
            invoice.documentQrDescription,
            labels.catalogueDescription,
            "This catalogue contains a selected range of our products. Please contact us for products not listed here."
          ),
          scanToPay: firstText(labels.scanToPay, "Scan To Pay"),
          upiId: firstText(labels.upiId, labels.upi, "UPI ID"),
          bankDetails: firstText(labels.bankDetails, "Bank and UPI details"),
          shippedTo: firstText(labels.shippedTo, "Shipped To"),
          gstin: firstText(labels.gstin, "GSTIN"),
          pan: firstText(labels.pan, labels.panNumber, "PAN"),
          trn: firstText(labels.trn, labels.trnNumber, "TRN"),
          tin: firstText(labels.tin, labels.tinNumber, "TIN"),
          vat: firstText(labels.vat, labels.vatNumber, "VAT"),
          sst: firstText(labels.sst, labels.sstNumber, "SST"),
          email: firstText(labels.email, "Email"),
          phone: firstText(labels.phone, "Phone"),
          purchaseOrderNumber: firstText(labels.purchaseOrderNumber, "PO No"),
          reverseCharge: firstText(labels.reverseCharge, "Reverse Charge"),
          irn: firstText(labels.irn, "IRN"),
          totalInWords: firstText(labels.totalInWords, "Total (in words)"),
          terms: firstText(base.display.labels.terms, "Terms and Conditions"),
          sku: firstText(labels.sku, "SKU"),
          serialNumber: firstText(labels.serialNumber, "Serial No."),
          hsn: firstText(labels.hsn, labels.hsnSac, "HSN/SAC"),
          classification: firstText(labels.classification, "Classification"),
          unit: firstText(labels.unit, "Unit"),
          taxSummary: firstText(labels.taxSummary, "Tax Summary"),
          hsnSummary: firstText(
            labels.hsnSummary,
            labels.hsn,
            labels.hsnSac,
            "HSN/SAC Summary"
          ),
          taxRate: firstText(labels.taxRate, "Tax Rate"),
          taxableValue: firstText(labels.taxableValue, "Taxable Value"),
          rate: firstText(labels.rate, "Rate"),
          amount: firstText(labels.amount, "Amount"),
          totalTax: firstText(labels.totalTax, "Total Tax"),
          totalTaxInWords: firstText(labels.totalTaxInWords, "Total In Words"),
          igst: firstText(labels.igst, invoice.taxName, "IGST"),
          cgst: firstText(labels.cgst, "CGST"),
          sgst: firstText(labels.sgst, "SGST"),
          utgst: firstText(labels.utgst, "UTGST"),
        },
        catalogueLogo,
        reverseChargeValue,
      },
      bankRows,
      bankColumnCount,
      cessRows: base.display.cessRows.map((row) => ({
        ...row,
        hasAmount: true,
      })),
      additionalInformationRows,
      totalInWordsValue: firstText(
        labels.totalInWordsValue,
        invoice.totalInWords,
        invoice.amountInWords,
        asRecord(invoice.finalTotal).totalInWords
      ),
      signature,
      upiQr,
      upiId,
      compliance: {
        irnValue,
        eInvoiceQr,
        zatcaQrCode,
        lhdnQrCode,
      },
    },
  };
};

export type SrTradingTemplateState = ReturnType<
  typeof mapSrTradingTemplateData
>;
