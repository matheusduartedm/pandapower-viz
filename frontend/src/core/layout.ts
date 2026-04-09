import type { NetworkNode, NetworkEdge, PandaPowerNetwork } from './types';
import { isElementNode, isBusNode } from './types';
import { extractGeodata } from './parser';

interface Position {
  x: number;
  y: number;
}

type NodeId = number | string;

/**
 * Calculate hierarchical tree positions for network nodes.
 * Uses external grid buses as roots and BFS traversal for depth assignment.
 * Element nodes (loads, generators) are positioned around their parent bus.
 */
export function calculateTreeLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  width: number = 5000,
  height: number = 3000
): Map<NodeId, Position> {
  const positions = new Map<NodeId, Position>();
  const adjacency = new Map<NodeId, Set<NodeId>>();
  const nodeSet = new Set<NodeId>(nodes.map(n => n.id));

  const busNodes = nodes.filter(n => isBusNode(n.id));
  const elementNodes = nodes.filter(n => isElementNode(n.id));
  const busEdges = edges.filter(e => isBusNode(e.from) && isBusNode(e.to));

  busNodes.forEach(node => {
    adjacency.set(node.id, new Set());
  });

  busEdges.forEach(edge => {
    if (nodeSet.has(edge.from) && nodeSet.has(edge.to)) {
      adjacency.get(edge.from)?.add(edge.to);
      adjacency.get(edge.to)?.add(edge.from);
    }
  });

  const extGridNodes = busNodes.filter(n => n.type === 'ext_grid');
  const rootNodes = extGridNodes.length > 0
    ? extGridNodes.map(n => n.id)
    : [busNodes.reduce((max, n) => {
        const degree = adjacency.get(n.id)?.size || 0;
        const maxDegree = adjacency.get(max.id)?.size || 0;
        return degree > maxDegree ? n : max;
      }, busNodes[0])?.id].filter(Boolean);

  if (rootNodes.length === 0 && busNodes.length > 0) {
    rootNodes.push(busNodes[0].id);
  }

  const visited = new Set<NodeId>();
  const children = new Map<NodeId, NodeId[]>();
  const depth = new Map<NodeId, number>();

  rootNodes.forEach(id => {
    children.set(id, []);
    depth.set(id, 0);
  });

  const queue: NodeId[] = [...rootNodes];
  let head = 0;
  rootNodes.forEach(id => visited.add(id));

  while (head < queue.length) {
    const current = queue[head++];
    const currentDepth = depth.get(current) || 0;
    const neighbors = adjacency.get(current) || new Set();

    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        depth.set(neighborId, currentDepth + 1);

        if (!children.has(current)) {
          children.set(current, []);
        }
        children.get(current)!.push(neighborId);
        children.set(neighborId, []);

        queue.push(neighborId);
      }
    });
  }

  const subtreeWidth = new Map<NodeId, number>();

  function calculateWidth(nodeId: NodeId): number {
    const nodeChildren = children.get(nodeId) || [];
    if (nodeChildren.length === 0) {
      subtreeWidth.set(nodeId, 1);
      return 1;
    }
    let totalWidth = 0;
    for (const child of nodeChildren) {
      totalWidth += calculateWidth(child);
    }
    subtreeWidth.set(nodeId, totalWidth);
    return totalWidth;
  }

  rootNodes.forEach(root => calculateWidth(root));

  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  const levelHeight = height / (maxDepth + 3);
  const margin = 100;

  function positionNode(nodeId: NodeId, leftX: number, rightX: number): void {
    const nodeDepth = depth.get(nodeId) || 0;
    const y = margin + (nodeDepth + 1) * levelHeight;
    const x = (leftX + rightX) / 2;

    positions.set(nodeId, { x, y });

    const nodeChildren = children.get(nodeId) || [];
    if (nodeChildren.length > 0) {
      const totalWidth = subtreeWidth.get(nodeId) || 1;
      const availableWidth = rightX - leftX;
      let currentX = leftX;

      nodeChildren.forEach(child => {
        const childWidth = subtreeWidth.get(child) || 1;
        const childRightX = currentX + (childWidth / totalWidth) * availableWidth;
        positionNode(child, currentX, childRightX);
        currentX = childRightX;
      });
    }
  }

  const totalRootWidth = rootNodes.reduce((sum: number, root) => sum + (subtreeWidth.get(root) || 1), 0);
  let currentX = margin;
  const availableWidth = width - 2 * margin;

  rootNodes.forEach(root => {
    const rootWidth = (subtreeWidth.get(root) || 1) as number;
    const rightX = currentX + (rootWidth / totalRootWidth) * availableWidth;
    positionNode(root, currentX, rightX);
    currentX = rightX;
  });

  busNodes.forEach(node => {
    if (!visited.has(node.id)) {
      positions.set(node.id, {
        x: margin + Math.random() * (width - 2 * margin),
        y: height - margin * 2
      });
    }
  });

  const elementOffset = 40;
  const busElementCount = new Map<NodeId, number>();

  const elementEdgeMap = new Map<string, NetworkEdge>();
  edges.forEach(e => {
    if (isElementNode(e.to)) elementEdgeMap.set(String(e.to), e);
    if (isElementNode(e.from)) elementEdgeMap.set(String(e.from), e);
  });

  elementNodes.forEach(node => {
    const nodeId = String(node.id);
    let busId: NodeId | null = null;

    const connEdge = elementEdgeMap.get(nodeId);

    if (connEdge) {
      busId = String(connEdge.to) === nodeId ? connEdge.from : connEdge.to;
    }

    if (busId !== null && positions.has(busId)) {
      const busPos = positions.get(busId)!;
      const count = busElementCount.get(busId) || 0;
      busElementCount.set(busId, count + 1);

      const angle = (count * Math.PI / 4) + Math.PI / 2;
      const offsetX = Math.cos(angle) * elementOffset;
      const offsetY = Math.sin(angle) * elementOffset;

      positions.set(node.id, {
        x: busPos.x + offsetX,
        y: busPos.y + offsetY
      });
    } else {
      positions.set(node.id, {
        x: margin + Math.random() * (width - 2 * margin),
        y: height - margin
      });
    }
  });

  return positions;
}

