# Ruto - WIP

Dynamically register routes based on files in the `routes` directory.

Running
```bash
npx tsx example/index.ts
```

Example:
```bash
curl -X POST localhost:3333/user -H 'Content-Type: application/json' -d '{"name": "alo"}'

curl localhost:3333/user/satoshi/pikachu/123
```