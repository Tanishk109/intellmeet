import Task from "../models/Task.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

const STATUSES = ["todo", "in_progress", "done"];

// GET /api/tasks -> all tasks for the current user, grouped by column.
export const listTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ owner: req.user._id }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, tasks: tasks.map((t) => t.toPublic()) });
});

// POST /api/tasks
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, priority, assignee, status, fromMeeting } = req.body;
  if (!title?.trim()) throw new ApiError(400, "Task title is required");
  const col = STATUSES.includes(status) ? status : "todo";

  // Place new card at the end of its column.
  const last = await Task.findOne({ owner: req.user._id, status: col }).sort({ order: -1 });
  const order = last ? last.order + 1 : 0;

  const task = await Task.create({
    owner: req.user._id,
    title,
    description,
    priority,
    assignee,
    status: col,
    order,
    fromMeeting: fromMeeting || "",
  });
  res.status(201).json({ success: true, task: task.toPublic() });
});

// PUT /api/tasks/:id  -> edit fields
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id });
  if (!task) throw new ApiError(404, "Task not found");
  for (const f of ["title", "description", "priority", "assignee"]) {
    if (f in req.body) task[f] = req.body[f];
  }
  await task.save();
  res.json({ success: true, task: task.toPublic() });
});

// PATCH /api/tasks/:id/move  { status, order } -> drag-and-drop reposition
export const moveTask = asyncHandler(async (req, res) => {
  const { status, order } = req.body;
  const task = await Task.findOne({ _id: req.params.id, owner: req.user._id });
  if (!task) throw new ApiError(404, "Task not found");
  if (status && !STATUSES.includes(status)) throw new ApiError(400, "Invalid status");

  if (status) task.status = status;
  if (typeof order === "number") task.order = order;
  await task.save();
  res.json({ success: true, task: task.toPublic() });
});

// DELETE /api/tasks/:id
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!task) throw new ApiError(404, "Task not found");
  res.json({ success: true, message: "Task deleted" });
});
