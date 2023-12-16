import path from "node:path";
import fs from "node:fs/promises";

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
