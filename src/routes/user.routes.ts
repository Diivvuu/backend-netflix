import express from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' } );
    }
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server errror' });
  }
});

export default router;
