/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";
import {
  joinTotals,
  markCroppedTable,
  splitTotals,
} from "../src/templates/enterprise-template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = () => {
  document.body.innerHTML = `<div class="en-items-scroll"><table class="en-items"><thead><tr><th>Sr.</th><th>Item</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody><tbody class="en-items-total"><tr><td>T</td><td>1</td></tr></tbody></table></div>`;
  return document.querySelector<HTMLTableElement>(
    ".en-items"
  ) as HTMLTableElement;
};

describe("Enterprise Template — totals in print", () => {
  // 2026-11-19: the Total row stays in the item table in print (its own table's copied
  // columns drifted off the item columns'); it keeps to the last item's page instead.
  it("keeps the totals in the item table in print, on the last item's page", () => {
    printing(true);
    const table = mount();
    splitTotals();
    expect(table.nextElementSibling).toBeNull();
    expect(table.querySelectorAll(".en-items-total")).toHaveLength(1);
    const css = fs.readFileSync(
      path.join(__dirname, "../src/templates/enterprise-template/styles.css"),
      "utf8"
    );
    expect(css).toMatch(
      /\.en-items > tbody\.en-items-total > tr \{\s*break-before: avoid;/
    );
  });

  it("leaves the table whole outside print, and joins it back in order", () => {
    printing(false);
    const table = mount();
    const before = table.innerHTML;
    splitTotals();
    expect(table.nextElementSibling).toBeNull();
    printing(true);
    splitTotals();
    joinTotals();
    expect(table.nextElementSibling).toBeNull();
    expect(table.innerHTML).toBe(before);
  });

  it("closes a table cut at the page's edge with the wrapper's own right edge", () => {
    printing(true);
    const table = mount();
    const wrap = table.parentElement as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(table, "scrollWidth", {
      configurable: true,
      value: 620,
    });
    markCroppedTable();
    expect(wrap.classList.contains("is-cropped")).toBe(true);
    Object.defineProperty(table, "scrollWidth", {
      configurable: true,
      value: 500,
    });
    markCroppedTable();
    expect(wrap.classList.contains("is-cropped")).toBe(false);
    printing(false);
    Object.defineProperty(table, "scrollWidth", {
      configurable: true,
      value: 620,
    });
    markCroppedTable();
    expect(wrap.classList.contains("is-cropped")).toBe(false);
  });
});
