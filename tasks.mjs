/**
 * The fifteen Godot 4 tasks a model is measured on, each with the check that judges
 * it and a reference answer that proves the check can pass.
 *
 * A task asks for one script at a fixed res:// path with a stated API. The
 * check is a scene script that loads it, drives it headless at a fixed 60
 * frames per second, and prints `BENCH PASS` or `BENCH FAIL: <why>` before
 * quitting. Each touches an API that changed between Godot 3 and 4, where a
 * model writing from memory goes wrong: move_and_slide, is_on_floor, Label
 * text, FileAccess and JSON, signals, tweens, Timer nodes, PackedScene,
 * TileMapLayer, ray queries, AStarGrid2D, AnimationLibrary, and lambdas that
 * capture locals by value.
 *
 * Every check must pass on its `reference` and fail on an empty script
 * (`node bench.mjs validate`) before a model's
 * result on it means anything.
 */

const waitFrames = (n) => `for i in ${n}:\n\t\tawait get_tree().physics_frame`;

export const TASKS = [
  {
    id: 'move',
    title: 'Move a CharacterBody2D with an input action',
    file: 'player.gd',
    prompt:
      'Write res://player.gd for Godot 4: a script for a CharacterBody2D that moves right at 200 pixels per second while the input action "ui_right" is held, and stands still otherwise.',
    reference: `extends CharacterBody2D

const SPEED := 200.0

func _physics_process(_delta: float) -> void:
	velocity.x = SPEED if Input.is_action_pressed("ui_right") else 0.0
	move_and_slide()
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://player.gd")
	if script == null:
		_done("player.gd did not load")
		return
	var body := CharacterBody2D.new()
	body.set_script(script)
	add_child(body)
	Input.action_press("ui_right")
	${waitFrames(30)}
	Input.action_release("ui_right")
	var moved: float = body.position.x
	${waitFrames(10)}
	if moved < 90.0 or moved > 110.0:
		_done("after 0.5 s holding ui_right x is %.1f, expected about 100" % moved)
	elif absf(body.position.x - moved) > 1.0:
		_done("kept moving after ui_right was released")
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'gravity',
    title: 'Fall with gravity and land on the floor',
    file: 'ball.gd',
    prompt:
      'Write res://ball.gd for Godot 4: a script for a CharacterBody2D that falls with a gravity of 980 pixels per second squared and stops when it lands on the floor. The scene gives it its collision shape.',
    reference: `extends CharacterBody2D

const GRAVITY := 980.0

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += GRAVITY * delta
	move_and_slide()
`,
    check: `extends Node2D

func _ready() -> void:
	var script = load("res://ball.gd")
	if script == null:
		_done("ball.gd did not load")
		return
	var floor_body := StaticBody2D.new()
	var floor_shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(1000, 20)
	floor_shape.shape = rect
	floor_body.add_child(floor_shape)
	floor_body.position = Vector2(0, 200)
	add_child(floor_body)
	var ball := CharacterBody2D.new()
	var ball_shape := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 10
	ball_shape.shape = circle
	ball.add_child(ball_shape)
	ball.set_script(script)
	add_child(ball)
	${waitFrames(120)}
	if not ball.is_on_floor():
		_done("not on the floor after 2 s; y is %.1f" % ball.position.y)
	elif ball.position.y < 170.0 or ball.position.y > 191.0:
		_done("rests at y %.1f, expected about 180" % ball.position.y)
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'score-label',
    title: 'A score label',
    file: 'score_label.gd',
    prompt:
      'Write res://score_label.gd for Godot 4: a script for a Label that shows "Score: 0" when it enters the scene, and has a method add(points: int) that adds to the score and updates the text to "Score: <total>".',
    reference: `extends Label

var score := 0

func _ready() -> void:
	text = "Score: 0"

func add(points: int) -> void:
	score += points
	text = "Score: %d" % score
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://score_label.gd")
	if script == null:
		_done("score_label.gd did not load")
		return
	var label := Label.new()
	label.set_script(script)
	add_child(label)
	if label.text != "Score: 0":
		_done("starts as %s" % label.text)
		return
	label.add(3)
	label.add(4)
	_done("" if label.text == "Score: 7" else "after add(3) and add(4) shows %s" % label.text)

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'save-load',
    title: 'Save and load a dictionary as JSON',
    file: 'save_game.gd',
    prompt:
      'Write res://save_game.gd for Godot 4: a script extending RefCounted with two static functions: save_data(data: Dictionary, path: String) -> void writes the dictionary to the file as JSON, and load_data(path: String) -> Dictionary reads it back.',
    reference: `extends RefCounted

static func save_data(data: Dictionary, path: String) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(data))

static func load_data(path: String) -> Dictionary:
	var file := FileAccess.open(path, FileAccess.READ)
	return JSON.parse_string(file.get_as_text())
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://save_game.gd")
	if script == null:
		_done("save_game.gd did not load")
		return
	var path := "user://bench_save.json"
	script.save_data({"level": 3, "name": "Ada", "items": ["key", "map"]}, path)
	var back = script.load_data(path)
	if typeof(back) != TYPE_DICTIONARY:
		_done("load_data returned %s" % type_string(typeof(back)))
	elif int(back.get("level", -1)) != 3 or back.get("name") != "Ada" or back.get("items") != ["key", "map"]:
		_done("read back %s" % str(back))
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'health-signals',
    title: 'Health with signals',
    file: 'health.gd',
    prompt:
      'Write res://health.gd for Godot 4: a script extending Node with health starting at 100, a signal health_changed(old_value: int, new_value: int), a signal died, and a method take_damage(amount: int) that lowers health without going below 0, emits health_changed when health changes, and emits died once, when health reaches 0.',
    reference: `extends Node

signal health_changed(old_value: int, new_value: int)
signal died

var health := 100

func take_damage(amount: int) -> void:
	if health == 0:
		return
	var old := health
	health = max(health - amount, 0)
	health_changed.emit(old, health)
	if health == 0:
		died.emit()
`,
    check: `extends Node

var changes: Array = []
var deaths := 0

func _ready() -> void:
	var script = load("res://health.gd")
	if script == null:
		_done("health.gd did not load")
		return
	var health := Node.new()
	health.set_script(script)
	add_child(health)
	health.health_changed.connect(func(old_value, new_value): changes.append([old_value, new_value]))
	health.died.connect(func(): deaths += 1)
	health.take_damage(30)
	health.take_damage(80)
	health.take_damage(10)
	if changes.size() < 2 or changes[0] != [100, 70] or changes[1] != [70, 0]:
		_done("health_changed gave %s" % str(changes))
	elif deaths != 1:
		_done("died emitted %d times" % deaths)
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'fade-tween',
    title: 'Fade out with a tween',
    file: 'fader.gd',
    prompt:
      'Write res://fader.gd for Godot 4: a script extending Node2D with a method fade_out(duration: float) that fades the node\'s modulate alpha from 1 to 0 over duration seconds with a tween, and a signal faded emitted when the fade ends.',
    reference: `extends Node2D

signal faded

func fade_out(duration: float) -> void:
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, duration)
	tween.finished.connect(func(): faded.emit())
