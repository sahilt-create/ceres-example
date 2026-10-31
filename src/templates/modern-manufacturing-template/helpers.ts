/*
 * View model for the Modern Manufacturing template.
 *
 * The template keeps `normalizeInvoiceTemplateState` as its data mapper and asks for this
 * model once, through `{{#with (mmView @root) as |view|}}`. Every value here comes from the
 * payload: labels resolve through `customLabels` (or the column's own label) and the English
 * words are only fallbacks for a key the business has never set. Nothing from the reference
 * design is written into the markup.
 *
 * Money in the tables prints as a grouped figure without a symbol — the totals block (shared
 * Subtotal widget) carries the currency. Dates stay raw here and are formatted in the
 * template by the shared date-time widget, so the owner offset rule lives in one place.
 */

import {
  normalizeCountryOfSupply,
  normalizePlaceOfSupply,
} from "../../main/invoiceTemplateNormalization";
import type { FlattenedInvoicePayload } from "../../main/invoicePayloadContract";
import amountInWords from "../../widgets/shared/amountInWords";
import formatCurrency from "../../widgets/shared/formatCurrency";
import {
  asArray,
  asRecord,
  asText,
  isRecord,
  pickFirst,
  toAmount,
} from "../../widgets/shared/payloadValues";
import type { UnknownRecord } from "../../widgets/shared/payloadValues";
import { resolveTaxLabel } from "../../widgets/shared/taxRowLabels";
import { toImageSrc } from "../../widgets/image/utils";
import { computeSubtotalRows } from "../../widgets/subtotal/utils";
import type { SubtotalRow } from "../../widgets/subtotal/utils";
import type { ImageInput } from "../../widgets/image/utils";

interface FormatContext {
  locale: string;
  digits: number;
  currency: string;
  symbol: string;
}

export interface LabelValue {
  key: string;
  label: string;
  value: string;
  isDate?: boolean;
  isUtcDate?: boolean;
  isHidden?: boolean;
  isNum?: boolean;
  attr?: string;
}

type ColumnKind =
  | "name"
  | "code"
  | "qty"
  | "money"
  | "percent"
  | "discount"
  | "number"
  | "text";

export interface ItemColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  className: string;
  summable: boolean;
  /* A date column (Expiry Date, a custom date field): printed as the document's dates are. */
  isDate?: boolean;
}

const NUMERIC_KINDS: ColumnKind[] = [
  "qty",
  "money",
  "percent",
  "discount",
  "number",
];

const MONEY_KEYS = ["rate", "amount", "igst", "cgst", "sgst", "utgst", "total"];
const CODE_KEYS = ["hsn", "classification", "sku", "batch", "unit"];

/* ------------------------------------------------------------------ values */

const text = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asText(value).trim();
};

const firstText = (...values: unknown[]): string =>
  values.map(text).find(Boolean) || "";

const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && text(value) !== "";

/* Opt-out convention: only an explicit false (or "false") hides. */
const isOff = (value: unknown): boolean =>
  value === false || text(value).toLowerCase() === "false";

const formatNumber = (
  value: number,
  locale: string,
  min: number,
  max: number
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(value);
  } catch {
    // Only as many digits as the value has, as the formatter would give.
    return String(Number(value.toFixed(max)));
  }
};

/*
 * Money everywhere (table, Total row, HSN summary, currency fields) goes through the shared
 * formatCurrency, as the totals widget does: the document's currency symbol (or its custom
 * one), its locale's grouping, its decimal places (subUnitLength, else 2), negatives in
 * brackets.
 */
export const formatMoney = (value: unknown, ctx: FormatContext): string =>
  hasValue(value)
    ? formatCurrency(
        toAmount(value),
        ctx.currency,
        ctx.locale,
        ctx.digits,
        ctx.symbol || undefined
      )
    : "";

/* The document's decimal places (subUnitLength), else 2 — Refrens' default. */
export const moneyDigits = (invoice: UnknownRecord): number => {
  const digits = invoice.subUnitLength;
  return typeof digits === "number" && Number.isInteger(digits) && digits >= 0
    ? digits
    : 2;
};

export const formatContext = (invoice: UnknownRecord): FormatContext => ({
  locale: firstText(invoice.locale, asRecord(invoice.owner).locale, "en-IN"),
  digits: moneyDigits(invoice),
  currency: firstText(invoice.currency, "INR"),
  symbol: text(invoice.customCurrencySymbol),
});

/*
 * Refrens' own default the shared normalizer reads differently, applied before it: a document
 * that never chose how units print (advanceOptions.unitColumn unset) shows them in their own
 * Unit column, as refrens.com does (304 of the test-janvi documents); the normalizer would
 * merge them into Quantity. Ported from the Ecommerce template.
 */
const UNIT_CHOICES = [
  "unitColumn",
  "unitDisplay",
  "showUnit",
  "showUnitInName",
  "showUnitInQuantity",
  "showUnitAsColumn",
  "showUnitColumn",
];

export const withRefrensDefaults = <T>(payload: T): T => {
  const root = asRecord(payload);
  const wrapped = isRecord(root.invoice);
  const invoice = wrapped ? asRecord(root.invoice) : root;
  const options = asRecord(invoice.advanceOptions);
  const chosen = UNIT_CHOICES.some(
    (key) => options[key] !== undefined && options[key] !== null
  );
  if (chosen) return payload;
  const fixed = {
    ...invoice,
    advanceOptions: { ...options, unitColumn: "SEPARATE_COLUMN" },
  };
  return (wrapped ? { ...root, invoice: fixed } : fixed) as T;
};

/*
 * The template's data mapper: the shared normalizer, then the document's decimal places made
 * explicit, so the shared widgets that format money from the document itself (totals, tax
 * summary, payment record) print every figure with the same decimals as the table — a whole
 * amount as "625,975.00", not "625,975".
 */
export const withMoneyDefaults = <T>(state: T): T => {
  const invoice = asRecord(asRecord(state).invoice);
  if (
    asRecord(state).invoice &&
    invoice.subUnitLength !== moneyDigits(invoice)
  ) {
    invoice.subUnitLength = moneyDigits(invoice);
  }
  return state;
};

/* ------------------------------------------------------------------ language, script, direction */

/*
 * Lydia's "Change Script" setting: the document's language/script and "Enable right-to-left
 * script". The page takes the language (lang), the direction (dir: the layout mirrors through
 * logical CSS) and a Noto face for scripts Inter does not cover, set after the body font so
 * Latin text keeps its own. The field names are read as the Sri Lankan template reads them
 * (template object, then the document), with the common spellings of each.
 */
export interface DocumentScript {
  direction: "rtl" | "ltr";
  isRtl: boolean;
  lang: string;
  font: string;
}

// Language or script (name, ISO 639 code or ISO 15924 code) → [lang, Google font].
const SCRIPT_FONTS: Record<string, [string, string]> = {
  arabic: ["ar", "Noto Sans Arabic"],
  arab: ["ar", "Noto Sans Arabic"],
  ar: ["ar", "Noto Sans Arabic"],
  urdu: ["ur", "Noto Sans Arabic"],
  ur: ["ur", "Noto Sans Arabic"],
  persian: ["fa", "Noto Sans Arabic"],
  farsi: ["fa", "Noto Sans Arabic"],
  fa: ["fa", "Noto Sans Arabic"],
  hebrew: ["he", "Noto Sans Hebrew"],
  hebr: ["he", "Noto Sans Hebrew"],
  he: ["he", "Noto Sans Hebrew"],
  hindi: ["hi", "Noto Sans Devanagari"],
  hi: ["hi", "Noto Sans Devanagari"],
  devanagari: ["hi", "Noto Sans Devanagari"],
  deva: ["hi", "Noto Sans Devanagari"],
  marathi: ["mr", "Noto Sans Devanagari"],
  mr: ["mr", "Noto Sans Devanagari"],
  nepali: ["ne", "Noto Sans Devanagari"],
  ne: ["ne", "Noto Sans Devanagari"],
  bengali: ["bn", "Noto Sans Bengali"],
  bangla: ["bn", "Noto Sans Bengali"],
  beng: ["bn", "Noto Sans Bengali"],
  bn: ["bn", "Noto Sans Bengali"],
  gujarati: ["gu", "Noto Sans Gujarati"],
  gujr: ["gu", "Noto Sans Gujarati"],
  gu: ["gu", "Noto Sans Gujarati"],
  punjabi: ["pa", "Noto Sans Gurmukhi"],
  gurmukhi: ["pa", "Noto Sans Gurmukhi"],
  guru: ["pa", "Noto Sans Gurmukhi"],
  pa: ["pa", "Noto Sans Gurmukhi"],
  tamil: ["ta", "Noto Sans Tamil"],
  taml: ["ta", "Noto Sans Tamil"],
  ta: ["ta", "Noto Sans Tamil"],
  telugu: ["te", "Noto Sans Telugu"],
  telu: ["te", "Noto Sans Telugu"],
  te: ["te", "Noto Sans Telugu"],
  kannada: ["kn", "Noto Sans Kannada"],
  knda: ["kn", "Noto Sans Kannada"],
  kn: ["kn", "Noto Sans Kannada"],
  malayalam: ["ml", "Noto Sans Malayalam"],
  mlym: ["ml", "Noto Sans Malayalam"],
  ml: ["ml", "Noto Sans Malayalam"],
  odia: ["or", "Noto Sans Oriya"],
  oriya: ["or", "Noto Sans Oriya"],
  orya: ["or", "Noto Sans Oriya"],
  or: ["or", "Noto Sans Oriya"],
  sinhala: ["si", "Noto Sans Sinhala"],
  sinh: ["si", "Noto Sans Sinhala"],
  si: ["si", "Noto Sans Sinhala"],
  thai: ["th", "Noto Sans Thai"],
  th: ["th", "Noto Sans Thai"],
  chinese: ["zh", "Noto Sans SC"],
  hans: ["zh", "Noto Sans SC"],
  zh: ["zh", "Noto Sans SC"],
  japanese: ["ja", "Noto Sans JP"],
  jpan: ["ja", "Noto Sans JP"],
  ja: ["ja", "Noto Sans JP"],
  korean: ["ko", "Noto Sans KR"],
  kore: ["ko", "Noto Sans KR"],
  ko: ["ko", "Noto Sans KR"],
};

/* A set flag: true / "true" / 1, false / "false" / 0; anything else is not set. */
const flagSetting = (value: unknown): boolean | undefined => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const word = text(value).toLowerCase();
  if (word === "true" || word === "1") return true;
  if (word === "false" || word === "0") return false;
  return undefined;
};

/* A setting given as text or as a picked option ({ value, label, code }). */
const optionText = (value: unknown): string => {
  const option = asRecord(value);
  return Object.keys(option).length
    ? firstText(option.value, option.code, option.label, option.name)
    : text(value);
};

