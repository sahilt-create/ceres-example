import { mapSriLankanTemplateData } from "./shared/sri-lankan.mapper";
import { mapSrTradingTemplateData } from "./shared/sr-trading-2-0.mapper";
import generateQrDataUrl from "./qrCode";
import { countryOfSupply, isSupplyFieldVisible, placeOfSupply } from "./supply";

type UnknownRecord = Record<string, any>;
const INTERNAL_PAGE_BREAK_FIELD = ["__page", "Break", "Before"].join("");

export const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const normalizeKey = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

// ---------------------------------------------------------------------------
// Line-item row spans (cell grouping)
// ---------------------------------------------------------------------------

export interface RowSpanColumn {
  key: string;
  isHidden?: boolean;
  mergeable?: boolean | string | number;
  params?: {
    mergeable?: boolean | string | number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface RowSpanCell {
  rowspan: number;
  skip: boolean;
  groupNumber?: number;
}

export type RowSpanMap = Array<Record<string, RowSpanCell>>;

const ROW_NUMBER_KEYS = new Set(["sr", "srno", "sno", "rownumber", "index"]);
const PAGE_BREAK_FIELD = ["page", "Break", "Before"].join("");
const PAGE_INDEX_FIELD = ["page", "Index"].join("");
const INTERNAL_PAGE_INDEX_FIELD = ["__page", "Index"].join("");

const optionalRowSpanBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  return undefined;
};

const columnId = (column: RowSpanColumn, index: number): string =>
  String(column.key || `column-${index}`);

const isRowSpanNumberColumn = (column: RowSpanColumn): boolean =>
  ROW_NUMBER_KEYS.has(normalizeKey(column.key));

const isItemNameColumn = (column: RowSpanColumn): boolean =>
  ["item", "name", "description"].includes(normalizeKey(column.key));

export const isGroupingDateColumn = (column: RowSpanColumn): boolean => {
  const key = normalizeKey(column.key);
  const label = normalizeKey(column.label);
  const type = normalizeKey(
    column.semanticType ?? column.fxReturnType ?? column.dataType
  );
  return (
    ["date", "datetime", "timestamp"].includes(type) ||
    key.endsWith("date") ||
    ["month", "period", "servicemonth", "billingmonth"].includes(key) ||
    ["date", "month", "period", "servicemonth", "billingmonth"].includes(label)
  );
};

export const isColumnMergeable = (column: RowSpanColumn): boolean => {
  if (column.isHidden || isRowSpanNumberColumn(column)) return false;

  // Date/month identifies a line-item group in this template. The item name is
  // also merged when it repeats inside that date group. Every value column
  // keeps one cell per source row so Quantity/Rate/Amount remain aligned.
  return isGroupingDateColumn(column) || isItemNameColumn(column);
};

const getColumnValue = (rowValue: any, columnValue: RowSpanColumn): any => {
  const row = asRecord(rowValue);
  const key = String(columnValue.key ?? "");
  const normalizedKey = normalizeKey(key);

  if (key && row[key] !== undefined) return row[key];

  if (["item", "name", "description"].includes(normalizedKey)) {
    return row.name ?? row.title;
  }
  if (normalizedKey === "total") {
    return row.total ?? row.subTotal ?? row.amount;
  }
  if (["gstrate", "taxrate"].includes(normalizedKey)) {
    return row.gstRate ?? row.taxRate ?? row.tax;
  }

  const matchingRowKey = Object.keys(row).find(
    (candidate) => normalizeKey(candidate) === normalizedKey
  );
  if (matchingRowKey) return row[matchingRowKey];

  const custom = asRecord(row.custom);
  const matchingCustomKey = Object.keys(custom).find(
    (candidate) => normalizeKey(candidate) === normalizedKey
  );
  if (matchingCustomKey) return custom[matchingCustomKey];

  const customFields = Array.isArray(row.customFields)
    ? row.customFields
    : Object.values(asRecord(row.customFields));
  const matchingCustomField = customFields.find((fieldValue) => {
    const field = asRecord(fieldValue);
    return [field.key, field.label, field.name]
      .map(normalizeKey)
      .includes(normalizedKey);
  });
  const field = asRecord(matchingCustomField);
  return field.value ?? field.defaultValue;
};

const comparableValue = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
};

const startsNewPage = (rows: any[], rowIndex: number): boolean => {
  if (rowIndex <= 0) return false;
  const row = asRecord(rows[rowIndex]);
  const previousRow = asRecord(rows[rowIndex - 1]);
  if (
    optionalRowSpanBoolean(row[PAGE_BREAK_FIELD]) === true ||
    optionalRowSpanBoolean(row[INTERNAL_PAGE_BREAK_FIELD]) === true
  ) {
    return true;
  }

  const page = row[PAGE_INDEX_FIELD] ?? row[INTERNAL_PAGE_INDEX_FIELD];
  const previousPage =
    previousRow[PAGE_INDEX_FIELD] ?? previousRow[INTERNAL_PAGE_INDEX_FIELD];
  return (
    page !== undefined &&
    previousPage !== undefined &&
    String(page) !== String(previousPage)
  );
};

const setSpan = (
  spanMap: RowSpanMap,
  columnKey: string,
  start: number,
  end: number,
  groupNumber?: number
): void => {
  const rowspan = end - start;
  spanMap[start][columnKey] = {
    rowspan,
    skip: false,
    ...(groupNumber === undefined ? {} : { groupNumber }),
  };
  for (let rowIndex = start + 1; rowIndex < end; rowIndex += 1) {
    spanMap[rowIndex][columnKey] = {
      rowspan: 0,
      skip: true,
      ...(groupNumber === undefined ? {} : { groupNumber }),
    };
  }
};

/**
 * Computes presentation-only rowspan metadata without changing or reordering rows.
 * Page splits can be supplied with `pageBreakBefore`/`__pageBreakBefore`, or by
 * changing `pageIndex`/`__pageIndex` between adjacent rows.
 */
