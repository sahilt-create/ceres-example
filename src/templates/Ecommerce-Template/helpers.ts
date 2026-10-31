/*
 * View model for the Ecommerce template (Figma Document-Templates, node 18926:25865,
 * "Ecommerce-template": a marketplace-style tax invoice).
 *
 * Built on the Apex Engineering view model (itself the Modern Manufacturing one): the same
 * contract coverage, settings and print behaviour, laid out as this design. The template
 * keeps `normalizeInvoiceTemplateState` as its data mapper and asks for this model once,
 * through `{{#with (ecView @root) as |view|}}`. Every value comes from the payload: labels
 * resolve through `customLabels` (or the column's own label), and the design's words are
 * only fallbacks for a key the business has never set. Nothing from the reference design's
 * sample document is written into the markup.
 *
 * Money prints with the document's currency symbol, as the design shows it ("₹2,499.00").
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
import { toImageSrc } from "../../widgets/image/utils";
import { computeSubtotalRows } from "../../widgets/subtotal/utils";
import { computePaymentColumns } from "../../widgets/payment-table/utils";
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
}

const NUMERIC_KINDS: ColumnKind[] = [
  "qty",
  "money",
  "percent",
  "discount",
  "number",
];

const MONEY_KEYS = ["rate", "amount", "igst", "cgst", "sgst", "utgst", "total"];
const CODE_KEYS = [
  "hsn",
  "classification",
  "sku",
  "batchName",
  "batchCode",
  "manufacturerBatchNumber",
  "unit",
];

/* ------------------------------------------------------------------ values */

const text = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return asText(value).trim();
};

const firstText = (...values: unknown[]): string =>
  values.map(text).find(Boolean) || "";

const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && text(value) !== "";

/* 33.3333333 → "33.3333": a ratio or share, four places at most. */
const compactDecimal = (value: number): string =>
  String(Number(value.toFixed(4)));

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

/*
 * A money figure without the currency symbol, for the item table: the document's grouping
 * and decimal places, negatives in brackets as formatCurrency prints them.
 */
export const formatFigure = (value: unknown, ctx: FormatContext): string => {
  if (!hasValue(value)) return "";
  const amount = toAmount(value);
  const figure = formatNumber(
    Math.abs(amount),
    ctx.locale,
    ctx.digits,
    ctx.digits
  );
  return amount < 0 ? `(${figure})` : figure;
};

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

export const formatQuantity = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? formatNumber(toAmount(value), ctx.locale, 0, 3) : "";

const formatPercent = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? `${formatQuantity(value, ctx)}%` : "";

/* ------------------------------------------------------------------ dates */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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

/* 8 → "08". */
const twoDigits = (day: number): string => String(day).padStart(2, "0");

/*
 * Document dates print as the design does, "June 08, 2026". An instant (ISO with Z / an
 * offset, or epoch ms) is shifted into the business's offset first; a zone-less value
 * ("2026-09-21", or the IST-encoded IRN "2026-09-21 11:20:00") is already local, so its own
 * date parts print as they are. Anything unparseable prints as given rather than as a wrong date.
 */
export const formatDocumentDate = (
  value: unknown,
  offset?: unknown
): string => {
  const raw = typeof value === "number" ? "" : text(value);
  if (!raw && typeof value !== "number") return "";
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return `${MONTHS[Number(parts[2]) - 1]} ${twoDigits(Number(parts[3]))}, ${
      parts[1]
    }`;
  }
  const time = typeof value === "number" ? value : Date.parse(raw);
  if (!Number.isFinite(time)) return raw;
  const shifted = new Date(time + offsetMinutes(offset) * 60000);
  return `${MONTHS[shifted.getUTCMonth()]} ${twoDigits(
    shifted.getUTCDate()
  )}, ${shifted.getUTCFullYear()}`;
};

/* "Jun 10, 2026": the payment dates, as refrens.com prints them in its payments table. */
export const formatShortDate = (value: unknown, offset?: unknown): string => {
  const long = formatDocumentDate(value, offset);
  const month = MONTHS.find((name) => long.startsWith(`${name} `));
  return month ? `${month.slice(0, 3)}${long.slice(month.length)}` : long;
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
 * The document's template settings (`invoice.template`): the business's theme colour (the
 * item table's header fill, black in the design) and one layout choice: transport details
 * in the details list or a box of their own. Notes always take a row of their own.
 * Every other toggle is the document's own data (a section shows when it has content and the
 * business has not switched it off).
 */
const DEFAULT_THEME = "#000000";

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

/*
 * Text on the theme fill: white, or the ink colour on a light theme (relative luminance over
 * 0.5), so a yellow or pastel header stays readable.
 */
export const onThemeColor = (hex: string): string => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#22272f" : "#ffffff";
};

export const mapSettings = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const template = asRecord(invoice.template);
  const theme = hexColor(template.primaryColor);
  return {
    // The default black lives in the stylesheet; any other theme colour is set inline with
    // its own tint.
    theme:
      theme && theme !== DEFAULT_THEME
        ? {
            accent: theme,
            tint: themeTint(theme),
            onAccent: onThemeColor(theme),
          }
        : null,
    transportInGrid:
      text(template.transportPosition).toLowerCase() !== "section",
  };
};

/* ------------------------------------------------------------------ script */

/*
 * Change Script (Language/Script and "Enable right-to-left script"): read under every name the
 * other templates accept, on invoice.template first, then the invoice. Latin, Latin ext,
 * Cyrillic, Greek and Vietnamese are in Inter already; any other script brings its Noto Sans
 * face from Google Fonts, used for the glyphs Inter lacks.
 */
const SCRIPT_FONTS: Record<string, string> = {
  arabic: "Noto Sans Arabic",
  urdu: "Noto Sans Arabic",
  persian: "Noto Sans Arabic",
  hebrew: "Noto Sans Hebrew",
  devanagari: "Noto Sans Devanagari",
  hindi: "Noto Sans Devanagari",
  marathi: "Noto Sans Devanagari",
  nepali: "Noto Sans Devanagari",
  bengali: "Noto Sans Bengali",
  bangla: "Noto Sans Bengali",
  gujarati: "Noto Sans Gujarati",
  gurmukhi: "Noto Sans Gurmukhi",
  punjabi: "Noto Sans Gurmukhi",
  tamil: "Noto Sans Tamil",
  telugu: "Noto Sans Telugu",
  kannada: "Noto Sans Kannada",
  malayalam: "Noto Sans Malayalam",
  oriya: "Noto Sans Oriya",
  odia: "Noto Sans Oriya",
  sinhala: "Noto Sans Sinhala",
  thai: "Noto Sans Thai",
  khmer: "Noto Sans Khmer",
  lao: "Noto Sans Lao",
  myanmar: "Noto Sans Myanmar",
  georgian: "Noto Sans Georgian",
  armenian: "Noto Sans Armenian",
  ethiopic: "Noto Sans Ethiopic",
  amharic: "Noto Sans Ethiopic",
  japanese: "Noto Sans JP",
  korean: "Noto Sans KR",
  chinese: "Noto Sans SC",
  chinesesimplified: "Noto Sans SC",
  simplifiedchinese: "Noto Sans SC",
  chinesetraditional: "Noto Sans TC",
  traditionalchinese: "Noto Sans TC",
};

/* Scripts read right to left on their own, even without the RTL switch. */
const RTL_SCRIPTS = ["arabic", "urdu", "persian", "hebrew"];

const scriptKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z]/g, "");

const optionalFlag = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  const raw = text(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;
  return undefined;
};

export const mapScript = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const template = asRecord(invoice.template);
  const sources = [template, invoice];
  const pick = (...keys: string[]) =>
    firstText(...sources.flatMap((source) => keys.map((key) => source[key])));
  const script = pick(
    "languageScript",
    "script",
    "fontScript",
    "scriptType",
    "language"
  );
  const key = scriptKey(script);
  const rtlFlag = sources
    .flatMap((source) =>
      [
        "enableRtl",
        "enableRTL",
        "isRtl",
        "isRTL",
        "rtl",
        "rightToLeft",
        "enableRightToLeft",
      ].map((name) => optionalFlag(source[name]))
    )
    .find((flag) => flag !== undefined);
  const direction = scriptKey(pick("direction", "textDirection", "dir"));
  const isRtl = rtlFlag ?? (direction === "rtl" || RTL_SCRIPTS.includes(key));
  const font = SCRIPT_FONTS[key] || "";
  return {
    dir: isRtl ? "rtl" : "ltr",
    lang: pick("languageCode", "lang", "locale"),
    script: key,
    font,
    fontUrl: font
      ? `https://fonts.googleapis.com/css2?family=${font.replace(
          / /g,
          "+"
        )}:wght@400;500;600;700&display=swap`
      : "",
  };
};

/* ------------------------------------------------------------------ document settings */

/*
 * A field's own setting (invoiceValueProps): `false`, or `{ visible | isVisible | show |
 * showInInvoice: false }` (also under `params`), hides it. Keys match case-blind.
 */
export const fieldSetting = (
  invoice: UnknownRecord,
  keys: string[]
): boolean | undefined => {
  const props = asRecord(invoice.invoiceValueProps);
  const names = Object.keys(props);
  return keys
    .map((key) =>
      names.find((name) => name.toLowerCase() === key.toLowerCase())
    )
    .filter((name): name is string => name !== undefined)
    .map((name) => {
      const prop = props[name];
      const record = asRecord(prop);
      const params = asRecord(record.params);
      return [
        prop,
        record.visible,
        record.isVisible,
        record.show,
        record.showInInvoice,
        params.visible,
        params.isVisible,
        params.showInInvoice,
      ]
        .map(optionalFlag)
        .find((value) => value !== undefined);
    })
    .find((value) => value !== undefined);
};

/*
 * The document's display settings, each under every name a host sends it (advanceOptions
 * first, then the document, whose root also carries the host-level fields), as the Sri Lankan
 * and Vaishnavi templates read them. Where the shared normalizer already resolves a setting,
 * its answer is the fallback, so a document with none of the aliases reads as before.
 */
export const resolveSettings = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const advanceOptions = asRecord(state.advanceOptions);
  const pdfOptions = asRecord(state.pdfOptions);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const read = (...keys: string[]): boolean | undefined =>
    [advanceOptions, invoice]
      .flatMap((source) => keys.map((key) => optionalFlag(source[key])))
      .find((value) => value !== undefined);
  // "show…" wins over "hide…"; with neither, the default.
  const showHide = (show: string[], hide: string[], fallback: boolean) => {
    const shown = read(...show);
    if (shown !== undefined) return shown;
    const hidden = read(...hide);
    return hidden === undefined ? fallback : !hidden;
  };
  const showTotals = Boolean(visibility.showTotals);
  return {
    descriptionFullWidth:
      read("showDescriptionInFullWidth", "isDescriptionFullWidth") ??
      Boolean(visibility.isDescriptionFullWidth),
    itemNameFullWidth:
      read("itemNameFullWidth", "showItemNameFullWidth") ??
      Boolean(visibility.itemNameFullWidth),
    // Serial numbers of serial-tracked stock, under the item's name (on unless switched off).
    serialNumbers:
      read("showSerialNumbersInDescription", "showSerialNumbersInInvoice") ??
      true,
    groupSubtotal: showHide(["showGroupSubTotal"], ["hideGroupSubTotal"], true),
    // The in-table Total row ("Show summarised total quantity").
    totalsRow:
      showTotals &&
      (read(
        "showSummarizedTotalQuantity",
        "showSummarisedTotalQuantity",
        "showTotalsRow"
      ) ??
        Boolean(visibility.showTotalsRow)),
    totalInWords: showHide(["showTotalInWords"], ["hideTotalInWords"], true),
    // The Balance Due row (shown once something is paid, unless switched off).
    dueAmount:
      fieldSetting(invoice, ["dueAmount", "balanceDue", "due", "toPay"]) ??
      showHide(
        ["showDueAmount", "showBalanceDue"],
        ["hideDueAmount", "hideBalanceDue"],
        true
      ),
    terms:
      fieldSetting(invoice, ["terms", "termsAndConditions"]) ??
      showHide(["showTerms"], ["hideTerms"], true),
    batchSummary: read("showStockSummary") ?? true, // "Show Batch Summary in Invoice"
    // "Show Applied Exchange Rate" (the document settings' checkbox
    // advanceOptions.showExchangeRateOnPdf): the business-currency figures and the Conversion
    // Rate row. Off unless switched on.
    exchangeRate:
      read(
        "showExchangeRateOnPdf",
        "showAppliedExchangeRate",
        "showExchangeRate"
      ) ?? false,
    // Lydia's Pageless PDF: one page as tall as the content, so nothing repeats per page.
    pageless:
      [pdfOptions.pageless, pdfOptions.isPageless, pdfOptions.longPdf]
        .map(optionalFlag)
        .find((value) => value !== undefined) ?? false,
  };
};

export type EcommerceSettings = ReturnType<typeof resolveSettings>;

/* ------------------------------------------------------------------ parties */

/* Parties carry an ISO country code ("IN"); print the country's name. */
const regionName = (code: string): string =>
  /^[A-Za-z]{2}$/.test(code)
    ? (new Intl.DisplayNames(["en"], { type: "region", fallback: "code" }).of(
        code.toUpperCase()
      ) as string)
    : code;

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

/*
 * A party's VAT / TRN / TIN / SST / Tax ID prints only when the document carries it (user
 * rule: nothing that was not added in the form). A business profile keeps these numbers
 * whatever the document, so a stored value alone is not enough:
 *   - a switch that hides it anywhere (`<key>ShowInInvoice`, `hide<Key>`, the party's or the
 *     business's fieldVisibility) hides it;
 *   - otherwise refrens.com decides by the party's country, whatever the document's tax type
 *     (465 real documents): a party outside India prints its number (a UAE VAT on an Indian GST
 *     invoice), an Indian party does not (its VAT number on a GLOBAL document stays off).
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
          .map(optionalFlag)
          .find((flag) => flag !== undefined);
      });
  const switches = [
    ...aliases.flatMap((alias) => {
      const cap = alias.charAt(0).toUpperCase() + alias.slice(1);
      return [
        party[`${alias}ShowInInvoice`],
        party[`show${cap}InInvoice`],
        party[`show${cap}`],
      ].map(optionalFlag);
    }),
    ...fromMap(asRecord(party.fieldVisibility)),
    ...fromMap(business),
  ].filter((flag): flag is boolean => flag !== undefined);
  const hidden = aliases.some((alias) => {
    const cap = alias.charAt(0).toUpperCase() + alias.slice(1);
    return optionalFlag(party[`hide${cap}`]) === true;
  });
  if (hidden || switches.includes(false)) return false;
  if (switches.includes(true)) return true;
  const country = text(party.country).toUpperCase();
  return Boolean(country) && country !== "IN" && country !== "INDIA";
};

/* A party's field list, as an array or as a map keyed by field id (business profiles). */
const fieldList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : Object.values(asRecord(value));

