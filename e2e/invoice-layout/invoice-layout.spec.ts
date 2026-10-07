/**
 * Modern Manufacturing invoice template v2: design and layout tests (Playwright).
 * Replaces the previous test file.
 *
 * Figma (source of truth), node 18506:2360:
 *   https://www.figma.com/design/1rwZrxK2yuepRjxCbHmyrG/Document-Templates?node-id=18506-2360&m=dev
 *
 * Scope: design tokens, typography, spacing, section layout, toggles, table columns,
 * images, and the table responsiveness / overflow bugs. Rendered ON SCREEN only.
 * These tests never print, never generate PDFs and never change print settings.
 *
 * Expects a test page that renders the template from a fixture + settings:
 *   GET {TEST_URL}?case=<ID>&width=<container px>
 * and the hooks from INVOICE_TEMPLATE_SPEC_v2 section 11.
 *
 * Run:  npx playwright test invoice-layout.spec.ts
 * Approve new screenshots after a reviewed design change:  npx playwright test --update-snapshots
 */
import { test, expect, Page } from "@playwright/test";

const TEST_URL =
  process.env.INVOICE_TEST_URL ?? "http://localhost:3000/__test__/invoice";

const CASES = [
  "A1",
  "A2",
  "A3",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
  "C11",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "E1",
  "E2",
  "E3",
  "T1",
];
const WIDTHS = [1000, 794, 600, 375]; // G1–G4
const WIDTH_CASES = ["A2", "D2", "B5"];
// 'notes' appears either inside the terms row or as its own row after 'attachments'; order is checked on row-level sections
const SECTION_ORDER = [
  "header",
  "banner",
  "details",
  "parties",
  "dispatch",
  "items",
  "summary",
  "terms",
  "additional",
  "attachments",
  "hsn",
  "signature",
];

async function open(page: Page, id: string, width = 1000) {
  await page.setViewportSize({
    width: Math.max(width + 40, 400),
    height: 1200,
  });
  await page.goto(`${TEST_URL}?case=${id}&width=${width}`);
  await page.evaluate(() => (document as any).fonts.ready); // measure only after Inter is loaded
  await page.waitForSelector('[data-testid="invoice-root"]');
}

