/**
 * @jest-environment jsdom
 */
import {
  applyInvoiceUpdate,
  applyTemplateUpdate,
  fitPrintTable,
  loadScriptFont,
  resetItemsTableStretch,
  stretchItemsTable,
  stretchItemsToSheet,
  footerEdgeGap,
  placeFootersOnPageEdge,
  registerModernManufacturingPrint,
  resetFootersOnPageEdge,
  respellTaxWords,
  drawRiyalSigns,
  stackCrampedFields,
  labelSummaryCells,
  printMediaText,
  withPrintRules,
  prepareBrowserPrint,
  setModernManufacturingStylesheetText,
  withReadableStylesheet,
} from "../src/templates/modern-manufacturing-template/helpers";

/*
 * jsdom has no layout, so each test describes the printed pages: where the page holding the
 * end of the content ends, how tall a page is, where the footer sits, and the print zoom.
 */
interface Layout {
  pageEnd: number;
  pageHeight: number;
  footerTop: number;
  footerHeight: number;
  scale?: number;
  // Where the footer starts once it is forced onto a page of its own.
  brokenTop?: number;
  // Extra laid-out pixels the footer ends up lower than asked (a misjudged placement).
  drift?: number;
  hidden?: boolean;
}

const rect = (top: number, height: number) =>
  ({ top, height, bottom: top + height } as DOMRect);

const mockLayout = (layout: Layout) => {
  const scale = layout.scale ?? 1;
  let markers = 0;
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function measure(this: HTMLElement) {
      if (this.style.breakBefore === "page" && !this.classList.length) {
        markers += 1;
        return rect(
          markers % 2 === 1
            ? layout.pageEnd
            : layout.pageEnd + layout.pageHeight,
          0
        );
      }
      if (this.style.height === "1000px") return rect(0, 1000 * scale);
      if (this.classList.contains("mm-letterhead-footer")) {
        const top =
          this.style.breakBefore === "page"
            ? layout.brokenTop ?? layout.pageEnd
            : layout.footerTop;
        const margin = parseFloat(this.style.marginTop) || 0;
        const drift = margin ? layout.drift ?? 0 : 0;
        return rect(top + margin * scale + drift, layout.footerHeight);
      }
      return rect(0, 0);
    });
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockImplementation(
      () => (layout.hidden ? [] : [rect(0, 1)]) as unknown as DOMRectList
    );
};

const footer = () =>
  document.querySelector<HTMLElement>(".mm-letterhead-footer") as HTMLElement;

beforeEach(() => {
  document.body.innerHTML =
    '<div class="mm-doc"><p>Content</p><div class="no-dibella invoice-letterhead-footer mm-letterhead-footer">Footer</div></div>';
});

afterEach(() => jest.restoreAllMocks());

describe("Modern Manufacturing — footer on the last page's bottom edge", () => {
  it("computes the space above the footer, 2 px spare", () => {
    const base = { pageEnd: 1000, pageHeight: 1000, footerHeight: 100 };
    expect(footerEdgeGap({ ...base, footerTop: 500 })).toBe(398);
    // Not under the content: the next page's foot.
    expect(footerEdgeGap({ ...base, footerTop: 950 })).toBe(948);
    expect(footerEdgeGap({ ...base, footerTop: 899 })).toBe(0);
    expect(footerEdgeGap({ ...base, pageHeight: 0, footerTop: 500 })).toBe(0);
    expect(footerEdgeGap({ ...base, footerHeight: 0, footerTop: 500 })).toBe(0);
  });

  it("ends the footer on the page that holds the end of the content", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("398px");
    expect(footer().style.breakBefore).toBe("");
    // The measuring markers and probe are gone.
    expect(document.querySelector(".mm-doc")?.children.length).toBe(2);
  });

  it("writes the margin in the footer's own pixels under the print zoom", () => {
    mockLayout({
      pageEnd: 1100,
      pageHeight: 1100,
      footerTop: 550,
      footerHeight: 110,
      scale: 1.1,
    });
    placeFootersOnPageEdge();
    expect(parseFloat(footer().style.marginTop)).toBeCloseTo(438 / 1.1, 5);
  });

  it("reads the margin as is when the zoom probe cannot be measured", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      scale: 0,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("398px");
  });

  it("gives a footer that does not fit a page of its own, ending at its foot", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 950,
      footerHeight: 100,
      brokenTop: 1000,
    });
    placeFootersOnPageEdge();
    expect(footer().style.breakBefore).toBe("page");
    expect(footer().style.marginTop).toBe("898px");
  });

  it("falls back to following the content when the placement misses", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      drift: 10,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
  });

  it("leaves a footer alone that already ends on the edge, or is not drawn", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 899,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");

    jest.restoreAllMocks();
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
      hidden: true,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
  });

  it("leaves the footer alone where the print is laid out but not paginated", () => {
    // Refrens' PDF service switches to print media first: forced breaks collapse.
    mockLayout({
      pageEnd: 1000,
      pageHeight: 150,
      footerTop: 500,
      footerHeight: 100,
    });
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
    expect(footer().style.breakBefore).toBe("");
  });

  it("only places the last-page footer, never the fixed or empty one", () => {
    footer().classList.add("mm-footer-fixed");
    footer().style.marginTop = "5px";
    placeFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("5px");
  });

  it("clears the placement after printing", () => {
    footer().style.marginTop = "40px";
    footer().style.breakBefore = "page";
    resetFootersOnPageEdge();
    expect(footer().style.marginTop).toBe("");
    expect(footer().style.breakBefore).toBe("");
  });
});

