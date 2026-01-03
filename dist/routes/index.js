"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_routes_1 = require("../modules/users/user.routes");
const stats_routes_1 = require("../modules/stats/stats.routes");
const issue_routes_1 = require("../modules/issues/issue.routes");
const review_routes_1 = require("../modules/comments/review.routes");
const message_routes_1 = require("../modules/message/message.routes");
const router = (0, express_1.Router)();
// Routes for handling module-related operations
const moduleRoutes = [
    {
        path: '/auth',
        route: user_routes_1.authRoutes, // Route for handling authentication-related operations
    },
    {
        path: '/issues',
        route: issue_routes_1.issueRoutes, // Route for handling user-related operations
    },
    {
        path: '/reviews',
        route: review_routes_1.reviewRoutes, // Route for handling product-related operations
    },
    {
        path: '/messages',
        route: message_routes_1.messageRoutes, // Route for handling product-related operations
    },
    {
        path: '/stats',
        route: stats_routes_1.statsRoutes, // Route for handling review-related operations
    },
];
// Add routes to the router
moduleRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
//# sourceMappingURL=index.js.map