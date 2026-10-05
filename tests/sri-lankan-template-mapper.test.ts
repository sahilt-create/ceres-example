import {
  formatSriPercentage,
  formatSrTradingCurrencyMarkup,
  getItemColumnValue,
  mapSriLankanTemplateData,
} from "../src/templates/sri-lankan-template/helpers";

const payload = () => ({
  invoice: {
    invoiceNumber: "INV-LK-1",
    invoiceDate: "2026-09-14",
    currency: "INR",
    taxName: "VAT",
    taxType: "GLOBAL",
    billedBy: {
      name: "Seller",
      city: "Mumbai",
      state: "Maharashtra",
      country: "IN",
    },
    billedTo: { name: "Buyer", city: "Colombo", country: "LK" },
    items: [
      {
        name: "Implementation",
        description: "A".repeat(220),
        rate: 100,
        amount: 100,
        gstRate: 18,
        tax: 18,
        total: 118,
      },
      {
        name: "Support",
        rate: 200,
        amount: 200,
        gstRate: 8,
        tax: 16,
        total: 216,
      },
    ],
    columns: [
      { key: "item", label: "Description" },
      { key: "rate", label: "Amount", dataType: "currency" },
      { key: "amount", label: "Amount", dataType: "currency" },
      { key: "gstRate", label: "VAT Rate", dataType: "percentage" },
      { key: "tax", label: "VAT", dataType: "currency" },
      { key: "total", label: "Total", dataType: "currency" },
    ],
    subTotal: 300,
    finalTotal: { taxAmount: 68, total: 334 },
  },
});