describe("Modern Manufacturing — print registration", () => {
  type Listener = (event: { matches: boolean }) => void;
  let listeners: Listener[];

  const registered = () =>
    window as typeof window & { mmPrintRegistered?: boolean };

  beforeEach(() => {
    listeners = [];
    delete registered().mmPrintRegistered;
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    });
    window.history.replaceState(null, "", "/");
  });

  it("places on entering print layout and clears on leaving it, once", () => {
    mockLayout({
      pageEnd: 1000,
      pageHeight: 1000,
      footerTop: 500,
      footerHeight: 100,
    });
    registerModernManufacturingPrint();
    registerModernManufacturingPrint();
    expect(listeners).toHaveLength(1);

    listeners[0]({ matches: true });
    expect(footer().style.marginTop).toBe("398px");
    listeners[0]({ matches: false });
    expect(footer().style.marginTop).toBe("");

    footer().style.marginTop = "12px";
    window.dispatchEvent(new Event("afterprint"));
    expect(footer().style.marginTop).toBe("");
  });

  it("runs inside Lydia too, and stays out of browsers without matchMedia", () => {
    // isLydiaMode is Lydia's embedded preview, where the template is printed from.
    window.history.replaceState(null, "", "/?isLydiaMode=1");
    registerModernManufacturingPrint();
    expect(listeners).toHaveLength(1);

    delete registered().mmPrintRegistered;
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    registerModernManufacturingPrint();
    expect(registered().mmPrintRegistered).toBeUndefined();
  });
});

describe("Modern Manufacturing — script font", () => {
  it("loads the script's Google font once, and nothing without one", () => {
    loadScriptFont("");
    expect(document.head.querySelectorAll("link")).toHaveLength(0);

    loadScriptFont("Noto Sans Arabic");
    loadScriptFont("Noto Sans Arabic");
    const links = document.head.querySelectorAll("link");
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe("mm-script-font-noto-sans-arabic");
    expect(links[0].getAttribute("href")).toBe(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap"
    );
  });
});

/*
 * fullHeightTable: the one printed page described as where it ends, where the document ends,
 * the last item row's height and the print zoom. A stretched row adds its extra height to the
 * document's end; `drift` adds more, as a placement that overflows the page would.
 */
interface StretchLayout {
  pageEnd: number;
  pageHeight: number;
  docEnd: number;
  rowHeight: number;
  scale?: number;
  drift?: number;
  hidden?: boolean;
  // The window's height (a 100vh probe), read when the print is not paginated.
  viewport?: number;
}

const mockStretchLayout = (layout: StretchLayout) => {
  const scale = layout.scale ?? 1;
  let markers = 0;
  const row = () =>
    document.querySelector<HTMLElement>(
      ".mm-items > tbody > tr:last-child"
    ) as HTMLElement;
  const added = () => {
    const set = parseFloat(row().style.height);
    return set ? set * scale - layout.rowHeight + (layout.drift ?? 0) : 0;
  };
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function measure(this: HTMLElement) {
      if (this.style.breakBefore === "page" && !this.classList.length) {
        markers += 1;
        return rect(
          markers % 2 === 1
            ? layout.pageEnd
            : layout.pageEnd + layout.pageHeight,
          0
        );
      }
      if (this.style.height === "1000px") return rect(0, 1000 * scale);
      if (this.style.height === "100vh") return rect(0, layout.viewport ?? 0);
      if (this.classList.contains("mm-doc")) {
        return rect(0, layout.docEnd + added());
      }
      if (this === row()) return rect(0, layout.rowHeight);
      return rect(0, 0);
    });
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockImplementation(
      () => (layout.hidden ? [] : [rect(0, 1)]) as unknown as DOMRectList
    );
};