/*
 * A custom field's value as Refrens prints it, whatever its type: a multi-select or checkbox
 * list joined ("Option 2, Option 3"), a yes/no field as "Yes" / "No", the rest as text.
 */
/* An upper-case code word in title case ("SAVINGS" → "Savings"); mixed case stays as typed. */
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

export const customFieldText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        isRecord(entry) ? firstText(entry.label, entry.value) : text(entry)
      )
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return text(value);
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

/*
 * Numbers never wrap; text does (user rule). A field the template reads as a figure or code
 * (a challan number, a vehicle number, an ID) keeps to one line only while its value looks
 * like one: a single unbroken token, or a short value with digits in it ("MH 12 AB 1234",
 * "+91 90000 00000"). A business can relabel such a field and fill it with text ("Final
 * Destination: <an address>"), which then wraps like any text. Dates stay whole.
 */
const NUMBER_LIKE_MAX = 24;

export const staysWhole = (value: unknown, isDate = false): boolean => {
  if (isDate) return true;
  const shown = text(value);
  if (!/\s/.test(shown)) return true;
  return shown.length <= NUMBER_LIKE_MAX && /\d/.test(shown);
};

export const mapParty = (
  invoice: UnknownRecord,
  partyValue: unknown,
  title: string,
  billing = false
) => {
  const party = asRecord(partyValue);
  const name = text(party.name);
  if (!name) return null;

  // "Bengaluru, Karnataka, India - 560055", as the design writes the city line.
  const pin = text(party.pincode || party.zipCode);
  const place = [
    text(party.city),
    text(party.district) === text(party.city) ? "" : text(party.district),
    text(party.state),
    regionName(text(party.country)),
  ]
    .filter(Boolean)
    .join(", ");
  const regionLine = [place, pin].filter(Boolean).join(" - ");
  const streetLine = [
    text(party.address),
    text(party.building),
    text(party.street),
  ]
    .filter(Boolean)
    .join(", ");

  const ids: LabelValue[] = [];
  // GSTIN and PAN print only when filled in; an empty field never leaves a bare label, even
  // with "Show when Empty" on (user rule: only what was added, in the form's order). They are
  // Indian numbers: refrens.com leaves them off a seller or buyer abroad (Hong Kong, US — 465
  // real documents), while a shipping address prints whatever it carries.
  const country = text(party.country).toUpperCase();
  const indian = !billing || ["", "IN", "INDIA"].includes(country);
  if (indian && fieldShown(invoice, party, "gst") && text(party.gstin)) {
    ids.push({ key: "gstin", label: "GSTIN", value: text(party.gstin) });
  }
  if (indian && fieldShown(invoice, party, "pan") && text(party.panNumber)) {
    ids.push({ key: "pan", label: "PAN", value: text(party.panNumber) });
  }
  const labels = asRecord(invoice.customLabels);
  // The other geographies' tax numbers (VAT, TRN, TIN, SST, Tax ID), labelled as
  // sr-trading-2-0 labels them — only where the document carries them (taxIdShown).
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
   * The contact person reads as a field like the others, "Contact Person: …" as
   * Refrens prints it, unless one of the party's own fields already carries the name.
   */
  const extras = extraRows(party).filter((row) => row.label && row.value);
  const contactPerson = asRecord(party.contactPerson);
  const personName = text(contactPerson.name);
  // The contact person's email and phone print too when the client's contact asks for them
  // (contactPerson.displayFields, as the API sends it: ["name", "email", "phone"]).
  const shows = (field: string) =>
    asArray(contactPerson.displayFields).map(text).includes(field);
  const person: LabelValue[] = [
    ...(personName &&
    !extras.some((row) => row.value.toLowerCase() === personName.toLowerCase())
      ? [
          {
            key: "contactPerson",
            label: firstText(
              labels.contactPerson,
              labels.responsiblePerson,
              "Contact Person"
            ),
            value: personName,
          },
        ]
      : []),
    ...(shows("email") && text(contactPerson.email)
      ? [
          {
            key: "contactPersonEmail",
            label: labelOr(labels, "contactPersonEmail", "Contact Email"),
            value: text(contactPerson.email),
          },
        ]
      : []),
    ...(shows("phone") && text(contactPerson.phone)
      ? [
          {
            key: "contactPersonPhone",
            label: labelOr(labels, "contactPersonPhone", "Contact Phone"),
            value: text(contactPerson.phone),
          },
        ]
      : []),
  ];
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
   * (isNum); an email stays on one line while it fits and breaks only when its box is too
   * narrow (isEmail), never overflowing; other text wraps.
   */
  const entry = (row: LabelValue & { isNum?: boolean }, numeric: boolean) => {
    const isNum = numeric && staysWhole(row.value, Boolean(row.isDate));
    return {
      label: row.label,
      value: row.value,
      isDate: Boolean(row.isDate),
      isNum,
      noWrap: isNum,
      isEmail: row.key === "email",
      isPhone: row.key === "phone",
      // One unbroken word (an email, a GSTIN, a code): it starts on its label's line and only
      // what does not fit runs on to the next (user request), instead of the whole value
      // dropping below the label.
      isToken: !row.isDate && !/\s/.test(row.value),
    };
  };
  const pairs = <T>(rows: T[]): T[][] =>
    rows
      .filter((_, index) => index % 2 === 0)
      .map((_, index) => rows.slice(index * 2, index * 2 + 2));
  const lines = [
    ids.map((row) => entry(row, true)),
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
 * Offline QR encoder (byte mode, error correction M, versions 1-40, up to 2,331 bytes: an
 * e-invoice's signed QR runs to about 1,000), extended from the one the Shree Vaishnavi
 * template ships (versions 21-40 follow the standard's block and alignment tables); the
 * API hands the UPI QR as a `upi://` link
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
  [26, 17, 42, 0, 0],
  [28, 17, 46, 0, 0],
  [28, 4, 47, 14, 48],
  [28, 6, 45, 14, 46],
  [28, 8, 47, 13, 48],
  [28, 19, 46, 4, 47],
  [28, 22, 45, 3, 46],
  [28, 3, 45, 23, 46],
  [28, 21, 45, 7, 46],
  [28, 19, 47, 10, 48],
  [28, 2, 46, 29, 47],
  [28, 10, 46, 23, 47],
  [28, 14, 46, 21, 47],
  [28, 14, 46, 23, 47],
  [28, 12, 47, 26, 48],
  [28, 6, 47, 34, 48],
  [28, 29, 46, 14, 47],
  [28, 13, 46, 32, 47],
  [28, 40, 47, 7, 48],
  [28, 18, 47, 31, 48],
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
  [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98],
  [6, 30, 54, 78, 102],
  [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130],
  [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142],
  [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154],
  [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
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

const gstCode = (value: unknown): string => {
  const match = text(value).match(/^0?(\d{1,2})(?:\D|$)/);
  return match ? match[1].padStart(2, "0") : "";
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
/* Characters beyond which a header detail's value moves under its label. */
const META_LONG = 30;

export const mapMeta = (state: UnknownRecord, transportRows: LabelValue[]) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);

  const rows: LabelValue[] = [
    {
      key: "invoiceNumber",
      label: labelOr(labels, "invoiceNumber", "Invoice Number"),
      // "#2026-1-SYNC22" unless the business hides the # (Settings > Hide # in all Document
      // Number series, owner.configuration.hideHashInDocumentNumber), as refrens.com prints it.
      value:
        text(invoice.invoiceNumber) &&
        ownerConfiguration(invoice).hideHashInDocumentNumber === false
          ? `#${text(invoice.invoiceNumber)}`
          : text(invoice.invoiceNumber),
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
    // A credit / debit note's reason ("Product Return", "Correction in Invoice"), as Refrens
    // prints it under the dates.
    {
      key: "documentReason",
      label: labelOr(labels, "documentReason", "Reason"),
      value: text(invoice.documentReason),
    },
    {
      key: "purchaseOrderNumber",
      label: labelOr(labels, "purchaseOrderNumber", "PO No."),
      value: text(invoice.purchaseOrderNumber),
    },
    ...asArray(invoice.customHeaders)
      .map(asRecord)
      .map((entry) => ({
        key: "customHeader",
        label: text(entry.label),
        value: customFieldText(entry.value),
      })),
    ...transportRows,
    // "Created by <name>" when the document's "Show in Invoice" toggle beside its creator is
    // on (advanceOptions.showCreatorInInvoice).
    {
      key: "createdBy",
      label: labelOr(labels, "createdBy", "Created By"),
      value:
        asRecord(invoice.advanceOptions).showCreatorInInvoice === true
          ? text(asRecord(invoice.creator).name)
          : "",
    },
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

  // Figures, codes and dates never wrap (layout rule 4); text values do, and a long one
  // (more than META_LONG characters) takes a line of its own under its label (user request).
  // A field the business has switched off in its field settings stays off.
  return rows
    .filter((row) => row.label && row.value)
    .filter((row) => fieldSetting(invoice, [row.key]) !== false)
    .map((row) => ({
      ...row,
      isLong: !row.isDate && row.value.length > META_LONG,
      isNum:
        Boolean(row.isDate) ||
        ((Boolean(row.isNum) ||
          ["invoiceNumber", "purchaseOrderNumber"].includes(row.key)) &&
          staysWhole(row.value)) ||
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
  const rows = [
    {
      key: "countryOfSupply",
      label: labelOr(labels, "countryOfSupply", "Country of Supply"),
      value: regionName(
        normalizeCountryOfSupply(invoice as unknown as FlattenedInvoicePayload)
      ),
      isHidden: country.configured === false,
      attr: "",
    },
    {
      key: "placeOfSupply",
      label: labelOr(labels, "placeOfSupply", "Place of Supply"),
      value: placeOfSupplyText(invoice),
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

/*
 * Transport details: in the invoice details grid by default, or their own box beside Shipped
 * From (template setting transportPosition = "section"). Any transport value, or an e-way
 * bill alone, shows them; each row shows only when it has a value.
 */
/*
 * The e-way bill (number, date, valid till, cancelled on): printed in the compliance box under
 * the IRN details (user request), each row unless the business's e-way settings hide it.
 */
export const mapEway = (state: UnknownRecord): LabelValue[] => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const irn = asRecord(invoice.irn);
  const { eway } = complianceSettings(invoice);
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
            label: labelOr(labels, "ewayBillDate", "E-Way Bill Date"),
            value: text(irn.EwbDt),
            isUtcDate: true,
          },
        ]),
    ...(isOff(eway.billValidTillDate)
      ? []
      : [
          {
            key: "ewayValidTill",
            label: labelOr(labels, "validTillDate", "Valid Till"),
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
  ];
  return rows.filter((row) => row.label && row.value);
};

/*
 * Refrens stores transport choices as codes ("RAIL", "OVERDIMENSIONALCARGO"); the document
 * prints their names, as Refrens does. An unknown code reads in title case ("NEW_MODE" →
 * "New Mode"); free text prints as typed.
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
  return (
    TRANSPORT_NAMES[raw] ||
    raw
      .split("_")
      .filter(Boolean)
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ")
  );
};

/*
 * Transport Details in the order the form fills them and Refrens prints them (user request: no
 * reordering): Transport Mode, Transporter, Transporter ID, Distance, Challan Date, Challan
 * Number, Vehicle Type, Vehicle Number, then any extra information. Transaction Type and Sub
 * Supply Type belong to the e-way bill and are not printed here, as on Refrens.
 */
export const mapTransport = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);

  const rows: LabelValue[] = [
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
        Boolean(row.isDate) || (Boolean(row.isNum) && staysWhole(row.value)),
    }));

  // Any transport value shows the block.
  return rows.length
    ? { title: heading(labels, "transport", "Transport Details"), rows }
    : null;
};

/* Document type → its key in owner.configuration.showQrCode. */
const QR_DOCUMENT_KEYS: Record<string, string> = {
  INVOICE: "invoice",
  QUOTATION: "quotation",
  PROFORMA: "proforma",
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
  // The e-invoice QR: an image the host posts (qrCode), else the IRN's own QR text as the API
  // sends it — the signed QR (irn.SignedQRCode) when the business prints that
  // (owner.configuration.showSignedIrnQr), else the QR payload (irn.qr) — drawn here.
  const irnQr = qrImage(
    firstText(
      invoice.qrCode,
      irn.qrCode,
      ownerConfiguration(invoice).showSignedIrnQr === true
        ? firstText(irn.SignedQRCode, irn.qr)
        : firstText(irn.qr, irn.SignedQRCode)
    )
  );
  // The document QR shows unless the business switched QR codes off, in general
  // (enableQrCode) or for this kind of document (showQrCode.<type>).
  const configuration = ownerConfiguration(invoice);
  const qrKey =
    QR_DOCUMENT_KEYS[text(invoice.billType).toUpperCase()] ||
    text(invoice.billType).toLowerCase();
  const documentQr =
    isOff(configuration.enableQrCode) ||
    isOff(asRecord(configuration.showQrCode)[qrKey])
      ? ""
      : text(invoice.documentQr);

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
  const eway = mapEway(state);

  return {
    // Above the item table unless the business places it below (irnPosition).
    isBelowItems:
      firstText(invoice.irnPosition, configuration.irnPosition)
        .toUpperCase()
        .replace(/[^A-Z]/g, "") === "BELOWLINEITEMS",
    showIrn: !isOff(einvoice.irnNumber),
    irnLabel: labelOr(labels, "irn", "IRN No."),
    irn: text(irn.Irn),
    // E-Invoice and E-Way Bill: two groups of "Label: value" lines side by side, without titles
    // (user request), the QR codes on the end edge.
    eway,
    rows: [...rows, ...eway],
    irnRows: rows,
    // Two to a line (Ack No. | Ack Date), like the party fields.
    rowLines: rows
      .filter((_, index) => index % 2 === 0)
      .map((_, index) => rows.slice(index * 2, index * 2 + 2)),
    /*
     * One QR, as refrens.com prints it (checked on real documents): while the e-invoice is
     * active its QR replaces the document QR and prints in the e-invoice section, beside the
     * IRN lines (user request; signed or plain, per showSignedIrnQr); without an IRN, or once
     * it is cancelled, the document QR prints under the document details.
     */
    qr: {
      irn: irnQr && !isCancelled ? irnQr : "",
      zatca: text(invoice.zatcaQrCode),
      lhdn: text(invoice.lhdnQrCode),
      // documentQr arrives as text (a JSON summary of the document): draw it.
      document: irnQr && !isCancelled ? "" : qrImage(documentQr),
      documentAlt: "Document QR Code",
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

/*
 * The batches an item is drawn from: its allocations' batch data (a batch-tracked line
 * carries { batch: <id>, batchData: { batchName, batchCode, expiryDate, … } }), else the batch
 * itself when it came populated, then the item's own batchSummary entries. A bare batch id is
 * never one of them.
 */
const itemBatches = (item: UnknownRecord): UnknownRecord[] => [
  ...asArray(item.allocations).map((entry) => {
    const allocation = asRecord(entry);
    return {
      ...(isRecord(allocation.batch) ? allocation.batch : {}),
      ...asRecord(allocation.batchData),
    };
  }),
  ...asArray(item.batchSummary).map((entry) => {
    const record = asRecord(entry);
    return { ...asRecord(record.batch), ...record };
  }),
];

/*
 * Refrens' batch columns in the items table (the business's own columns: Batch Name, Batch
 * Code, Expiry Date, Mfg Date, Mfg Name, Mfg Batch No.): each batch's value, once each.
 */
const BATCH_FIELD_KEYS = [
  "batchName",
  "batchCode",
  "expiryDate",
  "manufacturingDate",
  "manufacturerName",
  "manufacturerBatchNumber",
];

const batchFieldText = (
  item: UnknownRecord,
  key: string,
  ownerOffset: unknown
): string =>
  itemBatches(item)
    .map((batch) => {
      const value =
        key === "batchName"
          ? pickFirst(batch.batchName, batch.name)
          : batch[key];
      if (!hasValue(value)) return "";
      return /date$/i.test(key)
        ? formatDocumentDate(value, ownerOffset)
        : text(value);
    })
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(", ");

/*
 * An item's serial numbers (serial-tracked stock): its own list, then those of its batches,
 * each a plain value or { serialNumber | serialNo | serial | code | value | name }, once each.
 */
const serialText = (value: unknown): string => {
  if (!isRecord(value)) return text(value);
  return firstText(
    value.serialNumber,
    value.serialNo,
    value.serial,
    value.code,
    value.value,
    value.name
  );
};

const listOf = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  return hasValue(value) || isRecord(value) ? [value] : [];
};

export const itemSerialNumbers = (item: UnknownRecord): string =>
  [
    ...listOf(
      pickFirst(
        item.serialNumbers,
        item.serials,
        item.inventorySerialNumbers,
        item.serialNumber,
        item.serialNo
      )
    ),
    ...asArray(item.batchSummary).flatMap((entry) => {
      const batch = asRecord(entry);
      return listOf(
        pickFirst(
          batch.serialNumbers,
          batch.serials,
          batch.inventorySerialNumbers
        )
      );
    }),
  ]
    .map(serialText)
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .join(", ");

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
  // A number column, or a formula that returns a number, prints as a figure.
  const type = text(column.dataType).toLowerCase();
  const returns = text(column.fxReturnType).toLowerCase();
  return type === "number" || (type === "formula" && returns === "number")
    ? "number"
    : "text";
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
    className: `ec-col-${key.replace(/[^A-Za-z0-9_-]/g, "")} ${
      NUMERIC_KINDS.includes(kind) || kind === "code" ? "is-fixed" : "is-text"
    }${NUMERIC_KINDS.includes(kind) ? " is-num" : ""}`,
    summable,
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
    ).value
  );

/* The discount column holds either a flat amount or `{ amount, discountType }`. */
const discountParts = (item: UnknownRecord) => {
  const { discount } = item;
  if (!isRecord(discount)) return { amount: discount, isPercent: false };
  // A discount type with no amount is no discount: refrens.com prints it as "0%".
  const typed = text(discount.discountType) !== "";
  return {
    amount: !hasValue(discount.amount) && typed ? 0 : discount.amount,
    isPercent: /percent/i.test(text(discount.discountType)),
  };
};

/*
 * A custom (formula) column can hold its figure as formatted text — "20,13,20,21,562" — and a
 * plain number reader stops at the first comma, printing "20" (user report). Grouped text
 * that is all digits reads as the whole number; anything else stays as it is.
 */
export const groupedNumber = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!/^-?\d{1,3}([,\s]\d{2,3})+(\.\d+)?$/.test(raw)) return value;
  const parsed = Number(raw.replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : value;
};

export const columnNumber = (
  item: UnknownRecord,
  column: ItemColumn
): unknown => {
  if (column.key === "total") return pickFirst(item.total, item.subTotal);
  if (column.key === "sgst") return pickFirst(item.sgst, item.utgst);
  if (column.key === "gstRate") return pickFirst(item.gstRate, item.taxRate);
  if (column.kind === "discount") return discountParts(item).amount;
  const value = customCellValue(item, column);
  return column.kind === "text" ? value : groupedNumber(value);
};

const cellValue = (
  invoice: UnknownRecord,
  visibility: UnknownRecord,
  item: UnknownRecord,
  column: ItemColumn,
  ctx: FormatContext,
  mergeUnit: boolean
): string => {
  if (BATCH_FIELD_KEYS.includes(column.key)) {
    const own = customCellValue(item, column);
    return hasValue(own)
      ? text(own)
      : batchFieldText(item, column.key, invoice.ownerOffset);
  }
  const value = columnNumber(item, column);
  switch (column.kind) {
    case "code":
      if (column.key === "unit") return unitText(invoice, item);
      return text(value);
    case "qty": {
      // "10 PCS": the account's choice, or the table's last-but-one width fallback.
      const unit =
        visibility.showUnitInQuantity || mergeUnit
          ? unitText(invoice, item)
          : "";
      const quantity = formatQuantity(value, ctx);
      return quantity && unit ? `${quantity} ${unit}` : quantity;
    }
    case "percent":
      return formatPercent(value, ctx);
    case "discount":
      return discountParts(item).isPercent
        ? formatPercent(value, ctx)
        : formatMoney(value, ctx);
    case "money":
      return formatMoney(value, ctx);
    case "number": {
      // A custom figure as refrens.com prints it: grouped, two decimal places, a plain minus
      // ("15,62,82,300.00", "-8.00"); one saved as formatted text stays as typed.
      const saved = customCellValue(item, column);
      if (typeof saved === "string" && !/^\s*-?\d+(\.\d+)?\s*$/.test(saved)) {
        return text(saved);
      }
      return hasValue(value)
        ? formatNumber(toAmount(value), ctx.locale, 2, 2)
        : "";
    }
    default:
      return Array.isArray(value) ? value.map(text).join(", ") : text(value);
  }
};

const MSIC_OFF_TYPES = ["INVOICE", "PROFORMAINV", "SALESORDER"];

const resolveColumns = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  // Normalization drops semanticType / isCessColumn; read them off the account's column.
  const raw = asArray(invoice.columns).map(asRecord);
  // MSIC is a column like any other on refrens.com (the shared normalizer always drops it):
  // it prints unless the business hid it — on challans and quotations; refrens.com leaves it
  // off invoices, proformas and sales orders (189 real documents).
  const columns = asArray(asRecord(state.mapped).columns)
    .map(asRecord)
    .filter(
      (column) =>
        text(column.key) &&
        (column.isHidden !== true ||
          (column.key === "msic" &&
            !MSIC_OFF_TYPES.includes(text(invoice.billType).toUpperCase()) &&
            raw.some(
              (entry) => entry.key === "msic" && entry.isHidden !== true
            )))
    )
    .map((column) =>
      makeColumn({
        ...raw.find((entry) => entry.key === column.key),
        ...column,
      })
    );
  // "Show batch columns in invoice" switched off: the batch columns are left out.
  if (
    optionalFlag(asRecord(invoice.advanceOptions).showBatchColumnsInInvoice) ===
    false
  ) {
    columns.splice(
      0,
      columns.length,
      ...columns.filter((column) => !BATCH_FIELD_KEYS.includes(column.key))
    );
  }
  const has = (key: string) => columns.some((column) => column.key === key);

  // Unit is not an account column: it comes from the item itself. Batch columns are the
  // business's own (batchName, batchCode, expiryDate…), filled from the item's batches.
  const quantityIndex = columns.findIndex(
    (column) => column.key === "quantity"
  );
  // No item with a unit: no Unit column (as refrens.com).
  const anyUnit = asArray(invoice.items)
    .map(asRecord)
    .some((item) => !item.group && unitText(invoice, item));
  if (
    visibility.showUnitAsColumn &&
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
  // The account's own Unit column too, when no item has a unit.
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
 * Table layout. Columns start at their Figma widths (node 18843:3442) and grow only when their
 * widest value needs it; Description takes the rest of the 960 px design width and keeps at
 * least 22% of the table. When it would fall below that, these fallbacks apply in order:
 * columns shrink to their content, headers wrap (after "/"), Unit merges into Qty, numbers get
 * 10% smaller. Below the table's minimum width the table scrolls inside its own box. Widths
 * are estimated from the text with bold glyph widths, which errs wide for the regular cells.
 */
/* 960 px of content less the table's own 1 px outline on each side. */
const DESIGN_TABLE_WIDTH = 958;
/*
 * Every cell, header included, carries 6 px of padding each side (user request); the Sr
 * column is the design's 28 px widened by that padding.
 */
const SERIAL_WIDTH = 43;
/* Item columns holding a tax amount (IGST, CGST, SGST, UTGST, cess…). */
const TAX_COLUMN = /^(igst|cgst|sgst|utgst|cess|vat|tax)/i;
const MIN_DESCRIPTION_SHARE = 0.22;
const CELL_PADDING = 13; // 6 px each side + the 1 px rule
const HEADER_PADDING = CELL_PADDING;

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

/*
 * data-col (the test hook) and the starting width of each account column: the Figma widths
 * (Unit Price 103, Qty / Unit 61, Model 78), the rest sized alike.
 */
const COLUMN_SPEC: Record<string, { col: string; width: number }> = {
  name: { col: "desc", width: 0 },
  itemCode: { col: "code", width: 78 },
  sku: { col: "code", width: 78 },
  batchName: { col: "batch", width: 78 },
  hsn: { col: "hsn", width: 78 },
  quantity: { col: "qty", width: 61 },
  unit: { col: "unit", width: 61 },
  rate: { col: "rate", width: 103 },
  discount: { col: "disc", width: 78 },
  amount: { col: "tx", width: 103 },
  gstRate: { col: "gst", width: 61 },
  cgst: { col: "c", width: 93 },
  sgst: { col: "s", width: 93 },
  igst: { col: "ig", width: 103 },
  total: { col: "amt", width: 103 },
};
const CUSTOM_COLUMN_WIDTH = 78;

/* Header words, with a break opportunity after every "/" ("HSN/" + "SAC"). */
export const headerParts = (label: string): string[] =>
  label.replace(/\//g, "/\u0000").split("\u0000").filter(Boolean);

const headerWidth = (label: string): number =>
  Math.max(0, ...label.split(/\s+/).flatMap(headerParts).map(textWidth)) +
  HEADER_PADDING;

const longestWordWidth = (value: string): number =>
  Math.max(0, ...value.split(/\s+/).map(textWidth));

interface WidthInput {
  column: ItemColumn;
  values: string[];
  /* Qty's values as they print once Unit merges into it ("10 PCS"). */
  mergedValues?: string[];
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
  mergeUnit: boolean;
  smallNumbers: boolean;
  /* Description's width at the design width, and the minimum it is held to. */
  descriptionWidth: number;
  descriptionMin: number;
  /* Every column but Description, shrunk to content at full size: what print has to fit. */
  printFixedWidth: number;
}

/*
 * An item description saved with inline HTML ("<strong>100 to 200 words</strong>") reads as
 * refrens.com renders it: the shared Markdown viewer escapes HTML and would print the tags,
 * so bold, italics and line breaks become Markdown and any other tag is dropped.
 */
/*
 * Runs of empty lines in a note or description (saved line breaks, "<br>" tags, blank lines)
 * print as one paragraph break (user request: no large gaps).
 */
export const collapseBlankLines = (value: string): string =>
  value
    .replace(/(?:[ \t]*<\s*br\s*\/?>[ \t]*\n?){2,}/gi, "\n\n")
    .replace(/\n[ \t]*<\s*br\s*\/?>[ \t]*\n/gi, "\n\n")
    .replace(/\n(?:[ \t]*\n){2,}/g, "\n\n")
    .trim();

/* A Markdown table: a row of cells over its "| --- | --- |" divider. */
export const hasMarkdownTable = (value: string): boolean =>
  /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/m.test(
    value
  );

export const htmlToMarkdown = (value: string): string =>
  /<\/?[a-z][^>]*>/i.test(value)
    ? value
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, "**$2**")
        .replace(/<\s*(em|i)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, "*$2*")
        .replace(/<\/?[a-z][^>]*>/gi, "")
    : value;

export const planTableLayout = (inputs: WidthInput[]): TableLayout => {
  const fixed = inputs.filter(({ column }) => column.kind !== "name");
  const startOf = (column: ItemColumn) =>
    (COLUMN_SPEC[column.key] || { width: CUSTOM_COLUMN_WIDTH }).width;
  const minDescription = DESIGN_TABLE_WIDTH * MIN_DESCRIPTION_SHARE;

  const attempt = (shrink: boolean, mergeUnit: boolean, scale: number) => {
    const widths: Record<string, number> = {};
    fixed
      .filter(({ column }) => !(mergeUnit && column.key === "unit"))
      .forEach((input) => {
        const values =
          mergeUnit && input.mergedValues ? input.mergedValues : input.values;
        const needed = Math.ceil(
          contentWidth({ column: input.column, values }, scale)
        );
        widths[input.column.key] = shrink
          ? needed
          : Math.max(startOf(input.column), needed);
      });
    const others = Object.values(widths).reduce(
      (total, width) => total + width,
      SERIAL_WIDTH
    );
    return { widths, others, mergeUnit, smallNumbers: scale < 1 };
  };

  const hasUnit = fixed.some(({ column }) => column.key === "unit");
  const steps = [
    attempt(false, false, 1),
    attempt(true, false, 1), // shrink to content; headers already wrap after "/"
    ...(hasUnit ? [attempt(true, true, 1)] : []),
    attempt(true, hasUnit, 0.9),
  ];
  const chosen =
    steps.find((step) => DESIGN_TABLE_WIDTH - step.others >= minDescription) ||
    steps[steps.length - 1];

  return {
    widths: chosen.widths,
    mergeUnit: chosen.mergeUnit,
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
    printFixedWidth: attempt(true, chosen.mergeUnit, 1).others,
  };
};

const NUMBER_KINDS: ColumnKind[] = [...NUMERIC_KINDS, "code"];
/* Text values up to this many characters never wrap in the item table. */
const SHORT_TEXT = 12;

export const mapItemTable = (
  state: UnknownRecord,
  ctx: FormatContext,
  settings: EcommerceSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  const items = asArray(invoice.items)
    .map(asRecord)
    .filter((item) => item.hidden !== true && item.isAdditionalCharge !== true);
  const realItems = items.filter(isRealItem);
  const allColumns = resolveColumns(state);
  const showThumbnail =
    Boolean(visibility.showThumbnailAsColumn) &&
    realItems.some((item) => thumbnailOf(item) !== "");
  const fullWidth = settings.descriptionFullWidth;
  const { itemNameFullWidth } = settings;
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
  const valuesOf = (column: ItemColumn, mergeUnit: boolean) => [
    ...realItems.map((item) =>
      cellValue(invoice, visibility, item, column, ctx, mergeUnit)
    ),
    footerValue(column),
  ];

  const unitMergeable = allColumns.some((column) => column.key === "quantity");
  const layout = planTableLayout(
    allColumns.map((column) => ({
      column,
      values: valuesOf(column, false),
      // Qty as it would print once Unit merges into it (the third fallback).
      ...(column.key === "quantity" && unitMergeable
        ? { mergedValues: valuesOf(column, true) }
        : {}),
    }))
  );
  const { mergeUnit } = layout;
  const columns = allColumns.filter(
    (column) => !(mergeUnit && column.key === "unit")
  );
  const colspan = columns.length + 1;

  const header = columns.map((column) => ({
    key: column.key,
    col: (COLUMN_SPEC[column.key] || { col: column.key }).col,
    className: column.className,
    isName: column.kind === "name",
    labelParts: headerParts(column.label),
  }));

  /*
   * Groups read as section rows under their own name and number their items from 1 again.
   * Without groups the items number straight through.
   */
  let serial = 0;
  let itemIndex = -1;
  const rows = items
    .filter(
      (item) => !(item.isGroupItemTotalRow === true && !settings.groupSubtotal)
    )
    .map((item) => {
      if (item.group === true) {
        serial = 0;
        // A group carries images of its own, as an item does: images[] as thumbnails under
        // its name, originalImages[] in a full-width row below it.
        return {
          isGroupHeader: true,
          name: text(item.name),
          images: imageList(item.images),
          originalImages: imageList(item.originalImages),
          colspan,
        };
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
        settings.serialNumbers && !isGroupTotal && itemSerialNumbers(item)
          ? `${labelOr(
              labels,
              "serialNumbers",
              "Serial No."
            )}: ${itemSerialNumbers(item)}`
          : "",
      ].filter(Boolean);
      const description = isGroupTotal
        ? ""
        : collapseBlankLines(htmlToMarkdown(text(item.description)));
      // images[] travel with the description, wherever it is placed. originalImages[] always
      // take a row of their own under the item, across the whole table at its full width,
      // whether or not the description is full width.
      const images = isGroupTotal ? [] : imageList(item.images);
      const originalImages = isGroupTotal ? [] : imageList(item.originalImages);
      const hasDetail = description !== "" || images.length > 0;
      const inDetailRow = hasDetail && fullWidth;
      // A description holding a table takes the whole row, Sr.No column included, so the
      // table fills the item table's width (user request).
      const spansAll = inDetailRow && hasMarkdownTable(description);
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
        // The full-width row keeps the serial column and spans everything after it; a
        // description with a table spans the serial column too.
        detailSpansAll: spansAll,
        detailColspan: spansAll ? colspan : colspan - 1,
        // "Item name full width": the name (and its codes) reads across the row above the
        // item's figures, the name cell below left for the description.
        nameRow: itemNameFullWidth && !isGroupTotal,
        imageRow: originalImages.length > 0,
        thumbnail: showThumbnail ? thumbnailOf(item) : "",
        cells: columns.map((column) => {
          // A group total row only repeats the figures that add up (quantity, amounts, taxes,
          // total): a unit rate summed over a group means nothing ("₹0.00" before).
          const value =
            isGroupTotal && !column.summable
              ? ""
              : cellValue(invoice, visibility, item, column, ctx, mergeUnit);
          // A one-word or short value in a text column (a date, a code, "BLOCK - 1") stays
          // on one line too; longer text wraps.
          const isWord =
            column.kind === "text" &&
            (/^\S+$/.test(value) || value.length <= SHORT_TEXT);
          return {
            key: column.key,
            col: (COLUMN_SPEC[column.key] || { col: column.key }).col,
            className: isWord
              ? `${column.className} is-word`
              : column.className,
            isName: column.kind === "name",
            isNum:
              value !== "" && (NUMBER_KINDS.includes(column.kind) || isWord),
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
      value,
    };
  });

  /*
   * The TOTAL row prints what the design totals: the tax columns and the last money column
   * (Total Amount). The other sums (Qty, Net Amount) stay in `cells`, so the totals rows
   * below know which figures the items already add up to.
   */
  const lastMoney = columns
    .filter((column) => column.kind === "money" && column.summable)
    .map((column) => column.key)
    .pop();
  const totalled = footerCells.map((cell) =>
    TAX_COLUMN.test(cell.key) || cell.key === lastMoney
      ? cell
      : { ...cell, isNum: false, value: "" }
  );
  const firstTotalled = totalled.findIndex((cell) => cell.value !== "");
  const nameIndex = columns.findIndex((column) => column.kind === "name");
  const nameSpan = nameIndex >= 0 ? nameIndex + 2 : 1;

  return {
    columns,
    header,
    rows,
    colspan,
    // The further totals rows: the label across every column but the last.
    labelColspan: colspan - 1,
    /*
     * The totals rows under the TOTAL row: the label, an empty cell per column (no rules of
     * their own), and the figure in the last column with the one rule before it (user
     * request). A figure wider than its column never widens it: in the browser every row's
     * figure cell takes over the same number of empty cells to its left, as many as the widest
     * figure needs (registerEcommerceTotalsFit), so the rule stays one straight line on an item
     * column's edge.
     */
    nameSpan,
    fillers: Array.from(
      { length: Math.max(0, colspan - nameSpan - 1) },
      (_, i) => i
    ),
    showThumbnail,
    serialLabel: labelOr(labels, "serialNumber", "Sr.No"),
    serialWidth: SERIAL_WIDTH,
    mergeUnit,
    smallNumbers: layout.smallNumbers,
    descriptionMin: layout.descriptionMin,
    printFixedWidth: layout.printFixedWidth,
    footer: {
      show: settings.totalsRow && realItems.length > 0 && firstTotalled >= 0,
      // "TOTAL:" spans the serial cell and every column before the first totalled one, as
      // the design draws it; the figures sit under their own columns.
      labelSpan: 1 + Math.max(firstTotalled, 0),
      // TOTAL: under Sr.No and Description, then every column's own cell (its sum or empty),
      // so the item columns' rules run on through the TOTAL row (user request).
      gridCells: totalled.slice(nameSpan - 1),
      valueCells: firstTotalled < 0 ? [] : totalled.slice(firstTotalled),
      // No customLabels key exists for the in-table summary row (see architect-template).
      label: "TOTAL",
      labelInSerial: !columns.some((column) => column.kind === "name"),
      cells: footerCells,
    },
  };
};

/* ------------------------------------------------------------------ summaries */

/*
 * Batch Summary, Refrens' "Show Batch Summary in Invoice" (advanceOptions.showStockSummary):
 * one row per batch drawn — the document's own batchSummary (sent only for batch-tracked
 * documents with the setting on), else, when the setting is explicitly on, the items' batches.
 * Columns follow the business's batch summary config (stockSummaryConfig.batchSummaryColumns:
 * order, labels, hidden ones left out, the item's SKU and the batch's code in brackets when
 * switched on), as Refrens' own invoice prints them; without one, Item Name | Batch Name | Qty |
 * Warehouse | Mfg Name | Mfg Date | Expiry Date, a column no row fills left out. Kept in the
 * page, hidden, while switched off (data-ceres-batch-summary), like the other summaries.
 */
type BatchColumn = {
  key: string;
  label: string;
  showSku?: boolean;
  showBatchCode?: boolean;
};

const BATCH_COLUMNS: BatchColumn[] = [
  { key: "itemName", label: "Item Name", showSku: true },
  { key: "batchName", label: "Batch Name", showBatchCode: true },
  { key: "quantity", label: "Qty" },
  { key: "warehouse", label: "Warehouse" },
  { key: "manufacturerName", label: "Mfg Name" },
  { key: "manufacturingDate", label: "Mfg Date" },
  { key: "expiryDate", label: "Expiry Date" },
];

/* "Name (code)", or whichever of the two there is. */
const withCode = (name: unknown, code: unknown, show?: boolean): string => {
  const main = text(name);
  const extra = show ? text(code) : "";
  if (main && extra) return `${main} (${extra})`;
  return main || extra;
};

const batchValue = (entry: UnknownRecord, column: BatchColumn): unknown => {
  const batch = isRecord(entry.batch) ? entry.batch : {};
  if (column.key === "itemName") {
    return withCode(
      entry.itemName,
      pickFirst(entry.sku, batch.sku),
      column.showSku
    );
  }
  if (column.key === "batchName") {
    return withCode(
      pickFirst(
        entry.batchName,
        batch.batchName,
        batch.name,
        typeof entry.batch === "string" ? entry.batch : undefined
      ),
      pickFirst(entry.batchCode, batch.batchCode),
      column.showBatchCode
    );
  }
  if (column.key === "warehouse") {
    return pickFirst(
      entry.warehouseName,
      batch.warehouseName,
      isRecord(entry.warehouse) ? undefined : entry.warehouse
    );
  }
  return pickFirst(
    entry[column.key],
    batch[column.key],
    asRecord(entry.custom)[column.key],
    asRecord(batch.custom)[column.key]
  );
};

export const mapBatchSummary = (
  state: UnknownRecord,
  ctx: FormatContext,
  settings: EcommerceSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const advanceOptions = asRecord(state.advanceOptions);
  const explicit = optionalFlag(
    pickFirst(advanceOptions.showStockSummary, invoice.showStockSummary)
  );
  const documentRows = asArray(invoice.batchSummary).map(asRecord);
  const itemRows = (): UnknownRecord[] =>
    asArray(invoice.items)
      .map(asRecord)
      .filter(isRealItem)
      .flatMap((item) =>
        asArray(item.batchSummary)
          .map(asRecord)
          .map((batch) => ({
            ...batch,
            itemName: firstText(batch.itemName, item.name),
            sku: pickFirst(batch.sku, item.sku),
          }))
      );
  let entries = documentRows;
  if (!entries.length && explicit === true) entries = itemRows();
  if (!entries.length) return null;

  const configured: BatchColumn[] = asArray(
    pickFirst(
      asRecord(invoice.stockSummaryConfig).batchSummaryColumns,
      invoice.defaultBatchColumns
    )
  )
    .map(asRecord)
    .filter((column) => column.isHidden !== true)
    .map((column) => ({
      key: firstText(column.key, column.name),
      label: firstText(column.label, column.name, column.key),
      showSku: column.showSku === true,
      showBatchCode: column.showBatchCode === true,
    }))
    .filter((column) => column.key && column.label);
  const format = (key: string, value: unknown): string => {
    if (!hasValue(value)) return "";
    if (/date$/i.test(key))
      return formatDocumentDate(value, invoice.ownerOffset);
    if (/^(?:quantity|qty)$/i.test(key)) return formatQuantity(value, ctx);
    return text(value);
  };
  const source = configured.length ? configured : BATCH_COLUMNS;
  const rows = entries.map((entry) =>
    source.map((column) => ({
      key: column.key,
      value: format(column.key, batchValue(entry, column)),
      isNum: /^(?:quantity|qty)$/i.test(column.key),
    }))
  );
  // The business's own columns all print, filled or not (Refrens does the same).
  const columns = source
    .map((column, index) => ({ key: column.key, label: column.label, index }))
    .filter(
      (column) =>
        configured.length || rows.some((row) => row[column.index].value)
    );
  if (!columns.length) return null;

  return {
    title: heading(labels, "batchSummary", "Batch Summary"),
    hidden: !settings.batchSummary,
    columns,
    rows: rows.map((row) => columns.map((column) => row[column.index])),
  };
};

/* ------------------------------------------------------------------ payment */

export const mapBank = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const bank = asRecord(invoice.bankAccount);
  const labels = {
    ...asRecord(invoice.customLabels),
    ...asRecord(bank.customLabels),
  };
  const upiQr = text(asRecord(asRecord(state.mapped).qr).upi);
  // A delivery challan asks for no payment: refrens.com prints no bank details or UPI on it,
  // even with the account-transfer option on.
  const payable = text(invoice.billType).toUpperCase() !== "DELIVERYCHALLAN";

  // In the order of Refrens' bank account form (user request): Account Name, Account Number,
  // IFSC (with IBAN / SWIFT / Sort Code beside it), Account Type, Bank, then the rest.
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
            // a bank in India (283 real documents: none of the banks abroad printed it).
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
      isNum: NUMERIC_BANK_ROWS.includes(row.key) && staysWhole(row.value),
    })),
    upi: upiId
      ? {
          label: labelOr(labels, "upi", "UPI"),
          id: upiId,
          scanLabel: labelOr(labels, "scanToPay", "Scan to Pay"),
          // A pre-resolved QR image as given; otherwise the platform's UPI intent, drawn here.
          qr: isImageSource(upiQr) ? upiQr : qrImage(upiIntent(invoice, upiId)),
          note: labelOr(
            labels,
            "upiLimitNote",
            "Maximum of 1 lakh can be transferred via UPI in a single day"
          ),
        }
      : null,
  };
};

/*
 * An amount in words in the document's own currency, as refrens.com writes the tax
 * summaries' "Total Tax In Words" on a foreign-currency document ("FIVE THOUSAND FOUR HUNDRED
 * DOLLARS AND EIGHTEEN CENTS ONLY", "ONE HUNDRED EIGHTEEN RIYALS ONLY"): international
 * numbering (thousand, million, billion), the currency's main and fractional unit names. The
 * shared converter knows rupees only; rupees keep it (lakh, crore).
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

export const mapWords = (
  state: UnknownRecord,
  settings: EcommerceSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  if (!visibility.showTotals) return null;

  const stored = text(labels.totalInWordsValue);
  // Nothing stored: refrens.com spells the total itself, in the document's currency
  // ("ONE THOUSAND SIX HUNDRED FIFTY FIVE DOLLARS ONLY"); a currency without known words
  // prints none.
  const currency = text(invoice.currency).toUpperCase() || "INR";
  const total = toAmount(asRecord(invoice.finalTotal).total);
  const known = currency === "INR" || Boolean(CURRENCY_WORDS[currency]);
  const computed = known ? amountInCurrencyWords(total, currency) : "";
  // In capitals (user request), like the tax summary's words: "FIVE THOUSAND … ONLY", whether
  // the words come from the shared converter or the document (stored in lower case).
  const value = (stored || computed).toUpperCase();
  // Switched off, the line stays in the page, hidden, as the Subtotal widget keeps it, so
  // the host's live toggle (data-ceres-total-in-words) can bring it back. A document with
  // more decimal places than the currency (3) still shows it, in rupees and paise (user request).
  return value
    ? {
        label: labelOr(labels, "totalInWords", "Amount In Words"),
        value,
        hiddenBySetting: !settings.totalInWords,
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
/*
 * The discount row's rate (user request: a percentage after the discount label): the
 * document's own discountPercentage; else the one percentage every discounted item shares;
 * else the effective rate, the discount over the subtotal. "" when there is no discount.
 */
export const discountRate = (invoice: UnknownRecord): string => {
  const finalTotal = asRecord(invoice.finalTotal);
  const ctx = formatContext(invoice);
  const own = toAmount(finalTotal.discountPercentage);
  if (own > 0) return formatNumber(own, ctx.locale, 0, 2);
  const discounted = asArray(invoice.items)
    .map(asRecord)
    .filter(isRealItem)
    .map(discountParts)
    .filter((part) => toAmount(part.amount) > 0);
  const shares = discounted
    .map((part) => (part.isPercent ? toAmount(part.amount) : NaN))
    .filter((rate, index, all) => all.indexOf(rate) === index);
  if (discounted.length && shares.length === 1 && Number.isFinite(shares[0])) {
    return formatNumber(shares[0], ctx.locale, 0, 2);
  }
  const discount = toAmount(
    pickFirst(finalTotal.discount, finalTotal.totalDiscount)
  );
  const subTotal = toAmount(finalTotal.subTotal);
  return discount > 0 && subTotal > 0
    ? formatNumber((discount / subTotal) * 100, ctx.locale, 0, 2)
    : "";
};

export const mapTotals = (
  state: UnknownRecord,
  settings: EcommerceSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const advanceOptions = asRecord(invoice.advanceOptions);
  const view = text(advanceOptions.taxSummaryView).toUpperCase();
  // Tax rows carry their rate (user request): the Subtotal widget's per-rate breakup,
  // "CGST (9%)" / "SGST (9%)" / "IGST (18%)" — one row per rate when the items' rates differ.
  const model = computeSubtotalRows(
    {
      ...invoice,
      subUnitLength: moneyDigits(invoice),
      advanceOptions: {
        ...advanceOptions,
        taxSummaryView: ["BOTH", "INVOICE_SUMMARY"].includes(view)
          ? view
          : "INVOICE_SUMMARY",
      },
    },
    {
      columns: asRecord(state.mapped).columns,
      businessCurrency: invoice.businessCurrency,
      businessLocale: invoice.businessLocale,
    }
  );
  /*
   * "Applied Exchange Rate | 1 USD = 95.3929 INR", as refrens.com prints it (user request):
   * the rate exactly as stored on the document (conversionRates, which the business can edit),
   * never rounded, between the two currency codes. The business currency is the one the
   * Subtotal widget converts to (owner.currency on the fetched document).
   */
  const owner = asRecord(invoice.owner);
  const businessCurrency = firstText(invoice.businessCurrency, owner.currency);
  const storedRate = asRecord(invoice.conversionRates)[businessCurrency];
  const appliedRate = (row: SubtotalRow): SubtotalRow =>
    row.key === "conversionRate"
      ? {
          ...row,
          label: labelOr(
            asRecord(invoice.customLabels),
            "appliedExchangeRate",
            "Applied Exchange Rate"
          ),
          value: hasValue(storedRate)
            ? `1 ${text(invoice.currency)} = ${text(
                storedRate
              )} ${businessCurrency}`
            : row.value,
        }
      : row;
  // "Discount (10%)": the rate after the label, with its space (the widget writes none).
  const rate = discountRate(invoice);
  const withDiscountRate = (row: SubtotalRow): SubtotalRow =>
    row.key === "discount" && rate
      ? {
          ...row,
          label: `${row.label.replace(/\s*\([^)]*%\)\s*$/, "")} (${rate}%)`,
        }
      : row;
  /*
   * "Show Applied Exchange Rate" (advanceOptions.showExchangeRateOnPdf), as the Apex and
   * Modern Manufacturing templates print it (user request): on a document in another
   * currency than the business's, with the setting on, every amount shows both currencies —
   * the document's figure with the business-currency figure under it — and the Applied
   * Exchange Rate row; with it off, the document's currency only and no rate row.
   */
  const exchange = settings.exchangeRate;
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
      .map(appliedRate)
      .map(withDiscountRate)
      .map(withExchange)
      .map(plainRow),
    extra: model.groups.extra.map(withExchange).map(plainRow),
    // "Show balance due" off drops the Balance Due row; what was paid still prints.
    due: model.groups.due
      .filter((row) => settings.dueAmount || row.key !== "dueAmount")
      .map(withExchange)
      .map(plainRow),
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
  const notes = notesHidden ? "" : collapseBlankLines(text(invoice.notes));

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

export const mapSignature = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const isDigital = text(invoice.signatureMethod).toUpperCase() === "DIGITAL";
  const request = asRecord(invoice.documentSignatureRequest);
  const isSigned = text(request.status).toUpperCase() === "SIGNED";
  const signer = asRecord(asArray(request.signers)[0]);

  const image = isDigital ? "" : text(invoice.signature);
  return {
    // The block prints only for a signature the document has — an image, or a digital
    // signing request (user rule); without one there is no "For … / Authorised Signatory".
    show: image !== "" || isDigital,
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

/*
 * The status tag as refrens.com shows it on each kind of document (checked on 360 real
 * documents): invoices, proformas and debit notes "Paid" / "Part Paid" (nothing while unpaid);
 * challans, purchase orders and quotations "Created", or "<Type> Sent" / "<Type> Seen" once
 * emailed (reminders.views: an opened email is Seen); credit notes "Issued" (none once
 * overdue), "Partially Utilised", "Redeemed"; sales orders none; any document "Draft" or
 * "Canceled" ("Cancelled" on a quotation). Checked on 465 real documents. Colours: the status
 * widget's.
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
    if (credit === "ISSUED" && optionalFlag(invoice.isOverdue) !== true) {
      return { text: "Issued", color: "info" };
    }
  }
  return null;
};

/* ------------------------------------------------------------------ view */

/*
 * Print and PDF print at true size (design-to-template §4a): no page-fit zoom, so 13 px text
 * prints at 13 px. The page is the paper width less the browser's default 1 cm margins
 * (A4: 718 px; the document has no padding of its own); it depends only on the format, never on the
 * window, because the PDF service renders in a window narrower than its page.
 *
 * zoomSize is the print size picked in Lydia (0.8 smaller … 1.2 larger). The renderer zooms
 * <html> by it (except at 0.8), which narrows the page in CSS px. textScale scales text only.
 *
 * compactTable: when the items table's other columns, shrunk to content, would leave
 * Description less than its 22% share of that page, the table prints at the small step
 * with tight padding (styles.css, .is-print-compact), as Solvin's compact print table does.
 * It is an estimate: in print, fitPrintTable measures the table and keeps the screen's padding
 * when it fits.
 */
const PRINT_MARGINS_PX = (2 * 96) / 2.54;
const PAPER_WIDTH_MM: Record<string, number> = {
  a3: 297,
  a4: 210,
  a5: 148,
  letter: 215.9,
  legal: 215.9,
};

const positiveNumber = (value: unknown): number | undefined => {
  const parsed = hasValue(value) ? Number(text(value)) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/* Paper heights, for a landscape page (its width is the paper's height). */
const PAPER_HEIGHT_MM: Record<string, number> = {
  a3: 420,
  a4: 297,
  a5: 210,
  letter: 279.4,
  legal: 355.6,
};

/*
 * The Description cell's floor on a page too narrow for the table (A5, a large print size):
 * a readable column of about 12 characters with its padding.
 */
const PRINT_DESCRIPTION_FLOOR = 120;
/* 13 px × 0.77 = 10 px: the repo preset's floor (design-to-template §4a); below it, wrap. */
const MIN_TABLE_FIT = 0.77;
const COMPACT_PADDING_SAVING = 4; // 6 → 4 px each side

export const mapPrint = (
  state: UnknownRecord,
  tableFixedWidth = 0,
  fixedColumns = 0
) => {
  const pdfOptions = asRecord(state.pdfOptions);
  const invoice = asRecord(state.invoice);
  const format = text(pdfOptions.format).toLowerCase();
  const landscape = optionalFlag(pdfOptions.landscape) === true;
  const paperMm = landscape
    ? PAPER_HEIGHT_MM[format] ?? PAPER_HEIGHT_MM.a4
    : PAPER_WIDTH_MM[format] ?? PAPER_WIDTH_MM.a4;
  const pageZoom = positiveNumber(pdfOptions.zoomSize) ?? 1;
  const rendererZoom = pageZoom === 0.8 ? 1 : pageZoom;
  const pageWidth = ((paperMm / 25.4) * 96 - PRINT_MARGINS_PX) / rendererZoom;
  /*
   * The printable width in the document's own pixels, which caps the page in print
   * (styles.css): the PDF service lays the page out in a window wider than the paper before
   * it prints. Side margins are xMargins centimetres (1 when unset), and Chrome scales them
   * with the print zoom like the rest of the page; 4 px kept back for rounding.
   */
  // 0 cm is a real setting: the page runs to the paper's edges (it was read as unset, 1 cm).
  const margin = hasValue(pdfOptions.xMargins)
    ? Number(text(pdfOptions.xMargins))
    : NaN;
  const sideMarginCm = Number.isFinite(margin) && margin >= 0 ? margin : 1;
  const printWidth = Math.floor(
    ((paperMm / 25.4) * 96) / rendererZoom - (2 * sideMarginCm * 96) / 2.54 - 4
  );
  // A browser's own print (Lydia's print button, Ctrl+P) keeps its own 1 cm margins, whatever
  // xMargins says: the page is fitted for the narrower of the two (prepareBrowserPrint).
  const browserPrintWidth = Math.floor(
    ((paperMm / 25.4) * 96) / rendererZoom - (2 * 96) / 2.54 - 4
  );
  const rawScale =
    positiveNumber(pdfOptions.textScale) ?? positiveNumber(pdfOptions.scale);
  // A percentage (110) or a ratio (1.1); kept readable either way.
  const ratio =
    rawScale !== undefined && rawScale > 2 ? rawScale / 100 : rawScale;
  const textScale = Math.min(2, Math.max(0.3, ratio ?? 1));
  const compactTable =
    tableFixedWidth * textScale > pageWidth * (1 - MIN_DESCRIPTION_SHARE);
  // Last resort, only when even compact padding leaves Description under its floor: the
  // table's text shrinks just enough to fit the page (never below MIN_TABLE_FIT), rather than
  // the page clipping its last columns. A4 at the normal print size never gets here.
  const compactWidth =
    (tableFixedWidth - fixedColumns * COMPACT_PADDING_SAVING) * textScale;
  const tableFit =
    compactTable && compactWidth > 0
      ? Math.min(
          1,
          Math.max(
            MIN_TABLE_FIT,
            (pageWidth - PRINT_DESCRIPTION_FLOOR) / compactWidth
          )
        )
      : 1;
  return {
    textScale: compactDecimal(textScale),
    printWidth,
    browserPrintWidth,
    // The renderer's print zoom: the print table's 10 px text floor is 10 px on paper.
    printZoom: compactDecimal(rendererZoom),
    compactTable,
    tableFit:
      tableFit < 1 ? compactDecimal(Math.floor(tableFit * 100) / 100) : "",
    /*
     * "Stretch invoice & quotation tables to fill the page" (Settings > Experimental,
     * owner.configuration.experimental.stretchInvoiceTable): on a one-page printout the item
     * table runs down to the footer (helpers.ts stretchItemTable). The business toggle alone
     * decides; the document's own pdfOptions.fullHeightTable is ignored, on, off or missing
     * (user, 2026-10-31). Every document type, not only invoices and quotations as
     * refrens.com does (user request). The preview stretches whatever the toggles say.
     */
    stretchTable:
      asRecord(asRecord(asRecord(invoice.owner).configuration).experimental)
        .stretchInvoiceTable === true,
  };
};

/*
 * An Indian GST document's tax columns are CGST, SGST and IGST (or the business's custom label
 * for them). A document can carry another country's tax name on its saved igst column — "PPN",
 * "VAT", left over from an earlier tax-name setting — and the shared widgets would print it
 * (column label before the fallback word). On taxType INDIA the template puts the GST word
 * back on such a column before anything reads it (user report: "PPN" instead of IGST), so the
 * item table, the totals and the HSN / tax summaries agree. A rename of the column the
 * business made itself ("Tax Amount") stays; other tax types keep their own word.
 */
const GST_COLUMN_WORDS: Record<string, string> = {
  igst: "IGST",
  cgst: "CGST",
  sgst: "SGST",
};

/*
 * Other tax systems' names, which only a stale tax-name setting puts on an Indian document's
 * tax column. A business's own rename of the column ("Tax Amount") is kept, and so is the
 * plain word "Tax": refrens.com prints it as saved (26 real Indian documents).
 */
const FOREIGN_TAX_NAMES = [
  "PPN",
  "VAT",
  "SST",
  "SALES TAX",
  "HST",
  "PST",
  "QST",
  "IVA",
  "TVA",
  "MWST",
  "KDV",
  "ITBIS",
  "ICMS",
];

/*
 * Refrens' own defaults the shared normalizer reads differently, applied before it:
 * a document that never chose how units print (advanceOptions.unitColumn unset) shows them
 * in their own Unit column, as refrens.com does (verified on 124 real documents); the
 * normalizer would merge them into Quantity.
 */
export const withRefrensDefaults = <T>(payload: T): T => {
  const root = asRecord(payload);
  const wrapped = isRecord(root.invoice);
  const invoice = wrapped ? asRecord(root.invoice) : root;
  const options = asRecord(invoice.advanceOptions);
  const chosen = [
    "unitColumn",
    "unitDisplay",
    "showUnit",
    "showUnitInName",
    "showUnitInQuantity",
    "showUnitAsColumn",
    "showUnitColumn",
  ].some((key) => options[key] !== undefined && options[key] !== null);
  if (chosen) return payload;
  const fixed = {
    ...invoice,
    advanceOptions: { ...options, unitColumn: "SEPARATE_COLUMN" },
  };
  return (wrapped ? { ...root, invoice: fixed } : fixed) as T;
};

/*
 * A rate column saved as "Tax Rate" prints as refrens.com prints it (465 real documents): the
 * word in capitals on an Indian sales document ("TAX Rate"), the document's own tax name on
 * another tax type ("TAX Rate" / "Tax Rate"), and as typed on a purchase order.
 */
const rateTaxWord = (invoice: UnknownRecord): string => {
  if (text(invoice.billType).toUpperCase() === "PURCHASEORDER") return "";
  if (text(invoice.taxType).toUpperCase() === "INDIA") return "TAX";
  const name = text(invoice.taxName);
  return /^tax$/i.test(name) ? name : "";
};

export const withGstColumnLabels = <T>(payload: T): T => {
  const root = asRecord(payload);
  const wrapped = isRecord(root.invoice);
  const invoice = wrapped ? asRecord(root.invoice) : root;
  const india = text(invoice.taxType).toUpperCase() === "INDIA";
  const taxWord = rateTaxWord(invoice);
  const labels = asRecord(invoice.customLabels);
  const columns = asArray(invoice.columns).map((entry) => {
    const column = asRecord(entry);
    const key = text(column.key);
    const label = text(column.label);
    if (key === "gstRate" && /^tax\b/i.test(label)) {
      return taxWord
        ? {
            ...column,
            label: firstText(labels.gstRate, `${taxWord}${label.slice(3)}`),
          }
        : entry;
    }
    if (!india) return entry;
    const word = GST_COLUMN_WORDS[key];
    if (word && FOREIGN_TAX_NAMES.includes(label.toUpperCase())) {
      return { ...column, label: firstText(labels[key], word) };
    }
    // The rate column: "PPN Rate" / "VAT %" read "GST Rate" / "GST %".
    const lead = FOREIGN_TAX_NAMES.find((name) =>
      label.toUpperCase().startsWith(`${name} `)
    );
    if (key === "gstRate" && lead) {
      return {
        ...column,
        label: firstText(labels.gstRate, `GST${label.slice(lead.length)}`),
      };
    }
    return entry;
  });
  const fixed = { ...invoice, columns };
  return (wrapped ? { ...root, invoice: fixed } : fixed) as T;
};

/*
 * The template's data mapper, before the shared normalizer: a host that wraps the document
 * ({ invoice, template }) may send the template settings (pdfOptions, primaryColor, fonts,
 * script…) beside the invoice instead of on it; the normalizer keeps only invoice.template,
 * so they are merged onto it here (the document's own values win).
 */
export const withTemplateSettings = <T>(payload: T): T => {
  const root = asRecord(payload);
  if (!isRecord(root.invoice) || !isRecord(root.template)) return payload;
  const invoice = asRecord(root.invoice);
  const own = asRecord(invoice.template);
  const host = asRecord(root.template);
  return {
    ...root,
    invoice: {
      ...invoice,
      template: {
        ...host,
        ...own,
        pdfOptions: {
          ...asRecord(host.pdfOptions),
          ...asRecord(own.pdfOptions),
        },
      },
    },
  } as T;
};
/* ------------------------------------------------------------------ parties (design) */

export interface PartyLine {
  key: string;
  label: string;
  value: string;
  isDate?: boolean;
  isNum?: boolean;
  isEmail?: boolean;
  isPhone?: boolean;
  isToken?: boolean;
  isHidden?: boolean;
  attr?: string;
}

/*
 * One column of the design's "Seller and recipient" row: heading ("Sold By :"), name, the
 * street and the city / state / country lines, then "Label: value" lines — the party's tax
 * numbers, contacts and own fields, in the form's order. Nothing is derived (user request: no
 * State/UT Code worked out from the GSTIN).
 */
const partyColumn = (
  invoice: UnknownRecord,
  value: unknown,
  title: string,
  role: string
) => {
  const party = mapParty(
    invoice,
    value,
    title,
    role === "seller" || role === "billing"
  );
  if (!party) return null;
  const lines: PartyLine[] = [
    ...party.lines
      .reduce((all, line) => all.concat(line), [])
      .map((row) => ({
        key: "",
        label: row.label,
        value: row.value,
        isDate: row.isDate,
        isNum: row.noWrap,
        isEmail: row.isEmail,
        isPhone: row.isPhone,
        isToken: row.isToken,
      })),
  ];
  return {
    role,
    title,
    name: party.name,
    street: party.street,
    region: party.region,
    lines,
    supply: null as null | { hidden: boolean; lines: PartyLine[] },
  };
};

/*
 * Place of Supply and Country of Supply, the last lines of the buyer's last column, as the
 * design prints them — and nothing derived beside them (user request). Refrens' "Show
 * Place/Country of Supply" switch (hideCountryOfSupply) shows or hides them; they stay in the
 * page, hidden, carrying the host's live toggle target (data-ceres-country-of-supply; the
 * place also data-ceres-place-of-supply for its own key).
 */
export const mapSupplyLines = (state: UnknownRecord) => {
  const supply = mapSupply(state);
  const lines: PartyLine[] = [
    ...supply.rows.filter((row) => row.key === "placeOfSupply"),
    ...supply.rows.filter((row) => row.key === "countryOfSupply"),
  ].map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value,
    isHidden: row.isHidden,
    attr: row.attr,
  }));
  return lines.length ? { hidden: supply.hidden, lines } : null;
};

/*
 * The template prints its own colon after every label ("Date: …"); a business label that
 * already ends in one ("Date: ") loses it, so it never reads "Date::".
 */
export const bareLabel = (label: string): string =>
  label.replace(/\s*[:：]\s*$/, "");

const bareRows = <T extends { label: string }>(rows: T[]): T[] =>
  rows.map((row) => ({ ...row, label: bareLabel(row.label) }));

/*
 * Document details (the design's "Order and invoice references" row), the last section above
 * the items (user request): the document's own number and dates on the right, every other
 * header detail (PO, the document's own header fields, reverse charge) on the left. Transport
 * Details are a section of their own above it.
 */
const OWN_DETAILS = ["invoiceNumber", "invoiceDate", "dueDate"];

export const mapReferences = (state: UnknownRecord) => {
  const transport = mapTransport(state);
  const meta = mapMeta(state, []);
  const start = meta.filter((row) => !OWN_DETAILS.includes(row.key));
  const end = meta.filter((row) => OWN_DETAILS.includes(row.key));
  return {
    start,
    end,
    // Transport Details: a section of its own, above the document details.
    transport: transport
      ? { title: bareLabel(transport.title), rows: bareRows(transport.rows) }
      : null,
    showDetails: meta.length > 0,
  };
};

/* ------------------------------------------------------------------ totals rows (design) */

/*
 * The Subtotal widget's rows print in full under the TOTAL row (user request: the subtotal
 * fields must show) — Sub Total, discount, taxes, charges, round-off, Total, paid and due —
 * even where a figure repeats a column sum of the TOTAL row.
 */
export const mapTotalRows = (totals: ReturnType<typeof mapTotals>) => ({
  main: totals.main,
  extra: totals.extra,
  due: totals.due,
  show: totals.main.length + totals.extra.length + totals.due.length > 0,
});

/* ------------------------------------------------------------------ payments (design) */

/*
 * The design's "Payment details" strip: Date | Mode | Amount Received | Payment Account |
 * Transaction Charge | TDS, one strip per payment recorded on the document. Transaction
 * Charge and TDS appear when a payment has one (the payment table widget's own rule). Kept
 * in the page, hidden, while "Show payments table" is off (data-ceres-payment-table).
 */
/*
 * The payment widget names the modes it knows; one the API sends in another case ("CHEQUE",
 * not the widget's "Cheque") would print as the raw code. Codes are named as refrens.com
 * names them; anything else prints as given.
 */
const PAYMENT_MODE_NAMES: Record<string, string> = {
  ACCOUNT_TRANSFER: "Account Transfer",
  BANK_TRANSFER: "Account Transfer",
  CASH: "Cash Payment",
  CHEQUE: "Cheque",
  CHECK: "Cheque",
  DD: "Demand Draft",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  UPI: "UPI",
  WALLET: "Digital Wallet",
  PREPAID_CARD: "Prepaid Card",
  NET_BANKING: "Net Banking",
  OTHER: "Other",
};

export const paymentModeName = (value: unknown): string => {
  const raw = text(value);
  return PAYMENT_MODE_NAMES[raw.toUpperCase().replace(/[\s-]+/g, "_")] || raw;
};

export const mapPayments = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const advanceOptions = asRecord(state.advanceOptions);
  const ctx = formatContext(invoice);
  const model = computePaymentColumns(
    asArray(invoice.allPayments).map(asRecord),
    {
      businessCurrency:
        firstText(invoice.businessCurrency, asRecord(invoice.owner).currency) ||
        undefined,
      currency: text(invoice.currency) || undefined,
    }
  );
  const rows = model.payments.map((payment) => [
    { label: "Date", value: payment.paymentDate, isDate: true },
    {
      label: "Mode",
      value: paymentModeName(payment.paymentMethodLabel),
      isDate: false,
    },
    {
      label: "Amount Received",
      value: formatMoney(payment.amount, ctx),
      isDate: false,
      // On a document in another currency, the amount in the business's currency under it,
      // in brackets, as refrens.com prints it: "530.580 / (₹50,378.84)".
      converted:
        model.showBizAmount && payment.amountInBizCurrencyFormatted
          ? `(${payment.amountInBizCurrencyFormatted})`
          : "",
    },
    {
      label: "Payment Account",
      value: payment.paymentAccountName,
      isDate: false,
      isText: true,
    },
    ...(model.showTransactionCharge
      ? [
          {
            label: "Transaction Charge",
            value: formatMoney(payment.transactionCharge, ctx),
            isDate: false,
          },
        ]
      : []),
    ...(model.showTds
      ? [
          {
            label: "TDS",
            value: formatMoney(payment.tds, ctx),
            isDate: false,
          },
        ]
      : []),
  ]);
  /*
   * One table, as the payment widget and refrens.com print it (user request): the headings
   * once, a row per payment and, with more than one payment, a Total row summing the amount
   * received, the transaction charges and the TDS.
   */
  const columns = rows.length ? rows[0].map((field) => field.label) : [];
  const totalOf: Record<string, string> = {
    "Amount Received": formatMoney(model.totalAmount, ctx),
    "Transaction Charge": formatMoney(model.totalTransactionCharge, ctx),
    TDS: formatMoney(model.totalTds, ctx),
  };
  const total =
    rows.length > 1
      ? columns.map((label, index) => ({
          value: index === 0 ? "Total" : totalOf[label] || "",
        }))
      : null;
  return {
    // "Payments" over the table, as refrens.com titles it (user request).
    title: heading(asRecord(invoice.customLabels), "payments", "Payments"),
    columns,
    total,
    show: rows.length > 0,
    // Printed only when the document turns "Show Payments Table" on, as refrens.com does
    // (verified on 41 real invoices with payments); the host's live toggle can still show it.
    hidden: !(
      advanceOptions.showPaymentsTable === true ||
      invoice.showPaymentsTable === true
    ),
    rows,
  };
};

/* ------------------------------------------------------------------ view */

/*
 * Contact details, the last line of the document (user request): the document's own Contact
 * Details (invoice.contact), worded as Refrens closes a document — "For any enquiry, reach
 * out via email at …, call on …". Only with an email or a phone; every phrase is the
 * business's label when set.
 */
export const mapDocumentContact = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const contact = asRecord(invoice.contact);
  const email = text(contact.email);
  const phone = text(contact.phone);
  return email || phone
    ? {
        lead: labelOr(labels, "contact", "For any enquiry, reach out via"),
        emailLabel: labelOr(labels, "contactEmail", "email at"),
        phoneLabel: labelOr(labels, "contactPhone", "call on"),
        email,
        phone,
      }
    : null;
};

/* "Duplicate" → "(Duplicate)": the copy label in brackets, as the design sets it. */
export const copyLabel = (value: unknown): string => {
  const copy = text(value);
  if (!copy) return "";
  return /^\(.*\)$/.test(copy) ? copy : `(${copy})`;
};

/*
 * "Hide Footer" (pdfOptions.hideFooter) drops the PDF service's own footer, its "electronically
 * generated" line, and with it the every-page letterhead footer the service would stamp. It
 * never hides the letterhead footer itself (user rule 2026-10-26).
 */
export const hidesServiceFooter = (state: UnknownRecord): boolean => {
  const invoice = asRecord(state.invoice);
  const template = asRecord(invoice.template);
  return [
    asRecord(state.pdfOptions).hideFooter,
    asRecord(invoice.pdfOptions).hideFooter,
    asRecord(template.pdfOptions).hideFooter,
    template.hideFooter,
    invoice.hideFooter,
  ].some((value) => optionalFlag(value) === true);
};

export const buildEcommerceView = (root: unknown) => {
  const state = asRecord(root);
  const invoice = asRecord(state.invoice);
  const mapped = asRecord(state.mapped);
  const visibility = asRecord(mapped.visibility);
  const labels = asRecord(invoice.customLabels);
  const settings = mapSettings(state);
  const options = resolveSettings(state);

  // Sold By | Billing Address, and below them Shipped From | Shipping Address. A party's heading
  // never disappears: a custom label saved empty falls back to the default word (user report).
  const seller = partyColumn(
    invoice,
    invoice.billedBy,
    labelOr(labels, "billedBy", "Sold By"),
    "seller"
  );
  const shippedFrom = visibility.shippedFrom
    ? partyColumn(
        invoice,
        invoice.shippedFrom,
        labelOr(labels, "shippedFrom", "Shipped From"),
        "shipped-from"
      )
    : null;
  const billing = partyColumn(
    invoice,
    invoice.billedTo,
    labelOr(labels, "billedTo", "Billing Address"),
    "billing"
  );
  const shipping = visibility.shippedTo
    ? partyColumn(
        invoice,
        invoice.shippedTo,
        labelOr(labels, "shippedTo", "Shipping Address"),
        "shipping"
      )
    : null;
  // Place / Country of Supply print under Shipped To only (user request): a document without
  // a shipping address shows neither.
  if (shipping) shipping.supply = mapSupplyLines(state);
  const tidy = (row: Array<ReturnType<typeof partyColumn>>) =>
    row
      .filter((party): party is NonNullable<typeof party> => party !== null)
      .map((party) => ({
        ...party,
        title: bareLabel(party.title),
        lines: bareRows(party.lines),
        supply: party.supply
          ? { ...party.supply, lines: bareRows(party.supply.lines) }
          : null,
      }));
  // Quotation From | To, then the shipping details on a row of their own below it (user
  // request): Shipped From under the seller, Shipped To under the buyer.
  const partyRows = [
    { section: "parties", parties: tidy([seller, billing]) },
    { section: "shipping", parties: tidy([shippedFrom, shipping]) },
  ].filter((row) => row.parties.length > 0);

  const notes = mapNotes(state);
  const terms = options.terms
    ? notes.terms.map((group) => ({
        ...group,
        items: group.items.map((item, index) => ({
          number: `(${index + 1})`,
          text: item,
        })),
      }))
    : [];
  const table = mapItemTable(state, formatContext(invoice), options);
  const totals = mapTotals(state, options);
  const rawCompliance = mapCompliance(state);
  const compliance = {
    ...rawCompliance,
    irnLabel: bareLabel(rawCompliance.irnLabel),
    irnRows: bareRows(rawCompliance.irnRows),
    eway: bareRows(rawCompliance.eway),
  };
  const hasCompliance = Boolean(
    (compliance.showIrn && compliance.irn) ||
      compliance.rows.length ||
      compliance.qr.irn ||
      compliance.qr.zatca ||
      compliance.qr.lhdn ||
      compliance.qr.document
  );
  const status = statusTag(invoice);
  const print = mapPrint(
    state,
    table.printFixedWidth,
    table.columns.filter((column) => column.kind !== "name").length
  );
  const bank = mapBank(state);
  const additional = mapAdditionalInfo(state, formatContext(invoice));
  const words = mapWords(state, options);

  return {
    logo: firstText(invoice.logo, asRecord(invoice.billedBy).logo),
    sellerName: seller ? seller.name : "",
    title: firstText(invoice.invoiceTitle),
    subtitle: text(invoice.invoiceSubTitle),
    copy: copyLabel(invoice.copy),
    // The status tag (Paid, Unpaid…) belongs to invoices; on paper only once paid.
    status: status
      ? { ...status, inPrint: Boolean(visibility.showStatusTagInPrint) }
      : null,
    theme: settings.theme,
    partyRows,
    references: (({ start, end, transport, showDetails }) => ({
      start: bareRows(start),
      end: bareRows(end),
      transport,
      // The document QR sits under the document details, so it keeps the section on its own.
      showDetails: showDetails || Boolean(rawCompliance.qr.document),
    }))(mapReferences(state)),
    compliance,
    hasCompliance,
    table,
    descriptionFullWidth: options.descriptionFullWidth,
    totals: { ...totals, ...mapTotalRows(totals) },
    words: words ? { ...words, label: bareLabel(words.label) } : null,
    // The HSN summary prints without a heading of its own (user request), like the tax summary.
    // "HSN Summary" / "Tax Summary" over their tables, like Batch Summary and Payments (user
    // request); a business's own label wins.
    hsn: {
      hidden: !visibility.showHsnSummary,
      title: heading(labels, "hsnSummary", "HSN Summary"),
    },
    taxSummary: {
      hidden: !visibility.showTaxTable,
      title: heading(labels, "taxSummary", "Tax Summary"),
    },
    batch: mapBatchSummary(state, formatContext(invoice), options),
    signature: mapSignature(state),
    terms,
    notes: notes.notes,
    bank: {
      ...bank,
      rows: bareRows(bank.rows),
      upi: bank.upi ? { ...bank.upi, label: bareLabel(bank.upi.label) } : null,
      upiSmall: Boolean(visibility.upiShrink),
    },
    additional: additional
      ? { ...additional, rows: bareRows(additional.rows) }
      : null,
    attachments: notes.attachments,
    payments: mapPayments(state),
    contact: mapDocumentContact(state),
    // The letterhead footer repeats at the foot of every printed page unless the document
    // asks for it on the last page only (pdfOptions.footerOnLastPage); the letterhead at the
    // top of every page unless first page only. Long PDF (pageless) does not change this: a
    // browser print still cuts pages, and on the PDF service's one tall page the repeating
    // copies simply print once (user report: Long PDF left the footer off every page but
    // the last).
    footerEveryPage: !visibility.footerOnLastPage,
    // The PDF service draws the every-page footer itself, unless "Hide Footer" turns its footer
    // off; the letterhead footer stays, so the template then draws it in the PDF (as Viraj).
    serviceFooter: !visibility.footerOnLastPage && !hidesServiceFooter(state),
    letterheadEveryPage: !visibility.letterHeadOnFirstPage,
    pageless: options.pageless,
    // A Long PDF is one page as tall as its content: there is no page to stretch the table to.
    print: options.pageless ? { ...print, stretchTable: false } : print,
    script: mapScript(state),
  };
};

interface HelperRegistry {
  registerHelper: (
    name: string,
    helper: (...args: unknown[]) => unknown
  ) => void;
}

export const registerEcommerceHelpers = (
  HB: HelperRegistry | undefined
): void => {
  if (!HB) return;
  HB.registerHelper("ecView", (root: unknown) => buildEcommerceView(root));
  // `{{ecDate value offset}}` — Handlebars appends its options object, so only a string or
  // number second argument is an offset.
  HB.registerHelper("ecShortDate", (value: unknown, offset: unknown) =>
    formatShortDate(
      value,
      typeof offset === "string" || typeof offset === "number"
        ? offset
        : undefined
    )
  );
  HB.registerHelper("ecDate", (value: unknown, offset: unknown) =>
    formatDocumentDate(
      value,
      typeof offset === "string" || typeof offset === "number"
        ? offset
        : undefined
    )
  );
};

/* ------------------------------------------------------------------ business logo */

/*
 * The logo box follows the logo's shape, as the Apex Engineering template sizes it (user
 * request): a logo no wider than 1.25 × its height (square, or upright) prints in a 100 px
 * square; a wider one in a 200 × 80 box (80 px is the design's logo height). Its shape is only
 * known once it loads, so the logo is marked then (is-square, styles.css); load events do not
 * bubble, so the listener sits on the document's capture phase, ahead of every render. The
 * signature image is marked the same way (user request): a square one in its 120 px box, a
 * wide one in the logo's 200 × 80.
 */
const SQUARE_LOGO_RATIO = 1.25;

export const isSquareLogo = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width / height <= SQUARE_LOGO_RATIO;

export const markLogoShape = (image: HTMLImageElement): void => {
  image.classList.toggle(
    "is-square",
    isSquareLogo(image.naturalWidth, image.naturalHeight)
  );
};

export const registerEcommerceLogo = (): void => {
  const state = window as typeof window & { ecLogoRegistered?: boolean };
  if (state.ecLogoRegistered || typeof document === "undefined") return;
  state.ecLogoRegistered = true;
  document.addEventListener(
    "load",
    (event) => {
      const { target } = event;
      if (
        target instanceof HTMLImageElement &&
        (target.classList.contains("ec-logo-image") ||
          target.classList.contains("ec-signature-image"))
      ) {
        markLogoShape(target);
      }
    },
    true
  );
  // An image that fails to load (an expired or private link) prints nothing: the browser's
  // broken-image mark and its alt text ("Authorised Signatory" a second time beside the
  // signature's own label, user report) are not shown.
  document.addEventListener(
    "error",
    (event) => {
      const { target } = event;
      if (target instanceof HTMLImageElement && target.closest(".ec-doc")) {
        target.classList.add("is-broken");
      }
    },
    true
  );
};

/* ------------------------------------------------------------------ totals fit */

/*
 * A totals figure has no width of its own (styles.css .ec-fig), so it never widens its column
 * (user request). Once laid out, a figure wider than its cell takes over the empty cells to its
 * left (.ec-fill), whole columns at a time, until it fits — its start edge then sits on a
 * column rule, in line with the cells above. Laid out again (a new render, a resize, print
 * layout on or off, fonts arriving), every row starts over from one cell. A row hidden at the
 * time (hideTotals / hideTaxes) is left alone.
 */

/*
 * A table with more columns than the page holds is cut at the page's edge, as refrens.com cuts
 * it (a 30-column proforma), but the totals' figures stay in sight: their cell moves to the
 * last column wholly on the page, the empty cells it passes going after it (ec-fill-after).
 * Every layout starts over with the cell back in the table's last column.
 */
const keepTotalsInView = (root: ParentNode): void => {
  root
    .querySelectorAll<HTMLTableCellElement>("td[data-ec-fit]")
    .forEach((cell) => {
      const row = cell.parentElement;
      row?.querySelectorAll(".ec-fill-after").forEach((filler) => {
        filler.classList.remove("ec-fill-after");
        row.insertBefore(filler, cell);
      });
    });
  root.querySelectorAll<HTMLElement>(".ec-items").forEach((table) => {
    const box = table.parentElement;
    const head = table.querySelector("thead tr:last-child");
    if (!box || !head) return;
    const rtl = getComputedStyle(table).direction === "rtl";
    const edge = box.getBoundingClientRect();
    const inView = (cell: Element) => {
      const rect = cell.getBoundingClientRect();
      return rtl ? rect.left >= edge.left - 1 : rect.right <= edge.right + 1;
    };
    const columns = Array.from(head.children);
    if (!columns.length || columns.every(inView)) return;
    const visible = columns.findIndex((cell) => !inView(cell));
    table
      .querySelectorAll<HTMLTableCellElement>("td[data-ec-fit]")
      .forEach((cell) => {
        const row = cell.parentElement;
        if (!row) return;
        const fillers = Array.from(row.querySelectorAll(":scope > .ec-fill"));
        const label = row.firstElementChild as HTMLTableCellElement | null;
        // Columns from the value's place to the end of the row go after it.
        const before = Math.max(0, visible - (label?.colSpan || 1) - 1);
        fillers.slice(before).forEach((filler) => {
          filler.classList.add("ec-fill-after");
          row.appendChild(filler);
        });
      });
  });
};

export const fitTotals = (root: ParentNode = document): void => {
  keepTotalsInView(root);
  const cells = Array.from(
    root.querySelectorAll<HTMLTableCellElement>("td[data-ec-fit]")
  );
  const fillersOf = (cell: HTMLTableCellElement): HTMLElement[] => {
    const fillers: HTMLElement[] = [];
    let prev = cell.previousElementSibling as HTMLElement | null;
    while (
      prev &&
      prev.classList.contains("ec-fill") &&
      !prev.classList.contains("ec-fill-after")
    ) {
      fillers.push(prev);
      prev = prev.previousElementSibling as HTMLElement | null;
    }
    return fillers;
  };
  // Start over from one cell per row.
  cells.forEach((cell) => {
    fillersOf(cell).forEach((filler) => filler.style.removeProperty("display"));
    cell.colSpan = 1;
  });
  // The widest figure among the rows on show decides how many columns the figures take.
  let span = 1;
  cells.forEach((cell) => {
    const figure = cell.querySelector(".ec-fig");
    if (!figure || !cell.getClientRects().length) return;
    const need = Math.max(
      0,
      ...Array.from(figure.children).map(
        (child) => child.getBoundingClientRect().width
      )
    );
    // The figure carries its own start padding; the cell keeps its padding at the end, and
    // the figure's white ground must stop short of the cell's start rule (it paints above
    // the table's borders), or that row's rule goes missing (user report).
    const style = getComputedStyle(cell);
    const endPadding = parseFloat(style.paddingInlineEnd) || 0;
    // At least a whole pixel: a 0.5 px rule still paints a full device pixel.
    const startRule = Math.max(
      1,
      Math.ceil(parseFloat(style.borderInlineStartWidth) || 0)
    );
    let room = cell.getBoundingClientRect().width - endPadding - startRule;
    const fillers = fillersOf(cell);
    let taken = 1;
    while (need > room && taken - 1 < fillers.length) {
      room += fillers[taken - 1].getBoundingClientRect().width;
      taken += 1;
    }
    span = Math.max(span, taken);
  });
  if (span === 1) return;
  cells.forEach((cell) => {
    const fillers = fillersOf(cell);
    const take = Math.min(span - 1, fillers.length);
    fillers.slice(0, take).forEach((filler) => {
      filler.style.display = "none";
    });
    cell.colSpan = 1 + take;
  });
};

/*
 * Print: the item table must fit the page whatever the paper, margins or print size. The
 * columns size to their content, so the table is measured once laid out for print rather than
 * estimated: a table wider than its page takes the tight print padding (is-print-fit), then
 * its text shrinks just enough to fit (--ec-print-fit), never under the 10 px floor (CSS).
 * Back on screen, it reads as before. The text stops at its floor first; the factor goes on
 * down to 0.5 for the empty columns' floors (A5 at print size 1.2 still cut its last column).
 */
const MIN_PRINT_FIT = 0.5;
// Sub-pixel rounding is not an overflow.
const PRINT_SLACK = 0.5;
// The share of the page's width a fitted table may take (see fitPrintTable).
const PRINT_ROOM = 0.99;

/*
 * Stretch the item table to the page (view.print.stretchTable): in print, while the whole
 * document fits on one page, its empty filler row takes the page's spare height so the footer
 * sits at the page's foot, the column rules running down through it. A document longer than
 * a page prints exactly as with the stretch off (Refrens stretches single-page PDFs only).
 *
 * The page's height is left to CSS (100vh): Refrens' PDF service lays the page out in a
 * window shorter than the paper and only then prints, so a height measured here was the
 * window's and the table never stretched in the PDF (user report). 100vh is the page area
 * when the PDF is made; the content's own height is measured here (the width is the
 * paper's already, styles.css). Under the print zoom Chrome scales the page margins as well,
 * so 100vh / zoom is a few px off: kept back with the slack. A document longer than a page
 * comes out at 0, and at 0 the filler's rules are 0 wide too (styles.css), so it draws
 * nothing.
 */
const STRETCH_SLACK = 16;
// The error under a zoom above 1 grows with it: 2 × the margin × (1 − 1 / zoom), for margins
// up to 80 px (about 2 cm).
const STRETCH_ZOOM_SLACK = 160;

/*
 * The preview always stretches (user, 2026-10-31), whatever the business and document
 * toggles say: a document shorter than an A4 sheet fills one, the sheet as tall as its drawn
 * width × 297 / 210. Not on a narrow screen, where the layout stacks (styles.css, under
 * 600 px), nor in the phone and tablet table layouts.
 */
const A4_RATIO = 297 / 210;
const SCREEN_STRETCH_MIN_WIDTH = 600;

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

/*
 * The preview's stretch: measured with the filler out of the layout, so the height Lydia
 * syncs (ceres:content-height) never feeds back into it — the sheet's height follows from its
 * width alone. Set and cleared in one go, so no height in between is ever reported.
 */
const stretchOnScreen = (doc: HTMLElement, filler: HTMLElement): void => {
  const box = doc.getBoundingClientRect();
  const narrow =
    box.width < SCREEN_STRETCH_MIN_WIDTH ||
    doc.querySelector(".ec-items:is(.is-cards, .is-grid)") !== null;
  if (doc.classList.contains("is-pageless") || narrow) return;
  const spare = Math.floor(box.width * A4_RATIO - box.height);
  if (spare <= 0) return;
  filler.style.setProperty("--ec-screen-filler-height", `${spare}px`);
  doc.classList.add("is-screen-stretch");
};

export const stretchItemTable = (root: ParentNode = document): void => {
  const doc = root.querySelector<HTMLElement>(".ec-doc");
  const filler = doc?.querySelector<HTMLElement>(".ec-items .ec-filler");
  const frame = doc?.querySelector<HTMLElement>(".ec-page-frame");
  if (!doc || !filler || !frame) return;
  filler.style.removeProperty("--ec-filler-height");
  filler.style.removeProperty("--ec-screen-filler-height");
  doc.classList.remove("is-screen-stretch");
  const printing =
    typeof window.matchMedia === "function" &&
    window.matchMedia("print").matches;
  // On screen the preview's stretch; in print the business toggle's (is-stretch) alone.
  if (!printing) {
    stretchOnScreen(doc, filler);
    return;
  }
  if (!doc.classList.contains("is-stretch") || !frame.parentElement) return;
  const zoom =
    parseFloat(getComputedStyle(document.documentElement).zoom || "1") || 1;
  // The whole document: the frame, and the letterhead footer after it when it prints on the
  // last page only (on every page it sits in the frame's repeating footer space).
  const content =
    doc.getBoundingClientRect().height /
    layoutScale(frame.parentElement, frame);
  const slack =
    STRETCH_SLACK + (zoom > 1 ? STRETCH_ZOOM_SLACK * (1 - 1 / zoom) : 0);
  filler.style.setProperty(
    "--ec-filler-height",
    `max(0px, calc(100vh / ${compactDecimal(zoom)} - ${Math.ceil(
      content + slack
    )}px))`
  );
};

/*
 * The tax and HSN summaries' "Total Tax In Words" in the document's currency, as refrens.com
 * writes it ("FIVE THOUSAND FOUR HUNDRED DOLLARS AND EIGHTEEN CENTS ONLY"). The shared
 * widgets spell every amount in rupees, and their words helper is fixed at build time, so on
 * a foreign-currency document each line is rewritten after the render from its table's own
 * Total row (the last cell, the total tax).
 */
/* Each Saudi riyal sign in the document wrapped in .ec-riyal, drawn from an image (styles.css). */
export const drawRiyalSigns = (root: ParentNode = document): void => {
  const doc = root.querySelector<HTMLElement>(".ec-doc");
  if (!doc || !(doc.textContent || "").includes("\u20C1")) return;
  const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    if (
      textNode.data.includes("\u20C1") &&
      !textNode.parentElement?.classList.contains("ec-riyal")
    ) {
      nodes.push(textNode);
    }
  }
  nodes.forEach((textNode) => {
    const parts = textNode.data.split("\u20C1");
    const fragment = document.createDocumentFragment();
    parts.forEach((part, index) => {
      if (index > 0) {
        const sign = document.createElement("span");
        sign.className = "ec-riyal";
        sign.setAttribute("role", "img");
        sign.setAttribute("aria-label", "SAR");
        sign.textContent = "\u20C1";
        fragment.appendChild(sign);
      }
      if (part) fragment.appendChild(document.createTextNode(part));
    });
    textNode.replaceWith(fragment);
  });
};

