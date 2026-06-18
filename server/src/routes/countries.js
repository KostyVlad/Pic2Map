/**
 * /api/countries router
 *
 * GET /api/countries/photo-counts — returns per-country photo counts
 */

import { Router } from 'express';
import Photo from '../models/Photo.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/countries/photo-counts
// Returns an object map: { "US": 12, "FR": 8, ... }
// Used by the frontend to colour country polygons (CMAP-04)
//
// Phase 2: add { $match: { userId: req.userId } } before $group
// ---------------------------------------------------------------------------
router.get('/photo-counts', async (req, res, next) => {
  try {
    const counts = await Photo.aggregate([
      // Phase 2: add { $match: { userId: req.userId } } here for per-user isolation
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
