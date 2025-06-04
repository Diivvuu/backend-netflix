import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { axiosInstance } from './browse.routes';

const router = express.Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_KEY';
router.get('/details/:type/:id/trailer', authenticate, async (req, res) => {
  const { type, id } = req.params;
  console.log('type', 'id', type, id);

  if (!['movie', 'tv'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use "movie" or "tv"' });
  }

  try {
    const url = `https://api.themoviedb.org/3/${type}/${id}/videos?api_key=${TMDB_API_KEY}`;
    console.log(url, 'url');
    const response = await axiosInstance.get(url);
    const videos = response.data?.results || [];

    // Prefer official trailer on YouTube
    const trailer = videos.find(
      (v: any) =>
        v.type === 'Trailer' && v.site === 'YouTube' && v.official === true
    );

    if (trailer) {
      return res.json({
        trailerUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
        key: trailer.key,
        site: trailer.site,
        name: trailer.name,
        type: trailer.type,
      });
    }

    // Fallback to any YouTube video
    const fallback = videos.find((v: any) => v.site === 'YouTube');
    if (fallback) {
      return res.json({
        trailerUrl: `https://www.youtube.com/watch?v=${fallback.key}`,
        key: fallback.key,
        site: fallback.site,
        name: fallback.name,
        type: fallback.type,
      });
    }

    res.json({ trailerUrl: null });
  } catch (error: any) {
    console.error('[trailer] Failed to fetch trailer:', error.message);
    res.status(500).json({ error: 'Failed to fetch trailer' });
  }
});

export default router;
