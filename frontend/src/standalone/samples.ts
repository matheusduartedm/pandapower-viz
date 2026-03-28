export interface SampleNetwork {
  id: string;
  name: string;
  buses: number;
  description: string;
}

export const SAMPLES: SampleNetwork[] = [
  { id: 'sample_network', name: '4-Bus Sample', buses: 4, description: 'Simple test network with 2 lines and 1 transformer' },
  { id: 'ieee14', name: 'IEEE 14-Bus', buses: 14, description: 'IEEE standard test case for power flow studies' },
  { id: 'ieee30', name: 'IEEE 30-Bus', buses: 30, description: 'IEEE standard test case with generators and loads' },
];

export async function loadSample(id: string): Promise<unknown> {
  switch (id) {
    case 'sample_network':
      return (await import('./data/sample_network.json')).default;
    case 'ieee14':
      return (await import('./data/ieee14.json')).default;
    case 'ieee30':
      return (await import('./data/ieee30.json')).default;
    default:
      throw new Error(`Unknown sample: ${id}`);
  }
}
