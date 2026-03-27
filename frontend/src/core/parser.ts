import type {
  PandaPowerNetwork,
  PandaPowerBus,
  PandaPowerLine,
  PandaPowerTrafo,
  PandaPowerSwitch,
  PandaPowerExtGrid,
  PandaPowerStorage,
  NetworkNode,
  NetworkEdge,
  ElementInfo,
  BusGeoData,
  BusAnnotation
} from './types';

import { COLORS } from './colors';

function parseDataFrameFromObject<T>(data: unknown): Record<string, T> {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const obj = data as Record<string, unknown>;

  if ('_object' in obj) {
    let innerData: unknown;
    if (typeof obj._object === 'string') {
      try {
        innerData = JSON.parse(obj._object);
      } catch {
        return {};
      }
    } else {
      innerData = obj._object;
    }
    return parseDataFrameFromObject<T>(innerData);
  }

  if ('columns' in obj && 'index' in obj && 'data' in obj) {
    const columns = obj.columns as string[];
    const index = obj.index as (number | string)[];
    const rows = obj.data as unknown[][];

    const result: Record<string, T> = {};

    for (let i = 0; i < index.length; i++) {
      const row: Record<string, unknown> = { index: index[i] };
      for (let j = 0; j < columns.length; j++) {
        row[columns[j]] = rows[i][j];
      }
      result[String(index[i])] = row as T;
    }

    return result;
  }

  return {};
}

function getNetworkObject(data: Record<string, unknown>): Record<string, unknown> {
  if ('_object' in data && data._object && typeof data._object === 'object') {
    return data._object as Record<string, unknown>;
  }
  return data;
}

export function parsePandaPowerJson(jsonData: unknown): PandaPowerNetwork {
  const rawData = jsonData as Record<string, unknown>;

  const data = getNetworkObject(rawData);

  const network: PandaPowerNetwork = {
    bus: parseDataFrameFromObject<PandaPowerBus>(data.bus),
    line: parseDataFrameFromObject<PandaPowerLine>(data.line),
    trafo: parseDataFrameFromObject<PandaPowerTrafo>(data.trafo),
    load: parseDataFrameFromObject(data.load),
    sgen: parseDataFrameFromObject(data.sgen),
    gen: parseDataFrameFromObject(data.gen),
    switch: parseDataFrameFromObject<PandaPowerSwitch>(data.switch),
    ext_grid: parseDataFrameFromObject<PandaPowerExtGrid>(data.ext_grid),
    storage: parseDataFrameFromObject<PandaPowerStorage>(data.storage),
    res_bus: data.res_bus ? parseDataFrameFromObject(data.res_bus) : undefined,
    res_line: data.res_line ? parseDataFrameFromObject(data.res_line) : undefined,
    name: (data.name as string) || (rawData.name as string) || undefined,
    f_hz: (data.f_hz as number) || (rawData.f_hz as number) || undefined,
    sn_mva: (data.sn_mva as number) || (rawData.sn_mva as number) || undefined
  };

  return network;
}

