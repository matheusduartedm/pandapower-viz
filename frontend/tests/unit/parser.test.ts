import { describe, it, expect } from 'vitest';
import {
  parsePandaPowerJson,
  convertToVisNetwork,
  extractGeodata,
} from '../../src/core/parser';
import type { PandaPowerNetwork } from '../../src/core/types';

// ---------------------------------------------------------------------------
// Fixture: minimal 2-bus network
// ---------------------------------------------------------------------------
const minimalNetwork: PandaPowerNetwork = {
  bus: {
    '0': { index: 0, name: 'Bus 0', vn_kv: 110, type: 'b', in_service: true },
    '1': { index: 1, name: 'Bus 1', vn_kv: 20, type: 'b', in_service: true },
  },
  line: {
    '0': {
      index: 0,
      name: 'Line 0-1',
      from_bus: 0,
      to_bus: 1,
      length_km: 10,
      r_ohm_per_km: 0.01,
      x_ohm_per_km: 0.1,
      c_nf_per_km: 10,
      max_i_ka: 0.5,
      in_service: true,
    },
  },
  trafo: {},
  load: {},
  sgen: {},
  gen: {},
  switch: {},
  ext_grid: {
    '0': { index: 0, name: 'Grid', bus: 0, vm_pu: 1.0, va_degree: 0, in_service: true },
  },
  storage: {},
};

