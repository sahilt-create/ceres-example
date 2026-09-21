const PAGED_PRINT_CLASS = "is-sri-paged-print";
const PAGELESS_PRINT_CLASS = "is-sri-lydia-pageless-print";

export const isSriLankanLydiaPagelessMode = (search: string): boolean =>
  new URLSearchParams(search).has("isLydiaMode");

const setSriLankanPrintMode = (enabled: boolean): void => {
  if (!document.body) return;

  const isPageless = isSriLankanLydiaPagelessMode(window.location.search);
  document.body.classList.toggle(PAGED_PRINT_CLASS, enabled && !isPageless);
  document.body.classList.toggle(PAGELESS_PRINT_CLASS, enabled && isPageless);
};

export const registerSriLankanPrintMode = (): void => {
  const state = window as typeof window & {
    sriLankanPrintModeRegistered?: boolean;
  };
  if (state.sriLankanPrintModeRegistered) return;

  state.sriLankanPrintModeRegistered = true;
  window.addEventListener("beforeprint", () => setSriLankanPrintMode(true));
  window.addEventListener("afterprint", () => setSriLankanPrintMode(false));

  const printMedia = window.matchMedia("print");
  printMedia.addEventListener("change", (event) => {
    setSriLankanPrintMode(event.matches);
  });
};
