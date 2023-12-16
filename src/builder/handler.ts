import ts from "typescript";
import { buildVerbParams } from "../utils/common";
import { parseRouteReturn } from "../utils/ast";

export function buildFastifyRouteHandler(func: ts.FunctionDeclaration) {
  const params = buildVerbParams(func);

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

  const returnExpression = parseRouteReturn(func, params);

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