export const computeRowSpans = (
  rowsValue: any[],
  columnsValue: RowSpanColumn[]
): RowSpanMap => {
  const rows = Array.isArray(rowsValue) ? rowsValue : [];
  const columns = (Array.isArray(columnsValue) ? columnsValue : []).filter(
    (column) => !column.isHidden
  );
  const spanMap: RowSpanMap = rows.map(() =>
    Object.fromEntries(
      columns.map((column, columnIndex) => [
        columnId(column, columnIndex),
        { rowspan: 1, skip: false },
      ])
    )
  );
  if (!rows.length || !columns.length) return spanMap;

  const rowNumberColumn = columns.find(isRowSpanNumberColumn);
  const mergeableColumns = columns.filter(isColumnMergeable);
  // Prefer the first date/month column as the group identity. This mirrors the
  // source document where all adjacent line items for the same period share one
  // S.No. Tables without a date/month field retain item-name grouping.
  const groupIdentityColumn =
    columns.find(isGroupingDateColumn) ??
    columns.find(isItemNameColumn) ??
    mergeableColumns[0];

  const topLevelGroups: Array<{ start: number; end: number }> = [];
  let groupStart = 0;
  for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
    const atEnd = rowIndex === rows.length;
    const pageSplit = !atEnd && startsNewPage(rows, rowIndex);
    const previousValue = groupIdentityColumn
      ? comparableValue(getColumnValue(rows[rowIndex - 1], groupIdentityColumn))
      : null;
    const currentValue =
      !atEnd && groupIdentityColumn
        ? comparableValue(getColumnValue(rows[rowIndex], groupIdentityColumn))
        : null;
    const continues =
      !atEnd &&
      !pageSplit &&
      previousValue !== null &&
      previousValue === currentValue;
    if (!continues) {
      topLevelGroups.push({ start: groupStart, end: rowIndex });
      groupStart = rowIndex;
    }
  }

  if (rowNumberColumn) {
    const rowNumberKey = columnId(
      rowNumberColumn,
      columns.indexOf(rowNumberColumn)
    );
    topLevelGroups.forEach((group, groupIndex) => {
      setSpan(spanMap, rowNumberKey, group.start, group.end, groupIndex + 1);
    });
  }

  mergeableColumns.forEach((column) => {
    const columnKey = columnId(column, columns.indexOf(column));
    topLevelGroups.forEach((group) => {
      let spanStart = group.start;

      for (
        let rowIndex = group.start + 1;
        rowIndex <= group.end;
        rowIndex += 1
      ) {
        const atGroupEnd = rowIndex === group.end;
        const valuesMatch =
          !atGroupEnd &&
          !startsNewPage(rows, rowIndex) &&
          (() => {
            const previousValue = comparableValue(
              getColumnValue(rows[rowIndex - 1], column)
            );
            const currentValue = comparableValue(
              getColumnValue(rows[rowIndex], column)
            );
            return previousValue !== null && previousValue === currentValue;
          })();

        if (!valuesMatch) {
          if (rowIndex - spanStart > 1) {
            setSpan(spanMap, columnKey, spanStart, rowIndex);
          }
          spanStart = rowIndex;
        }
      }
    });
  });

  return spanMap;
};

// ---------------------------------------------------------------------------
// Template data mapping
// ---------------------------------------------------------------------------

export const isKey = (column: any, keys: string[]): boolean =>
  keys.includes(normalizeKey(asRecord(column).key));

export const hasValue = (value: any): boolean =>
  value !== undefined &&
  value !== null &&
  (typeof value !== "string" || value.trim().length > 0);

const optionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off", ""].includes(normalized)) {
    return false;
  }
  return undefined;
};

const firstBoolean = (...values: any[]): boolean | undefined =>
  values.map(optionalBoolean).find((value) => value !== undefined);

const firstConfiguredValue = (...values: any[]): any =>
  values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" || value.trim().length > 0)
  );

const optionalPrintNumber = (value: any): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizePrintScale = (value: any): number => {
  const parsed = optionalPrintNumber(value);
  if (parsed === undefined || parsed <= 0) return 1;
  const ratio = parsed > 2 ? parsed / 100 : parsed;
  return Math.min(2, Math.max(0.3, ratio));
};

const compactDecimal = (value: number): string =>
  String(Number(value.toFixed(4)));

const mapPrintAppearance = (pdfOptionsValue: any) => {
  const pdfOptions = asRecord(pdfOptionsValue);
  // zoomSize is the print size picked in Lydia: 0.8 smaller, 0.9 small,
  // 1 normal, 1.1 large, 1.2 larger. It zooms the whole container. The
  // renderer also zooms the page by zoomSize, except at 0.8 (its default),
  // so the template divides that renderer zoom back out.
  const zoomSize = optionalPrintNumber(pdfOptions.zoomSize);
  const pageZoom = zoomSize !== undefined && zoomSize > 0 ? zoomSize : 1;
  const rendererZoom = pageZoom !== 0.8 ? pageZoom : 1;
  const scale = normalizePrintScale(
    firstConfiguredValue(pdfOptions.textScale, pdfOptions.scale)
  );

  return {
    scale: compactDecimal(scale),
    pageZoom: compactDecimal(pageZoom),
    rendererZoom: compactDecimal(rendererZoom),
    pageless:
      firstBoolean(
        pdfOptions.pageless,
        pdfOptions.isPageless,
        pdfOptions.longPdf
      ) ?? false,
  };
};

const configuredVisibility = (value: any): boolean | undefined => {
  const record = asRecord(value);
  const params = asRecord(record.params);
  const shown = firstBoolean(
    record.visible,
    record.isVisible,
    record.show,
    record.showInInvoice,
    params.visible,
    params.isVisible,
    params.show,
    params.showInInvoice
  );
  if (shown !== undefined) return shown;

  const hidden = firstBoolean(
    record.hidden,
    record.isHidden,
    record.hide,
    record.hideInInvoice,
    params.hidden,
    params.isHidden,
    params.hide,
    params.hideInInvoice
  );
  return hidden === undefined ? undefined : !hidden;
};

export const isCurrencyColumn = (column: any): boolean => {
  const record = asRecord(column);
  return (
    record.semanticType === "currency" ||
    String(record.fxReturnType ?? record.dataType ?? "").toLowerCase() ===
      "currency" ||
    [
      "rate",
      "unitrate",
      "unitprice",
      "price",
      "amount",
      "subtotal",
      "total",
      "discount",
      "cgst",
      "sgst",
      "utgst",
      "igst",
      "cess",
      "cessamount",
    ].includes(normalizeKey(record.key))
  );
};

export const isDateColumn = (column: any): boolean => {
  const record = asRecord(column);
  const type = String(
    record.dataType ?? record.fxReturnType ?? record.semanticType ?? ""
  ).toLowerCase();
  const key = normalizeKey(record.key);
  return (
    ["date", "datetime", "timestamp"].includes(type) || key.endsWith("date")
  );
};

const columnClass = (keyValue: any): string => {
  const key = normalizeKey(keyValue);
  if (["sr", "srno", "sno", "rownumber", "index"].includes(key)) {
    return "col-index";
  }
  if (["item", "name", "description"].includes(key)) return "col-item";
  if (["quantity", "qty"].includes(key)) return "col-qty";
  if (["unit", "uom", "unitname"].includes(key)) return "col-unit";
  if (["rate", "unitrate", "unitprice", "price"].includes(key)) {
    return "col-rate";
  }
  if (["amount", "subtotal"].includes(key)) return "col-amount";
  if (key === "total") return "col-total";
  if (["hsn", "sac", "hsncode", "hsnsac"].includes(key)) {
    return "col-hsn-sac";
  }
  return `col-${key || "value"}`;
};

