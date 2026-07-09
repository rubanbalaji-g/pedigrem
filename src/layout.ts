import type { Individual, Relationship, LegendItem, PedigreeDiagram, ChildGroup } from "./types.js";
import { theme } from "./theme.js";

export type LayoutNode =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; strokeDash?: string }
  | { type: "rect"; x: number; y: number; width: number; height: number; fill?: string; stroke?: string }
  | { type: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string }
  | { type: "path"; d: string; fill?: string; stroke?: string }
  | { type: "text"; x: number; y: number; text: string; anchor?: "start" | "middle" | "end"; baseline?: "hanging" | "middle" | "alphabetic"; fontSize?: number; color?: string }
  | { type: "group"; x: number; y: number; children: LayoutNode[] };

export interface Layout {
  width: number;
  height: number;
  nodes: LayoutNode[];
}

const ROW_HEIGHT_PX = 90;
const NODE_GAP_PX = 60;
const SYMBOL_PX = 24;
const MARGIN_X = 60; // Extra room on left for Roman numerals
const MARGIN_Y = 40;

export function layoutDiagram(diagram: PedigreeDiagram): Layout {
  const nodes: LayoutNode[] = [];

  // Build mapping of child -> relationship they belong to
  const parentRelMap = new Map<string, Relationship>();
  for (const rel of diagram.relationships) {
    for (const group of rel.children) {
      if (group.type === "single") {
        parentRelMap.set(group.name, rel);
      } else {
        for (const name of group.children) {
          parentRelMap.set(name, rel);
        }
      }
    }
  }

  // 1. Raw generation: distance from top ancestor
  const genMemo = new Map<string, number>();
  function getGen(id: string): number {
    if (genMemo.has(id)) return genMemo.get(id)!;
    const rel = parentRelMap.get(id);
    if (!rel) {
      genMemo.set(id, 0);
      return 0;
    }
    const g = 1 + Math.max(getGen(rel.parent1), getGen(rel.parent2));
    genMemo.set(id, g);
    return g;
  }

  // Initialize generations
  const row = new Map<string, number>();
  for (const id of diagram.individuals.keys()) {
    row.set(id, getGen(id));
  }

  // Adjust generations so spouses are on the same row
  for (const rel of diagram.relationships) {
    const r1 = row.get(rel.parent1) ?? 0;
    const r2 = row.get(rel.parent2) ?? 0;
    const maxR = Math.max(r1, r2);
    row.set(rel.parent1, maxR);
    row.set(rel.parent2, maxR);
  }

  // Group children mapping
  const relationshipId = (rel: Relationship) => {
    return [rel.parent1, rel.parent2].sort().join("-");
  };

  const coupleByPartner = new Map<string, Relationship>();
  for (const rel of diagram.relationships) {
    coupleByPartner.set(rel.parent1, rel);
    coupleByPartner.set(rel.parent2, rel);
  }

  // 2. DFS Horizontal placement
  const x = new Map<string, number>();
  let cursor = MARGIN_X;
  const slot = () => {
    const at = cursor;
    cursor += SYMBOL_PX + NODE_GAP_PX;
    return at;
  };

  const placed = new Set<string>();

  function placeNode(id: string): number {
    if (x.has(id)) return x.get(id)!;
    placed.add(id);

    const rel = coupleByPartner.get(id);
    if (rel) {
      return placeRelationship(rel);
    }

    const at = slot();
    x.set(id, at);
    return at;
  }

  function placeRelationship(rel: Relationship): number {
    const key = relationshipId(rel);
    if (x.has(key)) return x.get(key)!;

    // Reserve coordinates temporarily
    x.set(key, MARGIN_X);

    // Collect all children IDs
    const kidsList: string[] = [];
    for (const group of rel.children) {
      if (group.type === "single") {
        kidsList.push(group.name);
      } else {
        kidsList.push(...group.children);
      }
    }

    const kidXs = kidsList.map(placeNode);
    const half = (SYMBOL_PX + NODE_GAP_PX) / 2;
    let mid: number;

    if (kidXs.length > 0) {
      mid = (Math.min(...kidXs) + Math.max(...kidXs)) / 2;
      x.set(rel.parent1, mid - half);
      x.set(rel.parent2, mid + half);
    } else {
      const p1x = slot();
      const p2x = slot();
      x.set(rel.parent1, p1x);
      x.set(rel.parent2, p2x);
      mid = (p1x + p2x) / 2;
    }

    x.set(key, mid);
    return mid;
  }

  // Seed placements from relationships first
  for (const rel of diagram.relationships) {
    placeRelationship(rel);
  }

  // Place any remaining nodes
  for (const id of diagram.individuals.keys()) {
    if (!placed.has(id)) {
      placeNode(id);
    }
  }

  // Adjust center alignment
  const nodeXs = Array.from(diagram.individuals.keys()).map((id) => x.get(id) ?? MARGIN_X);
  const minX = nodeXs.length > 0 ? Math.min(...nodeXs) : MARGIN_X;
  const maxX = nodeXs.length > 0 ? Math.max(...nodeXs) + SYMBOL_PX : MARGIN_X + SYMBOL_PX;
  const contentWidth = maxX - minX;
  const canvasWidth = Math.max(800, contentWidth + MARGIN_X * 2);
  const offsetX = (canvasWidth - contentWidth) / 2 - minX;

  for (const id of diagram.individuals.keys()) {
    x.set(id, (x.get(id) ?? MARGIN_X) + offsetX);
  }

  // Calculate maximum text lines per row level
  const maxLinesInRow = new Map<number, number>();
  for (const [id, ind] of diagram.individuals) {
    const r = row.get(id) ?? 0;
    const labelLines = ind.label ? ind.label.split("|").length : 0;
    const ageLine = ind.age ? 1 : 0;
    const totalLines = labelLines + ageLine;
    maxLinesInRow.set(r, Math.max(maxLinesInRow.get(r) ?? 0, totalLines));
  }

  // Calculate cumulative y offset for each row level dynamically
  const maxRow = Array.from(row.values()).reduce((max, r) => Math.max(max, r), 0);
  const rowY = new Map<number, number>();
  rowY.set(0, MARGIN_Y);
  for (let r = 0; r < maxRow; r++) {
    const lines = maxLinesInRow.get(r) ?? 0;
    // Base spacing is 90. If many lines are present, increase it to prevent overlap
    const h = Math.max(90, SYMBOL_PX + lines * 11 + 45);
    rowY.set(r + 1, (rowY.get(r) ?? MARGIN_Y) + h);
  }

  // Node position mapping
  const pos = new Map<string, { x: number; y: number }>();
  for (const [id, ind] of diagram.individuals) {
    pos.set(id, {
      x: x.get(id) ?? MARGIN_X,
      y: rowY.get(row.get(id) ?? 0) ?? MARGIN_Y,
    });
  }

  // --- Rendering Shapes ---

  // Standard Symbol Rendering
  function renderSymbol(ind: Individual, px: number, py: number): LayoutNode {
    const affected = ind.status === "Af";
    const carrier = ind.status === "Ca";
    const xlinked = ind.status === "XCa";
    const unknownStatus = ind.status === "Unk";

    const baseFill = affected ? theme.ink : theme.surface;
    const strokeColor = theme.ink;
    const r = SYMBOL_PX / 2;

    const groupChildren: LayoutNode[] = [];

    // Misc and Pregnancy override basic shapes
    if (ind.isMisc || ind.isInduced) {
      // Triangle
      const points = `${r},4 ${SYMBOL_PX - 4},20 4,20`;
      groupChildren.push({
        type: "path",
        d: `M ${px + r} ${py + 4} L ${px + SYMBOL_PX - 4} ${py + 20} L ${px + 4} ${py + 20} Z`,
        fill: baseFill,
        stroke: strokeColor,
      });

      if (ind.isInduced) {
        // Draw a diagonal slash through miscarriage triangle
        groupChildren.push({
          type: "line",
          x1: px + SYMBOL_PX - 2,
          y1: py + 2,
          x2: px + 2,
          y2: py + 22,
        });
      }
    } else if (ind.isPreg || ind.sex === "U" || ind.sex === "A") {
      // Diamond
      groupChildren.push({
        type: "path",
        d: `M ${px + r} ${py} L ${px + SYMBOL_PX} ${py + r} L ${px + r} ${py + SYMBOL_PX} L ${px} ${py + r} Z`,
        fill: baseFill,
        stroke: strokeColor,
      });

      if (ind.sex === "A") {
        // Ambiguous sex: '?' inside
        groupChildren.push({
          type: "text",
          x: px + r,
          y: py + r + 3,
          text: "?",
          anchor: "middle",
          fontSize: 10,
        });
      } else if (ind.isPreg) {
        // Pregnancy: 'P' inside
        groupChildren.push({
          type: "text",
          x: px + r,
          y: py + r + 3,
          text: "P",
          anchor: "middle",
          fontSize: 9,
          color: affected ? theme.surface : theme.text,
        });
      }
    } else if (ind.sex === "M") {
      // Square
      groupChildren.push({
        type: "rect",
        x: px,
        y: py,
        width: SYMBOL_PX,
        height: SYMBOL_PX,
        fill: baseFill,
        stroke: strokeColor,
      });
    } else {
      // Female (circle)
      groupChildren.push({
        type: "circle",
        cx: px + r,
        cy: py + r,
        r: r,
        fill: baseFill,
        stroke: strokeColor,
      });
    }

    // Carrier half fill (autosomal)
    if (carrier && !affected) {
      if (ind.sex === "M") {
        groupChildren.push({
          type: "rect",
          x: px,
          y: py,
          width: r,
          height: SYMBOL_PX,
          fill: theme.ink,
        });
      } else if (ind.sex === "F") {
        groupChildren.push({
          type: "path",
          d: `M ${px + r} ${py} A ${r} ${r} 0 0 0 ${px + r} ${py + SYMBOL_PX} Z`,
          fill: theme.ink,
        });
      } else {
        // Diamond carrier
        groupChildren.push({
          type: "path",
          d: `M ${px + r} ${py} L ${px} ${py + r} L ${px + r} ${py + SYMBOL_PX} Z`,
          fill: theme.ink,
        });
      }
    }

    // X-linked carrier dot
    if (xlinked && !affected) {
      groupChildren.push({
        type: "circle",
        cx: px + r,
        cy: py + r,
        r: 3.5,
        fill: theme.ink,
      });
    }

    // Unknown status '?'
    if (unknownStatus) {
      groupChildren.push({
        type: "text",
        x: px + r,
        y: py + r + 3,
        text: "?",
        anchor: "middle",
        fontSize: 10,
      });
    }

    // Deceased slash
    if (ind.isDeceased || ind.isSb) {
      groupChildren.push({
        type: "line",
        x1: px + SYMBOL_PX + 2,
        y1: py - 2,
        x2: px - 2,
        y2: py + SYMBOL_PX + 2,
      });
    }

    // Stillbirth text
    if (ind.isSb) {
      groupChildren.push({
        type: "text",
        x: px + r,
        y: py + SYMBOL_PX + 22,
        text: "SB",
        anchor: "middle",
        fontSize: 9,
      });
    }

    // Adopted brackets
    if (ind.adopted) {
      const bLeft = px - 6;
      const bRight = px + SYMBOL_PX + 6;
      groupChildren.push({
        type: "path",
        d: `M ${bLeft + 3} ${py} L ${bLeft} ${py} L ${bLeft} ${py + SYMBOL_PX} L ${bLeft + 3} ${py + SYMBOL_PX}`,
        fill: "none",
        stroke: strokeColor,
      });
      groupChildren.push({
        type: "path",
        d: `M ${bRight - 3} ${py} L ${bRight} ${py} L ${bRight} ${py + SYMBOL_PX} L ${bRight - 3} ${py + SYMBOL_PX}`,
        fill: "none",
        stroke: strokeColor,
      });
    }

    // Proband / Index case arrow
    if (ind.isIndex) {
      const ax = px - 12;
      const ay = py + SYMBOL_PX + 12;
      const tx = px - 1;
      const ty = py + SYMBOL_PX - 1;
      // Draw arrow line
      groupChildren.push({
        type: "line",
        x1: ax,
        y1: ay,
        x2: tx,
        y2: ty,
      });
      // Draw arrowhead
      groupChildren.push({
        type: "path",
        d: `M ${tx - 6} ${ty} L ${tx} ${ty} L ${tx} ${ty + 6}`,
        fill: "none",
        stroke: strokeColor,
      });
    }

    // Render label lines if present
    let currentY = py + SYMBOL_PX + 11;
    if (ind.label) {
      const labelLines = ind.label.split("|");
      for (const lineText of labelLines) {
        groupChildren.push({
          type: "text",
          x: px + r,
          y: currentY,
          text: lineText,
          anchor: "middle",
          fontSize: 9,
        });
        currentY += 11;
      }
    }

    // Render age below the label
    if (ind.age) {
      groupChildren.push({
        type: "text",
        x: px + r,
        y: currentY,
        text: ind.age,
        anchor: "middle",
        fontSize: 9,
      });
    }

    return { type: "group", x: 0, y: 0, children: groupChildren };
  }

  // Draw individuals
  for (const [id, ind] of diagram.individuals) {
    const p = pos.get(id)!;
    nodes.push(renderSymbol(ind, p.x, p.y));
  }

  // Track layout generation ranges
  const generations = Array.from(new Set(row.values())).sort((a, b) => a - b);


  // Draw Roman numerals for generations on the left
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  for (let idx = 0; idx < generations.length; idx++) {
    const genY = (rowY.get(generations[idx]) ?? MARGIN_Y) + SYMBOL_PX / 2;
    nodes.push({
      type: "text",
      x: 20,
      y: genY + 3,
      text: roman[generations[idx]] || (generations[idx] + 1).toString(),
      anchor: "start",
      fontSize: 12,
    });
  }

  // Relationship lines and sibling bars
  const SIB_BAR_DROP_PX = ROW_HEIGHT_PX / 2;

  for (const rel of diagram.relationships) {
    const a = pos.get(rel.parent1)!;
    const b = pos.get(rel.parent2)!;
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const marriageY = left.y + SYMBOL_PX / 2;

    // 1. Draw relationship line
    if (rel.op === "=") {
      // Consanguineous: double parallel lines
      nodes.push({
        type: "line",
        x1: left.x + SYMBOL_PX,
        y1: marriageY - 2,
        x2: right.x,
        y2: marriageY - 2,
      });
      nodes.push({
        type: "line",
        x1: left.x + SYMBOL_PX,
        y1: marriageY + 2,
        x2: right.x,
        y2: marriageY + 2,
      });
    } else {
      // Single relationship line
      nodes.push({
        type: "line",
        x1: left.x + SYMBOL_PX,
        y1: marriageY,
        x2: right.x,
        y2: marriageY,
      });

      const midX = (left.x + SYMBOL_PX + right.x) / 2;
      if (rel.op === "/") {
        // Divorced: // ticks
        nodes.push({ type: "line", x1: midX - 4, y1: marriageY + 5, x2: midX, y2: marriageY - 5 });
        nodes.push({ type: "line", x1: midX, y1: marriageY + 5, x2: midX + 4, y2: marriageY - 5 });
      } else if (rel.op === "|") {
        // Separated: / tick
        nodes.push({ type: "line", x1: midX - 2, y1: marriageY + 5, x2: midX + 2, y2: marriageY - 5 });
      }
    }

    const midX = (left.x + SYMBOL_PX + right.x) / 2;

    // 2. Childless indicators
    if (rel.isChildless) {
      const dropY = marriageY + 15;
      nodes.push({ type: "line", x1: midX, y1: marriageY, x2: midX, y2: dropY });
      nodes.push({ type: "line", x1: midX - 6, y1: dropY, x2: midX + 6, y2: dropY });
      if (rel.isInfertile) {
        // Double bar for infertile *
        nodes.push({ type: "line", x1: midX - 6, y1: dropY + 3, x2: midX + 6, y2: dropY + 3 });
      }
      continue;
    }

    if (rel.children.length === 0) continue;

    // 3. Connectors to children
    const parentRow = row.get(rel.parent1) ?? 0;
    const childRowY = rowY.get(parentRow + 1) ?? (left.y + 90);
    const barY = childRowY - 25;

    // Gather coordinates for child drops
    const childDrops: { cx: number; cy: number; isTwin: boolean; mzPartnerX?: number; strokeDash?: string }[] = [];

    // Collect child centers
    for (const group of rel.children) {
      if (group.type === "single") {
        const k = pos.get(group.name)!;
        const ind = diagram.individuals.get(group.name);
        const dash = ind?.adopted === "out" ? "4" : undefined;
        childDrops.push({ cx: k.x + SYMBOL_PX / 2, cy: k.y, isTwin: false, strokeDash: dash });
      } else {
        // Twin groups
        const twinCenters = group.children.map(name => pos.get(name)!.x + SYMBOL_PX / 2);
        const twinMidX = (Math.min(...twinCenters) + Math.max(...twinCenters)) / 2;

        // Split drop from the sibship bar to each twin
        for (let i = 0; i < group.children.length; i++) {
          const name = group.children[i];
          const k = pos.get(name)!;
          const ind = diagram.individuals.get(name);
          const dash = ind?.adopted === "out" ? "4" : undefined;

          // Diagonal drop line
          nodes.push({
            type: "line",
            x1: twinMidX,
            y1: barY,
            x2: k.x + SYMBOL_PX / 2,
            y2: k.y,
            strokeDash: dash,
          });
        }

        // Monozygotic connecting line halfway down the V shape
        if (group.type === "monozygotic" && group.children.length >= 2) {
          const k1 = pos.get(group.children[0])!;
          const k2 = pos.get(group.children[1])!;
          const halfX1 = (twinMidX + k1.x + SYMBOL_PX / 2) / 2;
          const halfX2 = (twinMidX + k2.x + SYMBOL_PX / 2) / 2;
          const halfY = (barY + k1.y) / 2;
          nodes.push({
            type: "line",
            x1: halfX1,
            y1: halfY,
            x2: halfX2,
            y2: halfY,
          });
        }

        // Draw central vertical drop to twin intersection point
        childDrops.push({ cx: twinMidX, cy: barY, isTwin: true });
      }
    }

    // Draw vertical drop from marriage line to sibship bar
    nodes.push({ type: "line", x1: midX, y1: marriageY, x2: midX, y2: barY });

    // Draw horizontal sibship bar spanning all drop points
    const dropXs = childDrops.map(d => d.cx);
    const minDropX = Math.min(midX, ...dropXs);
    const maxDropX = Math.max(midX, ...dropXs);
    nodes.push({ type: "line", x1: minDropX, y1: barY, x2: maxDropX, y2: barY });

    // Draw short vertical drop from sibship bar to single children
    for (const drop of childDrops) {
      if (!drop.isTwin) {
        nodes.push({
          type: "line",
          x1: drop.cx,
          y1: barY,
          x2: drop.cx,
          y2: drop.cy,
          strokeDash: drop.strokeDash,
        });
      }
    }
  }

  // 4. Render Legends
  let legendY = (rowY.get(generations.length) ?? (rowY.get(generations.length - 1)! + 100)) + 20;
  if (diagram.legends.length > 0) {
    // Draw legend divider line
    nodes.push({
      type: "line",
      x1: MARGIN_X,
      y1: legendY,
      x2: canvasWidth - MARGIN_X,
      y2: legendY,
    });

    legendY += 15;
    let lx = MARGIN_X;
    for (const leg of diagram.legends) {
      const legText = `${leg.status}: ${leg.description}`;
      // Draw status indicator indicator symbol box
      if (leg.status === "XCa") {
        // X-linked carrier: female circle with central dot
        nodes.push({
          type: "circle",
          cx: lx + 6,
          cy: legendY + 6,
          r: 6,
          fill: theme.surface,
          stroke: theme.ink,
        });
        nodes.push({
          type: "circle",
          cx: lx + 6,
          cy: legendY + 6,
          r: 2,
          fill: theme.ink,
          stroke: "none",
        });
      } else {
        const indicatorFill = leg.status === "Af" ? theme.ink : theme.surface;
        nodes.push({
          type: "rect",
          x: lx,
          y: legendY,
          width: 12,
          height: 12,
          fill: indicatorFill,
          stroke: theme.ink,
        });

        if (leg.status === "Ca") {
          nodes.push({
            type: "rect",
            x: lx,
            y: legendY,
            width: 6,
            height: 12,
            fill: theme.ink,
          });
        }

        if (leg.status === "Unk") {
          nodes.push({
            type: "text",
            x: lx + 6,
            y: legendY + 9,
            text: "?",
            anchor: "middle",
            fontSize: 8,
          });
        }
      }

      nodes.push({
        type: "text",
        x: lx + 18,
        y: legendY + 10,
        text: leg.description,
        anchor: "start",
        fontSize: 9,
      });

      lx += 150; // Horizontal spacing between legend items
      if (lx > canvasWidth - 100) {
        lx = MARGIN_X;
        legendY += 20;
      }
    }
    legendY += 20;
  }

  const finalHeight = legendY + MARGIN_Y;

  return {
    width: canvasWidth,
    height: finalHeight,
    nodes,
  };
}
