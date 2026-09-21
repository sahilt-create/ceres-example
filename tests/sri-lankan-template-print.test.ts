import { readFileSync } from "fs";
import { join } from "path";
import { isSriLankanLydiaPagelessMode } from "../src/templates/sri-lankan.print";

describe("Sri Lankan template print boundaries", () => {
  const css = readFileSync(
    join(process.cwd(), "src/templates/sri-lankan-template/styles.css"),
    "utf8"
  );
  const template = readFileSync(
    join(process.cwd(), "src/templates/sri-lankan-template/template.hbs"),
    "utf8"
  );
  const printCss = css.slice(css.lastIndexOf("@media print"));

  it("renders additional information only when document details configure it", () => {
    expect(template).toMatch(
      /\{\{#if sri\.showAdditionalInformation\}\}<section class="additional-info">/
    );
    expect(template).toMatch(/<\/section>\{\{\/if\}\}/);
  });

  it("centers line-item values while keeping descriptions left aligned", () => {
    expect(css).toMatch(
      /\.line-items \.item-row > td:not\(\.col-item\)\s*\{[^}]*text-align:\s*center;[^}]*vertical-align:\s*middle;/
    );
    expect(css).toMatch(
      /\.line-items \.item-row > td\.col-item\s*\{[^}]*text-align:\s*left;[^}]*vertical-align:\s*top;/
    );
  });

  it("lets the line-item table hug its content without placeholder rows", () => {
    expect(template).not.toContain("sri.blankRows");
    expect(css).not.toContain(".placeholder-row");
  });

  it("renders document details as separate bordered fields", () => {
    expect(css).toMatch(
      /\.document-details \.detail-row\s*\{[^}]*border:\s*1px solid var\(--sri-rule\);[^}]*padding:\s*5px 9px;/
    );
    expect(css).not.toMatch(
      /\.content-panel,\s*\n\.document-details\s*\{[^}]*border:/
    );
  });

  it("left-aligns statutory total labels and right-aligns their values", () => {
    expect(css).toMatch(
      /\.total-row th,\s*\n\.total-row td\s*\{[^}]*vertical-align:\s*middle;/
    );
    expect(css).toMatch(/\.total-row th\s*\{[^}]*text-align:\s*left;/);
    expect(css).toMatch(
      /\.total-row \.total-value\s*\{[^}]*text-align:\s*right;/
    );
  });

  it("renders the UPI QR at 100 by 100 pixels", () => {
    expect(css).toMatch(
      /\.upi-qr\s*\{[^}]*width:\s*100px;[^}]*height:\s*100px;/
    );
  });

  it("lets the line-item header hug its content", () => {
    expect(css).toMatch(
      /\.line-items thead th\s*\{[^}]*height:\s*auto;[^}]*text-align:\s*center;[^}]*vertical-align:\s*middle;/
    );
    expect(css).not.toMatch(/\.line-items thead th\s*\{[^}]*height:\s*72px;/);
  });

  it("leaves page geometry and recurring header space to the PDF host", () => {
    expect(printCss).not.toContain("@page {");
    expect(printCss).toContain('html,\n  body,\n  [id="documentOutput"]');
    expect(printCss).toContain("min-height: 0;");
    expect(printCss).toContain("margin: 0 !important;");
    expect(printCss).toContain("padding: 0 !important;");
    expect(printCss).toContain("overflow: visible !important;");
  });

  it("repeats the table header with a clean cap after page breaks", () => {
    expect(printCss).toMatch(
      /\.line-items thead\s*\{[^}]*display:\s*table-header-group;/
    );
    expect(printCss).toMatch(
      /\.line-items thead th\s*\{[^}]*background-image:\s*linear-gradient\(var\(--sri-rule\), var\(--sri-rule\)\);[^}]*background-size:\s*100% 0\.5px;/
    );
    expect(printCss).toMatch(
      /\.line-items tbody tr,[\s\S]*?break-inside:\s*avoid-page;/
    );
  });

  it("keeps short sections together and allows lengthy prose to fragment", () => {
    expect(printCss).toMatch(
      /\.party-grid,[\s\S]*?\.signature-section,[\s\S]*?break-inside:\s*avoid;/
    );
    expect(printCss).toMatch(
      /\.content-panel,[\s\S]*?\.content-panel \.toastui-editor-contents\s*\{[^}]*break-inside:\s*auto;/
    );
    expect(printCss).toContain("orphans: 3;");
    expect(printCss).toContain("widows: 3;");
  });

  it("keeps numeric values intact while descriptive text wraps", () => {
    expect(printCss).toMatch(
      /\.line-items td\.number-cell,[\s\S]*?white-space:\s*nowrap;/
    );
    expect(printCss).toMatch(
      /\.line-items th\.col-item,[\s\S]*?overflow-wrap:\s*break-word;/
    );
  });

  it("distinguishes Lydia pageless output from normal paged printing", () => {
    expect(isSriLankanLydiaPagelessMode("?isLydiaMode=1")).toBe(true);
    expect(isSriLankanLydiaPagelessMode("?devMode=1")).toBe(false);
    expect(isSriLankanLydiaPagelessMode("")).toBe(false);
    expect(printCss).toContain("body.is-sri-lydia-pageless-print");
  });
});
