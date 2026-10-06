/*
 * Fixtures for the Modern Manufacturing layout tests (INVOICE_TEMPLATE_SPEC_v2.pdf, section 8).
 *
 * The template is data-driven: every prototype setting in the spec's section 6 is expressed as
 * the invoice data (or the document's template setting) that produces it —
 *   themeColor                        → template.primaryColor
 *   showTransport / transportPosition → transportDetails present / template.transportPosition
 *   showShippedFrom                   → shippedFrom.name present
 *   showBankDetails / showUpiDetails  → paymentOptions.accountTransfer / paymentOptions.upi
 *   showBankSection off               → neither payment option
 *   showTerms1 / showTerms2           → terms[0] / terms[1]
 *   showNotes / notesPosition         → notes / template.notesPosition
 *   showAdditionalInfo / fields       → customFields
 *   showAttachments                   → attachments
 *   showHsnSummary                    → advanceOptions.showHsnSummary
 *   showSignatureImage                → signature (an image)
 *   columns.*                         → the account's columns[] (isHidden), batch / unit options
 *   taxType inter                     → igst: true
 *   imageBeside / imageLarge / below  → items[n].thumbnail / originalImages / images
 *   descriptionFullWidth              → advanceOptions.isDescriptionFullWidth
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(
  fs.readFileSync(
    path.join(here, "../../tests/fixtures/modern-manufacturing-template.json"),
    "utf8"
  )
);

const NOTES = [
  "310 mm dia, grey cast iron FG 260. Drawing VF-2231 Rev C, bore finish Ra 1.6, dynamically balanced.",
  "Two-stage reducer, SG iron 500/7. Drawing VF-1840 Rev A, pressure tested at 6 bar.",
  "End suction 80×65-160, CF8M stainless steel. Hydro tested at 16 bar, test certificate TC-0921 attached.",
  "Gate valve DN50 PN16, WCB cast steel. Radiography Level 2, shot blasted and primed.",
  "ASTM A105 forged. Raised face, serrated finish 125–250 AARH.",
  "Grey iron FG 260. Machined bore H8, supplied without bearing.",
  "Jaw type, size 125, SG iron. Pilot bored, keyway to customer drawing AE-552.",
  "6 vanes, CF8M stainless steel. Statically balanced to ISO 1940 G6.3.",
];

const TERMS_2 = [
  "Goods travel at the buyer's risk; transit insurance is arranged by the buyer unless agreed in writing.",
  "Shortage or damage must be reported within 7 days of receipt, with photographs and the LR copy.",
  "Rejections are accepted only against a written inspection report quoting the batch number.",
  "Dimensional deviations within drawing tolerance are not grounds for rejection.",
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const column = (key, label, extra = {}) => ({
  key,
  label,
  dataType: "number",
  ...extra,
});

/* The account's column set; Item Code and GST % start hidden (spec §6 defaults). */
const ACCOUNT_COLUMNS = [
  { key: "name", label: "Description of Goods", dataType: "text" },
  { key: "itemCode", label: "Item Code", dataType: "text", isHidden: true },
  { key: "hsn", label: "HSN/SAC", dataType: "text" },
  column("quantity", "Qty"),
  column("rate", "Rate"),
  column("discount", "Discount"),
  column("amount", "Taxable"),
  column("gstRate", "GST %", { isHidden: true }),
  column("cgst", "CGST"),
  column("sgst", "SGST"),
  column("igst", "IGST"),
  column("total", "Amount"),
];

const image = (origin, name) => `${origin}/__fixtures__/img/${name}.png`;

/* The Figma sample with the spec's default settings (A2). */
export const defaultInvoice = () => {
  const payload = clone(base);
  const { invoice } = payload;
  invoice.columns = clone(ACCOUNT_COLUMNS);
  invoice.advanceOptions = {
    hsnView: "SPLIT",
    unitColumn: "SEPARATE",
    showHsnSummary: true,
    taxSummaryView: "DEFAULT",
    showThumbnailAsColumn: true,
  };
  invoice.billedTo.gstin = "27AABCA1234F1Z2";
  invoice.billedTo.panNumber = "AABCA1234F";
  invoice.shippedTo.phone = "+91 20 6712 4400";
  invoice.shippedTo.email = "stores.plant2@alphaeng.in";
  invoice.items = invoice.items.map((item, index) => ({
    ...item,
    itemCode: `VF-${1001 + index}`,
  }));
  invoice.terms = [
    clone(invoice.terms[0]),
    { label: "Terms & Conditions", terms: clone(TERMS_2) },
  ];
  invoice.paymentOptions = { accountTransfer: true, upi: true };
  invoice.upi = { upi: "foobarlabs@okhdfc" };
  return payload;
};

const setColumns = (invoice, visible) => {
  invoice.columns = invoice.columns.map((entry) => ({
    ...entry,
    isHidden: entry.key !== "name" && !visible.includes(entry.key),
  }));
};

const withDiscount = (invoice) => {
  invoice.finalTotal.discount = 980;
  invoice.items[2].discount = 980;
};

const SHIPPED_FROM = {
  name: "Vertex Foundry Components – Dispatch Yard",
  street: "Plot No. 58, Udyambag Industrial Estate",
  city: "Belagavi",
  pincode: "590008",
  state: "Karnataka",
  country: "IN",
  gstin: "29AAVFV1234H1Z5",
  panNumber: "AAVFV1234H",
};