export function convertToVisNetwork(network: PandaPowerNetwork): {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
} {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const extGridBuses = new Set<number>();

  Object.values(network.ext_grid).forEach((extGrid) => {
    extGridBuses.add(extGrid.bus);
  });

  Object.entries(network.bus).forEach(([key, bus]) => {
    const busIndex = typeof bus.index === 'number' ? bus.index : parseInt(key);
    const isExtGrid = extGridBuses.has(busIndex);

    const busName = bus.name || ((bus as unknown) as Record<string, unknown>).agui_cod as string || `Bus ${busIndex}`;
    const title = `
      <b>Bus ${busIndex}</b><br/>
      Name: ${busName}<br/>
      Voltage: ${bus.vn_kv} kV<br/>
      Type: ${bus.type || 'N/A'}
    `;

    nodes.push({
      id: busIndex,
      label: String(busIndex),
      title: title,
      color: isExtGrid ? COLORS.ext_grid : COLORS.bus,
      shape: 'dot',
      size: isExtGrid ? 10 : 6,
      borderWidth: isExtGrid ? 3 : 1,
      font: { color: '#e5e5e5' },
      type: isExtGrid ? 'ext_grid' : 'bus',
      data: bus
    });
  });

  Object.entries(network.load).forEach(([key, load]) => {
    const loadIndex = typeof load.index === 'number' ? load.index : parseInt(key);
    if (load.in_service === false) return;
    if (!network.bus[String(load.bus)]) return;

    const title = `
      <b>Load ${loadIndex}</b><br/>
      Bus: ${load.bus}<br/>
      P: ${(load.p_mw || 0).toFixed(3)} MW<br/>
      Q: ${(load.q_mvar || 0).toFixed(3)} MVAr
    `;

    nodes.push({
      id: `load_${loadIndex}` as unknown as number,
      label: String(loadIndex),
      title: title,
      color: COLORS.load,
      shape: 'triangleDown',
      size: 5,
      borderWidth: 1,
      font: { color: '#e5e5e5' },
      type: 'bus',
      data: load as unknown as PandaPowerBus
    });

    edges.push({
      id: `load_conn_${loadIndex}`,
      from: load.bus,
      to: `load_${loadIndex}` as unknown as number,
      label: '',
      title: '',
      color: { color: COLORS.load, highlight: COLORS.load },
      width: 1,
      dashes: false,
      type: 'line',
      data: load as unknown as PandaPowerLine
    });
  });

  Object.entries(network.sgen).forEach(([key, sgen]) => {
    const sgenIndex = typeof sgen.index === 'number' ? sgen.index : parseInt(key);
    if (sgen.in_service === false) return;
    if (!network.bus[String(sgen.bus)]) return;

    // Determine type and color based on sgen.type
    const sgenType = sgen.type || '';
    let nodeColor = COLORS.sgen;
    let typeLabel = 'Static Gen';

    if (sgenType === 'PV') {
      nodeColor = COLORS.solar;
      typeLabel = 'Solar PV';
    } else if (sgenType === 'WP') {
      nodeColor = COLORS.wind;
      typeLabel = 'Wind';
    }

    const title = `
      <b>${typeLabel} ${sgenIndex}</b><br/>
      Bus: ${sgen.bus}<br/>
      P: ${(sgen.p_mw || 0).toFixed(3)} MW<br/>
      Q: ${(sgen.q_mvar || 0).toFixed(3)} MVAr
      ${sgen.name ? `<br/>Name: ${sgen.name}` : ''}
    `;

    nodes.push({
      id: `sgen_${sgenIndex}` as unknown as number,
      label: String(sgenIndex),
      title: title,
      color: nodeColor,
      shape: 'triangle',
      size: 5,
      borderWidth: 1,
      font: { color: '#e5e5e5' },
      type: 'bus',
      data: sgen as unknown as PandaPowerBus
    });

    edges.push({
      id: `sgen_conn_${sgenIndex}`,
      from: sgen.bus,
      to: `sgen_${sgenIndex}` as unknown as number,
      label: '',
      title: '',
      color: { color: nodeColor, highlight: nodeColor },
      width: 1,
      dashes: false,
      type: 'line',
      data: sgen as unknown as PandaPowerLine
    });
  });

  Object.entries(network.gen).forEach(([key, gen]) => {
    const genIndex = typeof gen.index === 'number' ? gen.index : parseInt(key);
    if (gen.in_service === false) return;
    if (!network.bus[String(gen.bus)]) return;

    const title = `
      <b>Generator ${genIndex}</b><br/>
      Bus: ${gen.bus}<br/>
      P: ${(gen.p_mw || 0).toFixed(3)} MW<br/>
      Vm: ${(gen.vm_pu || 0).toFixed(3)} pu
    `;

    nodes.push({
      id: `gen_${genIndex}` as unknown as number,
      label: String(genIndex),
      title: title,
      color: COLORS.gen,
      shape: 'diamond',
      size: 6,
      borderWidth: 1,
      font: { color: '#e5e5e5' },
      type: 'bus',
      data: gen as unknown as PandaPowerBus
    });

    edges.push({
      id: `gen_conn_${genIndex}`,
      from: gen.bus,
      to: `gen_${genIndex}` as unknown as number,
      label: '',
      title: '',
      color: { color: COLORS.gen, highlight: COLORS.gen },
      width: 1,
      dashes: false,
      type: 'line',
      data: gen as unknown as PandaPowerLine
    });
  });

  // Battery storage elements
  Object.entries(network.storage).forEach(([key, storage]) => {
    const storageIndex = typeof storage.index === 'number' ? storage.index : parseInt(key);
    if (storage.in_service === false) return;
    if (!network.bus[String(storage.bus)]) return;

    const socPercent = storage.soc_percent || 0;
    const title = `
      <b>Battery Storage ${storageIndex}</b><br/>
      Bus: ${storage.bus}<br/>
      P: ${(storage.p_mw || 0).toFixed(3)} MW<br/>
      Capacity: ${(storage.max_e_mwh || 0).toFixed(1)} MWh<br/>
      Max Power: ${(storage.max_p_mw || 0).toFixed(1)} MW<br/>
      SoC: ${socPercent.toFixed(1)}%
      ${storage.name ? `<br/>Name: ${storage.name}` : ''}
    `;

    nodes.push({
      id: `storage_${storageIndex}` as unknown as number,
      label: String(storageIndex),
      title: title,
      color: COLORS.storage,
      shape: 'square',
      size: 6,
      borderWidth: 2,
      font: { color: '#e5e5e5' },
      type: 'bus',
      data: storage as unknown as PandaPowerBus
    });

    edges.push({
      id: `storage_conn_${storageIndex}`,
      from: storage.bus,
      to: `storage_${storageIndex}` as unknown as number,
      label: '',
      title: '',
      color: { color: COLORS.storage, highlight: COLORS.storage },
      width: 1,
      dashes: false,
      type: 'line',
      data: storage as unknown as PandaPowerLine
    });
  });

  Object.entries(network.line).forEach(([key, line]) => {
    const lineIndex = typeof line.index === 'number' ? line.index : parseInt(key);

    const fromBus = line.from_bus;
    const toBus = line.to_bus;

    if (!network.bus[String(fromBus)] || !network.bus[String(toBus)]) {
      return;
    }

    const loading = network.res_line?.[key]?.loading_percent;

    const title = `
      <b>Line ${lineIndex}</b><br/>
      From: Bus ${fromBus}<br/>
      To: Bus ${toBus}<br/>
      Length: ${line.length_km?.toFixed(3) || 'N/A'} km<br/>
      Max I: ${line.max_i_ka || 'N/A'} kA
      ${loading !== undefined ? `<br/>Loading: ${loading.toFixed(1)}%` : ''}
    `;

    edges.push({
      id: `line_${lineIndex}`,
      from: fromBus,
      to: toBus,
      label: String(lineIndex),
      title: title,
      color: {
        color: COLORS.line,
        highlight: '#3498DB'
      },
      width: 1,
      dashes: line.in_service === false,
      type: 'line',
      data: line
    });
  });

  Object.entries(network.trafo).forEach(([key, trafo]) => {
    const trafoIndex = typeof trafo.index === 'number' ? trafo.index : parseInt(key);

    const hvBus = trafo.hv_bus;
    const lvBus = trafo.lv_bus;

    if (!network.bus[String(hvBus)] || !network.bus[String(lvBus)]) {
      return;
    }

    const title = `
      <b>Transformer ${trafoIndex}</b><br/>
      HV Bus: ${hvBus} (${trafo.vn_hv_kv} kV)<br/>
      LV Bus: ${lvBus} (${trafo.vn_lv_kv} kV)<br/>
      Rating: ${trafo.sn_mva || 'N/A'} MVA
      ${trafo.tap_pos !== undefined ? `<br/>Tap: ${trafo.tap_pos}` : ''}
    `;

    const w1Id = `trafo_${trafoIndex}_w1`;
    const w2Id = `trafo_${trafoIndex}_w2`;

    nodes.push({
      id: w1Id as unknown as number,
      label: '',
      title: title,
      color: COLORS.trafo,
      shape: 'circle',
      size: 6,
      borderWidth: 2,
      font: { color: '#e5e5e5' },
      type: 'trafo' as 'bus',
      data: trafo as unknown as PandaPowerBus
    });

    nodes.push({
      id: w2Id as unknown as number,
      label: '',
      title: title,
      color: COLORS.trafo,
      shape: 'circle',
      size: 6,
      borderWidth: 2,
      font: { color: '#e5e5e5' },
      type: 'trafo' as 'bus',
      data: trafo as unknown as PandaPowerBus
    });

    edges.push({
      id: `trafo_${trafoIndex}_hv`,
      from: hvBus,
      to: w1Id as unknown as number,
      label: '',
      title: title,
      color: { color: COLORS.trafo, highlight: '#333333' },
      width: 2,
      dashes: trafo.in_service === false,
      type: 'trafo',
      data: trafo
    });

    edges.push({
      id: `trafo_${trafoIndex}_mid`,
      from: w1Id as unknown as number,
      to: w2Id as unknown as number,
      label: '',
      title: title,
      color: { color: COLORS.trafo, highlight: '#333333' },
      width: 2,
      dashes: trafo.in_service === false,
      type: 'trafo',
      data: trafo
    });

    edges.push({
      id: `trafo_${trafoIndex}_lv`,
      from: w2Id as unknown as number,
      to: lvBus,
      label: '',
      title: title,
      color: { color: COLORS.trafo, highlight: '#333333' },
      width: 2,
      dashes: trafo.in_service === false,
      type: 'trafo',
      data: trafo
    });
  });

  Object.entries(network.switch).forEach(([key, sw]) => {
    if (sw.et !== 'b') return;

    const swIndex = typeof sw.index === 'number' ? sw.index : parseInt(key);

    const swBus = sw.bus;
    const swElement = sw.element;

    if (!network.bus[String(swBus)] || !network.bus[String(swElement)]) {
      return;
    }

    const title = `
      <b>Switch ${swIndex}</b><br/>
      Bus: ${swBus}<br/>
      Element: ${swElement}<br/>
      Type: ${sw.type || 'N/A'}<br/>
      State: ${sw.closed ? 'CLOSED' : 'OPEN'}
    `;

    const switchColor = sw.closed ? COLORS.switch_closed : COLORS.switch_open;

    edges.push({
      id: `switch_${swIndex}`,
      from: swBus,
      to: swElement,
      label: String(swIndex),
      title: title,
      color: { color: switchColor, highlight: '#333333' },
      width: 2,
      dashes: true,
      type: 'switch',
      data: sw
    });
  });

  return { nodes, edges };
}