const page = (stretch = true, extra = "") => {
  document.body.innerHTML = `<div class="mm-doc"${
    stretch ? " data-mm-stretch-table" : ""
  }${extra}><table class="mm-items"><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table></div>`;
};

const lastRow = () =>
  document.querySelector<HTMLElement>(
    ".mm-items > tbody > tr:last-child"
  ) as HTMLElement;

describe("Modern Manufacturing — table stretched to fill the page", () => {
  const onePage = { pageEnd: 1000, pageHeight: 1000, docEnd: 700 };

  it("gives a one-page document's spare height to the last item row", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    stretchItemsTable();
    // 1000 − 700 − 2 spare = 298 px more.
    expect(lastRow().style.height).toBe("338px");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);
    // The measuring markers and probe are gone.
    expect(document.querySelector(".mm-doc")?.children.length).toBe(1);
  });

  it("writes the height in the row's own pixels under the print zoom", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 44, scale: 1.1 });
    stretchItemsTable();
    expect(parseFloat(lastRow().style.height)).toBeCloseTo(342 / 1.1, 5);
  });

  it("prints a longer document, or a full page, as it is", () => {
    page();
    mockStretchLayout({ ...onePage, pageEnd: 2000, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, docEnd: 999, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, pageHeight: 0, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");
  });

  it("leaves the page height to CSS where the print is not paginated (Refrens' PDF service)", () => {
    page();
    mockStretchLayout({ ...onePage, pageHeight: 0, rowHeight: 40 });
    // jsdom drops max() / calc() heights, so the assignment itself is read.
    const heights: string[] = [];
    jest
      .spyOn(CSSStyleDeclaration.prototype, "height", "set")
      .mockImplementation((value: string) => {
        // The row's height only, not the measuring markers' and probe's.
        if (value.startsWith("max(")) heights.push(value);
      });
    stretchItemsTable();
    // The row takes what the rest of the document (700 − 40 px) and 16 px leave of the page.
    expect(heights).toEqual(["max(40px, calc(100vh / 1 - 676px))"]);
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);

    // Under a print zoom above 1, the page in the row's pixels and more kept back.
    heights.length = 0;
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "1.25" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual(["max(40px, calc(100vh / 1.25 - 708px))"]);

    // Taller than the paper: more than a page, left as it is.
    heights.length = 0;
    (document.querySelector(".mm-doc") as HTMLElement).dataset.mmPaperHeight =
      "600";
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "1" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual([]);
    delete (document.querySelector(".mm-doc") as HTMLElement).dataset
      .mmPaperHeight;

    // A zoom that is not a number reads as 1.
    heights.length = 0;
    jest
      .spyOn(window, "getComputedStyle")
      .mockReturnValue({ zoom: "normal" } as CSSStyleDeclaration);
    stretchItemsTable();
    expect(heights).toEqual(["max(40px, calc(100vh / 1 - 676px))"]);
  });

  it("undoes a stretch that would push the page over", () => {
    page();
    mockStretchLayout({ ...onePage, rowHeight: 40, drift: 10 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);
  });

  it("leaves the table alone with the toggle off, or with no row drawn", () => {
    page(false);
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    page();
    jest.restoreAllMocks();
    mockStretchLayout({ ...onePage, rowHeight: 40, hidden: true });
    stretchItemsTable();
    expect(lastRow().style.height).toBe("");

    document.body.innerHTML =
      '<div class="mm-doc" data-mm-stretch-table></div>';
    expect(() => stretchItemsTable()).not.toThrow();
  });

  it("clears the stretch after printing", () => {
    page();
    lastRow().style.height = "300px";
    lastRow().setAttribute("data-mm-stretched", "");
    resetItemsTableStretch();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);
  });

  it("ignores Lydia's live document toggle: the business's setting decides", () => {
    const doc = () => document.querySelector(".mm-doc") as HTMLElement;
    const update = (pdfOptions: unknown) =>
      applyTemplateUpdate({
        type: "lydia:template-update",
        template: { pdfOptions },
      });

    page(true);
    update({ fullHeightTable: false });
    update({ fullHeightTable: "false" });
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(true);

    page(false);
    update({ fullHeightTable: true });
    applyTemplateUpdate({ type: "lydia:print" });
    applyTemplateUpdate(null);
    expect(doc().hasAttribute("data-mm-stretch-table")).toBe(false);
  });

  it("follows Lydia's live theme colour, with its tint", () => {
    page(false);
    const doc = () => document.querySelector(".mm-doc") as HTMLElement;
    const update = (template: unknown) =>
      applyTemplateUpdate({ type: "lydia:template-update", template });

    update({ templateColor: { primaryColor: "#B91C1C" } });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#b91c1c");
    expect(doc().style.getPropertyValue("--mm-theme-tint")).toMatch(
      /^#[0-9a-f]{6}$/
    );
    update({ primaryColor: "#0a0" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#00aa00");
    // Not a colour: unchanged. The default blue: the stylesheet's own.
    update({ primaryColor: "red" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("#00aa00");
    update({ primaryColor: "#013D7F" });
    expect(doc().style.getPropertyValue("--mm-theme")).toBe("");
    expect(doc().style.getPropertyValue("--mm-theme-tint")).toBe("");
  });

  it("stretches before placing the footer when printing, whatever Lydia's toggle says", () => {
    type Listener = (event: { matches: boolean }) => void;
    const listeners: Listener[] = [];
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = jest.fn().mockReturnValue({
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    });
    window.history.replaceState(null, "", "/");
    page(true);
    mockStretchLayout({ ...onePage, rowHeight: 40 });
    registerModernManufacturingPrint();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "lydia:template-update",
          template: { pdfOptions: { fullHeightTable: false } },
        },
      })
    );
    listeners[0]({ matches: true });
    expect(lastRow().style.height).toBe("338px");
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("");

    lastRow().style.height = "50px";
    lastRow().setAttribute("data-mm-stretched", "");
    window.dispatchEvent(new Event("afterprint"));
    expect(lastRow().style.height).toBe("");
  });
});

