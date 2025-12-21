import { Router } from "express";
import { adminStats, categoryAdminStats, userStats } from "./stats.controller";
import { authorizeRole, isAuthenticated } from "../../middleware/auth.middleware";


const router = Router();

// 1. user stats
router.get("/user-stats", isAuthenticated, userStats);

// 2. super-admin stats
router.get("/admin-stats", isAuthenticated, authorizeRole("super-admin"), adminStats);

// 3. category-admin stats
router.get("/category-admin-stats", isAuthenticated, authorizeRole("category-admin"), categoryAdminStats);

export default router;