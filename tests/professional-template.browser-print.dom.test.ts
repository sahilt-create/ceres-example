/**
 * @jest-environment jsdom
 */
import {
  clearPreparedPrint,
  fitPrintTable,
  prepareBrowserPrint,
  printMediaText,
  setProfessionalStylesheetText,
  syncPrintWidths,
  withPrintRules,
  withReadableStylesheet,
} from "../src/templates/professional-template/helpers";

describe("Professional Template — a browser's own print", () => {
  it("reads each media query as print would on the page", () => {
    expect(printMediaText("print", 718)).toBe("all");
    expect(printMediaText("screen", 718)).toBe("not all");
    expect(printMediaText("screen and (width <= 720px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 479)).toBe("all");
    expect(printMediaText("(prefers-color-scheme: dark)", 718)).toBeUndefined();
  });

  it("switches the print rules on for one measurement and back", () => {
    document.head.innerHTML =
      "<style>@media print { .probe { color: red; } } @media screen { .probe { color: blue; } }</style>";
    const sheet = document.styleSheets[0];
    const media = () =>
      Array.from(sheet.cssRules).map(
        (rule) => (rule as CSSMediaRule).media.mediaText
      );
    expect(withPrintRules(718, media)).toEqual(["all", "not all"]);
    expect(media()).toEqual(["print", "screen"]);
    expect(() =>
      withPrintRules(718, () => {
        throw new Error("measure failed");
      })
    ).toThrow("measure failed");
    expect(media()).toEqual(["print", "screen"]);
  });

  it("prepares before printing, leaving the screen layout as it was", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="pt-doc" style="--pt-print-width: 714px;"><div class="pt-items-scroll"><table class="pt-items is-cards"></table></div></div>`;
    prepareBrowserPrint();
    expect(document.querySelector<HTMLElement>(".pt-doc")?.style.width).toBe(
      ""
    );
    expect(document.querySelector(".pt-items")?.className).toBe(
      "pt-items is-cards"
    );
  });

  // Refrens' PDF service makes its PDF in print media, and making it fires beforeprint.
  it("prepares nothing when print media is on already (the PDF service)", () => {
    document.body.innerHTML = `<div class="pt-doc" style="--pt-print-width: 714px;"></div>`;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: /print/.test(query),
      media: query,
    })) as unknown as typeof window.matchMedia;
    const layout = jest.fn();
    try {
      prepareBrowserPrint(layout);
    } finally {
      window.matchMedia = original;
    }
    expect(layout).not.toHaveBeenCalled();
  });

  it("measures with a readable copy of a stylesheet from another origin", () => {
    setProfessionalStylesheetText(
      '@import url("font.css"); .probe { color: red; }'
    );
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://example.com/templates/professional-template/1.0.1/bundle.css">';
    const link = document.querySelector("link") as HTMLLinkElement;
    // A sheet whose rules cannot be read, as a cross-origin one.
    const foreign = {
      disabled: false,
      get cssRules(): CSSRuleList {
        throw new DOMException("cross-origin", "SecurityError");
      },
    };
    Object.defineProperty(link, "sheet", { value: foreign });
    const during = withReadableStylesheet(() => ({
      copy: document.querySelector("style[data-pt-measure]")?.textContent,
      on: !(
        document.querySelector("style[data-pt-measure]") as HTMLStyleElement
      ).sheet?.disabled,
      original: foreign.disabled,
    }));
    expect(during).toEqual({
      copy: '@import url("font.css"); .probe { color: red; }',
      on: true,
      original: true,
    });
    expect(foreign.disabled).toBe(false);
    expect(
      (document.querySelector("style[data-pt-measure]") as HTMLStyleElement)
        .sheet?.disabled
    ).toBe(true);
  });

  // Lydia changes the print size live: the renderer rewrites its zoom style, no new render.
  it("follows a print zoom changed live", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="pt-doc" style="--pt-print-width: 714px; --pt-browser-print-width: 714px; --pt-print-base: 718.1102px; --pt-browser-print-base: 718.1102px;"></div>`;
    const doc = document.querySelector<HTMLElement>(".pt-doc") as HTMLElement;
    syncPrintWidths();
    expect(doc.style.getPropertyValue("--pt-print-width")).toBe("714px");
    const zoom = document.createElement("style");
    zoom.id = "ceres-template-zoom";
    zoom.textContent = "@media print { html { zoom: 1.2; } }";
    document.head.append(zoom);
    syncPrintWidths();
    expect(doc.style.getPropertyValue("--pt-print-width")).toBe("594px");
    expect(doc.style.getPropertyValue("--pt-browser-print-width")).toBe(
      "594px"
    );
    // Back to 0.8, which the renderer draws by removing its style: zoom 1 widths.
    zoom.remove();
    syncPrintWidths();
    expect(doc.style.getPropertyValue("--pt-print-width")).toBe("714px");
  });

  // A wide table scales the whole document (user, 2026-10-31), as refrens.com's PDF does.
  const wideTable = (need: number) => {
    document.body.innerHTML = `<div class="pt-doc" style="--pt-print-width: 714px;"><div class="pt-items-scroll"><table class="pt-items"></table></div></div>`;
    const doc = document.querySelector(".pt-doc") as HTMLElement;
    const box = document.querySelector(".pt-items-scroll") as HTMLElement;
    const table = document.querySelector(".pt-items") as HTMLElement;
    // The room grows as the document is laid out wider by 1 / fit; the table's narrowest stays.
    const fit = () =>
      parseFloat(doc.style.getPropertyValue("--pt-doc-fit")) || 1;
    box.getBoundingClientRect = () => ({ width: 714 / fit() } as DOMRect);
    table.getBoundingClientRect = () => ({ width: need } as DOMRect);
    table.getClientRects = () => [{}] as unknown as DOMRectList;
    return { doc, fit };
  };
  const inPrint = <T>(run: () => T): T => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: /print/.test(query),
      media: query,
    })) as unknown as typeof window.matchMedia;
    try {
      return run();
    } finally {
      window.matchMedia = original;
    }
  };

  it("scales the whole document so a wide table fits, and leaves a narrow one alone", () => {
    const wide = wideTable(980);
    inPrint(() => fitPrintTable());
    // 714 × 0.99 / 980 = 0.721
    expect(wide.fit()).toBeCloseTo(0.721, 2);
    fitPrintTable(); // screen: no fit
    expect(wide.doc.style.getPropertyValue("--pt-doc-fit")).toBe("");
    const narrow = wideTable(600);
    inPrint(() => fitPrintTable());
    expect(narrow.doc.style.getPropertyValue("--pt-doc-fit")).toBe("");
  });

  // A browser's print counts pages from the prepared layout; what prints must match it.
  it("allows for print's wider text when preparing, then keeps what was prepared", () => {
    const { doc, fit } = wideTable(700);
    // 700 px in screen media fits 714 × 0.99; with print's wider text (× 1.06) it does not.
    prepareBrowserPrint(() => fitPrintTable());
    const prepared = Number(doc.dataset.ptPreparedZoom);
    expect(prepared).toBeLessThan(1);
    // In print the same table would fit unscaled, yet keeps the prepared scale.
    inPrint(() => fitPrintTable());
    expect(fit()).toBe(prepared);
    clearPreparedPrint();
    expect(doc.dataset.ptPreparedZoom).toBeUndefined();
  });

  // The item photos' print cap is a share of the page's height: measured in the window's.
  it("measures with the page's vh and leaves none behind", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="pt-doc" style="--pt-print-width: 736px; --pt-browser-print-height: 1268px;"></div>`;
    const doc = document.querySelector<HTMLElement>(".pt-doc") as HTMLElement;
    let during = "";
    prepareBrowserPrint(() => {
      during = doc.style.getPropertyValue("--pt-vh");
    });
    expect(during).toBe("12.68px");
    expect(doc.style.getPropertyValue("--pt-vh")).toBe("");
  });
});
