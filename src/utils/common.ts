import fs from "node:fs/promises";
import ts from "typescript";

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
