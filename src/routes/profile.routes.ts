import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

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
    return res.json({ profiles });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { name, avatarUrl, isKid } = req.body;
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
