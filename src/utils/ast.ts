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

export function getRouteVariablesDeclaration(func: ts.FunctionDeclaration) {
  const routeVariablesDeclarations: ts.VariableDeclaration[] = [];

  ts.forEachChild(func.body!, (node) => {
    if (ts.isVariableStatement(node)) {
      routeVariablesDeclarations.push(...node.declarationList.declarations);
    }
  });

  return routeVariablesDeclarations;
}

export function parseRouteVariablesDeclaration(
  func: ts.FunctionDeclaration,
  params: {
    routePath: string;
    params: string[];
    bodyParams: string[];
  },
) {
  const routeVariablesDeclarations = getRouteVariablesDeclaration(func);
  const newVariableDeclarations: ts.VariableDeclaration[] = [];

  if (!routeVariablesDeclarations || routeVariablesDeclarations.length === 0) {
    return ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList([]),
    );
  }

  for (const variableDeclaration of routeVariablesDeclarations) {
    const name = (variableDeclaration.name as ts.Identifier).escapedText.toString();

    if (!name) continue;

    const param = params.params.find((param) => param === name);

    if (!param) {
      newVariableDeclarations.push(variableDeclaration);
      continue;
    }

    const initializer = variableDeclaration.initializer;

    if (!initializer) {
      continue;
    }

    const expression = ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier("request.params"),
      ts.factory.createIdentifier(param),
    );

    const newVariableDeclaration = ts.factory.createVariableDeclaration(
      ts.factory.createIdentifier(name),
      variableDeclaration.exclamationToken,
      variableDeclaration.type,
      expression,
    );

    newVariableDeclarations.push(newVariableDeclaration);
  }

  const newVariableStatement = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(newVariableDeclarations),
  );

  return newVariableStatement;
}