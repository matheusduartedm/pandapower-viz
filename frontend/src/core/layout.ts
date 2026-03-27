import type { NetworkNode, NetworkEdge } from './types';

interface Position {
  x: number;
  y: number;
}

type NodeId = number | string;

export function calculateTreeLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  width: number = 5000,
  height: number = 3000
): Map<NodeId, Position> {
  const positions = new Map<NodeId, Position>();
  const adjacency = new Map<NodeId, Set<NodeId>>();
  const nodeSet = new Set<NodeId>(nodes.map(n => n.id));

  const busNodes = nodes.filter(n => {
    const id = String(n.id);
    return !id.startsWith('load_') && !id.startsWith('sgen_') && !id.startsWith('gen_');
  });

  const elementNodes = nodes.filter(n => {
    const id = String(n.id);
    return id.startsWith('load_') || id.startsWith('sgen_') || id.startsWith('gen_');
  });

  const busEdges = edges.filter(e => {
    const fromId = String(e.from);
    const toId = String(e.to);
    return !fromId.startsWith('load_') && !fromId.startsWith('sgen_') && !fromId.startsWith('gen_') &&
           !toId.startsWith('load_') && !toId.startsWith('sgen_') && !toId.startsWith('gen_');
  });

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

  const totalRootWidth = rootNodes.reduce((sum, root) => sum + (subtreeWidth.get(root) || 1), 0);
  let currentX = margin;
  const availableWidth = width - 2 * margin;

  rootNodes.forEach(root => {
    const rootWidth = subtreeWidth.get(root) || 1;
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

  // Pre-compute edge lookup for element nodes: O(m) instead of O(n*m)
  const elementEdgeMap = new Map<string, NetworkEdge>();
  edges.forEach(e => {
    const toId = String(e.to);
    const fromId = String(e.from);
    if (toId.startsWith('load_') || toId.startsWith('sgen_') || toId.startsWith('gen_') || toId.startsWith('storage_')) {
      elementEdgeMap.set(toId, e);
    }
    if (fromId.startsWith('load_') || fromId.startsWith('sgen_') || fromId.startsWith('gen_') || fromId.startsWith('storage_')) {
      elementEdgeMap.set(fromId, e);
    }
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