// ---------------------------------------------------------------------------
// parseDataFrameFromObject — exported indirectly via parsePandaPowerJson
// ---------------------------------------------------------------------------
describe('parseDataFrameFromObject (via parsePandaPowerJson)', () => {
  it('parses column/index/data format correctly', () => {
    const raw = {
      bus: {
        columns: ['name', 'vn_kv'],
        index: [0, 1],
        data: [
          ['Bus 0', 110],
          ['Bus 1', 20],
        ],
      },
      line: {},
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(raw);
    expect(Object.keys(network.bus)).toHaveLength(2);
    expect(network.bus['0'].name).toBe('Bus 0');
    expect(network.bus['0'].vn_kv).toBe(110);
    expect(network.bus['1'].name).toBe('Bus 1');
    expect(network.bus['1'].vn_kv).toBe(20);
  });

  it('unwraps _object wrapper when value is a string', () => {
    const raw = {
      bus: {
        _object: '{"columns": ["name"], "index": [0], "data": [["Bus 0"]]}',
      },
      line: {},
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(raw);
    expect(Object.keys(network.bus)).toHaveLength(1);
    expect(network.bus['0'].name).toBe('Bus 0');
  });

  it('unwraps _object wrapper when value is already an object', () => {
    const raw = {
      bus: {
        _object: {
          columns: ['name'],
          index: [0],
          data: [['Bus 0']],
        },
      },
      line: {},
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(raw);
    expect(Object.keys(network.bus)).toHaveLength(1);
    expect(network.bus['0'].name).toBe('Bus 0');
  });

  it('returns empty record for null/empty input', () => {
    const raw = {
      bus: null,
      line: undefined,
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(raw);
    expect(Object.keys(network.bus)).toHaveLength(0);
    expect(Object.keys(network.line)).toHaveLength(0);
  });

  it('returns empty record for invalid input (no columns/index/data)', () => {
    const raw = {
      bus: { foo: 'bar', baz: 42 },
      line: {},
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(raw);
    expect(Object.keys(network.bus)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parsePandaPowerJson
// ---------------------------------------------------------------------------
const minimalDataFrameNetwork = {
  bus: {
    columns: ['name', 'vn_kv', 'type', 'in_service'],
    index: [0, 1],
    data: [
      ['Bus 0', 110, 'b', true],
      ['Bus 1', 20, 'b', true],
    ],
  },
  line: {
    columns: ['name', 'from_bus', 'to_bus', 'length_km', 'r_ohm_per_km', 'x_ohm_per_km', 'c_nf_per_km', 'max_i_ka', 'in_service'],
    index: [0],
    data: [['Line 0-1', 0, 1, 10, 0.01, 0.1, 10, 0.5, true]],
  },
  trafo: { columns: [], index: [], data: [] },
  load: { columns: [], index: [], data: [] },
  sgen: { columns: [], index: [], data: [] },
  gen: { columns: [], index: [], data: [] },
  switch: { columns: [], index: [], data: [] },
  ext_grid: {
    columns: ['name', 'bus', 'vm_pu', 'va_degree', 'in_service'],
    index: [0],
    data: [['Grid', 0, 1.0, 0, true]],
  },
  storage: { columns: [], index: [], data: [] },
};

describe('parsePandaPowerJson', () => {
  it('parses a minimal valid network with correct counts', () => {
    const network = parsePandaPowerJson(minimalDataFrameNetwork);

    expect(Object.keys(network.bus)).toHaveLength(2);
    expect(Object.keys(network.line)).toHaveLength(1);
    expect(Object.keys(network.ext_grid)).toHaveLength(1);
    expect(Object.keys(network.load)).toHaveLength(0);
    expect(Object.keys(network.trafo)).toHaveLength(0);
  });

  it('unwraps top-level _object wrapper', () => {
    const wrapped = {
      _object: { ...minimalDataFrameNetwork },
    };

    const network = parsePandaPowerJson(wrapped);
    expect(Object.keys(network.bus)).toHaveLength(2);
    expect(Object.keys(network.ext_grid)).toHaveLength(1);
  });

  it('returns network with empty records for empty network', () => {
    const empty = {
      bus: {},
      line: {},
      trafo: {},
      load: {},
      sgen: {},
      gen: {},
      switch: {},
      ext_grid: {},
      storage: {},
    };

    const network = parsePandaPowerJson(empty);
    expect(Object.keys(network.bus)).toHaveLength(0);
    expect(Object.keys(network.line)).toHaveLength(0);
  });

  it('extracts network name and f_hz correctly', () => {
    const raw = {
      ...minimalDataFrameNetwork,
      name: 'Test Network',
      f_hz: 60,
    };

    const network = parsePandaPowerJson(raw);
    expect(network.name).toBe('Test Network');
    expect(network.f_hz).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// convertToVisNetwork
// ---------------------------------------------------------------------------
describe('convertToVisNetwork', () => {
  it('produces correct number of nodes and edges for 2-bus + 1-line', () => {
    const { nodes, edges } = convertToVisNetwork(minimalNetwork);

    const busNodes = nodes.filter((n) => typeof n.id === 'number');
    expect(busNodes).toHaveLength(2);

    const lineEdges = edges.filter((e) => e.type === 'line');
    expect(lineEdges).toHaveLength(1);
  });

  it('gives ext_grid bus the correct color (#fbbf24)', () => {
    const { nodes } = convertToVisNetwork(minimalNetwork);

    const extGridNode = nodes.find((n) => n.id === 0);
    expect(extGridNode).toBeDefined();
    expect(extGridNode!.color).toBe('#fbbf24');
  });

  it('creates load nodes with triangleDown shape', () => {
    const networkWithLoad: PandaPowerNetwork = {
      ...minimalNetwork,
      load: {
        '0': {
          index: 0,
          name: 'Load 0',
          bus: 1,
          p_mw: 10,
          q_mvar: 5,
          scaling: 1,
          in_service: true,
        },
      },
    };

    const { nodes } = convertToVisNetwork(networkWithLoad);
    const loadNode = nodes.find((n) => String(n.id) === 'load_0');
    expect(loadNode).toBeDefined();
    expect(loadNode!.shape).toBe('image');
  });

  it('gives sgen with type PV the solar color (#fbbf24)', () => {
    const networkWithSolar: PandaPowerNetwork = {
      ...minimalNetwork,
      sgen: {
        '0': {
          index: 0,
          name: 'Solar 0',
          bus: 1,
          p_mw: 5,
          q_mvar: 0,
          scaling: 1,
          in_service: true,
          type: 'PV',
        },
      },
    };

    const { nodes } = convertToVisNetwork(networkWithSolar);
    const sgenNode = nodes.find((n) => String(n.id) === 'sgen_0');
    expect(sgenNode).toBeDefined();
    expect(sgenNode!.color).toBe('#fbbf24');
  });

  it('skips out-of-service loads', () => {
    const networkWithOosLoad: PandaPowerNetwork = {
      ...minimalNetwork,
      load: {
        '0': {
          index: 0,
          name: 'OOS Load',
          bus: 1,
          p_mw: 10,
          q_mvar: 5,
          scaling: 1,
          in_service: false,
        },
      },
    };

    const { nodes } = convertToVisNetwork(networkWithOosLoad);
    const loadNode = nodes.find((n) => String(n.id) === 'load_0');
    expect(loadNode).toBeUndefined();
  });

  it('skips out-of-service sgens', () => {
    const networkWithOosSgen: PandaPowerNetwork = {
      ...minimalNetwork,
      sgen: {
        '0': {
          index: 0,
          name: 'OOS Sgen',
          bus: 1,
          p_mw: 5,
          q_mvar: 0,
          scaling: 1,
          in_service: false,
        },
      },
    };

    const { nodes } = convertToVisNetwork(networkWithOosSgen);
    const sgenNode = nodes.find((n) => String(n.id) === 'sgen_0');
    expect(sgenNode).toBeUndefined();
  });

  it('produces line edges with correct from/to buses', () => {
    const { edges } = convertToVisNetwork(minimalNetwork);

    const lineEdge = edges.find((e) => e.id === 'line_0');
    expect(lineEdge).toBeDefined();
    expect(lineEdge!.from).toBe(0);
    expect(lineEdge!.to).toBe(1);
  });

  it('creates transformer winding nodes and edges', () => {
    const networkWithTrafo: PandaPowerNetwork = {
      ...minimalNetwork,
      trafo: {
        '0': {
          index: 0,
          name: 'Trafo 0',
          hv_bus: 0,
          lv_bus: 1,
          sn_mva: 40,
          vn_hv_kv: 110,
          vn_lv_kv: 20,
          vk_percent: 10,
          vkr_percent: 0.3,
          pfe_kw: 30,
          i0_percent: 0.07,
          in_service: true,
        },
      },
    };

    const { nodes, edges } = convertToVisNetwork(networkWithTrafo);

    const windingNodes = nodes.filter((n) => String(n.id).startsWith('trafo_'));
    expect(windingNodes).toHaveLength(2);

    const trafoEdges = edges.filter((e) => e.type === 'trafo');
    expect(trafoEdges).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// extractGeodata
// ---------------------------------------------------------------------------
describe('extractGeodata', () => {
  it('extracts lat/lon from POINT geometry strings', () => {
    const networkWithGeo: PandaPowerNetwork = {
      ...minimalNetwork,
      bus: {
        '0': {
          index: 0,
          name: 'Geo Bus',
          vn_kv: 110,
          type: 'b',
          in_service: true,
          geo: 'POINT (-43.172 -22.907)',
        },
        '1': {
          index: 1,
          name: 'No Geo Bus',
          vn_kv: 20,
          type: 'b',
          in_service: true,
        },
      },
    };

    const geoData = extractGeodata(networkWithGeo);
    expect(geoData).toHaveLength(1);
    expect(geoData[0].bus).toBe(0);
    expect(geoData[0].longitude).toBeCloseTo(-43.172);
    expect(geoData[0].latitude).toBeCloseTo(-22.907);
    expect(geoData[0].vn_kv).toBe(110);
  });

  it('returns empty array when no buses have geo data', () => {
    const geoData = extractGeodata(minimalNetwork);
    expect(geoData).toHaveLength(0);
  });
});