export const respellTaxWords = (root: ParentNode = document): void => {
  const doc = root.querySelector<HTMLElement>(".ec-doc");
  const currency = (doc?.dataset.ecCurrency || "").toUpperCase();
  if (!doc || !currency || currency === "INR") return;
  doc
    .querySelectorAll<HTMLElement>(
      '[data-section="hsn"] .ceres-table-words, [data-section="tax-summary"] .ceres-table-words'
    )
    .forEach((cell) => {
      const table = cell.closest("table");
      const total = [...(table?.querySelectorAll("tr") || [])].find(
        (row) => row.firstElementChild?.textContent?.trim() === "Total"
      );
      const last = total?.lastElementChild?.textContent || "";
      const amount = Number(last.replace(/[^0-9.-]/g, ""));
      if (!last || !Number.isFinite(amount)) return;
      const label = (cell.textContent || "").split(":")[0];
      const words = `${label}: ${amountInCurrencyWords(amount, currency)}`;
      if (cell.textContent !== words) cell.textContent = words;
    });
};

/*
 * The totals carry on without the item headings (user, 2026-10-19): in print, the rows after
 * the items move into a table of their own right under the item table, so a page that holds
 * only them repeats no heading row. Its columns take the item columns' widths, so the TOTAL
 * row's figures stay under their columns. The item table keeps those same widths too: laid
 * out again without the totals, its columns shifted and the stretched page's column rules no
 * longer met the totals' (user report). joinTotals puts everything back as it was.
 */
