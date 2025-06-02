import express from 'express';
import axios from 'axios';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getTmdbMoviesByGenre(genreId: string, page = 1) {
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${page}`;
  const res = await axios.get(url);
  return res.data;
}

async function getTmdbTvByGenre(genreId: string, page = 1) {
  const url = `https://api.themoviedb.org/3/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreId}&page=${page}`;
  const res = await axios.get(url);
  return res.data;
}

router.get(`/movie/:profileId`, authenticate, async (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const page = parseInt(req.query.page as string);
    const sagePage = !isNaN(page) && page > 0 ? page : 1;

    const prefs = await prisma.movieGenrePreference.findMany({
      where: { profileId },
      include: { genre: true },
    });

    if (prefs.length === 0)
      return res.json({
        results: [],
        message: 'No genre preferences set for this profile',
      });

    const tmdbGenreIds = prefs.map((pref) => pref.genre.tmdbId).join(',');

    const movies = await getTmdbMoviesByGenre(tmdbGenreIds, sagePage);

    return res.json(movies);
  } catch (error) {
    console.error('Browse movie error: ', error);
    res.status(500).json({ error: 'Internal server error' });
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

    if (prefs.length === 0) {
      return res.json({
        results: [],
        message: 'No genre preferences set for this profile',
      });
    }

    const tmdbGenreIds = prefs.map((pref) => pref.genre.tmdbId).join(',');

    const tvShows = await getTmdbTvByGenre(tmdbGenreIds, safePage);

    return res.json(tvShows);
  } catch (error) {
    console.error('Browse tv shows error: ', error);
    res.status(500).json({ error: 'Internal server error'   });
  }
});

export default router;