describe("Modern Manufacturing — the preview's table stretched to an A4 sheet", () => {
  // jsdom lays nothing out: the sheet is `width` wide and `height` tall before the stretch
  // (the stretched row's own extra counted in), its last row `rowHeight`.
  const mockSheet = (width: number, height: number, rowHeight = 40) => {
    const row = () =>
      document.querySelector<HTMLElement>(
        ".mm-items > tbody > tr:last-child"
      ) as HTMLElement;
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const added = (parseFloat(row().style.height) || rowHeight) - rowHeight;
        if (this.classList.contains("mm-doc")) {
          return { ...rect(0, height + added), width } as DOMRect;
        }
        if (this === row()) return rect(0, rowHeight + added);
        return rect(0, 0);
      });
    jest
      .spyOn(HTMLElement.prototype, "getClientRects")
      .mockImplementation(() => [rect(0, 1)] as unknown as DOMRectList);
  };
  const media = (print: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: print && query === "print",
      media: query,
      addEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  };

  beforeEach(() => media(false));
  // A desktop window, so the table stays a table (fitItemsToScreen) when printing ends.
  beforeAll(() =>
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      get: () => 1200,
    })
  );
  afterAll(() => {
    delete (document.documentElement as { clientWidth?: number }).clientWidth;
  });

  it("fills a short document to one A4 sheet, whatever either toggle says", () => {
    [true, false].forEach((business) => {
      page(business);
      mockSheet(840, 700);
      stretchItemsToSheet();
      // 840 × 297 / 210 = 1188 px tall: 488 px more on the last row.
      expect(lastRow().style.height).toBe("528px");
      expect(lastRow().hasAttribute("data-mm-stretched")).toBe(true);
      // Measured again, without its own extra height: the same, never growing.
      stretchItemsToSheet();
      expect(lastRow().style.height).toBe("528px");
      jest.restoreAllMocks();
    });
  });

  it("leaves a document taller than the sheet, a Pageless one and the phone layouts as they are", () => {
    page(false);
    mockSheet(840, 1300);
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");
    expect(lastRow().hasAttribute("data-mm-stretched")).toBe(false);

    page(false, " data-mm-pageless");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");

    ["is-cards", "is-grid"].forEach((layout) => {
      page(false);
      document.querySelector(".mm-items")?.classList.add(layout);
      jest.restoreAllMocks();
      mockSheet(840, 700);
      stretchItemsToSheet();
      expect(lastRow().style.height).toBe("");
    });
  });

  it("drops a stretch the sheet no longer needs", () => {
    page(false);
    mockSheet(840, 1300);
    lastRow().style.height = "300px";
    lastRow().setAttribute("data-mm-stretched", "");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("");
  });

  it("leaves printing to the print stretch, and comes back after printing", () => {
    type Listener = (event: { matches: boolean }) => void;
    const listeners: Listener[] = [];
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    let printing = false;
    window.matchMedia = ((query: string) => ({
      matches: printing && query === "print",
      media: query,
      addEventListener: (_: string, listener: Listener) =>
        listeners.push(listener),
    })) as unknown as typeof window.matchMedia;
    window.history.replaceState(null, "", "/");
    // The business without the stretch: nothing in print, the sheet filled on screen.
    page(false);
    mockSheet(840, 700);
    registerModernManufacturingPrint();
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("528px");

    // A print stretch already in place (the PDF service) is never undone by the preview's.
    printing = true;
    listeners[0]({ matches: true });
    expect(lastRow().style.height).toBe("");
    lastRow().style.height = "77px";
    lastRow().setAttribute("data-mm-stretched", "");
    stretchItemsToSheet();
    expect(lastRow().style.height).toBe("77px");

    // Back on screen: the sheet is filled again; not between beforeprint and afterprint.
    printing = false;
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("528px");
    jest.spyOn(document, "querySelector").mockReturnValueOnce(null);
    window.dispatchEvent(new Event("beforeprint"));
    lastRow().style.removeProperty("height");
    lastRow().removeAttribute("data-mm-stretched");
    listeners[0]({ matches: false });
    expect(lastRow().style.height).toBe("");
    window.dispatchEvent(new Event("afterprint"));
    expect(lastRow().style.height).toBe("528px");
  });

  it("measures the sheet again after Lydia's live updates", () => {
    jest.useFakeTimers();
    page(false);
    mockSheet(840, 700);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "lydia:template-update", template: {} },
      })
    );
    jest.runOnlyPendingTimers();
    expect(lastRow().style.height).toBe("528px");
    jest.useRealTimers();
  });
});

