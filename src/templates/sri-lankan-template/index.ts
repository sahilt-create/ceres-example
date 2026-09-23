import template from "./template.hbs";
import { mapSriLankanTemplateData } from "./mapper";
import {
  formatCountryName,
  formatQuantityWithUnit,
  formatSrTradingCurrency,
  getItemColumnValue,
  getItemUnit,
  getPartyAddressLines,
} from "../helpers";
import "./styles.css";

import "../../widgets/demo-badge";
import "../../widgets/date-time";
import "../../widgets/markdown-viewer";
import "../../widgets/watermark";
import "../../widgets/refrens-branding";
import "../../widgets/phone-number";
import "../../widgets/tax-summary";
import "../../widgets/hsn-summary";
import "../../widgets/payment-table";
import "../../widgets/currency-format";
import "../../widgets/image";

type UnknownRecord = Record<string, any>;

const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const numberValue = (value: any): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value ?? "").match(/-?\d[\d,]*(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, "")) || 0 : 0;
};

const normalizedKey = (column: any): string =>
  String(asRecord(column).key ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const isColumn = (column: any, keys: string[]): boolean =>
  keys.includes(normalizedKey(column));

const isCurrencyColumn = (column: any): boolean => {
  const record = asRecord(column);
  return (
    record.semanticType === "currency" ||
    String(record.fxReturnType ?? "").toLowerCase() === "currency" ||
    [
      "rate",
      "unitrate",
      "unitprice",
      "price",
      "amount",
      "subtotal",
      "total",
      "discount",
      "tax",
      "igst",
      "cgst",
      "sgst",
      "utgst",
      "cess",
      "cessamount",
    ].includes(normalizedKey(column))
  );
};

const isDateColumn = (column: any): boolean => {
  const record = asRecord(column);
  const type = String(
    record.dataType ?? record.fxReturnType ?? record.semanticType ?? ""
  ).toLowerCase();
  return (
    ["date", "datetime", "timestamp"].includes(type) ||
    normalizedKey(column).endsWith("date")
  );
};

const hb = (window as any).Handlebars;
if (hb) {
  hb.registerHelper("addOne", (value: any) => numberValue(value) + 1);
  hb.registerHelper("partyAddressLines", getPartyAddressLines);
  hb.registerHelper("formatCountryName", formatCountryName);
  hb.registerHelper("itemColumnValue", getItemColumnValue);
  hb.registerHelper("itemUnit", getItemUnit);
  hb.registerHelper("isRowNumberColumn", (column: any) =>
    isColumn(column, ["sr", "srno", "sno", "rownumber", "index"])
  );
  hb.registerHelper("isDescriptionColumn", (column: any) =>
    isColumn(column, ["item", "name", "description"])
  );
  hb.registerHelper("isQuantityColumn", (column: any) =>
    isColumn(column, ["quantity", "qty"])
  );
  hb.registerHelper("isUnitColumn", (column: any) =>
    isColumn(column, ["unit", "uom", "unitname"])
  );
  hb.registerHelper("isCurrencyColumn", isCurrencyColumn);
  hb.registerHelper("isDateColumn", isDateColumn);
  hb.registerHelper("isPercentageColumn", (column: any) =>
    isColumn(column, ["gstrate", "taxrate", "cessrate"])
  );
  hb.registerHelper("isBooleanColumn", (column: any) =>
    ["boolean", "bool"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  hb.registerHelper("formatBoolean", (value: any) => (value ? "Yes" : "No"));
  hb.registerHelper("formatSriCurrency", formatSrTradingCurrency);
  hb.registerHelper(
    "quantityWithUnit",
    (item: any, invoice: any, showUnit: any) =>
      formatQuantityWithUnit(item, showUnit, invoice)
  );
  hb.registerHelper("columnAlignmentClass", (column: any) =>
    isCurrencyColumn(column) ||
    ["number", "numeric", "decimal", "integer"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
      ? "number-cell"
      : "text-cell"
  );
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "error",
    (event) => {
      const { target } = event;
      if (!(target instanceof HTMLImageElement)) return;
      const qrBox = target.closest(".sri-lankan-invoice .qr-box");
      if (qrBox instanceof HTMLElement) qrBox.style.display = "none";
    },
    true
  );
}

window.CeresTemplateDataMapper = mapSriLankanTemplateData as any;
window.CeresTemplate = template;
