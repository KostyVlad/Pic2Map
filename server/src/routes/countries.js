/**
 * /api/countries router
 *
 * GET /api/countries/photo-counts — returns per-country photo counts
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import Photo from '../models/Photo.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/countries/photo-counts
// Returns an object map: { "US": 12, "FR": 8, ... }
// Used by the frontend to colour country polygons (CMAP-04)
//
// Phase 2: scoped to req.userId (AUTH-04 / D-03). Cast string userId to ObjectId —
// aggregate $match does NOT auto-cast strings (Pitfall 6).
// ---------------------------------------------------------------------------
router.get('/photo-counts', async (req, res, next) => {
  try {
    const counts = await Photo.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $group: { _id: '$countryCode', count: { $sum: 1 } } },
      { $project: { _id: 0, countryCode: '$_id', count: 1 } },
    ]);

    // Return as O(1) lookup map for frontend style function
    const map = Object.fromEntries(counts.map(r => [r.countryCode, r.count]));
    res.json(map);
  } catch (err) {
    next(err);
  }
});

export default router;
