import {
  applySrTradingCatalogueLogoUpdate,
  registerSrTradingLydiaUpdates,
} from "../src/templates/sr-trading-2-0.lydia";

describe("SR Trading Lydia asset updates", () => {
  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  it("updates and clears the catalogue logo without touching other templates", () => {
    const container = {
      classList: { add: jest.fn(), remove: jest.fn() },
    };
    const image = {
      src: "",
      closest: jest.fn(() => container),
      removeAttribute: jest.fn(),
    };
    const root = {
      querySelector: jest.fn(() => image),
    } as unknown as ParentNode;

    expect(applySrTradingCatalogueLogoUpdate("logo-base64", root)).toBe(true);
    expect(image.src).toBe("data:image/png;base64,logo-base64");
    expect(container.classList.remove).toHaveBeenCalledWith("is-empty");

    applySrTradingCatalogueLogoUpdate(null, root);
    expect(image.removeAttribute).toHaveBeenCalledWith("src");
    expect(container.classList.add).toHaveBeenCalledWith("is-empty");
  });

  it("accepts only parent Lydia template-update messages", () => {
    const listeners: Record<string, (event: MessageEvent) => void> = {};
    const parent = {};
    const container = {
      classList: { add: jest.fn(), remove: jest.fn() },
    };
    const image = {
      src: "",
      closest: jest.fn(() => container),
      removeAttribute: jest.fn(),
    };

    (global as any).window = {
      parent,
      addEventListener: jest.fn((type: string, listener: EventListener) => {
        listeners[type] = listener as (event: MessageEvent) => void;
      }),
    };
    (global as any).document = {
      querySelector: jest.fn(() => image),
    };

    registerSrTradingLydiaUpdates();
    listeners.message({
      source: {},
      data: { type: "lydia:template-update", template: { logo: "wrong" } },
    } as unknown as MessageEvent);
    expect(image.src).toBe("");

    listeners.message({
      source: parent,
      data: {
        type: "lydia:template-update",
        template: { logo: { url: "https://cdn.example.com/logo.png" } },
      },
    } as unknown as MessageEvent);
    expect(image.src).toBe("https://cdn.example.com/logo.png");
  });
});
