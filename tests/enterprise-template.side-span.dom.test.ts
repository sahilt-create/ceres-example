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

  // 2026-11-19: Additional Information | signature is one row (template.hbs), so the lines
  // keep their own heights beside a taller signature; fitSideSpans leaves that part alone.
  it("leaves the closing part (Additional Information | signature) alone", () => {
    document.body.innerHTML = part(true, 6);
    layOut([1, 20, 20, 20, 20, 20, 20, 0], 50);
    fitSideSpans();
    const side = document.querySelector(
      "td.en-bottom-side"
    ) as HTMLTableCellElement;
    expect(side.rowSpan).toBe(1000);
    expect(side.parentElement?.classList.contains("en-line-start")).toBe(true);
  });

  it("gives a bank taller than the terms' lines the closing row's room, the lines at their own heights", () => {
    document.body.innerHTML = part(false, 2);
    layOut([1, 20, 20, 8], 200);
    fitSideSpans();
    fitSideSpans();
    const side = document.querySelector(
      "td.en-bottom-side"
    ) as HTMLTableCellElement;
    expect(side.rowSpan).toBe(4);
    const last = document.querySelector(
      "tr.en-line-end > td"
    ) as HTMLTableCellElement;
    expect(last.classList.contains("is-grown")).toBe(true);
    expect(parseFloat(last.style.height)).toBeGreaterThan(8);
    expect(document.querySelectorAll("td.en-bottom-side")).toHaveLength(1);
  });
});