/** Gathers everything the layout checks need in one pass. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const q = (sel: string, root: ParentNode = document) =>
      Array.from(root.querySelectorAll<HTMLElement>(sel));
    const root = document.querySelector<HTMLElement>(
      '[data-testid="invoice-root"]'
    )!;
    const rootBox = root.getBoundingClientRect();
    const scroller = document.querySelector<HTMLElement>(
      '[data-testid="items-scroll"]'
    );
    const inScroller = (el: Element) =>
      !!scroller && scroller.contains(el) && scroller !== el;
    const lineCount = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set(
        Array.from(r.getClientRects())
          .filter((x) => x.width > 0)
          .map((x) => Math.round(x.top))
      ).size;
    };

    const sections = q('[data-testid="section"]').map(
      (s) => s.dataset.section ?? ""
    );

    // K2: pairs — boxes that share a row
    const pairs = q("[data-pair]").map((row) => {
      const boxes = Array.from(row.children) as HTMLElement[];
      const rowW = row.getBoundingClientRect().width;
      return {
        name: row.getAttribute("data-pair"),
        count: boxes.length,
        widths: boxes.map((b) => b.getBoundingClientRect().width / rowW),
        heights: boxes.map((b) => Math.round(b.getBoundingClientRect().height)),
      };
    });

    const wrappedNumbers = q('[data-testid="num"]', root)
      .filter((el) => lineCount(el) > 1)
      .map((el) => el.textContent?.trim());
    const overflowing = q("*", root)
      .filter(
        (el) =>
          el !== scroller &&
          el.scrollWidth > el.clientWidth + 1 &&
          getComputedStyle(el).overflowX === "visible" &&
          el.clientWidth > 0
      )
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${el.className}: ${el.textContent
            ?.trim()
            .slice(0, 40)}`
      );
    const pastRightEdge = q("*", root)
      .filter(
        (el) =>
          !inScroller(el) &&
          el.getBoundingClientRect().right > rootBox.right + 1
      )
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);

    const table = document.querySelector<HTMLElement>(
      '[data-testid="items-table"]'
    );
    const descTh = document.querySelector<HTMLElement>(
      '[data-testid="items-header"] [data-col="desc"]'
    );
    const cols = q('[data-testid="items-header"] [data-col]').map((th) => ({
      col: th.dataset.col!,
      width: Math.round(th.getBoundingClientRect().width),
    }));

    const sig = document.querySelector<HTMLElement>(
      '[data-testid="signature"]'
    );
    const sigBlock =
      sig?.closest<HTMLElement>('[data-testid="section"]') ?? sig;
    const prev = sigBlock?.previousElementSibling as HTMLElement | null;

    return {
      sections,
      pairs,
      wrappedNumbers,
      overflowing,
      pastRightEdge,
      cols,
      descRatio:
        table && descTh
          ? descTh.getBoundingClientRect().width /
            table.getBoundingClientRect().width
          : null,
      // CHANGED (user request, 2026-10-06): original images fill the table's width in a row
      // of their own instead of a fixed 280 × 280; measured against their cell's content box.
      largeImages: q('[data-testid="large-image"]').map((i) => {
        const cell = i.closest("td")!;
        const cs = getComputedStyle(cell);
        return [
          Math.round(i.getBoundingClientRect().width),
          Math.round(
            cell.clientWidth -
              parseFloat(cs.paddingLeft) -
              parseFloat(cs.paddingRight)
          ),
          cell.colSpan,
          cell.closest("tr")!.children.length,
        ];
      }),
      sigGap:
        sig && prev
          ? sig.getBoundingClientRect().top -
            prev.getBoundingClientRect().bottom
          : null,
      sigRightAligned: sig
        ? Math.abs(sig.getBoundingClientRect().right - rootBox.right) < 40
        : null,
      pageHScroll:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    };
  });
}

function checkLayout(m: Awaited<ReturnType<typeof measure>>) {
  // K1 section order (hidden ones simply absent)
  const order = m.sections.filter((s) => SECTION_ORDER.includes(s));
  expect(order, "K1 section order").toEqual(
    SECTION_ORDER.filter((s) => order.includes(s))
  );
  // K2 pairs: single box full width, two boxes equal height
  for (const p of m.pairs) {
    if (p.count === 1)
      expect(p.widths[0], `K2 ${p.name} single box full width`).toBeGreaterThan(
        0.99
      );
    if (p.count === 2 && p.name !== "summary") {
      // bank + totals may differ in height inside one container
      expect(
        Math.abs(p.heights[0] - p.heights[1]),
        `K2 ${p.name} equal heights`
      ).toBeLessThanOrEqual(1);
    }
  }
  // K3 fixed columns
  const cols = m.cols.map((c) => c.col);
  expect(cols, "K3 Sr column").toContain("sr");
  expect(cols, "K3 Description column").toContain("desc");
  // K4 numbers never wrap
  expect(m.wrappedNumbers, "K4 wrapped numbers").toEqual([]);
  // K5 nothing overflows its box
  expect(m.overflowing, "K5 overflowing content").toEqual([]);
  // K6 nothing past the right edge, no page-level horizontal scroll
  expect(m.pastRightEdge, "K6 past right edge").toEqual([]);
  expect(m.pageHScroll, "K6 page scrolls sideways").toBe(false);
  // K7 description width, large images
  if (m.descRatio !== null)
    expect(m.descRatio, "K7 description ≥ 22%").toBeGreaterThanOrEqual(0.215);
  // CHANGED (user request): each original image fills its own row, which spans the table.
  for (const [w, inner, span, cells] of m.largeImages) {
    expect(
      Math.abs(w - inner),
      "K7 large image fills the row"
    ).toBeLessThanOrEqual(1);
    expect(cells, "K7 large image row is one cell").toBe(1);
    expect(span, "K7 large image row spans the table").toBeGreaterThan(1);
  }
  // K8 signature placement
  if (m.sigGap !== null)
    expect(Math.abs(m.sigGap - 32), "K8 signature gap").toBeLessThanOrEqual(2);
  if (m.sigRightAligned !== null)
    expect(m.sigRightAligned, "K8 signature right-aligned").toBe(true);
}

// ---------- every case at design width ----------
for (const id of CASES) {
  test(`${id}: layout`, async ({ page }) => {
    await open(page, id);
    checkLayout(await measure(page));
  });
}

// ---------- G1–G4: table responsiveness and overflow at narrower containers ----------
for (const id of WIDTH_CASES) {
  for (const w of WIDTHS) {
    test(`${id} @ ${w}px container`, async ({ page }) => {
      await open(page, id, w);
      const m = await measure(page);
      checkLayout(m);
    });
  }
}

// ---------- case-specific expectations ----------
test("C3: bank section off keeps totals in the right half", async ({
  page,
}) => {
  await open(page, "C3");
  await expect(page.locator('[data-section="bank"]')).toHaveCount(0);
  const totals = (await page.locator('[data-section="totals"]').boundingBox())!;
  const root = (await page
    .locator('[data-testid="invoice-root"]')
    .boundingBox())!;
  expect(totals.x).toBeGreaterThan(root.x + root.width / 2 - 20);
});

test("C4: UPI only", async ({ page }) => {
  await open(page, "C4");
  const bank = page.locator('[data-section="bank"]');
  await expect(bank).toContainText("UPI Details");
  await expect(bank).not.toContainText("Account No.");
  await expect(page.locator('[data-testid="upi-qr"]')).toBeVisible();
});

test("C5: bank details only, no UPI", async ({ page }) => {
  await open(page, "C5");
  await expect(page.locator('[data-testid="upi-qr"]')).toHaveCount(0);
  await expect(page.locator('[data-section="bank"]')).not.toContainText("UPI");
  await expect(page.locator('[data-section="bank"]')).not.toContainText(
    "Scan to Pay",
    { ignoreCase: true }
  );
});

test("C7: Notes in their own row after Additional Info / Attachments", async ({
  page,
}) => {
  await open(page, "C7");
  const order = await page
    .locator('[data-testid="section"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.section));
  expect(order.indexOf("notes")).toBeGreaterThan(order.indexOf("attachments"));
  const terms = (await page.locator('[data-section="terms"]').boundingBox())!;
  const root = (await page
    .locator('[data-testid="invoice-root"]')
    .boundingBox())!;
  expect(terms.width).toBeGreaterThan(root.width - 64 - 4); // full content width
});

test("B5: Additional Info labels stay 100 px, values wrap", async ({
  page,
}) => {
  await open(page, "B5");
  const rows = await page
    .locator('[data-section="additional"] [data-role="ai-label"]')
    .evaluateAll((ls) =>
      ls.map((l) => Math.round(l.getBoundingClientRect().width))
    );
  expect(rows.length).toBe(10);
  for (const w of rows) expect(w).toBeGreaterThanOrEqual(99);
  const gap = await page
    .locator('[data-section="additional"] [data-role="ai-value"]')
    .first()
    .evaluate(
      (v) =>
        v.getBoundingClientRect().left -
        (v.previousElementSibling as HTMLElement).getBoundingClientRect().right
    );
  expect(Math.round(gap)).toBe(8);
});

test("C10: only the fixed sections remain", async ({ page }) => {
  await open(page, "C10");
  const m = await measure(page);
  expect(m.sections).toEqual([
    "header",
    "banner",
    "details",
    "parties",
    "items",
    "summary",
    "totals",
    "signature",
  ]);
});

test("D3: minimal columns", async ({ page }) => {
  await open(page, "D3");
  const cols = (await measure(page)).cols.map((c) => c.col);
  expect(cols).toEqual(["sr", "desc", "tx", "amt"]);
});

test("E3: large image moves to a full-width row", async ({ page }) => {
  await open(page, "E3");
  await expect(
    page
      .locator('[data-testid="item-detail-row"] [data-testid="large-image"]')
      .first()
  ).toBeVisible();
});

// ---------- K9–K11: design tokens, typography, spacing (Figma) ----------
test("D1: tokens, typography, spacing and column widths match Figma", async ({
  page,
}) => {
  await open(page, "D1");
  const style = (sel: string, prop: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

  // K9 colours
  expect(await style('[data-section="banner"]', "background-color")).toBe(
    "rgb(1, 61, 127)"
  );
  expect(
    await style(
      '[data-testid="items-header"] [data-col="desc"]',
      "background-color"
    )
  ).toBe("rgb(1, 61, 127)");
  expect(
    await style(
      '[data-testid="items-header"] [data-col="sr"]',
      "border-right-color"
    )
  ).toBe("rgb(189, 220, 255)");
  expect(await style('[data-testid="items-table"]', "border-top-color")).toBe(
    "rgb(220, 220, 220)"
  );
  expect(await style('[data-testid="item-row"] td', "border-right-color")).toBe(
    "rgb(209, 214, 219)"
  );
  expect(
    await style('[data-testid="item-row"]:nth-child(2) td', "background-color")
  ).toBe("rgb(249, 250, 252)");
  expect(
    await style('[data-testid="item-row"] [data-col="qty"]', "color")
  ).toBe("rgb(26, 33, 48)");

  // K10 typography (size / weight)
  // CHANGED (user request, 2026-10-07): body text 12 px → 13 px.
  const type: [string, string, string][] = [
    ['[data-section="header"] [data-role="company-name"]', "18px", "600"],
    ['[data-section="banner"] [data-role="title"]', "14px", "700"],
    ['[data-testid="items-header"] [data-col="desc"]', "13px", "700"],
    ['[data-testid="item-row"] [data-col="qty"]', "13px", "400"],
    ['[data-testid="item-row"] [data-col="amt"]', "13px", "700"],
    ['[data-section="totals"] [data-role="grand-total"]', "18px", "800"],
    // CHANGED (user request): section titles 10 px → 12 px → 13 px.
    ['[data-section="terms"] [data-role="title"]', "13px", "700"],
    ['[data-section="parties"] [data-role="address"]', "13px", "400"],
    ['[data-section="banner"] [data-role="tag"]', "13px", "600"],
    ['[data-section="additional"] [data-role="ai-label"]', "13px", "400"],
    ['[data-section="additional"] [data-role="ai-value"]', "13px", "600"],
  ];
  for (const [sel, size, weight] of type) {
    expect(await style(sel, "font-size"), `size ${sel}`).toBe(size);
    expect(await style(sel, "font-weight"), `weight ${sel}`).toBe(weight);
  }

  // K11 spacing
  expect(await style('[data-testid="item-row"] td', "padding-top")).toBe("8px");
  expect(await style('[data-section="parties"] > *', "padding-top")).toBe(
    "14px"
  );
  expect(await style('[data-section="details"] > *', "padding-top")).toBe(
    "10px"
  );
  const gaps = await page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const section = Math.round(
      r('[data-section="details"]').top - r('[data-section="banner"]').bottom
    );
    const t = r('[data-section="additional"] [data-role="title"]');
    const first = document
      .querySelector('[data-section="additional"] [data-role="ai-label"]')!
      .getBoundingClientRect();
    return { section, titleToContent: Math.round(first.top - t.bottom) };
  });
  expect(gaps.section, "section gap").toBe(16);
  expect(gaps.titleToContent, "title to content").toBe(8);

  // Figma column widths (±1 px)
  // Sr and Amount include the 8 px row padding at each end of the row
  // CHANGED (batch 70 → 74, qty 40 → 42, rate 75 → 82, tx 80 → 101, c / s 75 → 79,
  // amt 98 → 107): the table text is 13 px and money prints with its currency symbol
  // ("₹1,22,088.70"), both user requests; Figma draws 11 px figures without a symbol. By the
  // spec's §5 rule ("a column grows past its starting width only when its widest value,
  // including the Total row, needs it") those columns grow to fit.
  const expected: Record<string, number> = {
    sr: 38,
    batch: 74,
    hsn: 70,
    qty: 42,
    unit: 45,
    rate: 82,
    tx: 101,
    c: 79,
    s: 79,
    amt: 107,
  };
  for (const { col, width } of (await measure(page)).cols) {
    if (expected[col])
      expect(
        Math.abs(width - expected[col]),
        `width ${col}`
      ).toBeLessThanOrEqual(1);
  }
});

// ---------- K12: visual match against approved baselines ----------
for (const id of ["A1", "A2", "C7", "C10", "D2", "B5", "E3", "T1"]) {
  test(`visual ${id}`, async ({ page }) => {
    await open(page, id);
    await expect(page.locator('[data-testid="invoice-root"]')).toHaveScreenshot(
      `${id}.png`,
      { maxDiffPixelRatio: 0.002 }
    );
  });
}
for (const w of [600, 375]) {
  test(`visual D2 @ ${w}px`, async ({ page }) => {
    await open(page, "D2", w);
    await expect(page.locator('[data-testid="invoice-root"]')).toHaveScreenshot(
      `D2-${w}.png`,
      { maxDiffPixelRatio: 0.002 }
    );
  });
}
