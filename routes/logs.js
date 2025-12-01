const express = require("express");
const router = express.Router();
const ensureAuth = require("../middlewares/auth");
const db = require("../db/db");

router.get("/", ensureAuth, (req, res) => {
  db.all(
    `SELECT * FROM logs_bot ORDER BY id DESC LIMIT 200`,
    (err, rows) => {
      res.render("logs/index", { logs: rows });
    }
  );
});

module.exports = router;
