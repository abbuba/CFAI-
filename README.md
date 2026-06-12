# CFAI-

Smart Adaptive Traffic Signal Coordination System with Emergency Vehicle Prioritization and Real-Time Congestion Analytics.

A Tesla-inspired 3D digital twin of a four-intersection city network (A, B, C, D) where intelligent signals:

- Score congestion per intersection (`score = vehicle_count + queue_length`)
- Reallocate green durations every 5 seconds (greedy allocation — highest score gets the longest green)
- Prioritize emergency vehicles with signal preemption and a green corridor
- Compare **fixed timing (before)** vs **adaptive coordination (after)** live

## Tech

- Next.js + TypeScript + TailwindCSS
- Three.js / React Three Fiber (3D digital twin)
- Simulated traffic engine updating every second

## DSA mapping

| Structure / Algorithm | Used for |
| --- | --- |
| Queue | Vehicles waiting at intersections |
| Priority Queue | Emergency vehicle prioritization |
| Graph | Road network (nodes = intersections, edges = roads) |
| Greedy | Green time allocation by congestion score |

## Run

```bash
cd traffic-dashboard
npm install
npm run dev
```

Open http://localhost:3000.