`,
    check: `extends Node

var faded_at := -1

func _ready() -> void:
	var script = load("res://fader.gd")
	if script == null:
		_done("fader.gd did not load")
		return
	var fader := Node2D.new()
	fader.set_script(script)
	add_child(fader)
	var start := Engine.get_process_frames()
	fader.faded.connect(func(): faded_at = Engine.get_process_frames() - start)
	fader.fade_out(0.5)
	for i in 60:
		await get_tree().process_frame
		if i == 15 and (fader.modulate.a > 0.75 or fader.modulate.a < 0.25):
			_done("alpha %.2f a quarter of a second in, expected about 0.5" % fader.modulate.a)
			return
	if faded_at < 0:
		_done("faded was not emitted within 1 s")
	elif absi(faded_at - 30) > 3:
		_done("faded emitted after %d frames, expected about 30" % faded_at)
	elif fader.modulate.a > 0.01:
		_done("alpha ends at %.2f" % fader.modulate.a)
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'spawn-timer',
    title: 'Spawn on a timer, then stop',
    file: 'spawner.gd',
    prompt:
      'Write res://spawner.gd for Godot 4: a script extending Node that, once in the scene, adds a new child Node2D every 0.25 seconds, using a Timer, and stops after 4 children. It keeps the number spawned in a variable spawned_count.',
    reference: `extends Node

var spawned_count := 0
var _timer := Timer.new()

func _ready() -> void:
	_timer.wait_time = 0.25
	_timer.timeout.connect(_spawn)
	add_child(_timer)
	_timer.start()

func _spawn() -> void:
	add_child(Node2D.new())
	spawned_count += 1
	if spawned_count >= 4:
		_timer.stop()
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://spawner.gd")
	if script == null:
		_done("spawner.gd did not load")
		return
	var spawner := Node.new()
	spawner.set_script(script)
	add_child(spawner)
	for i in 40:
		await get_tree().process_frame
	var early: int = spawner.spawned_count
	for i in 80:
		await get_tree().process_frame
	var spawned := 0
	for child in spawner.get_children():
		if child is Node2D:
			spawned += 1
	if early < 2 or early > 3:
		_done("%d spawned after 0.67 s, expected 2" % early)
	elif spawner.spawned_count != 4 or spawned != 4:
		_done("spawned_count %d and %d Node2D children after 2 s, expected 4" % [spawner.spawned_count, spawned])
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'door-states',
    title: 'A door with states',
    file: 'door.gd',
    prompt:
      'Write res://door.gd for Godot 4: a script extending Node for a door with the states CLOSED, OPENING and OPEN. It starts CLOSED. A method interact() starts opening a closed door; 0.5 seconds of game time later it is OPEN. A method get_state_name() -> String returns "CLOSED", "OPENING" or "OPEN".',
    reference: `extends Node

