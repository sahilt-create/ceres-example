/**
 * @jest-environment jsdom
 */
import {
  footerEdgeGap,
  placeFootersOnPageEdge,
  registerModernManufacturingPrint,
  resetFootersOnPageEdge,
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

  it("stays out of Lydia's Pageless PDF and browsers without matchMedia", () => {
    window.history.replaceState(null, "", "/?isLydiaMode=1");
    registerModernManufacturingPrint();
    expect(listeners).toHaveLength(0);

    delete registered().mmPrintRegistered;
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    registerModernManufacturingPrint();
    expect(registered().mmPrintRegistered).toBeUndefined();
  });
});
