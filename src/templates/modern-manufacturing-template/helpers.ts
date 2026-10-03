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

interface FormatContext {
  locale: string;
  digits: number;
}

export interface LabelValue {
  key: string;
  label: string;
  value: string;
  isDate?: boolean;
  isUtcDate?: boolean;
  isHidden?: boolean;
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
    return value.toFixed(max);
  }
};

export const formatMoney = (value: unknown, ctx: FormatContext): string => {
  if (!hasValue(value)) return "";
  const amount = toAmount(value);
  const formatted = formatNumber(
    Math.abs(amount),
    ctx.locale,
    ctx.digits,
    ctx.digits
  );
  return amount < 0 ? `(${formatted})` : formatted;
};

export const formatQuantity = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? formatNumber(toAmount(value), ctx.locale, 0, 3) : "";

const formatPercent = (value: unknown, ctx: FormatContext): string =>
  hasValue(value) ? `${formatQuantity(value, ctx)}%` : "";

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

const extraRows = (party: UnknownRecord): LabelValue[] => [
  ...asArray(party.additionalIds)
    .map(asRecord)
    .filter((entry) => !isOff(entry.showInInvoice))
    .map((entry) => ({
      key: "additionalId",
      label: text(entry.label),
      value: text(entry.value),
    })),
  ...asArray(party.customFields)
    .map(asRecord)
    .filter((entry) => !isOff(asRecord(entry.params).showInInvoice))
    .map((entry) => ({
      key: "customField",
      label: firstText(entry.label, entry.name),
      value: text(entry.value),
    })),
  ...asArray(party.customHeaders)
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
  if (party.vatNumber) {
    ids.push({
      key: "vat",
      label: firstText(party.vatLabel, "VAT Number"),
      value: text(party.vatNumber),
    });
  }

  const contactPerson = asRecord(party.contactPerson);
  const contacts = [
    isOff(party.phoneShowInInvoice) ? "" : text(party.phone),
    isOff(party.emailShowInInvoice) ? "" : text(party.email),
  ].filter(Boolean);

  return {
    title,
    name,
    addressLines: [streetLine, regionLine].filter(Boolean),
    ids,
    contacts,
    contactPerson: firstText(contactPerson.name),
    extras: extraRows(party).filter((row) => row.label && row.value),
  };
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

const customFieldValue = (field: UnknownRecord, ctx: FormatContext) => {
  const dataType = text(field.dataType).toLowerCase();
  if (dataType === "currency") return formatMoney(field.value, ctx);
  if (Array.isArray(field.value)) return field.value.map(text).join(", ");
  return text(field.value);
};

export const mapMeta = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const labels = asRecord(invoice.customLabels);
  const transport = asRecord(invoice.transportDetails);
  const transporter = asRecord(transport.transporter);
  const irn = asRecord(invoice.irn);
  const { eway } = complianceSettings(invoice);

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
    ...asArray(invoice.customFields)
      .map(asRecord)
      .filter((entry) => !isOff(asRecord(entry.params).showInInvoice))
      .map((entry) => ({
        key: "customField",
        label: firstText(entry.label, entry.name),
        value: customFieldValue(entry, ctx),
        isDate: text(entry.dataType).toLowerCase() === "date",
      })),
    {
      key: "challanNumber",
      label: labelOr(labels, "challanNumber", "Challan No."),
      value: text(transport.challanNumber),
    },
    {
      key: "challanDate",
      label: labelOr(labels, "challanDate", "Challan Date"),
      value: text(transport.challanDate),
      isDate: true,
    },
    ...(isOff(eway.billNumber)
      ? []
      : [
          {
            key: "ewayBillNumber",
            label: labelOr(labels, "ewayBillNumber", "E-Way Bill No."),
            value: text(irn.EwbNo),
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
    {
      key: "vehicleNumber",
      label: labelOr(labels, "vehicleNumber", "Vehicle No."),
      value: text(transport.vehicleNumber),
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
      key: "transportName",
      label: labelOr(labels, "transportName", "Transporter"),
      value: firstText(transporter.name, transport.transporterName),
    },
    {
      key: "transporterId",
      label: labelOr(labels, "transporterId", "Transporter ID"),
      value: firstText(transporter.transporterId, transport.transporterId),
    },
    {
      key: "distance",
      label: labelOr(labels, "distance", "Distance (km)"),
      value: text(transport.distance),
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
    {
      key: "placeOfSupply",
      label: labelOr(labels, "placeOfSupply", "Place of Supply"),
      value: placeOfSupplyText(invoice),
      // Rendered hidden rather than dropped so the host's live toggle has a target.
      isHidden: !visibility.showPlaceOfSupply,
      attr: "data-ceres-place-of-supply",
    },
    {
      key: "countryOfSupply",
      label: labelOr(labels, "countryOfSupply", "Country of Supply"),
      value: regionName(text(invoice.countryOfSupply)),
      isHidden: !visibility.showCountryOfSupply,
      attr: "data-ceres-country-of-supply",
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

  return rows.filter((row) => row.label && row.value);
};

export const mapCompliance = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const irn = asRecord(invoice.irn);
  const { einvoice } = complianceSettings(invoice);
  const isCancelled = asRecord(asRecord(state.mapped).irn).isCancelled === true;
  const irnQr = firstText(invoice.qrCode, irn.qrCode);
  const documentQr = text(invoice.documentQr);

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

  return {
    showIrn: !isOff(einvoice.irnNumber),
    irnLabel: labelOr(labels, "irn", "IRN"),
    irn: text(irn.Irn),
    rows,
    qr: {
      irn: isCancelled ? "" : irnQr,
      zatca: text(invoice.zatcaQrCode),
      lhdn: text(invoice.lhdnQrCode),
      // documentQr can arrive as encoded text; only an image source can be drawn here.
      document: /^(data:image\/|https?:\/\/)/i.test(documentQr)
        ? documentQr
        : "",
    },
  };
};

/* ------------------------------------------------------------------ items */

const configuredUnit = (units: unknown, raw: string): string => {
  const entry = Array.isArray(units)
    ? asRecord(
        units.find((unit) =>
          [asRecord(unit)._id, asRecord(unit).key, asRecord(unit).value]
            .map(text)
            .includes(raw)
        )
      )
    : asRecord(asRecord(units)[raw]);
  return firstText(entry.displayName, entry.label, entry.name, entry.symbol);
};

export const unitText = (invoice: UnknownRecord, item: UnknownRecord) => {
  const raw = text(item.unit);
  if (!raw) return "";
  return configuredUnit(ownerConfiguration(invoice).units, raw) || raw;
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
  ctx: FormatContext
): string => {
  const value = columnNumber(item, column);
  switch (column.kind) {
    case "code":
      if (column.key === "batch") return batchText(item);
      if (column.key === "unit") return unitText(invoice, item);
      return text(value);
    case "qty": {
      const unit = visibility.showUnitInQuantity ? unitText(invoice, item) : "";
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
 * Figures never wrap, so a wide column set (or very large amounts) can only fit the page by
 * tightening the cells. Estimate the one-line width of every fixed column from its longest
 * value — or the longest word of its header, which may wrap at spaces — and step down:
 * tighter padding first, then one type step (11px → 10px, the floor). Thresholds assume the
 * ~700px content width of an A4 page; the text column keeps a ~170px share with the serial.
 */
const PAGE_WIDTH = 700;
const TEXT_COLUMN_SHARE = 170;

export const tableDensity = (
  columns: ItemColumn[],
  rows: Array<{ cells?: Array<{ key: string; value: string }> }>,
  footer: Array<{ key: string; value: string }>
): { density: string; fit: string } => {
  const chars = columns
    .filter((column) => column.kind !== "name")
    .map((column) => {
      const values = [
        ...rows.map(
          (row) =>
            (row.cells || []).find((cell) => cell.key === column.key)?.value ||
            ""
        ),
        footer.find((cell) => cell.key === column.key)?.value || "",
      ];
      const headerWord = Math.max(
        0,
        ...column.label.split(/\s+/).map((word) => word.length)
      );
      return Math.max(headerWord, ...values.map((value) => value.length));
    });
  const width = (perChar: number, padding: number) =>
    chars.reduce(
      (total, count) => total + count * perChar + padding,
      TEXT_COLUMN_SHARE
    );

  if (width(6.2, 16) <= PAGE_WIDTH) return { density: "", fit: "" };
  if (width(6.2, 8) <= PAGE_WIDTH) return { density: "is-compact", fit: "" };
  // 10px type, 4px side padding. Beyond that only scaling keeps every figure on the page.
  const dense = width(5.6, 8);
  return {
    density: "is-dense",
    fit: dense > PAGE_WIDTH ? Math.max(0.8, PAGE_WIDTH / dense).toFixed(2) : "",
  };
};

const isRealItem = (item: UnknownRecord) =>
  item.group !== true &&
  item.isGroupItemTotalRow !== true &&
  item.isAdditionalCharge !== true;

export const mapItemTable = (state: UnknownRecord, ctx: FormatContext) => {
  const invoice = asRecord(state.invoice);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  const advanceOptions = asRecord(state.advanceOptions);
  const labels = asRecord(invoice.customLabels);
  const items = asArray(invoice.items)
    .map(asRecord)
    .filter((item) => item.hidden !== true && item.isAdditionalCharge !== true);
  const realItems = items.filter(isRealItem);
  const columns = resolveColumns(state, realItems);
  const showThumbnail =
    Boolean(visibility.showThumbnailAsColumn) &&
    realItems.some((item) => text(item.thumbnail));
  const fullWidth = Boolean(visibility.isDescriptionFullWidth);
  const colspan = columns.length + 1 + (showThumbnail ? 1 : 0);

  let serial = 0;
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
      return {
        isItem: !isGroupTotal,
        isGroupTotal,
        serial: isGroupTotal ? "" : String(serial),
        name: text(item.name),
        inlineCodes,
        description: isGroupTotal ? "" : text(item.description),
        descriptionFullWidth: fullWidth,
        images: asArray(item.images).filter((image) => text(image)),
        originalImages: asArray(item.originalImages).filter((image) =>
          text(image)
        ),
        thumbnail: text(item.thumbnail),
        cells: columns.map((column) => ({
          key: column.key,
          className: column.className,
          isName: column.kind === "name",
          // A group total row only repeats its money figures.
          value:
            isGroupTotal && !["money", "qty"].includes(column.kind)
              ? ""
              : cellValue(invoice, visibility, item, column, ctx),
        })),
        colspan,
      };
    });

  const discountsArePercent = realItems.some(
    (item) => discountParts(item).isPercent
  );
  const footerCells = columns.map((column) => {
    let value = "";
    if (
      column.summable &&
      !(column.kind === "discount" && discountsArePercent)
    ) {
      const sum = realItems.reduce(
        (total, item) => total + toAmount(columnNumber(item, column)),
        0
      );
      value =
        column.kind === "money" || column.kind === "discount"
          ? formatMoney(sum, ctx)
          : formatQuantity(sum, ctx);
    }
    return {
      key: column.key,
      className: column.className,
      isName: column.kind === "name",
      value,
    };
  });

  return {
    columns,
    rows,
    colspan,
    showThumbnail,
    serialLabel: labelOr(labels, "serialNumber", "Sr."),
    ...tableDensity(columns, rows, footerCells),
    footer: {
      show: Boolean(visibility.showTotalsRow) && realItems.length > 0,
      // No customLabels key exists for the in-table summary row (see architect-template).
      label: "Total",
      labelInSerial: !columns.some((column) => column.kind === "name"),
      cells: footerCells,
    },
  };
};

/* ------------------------------------------------------------------ summaries */

const summaryList = (value: unknown, key: "hsnList" | "taxList") =>
  (Array.isArray(value) ? value : asArray(asRecord(value)[key])).map(asRecord);

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
  const hasCess = rows.some((row) => toAmount(row.cessAmount));
  const taxSources = {
    customLabels: labels,
    columns: asRecord(state.mapped).columns,
    taxName: invoice.taxName,
    isUtgst,
  };
  const hsnColumn = asArray(asRecord(state.mapped).columns)
    .map(asRecord)
    .find((column) => column.key === "hsn");

  const sums = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0 };
  const body = rows.map((row) => {
    const taxable = toAmount(row.taxableValue);
    const igst = toAmount(row.igst);
    const cgst = toAmount(row.cgst);
    const sgst = toAmount(row.sgst) + toAmount(row.utgst);
    const cess = toAmount(row.cessAmount);
    const total = taxable + (showIgst ? igst : cgst + sgst) + cess;
    sums.taxable += taxable;
    sums.igst += igst;
    sums.cgst += cgst;
    sums.sgst += sgst;
    sums.cess += cess;
    sums.total += total;
    return {
      hsn: text(row.hsn),
      rate: hasValue(row.tax) ? formatPercent(row.tax, ctx) : "",
      taxable: formatMoney(taxable, ctx),
      igst: formatMoney(igst, ctx),
      cgst: formatMoney(cgst, ctx),
      sgst: formatMoney(sgst, ctx),
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
    hasRows: body.length > 0,
    // Rendered hidden when switched off so the host's live toggle can reveal it.
    isHidden: !enabled,
    showIgst,
    hasCess,
    labels: {
      hsn: firstText(
        asRecord(hsnColumn).label,
        labels.hsnSac,
        labels.hsn,
        "HSN/SAC"
      ),
      rate: labelOr(labels, "taxRate", "Rate"),
      taxable: labelOr(labels, "taxableValue", "Taxable Value"),
      igst: resolveTaxLabel("igst", taxSources),
      cgst: resolveTaxLabel("cgst", taxSources),
      sgst: resolveTaxLabel("sgst", taxSources),
      cess: labelOr(labels, "cess", "Cess"),
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

  return {
    show:
      Boolean(visibility.showBankUpiSection) &&
      (rows.length > 0 || upiId !== ""),
    title: heading(labels, "bankDetails", "Bank Details"),
    rows,
    upi: upiId
      ? {
          label: labelOr(labels, "upi", "UPI ID"),
          id: upiId,
          // A raw upi:// intent is not an image; only a resolved QR can be drawn.
          qr: /^(data:image\/|https?:\/\/)/i.test(upiQr) ? upiQr : "",
        }
      : null,
  };
};

export const mapWords = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const visibility = asRecord(asRecord(state.mapped).visibility);
  if (!visibility.showTotals || invoice.hideTotalInWords === true) return null;

  const stored = text(labels.totalInWordsValue);
  const computed =
    text(invoice.currency).toUpperCase() === "INR"
      ? amountInWords(toAmount(asRecord(invoice.finalTotal).total))
      : "";
  const value = stored || computed;
  return value
    ? { label: labelOr(labels, "totalInWords", "Total (in words)"), value }
    : null;
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

  return {
    notes: notes
      ? { title: heading(labels, "notes", "Additional Notes"), body: notes }
      : null,
    terms,
    attachments: attachments.length
      ? {
          title: heading(labels, "attachment", "Attachments"),
          files: attachments,
        }
      : null,
    hasAny: Boolean(notes) || terms.length > 0 || attachments.length > 0,
  };
};

export const mapSignature = (state: UnknownRecord) => {
  const invoice = asRecord(state.invoice);
  const labels = asRecord(invoice.customLabels);
  const isDigital = text(invoice.signatureMethod).toUpperCase() === "DIGITAL";
  const request = asRecord(invoice.documentSignatureRequest);
  const isSigned = text(request.status).toUpperCase() === "SIGNED";
  const signer = asRecord(asArray(request.signers)[0]);

  return {
    forLabel: [
      labelOr(labels, "for", "For"),
      text(asRecord(invoice.billedBy).name),
    ]
      .filter(Boolean)
      .join(" "),
    image: isDigital ? "" : text(invoice.signature),
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
  const rows = [...asArray(invoice.customFooters), ...asArray(invoice.footers)]
    .map(asRecord)
    .map((entry) => ({
      key: "footer",
      label: firstText(entry.label, entry.defaultValue),
      value: text(entry.value),
    }))
    .filter((row) => row.value);

  return {
    rows,
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

export const formatContext = (invoice: UnknownRecord): FormatContext => {
  const digits = invoice.subUnitLength;
  return {
    locale: firstText(invoice.locale, asRecord(invoice.owner).locale, "en-IN"),
    digits:
      typeof digits === "number" && Number.isInteger(digits) && digits >= 0
        ? digits
        : 2,
  };
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

export const buildModernManufacturingView = (root: unknown) => {
  const state = asRecord(root);
  const invoice = asRecord(state.invoice);
  const mapped = asRecord(state.mapped);
  const visibility = asRecord(mapped.visibility);
  const labels = asRecord(invoice.customLabels);
  const ctx = formatContext(invoice);
  const seller = mapParty(invoice, invoice.billedBy, "");
  const logo = firstText(invoice.logo, asRecord(invoice.billedBy).logo);

  const parties = [
    mapParty(
      invoice,
      invoice.billedTo,
      heading(labels, "billedTo", "Billed To")
    ),
    visibility.shippedFrom
      ? mapParty(
          invoice,
          invoice.shippedFrom,
          heading(labels, "shippedFrom", "Shipped From")
        )
      : null,
    visibility.shippedTo
      ? mapParty(
          invoice,
          invoice.shippedTo,
          heading(labels, "shippedTo", "Shipped To")
        )
      : null,
  ].filter(Boolean);

  return {
    brand: {
      name: seller ? seller.name : "",
      logo,
      initials: logo || !seller ? "" : initials(seller.name),
      seller,
    },
    title: firstText(invoice.invoiceTitle),
    subtitle: firstText(invoice.invoiceSubTitle),
    copy: firstText(invoice.copy),
    meta: mapMeta(state, ctx),
    compliance: mapCompliance(state),
    parties,
    table: mapItemTable(state, ctx),
    bank: mapBank(state),
    words: mapWords(state),
    notes: mapNotes(state),
    hsn: mapHsnSummary(state, ctx),
    taxSummaryHidden: !visibility.showTaxTable,
    payments: {
      hidden:
        asRecord(state.advanceOptions).showPaymentsTable === false ||
        invoice.showPaymentsTable === false,
      heading: labelOr(labels, "paymentRecord", "Payment Record"),
    },
    signature: mapSignature(state),
    footer: mapFooter(state),
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
};
