import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateTreeLayout } from '../../src/core/layout';
import type { NetworkNode, NetworkEdge } from '../../src/core/types';

function makeBus(id: number, type: 'bus' | 'ext_grid' = 'bus'): NetworkNode {
  return {
    id,
    label: `Bus ${id}`,
    title: `Bus ${id}`,
    color: '#888',
    shape: 'dot',
    size: 10,
    borderWidth: 1,
    font: { color: '#fff' },
    type,
    data: { index: id, name: `Bus ${id}`, vn_kv: 110, type: 'b', in_service: true },
  };
}

function makeElementNode(id: string): NetworkNode {
  return {
    id: id as unknown as number,
    label: id,
    title: id,
    color: '#888',
    shape: 'triangleDown',
    size: 8,
    borderWidth: 1,
    font: { color: '#fff' },
    type: 'bus',
    data: { index: 0, name: id, vn_kv: 20, type: 'b', in_service: true },
  };
}

function makeEdge(from: number | string, to: number | string, id?: string): NetworkEdge {
  return {
    id: id || `edge_${from}_${to}`,
    from: from as number,
    to: to as number,
    label: '',
    title: '',
    color: { color: '#888', highlight: '#fff' },
    width: 1,
    dashes: false,
    type: 'line',
    data: {} as any,
  };
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

describe('calculateTreeLayout', () => {
  it('returns empty map for empty input', () => {
    const positions = calculateTreeLayout([], []);
    expect(positions.size).toBe(0);
  });

  it('positions a single bus node', () => {
    const nodes = [makeBus(0)];
    const positions = calculateTreeLayout(nodes, [], 1000, 800);

    expect(positions.size).toBe(1);
    expect(positions.has(0)).toBe(true);
    const pos = positions.get(0)!;
    expect(pos.x).toBeGreaterThan(0);
    expect(pos.y).toBeGreaterThan(0);
  });

  it('positions all bus nodes in a linear chain', () => {
    const nodes = [makeBus(0, 'ext_grid'), makeBus(1), makeBus(2)];
    const edges = [makeEdge(0, 1), makeEdge(1, 2)];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    expect(positions.size).toBe(3);
    const y0 = positions.get(0)!.y;
    const y1 = positions.get(1)!.y;
    const y2 = positions.get(2)!.y;
    expect(y0).toBeLessThan(y1);
    expect(y1).toBeLessThan(y2);
  });

  it('uses ext_grid node as the root', () => {
    const nodes = [makeBus(0), makeBus(1), makeBus(2, 'ext_grid')];
    const edges = [makeEdge(0, 1), makeEdge(1, 2)];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    const yExtGrid = positions.get(2)!.y;
    const yOther1 = positions.get(1)!.y;
    const yOther0 = positions.get(0)!.y;
    expect(yExtGrid).toBeLessThan(yOther1);
    expect(yOther1).toBeLessThan(yOther0);
  });

  it('handles a tree with branching (fan-out)', () => {
    const nodes = [makeBus(0, 'ext_grid'), makeBus(1), makeBus(2), makeBus(3)];
    const edges = [makeEdge(0, 1), makeEdge(0, 2), makeEdge(0, 3)];
    const positions = calculateTreeLayout(nodes, edges, 3000, 1000);

    expect(positions.size).toBe(4);

    const yChildren = [1, 2, 3].map(id => positions.get(id)!.y);
    expect(new Set(yChildren).size).toBe(1);

    const xChildren = [1, 2, 3].map(id => positions.get(id)!.x);
    const uniqueX = new Set(xChildren);
    expect(uniqueX.size).toBe(3);
  });

  it('positions disconnected bus nodes at the bottom of the canvas', () => {
    const nodes = [makeBus(0, 'ext_grid'), makeBus(1)];
    const edges: NetworkEdge[] = [];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    expect(positions.size).toBe(2);
    const posDisconnected = positions.get(1)!;
    expect(posDisconnected.y).toBe(800);
  });

  it('positions element nodes (load_, sgen_, gen_) near their parent bus', () => {
    const nodes = [
      makeBus(0, 'ext_grid'),
      makeBus(1),
      makeElementNode('load_0'),
    ];
    const edges = [
      makeEdge(0, 1),
      makeEdge(1, 'load_0' as any, 'edge_1_load0'),
    ];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    expect(positions.has('load_0' as any)).toBe(true);
    const busPos = positions.get(1)!;
    const loadPos = positions.get('load_0' as any)!;
    const dx = Math.abs(loadPos.x - busPos.x);
    const dy = Math.abs(loadPos.y - busPos.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    expect(distance).toBeLessThanOrEqual(60);
  });

  it('positions multiple elements around the same bus at different angles', () => {
    const nodes = [
      makeBus(0, 'ext_grid'),
      makeElementNode('load_0'),
      makeElementNode('sgen_0'),
      makeElementNode('gen_0'),
    ];
    const edges = [
      makeEdge(0, 'load_0' as any),
      makeEdge(0, 'sgen_0' as any),
      makeEdge(0, 'gen_0' as any),
    ];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    const loadPos = positions.get('load_0' as any)!;
    const sgenPos = positions.get('sgen_0' as any)!;
    const genPos = positions.get('gen_0' as any)!;

    const posSet = new Set([
      `${loadPos.x},${loadPos.y}`,
      `${sgenPos.x},${sgenPos.y}`,
      `${genPos.x},${genPos.y}`,
    ]);
    expect(posSet.size).toBe(3);
  });

  it('handles element node with no matching bus edge gracefully', () => {
    const nodes = [
      makeBus(0, 'ext_grid'),
      makeElementNode('load_0'),
    ];
    const edges: NetworkEdge[] = [];
    const positions = calculateTreeLayout(nodes, edges, 2000, 1000);

    expect(positions.has('load_0' as any)).toBe(true);
  });

  it('positions all nodes within canvas bounds', () => {
    const width = 2000;
    const height = 1000;
    const nodes = [
      makeBus(0, 'ext_grid'),
      makeBus(1),
      makeBus(2),
      makeBus(3),
      makeElementNode('load_0'),
    ];
    const edges = [
      makeEdge(0, 1),
      makeEdge(1, 2),
      makeEdge(2, 3),
      makeEdge(3, 'load_0' as any),
    ];
    const positions = calculateTreeLayout(nodes, edges, width, height);

    for (const [, pos] of positions) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(width + 100);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(height + 100);
    }
  });
});