const TOTALS_SPLIT = "data-ec-totals-split";
const TOTALS_PIN = "data-ec-totals-pin";
const TOTALS_GROUPS = ":scope > tbody.ec-items-total, :scope > tbody.ec-totals";

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
      if (table?.hasAttribute(TOTALS_PIN)) {
        table.querySelector(`:scope > colgroup[${TOTALS_PIN}]`)?.remove();
        const style = table.getAttribute(TOTALS_PIN) || "";
        if (style) table.setAttribute("style", style);
        else table.removeAttribute("style");
        table.removeAttribute(TOTALS_PIN);
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
  root.querySelectorAll<HTMLTableElement>(".ec-items").forEach((table) => {
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
    // The item table held to the same columns (its own style kept to restore).
    table.setAttribute(TOTALS_PIN, style || "");
    const pin = cols.cloneNode(true) as HTMLElement;
    pin.setAttribute(TOTALS_PIN, "");
    table.insertBefore(pin, table.firstChild);
    table.style.tableLayout = "fixed";
    table.style.width = split.style.width;
    groups[0].before(document.createComment(TOTALS_SPLIT));
    groups.forEach((group) => split.appendChild(group));
    const close = table.querySelector<HTMLElement>(
      ":scope > tfoot.ec-page-close"
    );
    if (close) split.appendChild(close.cloneNode(true));
    table.after(split);
  });
};

