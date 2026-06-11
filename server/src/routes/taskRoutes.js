import { Router } from "express";
import {
  listTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
} from "../controllers/taskController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.route("/").get(listTasks).post(createTask);
router.route("/:id").put(updateTask).delete(deleteTask);
router.patch("/:id/move", moveTask);

export default router;
