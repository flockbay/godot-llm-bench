#!/usr/bin/env node
/**
 * Can a model write working Godot 4 code? Fifteen tasks, judged by running them.
 *
 *   GODOT=/path/to/godot node bench.mjs validate
 *   GODOT=/path/to/godot node bench.mjs run --agent claude --model claude-opus-5-5 [--only move,gravity]
 *   GODOT=/path/to/godot node bench.mjs run --agent codex --model gpt-6.1-sol
 *
 * GODOT is a Godot 4 console binary (on Windows, the *_console.exe build).
 * CLAUDE_BIN and CODEX_BIN name the agent executables when they are not on
 * PATH as claude and codex (on Windows, point them at the .exe, not a .cmd).
 *
 * `validate` proves every check: it must pass on the task's reference answer
 * and fail on an empty script. `run` gives each task to a coding agent in a
 * fresh Godot project of its own (Claude Code headless or the Codex CLI,
 * allowed to read and write files only), runs the check headless at a fixed
 * 60 frames per second, and, when it fails, gives the agent the check's output
 * once to fix it. Results go to results/<agent>-<model>-<day>.json: pass on the
 * first try, pass after one fix, Godot's output verbatim, the code, and the
 * time taken.
 */
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TASKS } from './tasks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(HERE, 'results');
const WORK = path.join(os.tmpdir(), 'godot-llm-bench');

const PROJECT = 'config_version=5\n\n[application]\n\nconfig/name="Godot bench"\n';
const CHECK_SCENE =
  '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://bench_check.gd" id="1"]\n\n[node name="Check" type="Node2D"]\nscript = ExtResource("1")\n';

/** Lines Godot prints at exit about leaked objects, which say nothing about the task. */
const EXIT_REPORT = /^(?:WARNING|ERROR): .*(?:leaked at exit|ObjectDB instances leaked|still in use at exit)/u;

function godotBinary(argv) {
  const index = argv.indexOf('--godot');
  const godot = index >= 0 ? argv[index + 1] : process.env.GODOT;
  if (!godot || !existsSync(godot)) {
    throw new Error('Set GODOT (or pass --godot) to a Godot 4 console binary.');
  }
  return godot;
}

function freshProject(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'project.godot'), PROJECT);
}

function cleanOutput(raw) {
  return raw
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function judgedOutput(output) {
  return output
    .split('\n')
    .filter((line) => !EXIT_REPORT.test(line))
    .join('\n');
}

function engineVersion(output) {
  return /Godot Engine v(\S+)/u.exec(output)?.[1] || null;
}

/** Runs the task's check in the project and returns { pass, problem, output }. */
function runCheck(godot, dir, task) {
  writeFileSync(path.join(dir, 'bench_check.gd'), task.check);
  writeFileSync(path.join(dir, 'bench_check.tscn'), CHECK_SCENE);
  const log = path.join(dir, 'bench_check.out.txt');
  const fd = openSync(log, 'w');
  spawnSync(godot, ['--headless', '--fixed-fps', '60', '--path', dir, 'res://bench_check.tscn', '--quit-after', '600'], {
    stdio: ['ignore', fd, fd],
    timeout: 120_000,
    windowsHide: true,
  });
  closeSync(fd);
  const output = cleanOutput(readFileSync(log, 'utf8')).split(dir.replace(/\\/gu, '/')).join('<project>');
  const judged = judgedOutput(output);
  const pass = /^BENCH PASS$/mu.test(judged) && !/SCRIPT ERROR|Parse Error/u.test(judged);
  const problem = pass ? '' : (/BENCH FAIL: .*/u.exec(judged)?.[0] || /^(?:SCRIPT ERROR|ERROR): .*/mu.exec(judged)?.[0] || 'the check did not finish within 10 s of game time (600 frames)');
  return { pass, problem, output };
}

function validate(argv) {
  const godot = godotBinary(argv);
  let bad = 0;
  for (const task of TASKS) {
    const dir = path.join(WORK, 'validate', task.id);
    freshProject(dir);
    writeFileSync(path.join(dir, task.file), task.reference);
    const good = runCheck(godot, dir, task);
    writeFileSync(path.join(dir, task.file), 'extends Node\n');
    const empty = runCheck(godot, dir, task);
    const ok = good.pass && !empty.pass;
    if (!ok) bad += 1;
    process.stdout.write(`${ok ? 'ok  ' : 'BAD '} ${task.id}: reference ${good.pass ? 'passes' : `fails (${good.problem})`}, empty ${empty.pass ? 'PASSES' : 'fails'}\n`);
    if (!good.pass) process.stdout.write(`${good.output}\n`);
  }
  return bad ? 1 : 0;
}

/**
 * How to save the file, named on disk. The current folder is the project root,
 * which Godot calls res://; a model once read res:// as a folder name and saved
 * res/score_label.gd, which tests path handling rather than Godot.
 */
const rules = (task) =>
  `Save it as ./${task.file}, directly in the current folder: the current folder is the Godot 4 project root, which Godot calls res://, so res://${task.file} is the file ./${task.file}. Do not create a folder named res, other files, scenes or project settings, and do not run anything. Reply with one line when done.`;

function askClaude(model, prompt, dir) {
  const started = Date.now();
  const result = spawnSync(
    process.env.CLAUDE_BIN || 'claude',
    ['-p', '--model', model, '--permission-mode', 'acceptEdits', '--allowedTools=Write,Edit,Read'],
    // The prompt goes on stdin: --allowedTools takes several values and would swallow it as one.
    { cwd: dir, input: prompt, encoding: 'utf8', timeout: 600_000, windowsHide: true },
  );
  // A call that failed is the harness's fault, not the model's: stop rather than score it.
  if (result.error || result.status !== 0) {
    throw new Error(`claude -p failed (exit ${result.status}): ${result.error?.message || ''}${result.stderr || result.stdout || ''}`.slice(0, 600));
  }
  return { seconds: Math.round((Date.now() - started) / 1000) };
}

/** The Codex CLI with every MCP server switched off, so the agent only edits files in its own folder. */
function askCodex(model, prompt, dir) {
  const started = Date.now();
  const result = spawnSync(
    process.env.CODEX_BIN || 'codex',
    ['exec', '--json', '--skip-git-repo-check', '-c', 'mcp_servers={}', '-m', model, '-C', dir, prompt],
    { cwd: dir, encoding: 'utf8', timeout: 900_000, windowsHide: true },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`codex exec failed (exit ${result.status}): ${result.error?.message || ''}${result.stderr || ''}`.slice(0, 600));
  }
  if (/mcp_tool_call/u.test(result.stdout || '')) throw new Error('codex called an MCP tool in a bench run');
  return { seconds: Math.round((Date.now() - started) / 1000) };
}

