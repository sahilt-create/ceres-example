import {
  hasMultipleRenderedTextLines,
  hasSolvinPrintTableOverflow,
} from "../src/templates/solvin/printFit";

const measuredWidth = (clientWidth: number, scrollWidth: number) => ({
  clientWidth,
  scrollWidth,
  getBoundingClientRect: () => ({ width: clientWidth }),
});

describe("Solvin print table fit", () => {
  it("keeps 13px typography when the table fits", () => {
    expect(
      hasSolvinPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 900)
      )
    ).toBe(false);
  });

  it("requests consistent compact typography only for real overflow", () => {
    expect(
      hasSolvinPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 940)
      )
    ).toBe(true);
  });

  it("ignores sub-pixel rounding differences", () => {
    expect(
      hasSolvinPrintTableOverflow(
        measuredWidth(900, 900),
        measuredWidth(900, 901)
      )
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
});
