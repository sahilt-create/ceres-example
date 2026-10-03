import template from "./template.hbs";
import { normalizeInvoiceTemplateState } from "../../main/invoiceTemplateNormalization";
import { registerModernManufacturingHelpers } from "./helpers";
import "./styles.css";
// Register only the widgets template.hbs uses.
import "../../widgets/date-time";
import "../../widgets/markdown-viewer";
import "../../widgets/currency-format";
import "../../widgets/image";
import "../../widgets/subtotal";
import "../../widgets/tax-summary";
import "../../widgets/payment-table";
import "../../widgets/refrens-branding";
import "../../widgets/watermark";

registerModernManufacturingHelpers(window.Handlebars);

// Export template to global for main renderer to consume
window.CeresTemplateDataMapper = normalizeInvoiceTemplateState as any;
window.CeresTemplate = template;
