import ts from "typescript";
import { buildBlock, buildVerbParams } from "../utils/common";
import { getRouteReturnStatement } from "../utils/ast";

function buildReturn(func: ts.FunctionDeclaration, params: {
  routePath: string;
  params: string[];
  bodyParams: string[];
}) {
  // parse func variables
  let returnExpression = getRouteReturnStatement(func)?.expression;

  // if (params.params.length > 0) {
  if (returnExpression && ts.isObjectLiteralExpression(returnExpression)) {
    const properties = returnExpression.properties;

    if (properties && properties.length > 0) {
      const newProperties: ts.PropertyAssignment[] = [];

      for (const property of properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = (property.name as ts.Identifier).escapedText.toString();
          const initializer = property.initializer;
          // log kind
          console.log("kind %s", ts.SyntaxKind[initializer.kind]);

          if (ts.isIdentifier(initializer)) {
            const param = params.params.find((param) => param === (initializer as ts.Identifier).escapedText);

            if (!param) {
              console.log("dont have param %s", name);

              const newPropertyAssignment = ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier(name),
                initializer,
              );

              newProperties.push(newPropertyAssignment);

              continue;
            }

            const expression = ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier("request.params"),
              ts.factory.createIdentifier(param),
            );

            const newPropertyAssignment = ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier(name),
              expression,
            );

            newProperties.push(newPropertyAssignment);

            // const newObjectLiteralExpression =
            //   ts.factory.createObjectLiteralExpression([
            //     newPropertyAssignment,
            //   ]);

            // const newReturnStatement = ts.factory.createReturnStatement(
            //   newObjectLiteralExpression,
            // );

            // returnExpression = newReturnStatement.expression;
          }

          // is template
          if (ts.isTemplateExpression(initializer)) {
            const originalHead = initializer.head;
            const templateSpans = initializer.templateSpans;
            const templates: ts.TemplateSpan[] = [];

            for (const templateSpan of templateSpans) {
              const expression = templateSpan.expression;

              if (ts.isIdentifier(expression)) {
                const param = params.params.find(
                  (param) => param === expression.escapedText,
                );

                if (!param) {
                  continue;
                }

                const newExpression = ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("request.params"),
                  ts.factory.createIdentifier(param),
                );

                const newTemplateSpan = ts.factory.createTemplateSpan(
                  newExpression,
                  templateSpan.literal,
                );

                templates.push(newTemplateSpan);
              }

              if (ts.isPropertyAccessExpression(expression)) {
                const newExpression = ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("request.body"),
                  expression.name,
                );

                const newTemplateSpan = ts.factory.createTemplateSpan(
                  newExpression,
                  templateSpan.literal,
                );

                templates.push(newTemplateSpan);
              }
            }

            const newTemplateExpression = ts.factory.createTemplateExpression(
              originalHead,
              templates,
            );

            const newPropertyAssignment = ts.factory.createPropertyAssignment(
              ts.factory.createIdentifier(name),
              newTemplateExpression,
            );

            // keep previous property
            newProperties.push(newPropertyAssignment);
          }
        }
      }

      const newObjectLiteralExpression =
        ts.factory.createObjectLiteralExpression(newProperties);

      const newReturnStatement = ts.factory.createReturnStatement(
        newObjectLiteralExpression,
      );

      returnExpression = newReturnStatement.expression;
    }
  }

  return returnExpression;
}

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

  const block = buildBlock(func, params);

  const handler = ts.factory.createArrowFunction(
    undefined,
    undefined,
    parameters,
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
    //         [returnExpression ?? ts.factory.createNull()],
    //       ),
    //     ),
    //   ],
    //   true,
    // ),
    block,
  );

  return {
    handler,
    route: params.routePath,
  };
}