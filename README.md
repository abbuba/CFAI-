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

## Live demo (GitHub Pages)

The built site is in the [`docs/`](docs/) folder. **GitHub Pages must be turned on once** (the workflow cannot do this automatically):

1. Open **[Settings → Pages](https://github.com/abbuba/CFAI-/settings/pages)**
2. **Build and deployment → Source:** choose **Deploy from a branch**
3. **Branch:** `main` · **Folder:** `/docs` · click **Save**
4. Wait 1–2 minutes, then open: **https://abbuba.github.io/CFAI-/**

Alternative: use branch `gh-pages` with folder `/ (root)` — the workflow updates that branch too.

### Vercel (no Pages setup)

1. Go to [vercel.com/new](https://vercel.com/new) and import **abbuba/CFAI-**
2. Set **Root Directory** to `traffic-dashboard`
3. Deploy — you get a URL like `https://cfai-xxx.vercel.app` with no base path setup