const isRowNumberColumn = (column: any): boolean =>
  ["sr", "srno", "sno", "rownumber", "index"].includes(
    normalizeKey(asRecord(column).key)
  );

const ITEM_DESCRIPTION_COLUMN_KEYS = new Set(["item", "name", "description"]);

const STANDARD_LINE_ITEM_COLUMN_KEYS = new Set([
  "quantity",
  "qty",
  "unit",
  "uom",
  "unitname",
  "rate",
  "unitrate",
  "unitprice",
  "price",
  "amount",
  "subtotal",
  "discount",
  "discountrate",
  "discountpercent",
  "discountpercentage",
  "hsn",
  "sac",
  "classification",
  "gstrate",
  "taxrate",
  "gst",
  "tax",
  "vat",
  "igst",
  "cgst",
  "sgst",
  "utgst",
  "cess",
  "cessrate",
  "cessamount",
  "taxamount",
  "total",
]);

const isCustomLineItemColumn = (column: any): boolean => {
  const key = normalizeKey(asRecord(column).key);
  return (
    !isRowNumberColumn(column) &&
    !ITEM_DESCRIPTION_COLUMN_KEYS.has(key) &&
    !STANDARD_LINE_ITEM_COLUMN_KEYS.has(key)
  );
};

const hiddenDocumentKeys = new Set([
  "invoicenumber",
  "documentnumber",
  "invoicedate",
  "documentdate",
  "duedate",
  "validtill",
  "purchaseordernumber",
  "placeofsupply",
  "countryofsupply",
]);

const isHiddenDocumentRow = (rowValue: any): boolean => {
  const row = asRecord(rowValue);
  return [row.key, row.label, row.name, row.supplyField]
    .map(normalizeKey)
    .some((key) => hiddenDocumentKeys.has(key));
};

const firstText = (...values: any[]): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) || "";

