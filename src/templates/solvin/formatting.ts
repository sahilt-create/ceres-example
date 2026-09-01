import formatCurrency from "../../widgets/shared/formatCurrency";
import { normalizePlaceOfSupply } from "../../main/invoiceTemplateNormalization";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

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

/**
 * Wraps the shared currency widget's formatted value so its actual symbol and
 * configured precision stay consistent in preview, paged, and Pageless PDFs.
 */
export const formatSolvinCurrencyMarkup = (
  amount: any,
  invoiceValue?: any
): string => {
  const formatted = formatSolvinCurrency(amount, invoiceValue);

  return `<span class="solvin-money">${escapeHtml(formatted)}</span>`;
};
