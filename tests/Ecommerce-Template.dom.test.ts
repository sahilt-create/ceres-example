/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import {
  drawRiyalSigns,
  fitTotals,
  placeFootersOnPageEdge,
  registerEcommerceLogo,
  respellTaxWords,
  stretchItemTable,
} from "../src/templates/Ecommerce-Template/helpers";

const css = fs.readFileSync(
  path.join(__dirname, "../src/templates/Ecommerce-Template/styles.css"),
  "utf8"
);

describe("Ecommerce template — after the render, in the browser", () => {
  it("hides an image that fails to load, so no broken mark or alt text prints", () => {
    registerEcommerceLogo();
    document.body.innerHTML =
      '<div class="ec-doc"><img class="ec-signature-image" alt="Authorised Signatory" /></div><img id="outside" alt="" />';
    const signature = document.querySelector(
      ".ec-signature-image"
    ) as HTMLImageElement;
    signature.dispatchEvent(new Event("error"));
    document.getElementById("outside")?.dispatchEvent(new Event("error"));
    expect(signature.classList.contains("is-broken")).toBe(true);
    expect(
      document.getElementById("outside")?.classList.contains("is-broken")
    ).toBe(false);
    expect(css).toMatch(/\.ec-doc img\.is-broken \{\s*visibility: hidden;/);
  });

  it("draws each Saudi riyal sign from an image, the empty box gone", () => {
    document.body.innerHTML =
      '<div class="ec-doc"><td>\u20C1 100.00</td><span>(\u20C1 18.00)</span></div>';
    drawRiyalSigns();
    expect(document.querySelectorAll(".ec-riyal")).toHaveLength(2);
    expect(document.body.textContent).toBe("\u20C1 100.00(\u20C1 18.00)");
    drawRiyalSigns();
    expect(document.querySelectorAll(".ec-riyal")).toHaveLength(2);
    expect(css).toMatch(
      /\.ec-doc \.ec-riyal \{[^}]*mask: url\("data:image\/png;base64,/
    );
  });

  it("rewrites the tax summaries' words in the document currency after the render", () => {
    document.body.innerHTML =
      '<div class="ec-doc" data-ec-currency="USD"><section data-section="tax-summary"><table>' +
      "<tr><td>Total</td><td>$5,400.18</td></tr>" +
      '<tr><td class="ceres-table-words">Total Tax In Words: FIVE THOUSAND RUPEES ONLY</td></tr>' +
      "</table></section></div>";
    respellTaxWords();
    expect(document.querySelector(".ceres-table-words")?.textContent).toBe(
      "Total Tax In Words: FIVE THOUSAND FOUR HUNDRED DOLLARS AND EIGHTEEN CENTS ONLY"
    );
  });
  it("keeps the totals' figures on the page when the table is cut at its edge", () => {
    // Five columns of 100 px from x = 0 in a 330 px box: columns 1-3 are wholly on the page.
    document.body.innerHTML =
      '<div class="box"><table class="ec-items"><thead><tr>' +
      "<th>Sr</th><th>Item</th><th>A</th><th>B</th><th>C</th></tr></thead>" +
      '<tbody><tr><th colspan="2">Total</th><td class="ec-fill"></td><td class="ec-fill"></td>' +
      '<td data-ec-fit><div class="ec-fig"><span>100</span></div></td></tr></tbody></table></div>';
    const rect = (left: number, width: number) =>
      ({
        left,
        right: left + width,
        width,
        top: 0,
        bottom: 10,
        height: 10,
      } as DOMRect);
    const box = document.querySelector(".box") as HTMLElement;
    box.getBoundingClientRect = () => rect(0, 330);
    document.querySelectorAll("thead th").forEach((cell, index) => {
      (cell as HTMLElement).getBoundingClientRect = () =>
        rect(index * 100, 100);
    });
    const row = () =>
      Array.from(document.querySelectorAll("tbody tr > *")).map((cell) =>
        cell.hasAttribute("data-ec-fit") ? "value" : cell.className || "label"
      );
    fitTotals();
    // The label spans columns 1-2, so the figure takes column 3 and both empty cells follow it.
    expect(row()).toEqual([
      "label",
      "value",
      "ec-fill ec-fill-after",
      "ec-fill ec-fill-after",
    ]);
    // Laid out again with room for every column, the figure is back in the last one.
    box.getBoundingClientRect = () => rect(0, 600);
    fitTotals();
    expect(row()).toEqual(["label", "ec-fill", "ec-fill", "value"]);
  });
  it("leaves the last-page footer after the content when the layout is not paginated", () => {
    // The PDF service switches to print media before it prints: forced breaks collapse, so a
    // page edge cannot be measured and the footer must not be pushed onto a page of its own.
    document.body.innerHTML =
      '<div class="ec-doc"><p>Content</p><div class="ec-letterhead-footer">Footer</div></div>';
    const footer = document.querySelector(
      ".ec-letterhead-footer"
    ) as HTMLElement;
    footer.getClientRects = () => [{}] as unknown as DOMRectList;
    footer.getBoundingClientRect = () =>
      ({
        top: 500,
        bottom: 560,
        height: 60,
        left: 0,
        right: 700,
        width: 700,
      } as DOMRect);
    // The two collapsed breaks sit one flex gap apart.
    let marker = 0;
    const realCreate = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = realCreate(tag);
      const top = 480 + 20 * marker;
      marker += 1;
      element.getBoundingClientRect = () => ({ top } as DOMRect);
      return element;
    });
    placeFootersOnPageEdge();
    jest.restoreAllMocks();
    expect(footer.style.breakBefore).toBe("");
    expect(footer.style.marginTop).toBe("");
  });

  describe("the item table's stretch", () => {
    const realMatchMedia = window.matchMedia;
    const media = (print: boolean) => {
      window.matchMedia = ((query: string) =>
        ({
          matches: print && /print/.test(query),
          media: query,
        } as MediaQueryList)) as typeof window.matchMedia;
    };
    const sheet = (className: string, width: number, height: number) => {
      document.body.innerHTML =
        `<div class="${className}"><table class="ec-page-frame"><tbody><tr><td>` +
        '<div class="ec-items-scroll"><table class="ec-items"><tbody>' +
        '<tr class="ec-item-row"><td>1</td></tr>' +
        '<tr class="ec-filler"><td class="ec-col-serial"></td></tr>' +
        "</tbody></table></div></td></tr></tbody></table></div>";
      const doc = document.querySelector(".ec-doc") as HTMLElement;
      // The sheet's height without the filler: the filler's own height never counts.
      doc.getBoundingClientRect = () =>
        ({
          width,
          height: doc.classList.contains("is-screen-stretch") ? 9999 : height,
        } as DOMRect);
      return {
        doc,
        filler: document.querySelector(".ec-filler") as HTMLElement,
      };
    };
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    it("fills a short document's preview to one A4 sheet, whatever the toggles", () => {
      media(false);
      // No is-stretch: the business toggle is off, the preview stretches all the same.
      const { doc, filler } = sheet("ec-doc", 1000, 900);
      stretchItemTable();
      expect(doc.classList.contains("is-screen-stretch")).toBe(true);
      expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
        "514px"
      );
      // Measured again (resize, fonts, live update): the same height, never growing on itself.
      stretchItemTable();
      expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
        "514px"
      );
      expect(filler.style.getPropertyValue("--ec-filler-height")).toBe("");
    });

    it("leaves a long, narrow or pageless preview as it is", () => {
      media(false);
      const cases: Array<[string, number, number]> = [
        ["ec-doc is-stretch", 1000, 1500],
        ["ec-doc", 500, 300],
        ["ec-doc is-pageless", 1000, 300],
      ];
      cases.forEach(([className, width, height]) => {
        const { doc, filler } = sheet(className, width, height);
        stretchItemTable();
        expect(doc.classList.contains("is-screen-stretch")).toBe(false);
        expect(filler.style.getPropertyValue("--ec-screen-filler-height")).toBe(
          ""
        );
      });
    });

    it("stretches the printout by the business toggle alone, the preview's stretch off", () => {
      media(false);
      const off = sheet("ec-doc", 1000, 900);
      stretchItemTable();
      media(true);
      stretchItemTable();
      expect(off.doc.classList.contains("is-screen-stretch")).toBe(false);
      expect(off.filler.style.getPropertyValue("--ec-filler-height")).toBe("");
      const on = sheet("ec-doc is-stretch", 714, 900);
      stretchItemTable();
      expect(on.filler.style.getPropertyValue("--ec-filler-height")).toMatch(
        /^max\(0px, calc\(100vh \/ 1 - \d+px\)\)$/
      );
      // Back on screen, the preview's stretch returns.
      media(false);
      stretchItemTable();
      expect(on.doc.classList.contains("is-screen-stretch")).toBe(true);
      expect(on.filler.style.getPropertyValue("--ec-filler-height")).toBe("");
    });

    it("prints a document longer than a page as with the stretch off: no empty box under the last row", () => {
      // The filler's rules are as wide as it is tall, so at 0 px it draws nothing.
      expect(css).toMatch(
        /\.ec-doc\.is-stretch \.ec-items-scroll \.ec-items \.ec-filler > td \{\s*height: var\(--ec-filler-height, 0(?:px)?\);\s*border-inline-end-width: min\(\s*var\(--ec-rule-width\),\s*var\(--ec-filler-height, 0px\)\s*\);/
      );
      // No rule above it, either medium.
      expect(css).toMatch(
        /\.ec-doc \.ec-items-scroll \.ec-items \.ec-filler > td \{\s*padding-block: 0;\s*border-top: 0;/
      );
      // The column rules once drawn under a page's last row are gone.
      expect(css).not.toMatch(
        /--ec-column-rules|\.is-stretch \.ec-items-scroll \{/
      );
    });
  });
});
