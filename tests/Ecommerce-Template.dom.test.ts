/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import {
  drawRiyalSigns,
  fitTotals,
  respellTaxWords,
} from "../src/templates/Ecommerce-Template/helpers";

const css = fs.readFileSync(
  path.join(__dirname, "../src/templates/Ecommerce-Template/styles.css"),
  "utf8"
);

describe("Ecommerce template — after the render, in the browser", () => {
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
});
