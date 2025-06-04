import express from 'express';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = express.Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

export const axiosInstance = axios.create({
  timeout: 8000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'knwdle-backend/1.0',
  },
});

axiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    error.code === 'ECONNRESET' || axiosRetry.isNetworkError(error),
});

router.get('/details/:type/:id', authenticate, async (req, res) => {
  const { type, id } = req.params;

  if (!['movie', 'tv'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use "movie" or "tv"' });
  }

  try {
    // Fetch main details
    const detailsUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`;
    const creditsUrl = `https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${TMDB_API_KEY}`;

    const [detailsRes, creditsRes] = await Promise.all([
      axiosInstance.get(detailsUrl),
      axiosInstance.get(creditsUrl),
    ]);

    const details = detailsRes.data;
    const credits = creditsRes.data;

    const response = {
      id: details.id,
      type,
      title: details.title || details.name,
      description: details.overview,
      posterUrl: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
      backdropUrl: `https://image.tmdb.org/t/p/original${details.backdrop_path}`,
      releaseDate: details.release_date || details.first_air_date,
      genres: details.genres?.map((g: any) => g.name),
      rating: details.vote_average,
      cast: credits.cast?.slice(0, 10).map((c: any) => ({
        name: c.name,
        character: c.character,
        profile: c.profile_path
          ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
          : null,
      })),
      ...(type === 'tv' && {
        seasons: details.seasons?.map((s: any) => ({
          seasonNumber: s.season_number,
          episodeCount: s.episode_count,
          name: s.name,
          poster: s.poster_path
            ? `https://image.tmdb.org/t/p/w300${s.poster_path}`
            : null,
        })),
      }),
    };

    res.json(response);
  } catch (error: any) {
    console.error('[details] Failed to fetch:', error.message);
    res.status(500).json({ error: 'Failed to fetch content details' });
  }
});

router.get('/hero/:profileId', authenticate, async (req: AuthRequest, res) => {
  try {
    // Use TMDB trending
    const url = `https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}`;
    const response = await axiosInstance.get(url);
    const results = response.data?.results;

    if (results && results.length > 0) {
      res.json(results[0]); // only top one
    } else {
      res.status(404).json({ error: 'No hero video found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hero video' });
  }
});

router.get('/top-rated/tv', authenticate, async (req, res) => {
  console.log('i am tving');

  try {
    const { page = 1 } = req.query;
    const url = `https://api.themoviedb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
    const response = await axiosInstance.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/top-rated/movie', authenticate, async (req, res) => {
  console.log('i am');
  try {
    const { page = 1 } = req.query;
    const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
    const response = await axiosInstance.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/movie/:profileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const page = parseInt(req.query.page as string);
    const safePage = !isNaN(page) && page > 0 ? page : 1;

    const prefs = await prisma.movieGenrePreference.findMany({
      where: { profileId },
      include: { genre: true },
    });

    const tmdbGenreIds = prefs
      .map((p) => p.genre?.tmdbId)
      .filter(Boolean)
      .join(',');

    if (!tmdbGenreIds) {
      return res.json({
        results: [],
        message: 'No genre preferences set for this profile',
      });
    }

    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${tmdbGenreIds}&page=${safePage}`;
    const response = await axiosInstance.get(url);
    res.json(response.data);
  } catch (error: any) {
    res.status(503).json({ error: 'Failed to fetch movies. Try again later.' });
  }
});

router.get('/tv/:profileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const page = parseInt(req.query.page as string);
    const safePage = !isNaN(page) && page > 0 ? page : 1;

    const prefs = await prisma.tvGenrePreference.findMany({
      where: { profileId },
      include: { genre: true },
    });

    const tmdbGenreIds = prefs
      .map((p) => p.genre?.tmdbId)
      .filter(Boolean)
      .join(',');

    if (!tmdbGenreIds) {
      return res.json({
        results: [],
        message: 'No genre preferences set for this profile',
      });
    }

    const url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${tmdbGenreIds}&page=${safePage}`;
    const response = await axiosInstance.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trending', authenticate, async (req, res) => {
  try {
    const { media_type = 'all', time_window = 'day' } = req.query;
    const url = `https://api.themoviedb.org/3/trending/${media_type}/${time_window}?api_key=${TMDB_API_KEY}`;
    const response = await axiosInstance.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/continue-watching/:profileId', authenticate, async (req, res) => {
  try {
    const { profileId } = req.params;
    const entries = await prisma.watchHistory.findMany({
      where: { profileId },
      orderBy: { watchedAt: 'desc' },
      take: 20,
    });
    res.json({ results: entries });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/watch/:profileId',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const { profileId } = req.params;
      const { movieId, episodeId, progress } = req.body;

      if (!movieId && !episodeId) {
        return res
          .status(400)
          .json({ error: 'Either movieId or episodeId is required' });
      }

      await prisma.watchHistory.create({
        data: { profileId, movieId, episodeId },
      });

      const existing = await prisma.continueWatching.findFirst({
        where: { profileId, ...(movieId ? { movieId } : { episodeId }) },
      });

      if (existing) {
        await prisma.continueWatching.update({
          where: { id: existing.id },
          data: { progress, lastWatchedAt: new Date() },
        });
      } else {
        await prisma.continueWatching.create({
          data: { profileId, movieId, episodeId, progress },
        });
      }

      res.json({ message: 'Watch progress saved successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