describe("Sri Lankan template mapper", () => {
  it("formats structured discount and tax percentage values", () => {
    expect(
      formatSriPercentage({ amount: 60000, percentage: 5, type: "PERCENTAGE" })
    ).toBe("5%");
    expect(formatSriPercentage({ value: { percent: "18%" } })).toBe("18%");
    expect(formatSriPercentage({ amount: 60000, type: "FIXED_AMOUNT" })).toBe(
      ""
    );
    expect(formatSriPercentage("7.50%")).toBe("7.5%");
  });

  it("wraps currency symbols so print fonts cannot hide the glyph", () => {
    expect(
      formatSrTradingCurrencyMarkup(135000, {
        currency: "INR",
        locale: "en-IN",
      })
    ).toBe(
      '<span class="sri-money"><span class="sri-currency-symbol">₹</span>1,35,000.00</span>'
    );
  });

  it("uses the authoritative input tax total without recomputing it", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.vatAmount).toBe(68);
    expect(model.sri.isVatTax).toBe(true);
    expect(model.sri.vatTaxLabel).toBe("VAT");
    expect(model.sri.vatTaxRows).toEqual([
      { rate: 18, amount: 18 },
      { rate: 8, amount: 16 },
    ]);
    expect(model.sri.vatTaxInWords).toMatch(/Rupees Only$/);
  });

  it("always hides country and place of supply", () => {
    const input = payload() as any;
    input.invoice.countryOfSupply = "Sri Lanka";
    input.invoice.placeOfSupply = "Colombo";

    const model = mapSriLankanTemplateData(input);

    expect(model.mapped.visibility.showCountryOfSupply).toBe(false);
    expect(model.mapped.visibility.showPlaceOfSupply).toBe(false);
    expect(
      model.sri.documentRows.some((row) =>
        /(?:country|place)\s*of\s*supply/i.test(`${row.key} ${row.label}`)
      )
    ).toBe(false);
  });

  it("preserves input columns and hides only the generated serial column", () => {
    const model = mapSriLankanTemplateData(payload());
    const labels = model.mapped.columns.map((column) => column.label);

    expect(labels).toEqual([
      "Description",
      "Amount",
      "Amount",
      "VAT Rate",
      "VAT",
      "Total",
    ]);
    expect(model.mapped.columns.some((column) => column.key === "index")).toBe(
      false
    );
    expect(model.sri.totalsLabelColspan).toBe(3);
    expect(model.sri.supplier.addressLines.join(" ")).toContain("Maharashtra");
  });

  it("builds the subtotal summary from input values and mapped labels", () => {
    const input = payload();
    Object.assign(input.invoice, { invoiceType: "INVOICE" });
    Object.assign(input.invoice, { customLabels: { subTotal: "Sub Total" } });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.summaryRows).toEqual([
      {
        label: "Amount",
        value: 300,
        isMonetary: true,
      },
      {
        label: "VAT",
        value: 68,
        isMonetary: true,
      },
      {
        label: "Total",
        value: 334,
        isMonetary: true,
        isGrandTotal: true,
      },
    ]);
    expect(model.mapped.visibility.denseItemsTable).toBe(true);
    expect("itemsTableMinWidth" in model.sri).toBe(false);
  });

  it.each([
    {
      billType: "INVOICE",
      invoiceTitle: "Tax Invoice",
      numberField: "invoiceNumber",
      number: "INV-42",
      dateField: "invoiceDate",
      date: "2026-09-20",
      title: "Tax Invoice",
      numberLabel: "Tax Invoice No.",
      dateLabel: "Date of Invoice",
    },
    {
      billType: "QUOTATION",
      invoiceTitle: "Quotation",
      numberField: "quotationNumber",
      number: "QT-42",
      dateField: "quotationDate",
      date: "2026-09-21",
      title: "Quotation",
      numberLabel: "Quotation No.",
      dateLabel: "Date of Quotation",
    },
    {
      billType: "SALESORDER",
      invoiceTitle: "Sales Order",
      numberField: "salesOrderNumber",
      number: "SO-42",
      dateField: "salesOrderDate",
      date: "2026-09-22",
      title: "Sales Order",
      numberLabel: "Sales Order No.",
      dateLabel: "Date of Sales Order",
    },
  ])(
    "maps $billType header labels and values from its document fields",
    ({
      billType,
      invoiceTitle,
      numberField,
      number,
      dateField,
      date,
      title,
      numberLabel,
      dateLabel,
    }) => {
      const input = payload() as any;
      Object.assign(input.invoice, {
        billType,
        invoiceType: billType,
        invoiceTitle,
        [numberField]: number,
        [dateField]: date,
      });

      const model = mapSriLankanTemplateData(input);

      expect(model.sri.document).toEqual({
        title,
        number,
        date,
        numberLabel,
        dateLabel,
      });
    }
  );

  it("preserves editable table and summary labels exactly as configured", () => {
    const input = payload();
    Object.assign(input.invoice, { invoiceType: "INVOICE" });
    input.invoice.columns = input.invoice.columns.map((column) => {
      const labels: Record<string, string> = {
        item: "Configured Product",
        amount: "Configured Base",
        tax: "Configured VAT",
        total: "Configured Payable",
      };
      return { ...column, label: labels[column.key] || column.label };
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.mapped.columns.map((column) => column.label)).toEqual([
      "Configured Product",
      "Amount",
      "Configured Base",
      "VAT Rate",
      "Configured VAT",
      "Configured Payable",
    ]);
    expect(model.sri.summaryRows.map((row) => row.label)).toEqual([
      "Configured Base",
      "Configured VAT",
      "Configured Payable",
    ]);
  });

  it("adds API-derived percentages to discount and tax summary labels", () => {
    const input = payload() as any;
    input.invoice.items = input.invoice.items.map((item: any) => ({
      ...item,
      gstRate: 18,
      discount: 5,
    }));
    input.invoice.finalTotal.discount = 15;

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.summaryRows.map((row) => row.label)).toEqual([
      "Amount",
      "Discount (5%)",
      "VAT (18%)",
      "Total",
    ]);
  });

  it("maps configured batch-summary columns and item batch values", () => {
    const input = payload() as any;
    input.showStockSummary = true;
    input.defaultBatchColumns = [
      { key: "batchName", label: "Lot Number", system: true },
      { key: "quantity", label: "Batch Quantity", system: true },
      { key: "expiryDate", label: "Use Before", system: true },
    ];
    input.invoice.items[0].batchSummary = [
      { batchName: "LOT-42", quantity: 5, expiryDate: "2027-08-31" },
    ];

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showBatchSummary).toBe(true);
    expect(model.sri.widgets.batchSummary.columns).toEqual([
      { key: "batchName", label: "Lot Number" },
      { key: "quantity", label: "Batch Quantity" },
      { key: "expiryDate", label: "Use Before" },
    ]);
    expect(model.sri.widgets.batchSummary.rows[0].cells).toEqual([
      { key: "batchName", value: "LOT-42", isDate: false, isNumeric: false },
      { key: "quantity", value: 5, isDate: false, isNumeric: true },
      {
        key: "expiryDate",
        value: "2027-08-31",
        isDate: true,
        isNumeric: false,
      },
    ]);
  });

  it("maps the configured supplier contact details for the final bar", () => {
    const input = payload() as any;
    input.invoice.contact = {
      email: "support@example.com",
      phone: "+94 77 123 4567",
    };
    input.invoice.customLabels = {
      contactIntro: "Questions? Reach us via",
      contactEmail: "mail",
      contactPhone: "telephone",
    };

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.contact).toEqual({
      show: true,
      email: "support@example.com",
      phone: "+94 77 123 4567",
      intro: "Questions? Reach us via",
      emailLabel: "mail",
      phoneLabel: "telephone",
    });
  });

  it("maps attachment links, editable labels, and image previews", () => {
    const input = payload() as any;
    input.invoice.customLabels = { attachment: "Supporting Files" };
    input.invoice.attachments = [
      "https://example.com/files/purchase%20order.pdf",
      {
        url: "https://example.com/files/photo.png",
        name: "Site photo",
        mimeType: "image/png",
      },
    ];

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.attachments).toEqual({
      show: true,
      label: "Supporting Files",
      items: [
        {
          number: 1,
          url: "https://example.com/files/purchase%20order.pdf",
          label: "purchase order.pdf",
          isImage: false,
        },
        {
          number: 2,
          url: "https://example.com/files/photo.png",
          label: "Site photo",
          isImage: true,
        },
      ],
    });
  });

  it("puts Telephone No last in each party detail list", () => {
    const input = payload();
    Object.assign(input.invoice.billedBy, {
      panNumber: "SELLER-PAN",
      phone: "+91 90000 00001",
      customFields: [{ label: "Tax ID", value: "SELLER-TAX" }],
    });
    Object.assign(input.invoice.billedTo, {
      gstin: "BUYER-GSTIN",
      phone: "+94 77000 0002",
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.supplier.detailRows.at(-1)).toMatchObject({
      key: "phone",
      label: "Telephone No",
      value: "+91 90000 00001",
    });
    expect(model.sri.purchaser.detailRows.at(-1)).toMatchObject({
      key: "phone",
      label: "Telephone No",
      value: "+94 77000 0002",
    });
  });

  it("does not expose purchaser GSTIN or PAN inherited from the customer record", () => {
    const input = payload();
    Object.assign(input.invoice.billedTo, {
      gstin: "23OBRPS1700R1ZS",
      panNumber: "OBRPS1700R",
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.purchaser.detailRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "gstin" }),
        expect.objectContaining({ key: "panNumber" }),
      ])
    );
  });

  it("shows purchaser GSTIN and PAN when the document explicitly enables them", () => {
    const input = payload();
    Object.assign(input.invoice.billedTo, {
      gstin: "23OBRPS1700R1ZS",
      panNumber: "OBRPS1700R",
      showGstInInvoice: true,
      panShowInInvoice: true,
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.purchaser.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gstin",
          value: "23OBRPS1700R1ZS",
        }),
        expect.objectContaining({
          key: "panNumber",
          value: "OBRPS1700R",
        }),
      ])
    );
  });

  it("separates TIN so it can render first in each billing party", () => {
    const input = payload();
    Object.assign(input.invoice.billedBy, {
      tinNumber: "SUPPLIER-TIN",
      panNumber: "SELLER-PAN",
    });
    Object.assign(input.invoice.billedTo, {
      tinNumber: "PURCHASER-TIN",
      gstin: "BUYER-GSTIN",
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.supplier.tinRows).toEqual([
      expect.objectContaining({
        key: "tinNumber",
        label: "Supplier's TIN",
        value: "SUPPLIER-TIN",
      }),
    ]);
    expect(model.sri.purchaser.tinRows).toEqual([
      expect.objectContaining({
        key: "tinNumber",
        label: "Purchaser's TIN",
        value: "PURCHASER-TIN",
      }),
    ]);
    expect(model.sri.supplier.detailRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "tinNumber" })])
    );
    expect(model.sri.purchaser.detailRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "tinNumber" })])
    );
  });

  it("maps all visible billing, shipping, and document custom fields", () => {
    const input = payload() as any;
    input.invoice.billedBy.customFields = [
      { key: "supplierCode", label: "Supplier Code", value: "SUP-42" },
      {
        key: "hiddenSupplierField",
        label: "Hidden Supplier Field",
        value: "SECRET",
        showInInvoice: false,
      },
    ];
    input.invoice.billedTo.customHeaders = [
      { key: "buyerCode", label: "Buyer Code", value: "BUY-17" },
    ];
    input.invoice.shippedFrom = {
      name: "Origin Warehouse",
      customFields: [
        { key: "dispatchZone", label: "Dispatch Zone", value: "North" },
      ],
    };
    input.invoice.shippedTo = {
      name: "Destination Warehouse",
      additionalIds: [{ key: "gatePass", label: "Gate Pass", value: "GP-9" }],
    };
    input.invoice.customFields = [
      { key: "projectRef", label: "Project Reference", fieldValue: "PR-88" },
      {
        key: "inspectionDate",
        label: "Inspection Date",
        value: "2026-09-28",
        dataType: "date",
      },
      { label: "Date of Supply", value: "2026-09-27" },
      { label: "Mode of Payment", value: "Bank Transfer" },
    ];

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.supplier.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Supplier Code", value: "SUP-42" }),
      ])
    );
    expect(model.sri.supplier.detailRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Hidden Supplier Field" }),
      ])
    );
    expect(model.sri.purchaser.detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Buyer Code", value: "BUY-17" }),
      ])
    );
    expect(model.display.partyDetails.shippedFrom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Dispatch Zone", value: "North" }),
      ])
    );
    expect(model.display.partyDetails.shippedTo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Gate Pass", value: "GP-9" }),
      ])
    );
    expect(model.sri.documentRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Project Reference",
          value: "PR-88",
        }),
        expect.objectContaining({
          label: "Inspection Date",
          value: "2026-09-28",
          isDate: true,
        }),
      ])
    );
    expect(model.sri.documentRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Date of Supply",
          value: "2026-09-27",
          isDate: true,
        }),
      ])
    );
    expect(model.sri.documentRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Mode of Payment" }),
      ])
    );
  });

  it("keeps document details in left-to-right source order", () => {
    const input = payload() as any;
    input.invoice.dueDate = "2026-09-30";
    input.invoice.customHeaders = [
      {
        key: "dateOfSupply",
        label: "Date of Supply",
        value: "2026-09-20",
        dataType: "date",
      },
      { key: "deliveryNote", label: "Delivery note", value: "DN-42" },
      { key: "projectCode", label: "Project Code", value: "PRJ-7" },
    ];
    input.invoice.documentFieldOrder = [
      "dateOfSupply",
      "dueDate",
      "deliveryNote",
      "projectCode",
    ];

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.documentRows.map((row) => row.label)).toEqual([
      "Date of Supply",
      "Due Date",
      "Delivery note",
      "Project Code",
    ]);
  });

  it("renders only the first added field before item/description and preserves the remaining form order", () => {
    const input = payload();
    (input.invoice.items[0] as any).reference = "CUSTOM-REF-42";
    (input.invoice.items[0] as any).modelNo = "MODEL-7";
    input.invoice.columns.splice(
      1,
      0,
      { key: "index", label: "Sr. No.", dataType: "number" },
      { key: "reference", label: "Reference", dataType: "string" },
      { key: "modelNo", label: "Model No", dataType: "string" }
    );

    const model = mapSriLankanTemplateData(input);

    expect(model.mapped.columns[0]).toMatchObject({
      key: "reference",
      label: "Reference",
      className: "col-reference",
    });
    expect(model.mapped.columns[1]).toMatchObject({
      key: "item",
      label: "Description",
    });
    expect(model.mapped.columns[2]).toMatchObject({
      key: "modelNo",
      label: "Model No",
    });
    expect(model.mapped.columns.some((column) => column.key === "index")).toBe(
      false
    );
    expect(
      getItemColumnValue(input.invoice.items[0], model.mapped.columns[0])
    ).toBe("CUSTOM-REF-42");
    expect(
      getItemColumnValue(input.invoice.items[0], model.mapped.columns[2])
    ).toBe("MODEL-7");
    expect(model.sri.totalsLabelColspan).toBe(5);
  });

  it("does not synthesize document fields from the invoice date", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.dateOfSupply).toBeUndefined();
    expect(model.sri.documentRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Date of Supply" }),
      ])
    );
    expect(model.sri).not.toHaveProperty("blankRows");
  });

  it("maps only user-facing transport form fields from the raw invoice", () => {
    const input = payload();
    Object.assign(input.invoice, {
      customLabels: {
        transportName: "Carrier",
        challanNumber: "Delivery No.",
      },
      transportDetails: {
        transporter: {
          name: "User Selected Carrier",
          transporterId: "INTERNAL-ID",
        },
        transportMode: "Road",
        challanNumber: "DEL-42",
        challanDate: "2026-09-20",
        extraInformation: "Fragile",
        vehicleNumber: "AUTO-VEHICLE",
        vehicleType: "REGULAR",
        distance: 86567,
        transactionType: "REGULAR",
        subSupplyType: "IMPORT",
      },
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.transportRows).toEqual([
      { label: "Carrier", value: "User Selected Carrier" },
      { label: "Transport Mode", value: "Road" },
      { label: "Delivery No.", value: "DEL-42" },
      { label: "Challan Date", value: "2026-09-20", isDate: true },
      { label: "Transport Notes", value: "Fragile" },
    ]);
  });

  it("omits empty and placeholder transport form values", () => {
    const input = payload();
    Object.assign(input.invoice, {
      transportDetails: {
        transportMode: "-",
        challanNumber: "N/A",
        challanDate: "null",
        extraInformation: "undefined",
      },
    });

    expect(mapSriLankanTemplateData(input).sri.transportRows).toEqual([]);
  });

  it("uses the configured document-detail label and value for additional information", () => {
    const input = payload();
    Object.assign(input.invoice, {
      additionalInformationFields: [
        {
          key: "additionalInformation",
          label: "Quotation Details",
          value: "Valid for 30 days",
        },
      ],
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showAdditionalInformation).toBe(true);
    expect(model.sri.showClosingInformation).toBe(true);
    expect(model.sri.additionalInformationLabel).toBe("Quotation Details");
    expect(model.sri.additionalInformation).toBe("Valid for 30 days");
    expect(model.sri.informationRows).toEqual([]);
  });

  it("maps direct additional-information aliases into the closing section", () => {
    const input = payload();
    Object.assign(input.invoice, {
      additionalInformation: "Legacy fixed value",
      additionalInformationLabel: "Additional Information if any",
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showAdditionalInformation).toBe(true);
    expect(model.sri.showClosingInformation).toBe(true);
    expect(model.sri.additionalInformationLabel).toBe(
      "Additional Information if any"
    );
    expect(model.sri.additionalInformation).toBe("Legacy fixed value");
  });

  it("maps object-shaped additional information", () => {
    const input = payload() as any;
    input.invoice.additionalInfo = {
      label: "Delivery Instructions",
      value: "Call before delivery",
    };

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showAdditionalInformation).toBe(true);
    expect(model.sri.additionalInformationLabel).toBe("Delivery Instructions");
    expect(model.sri.additionalInformation).toBe("Call before delivery");
  });

  it("maps complete bank aliases without inventing a QR from the UPI ID", () => {
    const input = payload();
    Object.assign(input.invoice, {
      paymentOptions: { accountTransfer: true, upi: true },
      bankAccount: {
        accountHolderName: "Ceylon Trading Company",
        accountNumber: "00123456789",
        ifscCode: "HDFC0000123",
        swiftCode: "HDFCINBB",
        accountType: "Current",
        bankName: "HDFC Bank",
        customFields: [{ label: "Branch", value: "Colombo" }],
      },
      upi: { upiId: "ceylon@upi" },
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.bankRows).toEqual([
      { label: "Account Name", value: "Ceylon Trading Company", nowrap: false },
      { label: "Account Number", value: "00123456789", nowrap: true },
      { label: "IFSC", value: "HDFC0000123", nowrap: true },
      { label: "SWIFT", value: "HDFCINBB", nowrap: true },
      { label: "Account Type", value: "Current", nowrap: false },
      { label: "Bank", value: "HDFC Bank", nowrap: false },
      { label: "Branch", value: "Colombo", nowrap: false },
    ]);
    expect(model.sri.upiId).toBe("ceylon@upi");
    expect(model.sri.upiQrImage).toBe("");
  });

  it("maps the UPI QR image supplied by the source document", () => {
    const input = payload();
    const documentQr = "data:image/png;base64,REAL_DOCUMENT_QR";
    Object.assign(input.invoice, {
      paymentOptions: { upi: true },
      upi: { upiId: "ceylon@upi", qrCode: documentQr },
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.upiId).toBe("ceylon@upi");
    expect(model.sri.upiQrImage).toBe(documentQr);
  });

  it("renders machine payment enums as readable labels", () => {
    const input = payload();
    Object.assign(input.invoice, {
      payments: [{ paymentMethod: "ACCOUNT_TRANSFER", amount: 100 }],
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.modeOfPayment).toBe("Account Transfer");
    expect(model.sri.modeOfPayment).not.toMatch(/[_-]/);
  });

  it("preserves a human-entered payment value exactly", () => {
    const input = payload();
    Object.assign(input.invoice, {
      customFields: [
        { label: "Mode of Payment", value: "Bank transfer / UPI" },
      ],
      payments: [{ paymentMethod: "ACCOUNT_TRANSFER", amount: 100 }],
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.modeOfPayment).toBe("Bank transfer / UPI");
  });

  it("capitalizes the first letter of the total amount in words", () => {
    const input = payload() as any;
    input.invoice.amountInWords =
      "thirteen lakh forty five thousand two hundred ringgit only";

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.totalInWords).toBe(
      "Thirteen lakh forty five thousand two hundred ringgit only"
    );
  });

  it("maps normalized data for the shared status, tax, HSN, and payment widgets", () => {
    const input = payload();
    Object.assign(input.invoice, {
      status: "PAID",
      taxName: "GST",
      taxType: "INDIA",
      igst: true,
      businessCurrency: "LKR",
      payments: {
        receipt: {
          paymentMethod: "ACCOUNT_TRANSFER",
          amount: 334,
          conversionRates: { LKR: 3.5 },
        },
      },
    });
    Object.assign(input.invoice.items[0], {
      hsnCode: "9983",
      igst: 18,
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showInvoiceStatus).toBe(true);
    expect(model.sri.widgets.taxSummary).toMatchObject({
      hasRows: true,
      totalTaxAmount: 18,
    });
    expect(model.sri.widgets.hsnSummary).toMatchObject({
      hasRows: true,
      totalTaxableValue: 100,
      totalTaxAmount: 18,
    });
    expect(model.sri.widgets.paymentTable).toMatchObject({
      hasRows: true,
      totalAmount: 334,
      showBizAmount: true,
    });
    expect(model.sri.modeOfPayment).toBe("Account Transfer");
  });

  it("does not invent an unpaid status when the API omits invoice status", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.showInvoiceStatus).toBe(false);
  });

  it("honors Lydia advanced-setting toggles except supply visibility", () => {
    const input = payload() as any;
    input.invoice.owner = { country: "MY" };
    input.invoice.items[0].sku = "SKU-1";
    input.invoice.items[0].classification = "SERVICE";
    input.invoice.items[0].serialNumbers = ["SN-1"];
    input.invoice.items.push({
      name: "Group subtotal",
      isGroupItemTotalRow: true,
      quantity: 1,
      amount: 100,
      total: 118,
    });
    input.invoice.columns.splice(1, 0, {
      key: "classification",
      label: "Classification",
    });
    input.invoice.advanceOptions = {
      hsnView: "SPLIT",
      unitColumn: "SEPARATE",
      taxSummaryView: "SUMMARY",
      showDescriptionInFullWidth: false,
      showSkuInInvoice: false,
      showSerialNumbersInDescription: false,
      hideGroupSubTotal: true,
      showTotalsRow: false,
      showTotalInWords: false,
      showCountryOfSupply: true,
      showPlaceOfSupply: true,
    };

    const model = mapSriLankanTemplateData(input);

    expect(model.mapped.visibility).toMatchObject({
      isDescriptionFullWidth: false,
      showSkuInName: false,
      showSerialNumbersInDescription: false,
      showGroupSubTotal: false,
      showTotalsRow: false,
      showTotalInWords: false,
      showUnitAsColumn: true,
      showInlineClassification: false,
      showCountryOfSupply: false,
      showPlaceOfSupply: false,
    });
    expect(
      model.mapped.columns.find((column) => column.key === "classification")
        ?.isHidden
    ).toBe(false);
    expect(model.mapped.columns.some((column) => column.key === "unit")).toBe(
      true
    );
    expect(model.invoice.items).toHaveLength(2);
    expect(model.invoice.items.some((item) => item.isGroupItemTotalRow)).toBe(
      false
    );
    expect(model.sri.showTaxSummary).toBe(false);
  });

  it("shows detailed tax, group subtotal, totals row, and words when enabled", () => {
    const input = payload() as any;
    input.invoice.items.push({
      name: "Group subtotal",
      isGroupItemTotalRow: true,
      quantity: 1,
      amount: 100,
      total: 118,
    });
    input.invoice.advanceOptions = {
      taxSummaryView: "BOTH",
      showDescriptionInFullWidth: true,
      showSkuInInvoice: true,
      showSerialNumbersInDescription: true,
      hideGroupSubTotal: false,
      showTotalsRow: true,
      showTotalInWords: true,
    };

    const model = mapSriLankanTemplateData(input);

    expect(model.mapped.visibility).toMatchObject({
      isDescriptionFullWidth: true,
      showSkuInName: true,
      showSerialNumbersInDescription: true,
      showGroupSubTotal: true,
      showTotalsRow: true,
      showTotalInWords: true,
    });
    expect(model.invoice.items.some((item) => item.isGroupItemTotalRow)).toBe(
      true
    );
    expect(model.sri.showTaxSummary).toBe(true);
  });

  it("splits GST summary rows from the API final totals", () => {
    const input = payload() as any;
    Object.assign(input.invoice, {
      taxName: "GST",
      taxType: "INDIA",
      isIgst: false,
      finalTotal: { subTotal: 300, cgst: 17, sgst: 17, total: 334 },
    });
    input.invoice.items = input.invoice.items.map((item: any) => ({
      ...item,
      gstRate: 18,
    }));

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.summaryRows).toEqual([
      { label: "Amount", value: 300, isMonetary: true },
      { label: "CGST (9%)", value: 17, isMonetary: true },
      { label: "SGST (9%)", value: 17, isMonetary: true },
      { label: "Total", value: 334, isMonetary: true, isGrandTotal: true },
    ]);
  });

  it("shows IGST or UTGST and drops mixed-rate suffixes", () => {
    const igst = payload() as any;
    Object.assign(igst.invoice, {
      taxName: "GST",
      isIgst: true,
      finalTotal: { subTotal: 300, igst: 34, total: 334 },
    });
    expect(
      mapSriLankanTemplateData(igst).sri.summaryRows.map((row) => row.label)
    ).toEqual(["Amount", "VAT", "Total"]);

    const utgst = payload() as any;
    Object.assign(utgst.invoice, {
      taxType: "INDIA",
      taxName: "GST",
      isIgst: false,
      isUtgst: true,
      billedTo: { name: "Buyer", state: "Chandigarh", country: "IN" },
      finalTotal: { subTotal: 300, cgst: 17, utgst: 17, total: 334 },
    });
    expect(
      mapSriLankanTemplateData(utgst)
        .sri.summaryRows.filter((row) => /GST/.test(row.label))
        .map((row) => row.value)
    ).toEqual([17, 17]);
  });

  it("keeps the single tax row when a GST document has no split totals", () => {
    const input = payload() as any;
    Object.assign(input.invoice, { taxName: "GST", isIgst: true });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.summaryRows.map((row) => row.value)).toEqual([
      300, 68, 334,
    ]);
  });

  it("drops zero cess rows and adds payment balances and due amount", () => {
    const input = payload() as any;
    Object.assign(input.invoice, {
      status: "PARTIALLY_PAID",
      showDueAmount: true,
      cesses: [
        { cessName: "Zero Cess", amount: 0 },
        { cessName: "Green Cess", amount: 4 },
      ],
      balance: {
        tds: 5,
        paid: -100,
        settledAmount: 95,
        transactionCharge: 2,
        due: 229,
      },
      invoiceValueProps: { transactionCharge: { showInInvoice: false } },
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.summaryRows.slice(2)).toEqual([
      { label: "Green Cess", amount: 4, value: 4, isMonetary: true },
      { label: "Total", value: 334, isMonetary: true, isGrandTotal: true },
      {
        label: "TDS Amount Withheld",
        value: 5,
        isMonetary: true,
        isDeduction: true,
      },
      { label: "Amount Paid", value: 100, isMonetary: true, isDeduction: true },
      {
        label: "Amount Received",
        value: 95,
        isMonetary: true,
        isDeduction: false,
      },
      { label: "Due Amount", value: 229, isMonetary: true },
    ]);
  });

  it("reads payment balances from the raw invoice and hidden raw fields", () => {
    const input = payload() as any;
    input.invoice.balance = { paid: 10, tds: 3 };
    input.invoice.invoiceValueProps = { tds: false };

    const model = mapSriLankanTemplateData(input);

    expect(
      model.sri.summaryRows
        .filter((row) => row.isDeduction)
        .map((row) => row.label)
    ).toEqual(["Amount Paid"]);
  });

  it("totals summable table columns from real line items", () => {
    const input = payload() as any;
    input.invoice.columns.push(
      { key: "freight", label: "Freight", summarise: true },
      { key: "unitPrice", label: "Unit Price", dataType: "currency" },
      { key: "vatRate", label: "VAT %", dataType: "percentage" },
      { key: "cess", label: "Cess", dataType: "currency" }
    );
    input.invoice.items[0].freight = "1,000";
    input.invoice.items[1].freight = 500;
    input.invoice.items.push(
      { name: "Group", group: true },
      { name: "Sub total", isGroupItemTotalRow: true, amount: 300, tax: 34 }
    );

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.columnTotals).toEqual({
      amount: 300,
      tax: 34,
      freight: 1500,
    });
  });

  it("writes the total in words in the document currency", () => {
    const inr = mapSriLankanTemplateData(payload());
    expect(inr.sri.totalInWords).toBe("Three Hundred Thirty Four Rupees Only");

    const lkr = payload() as any;
    lkr.invoice.currency = "";
    lkr.invoice.businessCurrency = "";
    expect(mapSriLankanTemplateData(lkr).sri.totalInWords).toBe(
      "Three Hundred Thirty Four Sri Lankan Rupees Only"
    );
  });

  it("defaults print settings when none are configured", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.print).toEqual({
      letterHeadOnFirstPage: undefined,
      footerOnLastPage: undefined,
      textScale: "1",
      pageless: false,
      hideFooter: false,
      direction: "ltr",
      language: "",
      script: "",
    });
    expect(model.mapped.visibility.letterHeadOnFirstPage).toBe(false);
    expect(model.mapped.visibility.footerOnLastPage).toBe(false);
  });

  it("reads print settings from the top-level template", () => {
    const input = payload() as any;
    input.template = {
      direction: "RTL",
      languageCode: "ar",
      languageScript: "Arab",
      pdfOptions: {
        letterHeadOnFirstPage: true,
        footerOnLastPage: "true",
        textScale: 120,
        longPdf: true,
        hideFooter: 1,
      },
    };

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.print).toEqual({
      letterHeadOnFirstPage: true,
      footerOnLastPage: true,
      textScale: "1.2",
      pageless: true,
      hideFooter: true,
      direction: "rtl",
      language: "ar",
      script: "Arab",
    });
    expect(model.mapped.visibility.letterHeadOnFirstPage).toBe(true);
    expect(model.mapped.visibility.footerOnLastPage).toBe(true);
  });

  it("lets invoice-level print settings override and clamps text scale", () => {
    const input = payload() as any;
    input.template = { pdfOptions: { textScale: 1.1 } };
    input.invoice.template = {
      isRtl: false,
      direction: "rtl",
      pdfOptions: { scale: 0.1 },
    };
    input.invoice.pdfOptions = { textScale: "abc", pageless: "no" };
    input.invoice.locale = "si-LK";

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.print).toMatchObject({
      textScale: "1",
      pageless: false,
      direction: "ltr",
      language: "si-LK",
    });

    input.invoice.pdfOptions = { scale: 0.1 };
    expect(mapSriLankanTemplateData(input).sri.print.textScale).toBe("0.3");
    input.invoice.pdfOptions = { scale: 900 };
    expect(mapSriLankanTemplateData(input).sri.print.textScale).toBe("2");
  });
});
