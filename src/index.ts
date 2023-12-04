import { transformRoutesPlugin } from "./ruto";
import fastifyPlugin from "fastify-plugin";

type PluginOpts = {
  routesPath: string;
};

export const ruto = fastifyPlugin<PluginOpts>(transformRoutesPlugin, {
  name: "ruto",
});
