# pandapower-viz

Interactive web visualizer for pandapower networks.

## Install

```bash
pip install pandapower-viz
```

## Quick Start

```python
import pandapower as pp
import pandapower_viz as pv

net = pp.networks.case_ieee14()
pp.runpp(net)
pv.show(net)
```

## React Usage

```bash
npm install pandapower-viz
```

```tsx
import { NetworkDiagram, parsePandaPowerJson } from 'pandapower-viz';
import 'pandapower-viz/dist/style.css';

const network = parsePandaPowerJson(jsonData);
<NetworkDiagram network={network} theme="dark" />
```

## License

MIT
