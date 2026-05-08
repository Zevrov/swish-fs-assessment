import express from 'express';
import { MarketService } from '../services/marketService';

const router = express.Router();
const marketService = new MarketService();

// GET /api/markets/filterOptions - Get available filter options
router.get('/filterOptions', async (_req, res) => {
  try {
    const data = await marketService.getFilterOptions();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options'
    });
  }
});

// PUT /api/markets/:id/suspension - Update manual suspension
// Body: { suspended: true | false | null }
//   true  -> force suspended
//   false -> force released
//   null  -> clear manual override (fall back to computed status)
// Strict positive-integer guard. parseInt('5abc', 10) returns 5, which would
// silently accept malformed paths like /api/markets/5abc/suspension. Match
// only digits and bound to MySQL's INT range so we don't overflow.
const POSITIVE_INT = /^[1-9]\d*$/;
const MYSQL_INT_MAX = 2_147_483_647;

router.put('/:id/suspension', async (req, res) => {
  try {
    const raw = req.params.id;
    if (!POSITIVE_INT.test(raw) || Number(raw) > MYSQL_INT_MAX) {
      return res.status(400).json({ success: false, error: 'Invalid market id' });
    }
    const marketId = Number(raw);

    const { suspended } = req.body ?? {};
    if (suspended !== true && suspended !== false && suspended !== null) {
      return res.status(400).json({
        success: false,
        error: 'Field "suspended" must be true, false, or null'
      });
    }

    const updated = await marketService.updateManualSuspension(marketId, suspended);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Market ${marketId} not found`
      });
    }

    // Return the freshly-computed market so the client can replace the row
    // without guessing what the post-update suspension status should be.
    // If this read fails after a successful UPDATE we still want to tell the
    // client the write applied — they can refetch on their own. Sending a
    // bare 500 here would have them rolling back an update that actually
    // landed in the database.
    try {
      const market = await marketService.getMarketById(marketId);
      return res.json({ success: true, data: market });
    } catch (readErr) {
      console.error('UPDATE applied but follow-up read failed:', readErr);
      return res.json({ success: true, data: null, warning: 'Update applied but follow-up read failed; please refetch.' });
    }
  } catch (error) {
    console.error('Error updating manual suspension:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update manual suspension'
    });
  }
});

// GET /api/markets - Get all markets with filtering
router.get('/', async (req, res) => {
  try {
    const filters = {
      position: req.query.position as string,
      statType: req.query.statType as string,
      suspensionStatus: req.query.suspensionStatus as string,
      search: req.query.search as string
    };

    // Remove undefined values
    Object.keys(filters).forEach(
      (key) => filters[key as keyof typeof filters] === undefined && delete filters[key as keyof typeof filters]
    );

    const markets = await marketService.getFilteredMarkets(filters);

    res.json({
      success: true,
      data: markets,
      count: markets.length
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch markets'
    });
  }
});

export default router;
