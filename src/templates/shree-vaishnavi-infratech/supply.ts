/**
 * Country / Place of Supply, worked out inside the template with the same
 * rules as the renderer's normalizer (src/main/invoiceTemplateNormalization),
 * so the template shows the same values whichever renderer version it is
 * deployed with.
 *
 * - Country of Supply: invoice.countryOfSupply, else billedTo.country.
 * - Place of Supply: invoice.placeOfSupply, else pos / billedTo.gstState /
 *   state / stateCode. A GST state code ("32") becomes the state name
 *   ("Kerala"); for supply outside India the billed-to state, city or
 *   country is used instead of an Indian GST code.
 * - Shown when it has a value, unless invoiceValueProps, show* or hide*
 *   (advanceOptions, then the invoice) say otherwise.
 */

type UnknownRecord = Record<string, any>;

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

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const toText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
};

const firstValue = (...values: unknown[]): unknown =>
  values.find(
    (value) =>
      value !== null &&
      value !== undefined &&
      (typeof value !== "string" || value.trim().length > 0)
  );

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off", ""].includes(normalized)) return false;
  return undefined;
};

const gstCode = (value: unknown): string => {
  const match = toText(value).match(/^0?(\d{1,2})(?:\D|$)/);
  return match ? match[1].padStart(2, "0") : "";
};

const stateName = (value: unknown): string => {
  const normalized = toText(value);
  if (!normalized || /^\d{1,2}$/.test(normalized)) return "";
  const prefixedName = normalized.match(/^0?\d{1,2}\s*[-:]\s*(.+)$/);
  return toText(prefixedName?.[1]) || normalized;
};

export const countryOfSupply = (invoice: UnknownRecord): string =>
  toText(
    firstValue(invoice.countryOfSupply, asRecord(invoice.billedTo).country)
  );

export const placeOfSupply = (invoice: UnknownRecord): string => {
  const billedTo = asRecord(invoice.billedTo);
  const place = toText(
    firstValue(
      invoice.placeOfSupply,
      invoice.pos,
      billedTo.gstState,
      billedTo.state,
      billedTo.stateCode
    )
  );

  const supplyCountry = countryOfSupply(invoice).toUpperCase();
  const hasGstCode = /^0?\d{1,2}(?:\D|$)/.test(place);
  if (supplyCountry && supplyCountry !== "IN" && hasGstCode) {
    const destination = [billedTo.state, billedTo.city, supplyCountry]
      .map(toText)
      .find((value) => value && !/^0?\d{1,2}(?:\D|$)/.test(value));
    return destination || place;
  }

  if (!/^\d{1,2}$/.test(place)) return place;

  const code = gstCode(place);
  const billedToCode = gstCode(
    firstValue(billedTo.stateCode, billedTo.gstState)
  );
  const billedToState =
    stateName(billedTo.state) || stateName(billedTo.gstState);
  if (billedToCode === code && billedToState) return billedToState;
  return INDIA_GST_STATE_NAMES[code] || place;
};

export const isSupplyFieldVisible = (
  invoice: UnknownRecord,
  advanceOptions: UnknownRecord,
  field: "countryOfSupply" | "placeOfSupply",
  value: string
): boolean => {
  if (!value) return false;
  const suffix =
    field === "countryOfSupply" ? "CountryOfSupply" : "PlaceOfSupply";

  const valueProps = asRecord(invoice.invoiceValueProps);
  const propKey = Object.keys(valueProps).find(
    (candidate) => candidate.toLowerCase() === field.toLowerCase()
  );
  let configured: boolean | undefined;
  if (propKey) {
    const setting = valueProps[propKey];
    configured =
      optionalBoolean(setting) ??
      optionalBoolean(asRecord(setting).visible) ??
      optionalBoolean(asRecord(setting).showInInvoice);
  }

  const shown = optionalBoolean(
    advanceOptions[`show${suffix}`] ?? invoice[`show${suffix}`]
  );
  const hidden = optionalBoolean(
    advanceOptions[`hide${suffix}`] ?? invoice[`hide${suffix}`]
  );
  return configured ?? shown ?? (hidden === undefined ? true : !hidden);
};
