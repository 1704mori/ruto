# Ruto - WIP

Dynamically register routes based on files in the `routes` directory.

Running (dev mode)
```bash
npm run dev
npm run build:link # in case you want to run the ruto-example
```

Running (link mode)
```bash
git clone https://github.com/1704mori/ruto-example.git # clone somewhere else
npm link ruto
npm run gen
```

Example:
```bash
curl -X POST localhost:3333/user -H 'Content-Type: application/json' -d '{"name": "alo"}'

curl localhost:3333/user/satoshi/pikachu/123
```

### todo
- [ ] parse everything in the return statement
