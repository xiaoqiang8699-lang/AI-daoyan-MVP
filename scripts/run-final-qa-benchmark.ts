import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { finalProgramChecks } from "../lib/enhancement";

const root = path.resolve("test-fixtures/final-qa");
const output = path.resolve("test-results/final-qa-benchmark");
async function main() {
  await mkdir(output, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as { cases: Array<{ id: string; file: string; expected: string }> };
  const cases = [];
  for (const item of manifest.cases) {
    const checks = await finalProgramChecks(path.join(root, item.file));
    const actual = checks.blackScreen ? "BLACK_SCREEN" : !checks.audio ? "AUDIO_MISSING" : "PASSED";
    cases.push({ ...item, actual, passed: actual === item.expected, programChecks: checks });
  }
  await writeFile(path.join(output, "results.json"), JSON.stringify({ provider: "program", aiFinalQa: "BETA_PROVIDER_BLOCKED", generatedAt: new Date().toISOString(), cases }, null, 2));
  console.log(JSON.stringify(cases, null, 2));
}
void main();
