import template from "./template.hbs";
import {
  isSrPartyFieldVisible,
  mapSrTradingTemplateData,
} from "../sr-trading-2-0.mapper";
import {
  formatCountryName,
  formatQuantityWithUnit,
  formatSrTradingCurrency,
  getItemColumnValue,
  getItemSku,
  getItemSerialNumbers,
  getItemUnit,
  getPartyAddressLines,
  shouldShowItemSku,
  solvinTaxAmountInWords,
  summarizeItemQuantity,
  toTitleCaseWords,
} from "../helpers";
import amountInWords from "../../widgets/shared/amountInWords";
import { registerSrTradingPrintFit } from "../sr-trading-2-0.printFit";
import { registerSrTradingLydiaUpdates } from "../sr-trading-2-0.lydia";
import "./styles.css";

import "../../widgets/date-time";
import "../../widgets/markdown-viewer";
import "../../widgets/refrens-branding";
import "../../widgets/phone-number";
import "../../widgets/watermark";

type UnknownRecord = Record<string, any>;
const asRecord = (value: any): UnknownRecord =>
  value && typeof value === "object" ? value : {};
const hasDisplayValue = (value: any): boolean =>
  value !== undefined &&
  value !== null &&
  (typeof value !== "string" || value.trim().length > 0);
const optionalNumberValue = (value: any): number | undefined => {
  const parsed = Number(String(value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(parsed) && hasDisplayValue(value) ? parsed : undefined;
};
const numberValue = (value: any): number => optionalNumberValue(value) ?? 0;
const optionalBoolean = (value: any): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
};
const normalizedName = (value: any): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const columnKey = (column: any): string => normalizedName(asRecord(column).key);
const isKey = (column: any, keys: string[]): boolean =>
  keys.includes(columnKey(column));
const itemNameValue = (itemValue: any, columnValue: any): any => {
  const item = asRecord(itemValue);
  const key = columnKey(columnValue);
  if (["item", "name", "description"].includes(key)) {
    return item.name ?? item.title ?? getItemColumnValue(item, columnValue);
  }
  return getItemColumnValue(item, columnValue);
};
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
      "cgst",
      "sgst",
      "utgst",
      "igst",
      "cess",
      "cessamount",
    ].includes(columnKey(column))
  );
};
const isDateColumn = (column: any): boolean => {
  const record = asRecord(column);
  const dataType = String(
    record.dataType ?? record.fxReturnType ?? record.semanticType ?? ""
  ).toLowerCase();
  const key = columnKey(column);

  return (
    ["date", "datetime", "timestamp"].includes(dataType) ||
    key === "date" ||
    key.endsWith("date")
  );
};

