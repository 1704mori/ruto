import ts from "typescript";
import { checkIfBlockHasReturn, getRouteReturnStatement, parseRouteVariablesDeclaration } from "../utils/ast";
import { METHODS } from "http";
import { buildBlock, buildVerbParams } from "../utils/common";

export function buildImport() {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      ts.factory.createIdentifier("fastify"),
      undefined,
    ),
    ts.factory.createStringLiteral("fastify"),
    undefined,
  );
}

export function buildFastifyAsExport(
  routesMap: Map<string, ts.FunctionDeclaration[]>,
) {
  const blocks: ts.Statement[] = [];

  for (const [route, funcs] of routesMap) {
    for (const func of funcs) {
      const hasReturn = checkIfBlockHasReturn(func.body!);

      const method = func.name?.text as (typeof METHODS)[number];
      let basePath = route.replace(".ts", "").replace(".js", "");

      if (!hasReturn) {
        console.log(
          `Route ${method.toUpperCase()} /${basePath} does not have a return statement\n`,
        );
        continue;
      }

      const params = buildVerbParams(func);
      if (params.routePath) {
        basePath = `${basePath}${params.routePath}`;
      }

      const block = buildBlock(func, params);

      const _method = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createIdentifier("fastify"),
          ts.factory.createIdentifier(method),
        ),
        undefined,
        [
          ts.factory.createStringLiteral(`/${basePath}`),
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
            // ts.factory.createBlock(
            //   [
            //     ts.factory.createExpressionStatement(
            //       ts.factory.createCallExpression(
            //         ts.factory.createPropertyAccessExpression(
            //           ts.factory.createIdentifier("reply"),
            //           ts.factory.createIdentifier("send"),
            //         ),
            //         undefined,
            //         [block ?? ts.factory.createNull()],
            //       ),
            //     ),
            //   ],
            //   true,
            // ),
            block
          ),
        ],
      );

      blocks.push(ts.factory.createExpressionStatement(_method));
    }
  }

  return ts.factory.createExportAssignment(
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
      // ts.factory.createBlock(
      //   [ts.factory.createExpressionStatement(_method)],
      //   true,
      // ),
      ts.factory.createBlock(blocks, true),
    ),
  );
}
