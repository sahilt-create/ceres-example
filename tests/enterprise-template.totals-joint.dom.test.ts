/**
 * @jest-environment jsdom
 */
import { splitTotals } from "../src/templates/enterprise-template/helpers";

const printing = () => {
  window.matchMedia = ((query: string) => ({
    matches: /print/.test(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

const rect = (left: number, right: number, top = 0, bottom = 20) =>
  ({
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
  } as DOMRect);

// The item table's last row, its cells at these left/right edges, in a box 0–714 px wide.
const mount = (edges: Array<[number, number]>) => {
  const cells = edges.map(() => "<td>x</td>").join("");
  document.body.innerHTML = `<div class="en-items-scroll"><table class="en-items"><tbody><tr>${cells}</tr></tbody><tbody class="en-items-total"><tr>${cells}</tr></tbody></table></div>`;
  const box = document.querySelector(".en-items-scroll") as HTMLElement;
  box.getBoundingClientRect = () => rect(0, 714);
  const row = document.querySelector(
    ".en-items tbody tr"
  ) as HTMLTableRowElement;
  Array.from(row.cells).forEach((cell, i) => {
    const [left, right] = edges[i];
    // eslint-disable-next-line no-param-reassign
    cell.getBoundingClientRect = () => rect(left, right);
    // eslint-disable-next-line no-param-reassign
    cell.getClientRects = () => [rect(left, right)] as unknown as DOMRectList;
  });
  return row;
};

describe("Enterprise Template — the totals' joint on a cut-off table", () => {
  // The totals no longer move to a table of their own in print (2026-11-19, SPLIT_TOTALS
  // false): there is no joint to mark. Kept for the shared code path.
  it.skip("marks both square corners when the table fits its box", () => {
    printing();
    mount([
      [0, 300],
      [300, 714],
    ]);
    const table = document.querySelector(".en-items") as HTMLElement;
    table.getBoundingClientRect = () => rect(0, 714);
    splitTotals();
    const split = document.querySelector(
      "table[data-en-totals-split]"
    ) as HTMLElement;
    expect(split.classList.contains("is-joint-left")).toBe(true);
    expect(split.classList.contains("is-joint-right")).toBe(true);
  });

  // User (2026-11-01): a wide table is cut off at the page edge, never shrunk. Chrome 122 let
  // the corner mark past that edge escape the cut and shrank the whole PDF page to show it.
  // The totals no longer move to a table of their own in print (2026-11-19, SPLIT_TOTALS
  // false): there is no joint to mark. Kept for the shared code path.
  it.skip("leaves out the corner that falls past the page edge", () => {
    printing();
    mount([
      [0, 500],
      [500, 954],
    ]);
    const table = document.querySelector(".en-items") as HTMLElement;
    table.getBoundingClientRect = () => rect(0, 954);
    splitTotals();
    const split = document.querySelector(
      "table[data-en-totals-split]"
    ) as HTMLElement;
    expect(split.classList.contains("is-joint-left")).toBe(true);
    expect(split.classList.contains("is-joint-right")).toBe(false);
  });
});
