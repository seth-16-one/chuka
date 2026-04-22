const express = require("express");
const {
  login,
  sendOtp,
  verifyOtp,
  resetPassword,
  register,
  updatePassword,
} = require("../controllers/authController");
const {
  validateEmailBody,
  validateLoginBody,
  validateOtpBody,
  validatePasswordBody,
  validateRegisterBody,
} = require("../middleware/authValidation");
const { requireBearerToken } = require("../middleware/requireBearerToken");

const router = express.Router();

router.post("/login", validateLoginBody, login);
router.post("/otp", validateEmailBody, sendOtp);
router.post("/verify", validateOtpBody, verifyOtp);
router.post("/reset", validateEmailBody, resetPassword);
router.post("/register", validateRegisterBody, register);
router.post("/password", requireBearerToken, validatePasswordBody, updatePassword);

module.exports = router;