function buildBusAnnotations(network: PandaPowerNetwork): Map<number, BusAnnotation> {
  const annotations = new Map<number, BusAnnotation>();

  const getOrCreate = (busIdx: number): BusAnnotation => {
    let ann = annotations.get(busIdx);
    if (!ann) {
      ann = { hasLoad: false, hasGen: false, hasExtGrid: false, totalLoadMW: 0, totalGenMW: 0, loadCount: 0, genCount: 0 };
      annotations.set(busIdx, ann);
    }
    return ann;
  };

  Object.values(network.load).forEach(load => {
    if (load.in_service === false) return;
    const ann = getOrCreate(load.bus);
    ann.hasLoad = true;
    ann.totalLoadMW += load.p_mw || 0;
    ann.loadCount++;
  });

  Object.values(network.gen).forEach(gen => {
    if (gen.in_service === false) return;
    const ann = getOrCreate(gen.bus);
    ann.hasGen = true;
    ann.totalGenMW += gen.p_mw || 0;
    ann.genCount++;
  });

  Object.values(network.sgen).forEach(sgen => {
    if (sgen.in_service === false) return;
    const ann = getOrCreate(sgen.bus);
    ann.hasGen = true;
    ann.totalGenMW += sgen.p_mw || 0;
    ann.genCount++;
  });

  Object.values(network.ext_grid).forEach(eg => {
    if (eg.in_service === false) return;
    getOrCreate(eg.bus).hasExtGrid = true;
  });

  return annotations;
}