describe("Modern Manufacturing — a wide table fitted to the printed page", () => {
  // The table is `natural` px wide at full size and shrinks with --mm-print-fit; its box is `room`.
  const mockWidths = (natural: number, room: number) =>
    jest
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function measure(this: HTMLElement) {
        const fit =
          parseFloat(this.style.getPropertyValue("--mm-print-fit")) || 1;
        const width = this.classList.contains("mm-items")
          ? natural * fit
          : room;
        return { width } as DOMRect;
      });
  const printing = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({ matches });
  };
  const table = () =>
    document.querySelector<HTMLElement>(".mm-items") as HTMLElement;

  beforeEach(() => {
    document.body.innerHTML =
      '<div class="mm-items-scroll"><table class="mm-items"></table></div>';
  });

  it("tightens the padding, then shrinks the text just enough to fit", () => {
    printing(true);
    mockWidths(1000, 900);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(true);
    // To 99 % of the box: 1 % is kept back for the PDF's slightly wider text.
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("0.89");
  });

  it("never shrinks below 60 %", () => {
    printing(true);
    mockWidths(1000, 400);
    fitPrintTable();
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("0.6");
  });

  it("leaves a table that fits, the screen, and a detached table as they are", () => {
    printing(true);
    mockWidths(891, 900.4);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);

    // Back on screen: the fit is cleared.
    table().classList.add("is-print-fit");
    table().style.setProperty("--mm-print-fit", "0.8");
    printing(false);
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);
    expect(table().style.getPropertyValue("--mm-print-fit")).toBe("");

    printing(true);
    const fragment = document.createDocumentFragment();
    const loose = document.createElement("table");
    loose.className = "mm-items";
    fragment.appendChild(loose);
    expect(() => fitPrintTable(fragment)).not.toThrow();
    expect(loose.classList.contains("is-print-fit")).toBe(false);

    (window as { matchMedia?: unknown }).matchMedia = undefined;
    fitPrintTable();
    expect(table().classList.contains("is-print-fit")).toBe(false);
  });

  it("fits before a browser's own print, but not again when the PDF service is already in print", () => {
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    document.body.innerHTML =
      '<div class="mm-doc" style="--mm-print-width: 714px;"><div class="mm-items-scroll"><table class="mm-items"></table></div></div>';
    mockWidths(1000, 900);
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: true, addEventListener: () => undefined });
    registerModernManufacturingPrint();
    window.dispatchEvent(new Event("beforeprint"));
    expect(table().classList.contains("is-print-fit")).toBe(false);

    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: () => undefined });
    window.dispatchEvent(new Event("beforeprint"));
    expect(table().classList.contains("is-print-fit")).toBe(true);
  });
});

