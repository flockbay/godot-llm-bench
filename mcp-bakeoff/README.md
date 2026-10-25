# Godot MCP servers, the same three tasks

On 25 October 2026 we gave four Godot MCP servers the same three tasks and
judged each result by running it. We make Flockbay, one of the four.

| Task | Flockbay | godot-mcp (Coding-Solo) | GoPeak | godot-mcp (satelliteoflove) |
| --- | --- | --- | --- | --- |
| Scene edit | Pass, 12 s | Pass, 28 s | Pass, 20 s | Pass, 29 s |
| Fix and run | Pass, 21 s | Pass, 18 s | Pass, 24 s | Pass, 19 s |
| Read errors | Pass, 25 s | Pass, 13 s | Pass, 16 s | Pass, 37 s |
| Calls to the server, per task | 3, 3, 1 | 1, 6, 3 | 1, 6, 3 | 3, 8, 5 |

Every server passed every task, and the times are within seconds of each
other. On these basics they are equal. Choose between them on what else your
agent needs: pictures of the game, input, the editor you already use, price.

## Method

- **Client:** Claude Code 2.1.286, headless (`claude -p`), on Claude Sonnet
  5.5 (`claude-sonnet-5-5`). Bash, PowerShell, WebFetch, WebSearch and Task were
  disallowed, so running and reading the game could only go through the server.
  It could read and write files. The transcripts show the shell attempts it
  made being refused.
- **Engine:** Godot 4.7.2, the build the Flockbay app ships.
- **Projects:** each run started from a fresh Godot 4 project holding only the
  task's files (`tasks.json`).
- **Judging:** a check scene ran headless at a fixed 60 frames per second and
  printed `BENCH PASS` or `BENCH FAIL`. The read-errors task was judged on the
  answer, and on no file changing. Each check passes on the task's reference
  and fails on the untouched fixture.
- **Servers,** configured as their READMEs say and pointed at the same Godot:
  - Flockbay 3.4.0, through the app's Connect your agent line. The app opened
    each fixture with its `--open-game` launch.
  - [godot-mcp (Coding-Solo)](https://github.com/Coding-Solo/godot-mcp) 0.1.1:
    `npx -y @coding-solo/godot-mcp`.
  - [GoPeak](https://github.com/HaD0Yun/Gopeak-godot-mcp) 2.3.8:
    `npx -y gopeak`, with `GOPEAK_TOOL_PROFILE=compact`.
  - [godot-mcp (satelliteoflove)](https://github.com/satelliteoflove/godot-mcp)
    4.1.11: its add-on was installed with its own `--install-addon` command and
    enabled, and a Godot editor ran on the project.
- **Runs:** one per task per server.
- **Times:** the client's wall-clock time.
- **Calls to the server:** tool calls into that server's namespace.

## The tasks

1. **Scene edit.** Add a Label named ScoreLabel, with text "Score: 0" at
   (16, 16), to `res://main.tscn`, and save it.
2. **Fix and run.** The game fails because `res://player.gd` is Godot 3 code.
   Run it, read the errors, fix the script so the player moves right at 200
   px/s while `ui_right` is held, and run it again.
3. **Read errors.** Run the game for about three seconds. Report the runtime
   error's text, file and line (`main.gd:13`, a call on a Nil base). Change no
   file.

## Not run

- **godot-ai:** v4 needs `uv` and the attach command its editor dock writes.
- **GDAI MCP and Godot MCP Pro:** paid.
- **Summer Engine and Ziva:** they need their own apps.

## Files

- `tasks.json`: each task's prompt, files, reference and check.
- `runs/2026-10-25/<server>--<task>.json`: the result of each run.
- `runs/2026-10-25/<server>--<task>.jsonl`: Claude Code's full stream for the
  run. The machine's user name, home folder and unrelated project names are
  replaced with placeholders.