enum State { CLOSED, OPENING, OPEN }

var state := State.CLOSED
var _opening_time := 0.0

func interact() -> void:
	if state == State.CLOSED:
		state = State.OPENING
		_opening_time = 0.0

func _process(delta: float) -> void:
	if state == State.OPENING:
		_opening_time += delta
		if _opening_time >= 0.5:
			state = State.OPEN

func get_state_name() -> String:
	return State.keys()[state]
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://door.gd")
	if script == null:
		_done("door.gd did not load")
		return
	var door := Node.new()
	door.set_script(script)
	add_child(door)
	if door.get_state_name() != "CLOSED":
		_done("starts %s" % door.get_state_name())
		return
	door.interact()
	for i in 10:
		await get_tree().process_frame
	if door.get_state_name() != "OPENING":
		_done("%s a sixth of a second after interact()" % door.get_state_name())
		return
	for i in 30:
		await get_tree().process_frame
	_done("" if door.get_state_name() == "OPEN" else "%s after 0.67 s" % door.get_state_name())

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'inventory',
    title: 'An inventory with counts',
    file: 'inventory.gd',
    prompt:
      'Write res://inventory.gd for Godot 4: a script extending RefCounted with add_item(item_name: String, count: int), remove_item(item_name: String, count: int) -> bool that removes only when there are enough and returns whether it did, and get_count(item_name: String) -> int that is 0 for an item never added.',
    reference: `extends RefCounted

var _items := {}

func add_item(item_name: String, count: int) -> void:
	_items[item_name] = _items.get(item_name, 0) + count

func remove_item(item_name: String, count: int) -> bool:
	if _items.get(item_name, 0) < count:
		return false
	_items[item_name] -= count
	return true

func get_count(item_name: String) -> int:
	return _items.get(item_name, 0)
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://inventory.gd")
	if script == null:
		_done("inventory.gd did not load")
		return
	var inventory = script.new()
	inventory.add_item("potion", 3)
	inventory.add_item("potion", 2)
	var removed_too_many: bool = inventory.remove_item("potion", 9)
	var removed_two: bool = inventory.remove_item("potion", 2)
	if removed_too_many:
		_done("removed 9 potions out of 5")
	elif not removed_two:
		_done("could not remove 2 potions out of 5")
	elif inventory.get_count("potion") != 3:
		_done("%d potions left, expected 3" % inventory.get_count("potion"))
	elif inventory.get_count("sword") != 0:
		_done("an item never added counts %d" % inventory.get_count("sword"))
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'load-level',
    title: 'Load a level scene from a path',
    file: 'level_loader.gd',
    prompt:
      'Write res://level_loader.gd for Godot 4: a script extending Node with a method load_level(path: String) -> Node that loads the scene file at path, creates an instance of it, adds it as a child, and returns it.',
    reference: `extends Node

