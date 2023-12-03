import ts from "typescript";
import fastify, * as f from "fastify";
import path from "node:path";
import fs from "node:fs/promises";

import { checkIfBlockHasReturn, getExportedFunctions, getRouteReturnStatement } from "./utils/ast";
import { METHODS } from "./utils/common";

export let routesPath: string;
let fastifyInstance: f.FastifyInstance;

async function readRoutesFolder(): Promise<[string[] | null, string | null]> {
  if (!(await fs.stat(routesPath))) {
    return [null, "routes folder not found"];
  }

  const routes: any[] = [];

  for (const route of await fs.readdir(routesPath)) {
    // if ((await fs.stat(route)).isDirectory()) {
    //   continue;
    // }

    routes.push(route);
  }

  return [routes, null];
}

const routesMap = new Map<string, ts.FunctionDeclaration[]>();

async function getRoutes() {
  const [routes, error] = await readRoutesFolder();

  if (error) {
    console.log(error);
    return;
  }

  for (const route of routes!) {
    const filePath = path.join(routesPath, route);
    const program = ts.createProgram([filePath], { allowJs: true });
    const sourceFile = program.getSourceFile(filePath);

    const exportedFunctions = getExportedFunctions(sourceFile!);

    if (!exportedFunctions) {
      continue;
    }

    routesMap.set(route, exportedFunctions);
  }
}

function buildFastifyWithMethod({ method, routePath, func }:
  { method: string, routePath: string, func: ts.FunctionDeclaration }
) {
  return ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("fastify"),
      ts.factory.createIdentifier(method)
    ),
    undefined,
    [
      ts.factory.createStringLiteral(`/${routePath}`),
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            ts.factory.createIdentifier("request"),
            undefined,
            undefined,
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            ts.factory.createIdentifier("reply"),
            undefined,
            undefined
          ),
        ],
        undefined,
        undefined,
        ts.factory.createBlock(
          [
            ts.factory.createExpressionStatement(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("reply"),
                  ts.factory.createIdentifier("send")
                ),
                undefined,
                [
                  getRouteReturnStatement(func)?.expression ?? ts.factory.createNull()
                ]
              )
            )
          ],
          true
        )
      )
    ]
  );
}

function buildFastifyRouteHandler(func: ts.FunctionDeclaration) {
  const parameters = ts.factory.createNodeArray([
    ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      ts.factory.createIdentifier("request"),
      undefined,
      undefined,
    ),
    ts.factory.createParameterDeclaration(
      undefined,
      undefined,
      ts.factory.createIdentifier("reply"),
      undefined,
      undefined
    ),
  ]);

  return ts.factory.createArrowFunction(
    undefined,
    undefined,
    parameters,
    undefined,
    undefined,
    ts.factory.createBlock(
      [
        ts.factory.createExpressionStatement(
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("reply"),
              ts.factory.createIdentifier("send")
            ),
            undefined,
            [
              getRouteReturnStatement(func)?.expression ?? ts.factory.createNull()
            ]
          )
        )
      ],
      true
    )
  );
}

export async function generateFastifyRoutes() {
  await getRoutes();

  for (const [route, funcs] of routesMap) {
    for (const func of funcs) {
      const hasReturn = checkIfBlockHasReturn(func.body!);

      const method = func.name?.text as typeof METHODS[number];
      const routePath = route.replace(".ts", "");

      if (!hasReturn) {
        console.log(`Route ${method.toUpperCase()} /${routePath} does not have a return statement\n`);
        continue;
      }

      const handlerFunction = buildFastifyRouteHandler(func);

      const result = ts.transpileModule(ts
        .createPrinter()
        .printNode(
          ts.EmitHint.Unspecified,
          handlerFunction,
          ts.createSourceFile("", "", ts.ScriptTarget.Latest)),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.CommonJS
          }
        });

      const handler = eval(result.outputText);
      fastifyInstance.route({
        method,
        url: `/${routePath}`,
        handler
      });
    }
  }

  // listRoutes();
}

async function recreateFastifyInstance() {
  if (fastifyInstance && (await fastifyInstance.ready())) {
    await fastifyInstance.close();
  }

  fastifyInstance = fastify();
}

export async function watcher() {
  const configPath = ts.findConfigFile(
    /*searchPath*/ "./",
    ts.sys.fileExists,
    "tsconfig.json"
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
        await recreateFastifyInstance();
        await generateFastifyRoutes();
      }
    }
  );

  ts.createWatchProgram(host);
}

export async function transformRoutesPlugin(fastify: f.FastifyInstance, opts: f.FastifyPluginOptions) {
  fastifyInstance = fastify;
  routesPath = opts.routesPath;

  await generateFastifyRoutes();
  // await watcher();\
}