const CASES = {
  A1: (invoice) => {
    invoice.items = invoice.items.slice(0, 1);
  },
  A2: () => {},
  A3: (invoice) => {
    const { items } = invoice;
    invoice.items = Array.from({ length: 40 }, (_, index) => ({
      ...clone(items[index % items.length]),
      _id: `a3-${index}`,
    }));
  },
  B1: (invoice) => {
    invoice.items.forEach((item, index) => {
      item.description = NOTES[index];
    });
  },
  B2: (invoice) => {
    invoice.billedTo.name =
      "Alpha Engineering and Precision Fabrication Works Private Limited – Chakan Unit";
    invoice.billedTo.street =
      "Plot No. A-215 and A-216, Behind Mahindra Vendor Park, MIDC Industrial Area Phase II, Chakan, Taluka Khed";
    invoice.shippedTo.name =
      "Alpha Engineering and Precision Fabrication Works Private Limited – Plant 2, Nighoje";
    invoice.shippedTo.street =
      "Gat No. 789 and 790, Village Nighoje, Near Chakan–Talegaon Road, Taluka Khed, Pune District";
  },
  B3: (invoice) => {
    const seven = (list) =>
      Array.from({ length: 7 }, (_, index) => list[index % list.length]);
    invoice.terms = [
      { label: "Terms & Conditions", terms: seven(invoice.terms[0].terms) },
      { label: "Terms & Conditions", terms: seven(TERMS_2) },
    ];
  },
  B4: (invoice) => {
    invoice.items[0].description = `Code ${"X9".repeat(30)} applies.`;
  },
  B5: (invoice) => {
    invoice.customFields = Array.from({ length: 10 }, (_, index) => ({
      label: `Reference ${index + 1}`,
      value:
        index % 2 === 0
          ? `Dispatch against PO/450789 dated 15-Sep-2026, inspection by third party agency before loading, line ${
              index + 1
            }`
          : `Short value ${index + 1}`,
      dataType: "text",
      params: { showInInvoice: true },
    }));
  },
  C1: (invoice) => {
    invoice.template = { transportPosition: "section" };
    invoice.shippedFrom = clone(SHIPPED_FROM);
  },
  C2: (invoice) => {
    invoice.transportDetails = {};
    invoice.irn = {};
  },
  C3: (invoice) => {
    invoice.paymentOptions = {};
  },
  C4: (invoice) => {
    invoice.paymentOptions = { accountTransfer: false, upi: true };
  },
  C5: (invoice) => {
    invoice.paymentOptions = { accountTransfer: true, upi: false };
  },
  C6: (invoice) => {
    invoice.terms = [];
  },
  C7: (invoice) => {
    invoice.template = { notesPosition: "row" };
    invoice.items = invoice.items.slice(0, 3);
  },
  C8: (invoice) => {
    invoice.customFields = [];
  },
  C9: (invoice) => {
    invoice.customFields = [];
    invoice.attachments = [];
  },
  C10: (invoice) => {
    invoice.transportDetails = {};
    invoice.irn = {};
    invoice.paymentOptions = {};
    invoice.terms = [];
    invoice.notes = "";
    invoice.customFields = [];
    invoice.attachments = [];
    invoice.advanceOptions.showHsnSummary = false;
  },
  C11: (invoice, origin) => {
    invoice.signature = image(origin, "thumb");
  },
  D1: () => {},
  D2: (invoice) => {
    setColumns(invoice, [
      "itemCode",
      "hsn",
      "quantity",
      "rate",
      "discount",
      "amount",
      "gstRate",
      "cgst",
      "sgst",
      "total",
    ]);
    withDiscount(invoice);
  },
  D3: (invoice) => {
    setColumns(invoice, ["amount", "total"]);
    invoice.advanceOptions.showBatchColumnsInInvoice = false;
  },
  D4: (invoice) => {
    invoice.igst = true;
    invoice.placeOfSupply = "29";
    invoice.items.forEach((item) => {
      item.igst = item.cgst + item.sgst;
      item.cgst = 0;
      item.sgst = 0;
    });
    invoice.finalTotal.igst = invoice.finalTotal.cgst + invoice.finalTotal.sgst;
    invoice.finalTotal.cgst = 0;
    invoice.finalTotal.sgst = 0;
    invoice.hsnSummary.forEach((row) => {
      row.igst = row.cgst + row.sgst;
      row.cgst = 0;
      row.sgst = 0;
    });
  },
  D5: (invoice) => {
    invoice.items[0].quantity = 98765;
    invoice.items[0].rate = 1100.5;
    invoice.items[0].amount = 108690882.5;
    invoice.items[0].cgst = 9782179.43;
    invoice.items[0].sgst = 9782179.43;
    invoice.items[0].total = 128255241.36;
    invoice.finalTotal.subTotal = 108792347.5;
    invoice.finalTotal.amount = 108792347.5;
    invoice.finalTotal.cgst = 9791311.28;
    invoice.finalTotal.sgst = 9791311.28;
    invoice.finalTotal.total = 1234567890;
  },
  E1: (invoice, origin) => {
    invoice.items.forEach((item) => {
      item.thumbnail = image(origin, "thumb");
    });
  },
  E2: (invoice, origin) => {
    const counts = [1, 4, 10];
    invoice.items.forEach((item, index) => {
      item.images = Array.from({ length: counts[index % 3] }, () =>
        image(origin, "thumb")
      );
    });
  },
  E3: (invoice, origin) => {
    CASES.D2(invoice);
    invoice.items[0].originalImages = [image(origin, "large")];
  },
  T1: (invoice) => {
    invoice.template = { primaryColor: "#ff6900" };
  },
};

export const CASE_IDS = Object.keys(CASES);

export const buildCase = (id, origin) => {
  const edit = CASES[id];
  if (!edit) return null;
  const payload = defaultInvoice();
  edit(payload.invoice, origin);
  return payload;
};
