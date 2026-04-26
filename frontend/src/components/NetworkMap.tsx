import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PandaPowerNetwork, ElementInfo, BusGeoData, VizAnalysisResults } from '../core/types';
import { extractGeodata } from '../core/parser';
import { COLORS } from '../core/colors';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createIcon = (color: string, size: number = 24) => {
  return L.divIcon({
    className: 'ppviz-custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      border: 2px solid #fef6e9;
      box-shadow: 0 2px 4px rgba(19,32,38,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const ICONS = {
  bus: createIcon(COLORS.bus, 20),
  ext_grid: createIcon(COLORS.ext_grid, 28),
  load: createIcon(COLORS.load, 16),
  gen: createIcon(COLORS.gen, 22),
  solar: createIcon(COLORS.solar, 20),
  wind: createIcon(COLORS.wind, 20),
  storage: createIcon(COLORS.storage, 18),
};

/**
 * Props for the NetworkMap component.
 * @param network - The pandapower network to visualize on a map.
 * @param theme - Color theme ('dark' or 'light'). Default: 'dark'.
 * @param onElementSelect - Callback when user clicks a bus marker, line, or transformer.
 * @param analysisResults - Power flow results for voltage/loading color modes.
 * @param noGeoDataMessage - Custom message when no geographic data is available.
 * @param className - Additional CSS class for the container.
 * @param style - Additional inline styles for the container.
 */
export interface NetworkMapProps {
  network: PandaPowerNetwork;
  theme?: 'dark' | 'light';
  onElementSelect?: (element: ElementInfo | null) => void;
  analysisResults?: VizAnalysisResults | null;
  noGeoDataMessage?: string;
  className?: string;
  style?: React.CSSProperties;
}

function FitBounds({ geodata }: { geodata: BusGeoData[] }) {
  const map = useMap();
  useEffect(() => {
    if (geodata.length > 0) {
      const bounds = L.latLngBounds(geodata.map((g) => [g.latitude, g.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [geodata, map]);
  return null;
}

export function NetworkMap({
  network,
  theme: _theme = 'dark',
  onElementSelect,
  analysisResults,
  noGeoDataMessage,
  className,
  style,
}: NetworkMapProps) {
  const geodata = useMemo(() => extractGeodata(network), [network]);
  const [, setSelectedBus] = useState<number | null>(null);
  const [mapColorMode, setMapColorMode] = useState<'default' | 'voltage' | 'loading'>('default');

  const busGeoMap = useMemo(() => {
    const map = new Map<number, BusGeoData>();
    geodata.forEach((g) => map.set(g.bus, g));
    return map;
  }, [geodata]);

  const busResultsMap = useMemo(() => {
    const map = new Map<number, { vm_pu: number }>();
    if (analysisResults?.power_flow?.bus_results) {
      analysisResults.power_flow.bus_results.forEach((result) => {
        map.set(result.bus, { vm_pu: result.vm_pu });
      });
    }
    return map;
  }, [analysisResults]);

  const getVoltageColor = useCallback((vm_pu: number) => {
    if (vm_pu >= 0.95 && vm_pu <= 1.05) return COLORS.ok;
    else if ((vm_pu >= 0.93 && vm_pu < 0.95) || (vm_pu > 1.05 && vm_pu <= 1.07)) return COLORS.warn;
    else return COLORS.fail;
  }, []);

  const getLoadingColor = useCallback((loading: number) => {
    if (loading > 100) return COLORS.fail;
    else if (loading >= 80) return COLORS.warn;
    else return COLORS.ok;
  }, []);

  const getDrawableLines = useCallback(() => {
    const lines: Array<{ id: number; from: [number, number]; to: [number, number]; name: string; loading?: number }> = [];
    Object.values(network.line).forEach((line) => {
      const fromGeo = busGeoMap.get(line.from_bus);
      const toGeo = busGeoMap.get(line.to_bus);
      if (fromGeo && toGeo) {
        const loading = network.res_line?.[String(line.index)]?.loading_percent;
        lines.push({
          id: line.index,
          from: [fromGeo.latitude, fromGeo.longitude],
          to: [toGeo.latitude, toGeo.longitude],
          name: line.name || `Line ${line.index}`,
          loading,
        });
      }
    });
    return lines;
  }, [network, busGeoMap]);

  const getDrawableTrafos = useCallback(() => {
    const trafos: Array<{ id: number; from: [number, number]; to: [number, number]; name: string }> = [];
    Object.values(network.trafo).forEach((trafo) => {
      const hvGeo = busGeoMap.get(trafo.hv_bus);
      const lvGeo = busGeoMap.get(trafo.lv_bus);
      if (hvGeo && lvGeo) {
        trafos.push({
          id: trafo.index,
          from: [hvGeo.latitude, hvGeo.longitude],
          to: [lvGeo.latitude, lvGeo.longitude],
          name: trafo.name || `Transformer ${trafo.index}`,
        });
      }
    });
    return trafos;
  }, [network, busGeoMap]);

  const getBusType = useCallback(
    (busIndex: number) => {
      if (Object.values(network.ext_grid).some((eg) => eg.bus === busIndex)) return 'ext_grid';
      if (Object.values(network.gen).some((g) => g.bus === busIndex)) return 'gen';
      if (Object.values(network.sgen).some((s) => s.bus === busIndex && s.type === 'PV')) return 'solar';
      if (Object.values(network.sgen).some((s) => s.bus === busIndex && s.type === 'WP')) return 'wind';
      if (Object.values(network.storage).some((s) => s.bus === busIndex)) return 'storage';
      if (Object.values(network.load).some((l) => l.bus === busIndex)) return 'load';
      return 'bus';
    },
    [network]
  );

  const handleBusClick = useCallback(
    (busIndex: number) => {
      setSelectedBus(busIndex);
      if (onElementSelect) {
        const bus = network.bus[String(busIndex)];
        if (bus) {
          const properties: Record<string, string | number | boolean> = {
            Index: bus.index,
            Name: bus.name || 'N/A',
            'Voltage Level (kV)': bus.vn_kv,
            'In Service': bus.in_service !== false,
          };
          if (network.res_bus?.[String(busIndex)]) {
            const resBus = network.res_bus[String(busIndex)];
            properties['Vm (pu)'] = resBus.vm_pu?.toFixed(4) || 'N/A';
            properties['Va (degree)'] = resBus.va_degree?.toFixed(2) || 'N/A';
          }
          onElementSelect({ type: 'Bus', id: busIndex, name: bus.name || `Bus ${busIndex}`, properties });
        }
      }
    },
    [network, onElementSelect]
  );

  const handleLineClick = useCallback(
    (lineId: number) => {
      if (!onElementSelect) return;
      const line = network.line[String(lineId)];
      if (!line) return;
      const properties: Record<string, string | number | boolean> = {
        Index: line.index,
        Name: line.name || 'N/A',
        'From Bus': line.from_bus,
        'To Bus': line.to_bus,
        'Length (km)': line.length_km?.toFixed(3) || 'N/A',
        'R (Ohm/km)': line.r_ohm_per_km?.toFixed(4) || 'N/A',
        'X (Ohm/km)': line.x_ohm_per_km?.toFixed(4) || 'N/A',
        'Max I (kA)': line.max_i_ka || 'N/A',
        'In Service': line.in_service !== false,
      };
      if (network.res_line?.[String(lineId)]) {
        const resLine = network.res_line[String(lineId)];
        properties['Loading (%)'] = resLine.loading_percent?.toFixed(2) || 'N/A';
        properties['I (kA)'] = resLine.i_ka?.toFixed(4) || 'N/A';
      }
      onElementSelect({ type: 'Line', id: lineId, name: line.name || `Line ${lineId}`, properties });
    },
    [network, onElementSelect]
  );

  const handleTrafoClick = useCallback(
    (trafoId: number) => {
      if (!onElementSelect) return;
      const trafo = network.trafo[String(trafoId)];
      if (!trafo) return;
      const properties: Record<string, string | number | boolean> = {
        Index: trafo.index,
        'HV Bus': trafo.hv_bus,
        'LV Bus': trafo.lv_bus,
        'Rating (MVA)': trafo.sn_mva || 'N/A',
        'HV (kV)': trafo.vn_hv_kv || 'N/A',
        'LV (kV)': trafo.vn_lv_kv || 'N/A',
        'In Service': trafo.in_service !== false,
      };
      if (trafo.tap_pos !== undefined) {
        properties['Tap Position'] = trafo.tap_pos;
      }
      onElementSelect({ type: 'Transformer', id: trafoId, name: trafo.name || `Transformer ${trafoId}`, properties });
    },
    [network, onElementSelect]
  );

  const center: [number, number] =
    geodata.length > 0
      ? [geodata.reduce((sum, g) => sum + g.latitude, 0) / geodata.length, geodata.reduce((sum, g) => sum + g.longitude, 0) / geodata.length]
      : [0, 0];

  const lines = getDrawableLines();
  const trafos = getDrawableTrafos();

  const getLineColor = (loading?: number) => {
    if (loading === undefined) return COLORS.line;
    if (loading > 100) return COLORS.loading_overload;
    if (loading > 80) return COLORS.loading_high;
    if (loading > 50) return COLORS.loading_medium;
    return COLORS.loading_low;
  };

  const getLineColorForMode = useCallback(
    (loading?: number) => {
      if (mapColorMode === 'loading' && loading !== undefined) return getLoadingColor(loading);
      return getLineColor(loading);
    },
    [mapColorMode, getLoadingColor]
  );

  if (geodata.length === 0) {
    return (
      <div className={`ppviz-map-no-geodata ${className || ''}`} style={style}>
        <div className="ppviz-map-no-geodata-content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3>No Geographic Data</h3>
          <p>{noGeoDataMessage || "This network doesn't have geographic coordinates set for any buses."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ppviz-map-visualization ${className || ''}`} style={style}>
      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds geodata={geodata} />

        {lines.map((line) => (
          <Polyline
            key={`line-${line.id}`}
            positions={[line.from, line.to]}
            pathOptions={{ color: getLineColorForMode(line.loading), weight: 3, opacity: 0.8 }}
            eventHandlers={{ click: () => handleLineClick(line.id) }}
          >
            <Popup>
              <strong>{line.name}</strong>
              {line.loading !== undefined && (
                <>
                  <br />
                  Loading: {line.loading.toFixed(1)}%
                </>
              )}
            </Popup>
          </Polyline>
        ))}

        {trafos.map((trafo) => (
          <Polyline
            key={`trafo-${trafo.id}`}
            positions={[trafo.from, trafo.to]}
            pathOptions={{ color: COLORS.trafo, weight: 4, opacity: 0.9, dashArray: '10, 5' }}
            eventHandlers={{ click: () => handleTrafoClick(trafo.id) }}
          >
            <Popup>
              <strong>{trafo.name}</strong>
            </Popup>
          </Polyline>
        ))}

        {geodata.map((bus) => {
          const busType = getBusType(bus.bus);
          let icon = ICONS[busType as keyof typeof ICONS] || ICONS.bus;
          if (mapColorMode === 'voltage') {
            const busResult = busResultsMap.get(bus.bus);
            if (busResult) {
              const color = getVoltageColor(busResult.vm_pu);
              icon = createIcon(color, 20);
            }
          }
          return (
            <Marker
              key={`bus-${bus.bus}`}
              position={[bus.latitude, bus.longitude]}
              icon={icon}
              eventHandlers={{ click: () => handleBusClick(bus.bus) }}
            >
              <Popup>
                <strong>{bus.name}</strong>
                <br />
                Bus {bus.bus}
                <br />
                {bus.vn_kv} kV
                {network.res_bus?.[String(bus.bus)] && (
                  <>
                    <br />
                    Voltage: {network.res_bus[String(bus.bus)].vm_pu?.toFixed(4)} pu
                  </>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {analysisResults?.power_flow && (
        <div className="ppviz-map-layer-control">
          <button className={mapColorMode === 'default' ? 'active' : ''} onClick={() => setMapColorMode('default')}>
            Default
          </button>
          <button className={mapColorMode === 'voltage' ? 'active' : ''} onClick={() => setMapColorMode('voltage')}>
            Voltage
          </button>
          <button className={mapColorMode === 'loading' ? 'active' : ''} onClick={() => setMapColorMode('loading')}>
            Loading
          </button>
        </div>
      )}

      <div className="ppviz-map-legend">
        <div className="ppviz-map-legend-title">Legend</div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.bus }}></span><span>Bus</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.ext_grid }}></span><span>External Grid</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.gen }}></span><span>Generator</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.load }}></span><span>Load</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.wind }}></span><span>Wind</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-icon" style={{ backgroundColor: COLORS.storage }}></span><span>Storage</span></div>
        <div className="ppviz-map-legend-separator"></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-line" style={{ backgroundColor: COLORS.loading_low }}></span><span>&lt;50% loading</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-line" style={{ backgroundColor: COLORS.loading_medium }}></span><span>50-80% loading</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-line" style={{ backgroundColor: COLORS.loading_high }}></span><span>80-100% loading</span></div>
        <div className="ppviz-map-legend-item"><span className="ppviz-map-legend-line" style={{ backgroundColor: COLORS.loading_overload }}></span><span>&gt;100% overloaded</span></div>
      </div>
    </div>
  );
}
