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