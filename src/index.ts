import path from "node:path";
import fs from "node:fs/promises";
import ts from "typescript";

import * as f from "fastify";

const methods = ["get", "post", "put", "delete"] as const;
const routesPath = path.join(__dirname, "..", "example", "routes");

function getExportedFunctions(sourceFile: ts.SourceFile) {
  if (!sourceFile) return;

  const exportedFunctions: ts.FunctionDeclaration[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) &&
      methods.includes(node.name?.text as typeof methods[number])
    ) {
      exportedFunctions.push(node);
    }
  });

  return exportedFunctions;
}

function checkIfBlockHasReturn(block: ts.Block) {
  let hasReturn = false;

  ts.forEachChild(block, (node) => {
    if (ts.isReturnStatement(node)) {
      hasReturn = true;
    }
  });

  return hasReturn;
}

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

function getRouteReturnStatement(func: ts.FunctionDeclaration) {
  let routeReturnStatement: ts.ReturnStatement | undefined;

  ts.forEachChild(func.body!, (node) => {
    if (ts.isReturnStatement(node)) {
      routeReturnStatement = node;
    }
  });

  return routeReturnStatement;
}

function listRoutes() {
  console.log("Available routes:");
  for (const [route, funcs] of routesMap) {
    for (const func of funcs) {
      const method = func.name?.text as typeof methods[number];
      const routePath = route.replace(".ts", "");

      log(`${method.toUpperCase()} /${routePath}`);
    }
  }
}

export async function transformRoutesPlugin(fastify: f.FastifyInstance) {
  await getRoutes();

  for (const [route, funcs] of routesMap) {
    for (const func of funcs) {
      const hasReturn = checkIfBlockHasReturn(func.body!);

      const method = func.name?.text as typeof methods[number];
      const routePath = route.replace(".ts", "");

      if (!hasReturn) {
        log(`Route ${method.toUpperCase()} /${routePath} does not have a return statement\n`);
        continue;
      }

      // variable above creates this:
      // fastify.get(route, (request, reply) => {
      //   reply.send({ ... });
      // });
      // const fastifyMethod = ts.factory.createCallExpression(
      //   ts.factory.createPropertyAccessExpression(
      //     ts.factory.createIdentifier("fastify"),
      //     ts.factory.createIdentifier(method)
      //   ),
      //   undefined,
      //   [
      //     ts.factory.createStringLiteral(`/${routePath}`),
      //     ts.factory.createArrowFunction(
      //       undefined,
      //       undefined,
      //       [
      //         ts.factory.createParameterDeclaration(
      //           undefined,
      //           undefined,
      //           ts.factory.createIdentifier("request"),
      //           undefined,
      //           undefined,
      //         ),
      //         ts.factory.createParameterDeclaration(
      //           undefined,
      //           undefined,
      //           ts.factory.createIdentifier("reply"),
      //           undefined,
      //           undefined
      //         ),
      //       ],
      //       undefined,
      //       undefined,
      //       ts.factory.createBlock(
      //         [
      //           ts.factory.createExpressionStatement(
      //             ts.factory.createCallExpression(
      //               ts.factory.createPropertyAccessExpression(
      //                 ts.factory.createIdentifier("reply"),
      //                 ts.factory.createIdentifier("send")
      //               ),
      //               undefined,
      //               [
      //                 getRouteReturnStatement(func)?.expression ?? ts.factory.createNull()
      //               ]
      //             )
      //           )
      //         ],
      //         true
      //       )
      //     )
      //   ]
      // );

      const handlerFunction = ts.factory.createArrowFunction(
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
      );

      const result = ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified, handlerFunction, ts.createSourceFile("", "", ts.ScriptTarget.Latest)), {
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.CommonJS
        }
      });

      const handler = eval(result.outputText);
      fastify.route({
        method,
        url: `/${routePath}`,
        handler
      });
    }
  }

  listRoutes();
}

const log = (message: string) => console.log(`[transform-routes] ${message}`);