#! /usr/bin/env node
import { Command } from "commander";
import { readRoutesFolder } from "./utils/common";
import path from "node:path";
import fs from "node:fs";
import { generateFastifyRoutes, generateFastifyRoutesAsMethods } from "./ruto";

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
    const opts = this.opts();
    // @ts-ignore
    const routesPath = path.join(root, opts.routes);
    const [routes, error] = await readRoutesFolder(routesPath);

    // @ts-ignore

    if (error) {
      console.log(error);
      return;
    }

    for (const route of routes!) {
      const filePath = path.join(root, opts.routes, route);
      console.log("generating route for file: %s", filePath);
      const metadata = await generateFastifyRoutesAsMethods(filePath);
      console.log("metadata: %o", metadata);
      
      for (const { result } of metadata) {
        fs.writeFileSync(filePath, result.outputText);
      }
    }
  });

prog.parse();
