import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Network, Options } from 'vis-network';
import { DataSet } from 'vis-data';
import type { PandaPowerNetwork, ElementInfo, BusAnnotation, VizAnalysisResults } from '../core/types';
import { isBusNode } from '../core/types';
import { getElementInfo, getCompactBusInfo, convertToVisNetwork, convertToVisNetworkCompact } from '../core/parser';
import { calculateTreeLayout, calculateGeoLayout } from '../core/layout';
import { COLORS } from '../core/colors';
import { extGridSvg, loadSvg, generatorSvg, sgenSvg, storageSvg, transformerWindingSvg } from '../core/symbols';

/**
 * Props for the NetworkDiagram component.
 * @param network - The pandapower network to visualize.
 * @param theme - Color theme ('dark' or 'light'). Default: 'dark'.
 * @param onElementSelect - Callback when user clicks a node or edge. Receives null on deselect.
 * @param analysisResults - Power flow results for voltage/loading color modes.
 * @param compactThreshold - Bus count above which compact mode activates. Default: 500.
 * @param className - Additional CSS class for the container.
 * @param style - Additional inline styles for the container.
 */
export interface NetworkDiagramProps {
  network: PandaPowerNetwork;
  theme?: 'dark' | 'light';
  onElementSelect?: (element: ElementInfo | null) => void;
  analysisResults?: VizAnalysisResults | null;
  compactThreshold?: number;
  className?: string;
  style?: React.CSSProperties;
}

type NodeId = number | string;

