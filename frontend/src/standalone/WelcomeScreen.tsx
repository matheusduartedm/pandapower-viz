import { useState, useRef, useCallback } from 'react';
import { SAMPLES, loadSample } from './samples';
import type { PandaPowerNetwork } from '../core/types';
import { parsePandaPowerJson } from '../core/parser';

interface WelcomeScreenProps {
  onNetworkLoaded: (network: PandaPowerNetwork, name: string) => void;
}

export function WelcomeScreen({ onNetworkLoaded }: WelcomeScreenProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleSampleClick = useCallback(async (id: string, name: string) => {
    setLoading(id);
    setError(null);
    try {
      const data = await loadSample(id);
      const network = parsePandaPowerJson(data);
      onNetworkLoaded(network, name);
    } catch (err) {
      setError(`Failed to load ${name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  }, [onNetworkLoaded]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Only pandapower JSON files are supported.');
      return;
    }

    setLoading('upload');
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const network = parsePandaPowerJson(data);

        if (Object.keys(network.bus).length === 0) {
          setError('This file does not contain a valid pandapower network (no buses found).');
          setLoading(null);
          return;
        }

        onNetworkLoaded(network, file.name.replace('.json', ''));
      } catch (err) {
        setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
      } finally {
        setLoading(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setLoading(null);
    };
    reader.readAsText(file);
  }, [onNetworkLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: 'var(--ppviz-bg-primary)',
      fontFamily: 'var(--ppviz-font-family)', color: 'var(--ppviz-text-primary)',
      padding: 24,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ppviz-brand-accent)', marginBottom: 8 }}>
          pandapower-viz
        </h1>
        <p style={{ fontSize: 14, color: 'var(--ppviz-text-secondary)', maxWidth: 400 }}>
          Interactive web visualizer for pandapower networks.
          Load a sample or upload your own network.
        </p>
      </div>

      {/* Sample cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SAMPLES.map(sample => (
          <button
            key={sample.id}
            onClick={() => handleSampleClick(sample.id, sample.name)}
            disabled={loading !== null}
            style={{
              background: 'var(--ppviz-bg-secondary)',
              border: '1px solid var(--ppviz-border-color)',
              borderRadius: 8, padding: '16px 20px', cursor: loading ? 'wait' : 'pointer',
              color: 'var(--ppviz-text-primary)', textAlign: 'left',
              minWidth: 160, transition: 'all 0.15s ease',
              opacity: loading && loading !== sample.id ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.borderColor = 'var(--ppviz-brand-accent)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--ppviz-border-color)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              {loading === sample.id ? 'Loading...' : sample.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ppviz-text-muted)' }}>
              {sample.buses} buses
            </div>
            <div style={{ fontSize: 11, color: 'var(--ppviz-text-secondary)', marginTop: 4 }}>
              {sample.description}
            </div>
          </button>
        ))}
      </div>

      {/* Drag-drop zone */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '100%', maxWidth: 520, padding: 32,
          border: `2px dashed ${isDragging ? 'var(--ppviz-brand-accent)' : 'var(--ppviz-border-color)'}`,
          borderRadius: 12, textAlign: 'center', cursor: 'pointer',
          background: isDragging ? 'rgba(54, 181, 160, 0.05)' : 'transparent',
          transition: 'all 0.2s ease',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          width="36" height="36" style={{ color: 'var(--ppviz-text-muted)', marginBottom: 8 }}>
          <path d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
        </svg>
        <p style={{ fontSize: 13, color: 'var(--ppviz-text-secondary)', margin: 0 }}>
          {isDragging ? 'Drop your file here' : 'Drop a pandapower JSON file or click to browse'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--ppviz-text-muted)', marginTop: 4 }}>
          Accepts .json files exported with <code style={{
            background: 'var(--ppviz-bg-tertiary)', padding: '1px 4px', borderRadius: 3,
            fontFamily: 'var(--ppviz-font-mono)', fontSize: 11, color: 'var(--ppviz-brand-accent)',
          }}>pp.to_json(net)</code>
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: 16, padding: '8px 16px', borderRadius: 6,
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: 13, maxWidth: 520,
        }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, fontSize: 11, color: 'var(--ppviz-text-muted)', textAlign: 'center' }}>
        <code style={{
          fontFamily: 'var(--ppviz-font-mono)', background: 'var(--ppviz-bg-secondary)',
          padding: '2px 6px', borderRadius: 3,
        }}>pip install pandapower-viz</code>
        <span style={{ margin: '0 8px' }}>&middot;</span>
        <a href="https://github.com/matheusduartedm/pandapower-viz" target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--ppviz-text-secondary)', textDecoration: 'none' }}>
          GitHub
        </a>
      </div>
    </div>
  );
}
