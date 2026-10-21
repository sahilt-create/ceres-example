/**
 * @jest-environment jsdom
 */
import { fitPrintTable } from "../src/templates/Ecommerce-Template/helpers";

const printing = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

/* A table in a 432 px box whose width shrinks with --ec-print-fit down to `atFloor`. */
const mount = (natural: number, atFloor: number) => {
  document.body.innerHTML = `<div class="ec-items-scroll"><table class="ec-items"><tbody><tr><td>1</td></tr></tbody></table></div>`;
  const table = document.querySelector<HTMLTableElement>(".ec-items")!;
  const box = table.parentElement!;
  const rect = (width: number) => ({ width } as DOMRect);
  box.getBoundingClientRect = () => rect(432);
  table.getBoundingClientRect = () => {
    const fit = parseFloat(table.style.getPropertyValue("--ec-print-fit")) || 1;
    // Text and padding shrink until their floors, at fit 0.5.
    return rect(atFloor + (natural - atFloor) * ((fit - 0.5) / 0.5));
  };
  return table;
};

describe("Ecommerce template — print table fit", () => {
  it("scales a table still a little too wide at its floors, rather than cutting its last column", () => {
    printing(true);
    const table = mount(700, 449);
    fitPrintTable();
    expect(table.style.getPropertyValue("--ec-print-fit")).toBe("0.5");
    expect(table.style.getPropertyValue("--ec-table-zoom")).toBe("0.962");
  });

  it("leaves a far wider table cut at the page edge instead of shrinking it to unreadable type", () => {
    printing(true);
    const table = mount(1800, 1100);
    fitPrintTable();
    expect(table.style.getPropertyValue("--ec-table-zoom")).toBe("");
  });

  it("does nothing outside print, and clears an earlier fit", () => {
    printing(true);
    const table = mount(700, 449);
    fitPrintTable();
    printing(false);
    fitPrintTable();
    expect(table.style.getPropertyValue("--ec-table-zoom")).toBe("");
    expect(table.style.getPropertyValue("--ec-print-fit")).toBe("");
    expect(table.classList.contains("is-print-fit")).toBe(false);
  });
});
