import template from "./template.hbs";
import { normalizeInvoiceTemplateState } from "../../main/invoiceTemplateNormalization";
import {
  loadScriptFont,
  registerModernManufacturingHelpers,
  registerModernManufacturingPrint,
  setModernManufacturingStylesheetText,
  withDocumentScript,
  withMoneyDefaults,
  withRefrensDefaults,
} from "./helpers";
// eslint-disable-next-line import/no-duplicates
import "./styles.css";
// The same CSS as text, for print measurements (helpers withReadableStylesheet).
// eslint-disable-next-line import/no-duplicates
import mmCss from "./styles.css?raw";
// Register only the widgets template.hbs uses.
import "../../widgets/date-time";
import "../../widgets/markdown-viewer";
import "../../widgets/currency-format";
import "../../widgets/image";
import "../../widgets/subtotal";
import "../../widgets/tax-summary";
import "../../widgets/payment-table";
import "../../widgets/refrens-branding";
import "../../widgets/phone-number";
import "../../widgets/invoice-status";
import "../../widgets/watermark";

setModernManufacturingStylesheetText(mmCss);
registerModernManufacturingHelpers(window.Handlebars);
registerModernManufacturingPrint();

// Export template to global for main renderer to consume
// Refrens' unit default, the shared normalizer, then the document's decimal places made explicit and its language,
// script and direction (Lydia's "Change Script") read, with the script's font (helpers.ts).
window.CeresTemplateDataMapper = ((
  payload: Parameters<typeof normalizeInvoiceTemplateState>[0]
) => {
  const state = withDocumentScript(
    withMoneyDefaults(
      normalizeInvoiceTemplateState(withRefrensDefaults(payload))
    ),
    payload
  );
  loadScriptFont(state.documentScript?.font ?? "");
  return state;
}) as any;
window.CeresTemplate = template;
