import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../lib/s3';

const router = express.Router();

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

    console.log(profiles);

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
    console.log({ profile: { ...profile, avatarUrl: signedUrl } });
    return res.json({ profile: { ...profile, avatarUrl: signedUrl } });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { name, avatarUrl, isKid } = req.body;
    console.log(req.body);
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const profile = await prisma.profile.create({
      data: {
        userId,
        name,
        avatarUrl,
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

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const profileId = req.params.id;
    const { name, avatarUrl, isKid } = req.body;

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
    });
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: { name, avatarUrl, isKid },
    });
    console.log(updated);
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

export default router;
