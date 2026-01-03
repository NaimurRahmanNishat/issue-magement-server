// src/modules/users/user.routes.ts

import { Router } from "express";
import { activateUser, deleteCategoryAdminRole, editProfileById, forgetPassword, getAllCategoryAdmins, getAllUsers, getProfileById, login, logout, refreshToken, register, resetPassword, updateCategoryAdminRole } from "./user.controller";
import { activateUserSchema, loginUserSchema, registerUserSchema } from "./user.validation";
import { validate } from "../../middleware/validate.middleware";
import { authorizeRole, isAuthenticated, optionalAuth } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer";


const router = Router();

// ==================== Public Routes ====================

// 1. Register (public for regular users, authenticated for category-admin creation)
router.post("/register", validate(registerUserSchema), optionalAuth, register);

// 2. Activate user account
router.post("/activate-user", validate(activateUserSchema), activateUser);

// 3. Login
router.post("/login", validate(loginUserSchema), login);

// 4. Forgot password (send OTP)
router.post("/forgot-password", forgetPassword);

// 5. Reset password (verify OTP and set new password)
router.post("/reset-password", resetPassword);

// ==================== Protected Routes ====================

// 6. Refresh access token
router.post("/refresh-token", refreshToken);

// 7. Logout (requires authentication)
router.post("/logout", isAuthenticated, logout);

// 8. Edit profile 
router.put( "/edit-profile", isAuthenticated, upload.fields([{ name: "avatar", maxCount: 1 },{ name: "nidPic", maxCount: 2 }]), editProfileById);

// 9. Get own profile 
router.get("/me", isAuthenticated, getProfileById);

// ==================== Admin Routes ====================

// 10. Get all normal users (category-admin & super-admin only)
router.get("/all-users", isAuthenticated, authorizeRole("super-admin", "category-admin"), getAllUsers);

// 11. Get all category admins (super-admin only)
router.get("/all-category-admins", isAuthenticated, authorizeRole("super-admin"), getAllCategoryAdmins);

// 12. Update category admin role (super-admin only)
router.put("/update-category-admin/:id", isAuthenticated, authorizeRole("super-admin"), updateCategoryAdminRole);

// 13. Delete category admin (super-admin only)
router.delete("/delete-category-admin/:id", isAuthenticated, authorizeRole("super-admin"), deleteCategoryAdminRole);

export const authRoutes = router;