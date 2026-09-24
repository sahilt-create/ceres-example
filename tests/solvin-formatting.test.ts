import {
  formatCountryName,
  formatQuantityWithUnit,
  formatSolvinCurrency,
  formatSolvinCurrencyMarkup,
  getItemSku,
  getPartyAddressLines,
  getItemSerialNumbers,
  getItemUnit,
  shouldShowItemSku,
  summarizeItemQuantity,
  solvinTaxAmountInWords,
  toTitleCaseWords,
} from "../src/templates/solvin/formatting";

describe("Solvin currency formatting", () => {
  it("keeps two decimal places for integer monetary values by default", () => {
    expect(
      formatSolvinCurrency(135000, { currency: "INR", locale: "en-IN" })
    ).toBe("₹1,35,000.00");
  });

  it.each([
    ["INR", "en-IN", "₹1,35,000.00"],
    ["USD", "en-US", "$135,000.00"],
    ["EUR", "en-US", "€135,000.00"],
    ["GBP", "en-GB", "£135,000.00"],
    ["SAR", "en-US", "⃁ 135,000.00"],
    ["AED", "en-US", "AED 135,000.00"],
  ])(
    "renders %s dynamically in paged and Pageless PDF markup",
    (currency, locale, expected) => {
      const symbolMatch = expected.match(/^([^\d.,\s]+)/u);
      const expectedMarkup = symbolMatch
        ? expected.replace(
            symbolMatch[1],
            `<span class="solvin-currency-symbol">${symbolMatch[1]}</span>`
          )
        : expected;

      expect(formatSolvinCurrencyMarkup(135000, { currency, locale })).toBe(
        `<span class="solvin-money">${expectedMarkup}</span>`
      );
    }
  );

  it("uses a configured ASCII custom currency label", () => {
    expect(
      formatSolvinCurrencyMarkup(100, {
        currency: "RC",
        customCurrencySymbol: "RCoins",
        locale: "en-US",
      })
    ).toBe(
      '<span class="solvin-money"><span class="solvin-currency-symbol">RCoins</span> 100.00</span>'
    );
  });

  it("preserves a configured non-ASCII custom currency symbol", () => {
    expect(
      formatSolvinCurrencyMarkup(100, {
        currency: "SAR",
        customCurrencySymbol: "⃁",
        locale: "en-US",
      })
    ).toBe(
      '<span class="solvin-money"><span class="solvin-currency-symbol">⃁</span> 100.00</span>'
    );
  });

  it("isolates the currency glyph for negative amounts too", () => {
    expect(
      formatSolvinCurrencyMarkup(-100, {
        currency: "INR",
        locale: "en-IN",
      })
    ).toBe(
      '<span class="solvin-money">(<span class="solvin-currency-symbol">₹</span>100.00)</span>'
    );
  });

  it("isolates currency symbols placed after the amount by the locale", () => {
    expect(
      formatSolvinCurrencyMarkup(100, {
        currency: "EUR",
        locale: "de-DE",
      })
    ).toBe(
      '<span class="solvin-money">100,00 <span class="solvin-currency-symbol">€</span></span>'
    );
  });

  it("honors the invoice sub-unit length", () => {
    expect(
      formatSolvinCurrency(100, {
        currency: "USD",
        locale: "en-US",
        subUnitLength: 3,
      })
    ).toBe("$100.000");
  });

  it("falls back to two decimals for an invalid sub-unit length", () => {
    expect(
      formatSolvinCurrency(100, {
        currency: "USD",
        locale: "en-US",
        subUnitLength: -1,
      })
    ).toBe("$100.00");
  });

  it("uses the shared currency symbol for lowercase SAR currency", () => {
    expect(
      formatSolvinCurrency(51.45, {
        currency: "sar",
        locale: "en-US",
      })
    ).toBe("⃁ 51.45");
  });
});

describe("Solvin amount-in-words formatting", () => {
  it("keeps only the first letter of each word uppercase", () => {
    expect(
      toTitleCaseWords("FOUR HUNDRED NINE RUPEES AND NINETEEN PAISE ONLY")
    ).toBe("Four Hundred Nine Rupees And Nineteen Paise Only");
  });

  it("uses the international scale for HSN tax totals", () => {
    expect(solvinTaxAmountInWords(216000)).toBe(
      "Two Hundred Sixteen Thousand Rupees Only"
    );
    expect(solvinTaxAmountInWords(2.45)).toBe(
      "Two Rupees And Forty Five Paise Only"
    );
    expect(solvinTaxAmountInWords(2.46)).toBe(
      "Two Rupees And Forty Six Paise Only"
    );
  });
});

describe("Solvin country formatting", () => {
  it("expands Hong Kong's ISO country code", () => {
    expect(formatCountryName("HK")).toBe("Hong Kong");
  });

  it("preserves values that are already descriptive", () => {
    expect(formatCountryName("Hong Kong")).toBe("Hong Kong");
  });
});

