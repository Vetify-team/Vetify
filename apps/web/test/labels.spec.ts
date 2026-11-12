import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accessActionLabel } from "../src/lib/labels";

/** Every access-log action the API writes, read from its source. */
function apiActions(): string[] {
  const root = join(__dirname, "../../api/src");
  const actions = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === "generated") continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) {
        const source = readFileSync(path, "utf8");
        for (const m of source.matchAll(/LogAccess\('([a-z_]+)'/g)) actions.add(m[1]!);
        // listVisible(user, 'action') and listVisible(user, 'action', { … }).
        for (const m of source.matchAll(/listVisible\(\s*[^,]+,\s*'([a-z_]+)'/g))
          actions.add(m[1]!);
        for (const m of source.matchAll(/action: '([a-z_]+)'/g)) actions.add(m[1]!);
      }
    }
  };
  walk(root);
  return [...actions];
}

describe("accessActionLabel", () => {
  it("has words for every action the API logs, so the owner never sees a code", () => {
    const actions = apiActions();
    expect(actions).toEqual(expect.arrayContaining(["request_upload", "view_card"]));
    const missing = actions.filter((action) => accessActionLabel(action) === action);
    expect(missing).toEqual([]);
  });
});
