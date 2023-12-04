import path from "path";
import { ruto } from "../src";

import Fastify from "fastify";

(async () => {
  const fastify = await Fastify({
    logger: true,
  });

  await fastify.register(ruto, {
    routesPath: path.join(__dirname, "routes"),
  });

  fastify.printRoutes();
  fastify.printPlugins();

  fastify.listen({ port: 3333 }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    console.log(`Server listening on ${address}`);
  });
})();
