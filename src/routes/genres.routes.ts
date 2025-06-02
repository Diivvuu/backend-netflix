import express from 'express';
import axios from 'axios';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/movies', authenticate, async (req, res) => {
  console.log('confirm sec');
  console.log('TMDB KEY', process.env.TMDB_API_KEY);

  try {
    const genres = await prisma.genre.findMany({
      where: {
        OR: [{ type: 'MOVIE' }, { type: 'BOTH' }],
      },
      select: {
        id: true,
        tmdbId: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(genres);
  } catch (error) {
    console.error('Error fetching movie genres', error);
    res.status(500).json({ error: 'Failed to fetch movie genres' });
  }
});

router.get('/tv', authenticate, async (req, res) => {
  try {
    const genres = await prisma.genre.findMany({
      where: {
        OR: [{ type: 'TV' }, { type: 'BOTH' }],
      },
      select: {
        id: true,
        tmdbId: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(genres);
  } catch (error) {
    console.error('Error fetching tv genres', error);
    res.status(500).json({ error: 'Failed to fetch tv genres' });
  }
});

export default router;