export function convertToVisNetworkCompact(network: PandaPowerNetwork): {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  busAnnotations: Map<number, BusAnnotation>;
} {
  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const annotations = buildBusAnnotations(network);

  // Bus nodes — colored by equipment type
  Object.entries(network.bus).forEach(([key, bus]) => {
    const busIndex = typeof bus.index === 'number' ? bus.index : parseInt(key);
    const ann = annotations.get(busIndex);
    const busName = bus.name || ((bus as unknown) as Record<string, unknown>).agui_cod as string || `Bus ${busIndex}`;

    let color = COLORS.bus;           // plain blue
    if (ann?.hasExtGrid) {
      color = '#fbbf24';              // gold
    } else if (ann?.hasGen && ann?.hasLoad) {
      color = '#2dd4bf';              // teal
    } else if (ann?.hasGen) {
      color = '#4ade80';              // green
    } else if (ann?.hasLoad) {
      color = '#fb923c';              // orange
    }

    const totalMW = (ann?.totalLoadMW || 0) + (ann?.totalGenMW || 0);
    const size = Math.max(4, Math.min(12, 5 + Math.log10(Math.max(1, totalMW))));

    const title = `<b>Bus ${busIndex}</b><br/>Name: ${busName}<br/>Voltage: ${bus.vn_kv} kV` +
      (ann ? `<br/>Loads: ${ann.loadCount} (${ann.totalLoadMW.toFixed(1)} MW)<br/>Gens: ${ann.genCount} (${ann.totalGenMW.toFixed(1)} MW)` : '');

    nodes.push({
      id: busIndex,
      label: String(busIndex),
      title,
      color,
      shape: 'dot',
      size,
      borderWidth: ann?.hasExtGrid ? 3 : 1,
      font: { color: '#e5e5e5' },
      type: ann?.hasExtGrid ? 'ext_grid' : 'bus',
      data: bus
    });
  });

  // Line edges — no labels for performance
  Object.entries(network.line).forEach(([key, line]) => {
    const lineIndex = typeof line.index === 'number' ? line.index : parseInt(key);
    if (!network.bus[String(line.from_bus)] || !network.bus[String(line.to_bus)]) return;

    edges.push({
      id: `line_${lineIndex}`,
      from: line.from_bus,
      to: line.to_bus,
      label: '',
      title: `Line ${lineIndex}: Bus ${line.from_bus} → Bus ${line.to_bus}`,
      color: { color: COLORS.line, highlight: '#3498DB' },
      width: 1,
      dashes: line.in_service === false,
      type: 'line',
      data: line
    });
  });

  // Trafo edges — single edge HV→LV, no winding nodes
  Object.entries(network.trafo).forEach(([key, trafo]) => {
    const trafoIndex = typeof trafo.index === 'number' ? trafo.index : parseInt(key);
    if (!network.bus[String(trafo.hv_bus)] || !network.bus[String(trafo.lv_bus)]) return;

    edges.push({
      id: `trafo_${trafoIndex}`,
      from: trafo.hv_bus,
      to: trafo.lv_bus,
      label: '',
      title: `Trafo ${trafoIndex}: ${trafo.vn_hv_kv}/${trafo.vn_lv_kv} kV, ${trafo.sn_mva} MVA`,
      color: { color: COLORS.trafo, highlight: '#333333' },
      width: 2,
      dashes: trafo.in_service === false,
      type: 'trafo',
      data: trafo
    });
  });

  // Bus-bus switches only
  Object.entries(network.switch).forEach(([key, sw]) => {
    if (sw.et !== 'b') return;
    const swIndex = typeof sw.index === 'number' ? sw.index : parseInt(key);
    if (!network.bus[String(sw.bus)] || !network.bus[String(sw.element)]) return;

    const switchColor = sw.closed ? COLORS.switch_closed : COLORS.switch_open;
    edges.push({
      id: `switch_${swIndex}`,
      from: sw.bus,
      to: sw.element,
      label: '',
      title: `Switch ${swIndex}: ${sw.closed ? 'CLOSED' : 'OPEN'}`,
      color: { color: switchColor, highlight: '#333333' },
      width: 2,
      dashes: true,
      type: 'switch',
      data: sw
    });
  });

  return { nodes, edges, busAnnotations: annotations };
}

