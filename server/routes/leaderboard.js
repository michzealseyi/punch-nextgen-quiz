const express = require('express');
const db = require('../db');
const { optionalAuth, wrap } = require('../middleware');
const { levelFor, watWeekStart, sqlTime } = require('../gamification');
const { rankOf } = require('./helpers');

const router = express.Router();

// All time ranks by lifetime points; ?period=week sums points earned since Monday (WAT)
router.get('/', optionalAuth, wrap((req, res) => {
  const week = req.query.period === 'week';
  const me = req.user && req.user.role === 'user' ? req.user : null;
  let leaders, mine = null;

  if (week) {
    const since = sqlTime(watWeekStart());
    const weekly = `SELECT u.id, u.name, u.lifetime_points xp, SUM(l.delta) points FROM point_ledger l JOIN users u ON u.id=l.user_id
                    WHERE u.role='user' AND l.delta>0 AND IFNULL(l.ref,'')!='signup' AND l.created_at>=? GROUP BY u.id`;
    leaders = db.prepare(`${weekly} ORDER BY points DESC, u.id ASC LIMIT 10`).all(since);
    if (me) {
      const pts = db.prepare(`SELECT COALESCE(SUM(delta),0) n FROM point_ledger WHERE user_id=? AND delta>0
                              AND IFNULL(ref,'')!='signup' AND created_at>=?`).get(me.id, since).n;
      const rank = db.prepare(`SELECT COUNT(*)+1 r FROM (${weekly}) WHERE points > ?`).get(since, pts).r;
      mine = { rank: pts > 0 ? rank : null, points: pts };
    }
  } else {
    leaders = db.prepare(`SELECT id, name, lifetime_points xp, lifetime_points points FROM users WHERE role='user'
                          ORDER BY lifetime_points DESC, id ASC LIMIT 10`).all();
    if (me) mine = { rank: rankOf(me.lifetime_points), points: me.lifetime_points };
  }

  res.json({
    period: week ? 'week' : 'all',
    leaders: leaders.map(({ xp, ...l }) => ({ ...l, level: levelFor(xp).name })),
    me: mine,
  });
}));

module.exports = router;
