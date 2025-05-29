import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../lib/s3';

const router = express.Router();
router.post('/upload-url', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('Received upload-url request:', req.body);
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { fileName, fileType, folder = 'uploads' } = req.body;
    if (!fileName || !fileType) {
      return res
        .status(400)
        .json({ error: 'fileName and fileType are required' });
    }

    const Key = `${folder}/${Date.now()}_${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key,
      ContentType: fileType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    console.log('[upload-url] generated S3 URL:', url);
    return res.json({ url, key: Key });
  } catch (error: any) {
    console.error('[upload-url] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate S3 upload URL',
      details: error?.message,
    });
  }
});

export default router;
