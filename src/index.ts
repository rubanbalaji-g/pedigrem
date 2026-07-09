import { parseDSL } from "./parser.js";
import { layoutDiagram } from "./layout.js";
import { renderSVG } from "./renderer.js";

export { parseDSL } from "./parser.js";
export { layoutDiagram } from "./layout.js";
export { renderSVG } from "./renderer.js";
export * from "./types.js";

/**
 * High-level helper function to convert a Pedigree DSL string directly into an SVG string.
 */
export function renderPedigree(dsl: string): string {
  const diagram = parseDSL(dsl);
  const layout = layoutDiagram(diagram);
  return renderSVG(layout);
}