const finiteNumber = (value: any): number => {
  const parsed = Number(String(value ?? 0).replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const optionalFiniteNumber = (value: any): number | undefined => {
  if (!hasValue(value)) return undefined;
  const parsed = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isNonZeroAmount = (value: any): boolean =>
  Math.abs(optionalFiniteNumber(value) ?? 0) > 0.000001;

const collectLineItemImages = (itemValues: any[], keys: string[]): string[] =>
  Array.from(
    new Set(
      itemValues.flatMap((itemValue) => {
        const item = asRecord(itemValue);
        return keys.flatMap((key) => {
          const value = item[key];
          const entries = Array.isArray(value) ? value : [value];
          return entries
            .map((entry) => {
              if (typeof entry === "string") return entry.trim();
              const image = asRecord(entry);
              return firstText(image.url, image.src);
            })
            .filter(Boolean);
        });
      })
    )
  );

export const isVaishnaviPercentageColumn = (columnValue: any): boolean => {
  const column = asRecord(columnValue);
  const type = firstText(
    column.semanticType,
    column.dataType,
    column.fxReturnType
  ).toLowerCase();
  return (
    isKey(column, ["gstrate", "taxrate", "cessrate", "discountpercentage"]) ||
    ["percentage", "percent"].includes(type) ||
    (optionalBoolean(column.isCessColumn) === true &&
      /\brate\b/i.test(firstText(column.label, column.name)))
  );
};

export const formatVaishnaviPercentage = (value: any): string => {
  const text = firstText(value);
  if (!text) return "";
  const match = text.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!match) return text;
  const numeric = Number(match[0].replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return text;
  const formatted = Number.isInteger(numeric)
    ? String(numeric)
    : String(Number(numeric.toFixed(2)));
  return `${formatted}%`;
};

const meaningfulTransportText = (...values: any[]): string => {
  const value = firstText(...values);
  return /^(?:-|n\/?a|null|undefined)$/i.test(value) ? "" : value;
};

const mapTransportRows = (source: UnknownRecord) => {
  const transport = asRecord(source.transportDetails);
  const transporter = asRecord(transport.transporter);
  const labels = asRecord(source.customLabels);

  return [
    {
      label: firstText(labels.transportMode, "Transport Mode"),
      value: meaningfulTransportText(transport.transportMode),
    },
    {
      label: firstText(labels.transportName, labels.transporter, "Transporter"),
      value: meaningfulTransportText(
        transporter.name,
        transport.transporterName,
        transport.transport
      ),
    },
    {
      label: firstText(
        labels.transporterId,
        labels.transportId,
        "Transporter ID"
      ),
      value: meaningfulTransportText(
        transporter.transporterId,
        transport.transporterId
      ),
    },
    {
      label: firstText(labels.distance, labels.transportDistance, "Distance"),
      value: meaningfulTransportText(transport.distance),
    },
    {
      label: firstText(labels.challanDate, "Challan Date"),
      value: meaningfulTransportText(transport.challanDate),
      isDate: true,
    },
    {
      label: firstText(
        labels.challanNumber,
        labels.challanNo,
        "Challan Number"
      ),
      value: meaningfulTransportText(transport.challanNumber),
    },
    {
      label: firstText(labels.vehicleType, "Vehicle Type"),
      value: meaningfulTransportText(transport.vehicleType),
    },
    {
      label: firstText(
        labels.vehicleNumber,
        labels.vehicleNo,
        "Vehicle Number"
      ),
      value: meaningfulTransportText(transport.vehicleNumber),
    },
    {
      label: firstText(labels.transactionType, "Transaction Type"),
      value: meaningfulTransportText(transport.transactionType),
    },
    {
      label: firstText(
        labels.subSupplyType,
        labels.supplyType,
        "Sub Supply Type"
      ),
      value: meaningfulTransportText(transport.subSupplyType),
    },
    {
      label: firstText(
        labels.transportInformation,
        labels.transportExtraInfo,
        labels.extraInformation,
        "Transport Notes"
      ),
      value: meaningfulTransportText(transport.extraInformation),
    },
  ].filter((row) => row.value);
};

const collectionRecords = (value: any): UnknownRecord[] => {
  if (Array.isArray(value)) return value.map(asRecord);
  return Object.entries(asRecord(value)).map(([key, entry]) => ({
    key,
    ...asRecord(entry),
    ...(typeof entry === "object" ? {} : { value: entry }),
  }));
};

const documentIdentity = (source: UnknownRecord) => {
  const billType = normalizeKey(source.billType || source.invoiceType);
  const title = firstText(source.invoiceTitle).toLowerCase();
  if (billType === "quotation" || billType === "estimate") {
    return { base: "Quotation", key: "quotation" };
  }
  if (billType === "proformainv" || billType === "proformainvoice") {
    return { base: "Proforma Invoice", key: "proformaInvoice" };
  }
  if (billType === "salesorder") {
    return { base: "Sales Order", key: "salesOrder" };
  }
  if (billType === "deliverychallan") {
    return { base: "Delivery Challan", key: "deliveryChallan" };
  }
  if (billType === "purchaseorder") {
    return { base: "Purchase Order", key: "purchaseOrder" };
  }
  if (billType === "creditnote") {
    return { base: "Credit Note", key: "creditNote" };
  }
  if (billType === "debitnote") {
    return { base: "Debit Note", key: "debitNote" };
  }
  if (source.expenseNumber || /expenditure|expense/.test(title)) {
    return { base: "Purchase", key: "purchase" };
  }
  return { base: firstText(source.invoiceTitle, "Invoice"), key: "invoice" };
};

// Document type key -> key in owner.configuration.showQrCode.
const QR_DOCUMENT_KEYS: UnknownRecord = {
  proformaInvoice: "proforma",
  purchase: "expenditure",
};

const looksLikeImageSource = (value: string): boolean =>
  /^(data:image\/|https?:\/\/|blob:)/i.test(value);

/**
 * IRN, e-way bill and document QR, driven by the business settings in
 * owner.configuration (einvoice, eway, irnPosition, enableQrCode,
 * showQrCode, experimental.qrCodePlacement). A field shows when it has a
 * value and its setting is not false; a missing setting does not hide it.
 */
const mapComplianceDetails = (
  payloadRecord: UnknownRecord,
  source: UnknownRecord,
  mapped: any,
  documentKey: string
) => {
  const configuration = asRecord(
    [
      asRecord(source.owner).configuration,
      asRecord(payloadRecord.ownerBusiness).configuration,
      asRecord(source.ownerBusiness).configuration,
    ].find((value) => Object.keys(asRecord(value)).length)
  );
  const customLabels = asRecord(source.customLabels);
  const irn = asRecord(source.irn);
  const einvoiceSettings = {
    ...asRecord(configuration.einvoice),
    ...asRecord(payloadRecord.einvoiceConfig),
    ...asRecord(source.einvoiceConfig),
  };
  const ewaySettings = {
    ...asRecord(configuration.eway),
    ...asRecord(payloadRecord.ewayConfig),
    ...asRecord(source.ewayConfig),
  };
  const enabled = (settings: UnknownRecord, key: string): boolean =>
    optionalBoolean(settings[key]) !== false;

  const irnValue = firstText(mapped.display.compliance?.irnValue);
  const irnRows = [
    {
      key: "irn",
      label: firstText(mapped.display.document.labels.irn, "IRN"),
      value: irnValue,
      setting: "irnNumber",
      isIrn: true,
    },
    {
      key: "ackNo",
      label: firstText(
        customLabels.irnAcknowledgementNumber,
        customLabels.ackNo,
        "Ack No."
      ),
      value: firstText(irn.AckNo, irn.ackNo),
      setting: "irnAcknowledgementNumber",
    },
    {
      key: "ackDate",
      label: firstText(
        customLabels.irnAcknowledgementDate,
        customLabels.ackDate,
        "Ack Date"
      ),
      value: firstText(irn.AckDt, irn.ackDt),
      setting: "irnAcknowledgementDate",
      isUtcDate: true,
    },
    {
      key: "irnCancelled",
      label: firstText(customLabels.irnCancelledDate, "IRN Cancelled On"),
      value: firstText(irn.CancelDate, irn.cancelDate),
      setting: "irnCancelledDate",
      isOffsetDate: true,
    },
  ].filter((row) => enabled(einvoiceSettings, row.setting));
  // The IRN row stays in the markup while its setting is on, so Lydia's
  // live "irn" update has a target even before the IRN is generated.
  const visibleIrnRows = irnRows.filter(
    (row) => row.key === "irn" || row.value
  );
  const eInvoiceQr = firstText(mapped.display.compliance?.eInvoiceQr);

  const ewayRows = [
    {
      key: "billNumber",
      label: firstText(
        customLabels.ewayBillNumber,
        customLabels.ewayBillNo,
        "Eway Bill No."
      ),
      value: firstText(irn.EwbNo, irn.ewbNo),
    },
    {
      key: "billDate",
      label: firstText(customLabels.ewayBillDate, "Eway Bill Date"),
      value: firstText(irn.EwbDt, irn.ewbDt),
      isUtcDate: true,
    },
    {
      key: "billValidTillDate",
      label: firstText(
        customLabels.ewayValidTillDate,
        customLabels.validTillDate,
        "Valid Till Date"
      ),
      value: firstText(irn.EwbValidTill, irn.ewbValidTill),
      isUtcDate: true,
    },
    {
      key: "billCancelledDate",
      label: firstText(customLabels.ewayCancelledDate, "Eway Cancelled On"),
      value: firstText(irn.ewayCancelDate, irn.EwayCancelDate),
      isUtcDate: true,
    },
  ].filter((row) => row.value && enabled(ewaySettings, row.key));

  const documentQrValue = firstText(
    source.documentQr,
    payloadRecord.documentQr
  );
  const qrDocumentKey = firstText(QR_DOCUMENT_KEYS[documentKey], documentKey);
  const showDocumentQr =
    Boolean(documentQrValue) &&
    optionalBoolean(configuration.enableQrCode) !== false &&
    optionalBoolean(asRecord(configuration.showQrCode)[qrDocumentKey]) !==
      false;
  let documentQr = "";
  if (showDocumentQr) {
    documentQr = looksLikeImageSource(documentQrValue)
      ? documentQrValue
      : generateQrDataUrl(documentQrValue);
  }

  return {
    isIrnAbove:
      normalizeKey(
        firstText(
          payloadRecord.irnPosition,
          source.irnPosition,
          configuration.irnPosition
        )
      ) !== "belowlineitems",
    title: firstText(
      customLabels.einvoiceDetails,
      customLabels.eInvoiceDetails,
      customLabels.irnDetails,
      "E-Invoice Details"
    ),
    showIrnSection: irnRows.length > 0 || Boolean(eInvoiceQr),
    irnRows: visibleIrnRows,
    eInvoiceQr,
    ewayRows,
    documentQr,
    qrPlacement: firstText(
      asRecord(configuration.experimental).qrCodePlacement,
      configuration.qrCodePlacement,
      "BESIDE_DOCUMENT_TITLE"
    ),
  };
};

export const mapVaishnaviTemplateData = (payload: any): any => {
  const mapped = mapSrTradingTemplateData(payload);
  const enriched = mapSriLankanTemplateData(payload);
  const payloadRecord = asRecord(payload);
  const invoiceRecord = asRecord(payloadRecord.invoice);
  const source = Object.keys(invoiceRecord).length
    ? invoiceRecord
    : payloadRecord;
  const sourceColumns = Array.isArray(source.columns)
    ? source.columns
    : mapped.mapped.columns;

  let columns = sourceColumns.map((columnValue: any) => {
    const column = asRecord(columnValue);
    const mappedColumn = mapped.mapped.columns.find(
      (candidate: any) =>
        normalizeKey(candidate.key) === normalizeKey(column.key)
    );
    const visible = configuredVisibility(column);
    const hiddenByMappedColumn =
      optionalBoolean(asRecord(mappedColumn).isHidden) === true;
    return {
      ...column,
      key: String(column.key ?? ""),
      label: String(column.label ?? ""),
      className: columnClass(column.key),
      // Keep system visibility (tax/HSN/unit rules) authoritative while also
      // honoring every supported boolean-like custom-column visibility alias.
      isHidden: hiddenByMappedColumn || visible === false,
      isCessColumn: optionalBoolean(column.isCessColumn) ?? false,
      summarise: optionalBoolean(column.summarise) ?? false,
      mergeable: firstBoolean(
        column.mergeable,
        asRecord(column.params).mergeable
      ),
      dataType: String(column.dataType ?? ""),
      fxReturnType: String(column.fxReturnType ?? ""),
      semanticType: column.semanticType,
    };
  });
  let rowNumberColumn = columns.find(isRowNumberColumn);
  if (!rowNumberColumn) {
    rowNumberColumn = {
      key: "index",
      label: "S.NO",
      className: "col-index",
      isHidden: false,
      isCessColumn: false,
      summarise: false,
      mergeable: undefined,
      dataType: "number",
      fxReturnType: "",
      semanticType: undefined,
    };
  } else {
    rowNumberColumn = {
      ...rowNumberColumn,
      label: "S.NO",
    };
  }

  // S.No always leads this template. Move the first visible field added via
  // Customize Columns directly after it, then retain the relative order of
  // every remaining API-provided column.
  const nonRowNumberColumns = columns.filter(
    (column: any) => !isRowNumberColumn(column)
  );
  const firstCustomColumn = nonRowNumberColumns.find(
    (column: any) => !column.isHidden && isCustomLineItemColumn(column)
  );
  columns = [
    rowNumberColumn,
    ...(firstCustomColumn ? [firstCustomColumn] : []),
    ...nonRowNumberColumns.filter(
      (column: any) => column !== firstCustomColumn
    ),
  ];

  const items = Array.isArray(enriched.invoice.items)
    ? enriched.invoice.items
    : [];
  const isWidgetGroupHeader = (itemValue: any): boolean => {
    const item = asRecord(itemValue);
    return optionalBoolean(item.group) === true;
  };
  const isWidgetGroupSubtotal = (itemValue: any): boolean => {
    const item = asRecord(itemValue);
    return optionalBoolean(item.isGroupItemTotalRow) === true;
  };
  const advanceOptions = {
    ...asRecord(payloadRecord.advanceOptions),
    ...asRecord(source.advanceOptions),
  };
  const templateOptions = {
    ...asRecord(payloadRecord.template),
    ...asRecord(source.template),
  };
  const pdfOptions = {
    ...asRecord(payloadRecord.pdfOptions),
    ...asRecord(templateOptions.pdfOptions),
    ...asRecord(source.pdfOptions),
  };
  const configuredDirection = normalizeKey(
    firstText(
      templateOptions.direction,
      templateOptions.textDirection,
      source.direction,
      source.textDirection
    )
  );
  const useRtl =
    firstBoolean(
      templateOptions.enableRtl,
      templateOptions.enableRTL,
      templateOptions.isRtl,
      templateOptions.isRTL,
      templateOptions.rightToLeft,
      source.enableRtl,
      source.enableRTL,
      source.isRtl,
      source.isRTL,
      source.rightToLeft
    ) ?? configuredDirection === "rtl";
  const hideFooter =
    firstBoolean(
      pdfOptions.hideFooter,
      templateOptions.hideFooter,
      source.hideFooter,
      payloadRecord.hideFooter
    ) ?? false;
  const explicitlyShowTotals = firstBoolean(
    advanceOptions.showTotals,
    source.showTotals
  );
  const explicitlyHideTotals = firstBoolean(
    advanceOptions.hideTotals,
    source.hideTotals
  );
  const showTotals =
    explicitlyShowTotals ??
    (explicitlyHideTotals === undefined
      ? mapped.mapped.visibility.showTotals
      : !explicitlyHideTotals);
  const { showTotalInWords } = enriched.mapped.visibility;
  const showHsnSummarySetting = firstBoolean(
    advanceOptions.showHSNSummaryInInvoice,
    advanceOptions.showHsnSummary,
    source.showHSNSummaryInInvoice,
    source.showHsnSummary
  );
  const showHsnSummary =
    enriched.sri.showHsnSummary && showHsnSummarySetting !== false;
  const mergeIdenticalAdjacentCells =
    firstBoolean(
      payloadRecord.mergeIdenticalAdjacentCells,
      source.mergeIdenticalAdjacentCells,
      advanceOptions.mergeIdenticalAdjacentCells,
      templateOptions.mergeIdenticalAdjacentCells
    ) ?? true;
  const showDescriptionsFullWidth =
    enriched.mapped.visibility.isDescriptionFullWidth &&
    !mergeIdenticalAdjacentCells;
  const showDescriptionsInline = !showDescriptionsFullWidth;
  const visibleColumns = columns.filter((column: any) => !column.isHidden);
  const identitySpanMap: RowSpanMap = items.map(
    (_item: any, rowIndex: number) =>
      Object.fromEntries(
        visibleColumns.map((column: any) => [
          String(column.key),
          {
            rowspan: 1,
            skip: false,
            ...(isKey(column, ["sr", "srno", "sno", "rownumber", "index"])
              ? { groupNumber: rowIndex + 1 }
              : {}),
          },
        ])
      )
  );
  const spanMap = mergeIdenticalAdjacentCells
    ? computeRowSpans(items, visibleColumns)
    : identitySpanMap;
  let visibleLineItemIndex = 0;
  const lineItems = items.map((item: any, rowIndex: number) => {
    const isGroupHeader = isWidgetGroupHeader(item);
    const isGroupSubtotal = isWidgetGroupSubtotal(item);
    const isRegularRow = !isGroupHeader && !isGroupSubtotal;
    const isAlternateRow = isRegularRow && visibleLineItemIndex % 2 === 0;
    if (isRegularRow) visibleLineItemIndex += 1;
    const description = firstText(asRecord(item).description);
    const displayDescription =
      description &&
      normalizeKey(description) !== normalizeKey(asRecord(item).name)
        ? description
        : "";
    const cells = visibleColumns.map((column: any) => {
      const span: RowSpanCell = spanMap[rowIndex][String(column.key)] ?? {
        rowspan: 1,
        skip: false,
      };
      const isDescription = isKey(column, ["item", "name", "description"]);
      const isRowNumber = isKey(column, [
        "sr",
        "srno",
        "sno",
        "rownumber",
        "index",
      ]);
      const isGroupingDate = isGroupingDateColumn(column);
      const keepStructuralRowspan =
        isRowNumber || isDescription || isGroupingDate;
      const spannedItems = items.slice(rowIndex, rowIndex + span.rowspan);
      return {
        column,
        item,
        ...span,
        rowspan: keepStructuralRowspan ? span.rowspan : 1,
        skip: keepStructuralRowspan ? span.skip : false,
        suppressValue: !keepStructuralRowspan && span.skip,
        isItemsEndCell: keepStructuralRowspan
          ? !span.skip && rowIndex + span.rowspan === items.length
          : rowIndex === items.length - 1,
        isRowNumber,
        descriptions:
          !span.skip && isDescription
            ? Array.from(
                new Map(
                  items
                    .slice(rowIndex, rowIndex + span.rowspan)
                    .map((entry: any) => {
                      const record = asRecord(entry);
                      const value = firstText(record.description);
                      return value &&
                        normalizeKey(value) !== normalizeKey(record.name)
                        ? value
                        : "";
                    })
                    .filter(Boolean)
                    .map((entryDescription: string) => [
                      entryDescription.trim().toLowerCase(),
                      entryDescription,
                    ])
                ).values()
              )
            : [],
        images:
          !span.skip && isDescription
            ? collectLineItemImages(spannedItems, ["images", "thumbnail"])
            : [],
        originalImages:
          !span.skip && isDescription
            ? collectLineItemImages(spannedItems, ["originalImages"])
            : [],
      };
    });
    const serialCell = cells.find((cell: any) => cell.isRowNumber);
    return {
      item,
      description: displayDescription,
      cells,
      isGroupHeader,
      isGroupSubtotal,
      groupLabel: firstText(
        asRecord(item).name,
        asRecord(item).label,
        asRecord(item).title,
        isGroupSubtotal ? "Sub total" : "Group"
      ),
      isAlternateRow,
      pageBreakBefore:
        optionalBoolean(item.pageBreakBefore) === true ||
        optionalBoolean(item[INTERNAL_PAGE_BREAK_FIELD]) === true,
      startsGroup: serialCell ? !serialCell.skip : true,
    };
  });
  const lineItemGroups: Array<{
    rows: typeof lineItems;
    isGroupHeader?: boolean;
    isGroupSubtotal?: boolean;
    label?: string;
    cells?: (typeof lineItems)[number]["cells"];
  }> = [];
  lineItems.forEach((lineItem: (typeof lineItems)[number]) => {
    if (lineItem.isGroupHeader) {
      lineItemGroups.push({
        rows: [lineItem],
        isGroupHeader: true,
        label: lineItem.groupLabel,
      });
      return;
    }
    if (lineItem.isGroupSubtotal) {
      lineItemGroups.push({
        rows: [lineItem],
        isGroupSubtotal: true,
        label: lineItem.groupLabel,
        cells: lineItem.cells,
      });
      return;
    }
    if (lineItem.startsGroup || !lineItemGroups.length) {
      lineItemGroups.push({ rows: [] });
    }
    const currentGroup = lineItemGroups[lineItemGroups.length - 1];
    if (currentGroup.isGroupHeader || currentGroup.isGroupSubtotal) {
      lineItemGroups.push({ rows: [lineItem] });
    } else {
      currentGroup.rows.push(lineItem);
    }
  });

  // Widget group headings and subtotal rows are structural and do not consume
  // a serial number. Number only the visible real-item groups in source order.
  let visibleItemNumber = 0;
  lineItemGroups.forEach((group) => {
    if (group.isGroupHeader || group.isGroupSubtotal || !group.rows.length) {
      return;
    }
    visibleItemNumber += 1;
    const serialCell = group.rows[0].cells.find(
      (cell: any) => cell.isRowNumber
    );
    if (serialCell) serialCell.groupNumber = visibleItemNumber;
  });
  const identity = documentIdentity(source);
  const compliance = mapComplianceDetails(
    payloadRecord,
    source,
    mapped,
    identity.key
  );
  const customLabels = asRecord(source.customLabels);
  const amountColumnLabel = firstText(
    columns.find((column: any) =>
      ["amount", "subtotal"].includes(normalizeKey(column.key))
    )?.label
  );
  const vaishnaviLabels = {
    transportDetails: firstText(
      customLabels.transportDetails,
      customLabels.transport,
      "Transport Details"
    ),
    ewayBillDetails: firstText(
      customLabels.ewayBillDetails,
      "Eway Bill Details"
    ),
    ewayBillNumber: firstText(
      customLabels.ewayBillNumber,
      customLabels.ewayBillNo,
      "Eway Bill No."
    ),
    ewayBillDate: firstText(customLabels.ewayBillDate, "Eway Bill Date"),
    ewayValidTillDate: firstText(
      customLabels.ewayValidTillDate,
      customLabels.validTillDate,
      "Valid Till Date"
    ),
    tableTotal: firstText(
      customLabels.tableTotal,
      amountColumnLabel,
      customLabels.subTotal,
      customLabels.subtotal,
      mapped.display.labels.subTotal,
      "TOTAL"
    ),
    summarySubTotal: firstText(
      customLabels.summarySubTotal,
      amountColumnLabel,
      customLabels.subTotal,
      customLabels.subtotal,
      mapped.display.labels.subTotal,
      "Sub Total"
    ),
    grandTotal: firstText(
      customLabels.grandTotal,
      customLabels.total,
      "GRAND TOTAL"
    ),
    summaryTotal: firstText(
      customLabels.summaryTotal,
      customLabels.total,
      mapped.display.labels.total,
      "Total"
    ),
    hideUpiDetails: firstText(customLabels.hideUpiDetails, "Hide UPI Details"),
    scanToPay: firstText(
      customLabels.scanToPay,
      customLabels.upiTitle,
      "Scan to pay via UPI"
    ),
    upiLimitMessage: firstText(
      source.upiLimitMessage,
      source.upiPaymentLimitMessage,
      customLabels.upiLimitMessage,
      customLabels.upiPaymentLimitMessage,
      "Maximum of 1 lakh can be transferred via upi in a single day"
    ),
    signaturePrefix: firstText(
      customLabels.signaturePrefix,
      customLabels.for,
      "For"
    ),
  };
  const showAppliedExchangeRate =
    firstBoolean(
      advanceOptions.showAppliedExchangeRate,
      source.showAppliedExchangeRate
    ) ?? false;
  const appliedExchangeRate = firstText(
    source.appliedExchangeRate,
    source.exchangeRate,
    source.currencyExchangeRate,
    source.conversionRate
  );
  const documentNumber = firstText(
    mapped.display.document.number,
    source.quotationNumber,
    source.invoiceNumber,
    source.proformaInvoiceNumber,
    source.salesOrderNumber,
    source.orderNumber,
    source.deliveryChallanNumber,
    source.purchaseOrderNumber,
    source.creditNoteNumber,
    source.debitNoteNumber,
    source.expenseNumber,
    source.documentNumber
  );
  const renderedInformationKeys = new Set(
    [...enriched.sri.documentRows, ...enriched.sri.informationRows].map(
      (row: any) => normalizeKey(row.key || row.label)
    )
  );
  const additionalInformationRows = collectionRecords(source.customHeaders)
    .map((field) => ({
      key: firstText(field.key, field.name, field.label),
      label: firstText(field.label, field.name, field.key),
      value: firstText(
        field.value,
        field.fieldValue,
        field.defaultValue,
        field.content,
        field.text
      ),
    }))
    .filter(
      (row) =>
        row.label &&
        row.value &&
        !renderedInformationKeys.has(normalizeKey(row.key || row.label)) &&
        !isHiddenDocumentRow(row)
    );
  const informationRows = [
    ...additionalInformationRows,
    ...enriched.sri.informationRows,
  ].filter((row) => !isHiddenDocumentRow(row));
  const showAdditionalInformation =
    Boolean(enriched.sri.additionalInformation) || informationRows.length > 0;
  const showClosingInformation =
    showAdditionalInformation || Boolean(enriched.sri.attachments.show);
  const showClosingLeft = Boolean(mapped.mapped.visibility.showBankUpiSection);
  const showClosingRight = Boolean(
    showTotals || showTotalInWords || mapped.mapped.visibility.showSignature
  );
  const finalTotal = asRecord(source.finalTotal);
  const mappedFinalTotal = asRecord(mapped.invoice.finalTotal);
  const summarySubTotal =
    optionalFiniteNumber(finalTotal.subTotal) ??
    optionalFiniteNumber(asRecord(source.totals).subTotal) ??
    optionalFiniteNumber(mapped.totals.subTotal) ??
    0;
  const summaryTotal =
    optionalFiniteNumber(finalTotal.total) ??
    optionalFiniteNumber(asRecord(source.totals).total) ??
    optionalFiniteNumber(mappedFinalTotal.total) ??
    0;
  const igstAmount =
    optionalFiniteNumber(finalTotal.igst) ??
    optionalFiniteNumber(mappedFinalTotal.igst) ??
    0;
  const cgstAmount =
    optionalFiniteNumber(finalTotal.cgst) ??
    optionalFiniteNumber(mappedFinalTotal.cgst) ??
    0;
  const sgstAmount =
    optionalFiniteNumber(
      enriched.mapped.visibility.isUtgst ? finalTotal.utgst : finalTotal.sgst
    ) ??
    optionalFiniteNumber(
      enriched.mapped.visibility.isUtgst
        ? mappedFinalTotal.utgst
        : mappedFinalTotal.sgst
    ) ??
    0;
  const taxableAmount = Math.max(
    0,
    summarySubTotal - finiteNumber(mapped.display.discountAmount)
  );
  const itemTaxRates = Array.from(
    new Set(
      items
        .filter(
          (item: any) =>
            !isWidgetGroupHeader(item) && !isWidgetGroupSubtotal(item)
        )
        .map((item: any) =>
          optionalFiniteNumber(
            asRecord(item).gstRate ??
              asRecord(item).taxRate ??
              asRecord(item).tax
          )
        )
        .filter((rate): rate is number => rate !== undefined)
    )
  );
  const hasMixedTaxRates = itemTaxRates.length > 1;
  const summaryTaxLabel = (label: any): string => {
    const text = firstText(label);
    return hasMixedTaxRates
      ? text.replace(/\s*\([^)]*%[^)]*\)\s*$/, "").trim()
      : text;
  };
  const summaryTaxLabels = {
    igst: summaryTaxLabel(mapped.display.labels.igst),
    cgst: summaryTaxLabel(mapped.display.labels.cgst),
    sgst: summaryTaxLabel(mapped.display.labels.sgst),
    utgst: summaryTaxLabel(mapped.display.labels.utgst),
  };
  const summaryCessRows = mapped.display.cessRows.filter((row: any) =>
    isNonZeroAmount(row.amount)
  );
  const hasNonZeroAdditionalCharge = mapped.display.additionalChargeRows.some(
    (row: any) => isNonZeroAmount(row.amount)
  );
  const hasNonZeroExtraTotal = mapped.display.extraTotalRows.some(
    (row: any) => row.isMonetary && isNonZeroAmount(row.value)
  );
  const showIgstSummary =
    mapped.mapped.visibility.showIgst && isNonZeroAmount(igstAmount);
  const showCgstSgstSummary =
    mapped.mapped.visibility.showCgstSgst &&
    (isNonZeroAmount(cgstAmount) || isNonZeroAmount(sgstAmount));
  // Match the source totals widget: a subtotal is useful only when a non-zero
  // adjustment separates it from the final total. Configured zero-value rows
  // (for example "Reductions") remain visible, but must not create redundant
  // Sub Total or GST (0%) rows.
  const showSummarySubTotal =
    isNonZeroAmount(mapped.display.discountAmount) ||
    showIgstSummary ||
    showCgstSgstSummary ||
    summaryCessRows.length > 0 ||
    hasNonZeroAdditionalCharge ||
    hasNonZeroExtraTotal ||
    Math.abs(summaryTotal - summarySubTotal) > 0.000001;
  const paidAmountLabel = firstText(customLabels.amountPaid, "Amount Paid");
  const summaryPaymentBalanceRows = mapped.display.paymentBalanceRows.map(
    (row: any) => {
      const normalizedLabel = normalizeKey(row.label);
      const isPaidAmount = [
        "amountpaid",
        "paidamount",
        "paid",
        normalizeKey(customLabels.amountPaid),
        normalizeKey(customLabels.paidAmount),
      ]
        .filter(Boolean)
        .includes(normalizedLabel);
      return {
        ...row,
        label: isPaidAmount ? paidAmountLabel : row.label,
      };
    }
  );
  const documentRows = enriched.sri.documentRows.filter(
    (row: any) => !isHiddenDocumentRow(row)
  );
  if (
    showAppliedExchangeRate &&
    appliedExchangeRate &&
    !documentRows.some((row: any) =>
      ["appliedexchangerate", "exchangerate", "currencyexchangerate"].includes(
        normalizeKey(row.key || row.label)
      )
    )
  ) {
    documentRows.push({
      key: "appliedExchangeRate",
      label: firstText(
        customLabels.appliedExchangeRate,
        customLabels.exchangeRate,
        "Applied Exchange Rate"
      ),
      value: appliedExchangeRate,
    });
  }

  // Country / Place of Supply are worked out in supply.ts with the renderer
  // normalizer's rules (country falls back to billedTo.country, GST codes
  // become state names), shown unless invoiceValueProps / show* / hide*
  // settings say otherwise. A row with a value stays in the markup, hidden
  // when off, so Lydia's live advance-options update can toggle it through
  // its data-ceres-*-of-supply hook.
  const countryValue = countryOfSupply(source);
  const placeValue = placeOfSupply(source);
  const supplyRows = [
    {
      supplyField: "country-of-supply",
      label: firstText(customLabels.countryOfSupply, "Country of Supply"),
      value: countryValue,
      isVisible: isSupplyFieldVisible(
        source,
        advanceOptions,
        "countryOfSupply",
        countryValue
      ),
      isCountry: true,
    },
    {
      supplyField: "place-of-supply",
      label: firstText(customLabels.placeOfSupply, "Place of Supply"),
      value: placeValue,
      isVisible: isSupplyFieldVisible(
        source,
        advanceOptions,
        "placeOfSupply",
        placeValue
      ),
      isCountry: false,
    },
  ].filter((row) => row.value);

  // The API keeps profile values the document does not show, e.g. phone with
  // phoneShowInInvoice: false, or a VAT number left on an Indian business. A
  // row is hidden when its <key>ShowInInvoice flag is false, and parties in
  // India show GSTIN/PAN but not the non-Indian tax IDs (VAT, TRN, TIN, SST).
  const NON_INDIAN_TAX_ID_KEYS = [
    "vatNumber",
    "trnNumber",
    "tinNumber",
    "sstNumber",
  ];
  const visiblePartyRows = (partyKey: string): any[] => {
    const party = asRecord(source[partyKey]);
    const isIndianParty = ["in", "india"].includes(normalizeKey(party.country));
    const rows = asRecord(mapped.display.partyDetails)[partyKey];
    return (Array.isArray(rows) ? rows : []).filter((row: any) => {
      const key = firstText(asRecord(row).key);
      if (!key) return true;
      if (isIndianParty && NON_INDIAN_TAX_ID_KEYS.includes(key)) return false;
      return optionalBoolean(party[`${key}ShowInInvoice`]) !== false;
    });
  };
  const partyDetails = {
    billedBy: visiblePartyRows("billedBy"),
    billedTo: visiblePartyRows("billedTo"),
    shippedFrom: visiblePartyRows("shippedFrom"),
    shippedTo: visiblePartyRows("shippedTo"),
  };

  return {
    ...mapped,
    invoice: {
      ...mapped.invoice,
      items,
      // Handlebars treats the string "false" as truthy. Normalize the flag
      // before passing the invoice to the RefrensBranding partial.
      showBranding:
        firstBoolean(
          payloadRecord.showBranding,
          source.showBranding,
          mapped.invoice.showBranding
        ) ?? false,
    },
    currency: enriched.currency,
    businessCurrency: enriched.businessCurrency,
    locale: enriched.locale,
    businessLocale: enriched.businessLocale,
    subUnitLength: enriched.subUnitLength,
    customCurrencySymbol: enriched.customCurrencySymbol,
    sri: {
      ...enriched.sri,
      showHsnSummary,
      transportRows: mapTransportRows(source),
    },
    vaishnavi: {
      labels: vaishnaviLabels,
      partyDetails,
      compliance,
      showLogisticsGrid:
        Boolean(asRecord(mapped.mapped.visibility).transport) ||
        compliance.ewayRows.length > 0 ||
        (compliance.showIrnSection && compliance.isIrnAbove),
      upiQr: mapped.display.upiQr,
      direction: useRtl ? "rtl" : "ltr",
      language: firstText(
        templateOptions.languageCode,
        templateOptions.locale,
        templateOptions.language,
        source.languageCode,
        source.locale
      ),
      script: firstText(
        templateOptions.languageScript,
        templateOptions.script,
        source.languageScript,
        source.script
      ),
      hideFooter,
      letterheadPolicy: enriched.mapped.visibility.letterHeadOnFirstPage
        ? "first"
        : "all",
      footerPolicy: enriched.mapped.visibility.footerOnLastPage
        ? "last"
        : "all",
      print: mapPrintAppearance(pdfOptions),
      documentRows,
      supplyRows,
      informationRows,
      showAdditionalInformation,
      showClosingInformation,
      showClosingGrid: showClosingLeft || showClosingRight,
      showClosingLeft,
      showClosingRight,
      closingGridSingleColumn: !(showClosingLeft && showClosingRight),
      taxableAmount,
      summarySubTotal,
      summaryTotal,
      igstAmount,
      cgstAmount,
      sgstAmount,
      summaryTaxLabels,
      showSummarySubTotal,
      showIgstSummary,
      showCgstSgstSummary,
      summaryCessRows,
      summaryPaymentBalanceRows,
    },
    lineItemGroups,
    mapped: {
      ...mapped.mapped,
      columns,
      visibility: {
        ...mapped.mapped.visibility,
        isDescriptionFullWidth:
          enriched.mapped.visibility.isDescriptionFullWidth,
        showDescriptionsInline,
        showDescriptionsFullWidth,
        showSerialNumbersInDescription:
          enriched.mapped.visibility.showSerialNumbersInDescription,
        showTotals,
        showTotalsRow: showTotals && enriched.mapped.visibility.showTotalsRow,
        showTotalInWords,
        showTableFooter: showTotals || showTotalInWords,
        mergeIdenticalAdjacentCells,
        visibleColumnCount: visibleColumns.length,
        totalLabelColumnSpan: Math.max(visibleColumns.length - 1, 1),
      },
    },
    display: {
      ...mapped.display,
      document: {
        ...mapped.display.document,
        number: documentNumber,
        subtitle: firstText(source.invoiceSubTitle, source.documentSubTitle),
        labels: {
          ...mapped.display.document.labels,
          number: firstText(
            customLabels[`${identity.key}Number`],
            `${identity.base} No`
          ),
          date: firstText(
            customLabels[`${identity.key}Date`],
            `${identity.base} Date`
          ),
        },
      },
    },
  };
};

export type VaishnaviTemplateState = ReturnType<
  typeof mapVaishnaviTemplateData
>;