func load_level(path: String) -> Node:
	var scene: PackedScene = load(path)
	var level := scene.instantiate()
	add_child(level)
	return level
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://level_loader.gd")
	if script == null:
		_done("level_loader.gd did not load")
		return
	var root := Node2D.new()
	root.name = "LevelRoot"
	var marker := Node2D.new()
	marker.name = "Spawn"
	root.add_child(marker)
	marker.owner = root
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "user://bench_level.tscn")
	var loader := Node.new()
	loader.set_script(script)
	add_child(loader)
	var level = loader.load_level("user://bench_level.tscn")
	if level == null:
		_done("load_level returned null")
	elif level.name != "LevelRoot" or level.get_parent() != loader:
		_done("returned %s under %s" % [str(level.name), str(level.get_parent())])
	elif level.get_node_or_null("Spawn") == null:
		_done("the level's child Spawn is missing")
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'tilemap-layer',
    title: 'Paint cells on a TileMapLayer',
    file: 'grid_painter.gd',
    prompt:
      'Write res://grid_painter.gd for Godot 4.7: a script extending TileMapLayer with paint_row(y: int, from_x: int, to_x: int) that sets the cells from (from_x, y) to (to_x, y) inclusive to tile source 0, atlas coordinates (0, 0), and is_painted(cell: Vector2i) -> bool that says whether a cell has a tile.',
    reference: `extends TileMapLayer

func paint_row(y: int, from_x: int, to_x: int) -> void:
	for x in range(from_x, to_x + 1):
		set_cell(Vector2i(x, y), 0, Vector2i(0, 0))

func is_painted(cell: Vector2i) -> bool:
	return get_cell_source_id(cell) != -1
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://grid_painter.gd")
	if script == null:
		_done("grid_painter.gd did not load")
		return
	var tile_set := TileSet.new()
	var source := TileSetAtlasSource.new()
	source.texture = ImageTexture.create_from_image(Image.create(16, 16, false, Image.FORMAT_RGBA8))
	source.texture_region_size = Vector2i(16, 16)
	source.create_tile(Vector2i(0, 0))
	tile_set.add_source(source, 0)
	var layer := TileMapLayer.new()
	layer.tile_set = tile_set
	layer.set_script(script)
	add_child(layer)
	layer.paint_row(2, 1, 4)
	var used := layer.get_used_cells()
	if used.size() != 4:
		_done("%d cells used after painting (1..4, 2), expected 4" % used.size())
	elif layer.get_cell_source_id(Vector2i(3, 2)) != 0 or layer.get_cell_atlas_coords(Vector2i(3, 2)) != Vector2i(0, 0):
		_done("cell (3, 2) is source %d, atlas %s" % [layer.get_cell_source_id(Vector2i(3, 2)), str(layer.get_cell_atlas_coords(Vector2i(3, 2)))])
	elif not layer.is_painted(Vector2i(1, 2)) or layer.is_painted(Vector2i(5, 2)):
		_done("is_painted is wrong for (1, 2) or (5, 2)")
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'ray-query',
    title: 'Cast a physics ray',
    file: 'line_of_sight.gd',
    prompt:
      'Write res://line_of_sight.gd for Godot 4: a script extending Node2D with first_hit(from: Vector2, to: Vector2) -> Vector2 that casts a physics ray through the 2D world from `from` to `to` and returns the point where it first hits a collider, or `to` when it hits nothing. It is called from physics processing.',
    reference: `extends Node2D

