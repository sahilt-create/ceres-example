import formatCurrency from "../../widgets/shared/formatCurrency";

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
    party.state,
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

  return formatCurrency(
    amount,
    invoice.currency || invoice.businessCurrency || "INR",
    invoice.locale || invoice.businessLocale || "en-IN",
    precision,
    invoice.customCurrencySymbol
  );
};
