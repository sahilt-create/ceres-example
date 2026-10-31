/**
 * @jest-environment jsdom
 */
import {
  prepareBrowserPrint,
  printMediaText,
  setEcommerceStylesheetText,
  withPrintRules,
  withReadableStylesheet,
} from "../src/templates/Ecommerce-Template/helpers";

describe("Ecommerce — a browser's own print", () => {
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
    document.body.innerHTML = `<div class="ec-doc" style="--ec-print-width: 714px;"><div class="ec-items-scroll"><table class="ec-items is-cards"></table></div></div>`;
    prepareBrowserPrint();
    expect(document.querySelector<HTMLElement>(".ec-doc")?.style.width).toBe(
      ""
    );
    expect(document.querySelector(".ec-items")?.className).toBe(
      "ec-items is-cards"
    );
  });

  it("leaves a page already in print media (Refrens' PDF service) to the print listener", () => {
    document.body.innerHTML = `<div class="ec-doc" style="--ec-print-width: 751px; --ec-browser-print-width: 714px;"></div>`;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === "print",
      media: query,
    })) as unknown as typeof window.matchMedia;
    const layout = jest.fn();
    prepareBrowserPrint(layout);
    window.matchMedia = original;
    expect(layout).not.toHaveBeenCalled();
  });

  it("reads the cross-origin stylesheet's rules from the bundled copy, without a request", () => {
    document.head.innerHTML =
      '<link rel="stylesheet" href="https://example.github.io/templates/Ecommerce-Template/1.0.1/bundle.css">';
    const fetchSpy = jest.fn();
    (window as unknown as { fetch: unknown }).fetch = fetchSpy;
    setEcommerceStylesheetText(
      '@import url("https://fonts.googleapis.com/x");@font-face{font-family:x;src:url(x)}@media print { .probe { color: red; } }'
    );
    const seen = withReadableStylesheet(() => {
      const style = document.querySelector<HTMLStyleElement>(
        "style[data-ec-measure]"
      );
      return {
        on: Boolean(style && !style.sheet?.disabled),
        text: style?.textContent ?? "",
        rules: withPrintRules(718, () =>
          Array.from(style?.sheet?.cssRules ?? []).map(
            (rule) => (rule as CSSMediaRule).media.mediaText
          )
        ),
      };
    });
    expect(seen.on).toBe(true);
    expect(seen.text).not.toMatch(/@import|@font-face/);
    expect(seen.rules).toEqual(["all"]);
    const style = document.querySelector<HTMLStyleElement>(
      "style[data-ec-measure]"
    );
    expect(style?.sheet?.disabled).toBe(true);
    expect(style?.previousElementSibling?.tagName).toBe("LINK");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