export const mapDocumentScript = (...sources: unknown[]): DocumentScript => {
  // Later sources win: the template object, the document's template, the document.
  const settings = Object.assign({}, ...sources.map(asRecord)) as UnknownRecord;
  const rtlFlag = [
    "enableRtl",
    "enableRTL",
    "isRtl",
    "isRTL",
    "rtl",
    "rightToLeft",
  ]
    .map((key) => flagSetting(settings[key]))
    .find((flag) => flag !== undefined);
  const direction = text(
    firstText(settings.direction, settings.textDirection, settings.dir)
  ).toLowerCase();
  const isRtl = rtlFlag ?? direction === "rtl";

  const language = [
    settings.languageScript,
    settings.script,
    settings.scriptLanguage,
    settings.language,
    settings.languageCode,
  ]
    .map(optionText)
    .find(Boolean);
  const key = (language || "").toLowerCase().split(/[-_\s(]/)[0];
  const [lang, font] = SCRIPT_FONTS[key] || ["", ""];

  return { direction: isRtl ? "rtl" : "ltr", isRtl, lang, font };
};

/*
 * The data mapper's step: the script settings read before the shared normalizer drops the
 * top-level template object, kept on the state for the view.
 */
export const withDocumentScript = <T>(
  state: T,
  payload: unknown
): T & { documentScript?: DocumentScript } => {
  const raw = asRecord(payload);
  const rawInvoice = asRecord(raw.invoice);
  const record = asRecord(state);
  if (Object.keys(record).length) {
    record.documentScript = mapDocumentScript(
      raw.template,
      rawInvoice.template,
      asRecord(record.invoice).template
    );
  }
  return state as T & { documentScript?: DocumentScript };
};

/* The script's Google font, loaded once (the body font stays first for Latin text). */
export const loadScriptFont = (font: string): void => {
  if (!font || typeof document === "undefined") return;
  const id = `mm-script-font-${font.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(
    / /g,
    "+"
  )}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
};

export const formatQuantity = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? formatNumber(toAmount(value), ctx.locale, 0, 3) : "";

const formatPercent = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? `${formatQuantity(value, ctx)}%` : "";

/* ------------------------------------------------------------------ dates */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* "+05:30" / "-0400" / minutes → minutes. The platform's default offset is IST. */
const offsetMinutes = (offset: unknown): number => {
  if (typeof offset === "number" && Number.isFinite(offset)) return offset;
  const match = (text(offset) || "+05:30").match(
    /^([+-]?)(\d{1,2}):?(\d{2})?$/
  );
  if (!match) return 330;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return match[1] === "-" ? -minutes : minutes;
};

/*
 * Document dates print as "21-Sep-2026". An instant (ISO with Z / an offset, or epoch ms) is
 * shifted into the business's offset first; a zone-less value ("2026-09-21", or the IST-encoded
 * IRN "2026-09-21 11:20:00") is already local, so its own date parts print as they are.
 * Anything unparseable prints as given rather than as a wrong date.
 */
export const formatDocumentDate = (
  value: unknown,
  offset?: unknown
): string => {
  const raw = typeof value === "number" ? "" : text(value);
  if (!raw && typeof value !== "number") return "";
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return `${parts[3]}-${MONTHS[Number(parts[2]) - 1]}-${parts[1]}`;
  }
  const time = typeof value === "number" ? value : Date.parse(raw);
  if (!Number.isFinite(time)) return raw;
  const shifted = new Date(time + offsetMinutes(offset) * 60000);
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${day}-${MONTHS[shifted.getUTCMonth()]}-${shifted.getUTCFullYear()}`;
};

/* ------------------------------------------------------------------ labels */

/* A row label: the business override when set, otherwise the fallback word. */
const labelOr = (labels: UnknownRecord, key: string, fallback: string) =>
  firstText(labels[key], fallback);

/*
 * A section heading: an empty override deliberately hides it (the platform's guarded
 * heading), so only a key that was never set falls back.
 */
const heading = (labels: UnknownRecord, key: string, fallback: string) =>
  typeof labels[key] === "string" ? text(labels[key]) : fallback;

/* ------------------------------------------------------------------ settings */

/*
 * The document's template settings (`invoice.template`): the business's theme colour and the
 * two layout choices of spec v2 §6. Every other §6 toggle is the document's own data (a
 * section shows when it has content and the business has not switched it off).
 */
const DEFAULT_THEME = "#013d7f";

const hexColor = (value: unknown): string => {
  const raw = text(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  return /^#[0-9a-f]{3}$/.test(raw)
    ? `#${Array.from(raw.slice(1), (digit) => digit + digit).join("")}`
    : "";
};

/* The light tint of a theme colour used for the dividers between table header cells. */
export const themeTint = (hex: string): string => {
  const [r, g, b] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  const saturation =
    chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (chroma !== 0 && max === r) hue = ((g - b) / chroma + 6) % 6;
  else if (chroma !== 0 && max === g) hue = (b - r) / chroma + 2;
  else if (chroma !== 0) hue = (r - g) / chroma + 4;
  // Same hue and saturation at 87% lightness.
  const tintChroma = (1 - Math.abs(2 * 0.87 - 1)) * saturation;
  const x = tintChroma * (1 - Math.abs((hue % 2) - 1));
  const m = 0.87 - tintChroma / 2;
  const sector = Math.floor(hue);
  const [tr, tg, tb] = [
    [tintChroma, x, 0],
    [x, tintChroma, 0],
    [0, tintChroma, x],
    [0, x, tintChroma],
    [x, 0, tintChroma],
    [tintChroma, 0, x],
  ][sector % 6];
  return `#${[tr, tg, tb]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
};

export const mapSettings = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const template = asRecord(invoice.template);
  const theme = hexColor(template.primaryColor);
  return {
    // The default blue and its #bddcff dividers live in the stylesheet; any other theme
    // colour is set inline with its own tint.
    theme:
      theme && theme !== DEFAULT_THEME
        ? { accent: theme, tint: themeTint(theme) }
        : null,
    transportInGrid:
      text(template.transportPosition).toLowerCase() !== "section",
    notesBeside: text(template.notesPosition).toLowerCase() !== "row",
  };
};

/* ------------------------------------------------------------------ parties */

/* A GST state code ("24", "07-Delhi") as two digits. */
const gstCode = (value: unknown): string => {
  const match = text(value).match(/^0?(\d{1,2})(?:\D|$)/);
  return match ? match[1].padStart(2, "0") : "";
};

/*
 * Parties carry an ISO country code ("IN"); print the country's name, as Refrens names it
 * ("United States of America (USA)", where the browser's list says "United States").
 */
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States of America (USA)",
};
const regionName = (code: string): string =>
  /^[A-Za-z]{2}$/.test(code)
    ? COUNTRY_NAMES[code.toUpperCase()] ||
      (new Intl.DisplayNames(["en"], { type: "region", fallback: "code" }).of(
        code.toUpperCase()
      ) as string)
    : code;

/*
 * A party's state as Refrens prints it: the state of its GST state code when it has one
 * ("24" → Gujarat, even with "Maharashtra" stored — 154 test-janvi documents), else the
 * stored state. The shared normalizer's place-of-supply reading names the code.
 */
export const partyState = (party: UnknownRecord): string => {
  const code = gstCode(party.gstState);
  const named = code
    ? normalizePlaceOfSupply({
        placeOfSupply: code,
      } as unknown as FlattenedInvoicePayload)
    : "";
  return named && named !== code ? named : text(party.state);
};

const ownerConfiguration = (invoice: UnknownRecord): UnknownRecord =>
  asRecord(asRecord(invoice.owner).configuration);

/* `fieldVisibility.<key>.showInDocument` on the business, and the party's own map. */
const fieldShown = (
  invoice: UnknownRecord,
  party: UnknownRecord,
  key: string
): boolean => {
  const business = asRecord(
    asRecord(
      asRecord(ownerConfiguration(invoice).experimental).fieldVisibility
    )[key]
  );
  return (
    !isOff(business.showInDocument) &&
    !isOff(asRecord(party.fieldVisibility)[key])
  );
};

/* A party's field list, as an array or as a map keyed by field id (business profiles). */
const fieldList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : Object.values(asRecord(value));

/*
 * A party's VAT / TRN / TIN / SST / Tax ID prints only where the document carries it, as on
 * refrens.com (ported from the Ecommerce template's 465-document check): a switch that hides it
 * anywhere (<key>ShowInInvoice, show<Key>…, the party's or the business's fieldVisibility)
 * hides it; otherwise a party outside India prints its number and an Indian party does not.
 */
export const taxIdShown = (
  invoice: UnknownRecord,
  party: UnknownRecord,
  aliases: string[]
): boolean => {
  const names = aliases.map((alias) => alias.toLowerCase());
  const business = asRecord(
    asRecord(ownerConfiguration(invoice).experimental).fieldVisibility
  );
  const fromMap = (map: UnknownRecord) =>
    Object.keys(map)
      .filter((key) => names.includes(key.toLowerCase()))
      .map((key) => {
        const value = map[key];
        const record = asRecord(value);
        return [
          value,
          record.showInDocument,
          record.showInInvoice,
          record.visible,
        ]
          .map(flagSetting)
          .find((setting) => setting !== undefined);
      });
  const switches = [
    ...aliases.flatMap((alias) => {
      const cap = alias.charAt(0).toUpperCase() + alias.slice(1);
      return [
        party[`${alias}ShowInInvoice`],
        party[`show${cap}InInvoice`],
        party[`show${cap}`],
      ].map(flagSetting);
    }),
    ...fromMap(asRecord(party.fieldVisibility)),
    ...fromMap(business),
  ].filter((setting): setting is boolean => setting !== undefined);
  const hidden = aliases.some((alias) => {
    const cap = alias.charAt(0).toUpperCase() + alias.slice(1);
    return flagSetting(party[`hide${cap}`]) === true;
  });
  if (hidden || switches.includes(false)) return false;
  if (switches.includes(true)) return true;
  const country = text(party.country).toUpperCase();
  return Boolean(country) && country !== "IN" && country !== "INDIA";
};

/*
 * A custom field's value as Refrens prints it: a multi-select or checkbox list joined
 * ("Option 2, Option 3"), a picked option by its label, yes / no as "Yes" / "No", the rest
 * as text.
 */
export const customFieldText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const record = asRecord(entry);
        return Object.keys(record).length
          ? firstText(record.label, record.value)
          : text(entry);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const option = asRecord(value);
  return Object.keys(option).length
    ? firstText(option.label, option.value)
    : text(value);
};

const extraRows = (party: UnknownRecord): LabelValue[] => [
  ...fieldList(party.additionalIds)
    .map(asRecord)
    .filter((entry) => !isOff(entry.showInInvoice))
    .map((entry) => ({
      key: "additionalId",
      label: text(entry.label),
      value: text(entry.value),
    })),
  ...fieldList(party.customFields)
    .map(asRecord)
    .filter((entry) => !isOff(asRecord(entry.params).showInInvoice))
    .map((entry) => ({
      key: "customField",
      label: firstText(entry.label, entry.name),
      value: customFieldText(entry.value),
      isDate: text(entry.dataType).toLowerCase() === "date",
    })),
  ...fieldList(party.customHeaders)
    .map(asRecord)
    .filter((entry) => !isOff(entry.showInInvoice))
    .map((entry) => ({
      key: "customHeader",
      label: text(entry.label),
      value: text(entry.value),
    })),
];

export const mapParty = (
  invoice: UnknownRecord,
  partyValue: unknown,
  title: string,
  billing = false
) => {
  const party = asRecord(partyValue);
  const name = text(party.name);
  if (!name) return null;

  const cityLine = [text(party.city), text(party.pincode || party.zipCode)]
    .filter(Boolean)
    .join(" – ");
  const regionLine = [
    cityLine,
    text(party.district) === text(party.city) ? "" : text(party.district),
    partyState(party),
    regionName(text(party.country)),
  ]
    .filter(Boolean)
    .join(", ");
  const streetLine = [
    text(party.address),
    text(party.building),
    text(party.street),
  ]
    .filter(Boolean)
    .join(", ");

  const ids: LabelValue[] = [];
  // GSTIN and PAN are Indian numbers: refrens.com leaves them off a seller or buyer abroad,
  // while a shipping address prints whatever it carries.
  const country = text(party.country).toUpperCase();
  const indian = !billing || ["", "IN", "INDIA"].includes(country);
  if (indian && text(party.gstin) && fieldShown(invoice, party, "gst")) {
    ids.push({ key: "gstin", label: "GSTIN", value: text(party.gstin) });
  }
  if (indian && text(party.panNumber) && fieldShown(invoice, party, "pan")) {
    ids.push({ key: "pan", label: "PAN", value: text(party.panNumber) });
  }
  const labels = asRecord(invoice.customLabels);
  // The other geographies' tax numbers, labelled as sr-trading-2-0 labels them, only where
  // the document carries them (taxIdShown).
  [
    {
      key: "vatNumber",
      aliases: ["vat", "vatNumber"],
      label: firstText(
        labels.vat,
        labels.vatNumber,
        party.vatLabel,
        "VAT Number"
      ),
    },
    {
      key: "trnNumber",
      aliases: ["trn", "trnNumber"],
      label: firstText(labels.trn, labels.trnNumber, "TRN"),
    },
    {
      key: "tinNumber",
      aliases: ["tin", "tinNumber"],
      label: firstText(labels.tin, labels.tinNumber, "TIN"),
    },
    {
      key: "sstNumber",
      aliases: ["sst", "sstNumber"],
      label: firstText(labels.sst, labels.sstNumber, "SST"),
    },
    {
      key: "taxId",
      aliases: ["taxId"],
      label: firstText(labels.taxId, "Tax ID"),
    },
  ].forEach(({ key, aliases, label }) => {
    if (text(party[key]) && taxIdShown(invoice, party, aliases)) {
      ids.push({ key, label, value: text(party[key]) });
    }
  });

  /*
   * The contact person reads as a field like the others, "Responsible Person: …" as
   * Refrens prints it, unless one of the party's own fields already carries the name.
   */
  const extras = extraRows(party).filter((row) => row.label && row.value);
  const personName = text(asRecord(party.contactPerson).name);
  const person: LabelValue[] =
    personName &&
    !extras.some((row) => row.value.toLowerCase() === personName.toLowerCase())
      ? [
          {
            key: "contactPerson",
            label: firstText(
              labels.contactPerson,
              labels.responsiblePerson,
              "Responsible Person"
            ),
            value: personName,
          },
        ]
      : [];
  // Phone numbers never wrap (layout rule 4); an email address keeps to one line too. Party
  // boxes print the labels ("Phone: …"); the header prints the values alone.
  const contacts = [
    {
      key: "phone",
      label: labelOr(labels, "phone", "Phone"),
      value: isOff(party.phoneShowInInvoice) ? "" : text(party.phone),
      isNum: true,
    },
    {
      key: "email",
      label: labelOr(labels, "email", "Email"),
      value: isOff(party.emailShowInInvoice) ? "" : text(party.email),
      isNum: false,
    },
  ].filter((contact) => contact.value);

  /*
   * Every identifier line reads alike (12/500, label: value), in the header and the party
   * boxes: the tax numbers (GSTIN | PAN …), Phone | Email, then the responsible person and
   * the party's own fields (ID No., custom fields…) two to a line, in the order they were
   * filled in the form. Figures, codes, dates and one-word values never wrap
   * (isNum); a value with spaces wraps at them; an email stays on one line while it fits and breaks only when its box is too
   * narrow (isEmail), never overflowing; other text wraps.
   */
  const entry = (row: LabelValue & { isNum?: boolean }, isNum: boolean) => ({
    label: row.label,
    value: row.value,
    isDate: Boolean(row.isDate),
    isNum,
    noWrap: isNum,
    isEmail: row.key === "email",
    isPhone: row.key === "phone",
  });
  const pairs = <T>(rows: T[]): T[][] =>
    rows
      .filter((_, index) => index % 2 === 0)
      .map((_, index) => rows.slice(index * 2, index * 2 + 2));
  const lines = [
    // A tax number stays whole; one typed with spaces wraps at them (user, 2026-10-27).
    ids.map((row) => entry(row, /^\S+$/.test(row.value))),
    contacts.map((row) => entry(row, row.isNum)),
    ...pairs(
      [...person, ...extras].map((row) =>
        entry(row, Boolean(row.isDate) || /^\S+$/.test(row.value))
      )
    ),
  ].filter((line) => line.length > 0);

  return {
    title,
    name,
    // One line of text in the party boxes; the header sets the street in bold above the
    // city, state and country (user request).
    address: [streetLine, regionLine].filter(Boolean).join(", "),
    street: streetLine,
    region: regionLine,
    ids,
    contacts,
    extras,
    // The identifier lines share one grid in the party boxes, so their columns align.
    lines,
    hasIdLines: lines.length > 0,
  };
};

/* ------------------------------------------------------------------ QR codes */

/* eslint-disable no-bitwise, no-continue */

/*
 * Offline QR encoder (byte mode, error correction M, versions 1-20, up to 666 bytes), the
 * same one the Shree Vaishnavi template ships. The API hands the UPI QR as a `upi://` link
 * and the document QR as text, not images, so the template draws them itself.
 */

// [ecc codewords per block, group 1 blocks, group 1 data codewords,
//  group 2 blocks, group 2 data codewords] for error correction level M.
const ECC_M_BLOCKS: Array<[number, number, number, number, number]> = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

const dataCapacity = (version: number): number => {
  const [, blocks1, data1, blocks2, data2] = ECC_M_BLOCKS[version - 1];
  return blocks1 * data1 + blocks2 * data2;
};

const appendBits = (bits: number[], value: number, length: number): void => {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
};

const multiply = (left: number, right: number): number => {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((right >>> index) & 1) * left;
  }
  return result & 0xff;
};

const reedSolomonDivisor = (degree: number): number[] => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let term = 0; term < degree; term += 1) {
      result[term] = multiply(result[term], root);
      if (term + 1 < degree) result[term] ^= result[term + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
};

const reedSolomonRemainder = (data: number[], divisor: number[]): number[] => {
  const result = new Array(divisor.length).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  });
  return result;
};

const encodeCodewords = (bytes: Uint8Array, version: number): number[] => {
  const capacityBits = dataCapacity(version) * 8;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(bits, pad, 8);
  }
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(
      bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0)
    );
  }

  const [eccLength, blocks1, data1, blocks2, data2] = ECC_M_BLOCKS[version - 1];
  const divisor = reedSolomonDivisor(eccLength);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  [
    ...new Array(blocks1).fill(data1),
    ...new Array(blocks2).fill(data2),
  ].forEach((length: number) => {
    const block = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    eccBlocks.push(reedSolomonRemainder(block, divisor));
  });

  const result: number[] = [];
  const longest = Math.max(data1, data2);
  for (let index = 0; index < longest; index += 1) {
    dataBlocks.forEach((block) => {
      if (index < block.length) result.push(block[index]);
    });
  }
  for (let index = 0; index < eccLength; index += 1) {
    eccBlocks.forEach((block) => result.push(block[index]));
  }
  return result;
};

type Matrix = { modules: boolean[][]; isFunction: boolean[][] };

const createBaseMatrix = (version: number): Matrix => {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const isFunction = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const set = (x: number, y: number, dark: boolean): void => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  for (let index = 0; index < size; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }
  [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ].forEach(([centerX, centerY]) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, distance !== 2 && distance !== 4);
      }
    }
  });

  const positions = ALIGNMENT_POSITIONS[version - 1];
  positions.forEach((y, row) => {
    positions.forEach((x, column) => {
      const last = positions.length - 1;
      if (
        (row === 0 && column === 0) ||
        (row === 0 && column === last) ||
        (row === last && column === 0)
      ) {
        return;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  // Reserve the format areas (drawn per mask later) and the dark module.
  for (let index = 0; index < 9; index += 1) {
    if (!isFunction[8][index]) set(index, 8, false);
    if (!isFunction[index][8]) set(8, index, false);
  }
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, false);
    set(8, size - 1 - index, false);
  }
  set(8, size - 8, true);

  if (version >= 7) {
    let remainder = version;
    for (let index = 0; index < 12; index += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const dark = ((bits >>> index) & 1) === 1;
      const a = size - 11 + (index % 3);
      const b = Math.floor(index / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  return { modules, isFunction };
};

const drawCodewords = (matrix: Matrix, codewords: number[]): void => {
  const { modules, isFunction } = matrix;
  const size = modules.length;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (isFunction[y][x]) continue;
        if (bitIndex < codewords.length * 8) {
          modules[y][x] =
            ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
      }
    }
  }
};

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const applyMask = (matrix: Matrix, mask: number): boolean[][] =>
  matrix.modules.map((row, y) =>
    row.map((dark, x) =>
      matrix.isFunction[y][x] ? dark : dark !== MASKS[mask](x, y)
    )
  );

const drawFormatBits = (modules: boolean[][], mask: number): void => {
  const size = modules.length;
  // Error correction level M is 0b00.
  const data = mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (index: number): boolean => ((bits >>> index) & 1) === 1;
  for (let index = 0; index <= 5; index += 1) modules[index][8] = bit(index);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let index = 9; index < 15; index += 1) {
    modules[8][14 - index] = bit(index);
  }
  for (let index = 0; index < 8; index += 1) {
    modules[8][size - 1 - index] = bit(index);
  }
  for (let index = 8; index < 15; index += 1) {
    modules[size - 15 + index][8] = bit(index);
  }
  modules[size - 8][8] = true;
};

const penalty = (modules: boolean[][]): number => {
  const size = modules.length;
  let score = 0;
  const lineScore = (line: boolean[]): number => {
    let total = 0;
    let run = 1;
    for (let index = 1; index <= line.length; index += 1) {
      if (index < line.length && line[index] === line[index - 1]) {
        run += 1;
      } else {
        if (run >= 5) total += run - 2;
        run = 1;
      }
    }
    const bits = line.map((dark) => (dark ? "1" : "0")).join("");
    const finderLike = /(?=(10111010000|00001011101))/g;
    total += (bits.match(finderLike) || []).length * 40;
    return total;
  };
  for (let index = 0; index < size; index += 1) {
    score += lineScore(modules[index]);
    score += lineScore(modules.map((row) => row[index]));
  }
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
      if (
        x < size - 1 &&
        y < size - 1 &&
        modules[y][x] === modules[y][x + 1] &&
        modules[y][x] === modules[y + 1][x] &&
        modules[y][x] === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
};

export const encodeQrMatrix = (payload: string): boolean[][] | null => {
  const bytes = new TextEncoder().encode(payload);
  const version = ECC_M_BLOCKS.findIndex(
    (_spec, index) =>
      4 + (index + 1 <= 9 ? 8 : 16) + bytes.length * 8 <=
      dataCapacity(index + 1) * 8
  );
  if (!bytes.length || version < 0) return null;
  const matrix = createBaseMatrix(version + 1);
  drawCodewords(matrix, encodeCodewords(bytes, version + 1));
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(matrix, mask);
    drawFormatBits(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

/**
 * Returns an SVG data URL for the text, or "" when it cannot be encoded.
 * @param payload
 */
export const generateQrDataUrl = (payload: string): string => {
  const modules = encodeQrMatrix(String(payload ?? ""));
  if (!modules) return "";
  const quiet = 4;
  const size = modules.length + quiet * 2;
  const path = modules
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : ""))
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/* eslint-enable no-bitwise, no-continue */

const isImageSource = (value: string): boolean =>
  /^(data:image\/|https?:\/\/|blob:)/i.test(value);

/* An image source as given, or the text drawn as a QR. */
export const qrImage = (value: string): string =>
  !value || isImageSource(value) ? value : generateQrDataUrl(value);

/*
 * The UPI intent the platform encodes: payee address and name, the amount still due (UPI
 * caps a transfer at 1,00,000; left out when the business accepts part payments) and the
 * document reference as the note (50 characters at most).
 */
export const upiIntent = (invoice: UnknownRecord, upiId: string): string => {
  const due = toAmount(
    pickFirst(asRecord(invoice.balance).due, asRecord(invoice.finalTotal).total)
  );
  const partial =
    asRecord(asRecord(invoice.paymentOptions).meta).allowPartialPayment ===
    true;
  const params = [
    ["pa", upiId],
    ["pn", text(asRecord(invoice.billedBy).name)],
    ["am", !partial && due > 0 ? Math.min(due, 100000).toFixed(2) : ""],
    ["cu", text(invoice.currency) || "INR"],
    [
      "tn",
      [text(invoice.invoiceTitle), text(invoice.invoiceNumber)]
        .filter(Boolean)
        .join(" ")
        .slice(0, 50),
    ],
  ].filter(([, value]) => value);
  return `upi://pay?${params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&")}`;
};

/* ------------------------------------------------------------------ meta */

/*
 * IRN and e-way rows follow the business settings in owner.configuration (einvoice / eway),
 * overridden by the host's einvoiceConfig / ewayConfig. A row shows when it has a value and
 * its setting is not false — a missing setting does not hide it.
 */
const complianceSettings = (invoice: UnknownRecord) => {
  const configuration = ownerConfiguration(invoice);
  return {
    einvoice: {
      ...asRecord(configuration.einvoice),
      ...asRecord(invoice.einvoiceConfig),
    },
    eway: { ...asRecord(configuration.eway), ...asRecord(invoice.ewayConfig) },
  };
};

/*
 * Indian place of supply prints as "State (code)". The name comes from the shared
 * normalizer; the code from the same raw value it read, so the two cannot disagree.
 */
export const placeOfSupplyText = (invoice: UnknownRecord): string => {
  const contractInvoice = invoice as unknown as FlattenedInvoicePayload;
  const name = normalizePlaceOfSupply(contractInvoice).replace(
    /^0?\d{1,2}\s*[-:]\s*/,
    ""
  );
  const country = normalizeCountryOfSupply(contractInvoice).toUpperCase();
  const billedTo = asRecord(invoice.billedTo);
  const code = gstCode(
    pickFirst(
      invoice.placeOfSupply,
      invoice.pos,
      billedTo.gstState,
      billedTo.state,
      billedTo.stateCode
    )
  );
  return code && name !== code && (!country || country === "IN")
    ? `${name} (${code})`
    : name;
};

/*
 * Country / Place of Supply show whenever they have a value — the document's own, or the
 * buyer's country / state as Refrens falls back to — unless the document hides them. Each
 * field's settings: its field setting (invoiceValueProps), show…, hide… (advanceOptions,
 * then the invoice).
 */
const flag = (value: unknown): boolean | undefined => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const supplySetting = (
  state: UnknownRecord,
  field: "countryOfSupply" | "placeOfSupply"
) => {
  const invoice = asRecord(state.invoice);
  const advanceOptions = asRecord(state.advanceOptions);
  const suffix = field[0].toUpperCase() + field.slice(1);
  const props = asRecord(invoice.invoiceValueProps);
  const propKey = Object.keys(props).find(
    (key) => key.toLowerCase() === field.toLowerCase()
  );
  const prop = propKey === undefined ? undefined : props[propKey];
  const configured =
    flag(prop) ??
    flag(asRecord(prop).visible) ??
    flag(asRecord(prop).showInInvoice);
  const shown = flag(
    pickFirst(advanceOptions[`show${suffix}`], invoice[`show${suffix}`])
  );
  const hidden = flag(
    pickFirst(advanceOptions[`hide${suffix}`], invoice[`hide${suffix}`])
  );
  return { configured, shown, hidden };
};

const customFieldValue = (field: UnknownRecord, ctx: FormatContext) => {
  const dataType = text(field.dataType).toLowerCase();
  if (dataType === "currency") return formatMoney(field.value, ctx);
  if (Array.isArray(field.value)) return field.value.map(text).join(", ");
  return text(field.value);
};

/*
 * The invoice details grid (spec v2 §4.3): document fields and header fields, then the
 * transport fields when they sit in the grid. Country / Place of Supply have their own row
 * (mapSupply); document custom fields go to Additional Info.
 */
export const mapMeta = (state: UnknownRecord, transportRows: LabelValue[]) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);

  const rows: LabelValue[] = [
    {
      key: "invoiceNumber",
      label: labelOr(labels, "invoiceNumber", "Invoice No."),
      value: text(invoice.invoiceNumber),
    },
    {
      key: "invoiceDate",
      label: labelOr(labels, "invoiceDate", "Invoice Date"),
      value: firstText(invoice.invoiceDate),
      isDate: true,
    },
    {
      key: "dueDate",
      label: labelOr(labels, "dueDate", "Due Date"),
      value: firstText(invoice.dueDate),
      isDate: true,
    },
    {
      key: "purchaseOrderNumber",
      label: labelOr(labels, "purchaseOrderNumber", "PO No."),
      value: text(invoice.purchaseOrderNumber),
    },
    // A credit or debit note's reason ("Product Return"), as refrens.com prints it. The linked
    // document's number is not in the data (only its id), so it cannot print.
    {
      key: "documentReason",
      label: labelOr(labels, "documentReason", "Reason"),
      value: text(invoice.documentReason),
    },
    ...asArray(invoice.customHeaders)
      .map(asRecord)
      .map((entry) => ({
        key: "customHeader",
        label: text(entry.label),
        value: text(entry.value),
      })),
    ...transportRows,
    {
      key: "reverseCharge",
      label: labelOr(labels, "reverseCharge", "Reverse Charge"),
      value:
        invoice.reverseCharge === true ||
        asRecord(invoice.advanceOptions).reverseCharge === true
          ? "Yes"
          : "",
    },
  ];

  // Figures, codes and dates never wrap (layout rule 4); text values do.
  return rows
    .filter((row) => row.label && row.value)
    .map((row) => ({
      ...row,
      isNum:
        Boolean(row.isNum || row.isDate) ||
        ["invoiceNumber", "purchaseOrderNumber"].includes(row.key) ||
        (row.key.startsWith("custom") && /^\S+$/.test(row.value)),
    }));
};

/*
 * Country of Supply | Place of Supply: a row of their own above the items table (as Refrens
 * prints them). Refrens has one toggle for both, "Show Place/Country Of Supply", stored as
 * hideCountryOfSupply: it shows or hides the whole row (data-ceres-country-of-supply, the
 * host's live toggle target). Place of Supply's own keys, when a document has them, act on
 * its cell (data-ceres-place-of-supply). Everything stays in the page, hidden, so the live
 * toggles have a target.
 */
export const mapSupply = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const country = supplySetting(state, "countryOfSupply");
  const place = supplySetting(state, "placeOfSupply");
  const rowShown =
    country.shown ?? (country.hidden === undefined ? true : !country.hidden);
  const countryCode = normalizeCountryOfSupply(
    invoice as unknown as FlattenedInvoicePayload
  );
  const rows = [
    {
      key: "countryOfSupply",
      label: labelOr(labels, "countryOfSupply", "Country of Supply"),
      value: regionName(countryCode),
      isHidden: country.configured === false,
      attr: "",
    },
    {
      key: "placeOfSupply",
      label: labelOr(labels, "placeOfSupply", "Place of Supply"),
      // An Indian state: none on a supply abroad, as refrens.com prints it.
      value: /^(in|india)?$/i.test(text(countryCode))
        ? placeOfSupplyText(invoice)
        : "",
      isHidden: !(
        place.configured ??
        place.shown ??
        (place.hidden === undefined ? true : !place.hidden)
      ),
      attr: "data-ceres-place-of-supply",
    },
  ].filter((row) => row.value);
  return { rows, show: rows.length > 0, hidden: !rowShown };
};

/*
 * Additional Info (spec v2 §4.11): the document's Additional Info fields (customFooters, as
 * Refrens prints them at the foot) and its custom fields, as label / value rows, any number
 * of them, values wrapping.
 */
export const mapAdditionalInfo = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  // The document's Additional Info fields (customFooters / footers), then its custom fields.
  const footerRows = [
    ...asArray(invoice.customFooters),
    ...asArray(invoice.footers),
  ]
    .map(asRecord)
    .map((entry) => ({
      key: "footer",
      label: firstText(entry.label, entry.defaultValue),
      value: text(entry.value),
      isDate: false,
    }))
    .filter((row) => row.value);
  const fieldRows = asArray(invoice.customFields)
    .map(asRecord)
    .filter((entry) => !isOff(asRecord(entry.params).showInInvoice))
    .map((entry) => ({
      key: "customField",
      label: firstText(entry.label, entry.name),
      value: customFieldValue(entry, ctx),
      isDate: text(entry.dataType).toLowerCase() === "date",
    }))
    .filter((row) => row.label && row.value);
  const rows = [...footerRows, ...fieldRows];
  return rows.length
    ? {
        title: heading(labels, "additionalInfo", "Additional Information"),
        rows,
      }
    : null;
};

