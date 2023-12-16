import ts from "typescript";
import fastify, * as f from "fastify";
import path from "node:path";

import {
  checkIfBlockHasReturn,
  getExportedFunctions,
  getRouteReturnStatement,
} from "./utils/ast";
import { METHODS, readRoutesFolder } from "./utils/common";

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

function parseRouteReturn(func: ts.FunctionDeclaration) {
  const params = buildMethodParams(func);
  let returnExpression = getRouteReturnStatement(func)?.expression;

  // if (params.params.length > 0) {
  if (returnExpression && ts.isObjectLiteralExpression(returnExpression)) {
    const properties = returnExpression.properties;

    if (properties && properties.length > 0) {
      // @ts-ignore
      const templateSpans = (properties as any).find((prop: any) =>
        ts.isTemplateExpression(prop.initializer),
      )?.initializer as ts.TemplateExpression;
      const templates: ts.TemplateSpan[] = [];

      if (templateSpans) {
        const originalHead = templateSpans.head;
        const templateSpansExpressions = templateSpans.templateSpans.map(
          (span) => span.expression,
        );

        for (const templateSpansExpression of templateSpansExpressions) {
          if (ts.isIdentifier(templateSpansExpression)) {
            const param = params.params.find(
              (param) => param === templateSpansExpression.escapedText,
            );

            if (!param) {
              continue;
            }

            const expression = ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("request.params"),
              ts.factory.createIdentifier(param),
            );

            const originalTail = templateSpans.templateSpans.find(
              (span) => span.expression === templateSpansExpression,
            )?.literal;
            // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, originalTail as ts.TemplateTail, ts.createSourceFile("", "", ts.ScriptTarget.Latest)));

            const templateSpan = ts.factory.createTemplateSpan(
              expression,
              originalTail as ts.TemplateTail,
            );
            // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, templateSpan, ts.createSourceFile("", "", ts.ScriptTarget.Latest)));

            templates.push(templateSpan);
          }

          if (ts.isPropertyAccessExpression(templateSpansExpression)) {
            const expression = ts.factory.createPropertyAccessExpression(
              // ts.factory.createIdentifier("request.params"),
              ts.factory.createIdentifier("request.body"),
              templateSpansExpression.name,
            );

            const originalTail = templateSpans.templateSpans.find(
              (span) => span.expression === templateSpansExpression,
            )?.literal;
            // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, originalTail as ts.TemplateTail, ts.createSourceFile("", "", ts.ScriptTarget.Latest)));

            const templateSpan = ts.factory.createTemplateSpan(
              expression,
              originalTail as ts.TemplateTail,
            );
            // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, templateSpan, ts.createSourceFile("", "", ts.ScriptTarget.Latest)));

            templates.push(templateSpan);
          }
        }

        const newTemplateExpression = ts.factory.createTemplateExpression(
          // ts.factory.createTemplateHead(""),
          originalHead,
          templates,
        );
        // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, newTemplateExpression, ts.createSourceFile("", "", ts.ScriptTarget.Latest)));

        const newObjectLiteralExpression =
          ts.factory.createObjectLiteralExpression([
            ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier("message"),
              newTemplateExpression,
            ),
          ]);

        const newReturnStatement = ts.factory.createReturnStatement(
          newObjectLiteralExpression,
        );

        returnExpression = newReturnStatement.expression;
      }
    }
  }

  return returnExpression;
}

function buildMethodParams(func: ts.FunctionDeclaration) {
  const parameters = func.parameters;

  if (!parameters || parameters.length === 0) {
    return { routePath: "", params: [], bodyParams: [] };
  }

  let routePath = "";
  const params: string[] = [];
  const bodyParams: string[] = [];

  for (const param of parameters) {
    if (param.type && ts.isToken(param.type)) {
      params.push((param.name as ts.Identifier).escapedText as string);
      routePath += `/:${(param.name as ts.Identifier).escapedText}`;
    }

    if (param.type && ts.isTypeLiteralNode(param.type)) {
      const properties = param.type.members;

      if (!properties || properties.length === 0) {
        continue;
      }

      for (const property of properties) {
        if (ts.isPropertySignature(property)) {
          bodyParams.push(
            (property.name as ts.Identifier).escapedText as string,
          );
        }
      }
    }
  }

  return {
    routePath,
    params,
    bodyParams,
  };
}

function buildFastifyAsExport({
  method,
  routePath,
  func,
}: {
  method: string;
  routePath: string;
  func: ts.FunctionDeclaration;
}) {
  const fastifyImport = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier("fastify"),
      undefined,
    ),
    ts.factory.createStringLiteral("fastify"),
    undefined,
  );

  const returnExpression = parseRouteReturn(func);

  const _method = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("fastify"),
      ts.factory.createIdentifier(method),
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
            undefined,
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
                  ts.factory.createIdentifier("send"),
                ),
                undefined,
                [returnExpression ?? ts.factory.createNull()],
              ),
            ),
          ],
          true,
        ),
      ),
    ],
  );

  const exportDefaultAsyncFunction = ts.factory.createExportAssignment(
    undefined,
    false,
    ts.factory.createFunctionExpression(
      [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
      undefined,
      undefined,
      [
        ts.factory.createTypeParameterDeclaration(
          undefined,
          ts.factory.createIdentifier("FastifyInstance"),
          undefined,
          undefined,
        ),
        ts.factory.createTypeParameterDeclaration(
          undefined,
          ts.factory.createIdentifier("FastifyPluginOptions"),
          undefined,
          undefined,
        ),
      ],
      [
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier("fastify"),
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("FastifyInstance"),
            undefined,
          ),
          undefined,
        ),
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier("opts"),
          undefined,
          ts.factory.createTypeReferenceNode(
            ts.factory.createIdentifier("FastifyPluginOptions"),
            undefined,
          ),
          undefined,
        ),
      ],
      undefined,
      ts.factory.createBlock(
        [ts.factory.createExpressionStatement(_method)],
        true,
      ),
    ),
  );

  return {
    fastifyImport,
    exportDefaultAsyncFunction,
  };
}

function buildFastifyRouteHandler(func: ts.FunctionDeclaration) {
  const params = buildMethodParams(func);
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
      undefined,
    ),
  ]);

  const returnExpression = parseRouteReturn(func);

  const handler = ts.factory.createArrowFunction(
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
              ts.factory.createIdentifier("send"),
            ),
            undefined,
            [returnExpression ?? ts.factory.createNull()],
          ),
        ),
      ],
      true,
    ),
  );

  return {
    handler,
    route: params.routePath,
  };
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

      const { fastifyImport, exportDefaultAsyncFunction } =
        buildFastifyAsExport({
          method,
          routePath: basePath,
          func,
        });

      const statements: ts.Statement[] = [
        fastifyImport,
        exportDefaultAsyncFunction,
      ];

      const sourceFile = ts.factory.createSourceFile(
        statements,
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None,
      );

      const result = ts.transpileModule(
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

      routes.push({
        result,
        method,
        endpoint: `/${basePath}`,
      });
    }
  }

  return routes;

  // listRoutes();
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
