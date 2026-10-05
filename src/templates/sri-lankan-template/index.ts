import template from "./template.hbs";
import {
  formatSriPercentage,
  mapSriLankanTemplateData,
  registerSriLankanPrintMode,
  formatCountryName,
  formatQuantityWithUnit,
  formatSrTradingCurrencyMarkup,
  getItemColumnValue,
  getItemSerialNumbers,
  getItemSku,
  getItemUnit,
  getPartyAddressLines,
  shouldShowItemSku,
  summarizeItemQuantity,
} from "./helpers";
import "./styles.css";

import "../../widgets/invoice-status";
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
    String(record.dataType ?? "").toLowerCase() === "currency" ||
    String(record.fxReturnType ?? "").toLowerCase() === "currency" ||
    [
      "rate",
      "unitrate",
      "unitprice",
      "price",
      "amount",
      "subtotal",
      "total",
      "tax",
      "taxamount",
      "vatamount",
      "gstamount",
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
  hb.registerHelper("partyAddressLines", getPartyAddressLines);
  hb.registerHelper("formatCountryName", formatCountryName);
  hb.registerHelper("itemColumnValue", getItemColumnValue);
  hb.registerHelper("itemSerialNumbers", getItemSerialNumbers);
  hb.registerHelper("itemSku", getItemSku);
  hb.registerHelper("showItemSku", shouldShowItemSku);
  hb.registerHelper("formatTotalQuantity", summarizeItemQuantity);
  hb.registerHelper("itemUnit", getItemUnit);
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
    isColumn(column, [
      "gstrate",
      "taxrate",
      "cessrate",
      "discount",
      "discountrate",
      "discountpercent",
      "discountpercentage",
    ])
  );
  hb.registerHelper("isBooleanColumn", (column: any) =>
    ["boolean", "bool"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  hb.registerHelper("formatBoolean", (value: any) => (value ? "Yes" : "No"));
  hb.registerHelper(
    "hasValue",
    (value: any) =>
      value !== null && value !== undefined && String(value).trim() !== ""
  );
  hb.registerHelper("formatSriPercentage", formatSriPercentage);
  hb.registerHelper(
    "sameText",
    (left: any, right: any) =>
      String(left ?? "")
        .trim()
        .toLowerCase() ===
      String(right ?? "")
        .trim()
        .toLowerCase()
  );
  hb.registerHelper(
    "formatSriCurrency",
    (amount: any, invoice: any) =>
      new hb.SafeString(formatSrTradingCurrencyMarkup(amount, invoice))
  );
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
  registerSriLankanPrintMode();

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

// Live letterhead updates only reach the first footer image (the fixed print
// footer). Mirror its image and empty state onto the hidden <tfoot> copy that
// reserves the footer's height on every printed page.
const syncFooterSpacer = (): void => {
  const footer = document.querySelector(
    ".sri-lankan-invoice .page-footer-fixed"
  );
  const spacer = document.querySelector(
    ".sri-lankan-invoice .page-footer-spacer"
  );
  if (!(footer instanceof HTMLElement) || !(spacer instanceof HTMLElement)) {
    return;
  }
  const source = footer.querySelector("img")?.getAttribute("src");
  const spacerImage = spacer.querySelector("img");
  if (spacerImage && source && spacerImage.getAttribute("src") !== source) {
    spacerImage.setAttribute("src", source);
  } else if (spacerImage && !source && spacerImage.hasAttribute("src")) {
    spacerImage.removeAttribute("src");
  }
  const isEmpty = footer.classList.contains("is-empty");
  if (spacer.classList.contains("is-empty") !== isEmpty) {
    spacer.classList.toggle("is-empty", isEmpty);
  }
};

if (
  typeof document !== "undefined" &&
  typeof MutationObserver !== "undefined"
) {
  new MutationObserver(syncFooterSpacer).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "class"],
  });
}
