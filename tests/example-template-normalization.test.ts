import sample from "../src/types/sample.json";
import type {
  CeresTemplatePayload,
  FlattenedInvoicePayload,
} from "../src/types/contract";
import { normalizeInvoicePayload } from "../src/types/contract";
import {
  normalizeCountryOfSupply,
  normalizeInvoiceTemplateState,
  normalizePlaceOfSupply,
} from "../src/main/invoiceTemplateNormalization";

const wrappedSample: CeresTemplatePayload = sample;
const flatSample: FlattenedInvoicePayload =
  normalizeInvoicePayload(wrappedSample);

describe("ceres-example normalizeInvoiceTemplateState", () => {
  it("keeps the example repo aligned with the shared wrapped and flat contract", () => {
    const wrappedState = normalizeInvoiceTemplateState(wrappedSample);
    const flatState = normalizeInvoiceTemplateState(flatSample);

    expect(flatState).toEqual(wrappedState);
    expect(wrappedState.invoice).toEqual({
      ...flatSample,
      countryOfSupply: "IN",
    });
    expect(wrappedState.invoice.invoiceNumber).toBe(
      wrappedSample.invoice.invoiceNumber
    );
    expect(wrappedState.mapped.qr.top).toBe(wrappedSample.invoice.irn?.qrCode);
    expect(wrappedState.mapped.visibility.showLogistics).toBe(true);
    expect(wrappedState.mapped.visibility.showTaxTable).toBe(true);
    expect(wrappedState.derived.showHsnColumn).toBe(true);
  });

  it("uses the matching billed-to state name for a bare GST place-of-supply code", () => {
    const state = normalizeInvoiceTemplateState({
      invoice: {
        ...(sample as any).invoice,
        placeOfSupply: "29",
        billedTo: {
          ...(sample as any).invoice.billedTo,
          stateCode: "29",
          state: "Karnataka",
        },
      },
      ownerBusiness: (sample as any).ownerBusiness,
    } as any);

    expect(state.invoice.placeOfSupply).toBe("Karnataka");
  });

  it("resolves bare GST place-of-supply codes when billed-to cannot name them", () => {
    expect(
      normalizePlaceOfSupply({
        invoiceNumber: "INV-1",
        billType: "SALESORDER",
        currency: "INR",
        status: "DRAFT",
        placeOfSupply: "27",
        billedTo: { name: "Buyer", stateCode: "29", state: "Karnataka" },
      } as any)
    ).toBe("Maharashtra");
  });

  it("preserves an already descriptive place of supply", () => {
    expect(
      normalizePlaceOfSupply({ placeOfSupply: "29-KARNATAKA" } as any)
    ).toBe("29-KARNATAKA");
  });

  it("falls back to pos when placeOfSupply is absent", () => {
    expect(
      normalizePlaceOfSupply({
        pos: "27",
        billedTo: { name: "Buyer", state: "Maharashtra", stateCode: "27" },
      } as any)
    ).toBe("Maharashtra");
  });

  it("fetches supply values from the billed-to destination when direct fields are absent", () => {
    const invoice = {
      billedTo: {
        name: "Buyer",
        country: "US",
        state: "California",
      },
    } as any;

    expect(normalizeCountryOfSupply(invoice)).toBe("US");
    expect(normalizePlaceOfSupply(invoice)).toBe("California");
  });

  it("preserves invoice-level compatibility flags when wrapper overrides are absent", () => {
    const state = normalizeInvoiceTemplateState({
      invoice: {
        ...(sample as any).invoice,
        isDescriptionFullWidth: true,
        showItemNameFullWidth: true,
        businessLocale: "en-US",
      },
      ownerBusiness: (sample as any).ownerBusiness,
    } as any);

    expect(state.mapped.visibility.isDescriptionFullWidth).toBe(true);
    expect(state.mapped.visibility.itemNameFullWidth).toBe(true);
    expect(state.invoice.businessLocale).toBe("en-US");
  });
});
