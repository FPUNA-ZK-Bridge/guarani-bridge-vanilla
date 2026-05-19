// scripts/mutation-test.js
//
// Harness de mutation testing para los contratos Solidity del bridge.
// Genera mutantes de cada archivo .sol aplicando operadores de mutación
// clásicos, recompila y corre `npm run test:unit` por cada mutante.
// Reporta killed / survived / stillborn y un mutation score.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGET_FILES = [
  "contracts/GuaraniToken.sol",
  "contracts/Sender.sol",
  "contracts/Receiver.sol",
];

const TEST_CMD = ["npx", "hardhat", "test", "test/Unit.test.js"];

/* ------------------------------ operadores ------------------------------ */
// Cada operador define un regex y la string con la que se reemplaza.
// El orden importa solo para reporting; nunca aplicamos dos a la vez.
const OPERATORS = [
  { name: "GE_LE",       regex: />=/g,                                 replacement: "<=" },
  { name: "LE_GE",       regex: /<=/g,                                 replacement: ">=" },
  { name: "GT_LT",       regex: /(?<![<=!>])>(?!=)/g,                  replacement: "<"  },
  { name: "LT_GT",       regex: /(?<![<=!>])<(?!=)/g,                  replacement: ">"  },
  { name: "EQ_NE",       regex: /==/g,                                 replacement: "!=" },
  { name: "NE_EQ",       regex: /!=/g,                                 replacement: "==" },
  { name: "AND_OR",      regex: /&&/g,                                 replacement: "||" },
  { name: "OR_AND",      regex: /\|\|/g,                               replacement: "&&" },
  { name: "INC_REMOVE",  regex: /\+\+/g,                               replacement: ""   },
  { name: "TRUE_FALSE",  regex: /\btrue\b/g,                           replacement: "false" },
  { name: "FALSE_TRUE",  regex: /\bfalse\b/g,                          replacement: "true"  },
  { name: "PLUS_MINUS",  regex: /(?<!\+)\+(?!\+|=)/g,                  replacement: "-"  },
  { name: "MINUS_PLUS",  regex: /(?<!\-)-(?!\-|=|>)/g,                 replacement: "+"  },
  { name: "NOT_REMOVE",  regex: /(?<![\w=!])!(?!=)/g,                  replacement: ""   },
];

/* ----------------- detección de zonas que no se deben mutar ----------------- */
// inCode[i] === 1 => index `i` está en código real (no en string, comentario,
// import, pragma, ni SPDX).
function computeInCode(source) {
  const inCode = new Uint8Array(source.length);
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inLineComment) {
      if (c === "\n") inLineComment = false;
    } else if (inBlockComment) {
      if (c === "*" && source[i + 1] === "/") { inBlockComment = false; i++; }
    } else if (inString !== null) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
    } else if (c === "/" && source[i + 1] === "/") {
      inLineComment = true; i++;
    } else if (c === "/" && source[i + 1] === "*") {
      inBlockComment = true; i++;
    } else if (c === "'" || c === '"') {
      inString = c;
    } else {
      inCode[i] = 1;
    }
  }
  // Apagar líneas de pragma/import/SPDX
  const lines = source.split("\n");
  let off = 0;
  for (const line of lines) {
    if (/^\s*(pragma|import|\/\/)/.test(line)) {
      for (let k = off; k < off + line.length; k++) inCode[k] = 0;
    }
    off += line.length + 1;
  }
  return inCode;
}

function lineCol(source, offset) {
  let line = 1, col = 1;
  for (let i = 0; i < offset; i++) {
    if (source[i] === "\n") { line++; col = 1; } else { col++; }
  }
  return { line, col };
}

/* --------------------------- generación de puntos --------------------------- */
function findMutationPoints(source) {
  const inCode = computeInCode(source);
  const points = [];

  for (const op of OPERATORS) {
    const re = new RegExp(op.regex.source, "g");
    let m;
    while ((m = re.exec(source))) {
      if (inCode[m.index] !== 1) continue;
      points.push({
        offset: m.index,
        length: m[0].length,
        replacement: op.replacement,
        operator: op.name,
        originalText: m[0],
      });
    }
  }

  // require(...) -> elimina la sentencia completa
  const reqRe = /require\s*\(/g;
  let rm;
  while ((rm = reqRe.exec(source))) {
    if (inCode[rm.index] !== 1) continue;
    const start = rm.index;
    let depth = 1;
    let i = rm.index + rm[0].length;
    while (i < source.length && depth > 0) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") depth--;
      i++;
    }
    if (depth !== 0) continue;
    let end = i;
    while (end < source.length && /\s/.test(source[end])) end++;
    if (source[end] === ";") end++;
    points.push({
      offset: start,
      length: end - start,
      replacement: "",
      operator: "REQUIRE_REMOVED",
      originalText: source.slice(start, end),
    });
  }

  points.sort((a, b) => a.offset - b.offset);
  return points;
}