// "SAVINGS" → "Savings", "CURRENT_ACCOUNT" → "Current Account"; mixed case stays as typed.
const titleWord = (value: string): string =>
  value === value.toUpperCase()
    ? value
        .toLowerCase()
        .replace(
          /(^|[\s_])([a-z])/g,
          (_, gap, letter) =>
            `${gap === "_" ? " " : gap}${letter.toUpperCase()}`
        )
    : value;

/*
 * A figure (a challan number, a vehicle number, an ID) keeps to one line only while its value
 * looks like one: a single unbroken token, or a short value with digits in it ("MH 12 AB
 * 1234"). A business can relabel such a field and fill it with text ("Final Destination: <an
 * address>"), which then wraps like any text instead of running out of its box. Ported from
 * the Ecommerce template.
 */
const NUMBER_LIKE_MAX = 24;

export const staysWhole = (value: unknown): boolean => {
  const shown = text(value);
  if (!/\s/.test(shown)) return true;
  return shown.length <= NUMBER_LIKE_MAX && /\d/.test(shown);
};

/*
 * Refrens stores transport choices as codes ("RAIL", "OVERDIMENSIONALCARGO"); the document
 * prints their names, as Refrens does. An unknown code reads in title case ("NEW_MODE" →
 * "New Mode"); free text prints as typed. Ported from the Ecommerce template.
 */
const TRANSPORT_NAMES: Record<string, string> = {
  ROAD: "Road",
  RAIL: "Rail",
  AIR: "Air",
  SHIP: "Ship",
  REGULAR: "Regular",
  OVERDIMENSIONALCARGO: "Over Dimensional Cargo",
};

export const transportName = (value: unknown): string => {
  const raw = text(value);
  if (!/^[A-Z][A-Z0-9_]*$/.test(raw)) return raw;
  return TRANSPORT_NAMES[raw] || titleWord(raw);
};

/*
 * Transport details: in the invoice details grid by default, or their own box beside Shipped
 * From (template setting transportPosition = "section"). Any transport value, or an e-way
 * bill alone, shows them; each row shows only when it has a value.
 */
export const mapTransport = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);

  const irn = asRecord(invoice.irn);
  const { eway } = complianceSettings(invoice);

  // The e-way bill leads (the spec's first row); the transport details follow in the order the
  // form fills them and Refrens prints them, with its labels (as the Ecommerce template):
  // Transport Mode, Transporter, Transporter ID, Distance, Challan Date, Challan Number, Vehicle
  // Type, Vehicle Number, then any extra information. Transaction Type and Sub Supply Type
  // belong to the e-way bill's filing and are not printed, as on Refrens.
  const rows: LabelValue[] = [
    ...(isOff(eway.billNumber)
      ? []
      : [
          {
            key: "ewayBillNumber",
            label: labelOr(labels, "ewayBillNumber", "Eway Bill"),
            value: text(irn.EwbNo),
            isNum: true,
          },
        ]),
    ...(isOff(eway.billDate)
      ? []
      : [
          {
            key: "ewayBillDate",
            label: labelOr(labels, "ewayBillDate", "Eway Date"),
            value: text(irn.EwbDt),
            isUtcDate: true,
          },
        ]),
    ...(isOff(eway.billValidTillDate)
      ? []
      : [
          {
            key: "ewayValidTill",
            label: labelOr(labels, "validTillDate", "Eway Valid Till"),
            value: text(irn.EwbValidTill),
            isUtcDate: true,
          },
        ]),
    ...(isOff(eway.billCancelledDate)
      ? []
      : [
          {
            key: "ewayCancelled",
            label: labelOr(labels, "ewayCancelledDate", "E-Way Cancelled On"),
            value: text(irn.ewayCancelDate),
            isUtcDate: true,
          },
        ]),
    {
      key: "transportMode",
      label: labelOr(labels, "transportMode", "Transport Mode"),
      value: transportName(
        firstText(transport.transportMode, transport.transport)
      ),
    },
    {
      key: "transportName",
      // "Transporter", as Refrens prints it: the business's transportName label ("Transport")
      // is not the one Refrens uses for this line.
      label: labelOr(labels, "transporter", "Transporter"),
      value: firstText(transporter.name, transport.transporterName),
    },
    {
      key: "transporterId",
      label: labelOr(labels, "transporterId", "Transporter ID"),
      value: firstText(transporter.transporterId, transport.transporterId),
      isNum: true,
    },
    {
      key: "distance",
      label: labelOr(labels, "distance", "Distance"),
      value: text(transport.distance),
      isNum: true,
    },
    {
      key: "challanDate",
      label: labelOr(labels, "challanDate", "Challan Date"),
      value: text(transport.challanDate),
      isDate: true,
    },
    {
      key: "challanNumber",
      label: labelOr(labels, "challanNumber", "Challan Number"),
      value: text(transport.challanNumber),
      isNum: true,
    },
    {
      key: "vehicleType",
      label: labelOr(labels, "vehicleType", "Vehicle Type"),
      value: transportName(transport.vehicleType),
    },
    {
      key: "vehicleNumber",
      label: labelOr(labels, "vehicleNumber", "Vehicle Number"),
      value: text(transport.vehicleNumber),
      isNum: true,
    },
    {
      key: "transportExtraInfo",
      label: labelOr(labels, "transportExtraInfo", "Extra Information"),
      value: text(transport.extraInformation),
    },
  ]
    .filter((row) => row.label && row.value)
    .map((row) => ({
      ...row,
      isNum:
        Boolean(row.isDate || row.isUtcDate) ||
        (Boolean(row.isNum) && staysWhole(row.value)),
    }));

  // Any transport value, or an e-way bill alone, shows the box.
  return rows.length
    ? { title: heading(labels, "transport", "Transport Details"), rows }
    : null;
};

/* Each document type's key in the business's per-type QR switch (showQrCode.<type>). */
const QR_DOCUMENT_KEYS: Record<string, string> = {
  INVOICE: "invoice",
  QUOTATION: "quotation",
  PROFORMA: "proforma",
  PROFORMAINV: "proforma",
  PROFORMAINVOICE: "proforma",
  PURCHASE: "expenditure",
  EXPENDITURE: "expenditure",
  PURCHASEORDER: "purchaseOrder",
  SALESORDER: "salesOrder",
  DELIVERYCHALLAN: "deliveryChallan",
  CREDITNOTE: "creditNote",
  DEBITNOTE: "debitNote",
};

export const mapCompliance = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const irn = asRecord(invoice.irn);
  const { einvoice } = complianceSettings(invoice);
  const isCancelled =
    asRecord(asRecord(state.mapped).irn).isCancelled === true ||
    text(invoice.einvoiceGeneratedStatus).toUpperCase() === "CANCELLED";
  const configuration = ownerConfiguration(invoice);
  // The e-invoice QR: an image the host posts (qrCode), else the IRN's own QR text as the API
  // sends it — the signed QR when the business prints that (showSignedIrnQr), else the QR
  // payload — drawn here.
  const irnQr = qrImage(
    firstText(
      invoice.qrCode,
      irn.qrCode,
      configuration.showSignedIrnQr === true
        ? firstText(irn.SignedQRCode, irn.qr)
        : firstText(irn.qr, irn.SignedQRCode)
    )
  );
  // The document QR shows unless the business switched QR codes off, in general
  // (enableQrCode) or for this kind of document (showQrCode.<type>).
  const qrKey =
    QR_DOCUMENT_KEYS[text(invoice.billType).toUpperCase()] ||
    text(invoice.billType).toLowerCase();
  const documentQr =
    isOff(configuration.enableQrCode) ||
    isOff(asRecord(configuration.showQrCode)[qrKey])
      ? ""
      : text(invoice.documentQr);
  // One QR, as refrens.com prints it (user decision): the e-invoice QR while the IRN is
  // active, in the e-invoice box; otherwise (no IRN, or cancelled) the document QR.
  const einvoiceActive = irnQr !== "" && !isCancelled;

  const rows: LabelValue[] = [
    {
      key: "ackNo",
      label: labelOr(labels, "irnAcknowledgementNumber", "Ack No."),
      value:
        isOff(einvoice.irnAcknowledgementNumber) || isCancelled
          ? ""
          : text(irn.AckNo),
    },
    {
      key: "ackDate",
      label: labelOr(labels, "irnAcknowledgementDate", "Ack Date"),
      value:
        isOff(einvoice.irnAcknowledgementDate) || isCancelled
          ? ""
          : text(irn.AckDt),
      isUtcDate: true,
    },
    {
      key: "irnCancelled",
      label: labelOr(labels, "irnCancelledDate", "IRN Cancelled On"),
      value: isOff(einvoice.irnCancelledDate) ? "" : text(irn.CancelDate),
      isDate: true,
    },
  ].filter((row) => row.value);
  const showIrn = !isOff(einvoice.irnNumber);
  // The document QR always prints in the header, the e-invoice QR in its own box (user
  // request).

  return {
    showIrn,
    irnLabel: labelOr(labels, "irn", "IRN No."),
    irn: text(irn.Irn),
    rows,
    // Two to a line (Ack No. | Ack Date), like the party fields.
    rowLines: rows
      .filter((_, index) => index % 2 === 0)
      .map((_, index) => rows.slice(index * 2, index * 2 + 2)),
    qr: {
      irn: einvoiceActive ? irnQr : "",
      zatca: text(invoice.zatcaQrCode),
      lhdn: text(invoice.lhdnQrCode),
      // documentQr arrives as text (a JSON summary of the document): draw it.
      document: einvoiceActive ? "" : qrImage(documentQr),
    },
  };
};

/* ------------------------------------------------------------------ items */

/*
 * Units. An item's unit is either its name ("PCS") or the key of a unit the business set up
 * ("1ohfdis0uax"), resolved through the business's unit configuration, whatever its shape: a
 * list of { _id | id | key | value | code | unit, name … } entries, a { key: name } map, a
 * { name: key } map, or groups of these (same rules as the Solvin template). A key that
 * resolves nowhere is never printed: the item's own unit name fields are tried, else nothing.
 */
const UNIT_IDS = ["_id", "id", "key", "value", "code", "unit"];

const unitName = (entry: unknown, raw: string): string => {
  if (!isRecord(entry)) {
    const value = text(entry);
    return value === raw ? "" : value;
  }
  return firstText(
    entry.displayName,
    entry.label,
    entry.name,
    entry.symbol,
    entry.unitName,
    entry.code,
    text(entry.value) === raw ? "" : entry.value
  );
};

const matchesUnit = (entry: unknown, raw: string): boolean =>
  isRecord(entry) && UNIT_IDS.some((key) => text(entry[key]) === raw);

const findUnit = (units: unknown, raw: string, depth: number): string => {
  if (!units || depth > 3) return "";
  if (Array.isArray(units)) {
    return (
      units
        .filter((entry) => matchesUnit(entry, raw))
        .map((entry) => unitName(entry, raw))
        .find(Boolean) || ""
    );
  }
  const map = asRecord(units);
  const direct = Object.prototype.hasOwnProperty.call(map, raw)
    ? unitName(map[raw], raw)
    : "";
  if (direct) return direct;
  return (
    Object.entries(map)
      .map(([key, entry]) => {
        if (!isRecord(entry) && !Array.isArray(entry)) {
          return text(entry) === raw && key !== raw ? key : "";
        }
        return matchesUnit(entry, raw)
          ? unitName(entry, raw)
          : findUnit(entry, raw, depth + 1);
      })
      .find(Boolean) || ""
  );
};

/* A generated key (letters and digits, 8+ long) is an id, not a name. */
const isUnitKey = (value: string): boolean =>
  value.length >= 8 && /[a-z]/i.test(value) && /\d/.test(value);

export const unitText = (invoice: UnknownRecord, item: UnknownRecord) => {
  const raw = isRecord(item.unit)
    ? firstText(
        item.unit.value,
        item.unit.code,
        item.unit.symbol,
        item.unit.name,
        item.unit.label
      )
    : text(item.unit);
  const configured = raw
    ? [
        ownerConfiguration(invoice).units,
        asRecord(asRecord(invoice.business).configuration).units,
        asRecord(asRecord(invoice.ownerBusiness).configuration).units,
        asRecord(invoice.configuration).units,
        invoice.units,
      ]
        .map((units) => findUnit(units, raw, 0))
        .find(Boolean)
    : "";
  return (
    configured ||
    firstText(item.unitName, item.uomName, item.uom) ||
    (isUnitKey(raw) ? "" : raw)
  );
};

/* A stock allocation's batch is often only its database id: never a name to print. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const batchText = (item: UnknownRecord): string =>
  [
    ...asArray(item.batchSummary).map((entry) =>
      firstText(asRecord(entry).batchName, asRecord(entry).name)
    ),
    ...asArray(item.allocations).map((entry) => {
      const allocation = asRecord(entry);
      const { batch } = allocation;
      return isRecord(batch)
        ? firstText(batch.batchName, batch.name)
        : firstText(
            asRecord(allocation.batchData).batchName,
            allocation.batchName,
            OBJECT_ID.test(text(batch)) ? "" : batch
          );
    }),
  ]
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(", ");

/*
 * The document's own batch columns (Batch Code, Batch Name, Expiry Date, Mfg Batch No.) read
 * the batch each line's stock came from, as refrens.com prints them: "B-0001" under Batch
 * Code (checked on invoice 0014's share page). Several batches are listed once each.
 */
const allocationBatchValue = (item: UnknownRecord, key: string): unknown => {
  const values = asArray(item.allocations)
    .map((entry) => {
      const allocation = asRecord(entry);
      return pickFirst(
        asRecord(allocation.batchData)[key],
        asRecord(allocation.batch)[key]
      );
    })
    .filter(hasValue)
    .filter((value, index, all) => all.indexOf(value) === index);
  return values.length > 1 ? values.map(text).join(", ") : values[0];
};

const columnKind = (column: UnknownRecord): ColumnKind => {
  const key = text(column.key);
  const semantic = text(column.semanticType).toLowerCase();
  if (key === "name") return "name";
  if (CODE_KEYS.includes(key)) return "code";
  if (key === "quantity") return "qty";
  if (key === "gstRate" || semantic === "percentage") return "percent";
  if (key === "discount") return "discount";
  if (
    MONEY_KEYS.includes(key) ||
    column.isCessColumn === true ||
    semantic === "currency" ||
    text(column.fxReturnType).toLowerCase() === "currency"
  ) {
    return "money";
  }
  return text(column.dataType).toLowerCase() === "number" ? "number" : "text";
};

