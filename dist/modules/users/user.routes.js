"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/users/user.routes.ts
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const user_validation_1 = require("./user.validation");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.post("/register", (0, validate_middleware_1.validate)(user_validation_1.registerUserSchema), auth_middleware_1.optionalAuth, user_controller_1.register);
router.post("/activate-user", (0, validate_middleware_1.validate)(user_validation_1.activateUserSchema), user_controller_1.activateUser);
router.post("/login", (0, validate_middleware_1.validate)(user_validation_1.loginUserSchema), user_controller_1.login);
router.post("/refresh-token", user_controller_1.refreshToken);
router.post("/logout", auth_middleware_1.isAuthenticated, user_controller_1.logout);
router.post("/forgot-password", user_controller_1.forgetPassword);
router.post("/reset-password", user_controller_1.resetPassword);
router.put("/edit-profile/:id", auth_middleware_1.isAuthenticated, upload_middleware_1.uploadImages.fields([{ name: "avatar", maxCount: 1 }, { name: "nidPic", maxCount: 3 }]), user_controller_1.editProfileById);
router.get("/me/:id", auth_middleware_1.isAuthenticated, user_controller_1.getProfileById);
router.get("/all-users", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin", "category-admin"), user_controller_1.getAllUsers);
router.get("/all-category-admins", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.getAllCategoryAdmins);
router.put("/update-category-admin/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.updateCategoryAdminRole);
router.delete("/delete-category-admin/:id", auth_middleware_1.isAuthenticated, (0, auth_middleware_1.authorizeRole)("super-admin"), user_controller_1.deleteCategoryAdminRole);
router.get("/socket-token", auth_middleware_1.isAuthenticated, user_controller_1.getSocketToken);
exports.default = router;
//# sourceMappingURL=user.routes.js.map