import {
  calculateSrTradingPrintFontSize,
  hasMultipleRenderedTextLines,
  hasSrTradingPrintCellOverflow,
  hasSrTradingPrintTableOverflow,
  isSrTradingLydiaPagelessMode,
} from "../src/templates/sr-trading-2-0.printFit";

const measuredWidth = (clientWidth: number, scrollWidth: number) => ({
  clientWidth,
  scrollWidth,
  getBoundingClientRect: () => ({ width: clientWidth }),
});

describe("SR Trading 2.0 print table fit", () => {
  it("keeps normal typography when the table fits", () => {
    expect(
      hasSrTradingPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 900)
      )
    ).toBe(false);
  });

  it("requests compact typography only for real overflow", () => {
    expect(
      hasSrTradingPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 940)
      )
    ).toBe(true);
  });

  it("ignores sub-pixel rounding differences", () => {
    expect(
      hasSrTradingPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 901)
      )
    ).toBe(false);
  });

  it("reduces the whole print table by one consistent responsive size", () => {
    expect(
      calculateSrTradingPrintFontSize(
        measuredWidth(600, 600),
        measuredWidth(600, 780)
      )
    ).toBe(10);
    expect(
      calculateSrTradingPrintFontSize(
        measuredWidth(600, 600),
        measuredWidth(600, 1200)
      )
    ).toBe(8);
    expect(
      calculateSrTradingPrintFontSize(
        measuredWidth(900, 900),
        measuredWidth(900, 900)
      )
    ).toBe(11);
  });

  it("detects a value painting outside its fixed print column", () => {
    expect(
      hasSrTradingPrintCellOverflow([
        { clientWidth: 70, scrollWidth: 70 },
        { clientWidth: 58, scrollWidth: 68 },
      ])
    ).toBe(true);
    expect(
      hasSrTradingPrintCellOverflow([
        { clientWidth: 70, scrollWidth: 70 },
        { clientWidth: 58, scrollWidth: 59 },
      ])
    ).toBe(false);
  });

  it("detects headers rendered across multiple lines", () => {
    expect(
      hasMultipleRenderedTextLines([
        { top: 10, width: 20, height: 13 },
        { top: 23, width: 18, height: 13 },
      ])
    ).toBe(true);
    expect(
      hasMultipleRenderedTextLines([
        { top: 10, width: 20, height: 13 },
        { top: 10.1, width: 18, height: 13 },
      ])
    ).toBe(false);
  });

  it("limits pageless border cleanup to Lydia mode", () => {
    expect(isSrTradingLydiaPagelessMode("?isLydiaMode=1")).toBe(true);
    expect(isSrTradingLydiaPagelessMode("?devMode=1")).toBe(false);
    expect(isSrTradingLydiaPagelessMode("")).toBe(false);
  });
});
