const express = require("express");

const {
  registerUser,
  loginUser,
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Register
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Protected route
router.get("/me", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "You are authenticated",
    userId: req.user.userId,
  });
});

module.exports = router;