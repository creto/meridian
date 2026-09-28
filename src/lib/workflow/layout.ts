import type { WorkflowDef } from "../forms/types.ts";

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  points: Array<{ x: number; y: number }>;
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

function outgoing(def: WorkflowDef, id: string) {
  return def.edges.filter((edge) => edge.from === id);
}

function incoming(def: WorkflowDef, id: string) {
  return def.edges.filter((edge) => edge.to === id);
}

export function assignLayers(def: WorkflowDef): Map<string, number> {
  const layers = new Map<string, number>();
  const start = def.nodes.find((node) => node.type === "start") ?? def.nodes[0];
  if (!start) return layers;
  const queue = [start.id];
  layers.set(start.id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const layer = layers.get(id) ?? 0;
    for (const edge of outgoing(def, id)) {
      const next = Math.max(layers.get(edge.to) ?? 0, layer + 1);
      if (next !== layers.get(edge.to)) {
        layers.set(edge.to, next);
        queue.push(edge.to);
      }
    }
  }
  for (const node of def.nodes) if (!layers.has(node.id)) layers.set(node.id, 0);
  return layers;
}

function barycenter(def: WorkflowDef, layers: Map<string, number>, order: Map<number, string[]>): void {
  const max = Math.max(0, ...order.keys());
  for (let pass = 0; pass < 2; pass += 1) {
    for (let layer = 1; layer <= max; layer += 1) {
      const ids = order.get(layer) ?? [];
      const prev = order.get(layer - 1) ?? [];
      const index = new Map(prev.map((id, position) => [id, position]));
      ids.sort((a, b) => {
        const aIn = incoming(def, a).map((edge) => index.get(edge.from) ?? 0);
        const bIn = incoming(def, b).map((edge) => index.get(edge.from) ?? 0);
        const aAvg = aIn.length ? aIn.reduce((sum, value) => sum + value, 0) / aIn.length : 0;
        const bAvg = bIn.length ? bIn.reduce((sum, value) => sum + value, 0) / bIn.length : 0;
        return aAvg - bAvg;
      });
      order.set(layer, ids);
    }
    void layers;
    void pass;
  }
}

export function layoutWorkflow(def: WorkflowDef, nodeW = 180, nodeH = 64, gapX = 80, gapY = 36): GraphLayout {
  const layers = assignLayers(def);
  const order = new Map<number, string[]>();
  for (const node of def.nodes) {
    const layer = layers.get(node.id) ?? 0;
    const list = order.get(layer) ?? [];
    list.push(node.id);
    order.set(layer, list);
  }
  barycenter(def, layers, order);
  const nodes: LayoutNode[] = [];
  let width = 0;
  let height = 0;
  for (const [layer, ids] of order) {
    ids.forEach((id, index) => {
      const x = layer * (nodeW + gapX);
      const y = index * (nodeH + gapY);
      nodes.push({ id, x, y, w: nodeW, h: nodeH, layer });
      width = Math.max(width, x + nodeW);
      height = Math.max(height, y + nodeH);
    });
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: LayoutEdge[] = def.edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    const x1 = (from?.x ?? 0) + (from?.w ?? 0);
    const y1 = (from?.y ?? 0) + (from?.h ?? 0) / 2;
    const x2 = to?.x ?? 0;
    const y2 = (to?.y ?? 0) + (to?.h ?? 0) / 2;
    const mid = (x1 + x2) / 2;
    return { from: edge.from, to: edge.to, label: edge.when, points: [{ x: x1, y: y1 }, { x: mid, y: y1 }, { x: mid, y: y2 }, { x: x2, y: y2 }] };
  });
  return { nodes, edges, width, height };
}

export function fitGraph(layout: GraphLayout, viewport: { width: number; height: number }, padding = 24): { scale: number; x: number; y: number } {
  const scale = Math.min(
    (viewport.width - padding * 2) / Math.max(layout.width, 1),
    (viewport.height - padding * 2) / Math.max(layout.height, 1),
    1,
  );
  return { scale, x: padding, y: padding };
}

export function hitNode(layout: GraphLayout, x: number, y: number): string | null {
  for (let i = layout.nodes.length - 1; i >= 0; i -= 1) {
    const node = layout.nodes[i]!;
    if (x >= node.x && x <= node.x + node.w && y >= node.y && y <= node.y + node.h) return node.id;
  }
  return null;
}

function near(point: { x: number; y: number }, x: number, y: number): boolean {
  return Math.hypot(point.x - x, point.y - y) < 10;
}

export function hitEdge(layout: GraphLayout, x: number, y: number): { from: string; to: string } | null {
  for (const edge of layout.edges) {
    if (edge.points.some((point) => near(point, x, y))) return { from: edge.from, to: edge.to };
  }
  return null;
}
