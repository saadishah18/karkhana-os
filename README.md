# KarkhanaOS

AI-assisted inventory, trade and ledger (khata) SaaS for small factories and workshops.

## Docs
- [Requirements](docs/requirements/)
- [Learning log](LEARNING.md)

## Layout
- `api/`: Express + TypeScript + Mongoose backend (Node 22, see `.nvmrc`)
- `web/`: Next.js frontend (not started)

## Run
```
docker compose up -d        # MongoDB 7 replica set on localhost:27018
cd api && npm install && npm test
```