export function getCompactBusInfo(
  busIndex: number,
  network: PandaPowerNetwork,
  annotations: Map<number, BusAnnotation>
): ElementInfo {
  const bus = network.bus[String(busIndex)];
  const ann = annotations.get(busIndex);
  const properties: Record<string, string | number | boolean> = {};
  const busData = (bus as unknown) as Record<string, unknown>;

  properties['Index'] = busIndex;
  properties['Name'] = bus?.name || busData?.agui_cod as string || 'N/A';
  properties['Voltage Level (kV)'] = bus?.vn_kv || 'N/A';
  properties['Type'] = bus?.type || 'N/A';
  properties['In Service'] = bus?.in_service !== false;

  if (busData?.agui_cod) {
    properties['AGUI Code'] = busData.agui_cod as string;
  }

  if (ann) {
    if (ann.loadCount > 0) {
      properties['Connected Loads'] = ann.loadCount;
      properties['Total Load (MW)'] = ann.totalLoadMW.toFixed(2);
    }
    if (ann.genCount > 0) {
      properties['Connected Generators'] = ann.genCount;
      properties['Total Generation (MW)'] = ann.totalGenMW.toFixed(2);
    }
    if (ann.hasExtGrid) {
      properties['External Grid'] = true;
    }
  }

  if (network.res_bus?.[busIndex]) {
    const resBus = network.res_bus[busIndex];
    properties['Vm (pu)'] = resBus.vm_pu?.toFixed(4) || 'N/A';
    properties['Va (degree)'] = resBus.va_degree?.toFixed(2) || 'N/A';
  }

  return {
    type: ann?.hasExtGrid ? 'External Grid Bus' : 'Bus',
    id: busIndex,
    name: bus?.name || (busData?.agui_cod as string) || `Bus ${busIndex}`,
    properties
  };
}

