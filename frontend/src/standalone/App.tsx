import { useState, useEffect, useCallback } from 'react';
import { NetworkDiagram } from '../components/NetworkDiagram';
import { NetworkMap } from '../components/NetworkMap';
import { parsePandaPowerJson, getNetworkStatistics, extractGeodata } from '../core/parser';
import type { PandaPowerNetwork, ElementInfo } from '../core/types';
import { WelcomeScreen } from './WelcomeScreen';
import '../styles/variables.css';
import '../styles/network-diagram.css';
import '../styles/network-map.css';

type Tab = 'diagram' | 'map';

function ElementPanel({ element, onClose }: { element: ElementInfo; onClose: () => void }) {
  return (
    <div style={{
      width: 280, borderLeft: '1px solid var(--ppviz-border-color)',
      background: 'var(--ppviz-bg-secondary)', overflow: 'auto', padding: 12,
      fontSize: 13, color: 'var(--ppviz-text-primary)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>{element.type}: {element.name}</strong>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--ppviz-text-secondary)',
          cursor: 'pointer', fontSize: 16,
        }}>&times;</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(element.properties).map(([key, value]) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--ppviz-border-subtle)' }}>
              <td style={{ padding: '4px 8px 4px 0', color: 'var(--ppviz-text-secondary)' }}>{key}</td>
              <td style={{ padding: '4px 0', textAlign: 'right' }}>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [network, setNetwork] = useState<PandaPowerNetwork | null>(null);
  const [networkName, setNetworkName] = useState<string>('');
  const [mode, setMode] = useState<'loading' | 'python' | 'static'>('loading');
  const [activeTab, setActiveTab] = useState<Tab>('diagram');
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Detect mode: try /api/network. If it works → python mode, else → static mode.
  useEffect(() => {
    fetch('/api/network')
      .then(res => {
        if (!res.ok) throw new Error('no backend');
        return res.json();
      })
      .then(data => {
        const parsed = parsePandaPowerJson(data);
        setNetwork(parsed);
        setNetworkName(parsed.name || 'Network');
        setMode('python');
      })
      .catch(() => {
        setMode('static');
      });
  }, []);

  const handleNetworkLoaded = useCallback((net: PandaPowerNetwork, name: string) => {
    setNetwork(net);
    setNetworkName(name);
    setActiveTab('diagram');
    setSelectedElement(null);
  }, []);

  const handleChangeNetwork = useCallback(() => {
    setNetwork(null);
    setNetworkName('');
    setSelectedElement(null);
    setActiveTab('diagram');
  }, []);

  const handleElementSelect = useCallback((el: ElementInfo | null) => {
    setSelectedElement(el);
  }, []);

  // Loading state — brief, while detecting mode
  if (mode === 'loading') {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--ppviz-bg-primary)', color: 'var(--ppviz-text-secondary)',
        fontFamily: 'var(--ppviz-font-family)',
      }}>
        <span style={{ fontSize: 13 }}>Loading...</span>
      </div>
    );
  }

  // No network loaded → show welcome screen (static mode or python mode with no network)
  if (!network) {
    return <WelcomeScreen onNetworkLoaded={handleNetworkLoaded} />;
  }

  // Visualizer
  const hasGeodata = extractGeodata(network).length > 0;
  const stats = getNetworkStatistics(network);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--ppviz-bg-primary)', color: 'var(--ppviz-text-primary)',
      fontFamily: 'var(--ppviz-font-family)',
    }}>
      {/* Top bar */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 12px', borderBottom: '1px solid var(--ppviz-border-color)',
        background: 'var(--ppviz-bg-secondary)', fontSize: 13, flexShrink: 0,
      }}>
        <strong style={{ color: 'var(--ppviz-brand-accent)' }}>pandapower-viz</strong>
        <span style={{ color: 'var(--ppviz-text-secondary)' }}>{networkName}</span>
        <span style={{ color: 'var(--ppviz-text-muted)' }}>
          {stats['Buses']} buses &middot; {stats['Lines']} lines &middot; {stats['Transformers']} trafos
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <button
            onClick={() => setActiveTab('diagram')}
            style={{
              padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
              background: activeTab === 'diagram' ? 'var(--ppviz-brand-accent)' : 'transparent',
              color: activeTab === 'diagram' ? 'var(--ppviz-accent-fg)' : 'var(--ppviz-text-secondary)',
            }}
          >
            Diagram
          </button>
          {hasGeodata && (
            <button
              onClick={() => setActiveTab('map')}
              style={{
                padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                background: activeTab === 'map' ? 'var(--ppviz-brand-accent)' : 'transparent',
                color: activeTab === 'map' ? 'var(--ppviz-accent-fg)' : 'var(--ppviz-text-secondary)',
              }}
            >
              Map
            </button>
          )}
        </div>

        {/* Change network (only in static mode) */}
        {mode === 'static' && (
          <button
            onClick={handleChangeNetwork}
            title="Change network"
            style={{
              padding: '4px 10px', fontSize: 12, border: '1px solid var(--ppviz-border-color)',
              borderRadius: 4, cursor: 'pointer', background: 'transparent',
              color: 'var(--ppviz-text-secondary)',
            }}
          >
            Change
          </button>
        )}

        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
            color: 'var(--ppviz-text-secondary)',
          }}
          title="Toggle theme"
        >
          {theme === 'dark' ? '\u2600' : '\uD83C\uDF19'}
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {activeTab === 'diagram' ? (
            <NetworkDiagram
              network={network}
              theme={theme}
              onElementSelect={handleElementSelect}
            />
          ) : (
            <NetworkMap
              network={network}
              theme={theme}
              onElementSelect={handleElementSelect}
            />
          )}
        </div>
        {selectedElement && (
          <ElementPanel element={selectedElement} onClose={() => setSelectedElement(null)} />
        )}
      </div>
    </div>
  );
}
