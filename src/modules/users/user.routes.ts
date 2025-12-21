// src/modules/users/user.routes.ts
import { Router } from "express";
import { activateUser, deleteCategoryAdminRole, editProfileById, forgetPassword, getAllCategoryAdmins, getAllUsers, getProfileById, getSocketToken, login, logout, refreshToken, register, resetPassword, updateCategoryAdminRole } from "./user.controller";
import { activateUserSchema, loginUserSchema, registerUserSchema } from "./user.validation";
import { validate } from "../../middleware/validate.middleware";
import { authorizeRole, isAuthenticated, optionalAuth } from "../../middleware/auth.middleware";
import { uploadImages } from "../../middleware/upload.middleware";


const router = Router();

router.post("/register", validate(registerUserSchema), optionalAuth, register);
router.post("/activate-user", validate(activateUserSchema), activateUser);
router.post("/login", validate(loginUserSchema), login);
router.post("/refresh-token",  refreshToken);
router.post("/logout", isAuthenticated, logout);
router.post("/forgot-password", forgetPassword);
router.post("/reset-password", resetPassword);
router.put("/edit-profile/:id", isAuthenticated, uploadImages.fields([{ name: "avatar", maxCount: 1 }, { name: "nidPic", maxCount: 3 }]), editProfileById);
router.get("/me/:id", isAuthenticated, getProfileById);
router.get("/all-users", isAuthenticated, authorizeRole("super-admin", "category-admin"), getAllUsers);
router.get("/all-category-admins", isAuthenticated, authorizeRole("super-admin"), getAllCategoryAdmins); 
router.put("/update-category-admin/:id", isAuthenticated, authorizeRole("super-admin"), updateCategoryAdminRole);
router.delete("/delete-category-admin/:id", isAuthenticated, authorizeRole("super-admin"), deleteCategoryAdminRole);
router.get("/socket-token", isAuthenticated, getSocketToken);

export default router;