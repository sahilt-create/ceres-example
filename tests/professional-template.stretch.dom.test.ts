/**
 * @jest-environment jsdom
 */
import {
  fitItemsToScreen,
  stretchItemTable,
} from "../src/templates/professional-template/helpers";

const media = (print: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: print && query === "print",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

// jsdom lays nothing out: the document's layout size is given here.
const mount = (classes = "", width = 1000, height = 600) => {
  document.body.innerHTML = `<div class="pt-doc${classes}"><table class="pt-page-frame"><tbody><tr><td><div class="pt-items-scroll"><table class="pt-items"><tbody><tr class="pt-item-row"><td>1</td></tr><tr class="pt-filler"><td></td></tr></tbody></table></div></td></tr></tbody></table></div>`;
  const doc = document.querySelector<HTMLElement>(".pt-doc") as HTMLElement;
  Object.defineProperty(doc, "offsetWidth", {
    configurable: true,
    value: width,
  });
  // The filler's height never counts: the document is measured without it.
  Object.defineProperty(doc, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
  const filler = doc.querySelector<HTMLElement>(".pt-filler") as HTMLElement;
  return { doc, filler };
};

const fillerHeight = (filler: HTMLElement) =>
  filler.style.getPropertyValue("--pt-filler-height");

// The preview always fills one A4 sheet, whatever the toggles (user, 2026-10-31).
describe("Professional Template — the preview's A4 sheet", () => {
  afterEach(() => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 0,
    });
  });

  it("gives a short document's spare height to the filler, toggles off", () => {
    media(false);
    const { doc, filler } = mount();
    stretchItemTable();
    // 1000 px wide: an A4 sheet is 1414 px tall.
    expect(fillerHeight(filler)).toBe("814px");
    expect(doc.classList.contains("is-filled")).toBe(true);
  });

  it("measures the same again with the filler in place (no loop)", () => {
    media(false);
    const { filler } = mount(" is-stretch");
    stretchItemTable();
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("814px");
  });

  it("gives a document taller than the sheet no filler", () => {
    media(false);
    const { doc, filler } = mount("", 1000, 1600);
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("0px");
    expect(doc.classList.contains("is-filled")).toBe(false);
  });

  it("leaves a Pageless document as it is", () => {
    media(false);
    const { doc, filler } = mount(" is-pageless");
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
  });

  it("leaves the cards and grid layouts as they are", () => {
    media(false);
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 700,
    });
    const { doc, filler } = mount();
    fitItemsToScreen();
    expect(document.querySelector(".pt-items.is-grid")).not.toBeNull();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
  });

  it("fills the sheet after the screen layout is chosen", () => {
    media(false);
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1200,
    });
    const { doc, filler } = mount();
    fitItemsToScreen();
    expect(fillerHeight(filler)).toBe("814px");
    expect(doc.classList.contains("is-filled")).toBe(true);
  });

  // In print the business's toggle decides; the preview's filler goes.
  it("drops the preview's filler in print without the business toggle", () => {
    media(false);
    const { doc, filler } = mount();
    stretchItemTable();
    media(true);
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("");
    expect(doc.classList.contains("is-filled")).toBe(false);
    // Print ends: the preview fills its sheet again.
    media(false);
    stretchItemTable();
    expect(fillerHeight(filler)).toBe("814px");
  });

  it("stretches in print with the business toggle", () => {
    media(true);
    const { doc, filler } = mount(" is-stretch");
    stretchItemTable();
    expect(doc.classList.contains("is-filled")).toBe(true);
    expect(fillerHeight(filler)).toMatch(/^max\(0px, calc\(100vh/);
  });
});
