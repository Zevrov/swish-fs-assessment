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
router.put('/:id/suspension', async (req, res) => {
  try {
    const marketId = parseInt(req.params.id, 10);
    if (!Number.isInteger(marketId) || marketId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid market id'
      });
    }

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

    return res.json({ success: true });
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
