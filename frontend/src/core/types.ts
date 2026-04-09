export interface PandaPowerBus {
  index: number;
  name: string;
  vn_kv: number;
  type: string;
  zone?: string;
  in_service: boolean;
  geo?: string;
}

export interface PandaPowerLine {
  index: number;
  name: string;
  from_bus: number;
  to_bus: number;
  length_km: number;
  r_ohm_per_km: number;
  x_ohm_per_km: number;
  c_nf_per_km: number;
  max_i_ka: number;
  in_service: boolean;
  type?: string;
}

export interface PandaPowerTrafo {
  index: number;
  name: string;
  hv_bus: number;
  lv_bus: number;
  sn_mva: number;
  vn_hv_kv: number;
  vn_lv_kv: number;
  vk_percent: number;
  vkr_percent: number;
  pfe_kw: number;
  i0_percent: number;
  tap_pos?: number;
  tap_min?: number;
  tap_max?: number;
  in_service: boolean;
}

export interface PandaPowerLoad {
  index: number;
  name: string;
  bus: number;
  p_mw: number;
  q_mvar: number;
  const_z_percent?: number;
  const_i_percent?: number;
  sn_mva?: number;
  scaling: number;
  in_service: boolean;
  type?: string;
}

export interface PandaPowerSgen {
  index: number;
  name: string;
  bus: number;
  p_mw: number;
  q_mvar: number;
  sn_mva?: number;
  scaling: number;
  in_service: boolean;
  type?: string;
  current_source?: boolean;
}

export interface PandaPowerStorage {
  index: number;
  name: string;
  bus: number;
  p_mw: number;
  q_mvar: number;
  max_e_mwh: number;
  max_p_mw: number;
  min_p_mw: number;
  soc_percent: number;
  in_service: boolean;
  type?: string;
}

export interface PandaPowerGen {
  index: number;
  name: string;
  bus: number;
  p_mw: number;
  vm_pu: number;
  sn_mva?: number;
  min_q_mvar?: number;
  max_q_mvar?: number;
  scaling: number;
  in_service: boolean;
  type?: string;
}

export interface PandaPowerSwitch {
  index: number;
  name: string;
  bus: number;
  element: number;
  et: string;
  type?: string;
  closed: boolean;
  z_ohm?: number;
}

export interface PandaPowerExtGrid {
  index: number;
  name: string;
  bus: number;
  vm_pu: number;
  va_degree: number;
  s_sc_max_mva?: number;
  s_sc_min_mva?: number;
  in_service: boolean;
}

export interface PandaPowerResLine {
  p_from_mw: number;
  q_from_mvar: number;
  p_to_mw: number;
  q_to_mvar: number;
  pl_mw: number;
  ql_mvar: number;
  i_from_ka: number;
  i_to_ka: number;
  i_ka: number;
  vm_from_pu: number;
  vm_to_pu: number;
  loading_percent: number;
}

export interface PandaPowerResBus {
  vm_pu: number;
  va_degree: number;
  p_mw: number;
  q_mvar: number;
}

/** A complete pandapower network with all element tables and optional power flow results. */
export interface PandaPowerNetwork {
  bus: Record<string, PandaPowerBus>;
  line: Record<string, PandaPowerLine>;
  trafo: Record<string, PandaPowerTrafo>;
  load: Record<string, PandaPowerLoad>;
  sgen: Record<string, PandaPowerSgen>;
  gen: Record<string, PandaPowerGen>;
  switch: Record<string, PandaPowerSwitch>;
  ext_grid: Record<string, PandaPowerExtGrid>;
  storage: Record<string, PandaPowerStorage>;
  res_bus?: Record<string, PandaPowerResBus>;
  res_line?: Record<string, PandaPowerResLine>;
  _module?: string;
  _class?: string;
  name?: string;
  f_hz?: number;
  sn_mva?: number;
}

/** Element type for vis-network nodes. */
export type NetworkNodeType = 'bus' | 'ext_grid' | 'load' | 'sgen' | 'gen' | 'storage' | 'trafo';

const ELEMENT_PREFIXES = ['load_', 'sgen_', 'gen_', 'storage_', 'trafo_'] as const;

/** Returns true if the node ID belongs to an element (load, sgen, gen, storage, trafo). */
export function isElementNode(id: number | string): boolean {
  const s = String(id);
  return ELEMENT_PREFIXES.some(p => s.startsWith(p));
}

/** Returns true if the node ID belongs to a bus (not an element). */
export function isBusNode(id: number | string): boolean {
  return !isElementNode(id);
}

/** A vis-network node representing a bus or element in the network diagram. */
export interface NetworkNode {
  id: number | string;
  label: string;
  title: string;
  color: string;
  shape: string;
  size: number;
  borderWidth: number;
  font: { color: string };
  type: NetworkNodeType;
  data: PandaPowerBus | PandaPowerExtGrid;
  image?: string;
}

/** A vis-network edge representing a line, transformer, or switch connection. */
export interface NetworkEdge {
  id: string;
  from: number | string;
  to: number | string;
  label: string;
  title: string;
  color: { color: string; highlight: string };
  width: number;
  dashes: boolean;
  type: 'line' | 'trafo' | 'switch';
  data: PandaPowerLine | PandaPowerTrafo | PandaPowerSwitch;
}

/** Detailed information about a selected network element, shown in the element panel. */
export interface ElementInfo {
  type: string;
  id: number | string;
  name: string;
  properties: Record<string, string | number | boolean>;
}

export interface BusAnnotation {
  hasLoad: boolean;
  hasGen: boolean;
  hasExtGrid: boolean;
  totalLoadMW: number;
  totalGenMW: number;
  loadCount: number;
  genCount: number;
}

/** Geographic coordinates for a bus, extracted from pandapower's WKT POINT format. */
export interface BusGeoData {
  bus: number;
  name: string;
  latitude: number;
  longitude: number;
  vn_kv: number;
}

export interface PowerFlowBusResult {
  bus: number;
  name: string;
  vn_kv: number;
  vm_pu: number;
  va_degree: number;
  p_mw: number;
  q_mvar: number;
}

export interface PowerFlowLineResult {
  line: number;
  name: string;
  from_bus: number;
  to_bus: number;
  loading_percent: number;
  i_ka: number;
  p_from_mw: number;
  pl_mw: number;
}

export interface PowerFlowTrafoResult {
  trafo: number;
  name: string;
  loading_percent: number;
  p_hv_mw: number;
  pl_mw: number;
}

export interface PowerFlowResults {
  available: boolean;
  bus_count?: number;
  bus_results?: PowerFlowBusResult[];
  line_results?: PowerFlowLineResult[];
  trafo_results?: PowerFlowTrafoResult[];
}

/** Analysis results used for visualization coloring (voltage/loading modes). */
export interface VizAnalysisResults {
  power_flow: PowerFlowResults;
}