func first_hit(from: Vector2, to: Vector2) -> Vector2:
	var space := get_world_2d().direct_space_state
	var query := PhysicsRayQueryParameters2D.create(from, to)
	var hit := space.intersect_ray(query)
	return hit.position if hit else to
`,
    check: `extends Node2D

func _ready() -> void:
	var script = load("res://line_of_sight.gd")
	if script == null:
		_done("line_of_sight.gd did not load")
		return
	var wall := StaticBody2D.new()
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(20, 200)
	shape.shape = rect
	wall.add_child(shape)
	wall.position = Vector2(100, 0)
	add_child(wall)
	var eye := Node2D.new()
	eye.set_script(script)
	add_child(eye)
	${waitFrames(3)}
	var hit: Vector2 = eye.first_hit(Vector2(0, 0), Vector2(300, 0))
	var miss: Vector2 = eye.first_hit(Vector2(0, 500), Vector2(300, 500))
	if absf(hit.x - 90.0) > 1.0 or absf(hit.y) > 1.0:
		_done("a ray at the wall returned %s, expected (90, 0)" % str(hit))
	elif miss.distance_to(Vector2(300, 500)) > 0.5:
		_done("a ray past the wall returned %s, expected (300, 500)" % str(miss))
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'grid-path',
    title: 'A path on a grid around walls',
    file: 'path_finder.gd',
    prompt:
      'Write res://path_finder.gd for Godot 4: a script extending RefCounted with find_path(size: Vector2i, walls: Array[Vector2i], from: Vector2i, to: Vector2i) -> Array[Vector2i] that returns the shortest path of grid cells from `from` to `to`, both included, on a grid of `size` cells, never entering a wall cell and moving only up, down, left or right.',
    reference: `extends RefCounted

func find_path(size: Vector2i, walls: Array[Vector2i], from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var grid := AStarGrid2D.new()
	grid.region = Rect2i(Vector2i.ZERO, size)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_NEVER
	grid.update()
	for wall in walls:
		grid.set_point_solid(wall)
	return grid.get_id_path(from, to)
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://path_finder.gd")
	if script == null:
		_done("path_finder.gd did not load")
		return
	var walls: Array[Vector2i] = [Vector2i(2, 0), Vector2i(2, 1), Vector2i(2, 2), Vector2i(2, 3)]
	var path = script.new().find_path(Vector2i(5, 5), walls, Vector2i(0, 0), Vector2i(4, 0))
	if path == null or path.size() == 0:
		_done("no path returned")
		return
	if Vector2i(path[0]) != Vector2i(0, 0) or Vector2i(path[path.size() - 1]) != Vector2i(4, 0):
		_done("path runs %s to %s" % [str(path[0]), str(path[path.size() - 1])])
		return
	for i in path.size():
		if walls.has(Vector2i(path[i])):
			_done("path enters the wall at %s" % str(path[i]))
			return
		if i > 0:
			var step := Vector2i(path[i]) - Vector2i(path[i - 1])
			if absi(step.x) + absi(step.y) != 1:
				_done("step %s to %s is not one cell up, down, left or right" % [str(path[i - 1]), str(path[i])])
				return
	_done("" if path.size() == 13 else "%d cells, the shortest is 13" % path.size())

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'animation-code',
    title: 'Build and play an animation in code',
    file: 'blinker.gd',
    prompt:
      'Write res://blinker.gd for Godot 4: a script extending Node2D that, when it enters the scene, creates an AnimationPlayer child and a looping animation named "blink", 1 second long, that keeps the node visible for the first half of each second and hidden for the second half, and plays it.',
    reference: `extends Node2D

