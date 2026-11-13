/**
 * @jest-environment jsdom
 */
import {
  joinTotals,
  splitTotals,
} from "../src/templates/simple-template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const mount = () => {
  document.body.innerHTML = `<div class="sm-items-scroll"><table class="sm-items"><thead><tr><th>Sr.</th><th>Item</th></tr></thead><tbody><tr><td>1</td><td>A</td></tr></tbody><tbody class="sm-items-total"><tr><td>T</td><td>1</td></tr></tbody></table></div>`;
  return document.querySelector<HTMLTableElement>(
    ".sm-items"
  ) as HTMLTableElement;
};

describe("Simple Template — totals in print", () => {
  it("moves the totals into a table of their own, without the item headings", () => {
    printing(true);
    const table = mount();
    splitTotals();
    const split = table.nextElementSibling as HTMLTableElement;
    expect(split.hasAttribute("data-sm-totals-split")).toBe(true);
    expect(split.querySelector("thead")).toBeNull();
    expect(split.querySelectorAll(".sm-items-total")).toHaveLength(1);
    expect(table.querySelectorAll(".sm-items-total")).toHaveLength(0);
    expect(split.querySelectorAll("col")).toHaveLength(2);
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
});