function run(argv) {
  const flag = (name, fallback) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : fallback;
  };
  const agent = flag('--agent', 'claude');
  const model = flag('--model', 'claude-opus-5-5');
  if (!['claude', 'codex'].includes(agent)) throw new Error(`agent ${agent} is not wired; claude or codex`);
  const ask = agent === 'codex' ? askCodex : askClaude;
  const only = flag('--only', '');
  const tasks = only ? TASKS.filter((task) => only.split(',').includes(task.id)) : TASKS;
  const godot = godotBinary(argv);
  const results = [];
  for (const task of tasks) {
    const dir = path.join(WORK, `${agent}-${model}`, task.id);
    freshProject(dir);
    const first = ask(model, `${task.prompt} ${rules(task)}`, dir);
    const written = () => (existsSync(path.join(dir, task.file)) ? readFileSync(path.join(dir, task.file), 'utf8') : null);
    const firstCode = written();
    const firstCheck = firstCode === null ? { pass: false, problem: `${task.file} was not written`, output: '' } : runCheck(godot, dir, task);
    let fix = null;
    if (!firstCheck.pass) {
      const feedback = `${task.prompt} Your res://${task.file} was run headless on Godot ${engineVersion(firstCheck.output) || '4'} by a test and failed. The test printed:\n\n${firstCheck.output.slice(0, 3000)}\n\nFix res://${task.file}. ${rules(task)}`;
      const second = ask(model, feedback, dir);
      const fixCheck = written() === null ? { pass: false, problem: `${task.file} was not written`, output: '' } : runCheck(godot, dir, task);
      fix = { seconds: second.seconds, pass: fixCheck.pass, problem: fixCheck.problem, output: fixCheck.output, code: written() };
    }
    results.push({
      task: task.id,
      title: task.title,
      first: { seconds: first.seconds, pass: firstCheck.pass, problem: firstCheck.problem, output: firstCheck.output, code: firstCode },
      fix,
    });
    process.stdout.write(`${task.id}: first ${firstCheck.pass ? 'PASS' : `fail (${firstCheck.problem})`}${fix ? `, after one fix ${fix.pass ? 'PASS' : `fail (${fix.problem})`}` : ''}\n`);
  }
  const day = new Date().toISOString().slice(0, 10);
  const engine = engineVersion(results.find((row) => row.first.output)?.first.output || '') || null;
  mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, `${agent}-${model}-${day}.json`);
  const summary = {
    agent,
    model,
    day,
    engine,
    tasks: results.length,
    firstTry: results.filter((row) => row.first.pass).length,
    afterOneFix: results.filter((row) => row.first.pass || row.fix?.pass).length,
  };
  writeFileSync(file, `${JSON.stringify({ ...summary, results }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary)}\n${path.relative(HERE, file)}\n`);
  return 0;
}

function main(argv) {
  if (argv[0] === 'validate') return validate(argv.slice(1));
  if (argv[0] === 'run') return run(argv.slice(1));
  process.stderr.write('usage: bench.mjs validate | run --agent claude|codex --model <model> [--only a,b] [--godot <path>]\n');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
