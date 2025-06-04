import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import profileRoutes from './routes/profile.routes';
import uploadRoutes from './routes/upload.routes'
import genresRoutes from "./routes/genres.routes"
import browseRoutes from "./routes/browse.routes"
import videoRoutes from "./routes/video.routes"

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('API is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/me', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/upload', uploadRoutes)
app.use('/api/genres', genresRoutes)
app.use('/api/browse', browseRoutes)
app.use('/api/video', videoRoutes)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