const hb = (window as any).Handlebars;
if (hb) {
  hb.registerHelper("addOne", (index: any) => numberValue(index) + 1);
  hb.registerHelper("amountInWords", (amount: any) =>
    amountInWords(numberValue(amount))
  );
  hb.registerHelper("titleCaseWords", toTitleCaseWords);
  hb.registerHelper("srTaxAmountInWords", (amount: any, invoice: any) =>
    solvinTaxAmountInWords(amount, invoice)
  );
  hb.registerHelper("partyAddressLines", getPartyAddressLines);
  hb.registerHelper("formatCountryName", formatCountryName);
  hb.registerHelper("formatSrCurrency", formatSrTradingCurrency);
  hb.registerHelper("formatDeductionCurrency", (value: any, invoice: any) =>
    formatSrTradingCurrency(-Math.abs(numberValue(value)), invoice)
  );
  hb.registerHelper("partyFieldVisible", isSrPartyFieldVisible);
  hb.registerHelper("partyEntryVisible", (value: any) => {
    const entry = asRecord(value);
    const shown =
      optionalBoolean(entry.showInInvoice) ??
      optionalBoolean(asRecord(entry.params).showInInvoice);
    if (shown === false) return false;
    const hidden =
      optionalBoolean(entry.isHidden) ??
      optionalBoolean(entry.hideInInvoice) ??
      optionalBoolean(asRecord(entry.params).isHidden) ??
      optionalBoolean(asRecord(entry.params).hideInInvoice);
    return hidden !== true;
  });
  hb.registerHelper("itemColumnValue", getItemColumnValue);
  hb.registerHelper("itemNameValue", itemNameValue);
  hb.registerHelper("itemSku", getItemSku);
  hb.registerHelper("showItemSku", shouldShowItemSku);
  hb.registerHelper("itemSerialNumbers", getItemSerialNumbers);
  hb.registerHelper("itemUnit", getItemUnit);
  hb.registerHelper("itemHsn", (item: any) =>
    String(
      asRecord(item).hsn ?? asRecord(item).sac ?? asRecord(item).hsnCode ?? ""
    )
  );
  hb.registerHelper("isRowNumberColumn", (column: any) =>
    isKey(column, ["sr", "srno", "sno", "rownumber", "index"])
  );
  hb.registerHelper("isDescriptionColumn", (column: any) =>
    isKey(column, ["item", "name", "description"])
  );
  hb.registerHelper("isQuantityColumn", (column: any) =>
    isKey(column, ["quantity", "qty"])
  );
  hb.registerHelper("isRateColumn", (column: any) =>
    isKey(column, ["rate", "unitrate", "unitprice", "price"])
  );
  hb.registerHelper("isUnitColumn", (column: any) =>
    isKey(column, ["unit", "uom", "unitname"])
  );
  hb.registerHelper("isHsnColumn", (column: any) =>
    isKey(column, ["hsn", "sac", "hsncode", "hsnsac"])
  );
  hb.registerHelper("isDateColumn", isDateColumn);
  hb.registerHelper("isCurrencyColumn", isCurrencyColumn);
  hb.registerHelper("isAmountColumn", (column: any) =>
    isKey(column, ["amount", "subtotal"])
  );
  hb.registerHelper("isTotalColumn", (column: any) => isKey(column, ["total"]));
  hb.registerHelper(
    "isPercentageColumn",
    (column: any) =>
      asRecord(column).semanticType === "percentage" ||
      isKey(column, ["gstrate", "taxrate", "cessrate"])
  );
  hb.registerHelper("isBooleanColumn", (column: any) =>
    ["boolean", "bool"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  hb.registerHelper("isNumericColumn", (column: any) =>
    ["number", "numeric", "decimal", "integer"].includes(
      String(asRecord(column).dataType ?? "").toLowerCase()
    )
  );
  hb.registerHelper("formatBoolean", (value: any) => (value ? "Yes" : "No"));
  hb.registerHelper("hasDisplayValue", hasDisplayValue);
  hb.registerHelper("formatSrBoolean", (value: any) => {
    const parsed = optionalBoolean(value);
    if (parsed === undefined) return "";
    return parsed ? "Yes" : "No";
  });
  hb.registerHelper(
    "formatItemNumber",
    (item: any, column: any, invoiceValue: any) => {
      const invoice = asRecord(invoiceValue);
      return numberValue(getItemColumnValue(item, column)).toLocaleString(
        invoice.locale || invoice.businessLocale || "en-IN",
        { maximumFractionDigits: Number(invoice.subUnitLength ?? 2) }
      );
    }
  );
  hb.registerHelper(
    "quantityWithUnit",
    (item: any, invoice: any, showUnit: any) =>
      formatQuantityWithUnit(item, showUnit, invoice)
  );
  hb.registerHelper("quantityOnly", (item: any, invoice: any) =>
    formatQuantityWithUnit(item, false, invoice)
  );
  hb.registerHelper("formatTotalQuantity", summarizeItemQuantity);
  hb.registerHelper("columnSummaryValue", (items: any[], column: any) =>
    (Array.isArray(items) ? items : []).reduce((sum, item) => {
      const record = asRecord(item);
      if (
        record.isGroupItemTotalRow ||
        record.isAdditionalCharge ||
        record.group
      ) {
        return sum;
      }
      return sum + numberValue(getItemColumnValue(item, column));
    }, 0)
  );
  hb.registerHelper(
    "columnRateSummaryValue",
    (items: any[], column: any, invoiceValue: any) => {
      const invoice = asRecord(invoiceValue);
      const rates = (Array.isArray(items) ? items : [])
        .filter((item) => {
          const record = asRecord(item);
          return (
            !record.isGroupItemTotalRow &&
            !record.isAdditionalCharge &&
            !record.group
          );
        })
        .map((item) => optionalNumberValue(getItemColumnValue(item, column)))
        .filter((rate): rate is number => rate !== undefined);
      return [...new Set(rates)]
        .map((rate) =>
          rate.toLocaleString(
            invoice.locale || invoice.businessLocale || "en-IN",
            {
              maximumFractionDigits: Number(invoice.subUnitLength ?? 2),
            }
          )
        )
        .map((rate) => `${rate}%`)
        .join(", ");
    }
  );
  hb.registerHelper("columnAlignmentClass", (column: any) => {
    if (isDateColumn(column)) return "align-left is-date-column";
    return isCurrencyColumn(column) ||
      ["number", "numeric", "decimal", "integer"].includes(
        String(asRecord(column).dataType ?? "").toLowerCase()
      )
      ? "align-right"
      : "align-left";
  });
}

window.CeresTemplateDataMapper = mapSrTradingTemplateData as any;
window.CeresTemplate = template;
registerSrTradingPrintFit();
registerSrTradingLydiaUpdates();
