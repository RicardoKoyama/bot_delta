const express = require('express');
const router = express.Router();

router.use(require('./cliente'));
router.use(require('./agente'));
router.use(require('./app')); 

module.exports = router;
