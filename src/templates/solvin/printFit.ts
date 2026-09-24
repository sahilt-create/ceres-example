const COMPACT_PRINT_CLASS = "is-compact-print-table";
const MEASURING_PRINT_CLASS = "is-measuring-print-fit";
const FIT_TOLERANCE_PX = 1;

type MeasuredWidth = {
  clientWidth: number;
  scrollWidth: number;
  getBoundingClientRect: () => { width: number };
};

type TextRect = {
  top: number;
  width: number;
  height: number;
};

export const hasMultipleRenderedTextLines = (
  rects: Iterable<TextRect>
): boolean => {
  const lineTops = new Set(
    Array.from(rects)
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => Math.round(rect.top * 2) / 2)
  );

  return lineTops.size > 1;
};

const hasWrappedSolvinTableHeaders = (table: HTMLElement): boolean =>
  Array.from(table.querySelectorAll("thead th")).some((header) => {
    const range = table.ownerDocument.createRange();
    range.selectNodeContents(header);
    return hasMultipleRenderedTextLines(Array.from(range.getClientRects()));
  });

export const hasSolvinPrintTableOverflow = (
  wrapper: MeasuredWidth,
  table: MeasuredWidth
): boolean => {
  const availableWidth = Math.max(
    wrapper.clientWidth,
    wrapper.getBoundingClientRect().width
  );
  const requiredWidth = Math.max(
    table.scrollWidth,
    table.getBoundingClientRect().width
  );

  return (
    availableWidth > 0 && requiredWidth > availableWidth + FIT_TOLERANCE_PX
  );
};

export const updateSolvinPrintFit = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(".solvin-invoice").forEach((invoice) => {
    const wrapper = invoice.querySelector<HTMLElement>(".items-table-wrap");
    const table = invoice.querySelector<HTMLElement>(".items-table");

    invoice.classList.remove(COMPACT_PRINT_CLASS);
    if (!wrapper || !table) return;

    const hasWrappedHeaders = hasWrappedSolvinTableHeaders(table);
    invoice.classList.add(MEASURING_PRINT_CLASS);
    const shouldCompact =
      hasWrappedHeaders || hasSolvinPrintTableOverflow(wrapper, table);
    invoice.classList.remove(MEASURING_PRINT_CLASS);
    invoice.classList.toggle(COMPACT_PRINT_CLASS, shouldCompact);
  });
};

export const resetSolvinPrintFit = (root: ParentNode = document): void => {
  root.querySelectorAll<HTMLElement>(".solvin-invoice").forEach((invoice) => {
    invoice.classList.remove(COMPACT_PRINT_CLASS, MEASURING_PRINT_CLASS);
  });
};

export const registerSolvinPrintFit = (): void => {
  const state = window as typeof window & {
    solvinPrintFitRegistered?: boolean;
  };
  if (state.solvinPrintFitRegistered) return;

  state.solvinPrintFitRegistered = true;
  window.addEventListener("beforeprint", () => updateSolvinPrintFit());
  window.addEventListener("afterprint", () => resetSolvinPrintFit());

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", (event) => {
    if (event.matches) {
      updateSolvinPrintFit();
      return;
    }

    resetSolvinPrintFit();
  });
};
