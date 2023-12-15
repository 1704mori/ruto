import path from "node:path";
import fs from "node:fs/promises";
import { routesPath as _routesPath } from "../ruto";

let routesPath = _routesPath;

export const METHODS = ["get", "post", "put", "delete"] as const;

export async function readRoutesFolder(
  root?: string,
): Promise<[string[] | null, string | null]> {
  if (root) {
    routesPath = path.join(root);
  }

  console.log("[ruto]: reading routes from %s", routesPath);

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
