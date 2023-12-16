import ts from "typescript";
import { METHODS } from "./common";

export function getExportedFunctions(sourceFile: ts.SourceFile) {
  if (!sourceFile) return;

  const exportedFunctions: ts.FunctionDeclaration[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) &&
      METHODS.includes(node.name?.text as typeof METHODS[number])
    ) {
      exportedFunctions.push(node);
    }
  });

  return exportedFunctions;
}

export function checkIfBlockHasReturn(block: ts.Block) {
  let hasReturn = false;

  ts.forEachChild(block, (node) => {
    if (ts.isReturnStatement(node)) {
      hasReturn = true;
    }
  });

  return hasReturn;
}

export function getRouteReturnStatement(func: ts.FunctionDeclaration) {
  let routeReturnStatement: ts.ReturnStatement | undefined;

  ts.forEachChild(func.body!, (node) => {
    if (ts.isReturnStatement(node)) {
      routeReturnStatement = node;
    }
  });

  return routeReturnStatement;
}

export function parseRouteReturn(func: ts.FunctionDeclaration, params: {
  routePath: string;
  params: string[];
  bodyParams: string[];
}) {
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
