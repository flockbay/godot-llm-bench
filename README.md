# Godot LLM Bench

Can a model write working Godot 4 code? Fifteen GDScript tasks, each judged by
running it headless on the official Godot engine, not by reading it.

Most models learned Godot from years of Godot 3 tutorials. Ask for a jump
script and you can get a `KinematicBody2D`, a `move_and_slide()` called with
arguments, or `export var` without the `@`, and Godot 4 rejects all three. Every
task here touches an API that changed between Godot 3 and 4: `move_and_slide`
and `is_on_floor`, `Label` text, `FileAccess` and `JSON`, signals, tweens,
`Timer` nodes, `PackedScene`, `TileMapLayer`, ray queries, `AStarGrid2D`,
`AnimationLibrary`, and lambdas that capture locals by value.

## Results

Godot 4.7.2 (official), 6 October 2026. One run per model.

| Model | Agent | First try | After one fix | Median seconds per task |
| --- | --- | ---: | ---: | ---: |
| Claude Opus 5.5 | Claude Code | 15 / 15 | 15 / 15 | 8 |
| Claude Sonnet 5.5 | Claude Code | 15 / 15 | 15 / 15 | 8 |
| GPT-6.1 Sol | Codex | 15 / 15 | 15 / 15 | 10 |
| Claude Haiku 4.5 | Claude Code | 11 / 15 | 14 / 15 | 14 |

Claude Haiku 4.5 missed `health-signals`, `grid-path`, `animation-code` and
`signal-or-timeout` on the first try, fixed the first three after seeing
Godot's output once, and did not fix `signal-or-timeout`. Every result file in
[`results/`](results/) carries each task's code, Godot's output verbatim and
the time taken. Seconds are the agent's wall-clock time, start-up included.

Three models at 15 of 15 says these tasks are now the floor, not the ceiling.

## The same tasks across 28 models

The same 15 tasks were then run across 28 models, through coding agents and straight through each provider's API. Twelve passed all 15 on the first try, among them three of the five cheapest hosted models measured. Every model's row is at https://flockbay.com/blog/best-ai-for-godot/.
Longer game-level head-to-heads (a physics truck, the door problem, a
six-legged walker, save and load, a rigged character) and which model to pick
for which job are in the write-up:
[the best LLM for Godot](https://flockbay.com/blog/best-llm-for-godot/).

## The tasks

| Id | Task |
| --- | --- |
| `move` | Move a CharacterBody2D with an input action |
| `gravity` | Fall with gravity and land on the floor |
| `score-label` | A score label |
| `save-load` | Save and load a dictionary as JSON |
| `health-signals` | Health with signals |
| `fade-tween` | Fade out with a tween |
| `spawn-timer` | Spawn on a timer, then stop |
| `door-states` | A door with states |
| `inventory` | An inventory with counts |
| `load-level` | Load a level scene from a path |
| `tilemap-layer` | Paint cells on a TileMapLayer |
| `ray-query` | Cast a physics ray |
| `grid-path` | A path on a grid around walls |
| `animation-code` | Build and play an animation in code |
| `signal-or-timeout` | Wait for a signal or a timeout |

## How a task is judged

Each task asks for one script at a fixed `res://` path with a stated API. The
agent works in a fresh Godot project of its own and may only read and write
files. A check scene then loads the script, drives it headless at a fixed 60
frames per second, and prints `BENCH PASS` or `BENCH FAIL: <why>` before it
quits. A parse error or a script error is a fail. When the first try fails,
the agent gets Godot's output once and one chance to fix the script.

Every check must pass on its reference answer and fail on an empty script
before a model's result on it means anything:

```sh
GODOT=/path/to/Godot_v4.7.2-stable_linux.x86_64 node bench.mjs validate
```

## Run it

You need Node 18 or newer, a Godot 4 console binary, and Claude Code or the
Codex CLI signed in.

```sh
GODOT=/path/to/godot node bench.mjs run --agent claude --model claude-opus-5-5
GODOT=/path/to/godot node bench.mjs run --agent codex --model gpt-6.1-sol
GODOT=/path/to/godot node bench.mjs run --agent claude --model claude-sonnet-5-5 --only move,gravity
```

On Windows, `GODOT` is the `*_console.exe` build, and `CLAUDE_BIN` or
`CODEX_BIN` can point at the agent's `.exe` if it is not on `PATH`. The Codex
run switches off every MCP server, so the agent only edits files in its own
folder. Results land in `results/<agent>-<model>-<day>.json`.

New results and new tasks are welcome as pull requests. A new task needs a
prompt, a check that prints `BENCH PASS` or `BENCH FAIL`, and a reference
answer that passes `validate`.

## About

Made by [Flockbay](https://flockbay.com), a free AI game maker built on Godot,
to measure the models its users bring. MIT licensed.

## Related

- [The best Godot MCP server, compared](https://flockbay.com/blog/best-godot-mcp-server/)
- [The best AI for Godot: 28 models on 15 Godot 4 tasks](https://flockbay.com/blog/best-ai-for-godot/)