/*
 * A table wider than its room in print: the tight padding (is-print-fit), then its text
 * scaled by --ec-print-fit down to the 10 px floor (CSS), then the whole table zoomed.
 */
const shrinkToRoom = (
  table: HTMLElement,
  room: () => number,
  need: () => number
): void => {
  const overflow = () => need() - room();
  table.classList.add("is-print-fit");
  let fit = 1;
  // Shrinks by the measured ratio, and by at least a step each time, so the last pixel or
  // two of overflow (the floors, padding and rules do not scale exactly) still goes.
  for (let step = 0; step < 20 && overflow() > PRINT_SLACK; step += 1) {
    const ratio = room() / need();
    fit = Math.max(
      MIN_PRINT_FIT,
      Math.min(fit - 0.01, Math.floor(fit * ratio * 100) / 100)
    );
    table.style.setProperty("--ec-print-fit", String(fit));
    if (fit === MIN_PRINT_FIT) break;
  }
  // Text and columns at their floors and the table still too wide (ten columns on A5 at
  // print size 1.2, fourteen on A5): the whole table is scaled down to the page's width,
  // however far, rather than its last columns cut off (user rule, 2026-10-20: nothing cut
  // off or overlapping; it replaces cutting a thirty-column table as refrens.com does).
  const ratio = room() / need();
  if (ratio < 1) {
    table.style.setProperty(
      "--ec-table-zoom",
      String(Math.floor(ratio * 1000) / 1000)
    );
  }
};

