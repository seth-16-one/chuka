const express = require("express");
const {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
} = require("../controllers/dataController");
const { requireSupabaseUser } = require("../middleware/requireSupabaseUser");

const router = express.Router();

router.use(requireSupabaseUser);

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Data API is running",
  });
});

router.get("/:table", listRecords);
router.get("/:table/:id", getRecord);
router.post("/:table", createRecord);
router.patch("/:table/:id", updateRecord);
router.delete("/:table/:id", deleteRecord);

module.exports = router;
