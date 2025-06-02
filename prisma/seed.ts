// prisma/seed.ts
import { PrismaClient, GenreType } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Fetch genres from TMDB API
async function fetchGenres(type: 'movie' | 'tv') {
  const url =
    type === 'movie'
      ? 'https://api.themoviedb.org/3/genre/movie/list'
      : 'https://api.themoviedb.org/3/genre/tv/list';

  const res = await axios.get(url, {
    params: { api_key: TMDB_API_KEY, language: 'en-US' },
    timeout: 3000,
  });
  return res.data.genres as { id: number; name: string }[];
}

async function main() {
  console.log("Fetching genres from TMDB...");
  const [movieGenres, tvGenres] = await Promise.all([
    fetchGenres('movie'),
    fetchGenres('tv'),
  ]);
  console.log("Fetched Movie:", movieGenres.length, "TV:", tvGenres.length);

  // Merge genres into one map
  const genreMap = new Map<number, { name: string; type: GenreType }>();

  for (const genre of movieGenres) {
    genreMap.set(genre.id, { name: genre.name, type: "MOVIE" });
  }
  for (const genre of tvGenres) {
    if (genreMap.has(genre.id)) {
      genreMap.set(genre.id, { name: genre.name, type: "BOTH" });
    } else {
      genreMap.set(genre.id, { name: genre.name, type: "TV" });
    }
  }

  // Seed genres to DB
  let count = 0;
  for (const [tmdbId, { name, type }] of genreMap.entries()) {
    await prisma.genre.upsert({
      where: { tmdbId },
      update: { name, type },
      create: { tmdbId, name, type },
    });
    count++;
  }

  console.log(`✅ Seeded ${count} genres!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