export const fitPrintTable = (
  root: ParentNode = document,
  force = false
): void => {
  const printing =
    force ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("print").matches);
  root.querySelectorAll<HTMLElement>(".ec-items").forEach((table) => {
    table.classList.remove("is-print-fit");
    table.style.removeProperty("--ec-print-fit");
    table.style.removeProperty("--ec-table-zoom");
    // mapPrint's estimate (data-ec-print-compact) holds wherever the table is not measured.
    const estimated = table.hasAttribute("data-ec-print-compact");
    table.classList.toggle("is-print-compact", estimated);
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
      const narrowest = table.getBoundingClientRect().width;
      table.style.width = width;
      return narrowest;
    };
    const overflow = () => need() - room();
    // A table that fits at the screen's 6 px padding prints with it (print 1:1, user
    // 2026-10-21); the estimate tightened tables that fit (a ten-column invoice, 4 px in print).
    table.classList.remove("is-print-compact");
    if (overflow() <= PRINT_SLACK) return;
    table.classList.add("is-print-compact");
    if (overflow() <= PRINT_SLACK) return;
    shrinkToRoom(table, room, need);
  });
  /*
   * The summaries (HSN, tax, batch, payments) are clipped to the frame in print, and a narrow
   * page (A5) cut their last column off: the payments' TDS. One that fits prints as on screen;
   * one that does not shrinks as the item table does.
   */
  root
    .querySelectorAll<HTMLElement>(".ec-summary .ceres-table")
    .forEach((table) => {
      table.classList.remove("is-print-fit");
      table.style.removeProperty("--ec-print-fit");
      table.style.removeProperty("--ec-table-zoom");
      const box = table.parentElement;
      if (!printing || !box) return;
      const room = () => box.getBoundingClientRect().width * PRINT_ROOM;
      const need = () => {
        const { width } = table.style;
        table.style.width = "0px";
        const narrowest = table.getBoundingClientRect().width;
        table.style.width = width;
        return narrowest;
      };
      if (need() - room() <= PRINT_SLACK) return;
      shrinkToRoom(table, room, need);
    });
};

