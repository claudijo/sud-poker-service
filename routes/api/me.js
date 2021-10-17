const express = require('express');
const router = express.Router();
const ULID = require('ulid')

router.get('/me', (req, res, next) => {
    req.session.user = req.session.user || {
        uid: ULID.ulid().toLowerCase()
    }

    res.json({ ...req.session.user })
});

module.exports = router;