export function getElementInfo(
  element: NetworkNode | NetworkEdge,
  network: PandaPowerNetwork
): ElementInfo {
  const properties: Record<string, string | number | boolean> = {};

  if ('shape' in element) {
    const node = element as NetworkNode;
    const nodeId = String(node.id);

    if (nodeId.startsWith('load_')) {
      const loadIndex = nodeId.replace('load_', '');
      const load = network.load[loadIndex];
      if (load) {
        properties['Index'] = load.index;
        properties['Bus'] = load.bus;
        properties['P (MW)'] = (load.p_mw || 0).toFixed(4);
        properties['Q (MVAr)'] = (load.q_mvar || 0).toFixed(4);
        properties['In Service'] = load.in_service !== false;
        return { type: 'Load', id: load.index, name: `Load ${load.index}`, properties };
      }
    }

    if (nodeId.startsWith('sgen_')) {
      const sgenIndex = nodeId.replace('sgen_', '');
      const sgen = network.sgen[sgenIndex];
      if (sgen) {
        // Determine type based on sgen.type
        let typeName = 'Static Generator';
        if (sgen.type === 'PV') typeName = 'Solar PV Plant';
        else if (sgen.type === 'WP') typeName = 'Wind Farm';

        properties['Index'] = sgen.index;
        properties['Bus'] = sgen.bus;
        properties['P (MW)'] = (sgen.p_mw || 0).toFixed(4);
        properties['Q (MVAr)'] = (sgen.q_mvar || 0).toFixed(4);
        if (sgen.type) properties['Type'] = sgen.type;
        if (sgen.name) properties['Name'] = sgen.name;
        properties['In Service'] = sgen.in_service !== false;
        return { type: typeName, id: sgen.index, name: sgen.name || `SGen ${sgen.index}`, properties };
      }
    }

    if (nodeId.startsWith('storage_')) {
      const storageIndex = nodeId.replace('storage_', '');
      const storage = network.storage[storageIndex];
      if (storage) {
        properties['Index'] = storage.index;
        properties['Bus'] = storage.bus;
        properties['P (MW)'] = (storage.p_mw || 0).toFixed(4);
        properties['Capacity (MWh)'] = (storage.max_e_mwh || 0).toFixed(2);
        properties['Max Power (MW)'] = (storage.max_p_mw || 0).toFixed(2);
        properties['Min Power (MW)'] = (storage.min_p_mw || 0).toFixed(2);
        properties['State of Charge (%)'] = (storage.soc_percent || 0).toFixed(1);
        if (storage.name) properties['Name'] = storage.name;
        properties['In Service'] = storage.in_service !== false;
        return { type: 'Battery Storage', id: storage.index, name: storage.name || `BESS ${storage.index}`, properties };
      }
    }

    if (nodeId.startsWith('gen_')) {
      const genIndex = nodeId.replace('gen_', '');
      const gen = network.gen[genIndex];
      if (gen) {
        properties['Index'] = gen.index;
        properties['Bus'] = gen.bus;
        properties['P (MW)'] = (gen.p_mw || 0).toFixed(4);
        properties['Vm (pu)'] = (gen.vm_pu || 0).toFixed(4);
        properties['In Service'] = gen.in_service !== false;
        return { type: 'Generator', id: gen.index, name: `Gen ${gen.index}`, properties };
      }
    }

    if (nodeId.startsWith('trafo_')) {
      const trafoIndex = nodeId.replace('trafo_', '').replace('_w1', '').replace('_w2', '');
      const trafo = network.trafo[trafoIndex];
      if (trafo) {
        properties['Index'] = trafo.index;
        properties['HV Bus'] = trafo.hv_bus;
        properties['LV Bus'] = trafo.lv_bus;
        properties['Rating (MVA)'] = trafo.sn_mva || 'N/A';
        properties['HV (kV)'] = trafo.vn_hv_kv || 'N/A';
        properties['LV (kV)'] = trafo.vn_lv_kv || 'N/A';
        if (trafo.tap_pos !== undefined) {
          properties['Tap Position'] = trafo.tap_pos;
          properties['Tap Min'] = trafo.tap_min || 'N/A';
          properties['Tap Max'] = trafo.tap_max || 'N/A';
        }
        properties['In Service'] = trafo.in_service !== false;
        return { type: 'Transformer', id: trafo.index, name: `Transformer ${trafo.index}`, properties };
      }
    }

    const bus = node.data as PandaPowerBus;
    const busData = (bus as unknown) as Record<string, unknown>;

    properties['Index'] = bus.index;
    properties['Name'] = bus.name || busData.agui_cod as string || 'N/A';
    properties['Voltage Level (kV)'] = bus.vn_kv;
    properties['Type'] = bus.type || 'N/A';
    properties['In Service'] = bus.in_service !== false;

    if (busData.agui_cod) {
      properties['AGUI Code'] = busData.agui_cod as string;
    }

    if (network.res_bus?.[bus.index]) {
      const resBus = network.res_bus[bus.index];
      properties['Vm (pu)'] = resBus.vm_pu?.toFixed(4) || 'N/A';
      properties['Va (degree)'] = resBus.va_degree?.toFixed(2) || 'N/A';
    }

    return {
      type: node.type === 'ext_grid' ? 'External Grid Bus' : 'Bus',
      id: bus.index,
      name: bus.name || busData.agui_cod as string || `Bus ${bus.index}`,
      properties
    };
  } else {
    const edge = element as NetworkEdge;
    const edgeId = edge.id;

    if (edgeId.startsWith('load_conn_') || edgeId.startsWith('sgen_conn_') || edgeId.startsWith('gen_conn_')) {
      return { type: 'Connection', id: edgeId, name: 'Element Connection', properties: {} };
    }

    if (edgeId.startsWith('trafo_')) {
      const trafoIndex = edgeId.replace('trafo_', '').replace('_hv', '').replace('_mid', '').replace('_lv', '');
      const trafo = network.trafo[trafoIndex];
      if (trafo) {
        properties['Index'] = trafo.index;
        properties['HV Bus'] = trafo.hv_bus;
        properties['LV Bus'] = trafo.lv_bus;
        properties['Rating (MVA)'] = trafo.sn_mva || 'N/A';
        properties['HV (kV)'] = trafo.vn_hv_kv || 'N/A';
        properties['LV (kV)'] = trafo.vn_lv_kv || 'N/A';
        if (trafo.tap_pos !== undefined) properties['Tap Position'] = trafo.tap_pos;
        properties['In Service'] = trafo.in_service !== false;
        return { type: 'Transformer', id: trafo.index, name: `Transformer ${trafo.index}`, properties };
      }
    }

    if (edgeId.startsWith('switch_')) {
      const swIndex = edgeId.replace('switch_', '').replace('_a', '').replace('_b', '');
      const sw = network.switch[swIndex];
      if (sw) {
        properties['Index'] = sw.index;
        properties['Bus'] = sw.bus;
        properties['Element'] = sw.element;
        properties['Type'] = sw.type || 'N/A';
        properties['Closed'] = sw.closed;
        return { type: 'Switch', id: sw.index, name: `Switch ${sw.index}`, properties };
      }
    }

    if (edge.type === 'line') {
      const line = edge.data as PandaPowerLine;
      const lineData = (line as unknown) as Record<string, unknown>;

      properties['Index'] = line.index;
      properties['Name'] = line.name || 'N/A';
      properties['From Bus'] = line.from_bus;
      properties['To Bus'] = line.to_bus;
      properties['Length (km)'] = line.length_km?.toFixed(3) || 'N/A';
      properties['R (Ω/km)'] = line.r_ohm_per_km?.toFixed(4) || 'N/A';
      properties['X (Ω/km)'] = line.x_ohm_per_km?.toFixed(4) || 'N/A';
      properties['Max I (kA)'] = line.max_i_ka || 'N/A';
      properties['In Service'] = line.in_service !== false;

      if (lineData.agui_cod) properties['AGUI Code'] = lineData.agui_cod as string;

      if (network.res_line?.[line.index]) {
        const resLine = network.res_line[line.index];
        properties['Loading (%)'] = resLine.loading_percent?.toFixed(2) || 'N/A';
        properties['I (kA)'] = resLine.i_ka?.toFixed(4) || 'N/A';
      }

      return { type: 'Line', id: line.index, name: line.name || `Line ${line.index}`, properties };
    }

    return { type: 'Edge', id: edgeId, name: edgeId, properties: {} };
  }
}

