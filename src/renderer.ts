import { theme } from "./theme.js";
import type { Layout, LayoutNode } from "./layout.js";

export function renderNode(node: LayoutNode): string {
  switch (node.type) {
    case "line": {
      const dash = node.strokeDash ? ` stroke-dasharray="${node.strokeDash}"` : "";
      return `<line x1="${node.x1}" x2="${node.x2}" y1="${node.y1}" y2="${node.y2}" stroke="${theme.ink}" stroke-width="1.5"${dash} />`;
    }
    case "rect":
      return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="${node.fill ?? theme.surface}" stroke="${node.stroke ?? theme.ink}" stroke-width="1.5" />`;

    case "text":
      return `<text x="${node.x}" y="${node.y}" text-anchor="${node.anchor ?? "start"}" alignment-baseline="${node.baseline ?? "alphabetic"}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif" font-size="${node.fontSize ?? 10}" fill="${node.color ?? theme.text}">${node.text}</text>`;

    case "circle":
      return `<circle cx="${node.cx}" cy="${node.cy}" r="${node.r}" fill="${node.fill ?? theme.surface}" stroke="${node.stroke ?? theme.ink}" stroke-width="1.5" />`;

    case "path":
      return `<path d="${node.d}" fill="${node.fill ?? "none"}" stroke="${node.stroke ?? theme.ink}" stroke-width="1.5" />`;

    case "group":
      return `<g transform="translate(${node.x},${node.y})">
        ${node.children.map(renderNode).join("")}
      </g>`;

    default:
      return "";
  }
}

export function renderSVG(layout: Layout): string {
  return `<svg viewBox="0 0 ${layout.width} ${layout.height}" width="100%" style="max-width:${layout.width}px; background-color:${theme.surface};" xmlns="http://www.w3.org/2000/svg">
    ${layout.nodes.map(renderNode).join("")}
  </svg>`;
}