func _ready() -> void:
	var animation := Animation.new()
	animation.length = 1.0
	animation.loop_mode = Animation.LOOP_LINEAR
	var track := animation.add_track(Animation.TYPE_VALUE)
	animation.track_set_path(track, NodePath(".:visible"))
	animation.value_track_set_update_mode(track, Animation.UPDATE_DISCRETE)
	animation.track_insert_key(track, 0.0, true)
	animation.track_insert_key(track, 0.5, false)
	var library := AnimationLibrary.new()
	library.add_animation("blink", animation)
	var player := AnimationPlayer.new()
	add_child(player)
	player.add_animation_library("", library)
	player.play("blink")
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://blinker.gd")
	if script == null:
		_done("blinker.gd did not load")
		return
	var blinker := Node2D.new()
	blinker.set_script(script)
	add_child(blinker)
	var seen := []
	for frame in [15, 45, 75, 105]:
		while Engine.get_process_frames() < frame:
			await get_tree().process_frame
		seen.append(blinker.visible)
	_done("" if seen == [true, false, true, false] else "visible at 0.25, 0.75, 1.25 and 1.75 s was %s, expected [true, false, true, false]" % str(seen))

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
  {
    id: 'signal-or-timeout',
    title: 'Wait for a signal or a timeout',
    file: 'waiter.gd',
    prompt:
      'Write res://waiter.gd for Godot 4: a script extending Node with wait_for(sig: Signal, seconds: float) -> bool, a coroutine that waits until the signal is emitted or `seconds` of game time pass, whichever comes first, and returns true if the signal came first. The signal has no arguments.',
    reference: `extends Node

func wait_for(sig: Signal, seconds: float) -> bool:
	var state := {"fired": false}
	var on_signal := func(): state.fired = true
	sig.connect(on_signal, CONNECT_ONE_SHOT)
	var timer := get_tree().create_timer(seconds)
	while not state.fired and timer.time_left > 0.0:
		await get_tree().process_frame
	if sig.is_connected(on_signal):
		sig.disconnect(on_signal)
	return state.fired
`,
    check: `extends Node

func _ready() -> void:
	var script = load("res://waiter.gd")
	if script == null:
		_done("waiter.gd did not load")
		return
	var waiter := Node.new()
	waiter.set_script(script)
	add_child(waiter)
	var quick := get_tree().create_timer(0.2)
	var start := Engine.get_process_frames()
	var got_quick: bool = await waiter.wait_for(quick.timeout, 1.0)
	var quick_frames := Engine.get_process_frames() - start
	var slow := get_tree().create_timer(3.0)
	start = Engine.get_process_frames()
	var got_slow: bool = await waiter.wait_for(slow.timeout, 0.5)
	var slow_frames := Engine.get_process_frames() - start
	if not got_quick:
		_done("returned false for a signal 0.2 s away with a 1 s timeout")
	elif quick_frames > 16:
		_done("took %d frames for a signal 0.2 s away" % quick_frames)
	elif got_slow:
		_done("returned true for a signal 3 s away with a 0.5 s timeout")
	elif slow_frames < 27 or slow_frames > 34:
		_done("timed out after %d frames, expected about 30" % slow_frames)
	else:
		_done("")

func _done(problem: String) -> void:
	print("BENCH PASS" if problem == "" else "BENCH FAIL: " + problem)
	get_tree().quit()
`,
  },
];
