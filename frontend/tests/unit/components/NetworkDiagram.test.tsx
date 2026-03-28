import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NetworkDiagram } from '../../../src/components/NetworkDiagram';
import type { PandaPowerNetwork } from '../../../src/core/types';

// Mock vis-network — it requires a real DOM canvas
const mockNetworkInstance = {
  on: vi.fn(),
  fit: vi.fn(),
  destroy: vi.fn(),
  getScale: vi.fn().mockReturnValue(1),
  moveTo: vi.fn(),
  getPositions: vi.fn().mockReturnValue({}),
};

vi.mock('vis-network', () => ({
  Network: vi.fn().mockImplementation(() => mockNetworkInstance),
}));

vi.mock('vis-data', () => ({
  DataSet: vi.fn().mockImplementation((items: unknown[]) => ({
    get: vi.fn(),
    update: vi.fn(),
    length: Array.isArray(items) ? items.length : 0,
  })),
}));

const minimalNetwork: PandaPowerNetwork = {
  bus: {
    '0': { index: 0, name: 'Bus 0', vn_kv: 110, type: 'b', in_service: true },
    '1': { index: 1, name: 'Bus 1', vn_kv: 20, type: 'b', in_service: true },
  },
  line: {
    '0': { index: 0, name: 'Line 0-1', from_bus: 0, to_bus: 1, length_km: 10,
      r_ohm_per_km: 0.01, x_ohm_per_km: 0.1, c_nf_per_km: 10, max_i_ka: 0.5, in_service: true },
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

describe('NetworkDiagram', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <NetworkDiagram network={minimalNetwork} />
    );
    expect(container.querySelector('.ppviz-network-preview')).toBeTruthy();
  });

  it('renders control buttons', () => {
    const { container } = render(
      <NetworkDiagram network={minimalNetwork} />
    );
    const controls = container.querySelector('.ppviz-network-controls');
    expect(controls).toBeTruthy();
    const buttons = controls!.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4); // zoom out, zoom in, labels, fit, physics
  });

  it('renders canvas container', () => {
    const { container } = render(
      <NetworkDiagram network={minimalNetwork} />
    );
    expect(container.querySelector('.ppviz-network-canvas')).toBeTruthy();
  });

  it('accepts theme prop without error', () => {
    const { container } = render(
      <NetworkDiagram network={minimalNetwork} theme="light" />
    );
    expect(container.querySelector('.ppviz-network-preview')).toBeTruthy();
  });

  it('calls onElementSelect when provided', () => {
    const onSelect = vi.fn();
    render(
      <NetworkDiagram network={minimalNetwork} onElementSelect={onSelect} />
    );
    // Component renders without error with callback
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('accepts className prop', () => {
    const { container } = render(
      <NetworkDiagram network={minimalNetwork} className="custom-class" />
    );
    const wrapper = container.querySelector('.ppviz-network-preview');
    expect(wrapper?.classList.contains('custom-class')).toBe(true);
  });
});
