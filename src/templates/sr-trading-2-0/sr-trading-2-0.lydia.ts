/** SR Trading-specific Lydia hooks kept outside the standard template folder. */
type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const firstText = (...values: unknown[]): string =>
  values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean) ?? "";

const imageSource = (value: unknown): string => {
  const record = asRecord(value);
  const source = firstText(
    typeof value === "string" ? value : "",
    record.url,
    record.src,
    record.image,
    record.value,
    record.data,
    record.base64
  );

  if (!source) return "";
  if (/^(?:data:|https?:|blob:|\/)/i.test(source)) return source;
  return `data:image/png;base64,${source}`;
};

export const applySrTradingCatalogueLogoUpdate = (
  value: unknown,
  root: ParentNode = document
): boolean => {
  const image = root.querySelector<HTMLImageElement>(
    'img[data-ceres-field="logo"]'
  );
  if (!image) return false;

  const container = image.closest<HTMLElement>(
    '[data-ceres-field-container="logo"]'
  );
  const source = imageSource(value);

  if (source) {
    image.src = source;
    container?.classList.remove("is-empty");
  } else {
    image.removeAttribute("src");
    container?.classList.add("is-empty");
  }

  return true;
};

export const registerSrTradingLydiaUpdates = (): void => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const state = window as typeof window & {
    srTradingLydiaUpdatesRegistered?: boolean;
  };
  if (state.srTradingLydiaUpdatesRegistered) return;
  state.srTradingLydiaUpdatesRegistered = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent) return;

    const message = asRecord(event.data);
    if (message.type !== "lydia:template-update") return;

    const template = asRecord(message.template);
    if (!Object.prototype.hasOwnProperty.call(template, "logo")) return;
    applySrTradingCatalogueLogoUpdate(template.logo);
  });
};