const makeColumn = (column: UnknownRecord): ItemColumn => {
  const key = text(column.key);
  const kind = columnKind(column);
  const summable =
    (["qty", "money", "discount"].includes(kind) && key !== "rate") ||
    (kind === "number" && column.summarise === true);
  return {
    key,
    label: text(column.label),
    kind,
    className: `mm-col-${key.replace(/[^A-Za-z0-9_-]/g, "")} ${
      NUMERIC_KINDS.includes(kind) || kind === "code" ? "is-fixed" : "is-text"
    }${NUMERIC_KINDS.includes(kind) ? " is-num" : ""}`,
    summable,
    isDate: text(column.dataType).toLowerCase() === "date",
  };
};

const customCellValue = (item: UnknownRecord, column: ItemColumn): unknown =>
  pickFirst(
    item[column.key],
    asRecord(item.custom)[column.key],
    asRecord(
      asArray(item.customFields)
        .map(asRecord)
        .find((field) =>
          [field.key, field.name, field.label]
            .map(text)
            .some((name) => name === column.key || name === column.label)
        )
    ).value,
    allocationBatchValue(item, column.key)
  );

/* The discount column holds either a flat amount or `{ amount, discountType }`. */
const discountParts = (item: UnknownRecord) => {
  const { discount } = item;
  if (!isRecord(discount)) return { amount: discount, isPercent: false };
  return {
    amount: discount.amount,
    isPercent: /percent/i.test(text(discount.discountType)),
  };
};

export const columnNumber = (
  item: UnknownRecord,
  column: ItemColumn
): unknown => {
  if (column.key === "total") return pickFirst(item.total, item.subTotal);
  if (column.key === "sgst") return pickFirst(item.sgst, item.utgst);
  if (column.key === "gstRate") return pickFirst(item.gstRate, item.taxRate);
  if (column.kind === "discount") return discountParts(item).amount;
  return customCellValue(item, column);
};

const cellValue = (
  invoice: UnknownRecord,
  visibility: UnknownRecord,
  item: UnknownRecord,
  column: ItemColumn,
  ctx: FormatContext
): string => {
  const value = columnNumber(item, column);
  switch (column.kind) {
    case "code":
      if (column.key === "batch") return batchText(item);
      if (column.key === "unit") return unitText(invoice, item);
      return text(value);
    case "qty": {
      // "10 PCS": the account's own choice (MERGE_QUANTITY).
      const unit = visibility.showUnitInQuantity ? unitText(invoice, item) : "";
      const quantity = formatQuantity(value, ctx);
      return quantity && unit ? `${quantity} ${unit}` : quantity;
    }
    case "percent":
      return formatPercent(value, ctx);
    case "discount":
      // A percentage discount left empty reads "0%", as refrens.com prints it.
      return discountParts(item).isPercent
        ? formatPercent(hasValue(value) ? value : 0, ctx)
        : formatMoney(value, ctx);
    case "money":
      return formatMoney(value, ctx);
    case "number":
      return formatQuantity(value, ctx);
    default:
      // "26-Dec-2025", as the Batch Summary prints the same expiry (an ISO instant printed
      // as it came, "2025-12-25T18:30:00.000Z", ran over the next column).
      if (column.isDate && !Array.isArray(value)) {
        return formatDocumentDate(value, invoice.ownerOffset);
      }
      return Array.isArray(value) ? value.map(text).join(", ") : text(value);
  }
};

// refrens.com prints the MSIC column on challans, quotations, orders and notes, never on
// invoices, proformas or sales orders (ported from the Ecommerce template's check).
const MSIC_OFF_TYPES = ["INVOICE", "PROFORMAINV", "SALESORDER"];

const resolveColumns = (state: UnknownRecord, items: UnknownRecord[]) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  const advanceOptions = asRecord(state.advanceOptions);
  // Normalization drops semanticType / isCessColumn; read them off the account's column.
  const raw = asArray(invoice.columns).map(asRecord);
  // MSIC is a column like any other on refrens.com, which the shared normalizer always drops:
  // it prints unless the business hid it, on the document types that carry it.
  const msicShown =
    !MSIC_OFF_TYPES.includes(text(invoice.billType).toUpperCase()) &&
    raw.some((entry) => entry.key === "msic" && entry.isHidden !== true);
  const columns = asArray(asRecord(state.mapped).columns)
    .map(asRecord)
    .filter(
      (column) =>
        text(column.key) &&
        (column.isHidden !== true || (column.key === "msic" && msicShown))
    )
    .map((column) =>
      makeColumn({
        ...raw.find((entry) => entry.key === column.key),
        ...column,
      })
    );
  const has = (key: string) => columns.some((column) => column.key === key);

  /*
   * Batch and unit are not account columns: they come from the item itself. The design's
   * Batch column shows only where the document has no batch columns of its own: with Batch
   * Code, Expiry Date … (read by customCellValue) refrens.com prints those alone (invoice
   * 0014), and a batch known only by its database id prints nothing (challan A05077).
   */
  const ownBatchColumn = columns.some((column) =>
    /^(batch|expiry|mfg|manufactur)/i.test(column.key)
  );
  if (
    !has("batch") &&
    !ownBatchColumn &&
    !isOff(advanceOptions.showBatchColumnsInInvoice) &&
    items.some((item) => batchText(item))
  ) {
    const batch = makeColumn({
      key: "batch",
      label: labelOr(labels, "batch", "Batch"),
    });
    const nameIndex = columns.findIndex((column) => column.key === "name");
    columns.splice(nameIndex + 1, 0, batch);
  }
  const quantityIndex = columns.findIndex(
    (column) => column.key === "quantity"
  );
  // No item with a unit: no Unit column (as refrens.com).
  const anyUnit = items.some((item) => unitText(invoice, item));
  // The business's own Unit column switched off: no units at all, as refrens.com prints it.
  const unitOff = raw.some(
    (entry) => entry.key === "unit" && entry.isHidden === true
  );
  if (
    visibility.showUnitAsColumn &&
    !unitOff &&
    anyUnit &&
    !has("unit") &&
    quantityIndex >= 0
  ) {
    columns.splice(
      quantityIndex + 1,
      0,
      makeColumn({ key: "unit", label: labelOr(labels, "unit", "Unit") })
    );
  }
  return anyUnit ? columns : columns.filter((column) => column.key !== "unit");
};

/*
 * Item images arrive as plain URLs or as { url } / { src } objects, in an array or alone —
 * read them through the image widget's own normalizer so every shape renders.
 */
const imageList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .map((entry) => toImageSrc(entry as ImageInput))
    .filter((src): src is string => src !== null);

/*
 * "Show thumbnail as column" puts the item's own `thumbnail` beside its name — a separate
 * field from `images[]` (the API never repeats it there), so an item without one shows none
 * rather than borrowing a gallery image.
 */
export const thumbnailOf = (item: UnknownRecord): string =>
  imageList(item.thumbnail)[0] || "";

const isRealItem = (item: UnknownRecord) =>
  item.group !== true &&
  item.isGroupItemTotalRow !== true &&
  item.isAdditionalCharge !== true;

/*
 * Table layout (INVOICE_TEMPLATE_SPEC §5, layout rule 6). Columns start at their Figma widths
 * and grow only when their widest value needs it; Description takes the rest of the 936 px
 * design width and keeps at least 22% of the table. When it would fall below that, the spec's
 * fallbacks apply in order: columns shrink to their content, headers wrap (after "/"), Unit
 * merges into Qty, numbers get 10% smaller. Below the table's minimum width the table
 * scrolls inside its own box. Widths are estimated from the text at Inter 12px.
 */
/* 936 px of content less the table's own 1 px outline on each side. */
const DESIGN_TABLE_WIDTH = 934;
/* Every row carries 8 px of padding at both ends: on Sr (30 px) and on the last column. */
const ROW_END_PADDING = 8;
const SERIAL_WIDTH = 30 + ROW_END_PADDING;
// The most figure columns a tablet lays out side by side under the item's name (styles.css).
const TABLET_FIGURE_COLUMNS = 8;
const MIN_DESCRIPTION_SHARE = 0.22;
const CELL_PADDING = 13; // 6 px each side + the 1 px rule

/*
 * Advance widths of Inter Bold at 12 px (measured in Chrome). Headers, item amounts and the
 * Total row are bold, so every estimate uses them; regular figures are a little narrower.
 * Lower-case letters count as their capitals, which errs wide.
 */
const BOLD_WIDTHS: Record<string, number> = {
  "0": 8.09,
  "1": 5.18,
  "2": 7.56,
  "3": 7.74,
  "4": 8.12,
  "5": 7.46,
  "6": 7.8,
  "7": 6.98,
  "8": 7.81,
  "9": 7.8,
  A: 8.96,
  B: 7.94,
  C: 8.88,
  D: 8.67,
  E: 7.29,
  F: 7.04,
  G: 9.01,
  H: 8.96,
  I: 3.37,
  J: 7.01,
  K: 8.63,
  L: 6.79,
  M: 11.18,
  N: 9.15,
  O: 9.25,
  P: 7.78,
  Q: 9.32,
  R: 7.88,
  S: 7.86,
  T: 8.01,
  U: 8.78,
  V: 8.96,
  W: 12.45,
  X: 8.86,
  Y: 8.77,
  Z: 7.97,
  ",": 4.01,
  ".": 4.01,
  "/": 4.66,
  "-": 5.61,
  ":": 4.01,
  " ": 3.2,
  "%": 12.19,
  "(": 4.53,
  ")": 4.53,
  "&": 8.06,
};
const DEFAULT_CHAR_WIDTH = 8;

/* The table's text is 13 px (user request); the widths above are measured at 12 px. */
const TABLE_TEXT_SCALE = 13 / 12;

/* One-line width of a value in the table's bold text. */
const textWidth = (value: string): number =>
  Array.from(value.toUpperCase()).reduce(
    (total, char) => total + (BOLD_WIDTHS[char] ?? DEFAULT_CHAR_WIDTH),
    0
  ) * TABLE_TEXT_SCALE;

/* data-col (the spec's test hook) and the Figma starting width of each account column. */
const COLUMN_SPEC: Record<string, { col: string; width: number }> = {
  name: { col: "desc", width: 0 },
  itemCode: { col: "code", width: 75 },
  sku: { col: "code", width: 75 },
  batch: { col: "batch", width: 70 },
  hsn: { col: "hsn", width: 70 },
  quantity: { col: "qty", width: 40 },
  unit: { col: "unit", width: 45 },
  rate: { col: "rate", width: 75 },
  discount: { col: "disc", width: 80 },
  amount: { col: "tx", width: 80 },
  gstRate: { col: "gst", width: 50 },
  cgst: { col: "c", width: 75 },
  sgst: { col: "s", width: 75 },
  igst: { col: "ig", width: 110 },
  total: { col: "amt", width: 90 },
};
const CUSTOM_COLUMN_WIDTH = 75;

/* Header words, with a break opportunity after every "/" ("HSN/" + "SAC"). */
export const headerParts = (label: string): string[] =>
  label.replace(/\//g, "/\u0000").split("\u0000").filter(Boolean);

const headerWidth = (label: string): number =>
  Math.max(0, ...label.split(/\s+/).flatMap(headerParts).map(textWidth)) +
  CELL_PADDING;

const longestWordWidth = (value: string): number =>
  Math.max(0, ...value.split(/\s+/).map(textWidth));

interface WidthInput {
  column: ItemColumn;
  values: string[];
}

/* The narrowest one-line width a column's content needs, at a given figure scale. */
const contentWidth = (
  { column, values }: { column: ItemColumn; values: string[] },
  scale: number
): number =>
  Math.max(
    headerWidth(column.label),
    ...values.map(
      (value) =>
        (column.kind === "text" ? longestWordWidth(value) : textWidth(value)) *
          scale +
        CELL_PADDING
    )
  );

export interface TableLayout {
  /* Final width per column key, in px. */
  widths: Record<string, number>;
  smallNumbers: boolean;
  /* Description's width at the design width, and the minimum it is held to. */
  descriptionWidth: number;
  descriptionMin: number;
}

export const planTableLayout = (inputs: WidthInput[]): TableLayout => {
  const fixed = inputs.filter(({ column }) => column.kind !== "name");
  const startOf = (column: ItemColumn) =>
    (COLUMN_SPEC[column.key] || { width: CUSTOM_COLUMN_WIDTH }).width;
  const minDescription = DESIGN_TABLE_WIDTH * MIN_DESCRIPTION_SHARE;

  const attempt = (shrink: boolean, scale: number) => {
    const widths: Record<string, number> = {};
    fixed.forEach((input) => {
      const needed = Math.ceil(contentWidth(input, scale));
      widths[input.column.key] = shrink
        ? needed
        : Math.max(startOf(input.column), needed);
    });
    // The last column also carries the row's end padding.
    const keys = Object.keys(widths);
    if (keys.length) widths[keys[keys.length - 1]] += ROW_END_PADDING;
    const others = Object.values(widths).reduce(
      (total, width) => total + width,
      SERIAL_WIDTH
    );
    return { widths, others, smallNumbers: scale < 1 };
  };

  // Unit stays a column of its own, as refrens.com prints it (252 test-janvi documents): the
  // planner shrinks columns and figures but never folds Unit into Quantity. Only the
  // account's own "unit in quantity" setting does that.
  const steps = [
    attempt(false, 1),
    attempt(true, 1), // shrink to content; headers already wrap after "/"
    attempt(true, 0.9),
  ];
  const chosen =
    steps.find((step) => DESIGN_TABLE_WIDTH - step.others >= minDescription) ||
    steps[steps.length - 1];

  return {
    widths: chosen.widths,
    smallNumbers: chosen.smallNumbers,
    descriptionWidth: DESIGN_TABLE_WIDTH - chosen.others,
    // Content width that holds the Description cell at ≥ 22% of the table even when the
    // table must scroll (2 px spare for rounding); the cell adds its own padding and rule.
    descriptionMin:
      Math.ceil(
        (chosen.others * MIN_DESCRIPTION_SHARE) / (1 - MIN_DESCRIPTION_SHARE)
      ) +
      2 -
      CELL_PADDING,
  };
};

const NUMBER_KINDS: ColumnKind[] = [...NUMERIC_KINDS, "code"];

export const mapItemTable = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const advanceOptions = asRecord(state.advanceOptions);
  const labels = asRecord(invoice.customLabels);
  const items = asArray(invoice.items)
    .map(asRecord)
    .filter((item) => item.hidden !== true && item.isAdditionalCharge !== true);
  const realItems = items.filter(isRealItem);
  const allColumns = resolveColumns(state, realItems);
  const showThumbnail =
    Boolean(visibility.showThumbnailAsColumn) &&
    realItems.some((item) => thumbnailOf(item) !== "");
  const fullWidth = Boolean(visibility.isDescriptionFullWidth);
  const discountsArePercent = realItems.some(
    (item) => discountParts(item).isPercent
  );

  const footerValue = (column: ItemColumn): string => {
    if (
      !column.summable ||
      (column.kind === "discount" && discountsArePercent)
    ) {
      return "";
    }
    const sum = realItems.reduce(
      (total, item) => total + toAmount(columnNumber(item, column)),
      0
    );
    return column.kind === "money" || column.kind === "discount"
      ? formatMoney(sum, ctx)
      : formatQuantity(sum, ctx);
  };
  const valuesOf = (column: ItemColumn) => [
    ...realItems.map((item) =>
      cellValue(invoice, visibility, item, column, ctx)
    ),
    footerValue(column),
  ];

  // Unit folds into Qty ("10 PCS") only by the account's own setting (MERGE_QUANTITY), never
  // to save width (as refrens.com); then the account's Unit column steps aside.
  const mergeUnit = Boolean(visibility.showUnitInQuantity);
  const columns = allColumns.filter(
    (column) => !(mergeUnit && column.key === "unit")
  );
  const layout = planTableLayout(
    columns.map((column) => ({ column, values: valuesOf(column) }))
  );
  const colspan = columns.length + 1;

  const header = columns.map((column) => ({
    key: column.key,
    col: (COLUMN_SPEC[column.key] || { col: column.key }).col,
    className: column.className,
    isName: column.kind === "name",
    labelParts: headerParts(column.label),
    width: column.kind === "name" ? 0 : layout.widths[column.key],
  }));

  let serial = 0;
  let itemIndex = -1;
  const rows = items
    .filter(
      (item) =>
        !(
          item.isGroupItemTotalRow === true &&
          advanceOptions.hideGroupSubTotal === true
        )
    )
    .map((item) => {
      if (item.group === true) {
        return { isGroupHeader: true, name: text(item.name), colspan };
      }
      itemIndex += 1;
      const isGroupTotal = item.isGroupItemTotalRow === true;
      if (!isGroupTotal) serial += 1;
      const inlineCodes = [
        visibility.showSkuInName && item.showSku !== false && text(item.sku)
          ? `${labelOr(labels, "sku", "SKU")}: ${text(item.sku)}`
          : "",
        visibility.showInlineHsn && text(item.hsn)
          ? `${labelOr(labels, "hsn", "HSN/SAC")}: ${text(item.hsn)}`
          : "",
        visibility.showInlineClassification && text(item.classification)
          ? `${labelOr(labels, "classification", "Classification")}: ${text(
              item.classification
            )}`
          : "",
        visibility.showUnitInName && unitText(invoice, item)
          ? `${labelOr(labels, "unit", "Unit")}: ${unitText(invoice, item)}`
          : "",
      ].filter(Boolean);
      const description = isGroupTotal ? "" : text(item.description);
      // images[] travel with the description, wherever it is placed. originalImages[] always
      // take a row of their own under the item, across the whole table at its full width,
      // whether or not the description is full width.
      const images = isGroupTotal ? [] : imageList(item.images);
      const originalImages = isGroupTotal ? [] : imageList(item.originalImages);
      const hasDetail = description !== "" || images.length > 0;
      const inDetailRow = hasDetail && fullWidth;
      return {
        isItem: !isGroupTotal,
        isGroupTotal,
        itemIndex,
        // Rows alternate white / stripe per item; an item's detail row shares its stripe.
        isStripe: itemIndex % 2 === 1,
        serial: isGroupTotal ? "" : String(serial),
        name: text(item.name),
        inlineCodes,
        description,
        images,
        originalImages,
        hasDetail,
        // Rows are vertically centred; one with a note or images reads from the top.
        isRich: hasDetail || (showThumbnail && thumbnailOf(item) !== ""),
        detailInline: hasDetail && !inDetailRow,
        detailRow: inDetailRow,
        // The full-width row keeps the serial column and spans everything after it.
        detailColspan: colspan - 1,
        imageRow: originalImages.length > 0,
        thumbnail: showThumbnail ? thumbnailOf(item) : "",
        cells: columns.map((column) => {
          // A group total row only repeats its money figures.
          const value =
            isGroupTotal && !["money", "qty"].includes(column.kind)
              ? ""
              : cellValue(invoice, visibility, item, column, ctx);
          // A one-word value in a text column (a date, a code) stays on one line too.
          const isWord = column.kind === "text" && /^\S+$/.test(value);
          return {
            key: column.key,
            col: (COLUMN_SPEC[column.key] || { col: column.key }).col,
            className: isWord
              ? `${column.className} is-word`
              : column.className,
            isName: column.kind === "name",
            isNum:
              value !== "" && (NUMBER_KINDS.includes(column.kind) || isWord),
            // The column's heading beside the figure where a phone lists an item's figures.
            label: column.label,
            value,
          };
        }),
        colspan,
      };
    });

  const footerCells = columns.map((column) => {
    const value = footerValue(column);
    return {
      key: column.key,
      col: (COLUMN_SPEC[column.key] || { col: column.key }).col,
      className: column.className,
      isName: column.kind === "name",
      isNum: value !== "",
      label: column.label,
      value,
    };
  });

  return {
    columns,
    header,
    rows,
    colspan,
    showThumbnail,
    // The figure columns (every column but the item's name): a tablet lays them out in as
    // many equal tracks under the item's name (styles.css); more than TABLET_FIGURE_COLUMNS
    // cannot sit side by side there, so such a table shows its items as cards.
    figureCount: columns.filter((column) => column.kind !== "name").length,
    manyFigures:
      columns.filter((column) => column.kind !== "name").length >
      TABLET_FIGURE_COLUMNS,
    serialLabel: labelOr(labels, "serialNumber", "Sr."),
    serialWidth: SERIAL_WIDTH,
    mergeUnit,
    smallNumbers: layout.smallNumbers,
    descriptionMin: layout.descriptionMin,
    footer: {
      show: Boolean(visibility.showTotalsRow) && realItems.length > 0,
      // No customLabels key exists for the in-table summary row (see architect-template).
      label: "Total",
      labelInSerial: !columns.some((column) => column.kind === "name"),
      cells: footerCells,
    },
  };
};

