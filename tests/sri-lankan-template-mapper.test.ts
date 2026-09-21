import { mapSriLankanTemplateData } from "../src/templates/sri-lankan.mapper";

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
  it("uses the rendered item taxes instead of a duplicated aggregate", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.vatAmount).toBe(34);
  });

  it("normalizes Sri Lankan table labels and preserves the raw party state", () => {
    const model = mapSriLankanTemplateData(payload());
    const labels = model.mapped.columns.map((column) => column.label);

    expect(labels).toEqual([
      "Reference*",
      "Description of Goods or Services",
      "Quantity",
      "Unit Price",
      "Amount Excluding VAT (Rs.)",
    ]);
    expect(model.sri.supplier.addressLines.join(" ")).toContain("Maharashtra");
  });

  it("falls back to the invoice date without adding placeholder rows", () => {
    const model = mapSriLankanTemplateData(payload());

    expect(model.sri.dateOfSupply).toBe("2026-09-14");
    expect(model.sri).not.toHaveProperty("blankRows");
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
    expect(model.sri.additionalInformationLabel).toBe("Quotation Details");
    expect(model.sri.additionalInformation).toBe("Valid for 30 days");
    expect(model.sri.informationRows).toEqual([]);
  });

  it("hides additional information unless it is configured in document details", () => {
    const input = payload();
    Object.assign(input.invoice, {
      additionalInformation: "Legacy fixed value",
      additionalInformationLabel: "Additional Information if any",
    });

    const model = mapSriLankanTemplateData(input);

    expect(model.sri.showAdditionalInformation).toBe(false);
    expect(model.sri.additionalInformationLabel).toBe("");
    expect(model.sri.additionalInformation).toBe("");
  });

  it("maps complete bank aliases and generates a QR for a UPI ID", () => {
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
    expect(model.sri.upiQrImage).toMatch(/^data:image\/svg\+xml,/);
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
});
