const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, wrap, HttpError } = require('../middleware');
const { awardBadges } = require('../gamification');
const { balanceOf } = require('./helpers');

const router = express.Router();

router.get('/', wrap((req, res) => {
  res.json({ rewards: db.prepare('SELECT id, name, description, cost, stock, kind FROM rewards WHERE active=1 ORDER BY cost').all() });
}));

router.post('/:id/redeem', requireAuth, wrap((req, res) => {
  const out = db.transaction(() => {
    const reward = db.prepare('SELECT * FROM rewards WHERE id=? AND active=1').get(req.params.id);
    if (!reward) throw new HttpError(404, 'This reward isn’t available.');
    if (reward.stock < 1) throw new HttpError(409, 'This reward is out of stock.');
    const points = balanceOf(req.user.id);
    if (points < reward.cost) throw new HttpError(409, `You need ${reward.cost - points} more points for this reward.`);

    // Conditional updates guard against races even outside the transaction's serialisation
    const s = db.prepare('UPDATE rewards SET stock=stock-1 WHERE id=? AND stock>0').run(reward.id);
    const u = db.prepare('UPDATE users SET points=points-? WHERE id=? AND points>=?').run(reward.cost, req.user.id, reward.cost);
    if (!s.changes || !u.changes) throw new HttpError(409, 'Couldn’t complete the redemption. Try again.');

    const code = 'PN-' + crypto.randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-');
    db.prepare('INSERT INTO redemptions (user_id,reward_id,cost,code) VALUES (?,?,?,?)').run(req.user.id, reward.id, reward.cost, code);
    db.prepare('INSERT INTO point_ledger (user_id,delta,reason,ref) VALUES (?,?,?,?)').run(req.user.id, -reward.cost, `Redeemed: ${reward.name}`, code);
    return { code, reward: reward.name, balance: points - reward.cost, newBadges: awardBadges(req.user.id) };
  })();
  res.status(201).json(out);
}));

module.exports = router;