/*
 * An amount in words in the document's own currency, as refrens.com writes it on a
 * foreign-currency document ("FOUR DOLLARS AND FIFTY FOUR CENTS ONLY"): international
 * numbering (thousand, million, billion) and the currency's main and fractional units. The
 * shared converter knows rupees only; rupees keep it (lakh, crore). Ported from the Ecommerce
 * template.
 */
const CURRENCY_WORDS: Record<string, [string, string]> = {
  USD: ["dollars", "cents"],
  HKD: ["dollars", "cents"],
  SGD: ["dollars", "cents"],
  AUD: ["dollars", "cents"],
  CAD: ["dollars", "cents"],
  NZD: ["dollars", "cents"],
  EUR: ["euros", "cents"],
  GBP: ["pounds", "pence"],
  AED: ["dirhams", "fils"],
  SAR: ["riyals", "halalas"],
  QAR: ["riyals", "dirhams"],
  OMR: ["rials", "baisa"],
  KWD: ["dinars", "fils"],
  BHD: ["dinars", "fils"],
  MYR: ["ringgit", "sen"],
  IDR: ["rupiah", "sen"],
  LKR: ["rupees", "cents"],
  NPR: ["rupees", "paisa"],
  PKR: ["rupees", "paisa"],
  BDT: ["taka", "poisha"],
  JPY: ["yen", ""],
  CNY: ["yuan", "fen"],
  ZAR: ["rand", "cents"],
  CHF: ["francs", "centimes"],
};
const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const underThousand = (n: number): string =>
  [
    n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred` : "",
    n % 100 < 20
      ? ONES[n % 100]
      : `${TENS[Math.floor((n % 100) / 10)]}${
          n % 10 ? ` ${ONES[n % 10]}` : ""
        }`,
  ]
    .filter(Boolean)
    .join(" ");
const internationalWords = (whole: number): string => {
  if (whole === 0) return "zero";
  const scales = ["", "thousand", "million", "billion", "trillion"];
  const parts: string[] = [];
  let rest = whole;
  for (let i = 0; rest > 0 && i < scales.length; i += 1) {
    const chunk = rest % 1000;
    if (chunk)
      parts.unshift(
        `${underThousand(chunk)}${scales[i] ? ` ${scales[i]}` : ""}`
      );
    rest = Math.floor(rest / 1000);
  }
  return parts.join(" ");
};

export const amountInCurrencyWords = (
  amount: unknown,
  currency: unknown
): string => {
  const code = text(currency).toUpperCase() || "INR";
  const value = Math.abs(toAmount(amount));
  if (code === "INR" || !CURRENCY_WORDS[code]) return amountInWords(value);
  const [main, minor] = CURRENCY_WORDS[code];
  const whole = Math.floor(value + 1e-9);
  const fraction = minor ? Math.round((value - whole) * 100) : 0;
  return `${internationalWords(whole)} ${main}${
    fraction ? ` and ${internationalWords(fraction)} ${minor}` : ""
  } only`.toUpperCase();
};

/* ------------------------------------------------------------------ summaries */

const summaryList = (value: unknown, key: "hsnList" | "taxList") =>
  (Array.isArray(value) ? value : asArray(asRecord(value)[key])).map(asRecord);

/* refrens.com's Batch Summary columns, used when the account has none configured. */
const BATCH_COLUMNS = [
  ["itemName", "Item Name"],
  ["batchName", "Batch Name"],
  ["quantity", "Qty"],
  ["warehouse", "Warehouse"],
  ["manufacturerName", "Mfg Name"],
  ["manufacturingDate", "Mfg Date"],
  ["expiryDate", "Expiry Date"],
].map(([key, label]): UnknownRecord => ({ key, label }));

/*
 * The Batch Summary: one row per batch the document draws on, in the account's batch-summary
 * columns (stockSummaryConfig), as refrens.com prints it. The API sends the rows only for a
 * batch-tracked document with "Show Stock Summary" on; an explicit off still hides them.
 */
export const mapBatchSummary = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const configured = asArray(
    asRecord(invoice.stockSummaryConfig).batchSummaryColumns
  )
    .map(asRecord)
    .filter((column) => text(column.key) && column.isHidden !== true);
  const columns = (configured.length ? configured : BATCH_COLUMNS).map(
    (column) => ({
      key: text(column.key),
      label: firstText(column.label, column.key),
      showSku: column.showSku === true,
      showBatchCode: column.showBatchCode === true,
    })
  );
  const rows = asArray(invoice.batchSummary)
    .map(asRecord)
    .map((entry) => {
      const batch = asRecord(entry.batch);
      return columns.map(({ key, showSku, showBatchCode }) => {
        const extra = (value: string, code: unknown) =>
          value && hasValue(code) ? `${value} (${text(code)})` : value;
        if (key === "itemName")
          return { value: extra(text(entry.itemName), showSku && entry.sku) };
        if (key === "batchName")
          return {
            value: extra(
              firstText(batch.batchName, entry.batchName),
              showBatchCode && batch.batchCode
            ),
          };
        if (key === "quantity")
          return { value: formatQuantity(entry.quantity, ctx), isNum: true };
        // The warehouse arrives as an id; only its name prints.
        if (key === "warehouse") return { value: text(entry.warehouseName) };
        return {
          value: firstText(entry[key], batch[key]),
          isDate: /date$/i.test(key),
        };
      });
    });
  const advanceOptions = asRecord(state.advanceOptions);
  return {
    title: labelOr(labels, "batchSummary", "Batch Summary"),
    columns,
    rows,
    show:
      rows.length > 0 &&
      !isOff(advanceOptions.showStockSummary) &&
      !isOff(asRecord(invoice.advanceOptions).showStockSummary),
  };
};

export const mapHsnSummary = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const advanceOptions = asRecord(state.advanceOptions);
  const labels = asRecord(invoice.customLabels);
  const rows = summaryList(invoice.hsnSummary, "hsnList").filter((row) =>
    text(row.hsn)
  );
  const showIgst = Boolean(visibility.showIgst);
  const isUtgst = Boolean(visibility.isUtgst);
  // Refrens stores each figure as <tax>Amount and <tax>Rate (igstAmount, igstRate…); the
  // short keys are read too.
  const amountOf = (row: UnknownRecord, key: string) =>
    toAmount(pickFirst(row[`${key}Amount`], row[key]));
  const cessOf = (row: UnknownRecord) =>
    toAmount(pickFirst(row.totalCessAmount, row.cessAmount));
  const hasCess = rows.some((row) => cessOf(row));
  const taxSources = {
    customLabels: labels,
    columns: asRecord(state.mapped).columns,
    taxName: invoice.taxName,
    isUtgst,
  };
  const accountColumns = asArray(asRecord(state.mapped).columns).map(asRecord);
  const columnLabel = (key: string) =>
    text(asRecord(accountColumns.find((column) => column.key === key)).label);
  const rate = (value: unknown) =>
    hasValue(value) ? formatPercent(value, ctx) : "";

  // Total is the row's tax, as refrens.com prints it (HSN | Taxable Value | tax | Total).
  const sums = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 };
  const body = rows.map((row) => {
    const taxable = toAmount(row.taxableValue);
    const igst = amountOf(row, "igst");
    const cgst = amountOf(row, "cgst");
    const sgst = amountOf(row, "sgst") + amountOf(row, "utgst");
    const cess = cessOf(row);
    const total = hasValue(row.taxAmount)
      ? toAmount(row.taxAmount)
      : (showIgst ? igst : cgst + sgst) + cess;
    sums.taxable += taxable;
    sums.igst += igst;
    sums.cgst += cgst;
    sums.sgst += sgst;
    sums.cess += cess;
    sums.total += total;
    return {
      hsn: text(row.hsn),
      taxable: formatMoney(taxable, ctx),
      igstRate: rate(row.igstRate),
      igst: formatMoney(igst, ctx),
      cgstRate: rate(row.cgstRate),
      cgst: formatMoney(cgst, ctx),
      sgstRate: rate(pickFirst(row.sgstRate, row.utgstRate)),
      sgst: formatMoney(sgst, ctx),
      cessRate: rate(pickFirst(row.cessRate, row.totalCess)),
      cess: formatMoney(cess, ctx),
      total: formatMoney(total, ctx),
    };
  });

  const enabled = Boolean(
    pickFirst(
      advanceOptions.showHsnSummary,
      advanceOptions.showHSNSummaryInInvoice
    )
  );

  return {
    // Its heading, like the Batch Summary and Payments tables (user, 2026-10-20).
    title: labelOr(labels, "hsnSummary", "HSN Summary"),
    hasRows: body.length > 0,
    // Rendered hidden when switched off so the host's live toggle can reveal it.
    isHidden: !enabled,
    showIgst,
    hasCess,
    // refrens.com's headings: "HSN" (whatever the item column is called) and "Taxable
    // Value" (a business's own label wins), each tax over its Rate and Amount.
    labels: {
      hsn: "HSN",
      taxable: labelOr(labels, "taxableValue", "Taxable Value"),
      // Same words as the item table's tax headers; the totals' "(Rs.)" labels stay there.
      igst: firstText(columnLabel("igst"), resolveTaxLabel("igst", taxSources)),
      cgst: firstText(columnLabel("cgst"), resolveTaxLabel("cgst", taxSources)),
      sgst: firstText(columnLabel("sgst"), resolveTaxLabel("sgst", taxSources)),
      cess: labelOr(labels, "cess", "Cess"),
      rate: "Rate",
      amount: "Amount",
      total: labelOr(labels, "hsnTotal", "Total"),
    },
    rows: body,
    totals: {
      taxable: formatMoney(sums.taxable, ctx),
      igst: formatMoney(sums.igst, ctx),
      cgst: formatMoney(sums.cgst, ctx),
      sgst: formatMoney(sums.sgst, ctx),
      cess: formatMoney(sums.cess, ctx),
      total: formatMoney(sums.total, ctx),
    },
    // The tax in words, under the Total row, in the document's currency ("EIGHTEEN RIYALS
    // ONLY"), as refrens.com writes it.
    words: {
      label: labelOr(labels, "totalTaxInWords", "Total Tax In Words"),
      value: amountInCurrencyWords(sums.total, ctx.currency),
    },
    // HSN, Taxable, each tax's Rate and Amount (IGST, or CGST + SGST; Cess when present), Total.
    columnCount: 3 + (showIgst ? 2 : 4) + (hasCess ? 2 : 0),
  };
};

/* ------------------------------------------------------------------ payment */

const UPI_NOTE_MIN_TOTAL = 100;

export const mapBank = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const bank = asRecord(invoice.bankAccount);
  const labels = {
    ...asRecord(invoice.customLabels),
    ...asRecord(bank.customLabels),
  };
  const upiQr = text(asRecord(asRecord(state.mapped).qr).upi);
  // A delivery challan asks for no payment: refrens.com prints no bank details or UPI on it
  // (none of the 51 test-janvi challans), even with the account-transfer option on.
  const payable = text(invoice.billType).toUpperCase() !== "DELIVERYCHALLAN";

  // In the order of Refrens' bank account form (as the Ecommerce template): Account Name,
  // Account Number, IFSC (with IBAN / SWIFT / Sort Code beside it), Account Type, Bank, then
  // the rest, with refrens.com's labels.
  const rows: LabelValue[] =
    payable && visibility.showBankAccount
      ? [
          {
            key: "accountHolderName",
            label: labelOr(labels, "accountHolderName", "Account Name"),
            value: firstText(bank.name, bank.accountHolderName),
          },
          {
            key: "accountNumber",
            label: firstText(
              labels.accountNumber,
              labels.accountNo,
              "Account Number"
            ),
            value: firstText(bank.accountNo, bank.accountNumber),
          },
          {
            key: "ifsc",
            label: firstText(labels.ifsc, labels.ifscCode, "IFSC"),
            value: firstText(bank.ifsc, bank.ifscCode),
          },
          {
            key: "iban",
            label: labelOr(labels, "iban", "IBAN"),
            value: text(bank.iban),
          },
          {
            key: "swift",
            label: firstText(labels.swiftCode, labels.swift, "SWIFT Code"),
            value: firstText(bank.swift, bank.swiftCode),
          },
          {
            key: "sortCode",
            label: labelOr(labels, "sortCode", "Sort Code"),
            value: text(bank.sortCode),
          },
          {
            key: "accountType",
            label: labelOr(labels, "accountType", "Account Type"),
            // "SAVINGS" reads "Savings", as refrens.com prints the account type — and only for
            // a bank in India (every Indian bank printed it; none of the banks abroad did).
            value: /^(in|india)?$/i.test(text(bank.country))
              ? titleWord(text(bank.accountType))
              : "",
          },
          {
            key: "bankName",
            label: labelOr(labels, "bankName", "Bank"),
            value: firstText(bank.bank, bank.bankName),
          },
          {
            key: "branch",
            label: labelOr(labels, "branch", "Branch"),
            value: text(bank.branch),
          },
          ...asArray(bank.customFields)
            .map(asRecord)
            .filter((field) => !isOff(asRecord(field.params).showInInvoice))
            .map((field) => ({
              key: "customField",
              label: firstText(field.label, field.name),
              value: customFieldText(field.value),
            })),
        ].filter((row) => row.label && row.value)
      : [];

  const upiId =
    payable && visibility.showUpi
      ? text(asRecord(asRecord(state.mapped).upi).id)
      : "";
  // refrens.com prints the UPI limit note only on a document still to be paid, of ₹100 or
  // more (all 153 test-janvi documents with UPI: none paid or under ₹100 printed it).
  const total = Number(asRecord(invoice.finalTotal).total);
  const noteShown =
    text(invoice.status).toUpperCase() !== "PAID" &&
    Number.isFinite(total) &&
    total >= UPI_NOTE_MIN_TOTAL;
  const NUMERIC_BANK_ROWS = [
    "accountNumber",
    "ifsc",
    "iban",
    "swift",
    "sortCode",
  ];

  return {
    show:
      Boolean(visibility.showBankUpiSection) &&
      (rows.length > 0 || upiId !== ""),
    // With bank transfer off, the box holds UPI alone and says so.
    title:
      rows.length > 0
        ? heading(labels, "bankDetails", "Bank Details")
        : heading(labels, "upiDetails", "UPI Details"),
    rows: rows.map((row) => ({
      ...row,
      isNum: NUMERIC_BANK_ROWS.includes(row.key),
    })),
    upi: upiId
      ? {
          label: labelOr(labels, "upi", "UPI"),
          id: upiId,
          // refrens.com's words over the UPI QR.
          scanLabel: labelOr(labels, "scanToPay", "Scan to pay via UPI"),
          // A pre-resolved QR image as given; otherwise the platform's UPI intent, drawn here.
          qr: isImageSource(upiQr) ? upiQr : qrImage(upiIntent(invoice, upiId)),
          note: noteShown
            ? labelOr(
                labels,
                "upiLimitNote",
                "Maximum of 1 lakh can be transferred via UPI in a single day"
              )
            : "",
        }
      : null,
  };
};

export const mapWords = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  // Hidden by a setting, the line is still printed, hidden by class: Lydia's live toggles
  // (hide totals, hide total in words) show it again without a re-render (2026-10-24).
  const hidden = {
    hiddenByTotals: !visibility.showTotals,
    hiddenBySetting: invoice.hideTotalInWords === true,
  };

  // The words the document stores (as refrens.com prints them); nothing stored, the total
  // spelled in the document's currency, or none for a currency without known words.
  const stored = text(labels.totalInWordsValue);
  const currency = text(invoice.currency).toUpperCase() || "INR";
  const computed =
    currency === "INR" || CURRENCY_WORDS[currency]
      ? amountInCurrencyWords(asRecord(invoice.finalTotal).total, currency)
      : "";
  // The amount reads in capitals, like the tax summaries' words (user request); the label
  // is editable and keeps its own case.
  const value = (stored || computed).toUpperCase();
  return value
    ? {
        label: labelOr(labels, "totalInWords", "Total (in words)"),
        value,
        ...hidden,
      }
    : null;
};

/* ------------------------------------------------------------------ totals */

/* Rows whose value is free text, not money — never strip anything from these. */
const isTextRow = (row: SubtotalRow): boolean =>
  row.key === "conversionRate" || row.key.startsWith("extra:");

/* "₹1,03,465.00" → "1,03,465.00"; "(₹50.00)" → "(50.00)". Separators and signs survive. */
const plainRow = (row: SubtotalRow) =>
  isTextRow(row)
    ? { ...row, isNum: false, isGrand: false }
    : { ...row, isNum: true, isGrand: row.key === "total" };

/*
 * The totals block: the shared Subtotal widget decides every row, label, figure (with the
 * currency symbol) and visibility rule, at the document's decimal places. No Round Off row:
 * refrens.com prints none, the rounding is already in the total.
 */
export const mapTotals = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const model = computeSubtotalRows(
    { ...invoice, subUnitLength: moneyDigits(invoice) },
    {
      columns: asRecord(state.mapped).columns,
      businessCurrency: invoice.businessCurrency,
      businessLocale: invoice.businessLocale,
    }
  );
  const ctx = formatContext(invoice);
  // "BGN 1 = ₹57.22": the unit side stays a whole 1, whatever the decimal places.
  const unitRate = (row: SubtotalRow): SubtotalRow =>
    row.key === "conversionRate"
      ? {
          ...row,
          value: row.value.replace(
            /^.*? = /,
            `${formatCurrency(
              1,
              ctx.currency,
              ctx.locale,
              undefined,
              ctx.symbol || undefined
            )} = `
          ),
        }
      : row;
  /*
   * "Show Applied Exchange Rate" (advanceOptions.showExchangeRateOnPdf): on a document in
   * another currency than the business's, the business-currency figure under each amount and
   * the Conversion Rate row print only with it on, as refrens.com does (none of the 29
   * foreign-currency test-janvi documents, all with it off, printed either).
   */
  const options = asRecord(invoice.advanceOptions);
  const exchange = [
    options.showExchangeRateOnPdf,
    options.showAppliedExchangeRate,
    options.showExchangeRate,
  ].some((value) => flagSetting(value) === true);
  const withExchange = <T extends SubtotalRow>(row: T): T =>
    exchange
      ? row
      : {
          ...row,
          converted: null,
          extra: row.extra ? { ...row.extra, converted: null } : row.extra,
        };
  const keepRow = (row: SubtotalRow) =>
    exchange || row.key !== "conversionRate";
  return {
    hidden: model.hidden,
    hideTaxes: model.hideTaxes,
    main: model.groups.main
      .filter(keepRow)
      .map(unitRate)
      .map(withExchange)
      .map(plainRow),
    extra: model.groups.extra.map(withExchange).map(plainRow),
    due: model.groups.due.map(withExchange).map(plainRow),
  };
};

/* ------------------------------------------------------------------ footer */

const fileName = (url: string): string => {
  const last = url.split("?")[0].split("/").pop() as string;
  try {
    return decodeURIComponent(last) || url;
  } catch {
    return last;
  }
};

export const mapNotes = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const notesHidden =
    invoice.hideNotes === true ||
    [
      invoice.notesShowInInvoice,
      invoice.showNotesInInvoice,
      invoice.showNotes,
    ].some(isOff);
  const notes = notesHidden ? "" : text(invoice.notes);

  const terms = asArray(invoice.terms)
    .map(asRecord)
    .map((group) => ({
      title: firstText(group.label, labels.terms, "Terms and Conditions"),
      items: asArray(group.terms).map(text).filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);

  const attachments = asArray(invoice.attachments)
    .map((entry) =>
      isRecord(entry) ? firstText(entry.url, entry.link) : text(entry)
    )
    .filter(Boolean)
    .map((url) => ({ url, name: fileName(url) }));

  const notesBlock = notes
    ? { title: heading(labels, "notes", "Notes"), body: notes }
    : null;
  const attachmentsBlock = attachments.length
    ? {
        title: heading(labels, "attachment", "Attachments"),
        files: attachments,
      }
    : null;

  return { terms, notes: notesBlock, attachments: attachmentsBlock };
};

/*
 * The document's status tag as refrens.com shows it (user decision), ported from the Ecommerce
 * template's check against the same test-janvi documents: Draft, Canceled ("Cancelled" on a
 * quotation), Paid / Part Paid on an invoice, proforma or debit note (nothing while unpaid),
 * Created / Sent / Seen on a quotation, delivery challan or purchase order, and a credit
 * note's Issued / Partially Utilised / Redeemed. Sales orders carry none.
 */
const SENT_TYPE_NAMES: Record<string, string> = {
  DELIVERYCHALLAN: "Delivery Challan",
  PURCHASEORDER: "Purchase Order",
  QUOTATION: "Quotation",
};

export const statusTag = (
  invoice: UnknownRecord
): { text: string; color: string } | null => {
  const type = text(invoice.billType).toUpperCase();
  const status = text(invoice.status).toUpperCase();
  if (status === "DRAFT") return { text: "Draft", color: "devider" };
  if (status === "CANCELED" || status === "CANCELLED") {
    return {
      text: type === "QUOTATION" ? "Cancelled" : "Canceled",
      color: "danger",
    };
  }
  if (["INVOICE", "PROFORMAINV", "DEBITNOTE"].includes(type)) {
    if (status === "PAID") return { text: "Paid", color: "success" };
    if (status === "PARTIAL" || status === "PARTIALLY_PAID") {
      return { text: "Part Paid", color: "info" };
    }
    return null;
  }
  if (SENT_TYPE_NAMES[type]) {
    const emails = asArray(asRecord(invoice.reminders).views).map(asRecord);
    if (emails.some((email) => Number(email.open) > 0)) {
      return { text: `${SENT_TYPE_NAMES[type]} Seen`, color: "success" };
    }
    if (emails.length) {
      return { text: `${SENT_TYPE_NAMES[type]} Sent`, color: "info" };
    }
    return { text: "Created", color: "info" };
  }
  if (type === "CREDITNOTE") {
    const credit = text(invoice.creditNoteStatus).toUpperCase();
    if (credit === "PARTIAL") {
      return { text: "Partially Utilised", color: "info" };
    }
    if (credit === "REDEEMED") return { text: "Redeemed", color: "success" };
    if (credit === "ISSUED" && flagSetting(invoice.isOverdue) !== true) {
      return { text: "Issued", color: "info" };
    }
  }
  return null;
};

export const mapSignature = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const isDigital = text(invoice.signatureMethod).toUpperCase() === "DIGITAL";
  const request = asRecord(invoice.documentSignatureRequest);
  const isSigned = text(request.status).toUpperCase() === "SIGNED";
  const signer = asRecord(asArray(request.signers)[0]);

  const image = isDigital ? "" : text(invoice.signature);
  return {
    // The block shows only with a mark: a signature image or a digital signature.
    hasMark: image !== "" || isDigital,
    forLabel: [
      labelOr(labels, "for", "For"),
      text(asRecord(invoice.billedBy).name),
    ]
      .filter(Boolean)
      .join(" "),
    image,
    awaitingDigital: isDigital && !isSigned,
    signedDigital: isDigital && isSigned,
    signerName: text(signer.signerName),
    verifyUrl: text(asRecord(invoice.share).pdf),
    label: heading(labels, "signature", "Authorized Signatory"),
  };
};

export const mapFooter = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const contact = asRecord(invoice.contact);
  const email = text(contact.email);
  const phone = text(contact.phone);

  // The document's footer fields (customFooters) print in Additional Info, not here.
  return {
    contact:
      email || phone
        ? {
            lead: labelOr(labels, "contact", "For any enquiry, reach out via"),
            emailLabel: labelOr(labels, "contactEmail", "email at"),
            phoneLabel: labelOr(labels, "contactPhone", "call on"),
            email,
            phone,
          }
        : null,
  };
};

/* ------------------------------------------------------------------ view */

/*
 * Print and PDF print at true size (design-to-template §4a): no page-fit zoom, so 13 px text
 * prints at 13 px. zoomSize is the print size picked in Lydia (0.8 smaller … 1.2 larger),
 * applied by the renderer; textScale scales text only. A table wider than its page is fitted
 * when the print layout applies (fitPrintTable), measured rather than estimated.
 */
const positiveNumber = (value: unknown): number | undefined => {
  const parsed = hasValue(value) ? Number(text(value)) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const compactDecimal = (value: number): string =>
  String(Number(value.toFixed(4)));

/*
 * The printable width in the document's own pixels, which caps the page in print
 * (styles.css): Refrens' PDF service lays the page out in a window wider than the paper
 * before it prints, and a table fitted there was clipped on the page (user report). Side
 * margins are xMargins centimetres (1 when unset); Chrome scales them with the print zoom
 * like the rest of the page (zoomSize, 0.8 is the renderer's unzoomed default); 4 px kept
 * back for rounding. Ported from the Ecommerce template.
 */
const PAPER_MM: Record<string, [number, number]> = {
  a3: [297, 420],
  a4: [210, 297],
  a5: [148, 210],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

export const printWidth = (pdfOptions: UnknownRecord): number => {
  const [width, height] =
    PAPER_MM[text(pdfOptions.format).toLowerCase()] ?? PAPER_MM.a4;
  const paperMm = flagSetting(pdfOptions.landscape) === true ? height : width;
  const zoom = positiveNumber(pdfOptions.zoomSize) ?? 1;
  const rendererZoom = zoom === 0.8 ? 1 : zoom;
  // 0 cm is a real choice (Refrens' "0" margin), not unset: only a missing value means 1 cm.
  const margin = hasValue(pdfOptions.xMargins)
    ? Number(text(pdfOptions.xMargins))
    : NaN;
  const sideMarginCm = Number.isFinite(margin) && margin >= 0 ? margin : 1;
  return Math.floor(
    ((paperMm / 25.4) * 96) / rendererZoom - (2 * sideMarginCm * 96) / 2.54 - 4
  );
};

/*
 * The paper's height in CSS pixels (the long side when portrait), before the print zoom: a
 * document taller than this prints on more than one page, so the stretch leaves it alone in
 * Refrens' PDF service too (stretchItemsTable), where the page cannot be measured.
 */
export const paperHeight = (pdfOptions: UnknownRecord): number => {
  const [width, height] =
    PAPER_MM[text(pdfOptions.format).toLowerCase()] ?? PAPER_MM.a4;
  const paperMm = flagSetting(pdfOptions.landscape) === true ? width : height;
  return Math.floor((paperMm / 25.4) * 96);
};

/*
 * An item's large photo is at most 55 % of a printed page tall (styles.css), in the page's own
 * pixels: from the paper, not 55vh, which is the window while the page is laid out (600 px tall
 * in Refrens' PDF service) and the page only when it prints, so a photo grew after the long PDF,
 * the stretch and the footer were measured (long PDF spilt onto a second page). 19 px top and
 * bottom margins; under the print zoom a page holds fewer of the document's pixels; 600 px most.
 */
export const photoCap = (pdfOptions: UnknownRecord): number => {
  const zoom = positiveNumber(pdfOptions.zoomSize) ?? 1;
  const rendererZoom = zoom === 0.8 ? 1 : zoom;
  return Math.min(
    600,
    Math.floor((0.55 * (paperHeight(pdfOptions) - 38)) / rendererZoom)
  );
};

/*
 * The letterhead and footer on every printed page repeat as the page frame's <thead> and
 * <tfoot>, and Chrome stops repeating either once it is taller than a quarter of the page:
 * a landscape A4 footer (224 px of a 718 px page) then printed over the content of every page
 * (2026-10-27). Each band is kept under that quarter of a browser print's page (1 cm margins,
 * its 16 px gap and 4 px to spare included), in the document's own pixels.
 */
// A browser's own print: 1 cm above and below the page.
const BROWSER_MARGINS_PX = (2 * 96) / 2.54;

export const repeatedBandCap = (pdfOptions: UnknownRecord): number => {
  const zoom = positiveNumber(pdfOptions.zoomSize) ?? 1;
  const rendererZoom = zoom === 0.8 ? 1 : zoom;
  const pageArea = paperHeight(pdfOptions) - BROWSER_MARGINS_PX;
  return Math.floor(pageArea / rendererZoom / 4) - 20;
};

export const mapPrint = (state: UnknownRecord) => {
  const pdfOptions = asRecord(state.pdfOptions);
  const invoice = asRecord(state.invoice);
  const rawScale =
    positiveNumber(pdfOptions.textScale) ?? positiveNumber(pdfOptions.scale);
  // A percentage (110) or a ratio (1.1); kept readable either way.
  const ratio =
    rawScale !== undefined && rawScale > 2 ? rawScale / 100 : rawScale;
  const textScale = Math.min(2, Math.max(0.3, ratio ?? 1));
  /*
   * "Stretch invoice & quotation tables to fill the page": the business's setting (Settings >
   * Experimental, stretchInvoiceTable) allows it, the document's own toggle
   * (pdfOptions.fullHeightTable) asks for it, as on refrens.com; every document type (user
   * decision), one-page documents only (stretchItemsTable).
   */
  const stretchAllowed =
    asRecord(ownerConfiguration(invoice).experimental).stretchInvoiceTable ===
    true;
  return {
    textScale: compactDecimal(textScale),
    printWidth: printWidth(pdfOptions),
    // A browser's own print (Lydia's print button, Ctrl+P) keeps its own 1 cm margins,
    // whatever xMargins says: the page is fitted for the narrower of the two.
    browserPrintWidth: printWidth({ ...pdfOptions, xMargins: 1 }),
    paperHeight: paperHeight(pdfOptions),
    photoCap: photoCap(pdfOptions),
    bandCap: repeatedBandCap(pdfOptions),
    stretchAllowed,
    stretchTable:
      stretchAllowed && flagSetting(pdfOptions.fullHeightTable) === true,
  };
};

export const buildModernManufacturingView = (root: unknown) => {
  const state = asRecord(root);
  const invoice = asRecord(state.invoice);
  const mapped = asRecord(state.mapped);
  const visibility = asRecord(mapped.visibility);
  const labels = asRecord(invoice.customLabels);
  const ctx = formatContext(invoice);
  const seller = mapParty(invoice, invoice.billedBy, "", true);
  const logo = firstText(invoice.logo, asRecord(invoice.billedBy).logo);

  const settings = mapSettings(state);
  const shippedFrom = visibility.shippedFrom
    ? mapParty(
        invoice,
        invoice.shippedFrom,
        heading(labels, "shippedFrom", "Shipped From")
      )
    : null;
  const allTransport = mapTransport(state);
  // Transport sits in the details grid by default; with a Shipped From box (or the template's
  // "section" setting) it takes its own box beside it, the dispatch row of spec v2 §4.5.
  const transportInGrid = settings.transportInGrid && shippedFrom === null;
  const transport = transportInGrid ? null : allTransport;
  const meta = mapMeta(
    state,
    transportInGrid && allTransport ? allTransport.rows : []
  );
  const visibleMeta = meta.filter((row) => !row.isHidden).length;
  const notes = mapNotes(state);
  const additional = mapAdditionalInfo(state, ctx);
  // Row 4: Bill To | Ship To. Row 5 (optional): Shipped From | Transport Details (spec v2 §4).
  const parties = [
    mapParty(
      invoice,
      invoice.billedTo,
      heading(labels, "billedTo", "Billed To"),
      true
    ),
    visibility.shippedTo
      ? mapParty(
          invoice,
          invoice.shippedTo,
          heading(labels, "shippedTo", "Shipped To")
        )
      : null,
  ]
    .filter(Boolean)
    .map((party, index) => ({ ...party, isBillTo: index === 0 }));
  // Place / Country of Supply print under Shipped To only (user decision): a document without
  // a shipping address shows neither. Place first, then Country, as refrens.com lists them.
  const supply = mapSupply(state);
  const supplyLines = [
    ...supply.rows.filter((row) => row.key === "placeOfSupply"),
    ...supply.rows.filter((row) => row.key === "countryOfSupply"),
  ];
  const partyBoxes = parties.map((party) => {
    const partySupply =
      !party.isBillTo && supplyLines.length
        ? { hidden: supply.hidden, rows: supplyLines }
        : null;
    return {
      ...party,
      supply: partySupply,
      // The field grid: the party's own fields, then (Shipped To) its supply rows.
      hasFields: Boolean(party.hasIdLines || partySupply),
    };
  });
  const status = statusTag(invoice);
  const hsn = mapHsnSummary(state, ctx);
  const payments = asArray(invoice.allPayments);

  const table = mapItemTable(state, ctx);

  return {
    brand: {
      name: seller ? seller.name : "",
      logo,
      seller,
      // The document's own word for its seller (customLabels.billedBy: Billed By, Quotation
      // From, Issued By, Delivered By, Sales Order From, Order To…).
      title: seller ? heading(labels, "billedBy", "Billed By") : "",
    },
    title: firstText(invoice.invoiceTitle),
    subtitle: firstText(invoice.invoiceSubTitle),
    copy: firstText(invoice.copy),
    theme: settings.theme,
    meta,
    // A currency with known words other than the rupee: the tax summary's words follow it
    // (respellTaxWords).
    foreignCurrency: CURRENCY_WORDS[text(invoice.currency).toUpperCase()]
      ? text(invoice.currency).toUpperCase()
      : "",
    // Up to five values sit in one row (fewer share the full width); more wrap four a row.
    detailColumns: Math.max(1, visibleMeta > 5 ? 4 : visibleMeta),
    compliance: mapCompliance(state),
    // The status tag on the title bar; on paper only when the document asks for it.
    status: status
      ? { ...status, inPrint: Boolean(visibility.showStatusTagInPrint) }
      : null,
    parties: partyBoxes,
    shippedFrom,
    transport,
    hasDispatch: shippedFrom !== null || transport !== null,
    table,
    bank: mapBank(state),
    totals: mapTotals(state),
    words: mapWords(state),
    // Terms | Notes, Additional Info | Attachments, then Notes on its own row when the
    // template places it there (spec v2 §4.10–12). A box that is off leaves its partner the
    // full width; a row with neither is not rendered.
    termsRow: {
      terms: notes.terms,
      notes: settings.notesBeside ? notes.notes : null,
      show: notes.terms.length > 0 || (settings.notesBeside && !!notes.notes),
    },
    infoRow: {
      additional,
      attachments: notes.attachments,
      show: !!additional || !!notes.attachments,
    },
    notesRow: settings.notesBeside ? null : notes.notes,
    // Sections that are switched off are not rendered at all (spec check K1).
    hsn,
    showHsn: hsn.hasRows && !hsn.isHidden,
    showTaxSummary: Boolean(visibility.showTaxTable),
    taxSummaryTitle: labelOr(
      asRecord(invoice.customLabels),
      "taxSummary",
      "Tax Summary"
    ),
    batchSummary: mapBatchSummary(state, ctx),
    // Printed only when the document turns "Show Payments Table" on, as refrens.com does (all
    // 54 test-janvi documents with payments), under its "Payments" title.
    payments: {
      show:
        payments.length > 0 &&
        (asRecord(state.advanceOptions).showPaymentsTable === true ||
          invoice.showPaymentsTable === true),
      heading: labelOr(labels, "payments", "Payments"),
    },
    signature: mapSignature(state),
    footer: mapFooter(state),
    // The letterhead footer repeats at the foot of every printed page unless the document
    // asks for it on the last page only (pdfOptions.footerOnLastPage).
    footerEveryPage: !visibility.footerOnLastPage,
    // The letterhead repeats at the head of every printed page unless the document asks for
    // it on the first page only (pdfOptions.letterHeadOnFirstPage), as Sri Lankan / Vaishnavi.
    letterheadEveryPage: !visibility.letterHeadOnFirstPage,
    print: mapPrint(state),
    // Mapped in the data mapper (withDocumentScript); read again for a state built without it.
    script:
      (state.documentScript as DocumentScript | undefined) ||
      mapDocumentScript(invoice.template, invoice),
  };
};

interface HelperRegistry {
  registerHelper: (
    name: string,
    helper: (...args: unknown[]) => unknown
  ) => void;
}

export const registerModernManufacturingHelpers = (
  HB: HelperRegistry | undefined
): void => {
  if (!HB) return;
  HB.registerHelper("mmView", (root: unknown) =>
    buildModernManufacturingView(root)
  );
  // `{{mmDate value offset}}` — Handlebars appends its options object, so only a string or
  // number second argument is an offset.
  HB.registerHelper("mmDate", (value: unknown, offset: unknown) =>
    formatDocumentDate(
      value,
      typeof offset === "string" || typeof offset === "number"
        ? offset
        : undefined
    )
  );
};

/* ------------------------------------------------------------------ print: footer on the page edge */

/*
 * Footer on the last page only (pdfOptions.footerOnLastPage): on paper it ends on the bottom
 * edge of the last page, not under the last line of content (user request). CSS cannot reach
 * the last page's foot, and a page box (@page) would break Lydia's Pageless PDF, so once the
 * print layout is in place the template measures where that page ends and gives the footer
 * the space above it. The footer on every page is fixed to each page's foot by CSS instead.
 *
 * Print layout stacks the pages' content areas, so a forced page break shows where the
 * current page ends; a second one gives the page height. Sizes are read as laid out (with
 * the renderer's print zoom) and written back in the footer's own pixels.
 */
export interface FooterPlacement {
  /* Where the page holding the end of the content ends, and how tall a page is. */
  pageEnd: number;
  pageHeight: number;
  footerTop: number;
  footerHeight: number;
}

// 2 px to spare, so rounding never pushes the footer onto a page of its own.
const PAGE_EDGE_SLACK = 2;
// Below this, the page "height" between two forced breaks means the layout is not paginated.
const MIN_PAGE_HEIGHT = 200;

/* The space to add above the footer so it ends on the page's bottom edge. */
export const footerEdgeGap = ({
  pageEnd,
  pageHeight,
  footerTop,
  footerHeight,
}: FooterPlacement): number => {
  if (!(pageHeight > 0) || !(footerHeight > 0)) return 0;
  const footerEnd = footerTop + footerHeight;
  // A footer that does not fit under the content starts the next page and ends at its foot.
  const target =
    footerEnd <= pageEnd + PAGE_EDGE_SLACK ? pageEnd : pageEnd + pageHeight;
  return Math.max(0, target - footerEnd - PAGE_EDGE_SLACK);
};

const LAST_PAGE_FOOTER =
  ".mm-doc > .mm-letterhead-footer:not(.mm-footer-fixed):not(.is-empty)";

const pageTop = (element: Element): number =>
  element.getBoundingClientRect().top + window.scrollY;

/*
 * Laid-out pixels per CSS pixel at an element (the renderer zooms <html> for the print size):
 * read off a 1000 px probe, as offsetHeight rounds to whole pixels.
 */
const layoutScale = (parent: HTMLElement, before: Element): number => {
  const probe = document.createElement("div");
  probe.style.cssText = "height: 1000px; margin: 0; break-inside: avoid;";
  parent.insertBefore(probe, before);
  const scale = probe.getBoundingClientRect().height / 1000;
  probe.remove();
  return scale > 0 ? scale : 1;
};

export const resetFootersOnPageEdge = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(LAST_PAGE_FOOTER).forEach((footer) => {
    footer.style.removeProperty("margin-top");
    footer.style.removeProperty("break-before");
  });
};

export const placeFootersOnPageEdge = (root: ParentNode = document): void => {
  resetFootersOnPageEdge(root);
  root.querySelectorAll<HTMLElement>(LAST_PAGE_FOOTER).forEach((footer) => {
    // Not drawn (the PDF service prints its own footer): nothing to place.
    if (!footer.getClientRects().length) return;

    const parent = footer.parentElement as HTMLElement;
    const breaks = [0, 1].map(() => {
      const marker = document.createElement("div");
      marker.style.cssText = "break-before: page; height: 0; margin: 0;";
      parent.insertBefore(marker, footer);
      return marker;
    });
    const [pageEnd, nextPageEnd] = breaks.map(pageTop);
    breaks.forEach((marker) => marker.remove());
    const pageHeight = nextPageEnd - pageEnd;
    // Laid out for print but not split into pages yet (Refrens' PDF service switches the media
    // first): forced breaks collapse, and a placement there would land wrong. Leave it.
    if (pageHeight < MIN_PAGE_HEIGHT) return;

    let box = footer.getBoundingClientRect();
    const fits =
      box.top + window.scrollY + box.height <= pageEnd + PAGE_EDGE_SLACK;
    if (!fits) {
      // A page of its own: a forced break keeps the margin above it (a natural one drops it).
      footer.style.breakBefore = "page";
      box = footer.getBoundingClientRect();
    }
    const target = fits ? pageEnd : nextPageEnd;
    const gap = footerEdgeGap({
      pageEnd: target,
      pageHeight,
      footerTop: box.top + window.scrollY,
      footerHeight: box.height,
    });
    if (gap <= 0) return;
    // Measured as laid out (zoomed); the margin is in the footer's own pixels.
    footer.style.marginTop = `${gap / layoutScale(parent, footer)}px`;
    // Should the footer still not end where it was meant to, it flows after the content as
    // before rather than slip onto a page the print has not counted.
    const placed = footer.getBoundingClientRect();
    if (
      placed.top + window.scrollY + placed.height >
      target + PAGE_EDGE_SLACK
    ) {
      resetFootersOnPageEdge(parent);
    }
  });
};

/* ------------------------------------------------------------------ print: fit a wide table */

/*
 * A table wider than its page once laid out for print (many columns, long figures) takes the
 * tight print padding (is-print-fit), then its text shrinks just enough to fit (--mm-print-fit),
 * never under the 10 px floor (CSS). Measured rather than estimated, so every paper, margin and
 * print size fits; ported from the Ecommerce template. Back on screen it reads as before.
 */
const MIN_PRINT_FIT = 0.6;
// Sub-pixel rounding is not an overflow.
const PRINT_SLACK = 0.5;
// The share of the page's width a fitted table may take (see fitPrintTable).
const PRINT_ROOM = 0.99;

/*
 * Chrome before 128 (Refrens' PDF service runs 122) reports the size of anything inside a
 * CSS-zoomed element divided by that zoom; later Chrome reports what is drawn. The print fit
 * zooms the table it measures, so it measures through this: read as Chrome 122 gives it, the
 * squeeze never seemed to take and an A5 table was zoomed to 0.01 (2026-10-24, as Apex
 * 2026-10-23). Elsewhere it returns the rect unchanged.
 */
const legacyZoom = (): boolean =>
  typeof Element !== "undefined" && !("currentCSSZoom" in Element.prototype);

const zoomWithin = (element: Element): number => {
  let zoom = 1;
  for (
    let node: Element | null = element;
    node && node !== document.documentElement;
    node = node.parentElement
  ) {
    zoom *= parseFloat(getComputedStyle(node).zoom) || 1;
  }
  return zoom;
};

export const drawnWidth = (element: Element): number =>
  element.getBoundingClientRect().width *
  (legacyZoom() ? zoomWithin(element) : 1);

/*
 * The totals carry on without the item headings (user, 2026-10-19): in print, the rows after
 * the items move into a table of their own right under the item table, so a page that holds
 * only them repeats no heading row. Its columns take the item columns' widths, so the TOTAL
 * row's figures stay under their columns. joinTotals puts them back in the one table.
 */
const TOTALS_SPLIT = "data-mm-totals-split";
const TOTALS_GROUPS = ":scope > tfoot";

export const joinTotals = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLTableElement>(`table[${TOTALS_SPLIT}]`)
    .forEach((split) => {
      const table = split.previousElementSibling;
      const marker = Array.from(table?.childNodes || []).find(
        (node) =>
          node.nodeType === Node.COMMENT_NODE &&
          node.textContent === TOTALS_SPLIT
      );
      if (table && marker) {
        Array.from(split.querySelectorAll(TOTALS_GROUPS)).forEach((group) =>
          table.insertBefore(group, marker)
        );
        marker.remove();
      }
      // The item table's own column sizing back (splitTotals locked it).
      if (table instanceof HTMLElement) {
        table
          .querySelectorAll(`:scope > colgroup[${TOTALS_SPLIT}]`)
          .forEach((cols) => cols.remove());
        const style = table.dataset.mmTotalsStyle;
        if (style !== undefined) {
          if (style) table.setAttribute("style", style);
          else table.removeAttribute("style");
          delete table.dataset.mmTotalsStyle;
        }
      }
      split.remove();
    });
};

export const splitTotals = (root: ParentNode = document): void => {
  joinTotals(root);
  const printing =
    typeof window.matchMedia === "function" &&
    window.matchMedia("print").matches;
  if (!printing) return;
  root.querySelectorAll<HTMLTableElement>(".mm-items").forEach((table) => {
    const groups = Array.from(
      table.querySelectorAll<HTMLElement>(TOTALS_GROUPS)
    );
    const row = Array.from(table.tBodies)
      .filter((body) => !groups.includes(body))
      .flatMap((body) => Array.from(body.rows))
      .reduce<HTMLTableRowElement | undefined>(
        (best, candidate) =>
          !best || candidate.cells.length > best.cells.length
            ? candidate
            : best,
        undefined
      );
    if (!groups.length || !row || !table.parentElement) return;
    // Layout pixels: the print zoom scales the measured boxes, not the widths set here.
    const scale =
      table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1;
    const split = document.createElement("table");
    split.className = table.className;
    split.setAttribute(TOTALS_SPLIT, "");
    const style = table.getAttribute("style");
    if (style) split.setAttribute("style", style);
    split.style.tableLayout = "fixed";
    split.style.width = `${table.offsetWidth}px`;
    const cols = document.createElement("colgroup");
    Array.from(row.cells).forEach((cell) => {
      const col = document.createElement("col");
      col.span = cell.colSpan || 1;
      col.style.width = `${cell.getBoundingClientRect().width / scale}px`;
      cols.appendChild(col);
    });
    split.appendChild(cols);
    /*
     * The item table gets the same columns: without its totals it would size them again
     * (the totals' wider figures no longer counting) and the two would no longer line up.
     */
    const width = table.offsetWidth;
    const lock = cols.cloneNode(true) as HTMLElement;
    lock.setAttribute(TOTALS_SPLIT, "");
    table.dataset.mmTotalsStyle = table.getAttribute("style") ?? "";
    table.prepend(lock);
    table.style.tableLayout = "fixed";
    table.style.width = `${width}px`;
    groups[0].before(document.createComment(TOTALS_SPLIT));
    groups.forEach((group) => split.appendChild(group));
    table.after(split);
  });
};

export const fitPrintTable = (
  root: ParentNode = document,
  force = false
): void => {
  const printing =
    force ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("print").matches);
  root.querySelectorAll<HTMLElement>(".mm-items").forEach((table) => {
    table.classList.remove("is-print-fit");
    table.style.removeProperty("--mm-print-fit");
    table.style.removeProperty("--mm-print-squeeze");
    const box = table.parentElement;
    if (!printing || !box) return;
    // 1 % kept back: Chrome sets the PDF's text a little wider than the layout measured it, and a
    // word on the table's edge ("Amount", "Expiry") was cut there.
    const room = () => box.getBoundingClientRect().width * PRINT_ROOM;
    // The table fills its box (width 100 %), so its own width always exceeds 99 % of it: what
    // counts is how narrow its columns can go, measured at width 0 (a table is never narrower
    // than its content). Read as it stood, a table that fit was shrunk to the 10 px floor.
    const need = () => {
      const { width } = table.style;
      table.style.width = "0px";
      const narrowest = drawnWidth(table);
      table.style.width = width;
      return narrowest;
    };
    const overflow = () => need() - room();
    if (overflow() <= PRINT_SLACK) return;
    table.classList.add("is-print-fit");
    let fit = 1;
    // By the measured ratio, and at least a step each time, so the last pixel or two of
    // overflow (floors, padding and rules do not scale exactly) still goes.
    for (let step = 0; step < 20 && overflow() > PRINT_SLACK; step += 1) {
      const ratio = room() / need();
      fit = Math.max(
        MIN_PRINT_FIT,
        Math.min(fit - 0.01, Math.floor(fit * ratio * 100) / 100)
      );
      table.style.setProperty("--mm-print-fit", String(fit));
      if (fit === MIN_PRINT_FIT) break;
    }
    // The text at its floor and still too wide: the whole table scales, never cut off.
    let squeeze = 1;
    for (let step = 0; step < 10 && overflow() > PRINT_SLACK; step += 1) {
      const ratio = room() / need();
      squeeze = Math.min(
        squeeze - 0.01,
        Math.floor(squeeze * ratio * 100) / 100
      );
      table.style.setProperty("--mm-print-squeeze", String(squeeze));
    }
  });
};

/*
 * The summary tables (HSN, Tax, Batch, Payments) in print: one wider than its box (an A5 page:
 * the tax summary's Total, the batch summary's Expiry Date, the payments' last column were cut)
 * scales down as a whole, just enough, to the same 99 % of the box as the items table.
 */
export const fitSummaryTables = (
  root: ParentNode = document,
  force = false
): void => {
  const printing =
    force ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("print").matches);
  root
    .querySelectorAll<HTMLElement>(
      ".mm-widget-table .ceres-table, .mm-hsn-table"
    )
    .forEach((table) => {
      table.classList.remove("is-print-fit");
      table.style.removeProperty("--mm-print-squeeze");
      const box = table.parentElement;
      if (!printing || !box) return;
      const room = () => box.getBoundingClientRect().width * PRINT_ROOM;
      // As the items table: each fills its box, so what counts is its narrowest width, at
      // width 0. Their columns are fixed shares, which at width 0 would read as no width at
      // all, so the measure sizes them by their content (auto layout) for that moment.
      const need = () => {
        const { width, tableLayout } = table.style;
        table.style.width = "0px";
        table.style.tableLayout = "auto";
        const narrowest = drawnWidth(table);
        table.style.width = width;
        table.style.tableLayout = tableLayout;
        return narrowest;
      };
      const overflow = () => need() - room();
      if (overflow() <= PRINT_SLACK) return;
      table.classList.add("is-print-fit");
      let squeeze = 1;
      for (let step = 0; step < 10 && overflow() > PRINT_SLACK; step += 1) {
        const ratio = room() / need();
        squeeze = Math.min(
          squeeze - 0.01,
          Math.floor(squeeze * ratio * 100) / 100
        );
        table.style.setProperty("--mm-print-squeeze", String(squeeze));
      }
    });
};

/* ------------------------------------------------------------------ print: a browser's own print */

/*
 * A browser's own print (Lydia's print button, Ctrl+P) counts the pages from the print layout
 * as it stands when printing starts; the print media listener runs after that, so a table it
 * fitted left blank pages at the end (two on A4, four on A5, user report 2026-10-20). Just
 * before printing (beforeprint), the stylesheets' print rules are switched on for one
 * synchronous measurement, the table is fitted as print lays it out, and the rules go back:
 * the fit styles print only, so the screen never changes, and the page count is right.
 * Refrens' PDF service switches to print media before it prints, where the listener does it.
 */
const MEDIA_WIDTH =
  /\(\s*(min-width|max-width|width)\s*(:|<=|>=|<|>)\s*(\d+(?:\.\d+)?)px\s*\)/g;

/* What a media query says in print, on a page `width` px wide; undefined leaves it alone. */
export const printMediaText = (
  query: string,
  width: number
): string | undefined => {
  if (/\bprint\b/.test(query)) {
    return /\bnot\s+print\b/.test(query)
      ? "not all"
      : query.replace(/\bprint\b/g, "all");
  }
  if (/\bscreen\b/.test(query)) return "not all";
  const conditions = [...query.matchAll(MEDIA_WIDTH)];
  if (!conditions.length || /,|\bor\b|\bnot\b/.test(query)) return undefined;
  const holds = conditions.every(([, feature, op, value]) => {
    const px = Number(value);
    if (feature === "min-width" || op === ">=") return width >= px;
    if (feature === "max-width" || op === "<=") return width <= px;
    if (op === "<") return width < px;
    return width > px;
  });
  return holds ? "all" : "not all";
};

export const withPrintRules = <T>(width: number, measure: () => T): T => {
  const changed: Array<[MediaList, string]> = [];
  const flip = (media: MediaList) => {
    const before = media.mediaText;
    const next = printMediaText(before, width);
    if (next === undefined || next === before) return;
    changed.push([media, before]);
    // eslint-disable-next-line no-param-reassign
    media.mediaText = next;
  };
  const visit = (rules: CSSRuleList) =>
    Array.from(rules).forEach((rule) => {
      // A media rule (or an @import with media): by its media list, which jsdom's rules carry
      // without being CSSMediaRule instances.
      const { media } = rule as CSSMediaRule;
      if (media && typeof media.mediaText === "string") flip(media);
      if ("cssRules" in rule) visit((rule as CSSGroupingRule).cssRules);
    });
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      if (sheet.media?.mediaText) flip(sheet.media);
      visit(sheet.cssRules);
    } catch {
      // Another origin's stylesheet (a font): it holds no print rules of ours.
    }
  });
  try {
    return measure();
  } finally {
    changed.reverse().forEach(([media, before]) => {
      // eslint-disable-next-line no-param-reassign
      media.mediaText = before;
    });
  }
};

/*
 * The template's stylesheet comes from another origin than the renderer (GitHub Pages under
 * lstatic.refrens.com), so its rules cannot be read and withPrintRules could not switch its
 * print rules on: a browser's own print counted the pages of an unfitted table and left blank
 * pages at the end (2026-10-24). The bundle carries the same CSS as text (index.ts), without
 * its font imports: put in the page once as a <style> right after the stylesheet, switched
 * off, and switched on only for a measurement. Nothing is requested: Refrens' PDF service
 * answered a fetched copy with a "404 Web Site" page instead of the PDF (Viraj, 2026-10-26),
 * and switching the link off reloads it. A readable stylesheet (served from the renderer's
 * own origin) is left alone.
 */
const TEMPLATE_STYLESHEET =
  /\/modern-manufacturing-template\/[^/]+\/bundle\.css(?:[?#]|$)/;

let stylesheetText = "";
let measureStyle: HTMLStyleElement | null = null;

export const setModernManufacturingStylesheetText = (css: string): void => {
  stylesheetText = css
    .replace(/@import[^;]*;/g, "")
    .replace(/@font-face\s*\{[^}]*\}/g, "");
};

const readable = (sheet: CSSStyleSheet | null): boolean => {
  try {
    return Boolean(sheet && sheet.cssRules);
  } catch {
    return false;
  }
};

export const withReadableStylesheet = <T>(measure: () => T): T => {
  const link = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  ).find(
    (candidate) =>
      TEMPLATE_STYLESHEET.test(candidate.href) && !readable(candidate.sheet)
  );
  if (!link || !stylesheetText) return measure();
  if (!measureStyle?.isConnected) {
    measureStyle = document.createElement("style");
    measureStyle.setAttribute("data-mm-measure", "");
    measureStyle.textContent = stylesheetText;
    link.after(measureStyle);
  }
  const { sheet } = measureStyle;
  if (!sheet) return measure();
  // The link itself is left as it is: switching its media off and back for the measurement
  // dropped the last pages of a browser's printout (the HSN and tax summaries, 2026-10-27).
  sheet.disabled = false;
  try {
    return measure();
  } finally {
    sheet.disabled = true;
  }
};

/*
 * For the same measurement, the template's own checks of `matchMedia("print")` answer yes, so
 * the print steps that need no pages (the table fit, the totals split) run as print runs them.
 */
export const withPrintMedia = <T>(measure: () => T): T => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    /\bprint\b/.test(query) && !/\bnot\b/.test(query)
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList)
      : original.call(window, query)) as typeof window.matchMedia;
  try {
    return measure();
  } finally {
    window.matchMedia = original;
  }
};

/*
 * `layout` is the print media listener's own work (the totals split and all), so the page
 * count is taken from the layout that prints: splitting the totals off after the count left a
 * blank page at the end of an A5 printout. Only the steps that need the pages themselves (the
 * footer on the last page's edge) wait for the listener.
 */
export const prepareBrowserPrint = (
  layout?: () => void,
  root: ParentNode = document
): void => {
  const doc = root.querySelector<HTMLElement>(".mm-doc");
  if (!doc) return;
  const style = getComputedStyle(doc);
  // The document's printable width, or the browser's own (1 cm margins) where narrower.
  const width = Math.min(
    parseFloat(style.getPropertyValue("--mm-print-width")) ||
      doc.getBoundingClientRect().width,
    parseFloat(style.getPropertyValue("--mm-browser-print-width")) || Infinity
  );
  // The phone and tablet layouts are screen only.
  const fitted = Array.from(
    root.querySelectorAll<HTMLElement>(".mm-items:is(.is-cards, .is-grid)")
  ).map((table) => [table, table.className] as const);
  fitted.forEach(([table]) => table.classList.remove("is-cards", "is-grid"));
  const docWidth = doc.style.width;
  withReadableStylesheet(() =>
    withPrintRules(width, () => {
      doc.style.width = `${width}px`;
      withPrintMedia(() => (layout ? layout() : fitPrintTable(root, true)));
    })
  );
  doc.style.width = docWidth;
  fitted.forEach(([table, className]) => {
    // eslint-disable-next-line no-param-reassign
    table.className = `${className}${
      table.classList.contains("is-print-fit") ? " is-print-fit" : ""
    }`;
  });
};

/* ------------------------------------------------------------------ print: stretch the items table */

/*
 * pdfOptions.fullHeightTable (Refrens' "Stretch invoice & quotation tables to fill the page",
 * a per-document toggle): on a one-page printout the items table takes the page's spare
 * height, so the totals, notes and footer below it end at the page's foot (user request).
 * The spare height goes to the last item row, whose cells and column rules run down to the
 * table's Total row. Print and PDF only: the preview is one continuous sheet. A document
 * longer than a page prints as it is. The page carries the toggle as data-mm-stretch-table,
 * set from the document and switched by Lydia's live template updates.
 */
const STRETCH_ATTR = "data-mm-stretch-table";
const STRETCH_ROW = ".mm-items > tbody > tr:last-child";

export const resetItemsTableStretch = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(`.mm-doc ${STRETCH_ROW}[data-mm-stretched]`)
    .forEach((row) => {
      row.style.removeProperty("height");
      row.removeAttribute("data-mm-stretched");
    });
};

export const stretchItemsTable = (root: ParentNode = document): void => {
  resetItemsTableStretch(root);
  root
    .querySelectorAll<HTMLElement>(`.mm-doc[${STRETCH_ATTR}]`)
    .forEach((doc) => {
      const row = doc.querySelector<HTMLElement>(STRETCH_ROW);
      if (!row || !row.getClientRects().length) return;
      const docEnd = doc.getBoundingClientRect().bottom + window.scrollY;
      // Forced breaks after the document: where its last page ends, and a page's height.
      const breaks = [0, 1].map(() => {
        const marker = document.createElement("div");
        marker.style.cssText = "break-before: page; height: 0; margin: 0;";
        doc.appendChild(marker);
        return marker;
      });
      const [pageEnd, nextPageEnd] = breaks.map(pageTop);
      breaks.forEach((marker) => marker.remove());
      const pageHeight = nextPageEnd - pageEnd;

      const scale = layoutScale(doc, doc.firstElementChild as Element);
      const { height } = row.getBoundingClientRect();
      if (pageHeight < MIN_PAGE_HEIGHT) {
        /*
         * Laid out for print but not paginated: Refrens' PDF service, which lays the page out
         * in a window shorter than the paper and only then prints, so the window's height is
         * not the page's (the table never stretched in the PDF, user report). The page's
         * height is left to CSS, 100vh being the page area when the PDF is made: the row
         * takes what the rest of the document leaves of it, never less than its own height
         * (a document longer than a page prints as it is). Under the print zoom Chrome
         * scales the margins as well, hence 100vh / zoom; 16 px kept back, more above a zoom
         * of 1. As the Ecommerce template does.
         */
        const zoom =
          parseFloat(getComputedStyle(document.documentElement).zoom || "1") ||
          1;
        const docHeight = doc.getBoundingClientRect().height / scale;
        // Taller than the paper: more than a page, printed as it is (a stretched row there
        // added a page of its own).
        const paper = Number(doc.dataset.mmPaperHeight) || Infinity;
        if (docHeight > paper / zoom) return;
        const rowHeight = height / scale;
        const slack = 16 + (zoom > 1 ? 160 * (1 - 1 / zoom) : 0);
        row.style.height = `max(${Math.ceil(
          rowHeight
        )}px, calc(100vh / ${compactDecimal(zoom)} - ${Math.ceil(
          docHeight - rowHeight + slack
        )}px))`;
        row.setAttribute("data-mm-stretched", "");
        return;
      }
      // Paginated (the browser's print): one page only; a longer document prints as it is.
      if (pageEnd > pageHeight + PAGE_EDGE_SLACK) return;
      const limit = pageEnd;
      const spare = limit - docEnd - PAGE_EDGE_SLACK;
      if (spare <= 0) return;

      row.style.height = `${(height + spare) / scale}px`;
      row.setAttribute("data-mm-stretched", "");
      // Should the page still overflow, the table prints as it was.
      if (doc.getBoundingClientRect().bottom + window.scrollY > limit) {
        resetItemsTableStretch(doc);
      }
    });
};

/*
 * Lydia's live template update ("lydia:template-update"): the renderer applies the colours
 * and fonts as root variables; the template follows two settings of its own here — the
 * theme colour's accent and tint (the page carries the render-time ones inline) and the
 * stretched-table toggle.
 */
export const applyTemplateUpdate = (data: unknown): void => {
  const message = asRecord(data);
  if (message.type !== "lydia:template-update") return;
  const template = asRecord(message.template);
  const docs = Array.from(document.querySelectorAll<HTMLElement>(".mm-doc"));

  const color = hexColor(
    firstText(
      asRecord(template.templateColor).primaryColor,
      template.primaryColor
    )
  );
  if (color) {
    docs.forEach((doc) => {
      if (color === DEFAULT_THEME) {
        doc.style.removeProperty("--mm-theme");
        doc.style.removeProperty("--mm-theme-tint");
      } else {
        doc.style.setProperty("--mm-theme", color);
        doc.style.setProperty("--mm-theme-tint", themeTint(color));
      }
    });
  }

  const pdfOptions = asRecord(template.pdfOptions);
  if ("fullHeightTable" in pdfOptions) {
    const on = flagSetting(pdfOptions.fullHeightTable) === true;
    // Only where the business allows the stretch (data-mm-stretch-allowed).
    docs.forEach((doc) =>
      doc.toggleAttribute(
        STRETCH_ATTR,
        on && doc.hasAttribute("data-mm-stretch-allowed")
      )
    );
  }
};

/*
 * Lydia's live "hide totals" ("lydia:invoice-update", top level or in advanceOptions): the
 * renderer hides the totals rows, and a words line only inside the subtotal block; this
 * template prints its words line under the block, so it follows here.
 */
export const applyInvoiceUpdate = (data: unknown): void => {
  const message = asRecord(data);
  if (message.type !== "lydia:invoice-update") return;
  const fields = asRecord(message.fields);
  const hide = [
    fields.hideTotals,
    asRecord(fields.advanceOptions).hideTotals,
  ].find((value) => typeof value === "boolean");
  if (typeof hide !== "boolean") return;
  document
    .querySelectorAll(".mm-doc .mm-words")
    .forEach((line) => line.classList.toggle("is-hidden-by-totals", hide));
};

/*
 * The shared tax summary spells its "Total Tax In Words" in rupees, its words helper fixed at
 * build time; on a document in another currency (data-mm-currency) the line is rewritten
 * after the render from its table's Total row (the last cell, the total tax), in that
 * currency, as refrens.com writes it ("EIGHTEEN RIYALS ONLY"). Ported from the Ecommerce
 * template. The HSN summary spells its own (mapHsnSummary).
 */
export const respellTaxWords = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".mm-doc[data-mm-currency]")
    .forEach((doc) => {
      const currency = text(doc.dataset.mmCurrency);
      doc
        .querySelectorAll<HTMLElement>(
          "[data-ceres-tax-summary] .ceres-table-words"
        )
        .forEach((cell) => {
          const total = Array.from(
            cell.closest("table")?.querySelectorAll("tr") ?? []
          ).find(
            (row) => row.firstElementChild?.textContent?.trim() === "Total"
          );
          const last = total?.lastElementChild?.textContent ?? "";
          const amount = Number(last.replace(/[^0-9.-]/g, ""));
          if (!/\d/.test(last) || !Number.isFinite(amount)) return;
          const label = String(cell.textContent).split(":")[0];
          const words = `${label}: ${amountInCurrencyWords(amount, currency)}`;
          if (cell.textContent !== words) cell.textContent = words;
        });
    });
};

/*
 * The Saudi riyal sign (U+20C1, Unicode 17, 2025), which the shared money format writes for
 * SAR, is in no font the document uses yet, so it printed a box. Each sign is drawn instead:
 * the outline of the saudi_riyal font (Emran Alhaddad, SIL Open Font License 1.1), the one
 * refrens.com prints with, in the text's colour (styles.css .mm-riyal). An embedded font
 * would be simpler, but the renderer's font policy blocks data: fonts, and Google Fonts serves
 * headless Chrome (the PDF service) a file without the sign.
 */
const RIYAL_SIGN = "\u20C1";
const RIYAL_PATH =
  "M750,1119C730,1163,716,1211,711,1262C711,1262,1136,1172,1136,1172C1156,1127,1169,1079,1174,1028C1174,1028,750,1119,750,1119ZM1136,901C1136,901,1136,901,1136,901C1156,857,1169,809,1174,758C1174,758,843,828,843,828C843,828,843,693,843,693C843,693,1136,631,1136,631C1156,587,1169,538,1174,488C1174,488,843,558,843,558C843,558,843,72,843,72C793,100,748,138,711,183C711,183,711,586,711,586C711,586,579,614,579,614C579,614,579,6,579,6C528,34,483,72,447,117C447,117,447,642,447,642C447,642,151,705,151,705C131,750,117,798,112,849C112,849,447,777,447,777C447,777,447,948,447,948C447,948,88,1024,88,1024C68,1068,55,1117,50,1167C50,1167,425,1088,425,1088C456,1081,482,1063,499,1038C499,1038,568,936,568,936C568,936,568,936,568,936C575,926,579,913,579,899C579,899,579,749,579,749C579,749,711,721,711,721C711,721,711,992,711,992C711,992,1136,901,1136,901Z";

const riyalSvg = (): SVGSVGElement => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mm-riyal");
  svg.setAttribute("viewBox", "50 6 1124 1256");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "SAR");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", RIYAL_PATH);
  svg.appendChild(path);
  return svg;
};

export const drawRiyalSigns = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(".mm-doc").forEach((doc) => {
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    const signs: Text[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue?.includes(RIYAL_SIGN)) signs.push(node as Text);
    }
    signs.forEach((node) => {
      const drawn = document.createDocumentFragment();
      String(node.nodeValue)
        .split(RIYAL_SIGN)
        .forEach((part, index) => {
          if (index) drawn.appendChild(riyalSvg());
          if (part) drawn.appendChild(document.createTextNode(part));
        });
      node.replaceWith(drawn);
    });
  });
};

/*
 * Placed when the print layout applies (the print media query turning on: Chrome lays the
 * pages out first, so the measurement is the printed one) and cleared when it ends: first
 * the items table takes the spare height (when stretched), then the last-page footer is set
 * on the page's edge. It runs inside Lydia too (isLydiaMode is the embedded preview, not a
 * page format). A Pageless PDF has one page as tall as the content, so there is no spare
 * height and the footer already ends on its edge; the PDF service draws its own footer.
 */
/*
 * The item table on a phone or tablet screen (styles.css, "phones and tablets"): on a screen
 * up to PHONE_WIDTH every item reads as a card (is-cards); on one narrower than an A4 page
 * (PAPER_WIDTH, 794 px) the table stays as on paper while it fits its box, and one that would
 * scroll sideways keeps its headings in a row over the items (is-grid), or reads as cards with
 * more figure columns than a tablet row holds (has-many-figures). A screen as wide as the
 * page, and print, keep the table as it is, so the preview at A4 width matches the PDF.
 */
const PHONE_WIDTH = 640;
const PAPER_WIDTH = 794;

/* A table that grows after it was fitted (a font, a style set late) is fitted again. */
let fitTimer = 0;
let tableWatch: ResizeObserver | undefined;
const refitSoon = (): void => {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    fitItemsToScreen();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    labelSummaryCells();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    stackCrampedFields();
  }, 0);
};

/*
 * The summary widgets' tables (Tax Summary, Batch Summary, Payments) read as cards on a phone,
 * like the HSN summary (user, 2026-10-20): each cell is labelled with its column's heading,
 * both heading rows joined ("IGST Rate"), for the card CSS to print beside its value. A Total
 * row's first cell is its title and a cell with nothing in it is left off the card. A figure
 * or a date is marked to stay on one line, its column widening for it (user rule: numbers
 * never wrap).
 */
const FIGURE_OR_DATE =
  /^(?:[\d\s.,:/%()+\-–\u00a0\u20b9$€£¥\u20c1]+|\d{1,2}[-\s][A-Za-z]{3,9}[-\s,]+\d{4}|[A-Za-z]{3,9}\.?\s\d{1,2},?\s\d{4})$/;

export const labelSummaryCells = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLTableElement>(".mm-widget-table table.ceres-table")
    .forEach((table) => {
      const span = (cell: Element) =>
        Math.max(1, Number(cell.getAttribute("colspan")) || 1);
      const headings: string[][] = [];
      table.querySelectorAll("thead tr").forEach((row) => {
        let col = 0;
        [...row.children].forEach((cell) => {
          const name = cell.textContent?.trim() ?? "";
          for (let i = 0; i < span(cell); i += 1) {
            headings[col + i] ??= [];
            if (name && !headings[col + i].includes(name)) {
              headings[col + i].push(name);
            }
          }
          col += span(cell);
        });
      });
      table.querySelectorAll("tbody tr, tfoot tr").forEach((row) => {
        let col = 0;
        const isTotal = row.parentElement?.tagName === "TFOOT";
        [...row.children].forEach((cell, index) => {
          const label =
            span(cell) === 1 && !(isTotal && index === 0)
              ? (headings[col] ?? []).join(" ")
              : "";
          if (label) cell.setAttribute("data-label", label);
          else cell.removeAttribute("data-label");
          const value = cell.textContent?.trim() ?? "";
          cell.toggleAttribute(
            "data-mm-empty",
            !value && !cell.querySelector("img, svg")
          );
          cell.toggleAttribute(
            "data-mm-figure",
            /\d/.test(value) && FIGURE_OR_DATE.test(value)
          );
          col += span(cell);
        });
      });
    });
};

/*
 * Party and header fields stay one a line, never split onto rows of their own. Only the boxes
 * are stacked here.
 */
export const stackCrampedFields = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".mm-id-line.is-stacked")
    .forEach((line) => line.classList.remove("is-stacked"));
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  stackCrampedPairs(root);
};

/*
 * Bank | Totals and Shipped From | Transport: each half widens for its numbers, which never
 * wrap; when the two together are wider than the page (an A5 page), they stack, each the full
 * width, rather than push the totals' figures off the page (user rule, 2026-10-20).
 */
export const stackCrampedPairs = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".mm-summary-row, .mm-dispatch")
    .forEach((row) => {
      row.classList.remove("is-stacked");
      if (row.scrollWidth > row.clientWidth + 1) {
        row.classList.add("is-stacked");
      }
    });
};

export const fitItemsToScreen = (root: ParentNode = document): void => {
  const printing =
    typeof window.matchMedia === "function" &&
    window.matchMedia("print").matches;
  root.querySelectorAll<HTMLElement>(".mm-items").forEach((table) => {
    if (typeof ResizeObserver === "function") {
      tableWatch ??= new ResizeObserver(refitSoon);
      tableWatch.observe(table);
    }
    table.classList.remove("is-cards", "is-grid");
    const box = table.parentElement;
    if (printing || !box) return;
    const width = document.documentElement.clientWidth;
    if (width >= PAPER_WIDTH) return;
    const phone = width <= PHONE_WIDTH;
    if (!phone && box.scrollWidth <= box.clientWidth + 1) return;
    table.classList.add(
      phone || table.classList.contains("has-many-figures")
        ? "is-cards"
        : "is-grid"
    );
  });
};

export const registerModernManufacturingPrint = (): void => {
  const state = window as typeof window & { mmPrintRegistered?: boolean };
  if (state.mmPrintRegistered || typeof window.matchMedia !== "function") {
    return;
  }
  state.mmPrintRegistered = true;

  const reset = () => {
    joinTotals();
    resetItemsTableStretch();
    resetFootersOnPageEdge();
    fitPrintTable();
    fitSummaryTables();
    fitItemsToScreen();
    stackCrampedFields();
  };
  // The table first (its width sets its height), then the stretch, then the footer.
  const printLayout = () => {
    fitItemsToScreen();
    stackCrampedFields();
    joinTotals();
    fitPrintTable();
    fitSummaryTables();
    splitTotals();
    stretchItemsTable();
  };
  window.matchMedia("print").addEventListener("change", (event) => {
    if (!event.matches) {
      reset();
      return;
    }
    printLayout();
    placeFootersOnPageEdge();
  });
  // Refrens' PDF service is already in print media when it prints (the listener above laid
  // the page out) and its PDF call fires beforeprint too: refitting then would fit the table
  // to a browser's 1 cm margins instead of the document's own.
  window.addEventListener("beforeprint", () => {
    if (window.matchMedia("print").matches) return;
    prepareBrowserPrint(printLayout);
  });
  window.addEventListener("afterprint", reset);
  window.addEventListener("message", (event) => {
    applyTemplateUpdate(event.data);
    applyInvoiceUpdate(event.data);
  });
  // Each render into the page: the tax summary's words in the document's currency, the
  // riyal sign drawn, the item table fitted to a phone or tablet screen, the summary tables'
  // cells labelled for their phone cards, and a party line too tight for its fields stacked.
  const output = document.getElementById("documentOutput");
  if (output && typeof MutationObserver === "function") {
    new MutationObserver(() => {
      respellTaxWords(output);
      drawRiyalSigns(output);
      fitItemsToScreen(output);
      labelSummaryCells(output);
      stackCrampedFields(output);
    }).observe(output, { childList: true });
    drawRiyalSigns(output);
    fitItemsToScreen(output);
    labelSummaryCells(output);
    stackCrampedFields(output);
  }
  // A window resized, an image or a font arriving, or a description drawn after the render
  // (the Markdown viewer) changes the table's width. The whole page is watched: the renderer
  // may add #documentOutput after this runs. Only classes change in a fit, which neither
  // watch sees, so a fit never sets off another.
  window.addEventListener("resize", refitSoon);
  document.addEventListener("load", refitSoon, true);
  // An image that fails to load (an expired or private link) prints nothing: no broken-image
  // mark and no alt text (the seller's name beside the logo a second time). As Ecommerce.
  document.addEventListener(
    "error",
    (event) => {
      const { target } = event;
      if (target instanceof HTMLImageElement && target.closest(".mm-doc")) {
        target.classList.add("is-broken");
      }
    },
    true
  );
  document.fonts?.ready.then(refitSoon);
  if (typeof MutationObserver === "function") {
    new MutationObserver(refitSoon).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
};
