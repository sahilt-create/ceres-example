/**
 * @jest-environment jsdom
 */
import { applyBrowserPrintPage } from "../src/templates/professional-template/helpers";

const page = () => document.getElementById("pt-browser-page")?.textContent;

describe("Professional Template — a browser's print takes the side margins", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.className = "";
  });

  it("writes an @page margin from the document's setting", () => {
    document.body.innerHTML = `<div class="pt-doc" data-pt-side-margin="2"></div>`;
    applyBrowserPrintPage();
    expect(page()).toBe("@page { margin: 0 2cm; }");
  });

  it("divides the margins by the print size zoom, which scales them", () => {
    document.body.innerHTML = `<div class="pt-doc" data-pt-side-margin="1"></div>`;
    const zoom = document.createElement("style");
    zoom.id = "ceres-template-zoom";
    zoom.textContent = "@media print { html { zoom: 1.25; } }";
    document.head.append(zoom);
    applyBrowserPrintPage();
    expect(page()).toBe("@page { margin: 0 0.8cm; }");
  });

  it("leaves the PDF service's own margins alone", () => {
    document.body.className = "isDibella";
    document.body.innerHTML = `<div class="pt-doc" data-pt-side-margin="2"></div>`;
    applyBrowserPrintPage();
    expect(page()).toBeUndefined();
  });
});
