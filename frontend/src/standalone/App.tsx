import { useState, useEffect, useCallback } from 'react';
import { NetworkDiagram } from '../components/NetworkDiagram';
import { NetworkMap } from '../components/NetworkMap';
import { parsePandaPowerJson, getNetworkStatistics, extractGeodata } from '../core/parser';
import type { PandaPowerNetwork, ElementInfo } from '../core/types';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('diagram');
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    fetch('/api/network')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const parsed = parsePandaPowerJson(data);
        setNetwork(parsed);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleElementSelect = useCallback((el: ElementInfo | null) => {
    setSelectedElement(el);
  }, []);

  const hasGeodata = network ? extractGeodata(network).length > 0 : false;
  const stats = network ? getNetworkStatistics(network) : null;

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--ppviz-bg-primary)', color: 'var(--ppviz-text-secondary)',
        fontFamily: 'var(--ppviz-font-family)',
      }}>
        Loading network...
      </div>
    );
  }

  if (error || !network) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--ppviz-bg-primary)', color: '#ef4444',
        fontFamily: 'var(--ppviz-font-family)',
      }}>
        {error || 'No network data available'}
      </div>
    );
  }

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
        {network.name && <span style={{ color: 'var(--ppviz-text-secondary)' }}>{network.name}</span>}
        {stats && (
          <span style={{ color: 'var(--ppviz-text-muted)', marginLeft: 'auto' }}>
            {stats['Buses']} buses &middot; {stats['Lines']} lines &middot; {stats['Transformers']} trafos
          </span>
        )}
        <div style={{ display: 'flex', gap: 2, marginLeft: stats ? 12 : 'auto' }}>
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