function applyMutation(source, p) {
  return source.slice(0, p.offset) + p.replacement + source.slice(p.offset + p.length);
}

/* ----------------------------- ejecución ----------------------------- */
function runTests() {
  const r = spawnSync(TEST_CMD[0], TEST_CMD.slice(1), {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, BRIDGE_ENV: process.env.BRIDGE_ENV || "local" },
  });
  return {
    code: r.status,
    stdout: r.stdout?.toString() ?? "",
    stderr: r.stderr?.toString() ?? "",
  };
}

function classify(result) {
  const out = (result.stdout + "\n" + result.stderr).toLowerCase();
  const compileFailed =
    /\b(compilation failed|parsererror|compilererror|error hh|typeerror)/i.test(out) &&
    !out.includes("passing");
  if (compileFailed) return "STILLBORN";
  if (result.code === 0) return "SURVIVED";
  return "KILLED";
}

/* ------------------------------- main ------------------------------- */
function main() {
  const startedAt = Date.now();
  console.log("Mutation testing harness");
  console.log("========================\n");

  console.log("Baseline: corriendo tests sobre el código original…");
  const baseline = runTests();
  if (baseline.code !== 0) {
    console.error("❌ Los tests fallan en el código original. Abortando.");
    console.error(baseline.stdout);
    console.error(baseline.stderr);
    process.exit(1);
  }
  console.log("✅ Baseline OK\n");

  const results = [];

  for (const rel of TARGET_FILES) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      console.log(`(omito ${rel}: no existe)`);
      continue;
    }
    const original = fs.readFileSync(full, "utf8");
    const points = findMutationPoints(original);
    console.log(`\n${rel}: ${points.length} mutantes candidatos`);

    for (const p of points) {
      const { line, col } = lineCol(original, p.offset);
      const mutated = applyMutation(original, p);
      fs.writeFileSync(full, mutated);
      let result;
      try {
        result = runTests();
      } finally {
        fs.writeFileSync(full, original);
      }
      const status = classify(result);
      const entry = {
        file: rel, line, col, operator: p.operator,
        originalText: p.originalText, replacement: p.replacement, status,
      };
      results.push(entry);
      const icon = status === "KILLED" ? "✅" : status === "SURVIVED" ? "❌" : "·";
      const orig = p.originalText.length > 40 ? p.originalText.slice(0, 37) + "…" : p.originalText;
      const repl = p.replacement.length > 40 ? p.replacement.slice(0, 37) + "…" : p.replacement;
      console.log(`  ${icon} ${rel}:${line}:${col} ${p.operator.padEnd(15)} "${orig}" → "${repl}" [${status}]`);
    }
  }

  const killed    = results.filter(r => r.status === "KILLED").length;
  const survived  = results.filter(r => r.status === "SURVIVED").length;
  const stillborn = results.filter(r => r.status === "STILLBORN").length;
  const considered = killed + survived;
  const score = considered > 0 ? ((killed / considered) * 100).toFixed(2) : "N/A";
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("\n=== Resumen de mutation testing ===");
  console.log(`Mutantes totales:      ${results.length}`);
  console.log(`  Killed:              ${killed}`);
  console.log(`  Survived:            ${survived}`);
  console.log(`  Stillborn (skip):    ${stillborn}`);
  console.log(`Mutation score:        ${score}%   (killed / (killed+survived))`);
  console.log(`Tiempo total:          ${elapsed}s`);

  if (survived > 0) {
    console.log("\nMutantes vivos (los tests NO los detectaron):");
    for (const r of results.filter(r => r.status === "SURVIVED")) {
      console.log(`  - ${r.file}:${r.line}:${r.col} ${r.operator} "${r.originalText}" → "${r.replacement}"`);
    }
  }

  fs.writeFileSync(path.join(ROOT, "mutation-report.json"), JSON.stringify({
    total: results.length, killed, survived, stillborn, score, elapsedSec: Number(elapsed), results,
  }, null, 2));
  console.log("\nReporte JSON: mutation-report.json");

  process.exit(survived === 0 ? 0 : 1);
}

main();
