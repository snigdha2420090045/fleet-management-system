const express = require("express");
const { body } = require("express-validator");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignCranes,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const validate = require("../middleware/validate");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(protect);

router.get("/", authorize(ROLES.ADMIN, ROLES.MANAGER), getUsers);
router.get("/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), getUserById);

router.post(
  "/",
  authorize(ROLES.ADMIN),
  [
    body("name").notEmpty(),
    body("email").isEmail(),
    body("username").notEmpty(),
    body("password").isLength({ min: 6 }),
    body("role").optional().isIn(Object.values(ROLES)),
  ],
  validate,
  createUser
);

router.put("/:id", authorize(ROLES.ADMIN), updateUser);
router.delete("/:id", authorize(ROLES.ADMIN), deleteUser);
router.patch("/:id/assign-cranes", authorize(ROLES.ADMIN), assignCranes);

module.exports = router;
