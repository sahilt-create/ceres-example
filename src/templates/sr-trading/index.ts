// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - template compiled by loader
import template from "./template.hbs";
import "./styles.css";

import "../../widgets/markdown-viewer";
import "../../widgets/date-time";
import "../../widgets/currency-format";
import amountInWordsFn from "../../widgets/shared/amountInWords";

const hb = (window as any).Handlebars;
if (hb) {
  hb.registerHelper("addOne", (index: number) => index + 1);
  hb.registerHelper("amountInWords", (amount: any) => {
    return amountInWordsFn(parseFloat(amount) || 0);
  });
}

window.CeresTemplate = template;
