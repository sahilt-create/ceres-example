/**
 * @jest-environment jsdom
 */
import { fitSideSpans } from "../src/templates/enterprise-template/helpers";

/* Rows laid out one under the other at the given heights; the side cell's parts at theirs. */
const layOut = (heights: number[], partHeight: number) => {
  let top = 0;
  document
    .querySelectorAll<HTMLTableRowElement>("tbody > tr")
    .forEach((row, i) => {
      const at = top;
      top += heights[i];
      row.getBoundingClientRect = () =>
        ({ top: at, bottom: at + heights[i], height: heights[i] } as DOMRect);
    });
  document
    .querySelectorAll<HTMLElement>(".en-bottom-side > *")
    .forEach((part) => {
      part.getBoundingClientRect = () =>
        ({ top: 0, bottom: partHeight, height: partHeight } as DOMRect);
    });
};

const part = (closing: boolean, lines: number) => `
  <div class="en-bottom${
    closing ? " en-closing" : ""
  }"><table class="en-lines"><tbody>
    <tr class="en-line-start"><td class="en-line-cell"></td><td class="en-bottom-side" rowspan="1000"><section>side</section></td></tr>
    ${Array.from(
      { length: lines },
      () => '<tr class="en-line"><td class="en-line-cell"></td></tr>'
    ).join("")}
    <tr class="en-line-end"><td class="en-line-cell"></td></tr>
  </tbody></table></div>`;

describe("Enterprise Template — the bank / signature cell spans only the rows level with it", () => {
  it("spans the bank over the first rows it needs, so the terms after it break across pages", () => {
    document.body.innerHTML = part(false, 10);
    layOut([1, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 8], 100);
    fitSideSpans();
    const side = document.querySelector(
      "td.en-bottom-side"
    ) as HTMLTableCellElement;
    const rows = Array.from(document.querySelectorAll("tbody > tr"));
    expect(rows.indexOf(side.parentElement as Element)).toBe(0);
    // 1 + 30 + 30 + 30 = 91 < 100, so a fifth row: 121.
    expect(side.rowSpan).toBe(5);
  });

  it("anchors the signature at the closing part's last rows, so it stays at the foot", () => {
    document.body.innerHTML = part(true, 6);
    layOut([1, 20, 20, 20, 20, 20, 20, 0], 50);
    fitSideSpans();
    const side = document.querySelector(
      "td.en-bottom-side"
    ) as HTMLTableCellElement;
    const rows = Array.from(document.querySelectorAll("tbody > tr"));
    // From the foot up: 0, 20, 20, 20 = 60 ≥ 50, over the last four rows.
    expect(side.rowSpan).toBe(4);
    expect(rows.indexOf(side.parentElement as Element)).toBe(rows.length - 4);
  });

  it("spans every row when the side is taller than the lines, and is stable when run again", () => {
    document.body.innerHTML = part(true, 1);
    layOut([1, 20, 0], 200);
    fitSideSpans();
    fitSideSpans();
    const side = document.querySelector(
      "td.en-bottom-side"
    ) as HTMLTableCellElement;
    expect(side.rowSpan).toBe(3);
    expect(side.parentElement?.classList.contains("en-line-start")).toBe(true);
    expect(document.querySelectorAll("td.en-bottom-side")).toHaveLength(1);
  });
});
