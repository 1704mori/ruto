import ts from "typescript";
import fastify, * as f from "fastify";
import path from "node:path";

import {
  checkIfBlockHasReturn,
  getExportedFunctions,
  getRouteReturnStatement,
  parseRouteReturn,
} from "./utils/ast";
import { METHODS, readRoutesFolder } from "./utils/common";
import { buildFastifyAsExport, buildImport } from "./builder/exported";
import { buildFastifyRouteHandler } from "./builder/handler";

export let routesPath: string = "";
let fastifyInstance: f.FastifyInstance;

const routesMap = new Map<string, ts.FunctionDeclaration[]>();

async function getRoutes(root: string) {
  const [routes, error] = await readRoutesFolder(root);

  if (!routesPath && root) {
    routesPath = root;
  }

  if (error) {
    console.log(error);
    return;
  }

  for (const route of routes!) {
    let filePath = path.join(routesPath, route);

    if (process.env.NODE_ENV != "dev") {
      if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
        filePath = filePath.split("/").slice(0, -1).join("/");
      }
    }

    const program = ts.createProgram([filePath], { allowJs: true });
    const sourceFile = program.getSourceFile(filePath);

    const exportedFunctions = getExportedFunctions(sourceFile!);

    if (!exportedFunctions) {
      continue;
    }

    // check index.ts line 12
    process.env.NODE_ENV == "dev" && (await import(filePath));
    routesMap.set(route, exportedFunctions);
  }
}

export async function generateFastifyRoutes(root: string) {
  await getRoutes(root);

  const routes: {
    result: ts.TranspileOutput;
    endpoint: string;
    method: (typeof METHODS)[number];
  }[] = [];

  for (const [route, funcs] of routesMap) {
    for (const func of funcs) {
      // await fs.writeFile(`${func.name.text}.json`, JSON.stringify(func, null, 2));
      const hasReturn = checkIfBlockHasReturn(func.body!);

      const method = func.name?.text as (typeof METHODS)[number];
      const basePath = route.replace(".ts", "").replace(".js", "");

      if (!hasReturn) {
        console.log(
          `Route ${method.toUpperCase()} /${basePath} does not have a return statement\n`,
        );
        continue;
      }

      const { handler: handlerFunction, route: routePath } =
        buildFastifyRouteHandler(func);

      const result = ts.transpileModule(
        ts
          .createPrinter()
          .printNode(
            ts.EmitHint.Unspecified,
            handlerFunction,
            ts.createSourceFile("", "", ts.ScriptTarget.Latest),
          ),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.CommonJS,
          },
        },
      );

      routes.push({
        result,
        method,
        endpoint: `/${basePath}${routePath}`,
      });
    }
  }

  return routes;

  // listRoutes();
}

export async function generateFastifyRoutesAsMethods(root: string) {
  await getRoutes(root);

  // for (const [route, funcs] of routesMap) {
  //   for (const func of funcs) {
  //     // await fs.writeFile(`${func.name.text}.json`, JSON.stringify(func, null, 2));
  //     const hasReturn = checkIfBlockHasReturn(func.body!);

  //     const method = func.name?.text as (typeof METHODS)[number];
  //     const basePath = route.replace(".ts", "").replace(".js", "");

  //     if (!hasReturn) {
  //       console.log(
  //         `Route ${method.toUpperCase()} /${basePath} does not have a return statement\n`,
  //       );
  //       continue;
  //     }

  //     const { fastifyImport, exportDefaultAsyncFunction } =
  //       buildFastifyAsExport({
  //         method,
  //         routePath: basePath,
  //         func,
  //       });

  //     const statements: ts.Statement[] = [
  //       fastifyImport,
  //       exportDefaultAsyncFunction,
  //     ];

  //     const sourceFile = ts.factory.createSourceFile(
  //       statements,
  //       ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
  //       ts.NodeFlags.None,
  //     );

  //     const result = ts.transpileModule(
  //       ts
  //         .createPrinter()
  //         .printNode(
  //           ts.EmitHint.Unspecified,
  //           sourceFile,
  //           ts.createSourceFile("", "", ts.ScriptTarget.Latest),
  //         ),
  //       {
  //         compilerOptions: {
  //           target: ts.ScriptTarget.ESNext,
  //           module: ts.ModuleKind.ESNext,
  //         },
  //       },
  //     );

  //     routes.push({
  //       result,
  //       method,
  //       endpoint: `/${basePath}`,
  //     });
  //   }
  // }

  const fastifyImport = buildImport();
  const exportDefaultAsyncFunction = buildFastifyAsExport(routesMap);

  const statements: ts.Statement[] = [
    fastifyImport,
    exportDefaultAsyncFunction,
  ];

  const sourceFile = ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  return ts.transpileModule(
    ts
      .createPrinter()
      .printNode(
        ts.EmitHint.Unspecified,
        sourceFile,
        ts.createSourceFile("", "", ts.ScriptTarget.Latest),
      ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
      },
    },
  );
}

function injectRoutes(
  metadata: {
    result: ts.TranspileOutput;
    method: (typeof METHODS)[number];
    endpoint: string;
  }[],
) {
  for (const { result, method, endpoint } of metadata) {
    const handler = eval(result.outputText);
    fastifyInstance.route({
      method,
      url: endpoint,
      handler,
    });
  }
}

async function recreateFastifyInstance() {
  if (fastifyInstance && (await fastifyInstance.ready())) {
    await fastifyInstance.close();
  }

  fastifyInstance = fastify();
}

export async function watcher(configRoot = "./") {
  const configPath = ts.findConfigFile(
    configRoot,
    ts.sys.fileExists,
    "tsconfig.json",
  );

  const host = ts.createWatchCompilerHost(
    configPath!,
    { noEmit: true },
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    undefined,
    async (diagnostic, _, __, errorCount) => {
      console.log(diagnostic.messageText, errorCount);
      if (errorCount === 0) {
        routesMap.clear();
        // await recreateFastifyInstance();
        // await generateFastifyRoutes();
      }
    },
  );

  ts.createWatchProgram(host);
}

export async function transformRoutesPlugin(
  fastify: f.FastifyInstance,
  opts: f.FastifyPluginOptions,
) {
  fastifyInstance = fastify;
  routesPath = opts.routesPath;

  const routes = await generateFastifyRoutes(routesPath);
  injectRoutes(routes);
  // await watcher();\
}