describe("Modern Manufacturing — the tax summary's words in the document's currency", () => {
  const summary = (currency: string | null, total = "\u20c1 18.00") =>
    `<div class="mm-doc"${
      currency ? ` data-mm-currency="${currency}"` : ""
    }><div data-ceres-tax-summary><table><tr><td>18%</td><td>${total}</td></tr><tr><td>Total</td><td></td><td>${total}</td></tr><tr><td class="ceres-table-words">Total Tax In Words: EIGHTEEN RUPEES ONLY</td></tr></table></div></div>`;
  const words = () => document.querySelector(".ceres-table-words")?.textContent;

  it("rewrites the line from the table's Total in the document's currency", () => {
    document.body.innerHTML = summary("SAR");
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
    // Already right: left as it is.
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
  });

  it("leaves a rupee document, and a Total without a figure, as the widget wrote them", () => {
    document.body.innerHTML = summary(null);
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RUPEES ONLY");

    document.body.innerHTML = summary("SAR", "-");
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RUPEES ONLY");

    document.body.innerHTML =
      '<div class="mm-doc" data-mm-currency="SAR"><div data-ceres-tax-summary><p class="ceres-table-words">Total Tax In Words: X</p></div></div>';
    respellTaxWords();
    expect(words()).toBe("Total Tax In Words: X");
  });

  it("follows every render into the page", async () => {
    document.body.innerHTML = '<div id="documentOutput"></div>';
    const state = window as typeof window & { mmPrintRegistered?: boolean };
    delete state.mmPrintRegistered;
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ addEventListener: () => undefined });
    registerModernManufacturingPrint();
    (document.getElementById("documentOutput") as HTMLElement).innerHTML =
      summary("SAR");
    await Promise.resolve();
    expect(words()).toBe("Total Tax In Words: EIGHTEEN RIYALS ONLY");
    // The riyal sign is drawn on the same pass.
    expect(document.querySelectorAll("svg.mm-riyal").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("\u20c1");
  });
});

describe("Modern Manufacturing — the Saudi riyal sign", () => {
  it("draws every sign in the document, in the text's place, and leaves other text alone", () => {
    document.body.innerHTML =
      '<p class="outside">\u20c1 1.00</p><div class="mm-doc"><span>\u20c1 100.00</span><i class="paid">(\u20c1 118.00) / \u20c1\u20c1</i><b>\u20b9 5.00</b></div>';
    drawRiyalSigns();
    const doc = document.querySelector(".mm-doc") as HTMLElement;
    const signs = doc.querySelectorAll("svg.mm-riyal");
    expect(signs).toHaveLength(4);
    expect(doc.textContent).toBe(" 100.00( 118.00) / \u20b9 5.00");
    expect(signs[0].getAttribute("aria-label")).toBe("SAR");
    expect(signs[0].getAttribute("viewBox")).toBe("50 6 1124 1256");
    expect(signs[0].querySelector("path")?.getAttribute("d")).toMatch(
      /^M750,1119C/
    );
    // The sign sits where the character was: before the amount, inside the parentheses.
    expect((doc.querySelector(".paid") as HTMLElement).innerHTML).toMatch(
      /^\(<svg[^>]*>.*?<\/svg> 118\.00\) \/ <svg/
    );
    // Outside the document, nothing is touched; a second pass finds nothing left.
    expect(document.querySelector(".outside")?.textContent).toBe("\u20c1 1.00");
    drawRiyalSigns();
    expect(doc.querySelectorAll("svg.mm-riyal")).toHaveLength(4);
  });
});

