/*
 * View model for the Apex Engineering template (Figma Document-Templates, node 18842:2814).
 *
 * Built on the Modern Manufacturing view model: same contract coverage, settings and print
 * behaviour, laid out as the Apex design. The template keeps `normalizeInvoiceTemplateState`
 * as its data mapper and asks for this model once, through `{{#with (axView @root) as |view|}}`. Every value here comes from the
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

/* 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
const ordinal = (day: number): string => {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  return `${day}${["th", "st", "nd", "rd"][day % 10] || "th"}`;
};

/*
 * Document dates print as the design does, "27th May, 2026". An instant (ISO with Z / an
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
    return `${ordinal(Number(parts[3]))} ${MONTHS[Number(parts[2]) - 1]}, ${
      parts[1]
    }`;
  }
  const time = typeof value === "number" ? value : Date.parse(raw);
  if (!Number.isFinite(time)) return raw;
  const shifted = new Date(time + offsetMinutes(offset) * 60000);
  return `${ordinal(shifted.getUTCDate())} ${
    MONTHS[shifted.getUTCMonth()]
  }, ${shifted.getUTCFullYear()}`;
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
    stockSummary: read("showStockSummary") ?? true,
    // Lydia's Pageless PDF: one page as tall as the content, so nothing repeats per page.
    pageless:
      [pdfOptions.pageless, pdfOptions.isPageless, pdfOptions.longPdf]
        .map(optionalFlag)
        .find((value) => value !== undefined) ?? false,
  };
};

export type ApexSettings = ReturnType<typeof resolveSettings>;

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
 *   - an Indian GST document's form has GSTIN and PAN only, so there these show only when a
 *     switch turns them on explicitly; elsewhere (a VAT / TRN geography) they show by default.
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
  return text(invoice.taxType).toUpperCase() !== "INDIA";
};

/* A party's field list, as an array or as a map keyed by field id (business profiles). */
const fieldList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : Object.values(asRecord(value));

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
      value: text(entry.value),
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
  title: string
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
    text(party.state),
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
  if (party.gstin && fieldShown(invoice, party, "gst")) {
    ids.push({ key: "gstin", label: "GSTIN", value: text(party.gstin) });
  }
  if (party.panNumber && fieldShown(invoice, party, "pan")) {
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
   * (isNum); an email stays on one line while it fits and breaks only when its box is too
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
    // One unbroken word (an email, a GSTIN, a code): it starts on its label's line and only
    // what does not fit runs on to the next (user request), instead of the whole value
    // dropping below the label.
    isToken: !row.isDate && !/\s/.test(row.value),
  });
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
    ? { title: heading(labels, "additionalInfo", "Additional Info"), rows }
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
            label: labelOr(labels, "ewayBillNumber", "E-Way Bill No."),
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

