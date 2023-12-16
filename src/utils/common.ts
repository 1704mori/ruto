import ts from "typescript";
import fs from "node:fs/promises";
import { getRouteReturnStatement, parseRouteVariablesDeclaration } from "./ast";

export const METHODS = ["get", "post", "put", "delete"] as const;

export async function readRoutesFolder(
  root: string,
): Promise<[string[] | null, string | null]> {
  console.log("[ruto]: reading routes from %s", root);

  if (root.endsWith(".ts") || root.endsWith(".js")) {
    root = root.split("/").slice(0, -1).join("/");
  }

  if (!(await fs.stat(root))) {
    return [null, "routes folder not found"];
  }

  const routes: any[] = [];

  for (const route of await fs.readdir(root)) {
    // if ((await fs.stat(route)).isDirectory()) {
    //   continue;
    // }

    const hasRoute = routes.some((r) => {
      const _r = r.split(".")[0];
      return new RegExp(_r).test(route);
    });
    if (hasRoute) {
      continue;
    }

    routes.push(route);
  }

  return [routes, null];
}

export function buildVerbParams(func: ts.FunctionDeclaration) {
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

export function buildBlock(func: ts.FunctionDeclaration, params: {
  routePath: string;
  params: string[];
  bodyParams: string[];
}) {
  const variableStatement = parseRouteVariablesDeclaration(func, params);
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

  if (!variableStatement.declarationList.declarations.length) {
    return ts.factory.createBlock(
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
    );
  }

  return ts.factory.createBlock(
    [
      variableStatement,
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
  );
}