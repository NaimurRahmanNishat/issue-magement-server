"use strict";
// src/modules/users/user.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const multer_1 = require("../../middleware/multer");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const router = (0, express_1.Router)();
// ==================== Public Routes ====================
// 1. Register (public for regular users, authenticated for category-admin creation)
router.post("/register", (0, validate_middleware_1.validate)(user_validation_1.registerUserSchema), auth_middleware_1.optionalAuth, user_controller_1.register);
// 2. Activate user account
router.post("/activate-user", (0, validate_middleware_1.validate)(user_validation_1.activateUserSchema), user_controller_1.activateUser);
// 3. Login
router.post("/login", rateLimiter_1.authLimiter, (0, validate_middleware_1.validate)(user_validation_1.loginUserSchema), user_controller_1.login);
// 4. Forgot password (send OTP)
router.post("/forgot-password", user_controller_1.forgetPassword);
// 5. Reset password (verify OTP and set new password)
router.post("/reset-password", user_controller_1.resetPassword);
// ==================== Protected Routes ====================
// 6. Refresh access token
router.post("/refresh-token", user_controller_1.refreshToken);
// 7. Logout (requires authentication)
router.post("/logout", auth_middleware_1.isAuthenticated, user_controller_1.logout);
// 8. Edit profile 
router.put("/edit-profile", auth_middleware_1.isAuthenticated, multer_1.upload.fields([{ name: "avatar", maxCount: 1 }, { name: "nidPic", maxCount: 2 }]), user_controller_1.editProfileById);
// 9. Get own profile 
router.get("/me", auth_middleware_1.isAuthenticated, user_controller_1.getProfileById);
// ==================== Admin Routes ====================
// 10. Get all normal users (category-admin & super-admin only)
router.get("/all-users", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin", "category-admin"), user_controller_1.getAllUsers);
// 11. Get all category admins (super-admin only)
router.get("/all-category-admins", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.getAllCategoryAdmins);
// 12. Update category admin role (super-admin only)
router.put("/update-category-admin/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.updateCategoryAdminRole);
// 13. Delete category admin (super-admin only)
router.delete("/delete-category-admin/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.deleteCategoryAdminRole);
exports.authRoutes = router;
//# sourceMappingURL=user.routes.js.map