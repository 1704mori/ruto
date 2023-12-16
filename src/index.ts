import { transformRoutesPlugin } from "./ruto";
import fastifyPlugin from "fastify-plugin";

type PluginOpts = {
  routesPath: string;
};

export const ruto = fastifyPlugin<PluginOpts>(transformRoutesPlugin, {
  name: "ruto",
});

// set NODE_ENV as dev to automatically
// import found routes while developing
// maybe there's a better way? idk
process.env.NODE_ENV = "dev";
