#! /usr/bin/env node
import { Command } from "commander";
import { readRoutesFolder } from "./utils/common";
import path from "node:path";

const prog = new Command("ruto");

prog
  .command("gen")
  .description("Generate routes ready for production")
  .option(
    "-r --routes <relative_path>",
    "Folder where your routes is declared",
    "routes",
  )
  .action(async function () {
    // @ts-ignore
    const root = this.parent._scriptPath.split("node_modules")[0];
    // @ts-ignore
    const routesPath = path.join(root, this.opts().routes);
    const [routes, error] = await readRoutesFolder(routesPath);

    if (error) {
      console.log(error);
      return;
    }

    for (const route of routes!) {
      const filePath = path.join(root, route);
      console.log("routes file: %s", filePath);
    }
  });

prog.parse();