export const mapTransport = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);

  // Vehicle No. and Transporter lead; any other transport detail the document carries
  // follows in the same label / value form. The e-way bill sits with the IRN (mapEway).
  const rows: LabelValue[] = [
    {
      key: "vehicleNumber",
      label: labelOr(labels, "vehicleNumber", "Vehicle No."),
      value: text(transport.vehicleNumber),
      isNum: true,
    },
    {
      key: "transportName",
      label: labelOr(labels, "transportName", "Transporter"),
      value: firstText(transporter.name, transport.transporterName),
    },
    {
      key: "challanNumber",
      label: labelOr(labels, "challanNumber", "Challan No."),
      value: text(transport.challanNumber),
      isNum: true,
    },
    {
      key: "challanDate",
      label: labelOr(labels, "challanDate", "Challan Date"),
      value: text(transport.challanDate),
      isDate: true,
    },
    {
      key: "vehicleType",
      label: labelOr(labels, "vehicleType", "Vehicle Type"),
      value: text(transport.vehicleType),
    },
    {
      key: "transportMode",
      label: labelOr(labels, "transportMode", "Transport Mode"),
      value: firstText(transport.transportMode, transport.transport),
    },
    {
      key: "transporterId",
      label: labelOr(labels, "transporterId", "Transporter ID"),
      value: firstText(transporter.transporterId, transport.transporterId),
      isNum: true,
    },
    {
      key: "distance",
      label: labelOr(labels, "distance", "Distance (km)"),
      value: text(transport.distance),
      isNum: true,
    },
    {
      key: "transactionType",
      label: labelOr(labels, "transactionType", "Transaction Type"),
      value: text(transport.transactionType),
    },
    {
      key: "subSupplyType",
      label: labelOr(labels, "subSupplyType", "Sub Supply Type"),
      value: firstText(transport.subSupplyType, transport.subSupplyDesc),
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
      isNum: Boolean(row.isNum || row.isDate),
    }));

  // Any transport value shows the box.
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
  const isCancelled = asRecord(asRecord(state.mapped).irn).isCancelled === true;
  const irnQr = firstText(invoice.qrCode, irn.qrCode);
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
    // The e-way bill follows the IRN details (user request).
    ...mapEway(state),
  ].filter((row) => row.value);

  return {
    // Above the item table unless the business places it below (irnPosition).
    isBelowItems:
      firstText(invoice.irnPosition, configuration.irnPosition)
        .toUpperCase()
        .replace(/[^A-Z]/g, "") === "BELOWLINEITEMS",
    showIrn: !isOff(einvoice.irnNumber),
    irnLabel: labelOr(labels, "irn", "IRN"),
    irn: text(irn.Irn),
    rows,
    // Two to a line (Ack No. | Ack Date), like the party fields.
    rowLines: rows
      .filter((_, index) => index % 2 === 0)
      .map((_, index) => rows.slice(index * 2, index * 2 + 2)),
    qr: {
      irn: isCancelled ? "" : irnQr,
      zatca: text(invoice.zatcaQrCode),
      lhdn: text(invoice.lhdnQrCode),
      // documentQr arrives as text (a JSON summary of the document): draw it.
      document: qrImage(documentQr),
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
        : firstText(batch, allocation.batchName);
    }),
  ]
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
    className: `ax-col-${key.replace(/[^A-Za-z0-9_-]/g, "")} ${
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
  ctx: FormatContext,
  mergeUnit: boolean
): string => {
  const value = columnNumber(item, column);
  switch (column.kind) {
    case "code":
      if (column.key === "batch") return batchText(item);
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
        : formatFigure(value, ctx);
    case "money":
      return formatFigure(value, ctx);
    case "number":
      return formatQuantity(value, ctx);
    default:
      return Array.isArray(value) ? value.map(text).join(", ") : text(value);
  }
};

const resolveColumns = (state: UnknownRecord, items: UnknownRecord[]) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  const advanceOptions = asRecord(state.advanceOptions);
  // Normalization drops semanticType / isCessColumn; read them off the account's column.
  const raw = asArray(invoice.columns).map(asRecord);
  const columns = asArray(asRecord(state.mapped).columns)
    .map(asRecord)
    .filter((column) => column.isHidden !== true && text(column.key))
    .map((column) =>
      makeColumn({
        ...raw.find((entry) => entry.key === column.key),
        ...column,
      })
    );
  const has = (key: string) => columns.some((column) => column.key === key);

  // Batch and unit are not account columns: they come from the item itself.
  if (
    !has("batch") &&
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
  if (visibility.showUnitAsColumn && !has("unit") && quantityIndex >= 0) {
    columns.splice(
      quantityIndex + 1,
      0,
      makeColumn({ key: "unit", label: labelOr(labels, "unit", "Unit") })
    );
  }
  return columns;
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
const SERIAL_WIDTH = 32;
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
  batch: { col: "batch", width: 78 },
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
  settings: ApexSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  const items = asArray(invoice.items)
    .map(asRecord)
    .filter((item) => item.hidden !== true && item.isAdditionalCharge !== true);
  const realItems = items.filter(isRealItem);
  const allColumns = resolveColumns(state, realItems);
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
      ? formatFigure(sum, ctx)
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
    width: column.kind === "name" ? 0 : layout.widths[column.key],
  }));

  /*
   * Groups read as the design's section rows, "A. <group name>", and number their items from
   * 1 again (a group name that already carries its own letter keeps it). Without groups the
   * items number straight through.
   */
  let serial = 0;
  let groupIndex = -1;
  let itemIndex = -1;
  const groupName = (name: string): string =>
    !name || /^[A-Z]{1,2}[.)]\s/.test(name)
      ? name
      : `${String.fromCharCode(65 + (groupIndex % 26))}. ${name}`;
  const rows = items
    .filter(
      (item) => !(item.isGroupItemTotalRow === true && !settings.groupSubtotal)
    )
    .map((item) => {
      if (item.group === true) {
        groupIndex += 1;
        serial = 0;
        return {
          isGroupHeader: true,
          name: groupName(text(item.name)),
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
        // "Item name full width": the name (and its codes) reads across the row above the
        // item's figures, the name cell below left for the description.
        nameRow: itemNameFullWidth && !isGroupTotal,
        imageRow: originalImages.length > 0,
        thumbnail: showThumbnail ? thumbnailOf(item) : "",
        cells: columns.map((column) => {
          // A group total row only repeats its money figures.
          const value =
            isGroupTotal && !["money", "qty"].includes(column.kind)
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

  return {
    columns,
    header,
    rows,
    colspan,
    showThumbnail,
    serialLabel: labelOr(labels, "serialNumber", "Sr."),
    serialWidth: SERIAL_WIDTH,
    mergeUnit,
    smallNumbers: layout.smallNumbers,
    descriptionMin: layout.descriptionMin,
    printFixedWidth: layout.printFixedWidth,
    footer: {
      show: settings.totalsRow && realItems.length > 0,
      // No customLabels key exists for the in-table summary row (see architect-template).
      label: "Total",
      labelInSerial: !columns.some((column) => column.kind === "name"),
      cells: footerCells,
    },
  };
};

/* ------------------------------------------------------------------ summaries */

/*
 * Stock (batch) summary, "Show stock summary": one row per batch drawn — the document's own
 * batchSummary (sent only for batch-tracked documents with the setting on), else, when the
 * setting is explicitly on, the items' batches. Columns are the business's batch columns
 * (defaultBatchColumns, visible ones) or Item | Batch | Warehouse | Quantity | Mfg. Date |
 * Exp. Date; a column no row fills is left out. Kept in the page, hidden, while switched off
 * (data-ceres-batch-summary), like the other summaries.
 */
const BATCH_COLUMNS = [
  { key: "itemName", label: "Item" },
  { key: "batchName", label: "Batch" },
  { key: "warehouse", label: "Warehouse" },
  { key: "quantity", label: "Quantity" },
  { key: "manufacturingDate", label: "Mfg. Date" },
  { key: "expiryDate", label: "Exp. Date" },
];

const batchValue = (entry: UnknownRecord, key: string): unknown => {
  const batch = isRecord(entry.batch) ? entry.batch : {};
  if (key === "batchName") {
    return pickFirst(
      entry.batchName,
      batch.batchName,
      batch.name,
      typeof entry.batch === "string" ? entry.batch : undefined
    );
  }
  if (key === "warehouse") {
    return pickFirst(entry.warehouseName, batch.warehouseName, entry.warehouse);
  }
  return pickFirst(entry[key], batch[key], asRecord(entry.custom)[key]);
};

export const mapStockSummary = (
  state: UnknownRecord,
  ctx: FormatContext,
  settings: ApexSettings = resolveSettings(state)
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
          }))
      );
  let entries = documentRows;
  if (!entries.length && explicit === true) entries = itemRows();
  if (!entries.length) return null;

  const configured = asArray(invoice.defaultBatchColumns)
    .map(asRecord)
    .filter((column) => column.isHidden !== true)
    .map((column) => ({
      key: firstText(column.key, column.name),
      label: firstText(column.label, column.name, column.key),
    }))
    .filter((column) => column.key && column.label);
  const format = (key: string, value: unknown): string => {
    if (!hasValue(value)) return "";
    if (/date$/i.test(key))
      return formatDocumentDate(value, invoice.ownerOffset);
    if (/^(?:quantity|qty)$/i.test(key)) return formatQuantity(value, ctx);
    return text(value);
  };
  const rows = entries.map((entry) =>
    (configured.length ? configured : BATCH_COLUMNS).map((column) => ({
      key: column.key,
      value: format(column.key, batchValue(entry, column.key)),
      isNum: /^(?:quantity|qty)$/i.test(column.key),
    }))
  );
  const columns = (configured.length ? configured : BATCH_COLUMNS)
    .map((column, index) => ({ ...column, index }))
    .filter((column) => rows.some((row) => row[column.index].value));
  if (!columns.length) return null;

  return {
    title: heading(labels, "batchSummary", "Stock Summary"),
    hidden: !settings.stockSummary,
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

  const rows: LabelValue[] = visibility.showBankAccount
    ? [
        {
          key: "accountHolderName",
          label: labelOr(labels, "accountHolderName", "Account Name"),
          value: firstText(bank.name, bank.accountHolderName),
        },
        {
          key: "bankName",
          label: labelOr(labels, "bankName", "Bank Name"),
          value: firstText(bank.bank, bank.bankName),
        },
        {
          key: "accountNumber",
          label: firstText(
            labels.accountNumber,
            labels.accountNo,
            "Account No."
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
          value: text(bank.accountType),
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
            value: text(field.value),
          })),
      ].filter((row) => row.label && row.value)
    : [];

  const upiId = visibility.showUpi
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
      isNum: NUMERIC_BANK_ROWS.includes(row.key),
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

export const mapWords = (
  state: UnknownRecord,
  settings: ApexSettings = resolveSettings(state)
) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  if (!visibility.showTotals) return null;

  const stored = text(labels.totalInWordsValue);
  const computed =
    text(invoice.currency).toUpperCase() === "INR"
      ? amountInWords(toAmount(asRecord(invoice.finalTotal).total))
      : "";
  // The amount reads in capitals, like the tax summaries' words (user request); the label
  // is editable and keeps its own case.
  const value = (stored || computed).toUpperCase();
  // Switched off, the line stays in the page, hidden, as the Subtotal widget keeps it, so
  // the host's live toggle (data-ceres-total-in-words) can bring it back. A document with
  // more decimal places than the currency (3) still shows it, in rupees and paise (user request).
  return value
    ? {
        label: labelOr(labels, "totalInWords", "Total (in words)"),
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
  settings: ApexSettings = resolveSettings(state)
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
  // "Discount (10%)": the rate after the label, with its space (the widget writes none).
  const rate = discountRate(invoice);
  const withDiscountRate = (row: SubtotalRow): SubtotalRow =>
    row.key === "discount" && rate
      ? {
          ...row,
          label: `${row.label.replace(/\s*\([^)]*%\)\s*$/, "")} (${rate}%)`,
        }
      : row;
  return {
    hidden: model.hidden,
    hideTaxes: model.hideTaxes,
    main: model.groups.main.map(unitRate).map(withDiscountRate).map(plainRow),
    extra: model.groups.extra.map(plainRow),
    // "Show balance due" off drops the Balance Due row; what was paid still prints.
    due: model.groups.due
      .filter((row) => settings.dueAmount || row.key !== "dueAmount")
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
 * The contact strip at the foot (Figma "document-footer"): Billed By's address, phone and
 * email (user rule), nothing from the document's own enquiry contact. A field the business
 * switched off for documents (phoneShowInInvoice / emailShowInInvoice) stays off.
 */
export const mapContact = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const seller = asRecord(invoice.billedBy);
  const party = mapParty(invoice, seller, "");
  const phone = isOff(seller.phoneShowInInvoice) ? "" : text(seller.phone);
  const email = isOff(seller.emailShowInInvoice) ? "" : text(seller.email);
  const address = party ? party.address : "";
  return address || phone || email ? { address, phone, email } : null;
};

/*
 * Payment Terms card (Figma node 18843:3808): every terms line that opens with a share
 * ("90% Advance along with order…"), from whichever group, prints here (user rule) — the
 * share in bold over the rest in regular text — and leaves Terms and Conditions; every other
 * line stays there. The card's title is the label of a group made only of such lines (the
 * document's own "Payment Terms" group), else the paymentTerms label, else "Payment Terms".
 */
const SHARE_LINE = /^(\d+(?:[.,]\d+)?\s?%)\s*[-–:,]?\s*([\s\S]*)$/;

export const isShareLine = (term: unknown): boolean =>
  SHARE_LINE.test(text(term));

const termLines = (group: UnknownRecord): string[] =>
  asArray(group.terms).map(text).filter(Boolean);

export const mapPaymentTerms = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const groups = asArray(invoice.terms).map(asRecord);
  const cells = groups
    .flatMap(termLines)
    .map((term) => term.match(SHARE_LINE))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      figure: match[1].replace(/\s/g, ""),
      caption: match[2],
    }));
  if (!cells.length) return null;
  const ownGroup = groups.find((group) => {
    const lines = termLines(group);
    return lines.length > 0 && lines.every(isShareLine);
  });
  return {
    title: firstText(
      ownGroup && ownGroup.label,
      labels.paymentTerms,
      "Payment Terms"
    ),
    cells,
  };
};

/*
 * The cost card's currency mark: the design's rupee artwork on rupee documents (template), and
 * for any other currency the same 32 px black disc carrying that currency's symbol in white —
 * the document's own symbol (customCurrencySymbol) when it has one, else the currency's narrow
 * symbol ("$", "€", "£", "¥", "₦"…), else its code ("AED"). Longer marks are set smaller so they
 * stay inside the disc, never under the 10 px floor.
 */
export const currencyMark = (
  invoice: UnknownRecord
): { symbol: string; size: number } | null => {
  const currency = text(invoice.currency).toUpperCase();
  if (!currency || currency === "INR") return null;
  let symbol = text(invoice.customCurrencySymbol);
  if (!symbol) {
    try {
      symbol =
        new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          currencyDisplay: "narrowSymbol",
        })
          .formatToParts(0)
          .find((part) => part.type === "currency")?.value || currency;
    } catch {
      symbol = currency;
    }
  }
  const { length } = Array.from(symbol);
  if (!length) return null;
  const size = [16, 16, 13, 10][Math.min(length, 3)];
  return { symbol, size };
};

/*
 * The cost card beside the client (Figma "Value card"): the grand total row of the totals —
 * its label and figure, with the currency — and a note on the tax it includes: "(INCL. GST @18%)"
 * when every taxed item carries the same rate, "(INCL. GST)" when rates differ, nothing on an
 * untaxed document. Hidden with the totals (hideTotals).
 */
export const mapCostCard = (
  state: UnknownRecord,
  totals: ReturnType<typeof mapTotals>
) => {
  const grand = totals.main.find((row) => row.key === "total");
  if (!grand || totals.hidden) return null;
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const finalTotal = asRecord(invoice.finalTotal);
  const taxed = ["igst", "cgst", "sgst", "utgst", "tax"].some(
    (key) => toAmount(finalTotal[key]) > 0
  );
  const rates = asArray(invoice.items)
    .map(asRecord)
    .filter(isRealItem)
    .map((item) => toAmount(pickFirst(item.gstRate, item.taxRate)))
    .filter((rate) => rate > 0)
    .filter((rate, index, all) => all.indexOf(rate) === index);
  const isGst = Boolean(visibility.showIgst || visibility.showCgstSgst);
  const taxName = firstText(invoice.taxName, isGst ? "GST" : "Tax");
  const labels = asRecord(invoice.customLabels);
  return {
    label: grand.label,
    value: grand.value,
    // The design's rupee mark on rupee documents; every other currency its own symbol.
    showRupeeIcon: text(invoice.currency).toUpperCase() === "INR",
    currencyMark: currencyMark(invoice),
    converted: grand.converted,
    note:
      taxed && !totals.hideTaxes
        ? `(${labelOr(labels, "inclusiveOf", "INCL.")} ${taxName}${
            rates.length === 1
              ? ` @${formatQuantity(rates[0], formatContext(invoice))}%`
              : ""
          })`
        : "",
  };
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

const compactDecimal = (value: number): string =>
  String(Number(value.toFixed(4)));

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
  const template = asRecord(invoice.template);
  const format = text(pdfOptions.format).toLowerCase();
  const landscape = optionalFlag(pdfOptions.landscape) === true;
  const paperMm = landscape
    ? PAPER_HEIGHT_MM[format] ?? PAPER_HEIGHT_MM.a4
    : PAPER_WIDTH_MM[format] ?? PAPER_WIDTH_MM.a4;
  const pageZoom = positiveNumber(pdfOptions.zoomSize) ?? 1;
  const rendererZoom = pageZoom === 0.8 ? 1 : pageZoom;
  const pageWidth = ((paperMm / 25.4) * 96 - PRINT_MARGINS_PX) / rendererZoom;
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
    compactTable,
    tableFit:
      tableFit < 1 ? compactDecimal(Math.floor(tableFit * 100) / 100) : "",
    // "Hide footer": the letterhead footer is not drawn at all.
    hideFooter: [
      pdfOptions.hideFooter,
      template.hideFooter,
      invoice.hideFooter,
    ].some((value) => optionalFlag(value) === true),
  };
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

/* A party's identifier lines as one flat list: the design prints them one per line. */
const partyFields = (party: ReturnType<typeof mapParty>) =>
  party ? party.lines.reduce((all, line) => all.concat(line), []) : [];

/*
 * The subtitle splits at its first comma (user rule): "<lead>, <rest>" prints the part before it in bold and the rest, commas and
 * all, on the line below in regular text. A line break splits it the same way.
 */
export const subtitleLines = (
  value: unknown
): { lead: string; rest: string } => {
  const raw = text(value);
  const at = raw.search(/[,\n]/);
  if (at < 0) return { lead: raw, rest: "" };
  return {
    lead: raw.slice(0, at).trim(),
    rest: raw
      .slice(at + 1)
      .replace(/\s*\n\s*/g, " ")
      .trim(),
  };
};

export const buildApexView = (root: unknown) => {
  const state = asRecord(root);
  const invoice = asRecord(state.invoice);
  const mapped = asRecord(state.mapped);
  const visibility = asRecord(mapped.visibility);
  const advanceOptions = asRecord(state.advanceOptions);
  const labels = asRecord(invoice.customLabels);
  const ctx = formatContext(invoice);
  const seller = mapParty(invoice, invoice.billedBy, "");
  const logo = firstText(invoice.logo, asRecord(invoice.billedBy).logo);

  const settings = mapSettings(state);
  const options = resolveSettings(state);
  const shippedFrom = visibility.shippedFrom
    ? mapParty(
        invoice,
        invoice.shippedFrom,
        heading(labels, "shippedFrom", "Shipped From")
      )
    : null;
  const shippedTo = visibility.shippedTo
    ? mapParty(
        invoice,
        invoice.shippedTo,
        heading(labels, "shippedTo", "Shipped To")
      )
    : null;
  const allTransport = mapTransport(state);
  // Transport sits in the header's details list by default; with a dispatch panel (Shipped
  // From or Shipped To), or the template's "section" setting, it takes the panel's last column.
  const transportInGrid =
    settings.transportInGrid && shippedFrom === null && shippedTo === null;
  const transport = transportInGrid ? null : allTransport;
  const meta = mapMeta(
    state,
    transportInGrid && allTransport ? allTransport.rows : []
  );
  const notes = mapNotes(state);
  // "Show terms" off hides every terms group, the Payment Terms card's included.
  const paymentTerms = options.terms ? mapPaymentTerms(state) : null;
  // Lines opening with a share are on the Payment Terms card; the rest stay in Terms and
  // Conditions, and a group left with no lines drops out.
  const terms = options.terms
    ? notes.terms
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !isShareLine(item)),
        }))
        .filter((group) => group.items.length > 0)
    : [];
  const additional = mapAdditionalInfo(state, ctx);
  // Client panel: Bill To (name, address | fields) and the cost card. Shipped From, Shipped
  // To and transport form the dispatch panel below it (user request).
  const parties = [
    mapParty(
      invoice,
      invoice.billedTo,
      heading(labels, "billedTo", "Billed To")
    ),
  ]
    .filter(Boolean)
    .map((party) => ({ ...party, fields: partyFields(party) }));
  const withFields = (party: ReturnType<typeof mapParty>) =>
    party ? { ...party, fields: partyFields(party) } : null;
  const payments = asArray(invoice.allPayments);
  const table = mapItemTable(state, ctx, options);
  const totals = mapTotals(state, options);
  const subtitle = subtitleLines(invoice.invoiceSubTitle);
  const notesBlock = notes.notes;
  const bank = mapBank(state);
  const compliance = mapCompliance(state);
  const hasCompliance = Boolean(
    (compliance.showIrn && compliance.irn) ||
      compliance.rows.length ||
      compliance.qr.irn ||
      compliance.qr.zatca ||
      compliance.qr.lhdn ||
      compliance.qr.document
  );
  const status = text(invoice.billType).toUpperCase() === "INVOICE";
  const print = mapPrint(
    state,
    table.printFixedWidth,
    table.columns.filter((column) => column.kind !== "name").length
  );

  return {
    brand: {
      name: seller ? seller.name : "",
      logo,
      // The seller's tax numbers and own fields, under the contact strip.
      fields: seller
        ? [...seller.ids, ...seller.extras].map((row) => ({
            label: row.label,
            value: row.value,
            isDate: Boolean(row.isDate),
          }))
        : [],
    },
    title: firstText(invoice.invoiceTitle),
    subtitle,
    copy: firstText(invoice.copy),
    // The status tag (Paid, Unpaid…) belongs to invoices; on paper only once paid.
    status: status
      ? { inPrint: Boolean(visibility.showStatusTagInPrint) }
      : null,
    theme: settings.theme,
    meta,
    compliance,
    hasCompliance,
    supply: mapSupply(state),
    parties,
    // The design's empty ruled column before the cost card.
    clientSlot: parties.length === 1,
    costCard: mapCostCard(state, totals),
    // Dispatch panel, in this order: Shipped From | Shipped To | Transport Details.
    shippedFrom: withFields(shippedFrom),
    shippedTo: withFields(shippedTo),
    dispatchParties: [
      shippedFrom ? { ...withFields(shippedFrom), role: "shipped-from" } : null,
      shippedTo ? { ...withFields(shippedTo), role: "shipped-to" } : null,
    ].filter(Boolean),
    transport,
    hasDispatch:
      shippedFrom !== null || shippedTo !== null || transport !== null,
    table,
    descriptionFullWidth: options.descriptionFullWidth,
    bank: {
      ...bank,
      upiSmall: Boolean(visibility.upiShrink),
    },
    totals,
    words: mapWords(state, options),
    // Terms and Conditions | Bank Details, then the notes on a row of their own (user
    // request), then Additional Info | Attachments.
    termsRow: {
      terms,
      show: terms.length > 0 || bank.show,
    },
    notesRow: notesBlock,
    infoRow: {
      additional,
      attachments: notes.attachments,
      show: !!additional || !!notes.attachments,
    },
    /*
     * The summaries render whenever there is data, hidden while their setting is off, so the
     * host's live toggles (data-ceres-hsn-summary / -tax-summary / -payment-table) can show
     * them without a re-render.
     */
    hsn: {
      hidden: !visibility.showHsnSummary,
      title: heading(labels, "hsnSummary", "HSN Summary"),
    },
    taxSummary: {
      hidden: !visibility.showTaxTable,
    },
    stock: mapStockSummary(state, ctx, options),
    payments: {
      show: payments.length > 0,
      hidden:
        advanceOptions.showPaymentsTable === false ||
        invoice.showPaymentsTable === false,
      heading: labelOr(labels, "paymentRecord", "Payment Record"),
    },
    paymentTerms,
    contact: mapContact(state),
    signature: mapSignature(state),
    // The letterhead footer repeats at the foot of every printed page unless the document
    // asks for it on the last page only (pdfOptions.footerOnLastPage).
    // Pageless PDF is one page as tall as the content: letterhead and footer once each.
    footerEveryPage: !visibility.footerOnLastPage && !options.pageless,
    // The letterhead repeats at the top of every printed page unless the document asks for
    // it on the first page only (pdfOptions.letterHeadOnFirstPage).
    letterheadEveryPage: !visibility.letterHeadOnFirstPage && !options.pageless,
    pageless: options.pageless,
    hideFooter: print.hideFooter,
    print,
    script: mapScript(state),
  };
};

interface HelperRegistry {
  registerHelper: (
    name: string,
    helper: (...args: unknown[]) => unknown
  ) => void;
}

export const registerApexHelpers = (HB: HelperRegistry | undefined): void => {
  if (!HB) return;
  HB.registerHelper("axView", (root: unknown) => buildApexView(root));
  // `{{axDate value offset}}` — Handlebars appends its options object, so only a string or
  // number second argument is an offset.
  HB.registerHelper("axDate", (value: unknown, offset: unknown) =>
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
 * A business logo no wider than 1.25 × its height (square, or upright) prints in a 100 px
 * square instead of the wide logo's 200 × 48 box (user request). Its shape is only known once
 * it loads, so the logo is marked then (is-square, styles.css); load events do not bubble, so
 * the listener sits on the document's capture phase, ahead of every render.
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

export const registerApexLogo = (): void => {
  const state = window as typeof window & { axLogoRegistered?: boolean };
  if (state.axLogoRegistered || typeof document === "undefined") return;
  state.axLogoRegistered = true;
  document.addEventListener(
    "load",
    (event) => {
      const { target } = event;
      if (
        target instanceof HTMLImageElement &&
        target.classList.contains("ax-logo-image")
      ) {
        markLogoShape(target);
      }
    },
    true
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
  ".ax-doc > .ax-letterhead-footer:not(.ax-footer-fixed):not(.is-empty)";

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
export const registerApexPrint = (): void => {
  const state = window as typeof window & { axPrintRegistered?: boolean };
  if (state.axPrintRegistered || typeof window.matchMedia !== "function") {
    return;
  }
  state.axPrintRegistered = true;
  if (new URLSearchParams(window.location.search).has("isLydiaMode")) return;

  window.matchMedia("print").addEventListener("change", (event) => {
    if (event.matches) placeFootersOnPageEdge();
    else resetFootersOnPageEdge();
  });
  window.addEventListener("afterprint", () => resetFootersOnPageEdge());
};
