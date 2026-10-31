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
    expect(table.style.getPropertyValue("--ec-table-zoom")).toBe("0.952"); // 99 % of the 432 px box: 1 % kept back for the PDF
  });

  it("scales even a far wider table to the page rather than cutting it off", () => {
    printing(true);
    const table = mount(1800, 1100);
    fitPrintTable();
    expect(table.style.getPropertyValue("--ec-table-zoom")).toBe("0.388");
  });

  it("keeps the screen's padding for a table the estimate marked compact but that fits", () => {
    printing(true);
    const table = mount(420, 300);
    table.setAttribute("data-ec-print-compact", "");
    table.classList.add("is-print-compact");
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(false);
    expect(table.classList.contains("is-print-fit")).toBe(false);
    printing(false);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(true);
  });

  it("tightens the padding of a table too wide at the screen's padding", () => {
    printing(true);
    const table = mount(700, 449);
    fitPrintTable();
    expect(table.classList.contains("is-print-compact")).toBe(true);
  });

  it("shrinks a summary too wide for the page (the payments on A5), and leaves one that fits", () => {
    printing(true);
    document.body.innerHTML = `<section class="ec-summary"><div><table class="ceres-table" id="wide"></table></div></section><section class="ec-summary"><div><table class="ceres-table" id="fits"></table></div></section>`;
    const sized = (id: string, natural: number) => {
      const table = document.getElementById(id)!;
      table.parentElement!.getBoundingClientRect = () =>
        ({ width: 432 } as DOMRect);
      table.getBoundingClientRect = () => {
        const fit =
          parseFloat(table.style.getPropertyValue("--ec-print-fit")) || 1;
        return { width: natural * fit } as DOMRect;
      };
      return table;
    };
    const wide = sized("wide", 470);
    const fits = sized("fits", 400);
    fitPrintTable();
    expect(wide.classList.contains("is-print-fit")).toBe(true);
    expect(
      parseFloat(wide.style.getPropertyValue("--ec-print-fit"))
    ).toBeLessThan(1);
    expect(wide.getBoundingClientRect().width).toBeLessThanOrEqual(432 * 0.99);
    expect(fits.classList.contains("is-print-fit")).toBe(false);
    printing(false);
    fitPrintTable();
    expect(wide.classList.contains("is-print-fit")).toBe(false);
    expect(wide.style.getPropertyValue("--ec-print-fit")).toBe("");
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