export function NetworkDiagram({
  network,
  theme = 'dark',
  onElementSelect,
  analysisResults,
  compactThreshold = 500,
  className,
  style,
}: NetworkDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  // Internalize conversion
  const busCount = Object.keys(network.bus).length;
  const isCompactMode = busCount > compactThreshold;

  const visData = useMemo(() => {
    if (isCompactMode) {
      return convertToVisNetworkCompact(network);
    }
    const result = convertToVisNetwork(network);
    return { ...result, busAnnotations: new Map<number, BusAnnotation>() };
  }, [network, isCompactMode]);

  const { nodes, edges } = visData;
  const busAnnotations = 'busAnnotations' in visData ? visData.busAnnotations : new Map<number, BusAnnotation>();

  const [physicsEnabled, setPhysicsEnabled] = useState(false);
  const nodeSize = 10;
  const [showLabels, setShowLabels] = useState(!isCompactMode);
  const [colorMode, setColorMode] = useState<'type' | 'voltage' | 'loading'>('type');

  const labelColors = {
    node: theme === 'dark' ? '#e5e5e5' : '#333333',
    edge: theme === 'dark' ? '#a1a1aa' : '#666666',
  };

  const handleClick = useCallback(
    (params: { nodes: NodeId[]; edges: string[] }) => {
      if (!onElementSelect) return;
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        if (isCompactMode && busAnnotations && typeof nodeId === 'number') {
          onElementSelect(getCompactBusInfo(nodeId, network, busAnnotations));
        } else {
          const node = nodes.find((n) => n.id === nodeId || String(n.id) === String(nodeId));
          if (node) {
            onElementSelect(getElementInfo(node, network));
          }
        }
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        const edge = edges.find((e) => e.id === edgeId);
        if (edge) {
          onElementSelect(getElementInfo(edge, network));
        }
      } else {
        onElementSelect(null);
      }
    },
    [nodes, edges, network, onElementSelect, isCompactMode, busAnnotations]
  );

  const hasGeo = useMemo(() => Object.values(network.bus).some(b => b.geo), [network]);
  const bgStrokeColor = theme === 'dark' ? '#1a1a1c' : '#ffffff';

  useEffect(() => {
    if (!containerRef.current) return;

    const layoutBusCount = nodes.filter((n) => isBusNode(n.id)).length;
    const layoutW = isCompactMode ? Math.max(5000, layoutBusCount * 4) : 5000;
    const layoutH = isCompactMode ? Math.max(3000, layoutBusCount * 2.5) : 3000;
    const nodePositions = hasGeo
      ? calculateGeoLayout(nodes, edges, network, layoutW, layoutH)
      : calculateTreeLayout(nodes, edges, layoutW, layoutH);
    const adjustedPositions = new Map(nodePositions);

    if (!isCompactMode && !hasGeo) {
      const trafoLinks = new Map<string, { hv?: NodeId; lv?: NodeId; w1?: NodeId; w2?: NodeId }>();

      edges.forEach((edge) => {
        const match = String(edge.id).match(/^trafo_(\d+)_(hv|mid|lv)$/);
        if (!match) return;
        const [, trafoIndex, part] = match;
        const info = trafoLinks.get(trafoIndex) || {};

        if (part === 'hv') {
          info.hv = edge.from;
          info.w1 = edge.to;
        } else if (part === 'mid') {
          info.w1 = edge.from;
          info.w2 = edge.to;
        } else {
          info.w2 = edge.from;
          info.lv = edge.to;
        }

        trafoLinks.set(trafoIndex, info);
      });

      const trafoRadius = nodeSize * 0.8;
      const trafoSeparation = Math.max(2, trafoRadius * 1.2);

      trafoLinks.forEach((info) => {
        if (!info.hv || !info.lv || !info.w1 || !info.w2) return;
        const hvPos = nodePositions.get(info.hv);
        const lvPos = nodePositions.get(info.lv);
        if (!hvPos || !lvPos) return;

        const dx = lvPos.x - hvPos.x;
        const dy = lvPos.y - hvPos.y;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const midX = (hvPos.x + lvPos.x) / 2;
        const midY = (hvPos.y + lvPos.y) / 2;
        const half = trafoSeparation / 2;

        adjustedPositions.set(info.w1, { x: midX - ux * half, y: midY - uy * half });
        adjustedPositions.set(info.w2, { x: midX + ux * half, y: midY + uy * half });
      });
    }

    const nodesDataSet = new DataSet(
      nodes.map((node) => {
        const pos = adjustedPositions.get(node.id);
        const nodeId = String(node.id);

        const isLoad = nodeId.startsWith('load_');
        const isSgen = nodeId.startsWith('sgen_');
        const isGen = nodeId.startsWith('gen_');
        const isTrafo = nodeId.startsWith('trafo_');
        const isTrafoWinding = /^trafo_\d+_(w1|w2)$/.test(nodeId);

        let size = nodeSize;
        const shape = node.shape;
        const borderWidth = node.borderWidth;
        const fontConfig: Record<string, unknown> = {
          size: 14,
          color: labelColors.node,
          strokeWidth: 3,
          strokeColor: bgStrokeColor,
          align: 'center',
        };

        if (node.type === 'ext_grid') {
          size = nodeSize * 1.2;
        } else if (isLoad || isSgen || isGen) {
          size = nodeSize * 0.7;
        } else if (isTrafo) {
          size = nodeSize * 0.8;
        }

        let nodeBackgroundColor = node.color;
        if (colorMode === 'voltage' && analysisResults?.power_flow?.bus_results && isBusNode(node.id)) {
          const busIndex = typeof node.id === 'number' ? node.id : parseInt(String(node.id), 10);
          const busResult = analysisResults.power_flow.bus_results.find((b) => b.bus === busIndex);
          if (busResult) {
            const vm = busResult.vm_pu;
            if (vm >= 0.95 && vm <= 1.05) {
              nodeBackgroundColor = COLORS.ok;
            } else if ((vm >= 0.93 && vm < 0.95) || (vm > 1.05 && vm <= 1.07)) {
              nodeBackgroundColor = COLORS.warn;
            } else {
              nodeBackgroundColor = COLORS.fail;
            }
          }
        }

        let nodeImage = node.image;
        if (nodeImage && nodeBackgroundColor !== node.color) {
          switch (node.type) {
            case 'ext_grid': nodeImage = extGridSvg(nodeBackgroundColor); break;
            case 'load': nodeImage = loadSvg(nodeBackgroundColor); break;
            case 'gen': nodeImage = generatorSvg(nodeBackgroundColor); break;
            case 'sgen': nodeImage = sgenSvg(nodeBackgroundColor); break;
            case 'storage': nodeImage = storageSvg(nodeBackgroundColor); break;
            case 'trafo': nodeImage = transformerWindingSvg(nodeBackgroundColor); break;
          }
        }

        const isImageNode = shape === 'image';
        const nodeColor = isImageNode
          ? {
              background: 'transparent',
              border: 'transparent',
              highlight: { background: 'transparent', border: COLORS.highlight },
              hover: { background: 'transparent', border: COLORS.hover },
            }
          : isTrafoWinding
            ? {
                background: 'transparent',
                border: node.color,
                highlight: { background: 'rgba(255,255,255,0.1)', border: '#ffffff' },
                hover: { background: 'rgba(255,255,255,0.05)', border: '#e5e5e5' },
              }
            : {
                background: nodeBackgroundColor,
                border: nodeBackgroundColor,
                highlight: { background: COLORS.highlight, border: COLORS.highlight },
                hover: { background: COLORS.hover, border: COLORS.hover },
              };

        return {
          id: node.id,
          label: showLabels ? node.label : '',
          title: node.title,
          x: pos?.x,
          y: pos?.y,
          color: nodeColor,
          shape: shape,
          size: size,
          borderWidth: borderWidth,
          font: fontConfig,
          image: nodeImage,
        };
      })
    );

    const edgesDataSet = new DataSet(
      edges.map((edge) => {
        const edgeId = String(edge.id);
        const isConnection = edgeId.includes('_conn_');
        const isTrafoEdge = edgeId.startsWith('trafo_');
        const isSwitch = edgeId.startsWith('switch_');

        let edgeLabel = '';
        if (showLabels && !isConnection && !isTrafoEdge && !(isSwitch && edgeId.endsWith('_a'))) {
          edgeLabel = edge.label;
        }

        let edgeColorValue = edge.color.color;
        if (colorMode === 'loading' && analysisResults?.power_flow) {
          if (edgeId.startsWith('line_')) {
            const lineIndex = parseInt(edgeId.replace('line_', ''), 10);
            const lineResult = analysisResults.power_flow.line_results?.find((l) => l.line === lineIndex);
            if (lineResult) {
              const loading = lineResult.loading_percent;
              if (loading < 80) edgeColorValue = COLORS.ok;
              else if (loading <= 100) edgeColorValue = COLORS.warn;
              else edgeColorValue = COLORS.fail;
            }
          } else if (edgeId.startsWith('trafo_') && edgeId.includes('_hv')) {
            const match = edgeId.match(/^trafo_(\d+)_/);
            if (match) {
              const trafoIndex = parseInt(match[1], 10);
              const trafoResult = analysisResults.power_flow.trafo_results?.find((t) => t.trafo === trafoIndex);
              if (trafoResult) {
                const loading = trafoResult.loading_percent;
                if (loading < 80) edgeColorValue = '#4ade80';
                else if (loading <= 100) edgeColorValue = '#fbbf24';
                else edgeColorValue = '#ef4444';
              }
            }
          }
        }

        return {
          id: edge.id,
          from: edge.from,
          to: edge.to,
          label: edgeLabel,
          title: edge.title,
          color: { color: edgeColorValue, highlight: COLORS.highlight, hover: COLORS.hover },
          width: edge.width,
          dashes: edge.dashes,
          smooth: false,
          font: {
            size: 12,
            color: labelColors.edge,
            strokeWidth: 2,
            strokeColor: bgStrokeColor,
            align: 'middle' as const,
          },
        };
      })
    );

    const options: Options = {
      nodes: {
        font: {
          size: isCompactMode ? 0 : 14,
          color: labelColors.node,
          strokeWidth: 3,
          strokeColor: bgStrokeColor,
        },
        scaling: { label: { drawThreshold: 0 } },
      },
      edges: {
        font: {
          size: isCompactMode ? 0 : 12,
          align: 'middle',
          color: labelColors.edge,
          strokeWidth: 2,
          strokeColor: bgStrokeColor,
        },
        scaling: { label: { drawThreshold: 0 } },
        smooth: false,
        arrows: { to: { enabled: false }, from: { enabled: false } },
        selectionWidth: 2,
        hoverWidth: isCompactMode ? 0 : 2,
      },
      layout: { improvedLayout: false, hierarchical: false },
      physics: {
        enabled: physicsEnabled,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.005,
          springLength: 100,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 0.5,
        },
      },
      interaction: {
        hover: !isCompactMode,
        tooltipDelay: 100,
        hideEdgesOnDrag: isCompactMode,
        hideEdgesOnZoom: isCompactMode,
        navigationButtons: true,
        keyboard: { enabled: true, bindToWindow: false },
        zoomView: true,
        dragView: true,
        dragNodes: !isCompactMode,
        selectConnectedEdges: !isCompactMode,
      },
    };

    const networkInstance = new Network(containerRef.current, { nodes: nodesDataSet, edges: edgesDataSet }, options);
    networkRef.current = networkInstance;
    networkInstance.on('click', handleClick);

    if (!isCompactMode) {
      let draggedTrafoId: string | null = null;
      let dragOffset: { dx: number; dy: number } | null = null;

      networkInstance.on('dragStart', (params: { nodes: NodeId[] }) => {
        if (params.nodes.length === 1) {
          const nId = String(params.nodes[0]);
          const match = nId.match(/^trafo_(\d+)_(w1|w2)$/);
          if (match) {
            draggedTrafoId = match[1];
            const currentWinding = match[2];
            const otherWinding = currentWinding === 'w1' ? 'w2' : 'w1';
            const otherId = `trafo_${draggedTrafoId}_${otherWinding}`;
            const positions = networkInstance.getPositions([nId, otherId]);
            const currentPos = positions[nId];
            const otherPos = positions[otherId];
            if (currentPos && otherPos) {
              dragOffset = { dx: otherPos.x - currentPos.x, dy: otherPos.y - currentPos.y };
            }
          }
        }
      });

      networkInstance.on('dragging', (params: { nodes: NodeId[] }) => {
        if (draggedTrafoId && dragOffset && params.nodes.length === 1) {
          const nId = String(params.nodes[0]);
          const match = nId.match(/^trafo_(\d+)_(w1|w2)$/);
          if (match && match[1] === draggedTrafoId) {
            const currentWinding = match[2];
            const otherWinding = currentWinding === 'w1' ? 'w2' : 'w1';
            const otherId = `trafo_${draggedTrafoId}_${otherWinding}`;
            const positions = networkInstance.getPositions([nId]);
            const currentPos = positions[nId];
            if (currentPos) {
              nodesDataSet.update({
                id: otherId,
                x: currentPos.x + dragOffset.dx,
                y: currentPos.y + dragOffset.dy,
              });
            }
          }
        }
      });

      networkInstance.on('dragEnd', () => {
        draggedTrafoId = null;
        dragOffset = null;
      });
    }

    setTimeout(() => {
      try {
        networkInstance.fit({ animation: false });
      } catch {
        /* instance may be destroyed */
      }
    }, 100);

    return () => {
      networkInstance.destroy();
      networkRef.current = null;
    };
  }, [nodes, edges, network, handleClick, physicsEnabled, showLabels, theme, labelColors.node, labelColors.edge, isCompactMode, colorMode, analysisResults]);

  const handleFit = useCallback(() => {
    networkRef.current?.fit({ animation: true });
  }, []);

  const handleTogglePhysics = useCallback(() => {
    setPhysicsEnabled((prev) => !prev);
  }, []);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const net = networkRef.current;
    if (!net) return;
    const scale = net.getScale();
    const newScale = direction === 'in' ? scale * 1.3 : scale / 1.3;
    net.moveTo({ scale: newScale, animation: { duration: 200, easingFunction: 'easeInOutQuad' } });
  }, []);

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => !prev);
  }, []);

  return (
    <div className={`ppviz-network-preview ${className || ''}`} style={style}>
      <div className="ppviz-network-controls">
        <button onClick={() => handleZoom('out')} title="Zoom out">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </button>
        <button onClick={() => handleZoom('in')} title="Zoom in">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
        <button onClick={handleToggleLabels} className={showLabels ? 'active' : ''} title="Toggle labels">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
          </svg>
        </button>
        <button onClick={handleFit} title="Fit to view">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z" />
          </svg>
        </button>
        <button onClick={handleTogglePhysics} className={physicsEnabled ? 'active' : ''} title="Toggle physics">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
          </svg>
        </button>
        {analysisResults?.power_flow && (
          <button
            onClick={() => setColorMode((prev) => (prev === 'type' ? 'voltage' : prev === 'voltage' ? 'loading' : 'type'))}
            className={colorMode !== 'type' ? 'active' : ''}
            title={`Color: ${colorMode}`}
            aria-label={`Color mode: ${colorMode}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1-.01-.83.67-1.5 1.49-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z" />
            </svg>
          </button>
        )}
      </div>
      <div ref={containerRef} className="ppviz-network-canvas" />
      {isCompactMode && (
        <div className="ppviz-compact-mode-badge">
          <div className="ppviz-compact-mode-title">Compact view — {nodes.length.toLocaleString()} buses</div>
          <div className="ppviz-compact-mode-legend">
            <span><i style={{ background: COLORS.ext_grid }} />Ext Grid</span>
            <span><i style={{ background: COLORS.compact_gen_load }} />Gen+Load</span>
            <span><i style={{ background: COLORS.compact_gen }} />Gen</span>
            <span><i style={{ background: COLORS.compact_load }} />Load</span>
            <span><i style={{ background: COLORS.bus }} />Bus</span>
          </div>
        </div>
      )}
      {colorMode === 'voltage' && (
        <div className="ppviz-diagram-legend">
          <span><i style={{ background: COLORS.ok }} />0.95-1.05 pu</span>
          <span><i style={{ background: COLORS.warn }} />Warning</span>
          <span><i style={{ background: COLORS.fail }} />Violation</span>
        </div>
      )}
      {colorMode === 'loading' && (
        <div className="ppviz-diagram-legend">
          <span><i style={{ background: COLORS.ok }} />&lt;80%</span>
          <span><i style={{ background: COLORS.warn }} />80-100%</span>
          <span><i style={{ background: COLORS.fail }} />&gt;100%</span>
        </div>
      )}
    </div>
  );
}
