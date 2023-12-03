import path from "path"
import { transformRoutesPlugin } from "../src"

import Fastify from 'fastify'
const fastify = Fastify({
  logger: true
})

fastify.register(transformRoutesPlugin, {
  routesPath: path.join(__dirname, "routes")
})

fastify.listen({ port: 3333 }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  console.log(`Server listening on ${address}`)
})