describe("Modern Manufacturing — party fields too wide for their half", () => {
  // jsdom has no layout: each field reports the width it needs on one line.
  const grid = (needs: number[][]) => {
    document.body.innerHTML = `<div class="mm-id-grid">${needs
      .map(
        (line) =>
          `<p class="mm-id-line">${line
            .map(() => '<span class="mm-id"></span>')
            .join("")}</p>`
      )
      .join("")}</div>`;
    const fields = [...document.querySelectorAll<HTMLElement>(".mm-id")];
    needs.flat().forEach((need, i) => {
      Object.defineProperty(fields[i], "clientWidth", { value: 200 });
      Object.defineProperty(fields[i], "scrollWidth", {
        get: () => (fields[i].closest(".is-measuring") ? need : 200),
      });
    });
    return [...document.querySelectorAll<HTMLElement>(".mm-id-line")];
  };

  it("keeps every line two fields across, in order, however wide a field is", () => {
    const lines = grid([[150, 180], [150, 260], [320]]);
    stackCrampedFields();
    expect(lines.map((line) => line.classList.contains("is-stacked"))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("puts a line back side by side once its fields fit again", () => {
    const lines = grid([[150, 180]]);
    lines[0].classList.add("is-stacked");
    stackCrampedFields();
    expect(lines[0].classList.contains("is-stacked")).toBe(false);
  });
});

describe("Modern Manufacturing — summary tables as phone cards", () => {
  it("labels each cell with its column's headings, the Total row by its first cell", () => {
    document.body.innerHTML = `<div class="mm-widget-table"><table class="ceres-table">
      <thead><tr><th>Tax Rate</th><th colspan="2">IGST</th><th>Total</th></tr>
        <tr><th></th><th>Rate</th><th>Amount</th><th></th></tr></thead>
      <tbody><tr><td>18%</td><td>18%</td><td>$900.54</td><td>$900.54</td></tr></tbody>
      <tfoot><tr><td><strong>Total</strong></td><td></td><td>$900.54</td><td>$900.54</td></tr>
        <tr><td colspan="99" class="ceres-table-words">Total Tax In Words: NINE HUNDRED</td></tr></tfoot>
    </table></div>`;
    labelSummaryCells();
    const labels = (row: string) =>
      [...document.querySelectorAll(`${row} td`)].map((cell) =>
        cell.getAttribute("data-label")
      );
    expect(labels("tbody tr")).toEqual([
      "Tax Rate",
      "IGST Rate",
      "IGST Amount",
      "Total",
    ]);
    expect(labels("tfoot tr:first-child")).toEqual([
      null,
      "IGST Rate",
      "IGST Amount",
      "Total",
    ]);
    expect(labels("tfoot tr:last-child")).toEqual([null]);
    expect(
      document
        .querySelector("tfoot td:nth-child(2)")
        ?.hasAttribute("data-mm-empty")
    ).toBe(true);
  });

  it("marks figures and dates to stay on one line, never words", () => {
    document.body.innerHTML = `<div class="mm-widget-table"><table class="ceres-table">
      <thead><tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead>
      <tbody><tr><td>Sep 15, 2026</td><td>26-Dec-2025</td><td> $3.54 </td><td>Account Transfer</td><td>Bank account 0001</td></tr></tbody>
    </table></div>`;
    labelSummaryCells();
    expect(
      [...document.querySelectorAll("td")].map((cell) =>
        cell.hasAttribute("data-mm-figure")
      )
    ).toEqual([true, true, true, false, false]);
  });
});

describe("Modern Manufacturing — a browser's own print", () => {
  it("reads each media query as print would on the page", () => {
    expect(printMediaText("print", 718)).toBe("all");
    expect(printMediaText("print and (orientation: landscape)", 718)).toBe(
      "all and (orientation: landscape)"
    );
    expect(printMediaText("screen", 718)).toBe("not all");
    expect(printMediaText("screen and (width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 718)).toBe("not all");
    expect(printMediaText("(width <= 640px)", 479)).toBe("all");
    expect(printMediaText("(max-width: 720px)", 718)).toBe("all");
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
    const seen = withPrintRules(718, media);
    expect(seen).toEqual(["all", "not all"]);
    expect(media()).toEqual(["print", "screen"]);
    expect(() =>
      withPrintRules(718, () => {
        throw new Error("measure failed");
      })
    ).toThrow("measure failed");
    expect(media()).toEqual(["print", "screen"]);
  });

  it("prepares before printing, leaving the screen layout and its classes as they were", () => {
    document.head.innerHTML = "";
    document.body.innerHTML = `<div class="mm-doc" style="--mm-print-width: 714px;"><div class="mm-items-scroll"><table class="mm-items has-thumbnails is-cards"></table></div></div>`;
    prepareBrowserPrint();
    const doc = document.querySelector<HTMLElement>(".mm-doc");
    expect(doc?.style.width).toBe("");
    expect(document.querySelector(".mm-items")?.className).toBe(
      "mm-items has-thumbnails is-cards"
    );
  });
});

describe("Modern Manufacturing — the cross-origin stylesheet, readable without a request", () => {
  const crossOriginLink = () => {
    document.head.innerHTML = "";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://example.github.io/templates/modern-manufacturing-template/1.0.10/bundle.css";
    document.head.appendChild(link);
    const media = { mediaText: "" };
    Object.defineProperty(link, "sheet", {
      configurable: true,
      get: () => ({
        media,
        get cssRules() {
          throw new DOMException("cross-origin", "SecurityError");
        },
      }),
    });
    return media;
  };

  it("measures with the bundled CSS text switched on, then off again, leaving the link alone", () => {
    setModernManufacturingStylesheetText(
      '@import url("https://fonts.example/inter.css");\n@font-face { font-family: X; src: url(x.woff2); }\n@media print { .probe { color: red; } }'
    );
    const media = crossOriginLink();
    const seen = withReadableStylesheet(() => {
      const style = document.querySelector<HTMLStyleElement>(
        "style[data-mm-measure]"
      );
      return {
        enabled: style?.sheet?.disabled === false,
        text: style?.textContent ?? "",
        linkMedia: media.mediaText,
      };
    });
    expect(seen.enabled).toBe(true);
    expect(seen.linkMedia).toBe("");
    expect(seen.text).toContain("@media print");
    expect(seen.text).not.toContain("@import");
    expect(seen.text).not.toContain("@font-face");
    expect(media.mediaText).toBe("");
    expect(
      document.querySelector<HTMLStyleElement>("style[data-mm-measure]")?.sheet
        ?.disabled
    ).toBe(true);
  });

  it("never fetches the stylesheet (Refrens' PDF service answered that with a 404 page)", () => {
    crossOriginLink();
    const fetchSpy = jest.fn();
    (window as unknown as { fetch: unknown }).fetch = fetchSpy;
    withReadableStylesheet(() => undefined);
    document.dispatchEvent(new Event("load"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Modern Manufacturing — Lydia's live hide totals", () => {
  it("hides and shows the words line under the totals with the totals", () => {
    document.body.innerHTML = `<div class="mm-doc"><div data-ceres-subtotal></div>
      <p class="mm-words" data-ceres-total-in-words>Total (in words): TEN RUPEES ONLY</p></div>`;
    const line = () => document.querySelector(".mm-words") as HTMLElement;
    applyInvoiceUpdate({
      type: "lydia:invoice-update",
      fields: { hideTotals: true },
    });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(true);
    applyInvoiceUpdate({
      type: "lydia:invoice-update",
      fields: { advanceOptions: { hideTotals: false } },
    });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(false);
    // Other messages leave it alone.
    applyInvoiceUpdate({
      type: "lydia:template-update",
      fields: { hideTotals: true },
    });
    applyInvoiceUpdate({ type: "lydia:invoice-update", fields: {} });
    expect(line().classList.contains("is-hidden-by-totals")).toBe(false);
  });
});

describe("Modern Manufacturing — images that fail to load", () => {
  it("marks a failed image inside the document so it prints nothing", () => {
    registerModernManufacturingPrint();
    document.body.innerHTML = `<div class="mm-doc"><div class="mm-logo"><img class="mm-logo-image" alt="Seller"></div></div><img class="outside" alt="">`;
    const logo = document.querySelector(".mm-logo-image") as HTMLImageElement;
    const outside = document.querySelector(".outside") as HTMLImageElement;
    logo.dispatchEvent(new Event("error"));
    outside.dispatchEvent(new Event("error"));
    expect(logo.classList.contains("is-broken")).toBe(true);
    expect(outside.classList.contains("is-broken")).toBe(false);
  });
});