/**
 * Calculate positions using geographic coordinates from bus geo data.
 * Projects lat/lon to canvas coordinates with aspect ratio preservation.
 * Falls back to tree layout for buses without geo data.
 * Element nodes (loads, generators) are positioned around their parent bus.
 */
export function calculateGeoLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  network: PandaPowerNetwork,
  width: number = 5000,
  height: number = 3000
): Map<NodeId, Position> {
  const positions = new Map<NodeId, Position>();
  const geodata = extractGeodata(network);
  const margin = 120;

  const geoMap = new Map<number, { lat: number; lon: number }>();
  geodata.forEach(g => geoMap.set(g.bus, { lat: g.latitude, lon: g.longitude }));

  if (geoMap.size === 0) {
    return calculateTreeLayout(nodes, edges, width, height);
  }

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  geoMap.forEach(({ lat, lon }) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });

  // Fallback ~111m to avoid division by zero for single-point networks
  const latRange = maxLat - minLat || 0.001;
  const lonRange = maxLon - minLon || 0.001;

  const canvasW = width - 2 * margin;
  const canvasH = height - 2 * margin;

  // Preserve aspect ratio (approximate Mercator correction at mid-latitude)
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const geoAspect = (lonRange * cosLat) / latRange;
  const canvasAspect = canvasW / canvasH;

  let scaleX: number, scaleY: number;
  if (geoAspect > canvasAspect) {
    // Wider than tall: fit to width
    scaleX = canvasW / lonRange;
    scaleY = scaleX / cosLat;
  } else {
    // Taller than wide: fit to height
    scaleY = canvasH / latRange;
    scaleX = scaleY * cosLat;
  }

  // Center offset
  const projectedW = lonRange * scaleX;
  const projectedH = latRange * scaleY;
  const offsetX = margin + (canvasW - projectedW) / 2;
  const offsetY = margin + (canvasH - projectedH) / 2;

  const busNodes = nodes.filter(n => isBusNode(n.id));
  const elementNodes = nodes.filter(n => isElementNode(n.id));

  busNodes.forEach(node => {
    const busIndex = typeof node.id === 'number' ? node.id : parseInt(String(node.id), 10);
    const geo = geoMap.get(busIndex);

    if (geo) {
      const x = offsetX + (geo.lon - minLon) * scaleX;
      const y = offsetY + (maxLat - geo.lat) * scaleY; // flip Y: north = top
      positions.set(node.id, { x, y });
    } else {
      // Trafo windings and other non-bus nodes: position later
      positions.set(node.id, { x: width / 2, y: height / 2 });
    }
  });

  const trafoLinks = new Map<string, { hv?: NodeId; lv?: NodeId; w1?: NodeId; w2?: NodeId }>();
  const elementEdgeMap = new Map<string, NetworkEdge>();

  edges.forEach(edge => {
    const match = String(edge.id).match(/^trafo_(\d+)_(hv|mid|lv)$/);
    if (match) {
      const [, trafoIndex, part] = match;
      const info = trafoLinks.get(trafoIndex) || {};
      if (part === 'hv') { info.hv = edge.from; info.w1 = edge.to; }
      else if (part === 'mid') { info.w1 = edge.from; info.w2 = edge.to; }
      else { info.w2 = edge.from; info.lv = edge.to; }
      trafoLinks.set(trafoIndex, info);
    }
    if (isElementNode(edge.to)) elementEdgeMap.set(String(edge.to), edge);
    if (isElementNode(edge.from)) elementEdgeMap.set(String(edge.from), edge);
  });

  trafoLinks.forEach(info => {
    if (info.hv && info.lv && info.w1 && info.w2) {
      const hvPos = positions.get(info.hv);
      const lvPos = positions.get(info.lv);
      if (hvPos && lvPos) {
        const midX = (hvPos.x + lvPos.x) / 2;
        const midY = (hvPos.y + lvPos.y) / 2;
        const dx = lvPos.x - hvPos.x;
        const dy = lvPos.y - hvPos.y;
        const len = Math.hypot(dx, dy) || 1;
        const sep = 6;
        positions.set(info.w1, { x: midX - (dx / len) * sep, y: midY - (dy / len) * sep });
        positions.set(info.w2, { x: midX + (dx / len) * sep, y: midY + (dy / len) * sep });
        return;
      }
    }
    // Incomplete trafo: fallback to bus positions
    if (info.hv && info.w1) {
      const hvPos = positions.get(info.hv);
      if (hvPos) positions.set(info.w1, { ...hvPos });
    }
    if (info.lv && info.w2) {
      const lvPos = positions.get(info.lv);
      if (lvPos) positions.set(info.w2, { ...lvPos });
    }
  });

  const elementOffset = 30;
  const busElementCount = new Map<NodeId, number>();

  elementNodes.forEach(node => {
    const nodeId = String(node.id);
    // Trafo windings already positioned by trafoLinks above
    if (nodeId.startsWith('trafo_')) return;

    let busId: NodeId | null = null;
    const connEdge = elementEdgeMap.get(nodeId);
    if (connEdge) {
      busId = String(connEdge.to) === nodeId ? connEdge.from : connEdge.to;
    }

    if (busId !== null && positions.has(busId)) {
      const busPos = positions.get(busId)!;
      const count = busElementCount.get(busId) || 0;
      busElementCount.set(busId, count + 1);
      const angle = (count * Math.PI / 4) + Math.PI / 2;
      positions.set(node.id, {
        x: busPos.x + Math.cos(angle) * elementOffset,
        y: busPos.y + Math.sin(angle) * elementOffset,
      });
    } else {
      positions.set(node.id, { x: margin + Math.random() * canvasW, y: height - margin });
    }
  });

  return positions;
}
