/** Print-fit support kept outside the standard SR Trading template folder. */
const COMPACT_PRINT_CLASS = "is-compact-print-table";
const MEASURING_PRINT_CLASS = "is-measuring-print-fit";
const FIT_TOLERANCE_PX = 1;
const NORMAL_PRINT_FONT_SIZE_PX = 13;
const DEFAULT_COMPACT_PRINT_FONT_SIZE_PX = 11;
const MINIMUM_PRINT_FONT_SIZE_PX = 8;
const PRINT_FONT_SIZE_STEP_PX = 0.5;
const PRINT_FONT_SIZE_PROPERTY = "--sr-print-table-font-size";
const PAGELESS_PRINT_CLASS = "is-lydia-pageless-print";

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

type MeasuredCell = {
  clientWidth: number;
  scrollWidth: number;
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

const hasWrappedTableHeaders = (table: HTMLElement): boolean =>
  Array.from(table.querySelectorAll("thead th")).some((header) => {
    const range = table.ownerDocument.createRange();
    range.selectNodeContents(header);
    return hasMultipleRenderedTextLines(Array.from(range.getClientRects()));
  });

export const hasSrTradingPrintTableOverflow = (
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

export const calculateSrTradingPrintFontSize = (
  wrapper: MeasuredWidth,
  table: MeasuredWidth
): number => {
  const availableWidth = Math.max(
    wrapper.clientWidth,
    wrapper.getBoundingClientRect().width
  );
  const requiredWidth = Math.max(
    table.scrollWidth,
    table.getBoundingClientRect().width
  );

  if (availableWidth <= 0 || requiredWidth <= availableWidth) {
    return DEFAULT_COMPACT_PRINT_FONT_SIZE_PX;
  }

  const scaledFontSize =
    (NORMAL_PRINT_FONT_SIZE_PX * availableWidth) / requiredWidth;
  const steppedFontSize =
    Math.floor(scaledFontSize / PRINT_FONT_SIZE_STEP_PX) *
    PRINT_FONT_SIZE_STEP_PX;

  return Math.max(
    MINIMUM_PRINT_FONT_SIZE_PX,
    Math.min(DEFAULT_COMPACT_PRINT_FONT_SIZE_PX, steppedFontSize)
  );
};

export const hasSrTradingPrintCellOverflow = (
  cells: Iterable<MeasuredCell>
): boolean =>
  Array.from(cells).some(
    (cell) =>
      cell.clientWidth > 0 &&
      cell.scrollWidth > cell.clientWidth + FIT_TOLERANCE_PX
  );

export const updateSrTradingPrintFit = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".sr-trading-document")
    .forEach((documentRoot) => {
      const wrapper =
        documentRoot.querySelector<HTMLElement>(".items-table-wrap");
      const table = documentRoot.querySelector<HTMLElement>(".items-table");

      documentRoot.classList.remove(COMPACT_PRINT_CLASS);
      documentRoot.style.removeProperty(PRINT_FONT_SIZE_PROPERTY);
      if (!wrapper || !table) return;

      const hasWrappedHeaders = hasWrappedTableHeaders(table);
      documentRoot.classList.add(MEASURING_PRINT_CLASS);
      const hasOverflow = hasSrTradingPrintTableOverflow(wrapper, table);
      const printFontSize = calculateSrTradingPrintFontSize(wrapper, table);
      const shouldCompact = hasWrappedHeaders || hasOverflow;
      documentRoot.classList.remove(MEASURING_PRINT_CLASS);
      documentRoot.classList.toggle(COMPACT_PRINT_CLASS, shouldCompact);
      if (shouldCompact) {
        let fittedFontSize = printFontSize;
        const fittedCells = table.querySelectorAll<HTMLElement>(
          "thead th, tbody td:not(.col-item)"
        );

        documentRoot.style.setProperty(
          PRINT_FONT_SIZE_PROPERTY,
          `${fittedFontSize}px`
        );

        while (
          fittedFontSize > MINIMUM_PRINT_FONT_SIZE_PX &&
          (hasSrTradingPrintTableOverflow(wrapper, table) ||
            hasSrTradingPrintCellOverflow(fittedCells))
        ) {
          fittedFontSize = Math.max(
            MINIMUM_PRINT_FONT_SIZE_PX,
            fittedFontSize - PRINT_FONT_SIZE_STEP_PX
          );
          documentRoot.style.setProperty(
            PRINT_FONT_SIZE_PROPERTY,
            `${fittedFontSize}px`
          );
        }
      }
    });
};

export const resetSrTradingPrintFit = (root: ParentNode = document): void => {
  root
    .querySelectorAll<HTMLElement>(".sr-trading-document")
    .forEach((documentRoot) => {
      documentRoot.classList.remove(COMPACT_PRINT_CLASS, MEASURING_PRINT_CLASS);
      documentRoot.style.removeProperty(PRINT_FONT_SIZE_PROPERTY);
    });
};

export const isSrTradingLydiaPagelessMode = (search: string): boolean =>
  new URLSearchParams(search).has("isLydiaMode");

const setSrTradingPagelessPrintMode = (enabled: boolean): void => {
  if (!isSrTradingLydiaPagelessMode(window.location.search)) return;
  document.body?.classList.toggle(PAGELESS_PRINT_CLASS, enabled);
};

export const registerSrTradingPrintFit = (): void => {
  const state = window as typeof window & {
    srTradingPrintFitRegistered?: boolean;
  };
  if (state.srTradingPrintFitRegistered) return;

  state.srTradingPrintFitRegistered = true;
  window.addEventListener("beforeprint", () => {
    setSrTradingPagelessPrintMode(true);
    updateSrTradingPrintFit();
  });
  window.addEventListener("afterprint", () => {
    resetSrTradingPrintFit();
    setSrTradingPagelessPrintMode(false);
  });

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", (event) => {
    if (event.matches) {
      setSrTradingPagelessPrintMode(true);
      updateSrTradingPrintFit();
      return;
    }

    resetSrTradingPrintFit();
    setSrTradingPagelessPrintMode(false);
  });
};
