/**
 * IEC 60617-inspired SVG symbol generators for power system elements.
 *
 * Each function returns a `data:image/svg+xml,...` URI suitable for
 * vis-network `shape: 'image'` nodes.  Every generator accepts at least
 * a `color` parameter so the symbols integrate with color modes
 * (type / voltage / loading).
 *
 * Designed to be standalone — no runtime dependencies — so downstream
 * apps can import individual symbols independently of NetworkDiagram.
 */

const dataUriCache = new Map<string, string>();

function toDataUri(svg: string): string {
  let uri = dataUriCache.get(svg);
  if (!uri) {
    uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
    dataUriCache.set(svg, uri);
  }
  return uri;
}

// ── Bus (thick horizontal bar) ──────────────────────────────────────

export function busSvg(color: string, width = 30): string {
  const h = 4;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">` +
      `<rect width="${width}" height="${h}" rx="1" fill="${color}"/>` +
    `</svg>`
  );
}

// ── External grid (ground symbol) ───────────────────────────────────

export function extGridSvg(color: string): string {
  const s = 22;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 22 22">` +
      `<line x1="11" y1="1" x2="11" y2="7" stroke="${color}" stroke-width="2"/>` +
      `<line x1="3" y1="7" x2="19" y2="7" stroke="${color}" stroke-width="2"/>` +
      `<line x1="5" y1="11" x2="17" y2="11" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="7.5" y1="15" x2="14.5" y2="15" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="9.5" y1="19" x2="12.5" y2="19" stroke="${color}" stroke-width="1"/>` +
    `</svg>`
  );
}

// ── Generator (circle with G) ───────────────────────────────────────

export function generatorSvg(color: string): string {
  const s = 20;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 20 20">` +
      `<circle cx="10" cy="10" r="8.5" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      `<text x="10" y="14" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="${color}">G</text>` +
    `</svg>`
  );
}

// ── Load (downward triangle with stem) ──────────────────────────────

export function loadSvg(color: string): string {
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20" viewBox="0 0 16 20">` +
      `<line x1="8" y1="0" x2="8" y2="6" stroke="${color}" stroke-width="1.5"/>` +
      `<polygon points="2,6 14,6 8,19" fill="${color}"/>` +
    `</svg>`
  );
}

// ── Transformer winding (circle, transparent fill) ──────────────────

export function transformerWindingSvg(color: string): string {
  const s = 16;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 16 16">` +
      `<circle cx="8" cy="8" r="6.5" fill="none" stroke="${color}" stroke-width="2"/>` +
    `</svg>`
  );
}

// ── Static generator — solar PV (circle with sun) ──────────────────

export function sgenSolarSvg(color: string): string {
  const s = 20;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 20 20">` +
      `<circle cx="10" cy="10" r="8.5" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      `<circle cx="10" cy="10" r="3" fill="${color}"/>` +
      `<line x1="10" y1="2.5" x2="10" y2="5" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="10" y1="15" x2="10" y2="17.5" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="2.5" y1="10" x2="5" y2="10" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="15" y1="10" x2="17.5" y2="10" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="4.7" y1="4.7" x2="6.2" y2="6.2" stroke="${color}" stroke-width="1"/>` +
      `<line x1="13.8" y1="13.8" x2="15.3" y2="15.3" stroke="${color}" stroke-width="1"/>` +
      `<line x1="4.7" y1="15.3" x2="6.2" y2="13.8" stroke="${color}" stroke-width="1"/>` +
      `<line x1="13.8" y1="6.2" x2="15.3" y2="4.7" stroke="${color}" stroke-width="1"/>` +
    `</svg>`
  );
}

// ── Static generator — wind (circle with ~) ────────────────────────

export function sgenWindSvg(color: string): string {
  const s = 20;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 20 20">` +
      `<circle cx="10" cy="10" r="8.5" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      `<text x="10" y="14" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="${color}">~</text>` +
    `</svg>`
  );
}

// ── Static generator — generic (circle with arrow up) ──────────────

export function sgenSvg(color: string): string {
  const s = 20;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 20 20">` +
      `<circle cx="10" cy="10" r="8.5" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      `<line x1="10" y1="16" x2="10" y2="5" stroke="${color}" stroke-width="1.5"/>` +
      `<polyline points="6.5,9 10,5 13.5,9" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `</svg>`
  );
}

// ── Storage / battery ───────────────────────────────────────────────

export function storageSvg(color: string): string {
  const s = 18;
  return toDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 18 18">` +
      `<line x1="9" y1="0" x2="9" y2="5" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="9" y1="13" x2="9" y2="18" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="3" y1="5" x2="15" y2="5" stroke="${color}" stroke-width="2.5"/>` +
      `<line x1="5" y1="9" x2="13" y2="9" stroke="${color}" stroke-width="1.2"/>` +
      `<line x1="3" y1="13" x2="15" y2="13" stroke="${color}" stroke-width="2.5"/>` +
    `</svg>`
  );
}

// ── Aggregated export object for library consumers ──────────────────

export const SYMBOLS = {
  busSvg,
  extGridSvg,
  generatorSvg,
  loadSvg,
  transformerWindingSvg,
  sgenSolarSvg,
  sgenWindSvg,
  sgenSvg,
  storageSvg,
} as const;
