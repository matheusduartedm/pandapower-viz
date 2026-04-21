/**
 * anywidget entry point for Jupyter notebook integration.
 * Renders a pandapower network diagram using vis-network (no React).
 */
import { parsePandaPowerJson, convertToVisNetwork, convertToVisNetworkCompact, getElementInfo, getCompactBusInfo } from './core/parser';
import { calculateTreeLayout, calculateGeoLayout } from './core/layout';
import { COLORS } from './core/colors';
import type { PandaPowerNetwork, NetworkNode, NetworkEdge, BusAnnotation } from './core/types';
import { Network, type Options } from 'vis-network';
import { DataSet } from 'vis-data';

const COMPACT_THRESHOLD = 500;

function renderNetwork(container: HTMLElement, network: PandaPowerNetwork, infoPanel: HTMLElement) {
  const busCount = Object.keys(network.bus).length;
  const isCompact = busCount > COMPACT_THRESHOLD;

  let nodes: NetworkNode[];
  let edges: NetworkEdge[];
  let annotations: Map<number, BusAnnotation> = new Map();

  if (isCompact) {
    const result = convertToVisNetworkCompact(network);
    nodes = result.nodes;
    edges = result.edges;
    annotations = result.busAnnotations;
  } else {
    const result = convertToVisNetwork(network);
    nodes = result.nodes;
    edges = result.edges;
  }

  // Calculate layout
  const layoutW = isCompact ? Math.max(5000, busCount * 4) : 5000;
  const layoutH = isCompact ? Math.max(3000, busCount * 2.5) : 3000;
  const hasGeo = Object.values(network.bus).some(b => b.geo);
  const positions = hasGeo
    ? calculateGeoLayout(nodes, edges, network, layoutW, layoutH)
    : calculateTreeLayout(nodes, edges, layoutW, layoutH);

  // Build vis-network datasets
  const nodesDataSet = new DataSet(nodes.map(node => {
    const pos = positions.get(node.id);
    return {
      id: node.id,
      label: isCompact ? '' : node.label,
      title: node.title,
      x: pos?.x,
      y: pos?.y,
      color: {
        background: node.color,
        border: node.color,
        highlight: { background: COLORS.highlight, border: COLORS.highlight },
        hover: { background: COLORS.hover, border: COLORS.hover },
      },
      shape: node.shape,
      size: node.type === 'ext_grid' ? 10 : 6,
      borderWidth: node.borderWidth,
      font: { color: '#e5e5e5', size: isCompact ? 0 : 12, strokeWidth: 0 },
      image: node.image,
    };
  }));

  const edgesDataSet = new DataSet(edges.map(edge => ({
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: isCompact ? '' : edge.label,
    title: edge.title,
    color: {
      color: edge.color.color,
      highlight: COLORS.highlight,
      hover: COLORS.hover,
    },
    width: edge.width,
    dashes: edge.dashes,
    smooth: false,
    font: { color: '#a1a1aa', size: isCompact ? 0 : 10, strokeWidth: 0 },
  })));

  const options: Options = {
    nodes: { font: { strokeWidth: 0 }, scaling: { label: { drawThreshold: 0 } } },
    edges: {
      smooth: false,
      arrows: { to: { enabled: false }, from: { enabled: false } },
      font: { strokeWidth: 0 },
      scaling: { label: { drawThreshold: 0 } },
    },
    layout: { improvedLayout: false, hierarchical: false },
    physics: { enabled: false },
    interaction: {
      hover: !isCompact,
      tooltipDelay: 100,
      hideEdgesOnDrag: isCompact,
      hideEdgesOnZoom: isCompact,
      zoomView: true,
      dragView: true,
      dragNodes: !isCompact,
    },
  };

  const visNetwork = new Network(container, { nodes: nodesDataSet, edges: edgesDataSet }, options);

  // Click handler — show element info
  visNetwork.on('click', (params: { nodes: (number | string)[]; edges: string[] }) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      let info;
      if (isCompact && typeof nodeId === 'number') {
        info = getCompactBusInfo(nodeId, network, annotations);
      } else {
        const node = nodes.find(n => n.id === nodeId || String(n.id) === String(nodeId));
        if (node) info = getElementInfo(node, network);
      }
      if (info) {
        infoPanel.innerHTML = `<div style="font-weight:600;margin-bottom:6px">${info.type}: ${info.name}</div>` +
          Object.entries(info.properties).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #333"><span style="color:#969696">${k}</span><span>${v}</span></div>`
          ).join('');
        infoPanel.style.display = 'block';
      }
    } else if (params.edges.length > 0) {
      const edge = edges.find(e => e.id === params.edges[0]);
      if (edge) {
        const info = getElementInfo(edge, network);
        infoPanel.innerHTML = `<div style="font-weight:600;margin-bottom:6px">${info.type}: ${info.name}</div>` +
          Object.entries(info.properties).map(([k, v]) =>
            `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #333"><span style="color:#969696">${k}</span><span>${v}</span></div>`
          ).join('');
        infoPanel.style.display = 'block';
      }
    } else {
      infoPanel.style.display = 'none';
    }
  });

  setTimeout(() => { try { visNetwork.fit({ animation: false }); } catch { /* */ } }, 100);

  return visNetwork;
}

/** anywidget render function */
export default {
  render({ model, el }: { model: any; el: HTMLElement }) {
    // Create container
    el.innerHTML = `
      <div style="display:flex;height:500px;background:#1a1a1c;border-radius:6px;overflow:hidden;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:#ccc">
        <div id="ppviz-canvas" style="flex:1;position:relative"></div>
        <div id="ppviz-info" style="display:none;width:240px;padding:10px;overflow:auto;border-left:1px solid #38383b;background:#222224"></div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;color:#6e6e6e;font-family:'IBM Plex Sans',sans-serif">
        <span id="ppviz-stats"></span>
        <span>pandapower-viz</span>
      </div>
    `;

    const canvas = el.querySelector('#ppviz-canvas') as HTMLElement;
    const infoPanel = el.querySelector('#ppviz-info') as HTMLElement;
    const statsEl = el.querySelector('#ppviz-stats') as HTMLElement;

    let visInstance: Network | null = null;

    function update() {
      const jsonStr = model.get('network_json');
      if (!jsonStr) return;

      try {
        const data = JSON.parse(jsonStr);
        const network = parsePandaPowerJson(data);
        const busCount = Object.keys(network.bus).length;
        const lineCount = Object.keys(network.line).length;
        const trafoCount = Object.keys(network.trafo).length;
        statsEl.textContent = `${busCount} buses · ${lineCount} lines · ${trafoCount} trafos`;

        if (visInstance) visInstance.destroy();
        visInstance = renderNetwork(canvas, network, infoPanel);
      } catch (err) {
        canvas.innerHTML = `<div style="padding:20px;color:#ef4444">Error: ${err}</div>`;
      }
    }

    model.on('change:network_json', update);
    update();

    return () => {
      if (visInstance) visInstance.destroy();
    };
  }
};