describe("Solvin party address formatting", () => {
  it("keeps the city when a party also has a general address", () => {
    expect(
      getPartyAddressLines({
        address: "12 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        country: "IN",
        pincode: "400001",
      })
    ).toEqual(["12 Marine Drive", "Mumbai, Maharashtra, India 400001"]);
  });

  it("supports district and the zipCode fallback without duplicate lines", () => {
    expect(
      getPartyAddressLines({
        building: "Warehouse 4",
        street: "Dock Road",
        address: "Dock Road",
        city: "Kochi",
        district: "Ernakulam",
        state: "Kerala",
        country: "IN",
        zipCode: "682001",
      })
    ).toEqual([
      "Warehouse 4",
      "Dock Road",
      "Kochi, Ernakulam, Kerala, India 682001",
    ]);
  });

  it("renders state-name aliases used by live billed-to payloads", () => {
    expect(
      getPartyAddressLines({
        city: "Pune",
        stateName: "Maharashtra",
        country: "IN",
        pincode: "411001",
      })
    ).toEqual(["Pune, Maharashtra, India 411001"]);

    expect(
      getPartyAddressLines({
        city: "Bengaluru",
        state: { name: "Karnataka", code: "29" },
        country: "IN",
        pincode: "560001",
      })
    ).toEqual(["Bengaluru, Karnataka, India 560001"]);
  });

  it("resolves an Indian GST state code when no state name is provided", () => {
    expect(
      getPartyAddressLines({
        city: "Bengaluru",
        gstState: "29",
        country: "IN",
        pincode: "560001",
      })
    ).toEqual(["Bengaluru, Karnataka, India 560001"]);
  });
});

describe("Solvin item unit formatting", () => {
  it("keeps a readable unit stored directly on the item", () => {
    expect(getItemUnit({ unit: "BAG" })).toBe("BAG");
  });

  it("uses legacy fields only when item.unit is missing", () => {
    expect(getItemUnit({ unitName: "NOS" })).toBe("NOS");
    expect(getItemUnit({ uom: "kg" })).toBe("kg");
  });

  it("supports object-shaped unit values", () => {
    expect(getItemUnit({ unit: { value: "HRS", name: "Hours" } })).toBe("HRS");
  });

  it("resolves a custom unit key from an array configuration", () => {
    const invoice = {
      owner: {
        configuration: {
          units: [{ value: "1onfdis0uax", label: "Boxes" }],
        },
      },
    };

    expect(getItemUnit({ unit: "1onfdis0uax" }, invoice)).toBe("Boxes");
  });

  it("resolves a custom unit key from an object configuration", () => {
    const invoice = {
      business: {
        configuration: { units: { "1onfdis0uax": "Pieces" } },
      },
    };

    expect(getItemUnit({ unit: "1onfdis0uax" }, invoice)).toBe("Pieces");
  });

  it("does not print an unresolved opaque unit key", () => {
    expect(getItemUnit({ unit: "1onfdis0uax" })).toBe("");
  });

  it("renders the API quantity with its authoritative unit", () => {
    expect(formatQuantityWithUnit({ quantity: 1.3, unit: "BAG" }, true)).toBe(
      "1.3 BAG"
    );
  });
});

describe("Solvin item display properties", () => {
  it("resolves a clean SKU value and rejects null-like placeholders", () => {
    expect(getItemSku({ sku: "  SKU-001  " })).toBe("SKU-001");
    expect(getItemSku({ itemSku: "LEGACY-001" })).toBe("LEGACY-001");
    expect(getItemSku({ sku: "undefined" })).toBe("");
  });

  it.each([
    { invoiceSetting: true, itemSetting: undefined, visible: true },
    { invoiceSetting: "true", itemSetting: "true", visible: true },
    { invoiceSetting: 1, itemSetting: 1, visible: true },
    { invoiceSetting: false, itemSetting: true, visible: false },
    { invoiceSetting: "false", itemSetting: true, visible: false },
    { invoiceSetting: 0, itemSetting: true, visible: false },
    { invoiceSetting: true, itemSetting: false, visible: false },
    { invoiceSetting: true, itemSetting: "false", visible: false },
    { invoiceSetting: true, itemSetting: 0, visible: false },
  ])(
    "applies invoice SKU setting $invoiceSetting and item setting $itemSetting",
    ({ invoiceSetting, itemSetting, visible }) => {
      expect(
        shouldShowItemSku(
          { sku: "SKU-001", showSku: itemSetting },
          invoiceSetting
        )
      ).toBe(visible);
    }
  );

  it("never shows an empty SKU even when all switches are enabled", () => {
    expect(shouldShowItemSku({ sku: "", showSku: true }, true)).toBe(false);
  });

  it("formats direct and batch-level serial numbers without duplicates", () => {
    expect(
      getItemSerialNumbers({
        serialNumbers: ["SN-001", { serialNumber: "SN-002" }],
        batchSummary: [{ serials: [{ code: "SN-002" }, "SN-003"] }],
      })
    ).toBe("SN-001, SN-002, SN-003");
  });

  it("summarizes quantity without double-counting synthetic rows", () => {
    expect(
      summarizeItemQuantity([
        { quantity: 2 },
        { quantity: 3 },
        { quantity: 5, isGroupItemTotalRow: true },
        { quantity: 1, isAdditionalCharge: true },
      ])
    ).toBe(5);
  });
});
