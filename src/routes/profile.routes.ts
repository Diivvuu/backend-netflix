import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../lib/s3';

const router = express.Router();

// Extracts only the S3 key from a key or full URL
function extractS3Key(urlOrKey: string) {
  if (!urlOrKey) return null;
  // Already a key, not a URL
  if (!urlOrKey.startsWith('http')) return urlOrKey;
  // Parse the key from an S3 URL (handles regular and signed URLs)
  const match = urlOrKey.match(/amazonaws\.com\/([^?]+)/);
  if (match) return match[1];
  return urlOrKey;
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.user.id;
    const profiles = await prisma.profile.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isKid: true,
        createdAt: true,
      },
    });
    const profileWithSignedUrls = await Promise.all(
      profiles.map(async (profile) => {
        let signedUrl = null;
        if (profile.avatarUrl) {
          const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: profile.avatarUrl,
          });
          signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });
        }
        return { ...profile, avatarUrl: signedUrl };
      })
    );

    console.log('all', profiles);

    return res.json({ profiles: profileWithSignedUrls });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user)
      return res.status(401).json({
        error: 'Unauthorized',
      });
    const profileId = req.params.id;
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        userId: true,
        name: true,
        avatarUrl: true,
        isKid: true,
        createdAt: true,
      },
    });
    let signedUrl = null;
    if (profile?.avatarUrl) {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: profile.avatarUrl,
      });
      signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 10 });
    }
    console.log('check', { profile: { ...profile, avatarUrl: signedUrl } });
    return res.json({ profile: { ...profile, avatarUrl: signedUrl } });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// POST /profiles
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    let { name, avatarUrl, isKid } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Ensure only the S3 key is stored
    const keyOnly = extractS3Key(avatarUrl);

    const profile = await prisma.profile.create({
      data: {
        userId,
        name,
        avatarUrl: keyOnly,
        isKid: !!isKid,
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isKid: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ profile });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /profiles/:id
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const profileId = req.params.id;
    let { name, avatarUrl, isKid } = req.body;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Ensure only the S3 key is stored
    const keyOnly = extractS3Key(avatarUrl);

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: { name, avatarUrl: keyOnly, isKid },
    });
    return res.json({ profile: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const profileId = req.params.id;
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });

    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    await prisma.profile.delete({ where: { id: profileId } });
    return res.json({ message: 'Profile deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/:id/movie-genres',
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      console.log('called');
      const { genreIds } = req.body;
      if (!Array.isArray(genreIds)) {
        return res.status(400).json({ error: 'genreIds must be an array' });
      }

      const userId = req.user?.id;
      const profileId = req.params.id;

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
      });
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const foundedGenres = await prisma.genre.findMany({
        where: { id: { in: genreIds.map(String) } },
        select: { id: true },
      });

      if (foundedGenres.length !== genreIds.length) {
        return res
          .status(400)
          .json({ error: 'One or more genreIds are invalid' });
      }

      await prisma.movieGenrePreference.deleteMany({ where: { profileId } });

      const created = await prisma.movieGenrePreference.createMany({
        data: genreIds.map((genreId) => ({
          profileId,
          genreId: String(genreId),
        })),
      });

      return res.json({
        message: 'Movie genres updated',
        count: created.count,
      });
    } catch (error) {
      console.error('Update movie genres error: ', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/:id/tv-genres', authenticate, async (req: AuthRequest, res) => {
  console.log('called', req);
  try {
    const { genreIds } = req.body;
    if (!Array.isArray(genreIds)) {
      return res.status(400).json({ error: 'genreIds must be an array' });
    }

    const userId = req.user?.id;
    const profileId = req.params.id;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const foundedGenres = await prisma.genre.findMany({
      where: { id: { in: genreIds.map(String) } },
      select: { id: true },
    });

    if (foundedGenres.length !== genreIds.length) {
      return res
        .status(400)
        .json({ error: 'One or more genreIds are invalid' });
    }

    await prisma.tvGenrePreference.deleteMany({ where: { profileId } });

    const created = await prisma.tvGenrePreference.createMany({
      data: genreIds.map((genreId) => ({
        profileId,
        genreId: String(genreId),
      })),
    });
    return res.json({ message: 'TV genres updated', count: created.count });
  } catch (error) {
    console.error('Update TV genres error', error);
    return res.status(500).json({ error: 'Intenral server error' });
  }
});

// GET /profiles/:id/genres
router.get('/:id/genres', authenticate, async (req: AuthRequest, res) => {

  try {
    const userId = req.user?.id;
    const profileId = req.params.id;
    // Ensure user owns this profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });
    console.log(profile?.userId, userId, 'check');
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const movieGenres = await prisma.movieGenrePreference.findMany({
      where: { profileId },
      select: { genreId: true },
    });

    const tvGenres = await prisma.tvGenrePreference.findMany({
      where: { profileId },
      select: { genreId: true },
    });

    console.log(movieGenres, tvGenres, 'Checl');

    return res.json({
      movieGenreIds: movieGenres.map((g) => g.genreId.toString()),
      tvGenreIds: tvGenres.map((g) => g.genreId.toString()),
    });
  } catch (error) {
    console.error('Fetch genres error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
