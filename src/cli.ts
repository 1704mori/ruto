#! /usr/bin/env node
import { Command } from "commander";
import { readRoutesFolder } from "./utils/common";
import path from "node:path";
import fs from "node:fs";
import { generateFastifyRoutesAsMethods } from "./ruto";

// just a redundancy in case NODE_ENV
// is still 'dev' so it doens't
// cause errors while generating routes
process.env.NODE_ENV = "gen";

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
      const output = (await generateFastifyRoutesAsMethods(filePath)).outputText;
      fs.writeFileSync(filePath, output);
    }
  });

prog.parse();