export function getNetworkStatistics(network: PandaPowerNetwork): Record<string, number> {
  // Count renewable types separately
  const sgens = Object.values(network.sgen);
  const solarCount = sgens.filter(s => s.type === 'PV').length;
  const windCount = sgens.filter(s => s.type === 'WP').length;
  const otherSgenCount = sgens.filter(s => s.type !== 'PV' && s.type !== 'WP').length;

  return {
    'Buses': Object.keys(network.bus).length,
    'Lines': Object.keys(network.line).length,
    'Transformers': Object.keys(network.trafo).length,
    'Loads': Object.keys(network.load).length,
    'Static Gens': otherSgenCount,
    'Solar Plants': solarCount,
    'Wind Farms': windCount,
    'Generators': Object.keys(network.gen).length,
    'Storage': Object.keys(network.storage).length,
    'Switches': Object.keys(network.switch).length,
    'Ext Grids': Object.keys(network.ext_grid).length
  };
}

export function extractGeodata(network: PandaPowerNetwork): BusGeoData[] {
  const results: BusGeoData[] = [];
  for (const bus of Object.values(network.bus)) {
    if (!bus.geo) continue;
    const match = bus.geo.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (!match) continue;
    const longitude = parseFloat(match[1]);
    const latitude = parseFloat(match[2]);
    if (isNaN(latitude) || isNaN(longitude)) continue;
    results.push({
      bus: bus.index,
      name: bus.name || `Bus ${bus.index}`,
      latitude,
      longitude,
      vn_kv: bus.vn_kv,
    });
  }
  return results;
}