/* ------------------------------------------------------------------ print: a browser's own print */

/*
 * A browser's own print (Lydia's print button, Ctrl+P) counts the pages from the print layout
 * as it stands when printing starts; the print media listener runs after that, so a table it
 * fitted left blank pages at the end (two on A4, four on A5 in Modern Manufacturing, user report 2026-10-20). Just
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
 * The template's stylesheet comes from another origin than the renderer (GitHub Pages under
 * lstatic.refrens.com), so its rules cannot be read and withPrintRules could not switch its
 * print rules on: a browser's own print counted the pages of an unfitted table. The bundle
 * carries the same CSS as text (index.ts), without its font imports: put in the page once as
 * a <style> right after the stylesheet, switched off, and switched on only for a measurement.
 * Nothing is requested — Refrens' PDF service answered a fetched copy with a "404 Web Site"
 * page instead of the PDF, and switching the stylesheet's link off reloads it (as Viraj).
 */
const TEMPLATE_STYLESHEET =
  /\/Ecommerce-Template\/[^/]+\/bundle\.css(?:[?#]|$)/;

let stylesheetText = "";
let measureStyle: HTMLStyleElement | null = null;

export const setEcommerceStylesheetText = (css: string): void => {
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
    measureStyle.setAttribute("data-ec-measure", "");
    measureStyle.textContent = stylesheetText;
    link.after(measureStyle);
  }
  const { sheet } = measureStyle;
  if (!sheet) return measure();
  sheet.disabled = false;
  try {
    return measure();
  } finally {
    sheet.disabled = true;
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
  const doc = root.querySelector<HTMLElement>(".ec-doc");
  if (!doc) return;
  // Refrens' PDF service switches to print media first, and its page.pdf fires beforeprint
  // too (Chrome 122 and later): the print listener has already laid the page out at the
  // document's own margins. Refitted here for a browser's 1 cm, a document set to 0.5 cm
  // printed its table narrower than the frame (invoice 0015).
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("print").matches
  ) {
    return;
  }
  const style = getComputedStyle(doc);
  // The document's printable width, or the browser's own (1 cm margins) where narrower.
  const width = Math.min(
    parseFloat(style.getPropertyValue("--ec-print-width")) ||
      doc.getBoundingClientRect().width,
    parseFloat(style.getPropertyValue("--ec-browser-print-width")) || Infinity
  );
  // The phone and tablet layouts are screen only.
  const fitted = Array.from(
    root.querySelectorAll<HTMLElement>(".ec-items:is(.is-cards, .is-grid)")
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

/*
 * The summaries (HSN, tax, batch) divide their width equally between their columns (user
 * request). The widgets' words row spans 99 columns, so a fixed table layout would make 99
 * columns of it; instead every cell of the first data row takes an equal share, and the
 * table's own layout keeps the rest in line.
 */
export const equalizeSummaries = (root: ParentNode = document): void => {
  root
    // The batch summary's columns hug their content instead (user request): a long item
    // name takes the room the short columns leave.
    .querySelectorAll<HTMLTableElement>(
      ".ec-summary .ceres-table:not(.ec-batch-table)"
    )
    .forEach((table) => {
      // The table's own first data row: the document itself sits in a page-frame table, so a
      // plain "tbody tr" would match the header rows too.
      const row = table.querySelector(":scope > tbody > tr");
      if (!row) return;
      const cells = Array.from(row.children) as HTMLElement[];
      const share = `${compactDecimal(100 / cells.length)}%`;
      cells.forEach((cell) => {
        cell.style.width = share;
      });
    });
};

/* Registers the browser-side fits: the summaries' equal columns, the print table and the totals. */
export const registerEcommerceTotalsFit = (): void => {
  const state = window as typeof window & { ecTotalsFitRegistered?: boolean };
  if (state.ecTotalsFitRegistered || typeof document === "undefined") return;
  state.ecTotalsFitRegistered = true;
  let timer = 0;
  let run = (): void => {};
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(), 0);
  };
  // A second look a moment after each change, once late images and fonts have settled.
  let settle = 0;
  const scheduleSettled = () => {
    window.clearTimeout(settle);
    settle = window.setTimeout(() => run(), 600);
  };
  const output = document.getElementById("documentOutput");
  /*
   * Any change in the document re-runs the fits: a new render, and the host's live toggles
   * that only flip classes or styles (hideTotals, hideTaxes, Show Place/Country of Supply…)
   * — a totals row shown that way was hidden at the last fit. The fits' own changes are not
   * watched: the observer is off while they run and their records are dropped.
   */
  const observer =
    output && typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
          schedule();
          scheduleSettled();
        })
      : null;
  const watch = () => {
    if (!observer || !output) return;
    observer.observe(output, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "src"],
    });
  };
  // The table first (its columns set the totals' room), then the totals.
  run = () => {
    observer?.disconnect();
    joinTotals();
    respellTaxWords();
    drawRiyalSigns();
    equalizeSummaries();
    fitPrintTable();
    fitTotals();
    splitTotals();
    stretchItemTable();
    observer?.takeRecords();
    watch();
  };
  watch();
  window.addEventListener("resize", schedule);
  // An image or font arriving after the render changes the columns.
  document.addEventListener("load", schedule, true);
  if (typeof window.matchMedia === "function") {
    window.matchMedia("print").addEventListener("change", run);
    // The fits as print runs them (run), so the page count is taken from the printed layout.
    window.addEventListener("beforeprint", () => prepareBrowserPrint(run));
    // The preview's stretch back after a print (or a cancelled print dialog).
    window.addEventListener("afterprint", schedule);
  }
  /*
   * Fonts: a face (Inter Bold for the grand total) can start loading after fonts.ready has
   * already resolved, and a figure measured in the fallback face is narrower than it ends up
   * — the bold total then spilled over the column rule (user report). Every finished font
   * load re-runs the fits.
   */
  if (document.fonts) {
    document.fonts.ready.then(schedule).catch(() => {});
    document.fonts.addEventListener("loadingdone", schedule);
  }
  schedule();
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
// Shorter than any printed page (A5 landscape at the smallest print size is about 400 px).
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
  ".ec-doc > .ec-letterhead-footer:not(.ec-footer-fixed):not(.is-empty)";

const pageTop = (element: Element): number =>
  element.getBoundingClientRect().top + window.scrollY;

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
    // Not paginated yet (the PDF service switches to print media before it prints, so the
    // forced breaks collapse to the document's 20 px gap): the page edge cannot be measured,
    // and the footer stays after the content rather than be forced onto a page of its own.
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

/*
 * Placed when the print layout applies (the print media query turning on: Chrome lays the
 * pages out first, so the measurement is the printed one) and cleared when it ends. Lydia's
 * Pageless PDF (isLydiaMode) has one page as tall as the content, so the footer already ends
 * on its edge.
 */
export const registerEcommercePrint = (): void => {
  const state = window as typeof window & { ecPrintRegistered?: boolean };
  if (state.ecPrintRegistered || typeof window.matchMedia !== "function") {
    return;
  }
  state.ecPrintRegistered = true;
  if (new URLSearchParams(window.location.search).has("isLydiaMode")) return;

  window.matchMedia("print").addEventListener("change", (event) => {
    if (event.matches) placeFootersOnPageEdge();
    else resetFootersOnPageEdge();
  });
  window.addEventListener("afterprint", () => resetFootersOnPageEdge());
};
