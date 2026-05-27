import { GenreItem, MediaItem } from '../models/media.model';

const MINUTE_TICKS = 60 * 10_000_000;

type Palette = [string, string, string];

interface MockItemDefinition {
  id: string;
  name: string;
  type?: 'Movie' | 'Series';
  year: number;
  minutes: number;
  rating: string;
  score: number;
  genres: string[];
  overview: string;
  tagline: string;
  palette: Palette;
  progress?: number;
}

export interface MockHomeCatalog {
  heroItems: MediaItem[];
  spotlightPicks: MediaItem[];
  continueWatching: MediaItem[];
  trendingNow: MediaItem[];
  popularMovies: MediaItem[];
  newReleases: MediaItem[];
  recommendedForYou: MediaItem[];
  actionMovies: MediaItem[];
  sciFi: MediaItem[];
  tvShows: MediaItem[];
  genres: GenreItem[];
}

const MOCK_GENRES: GenreItem[] = [
  { Id: 'genre-action', Name: 'Action' },
  { Id: 'genre-scifi', Name: 'Sci-Fi' },
  { Id: 'genre-drama', Name: 'Drama' },
  { Id: 'genre-thriller', Name: 'Thriller' },
  { Id: 'genre-adventure', Name: 'Adventure' },
  { Id: 'genre-fantasy', Name: 'Fantasy' },
  { Id: 'genre-mystery', Name: 'Mystery' },
  { Id: 'genre-series', Name: 'TV Essentials' }
];

const DEFINITIONS: MockItemDefinition[] = [
  {
    id: 'mock-dune-part-two',
    name: 'Dune: Part Two',
    year: 2024,
    minutes: 166,
    rating: 'PG-13',
    score: 8.8,
    genres: ['Sci-Fi', 'Adventure'],
    overview: 'Paul Atreides rises in the desert and answers destiny with scale, prophecy, and war.',
    tagline: 'The desert remembers.',
    palette: ['#c9722d', '#29160d', '#f7c58a'],
    progress: 42
  },
  {
    id: 'mock-the-batman',
    name: 'The Batman',
    year: 2022,
    minutes: 176,
    rating: 'PG-13',
    score: 7.9,
    genres: ['Action', 'Crime'],
    overview: 'Gotham is soaked in rain, corruption, and riddles as vengeance turns into something larger.',
    tagline: 'Vengeance leaves a mark.',
    palette: ['#b62422', '#12080b', '#f0c5c4'],
    progress: 61
  },
  {
    id: 'mock-interstellar',
    name: 'Interstellar',
    year: 2014,
    minutes: 169,
    rating: 'PG-13',
    score: 8.7,
    genres: ['Sci-Fi', 'Drama'],
    overview: 'A final mission beyond the known world becomes a journey through time, gravity, and memory.',
    tagline: 'Beyond the stars, home waits.',
    palette: ['#3d6ea7', '#0a0f18', '#dfeaf7'],
    progress: 24
  },
  {
    id: 'mock-shogun',
    name: 'Shogun',
    type: 'Series',
    year: 2024,
    minutes: 58,
    rating: 'TV-MA',
    score: 8.9,
    genres: ['Drama', 'Adventure'],
    overview: 'Power, allegiance, and survival collide in a court where every glance carries a blade.',
    tagline: 'A war of whispers and crowns.',
    palette: ['#9e3a34', '#171114', '#f2d9c7'],
    progress: 35
  },
  {
    id: 'mock-fallout',
    name: 'Fallout',
    type: 'Series',
    year: 2024,
    minutes: 56,
    rating: 'TV-MA',
    score: 8.3,
    genres: ['Sci-Fi', 'Action'],
    overview: 'The future is bright, absurd, and radioactive as survivors climb out into a warped new world.',
    tagline: 'Step into the wasteland.',
    palette: ['#d48a1d', '#24180e', '#ffe0aa']
  },
  {
    id: 'mock-john-wick-4',
    name: 'John Wick: Chapter 4',
    year: 2023,
    minutes: 169,
    rating: 'R',
    score: 8.0,
    genres: ['Action', 'Thriller'],
    overview: 'The road to freedom is lit by neon, honor, and impossible odds.',
    tagline: 'Every path ends in fire.',
    palette: ['#e56a2f', '#1d0f0f', '#ffd4af']
  },
  {
    id: 'mock-oppenheimer',
    name: 'Oppenheimer',
    year: 2023,
    minutes: 180,
    rating: 'R',
    score: 8.5,
    genres: ['Drama', 'Thriller'],
    overview: 'Brilliance and consequence collide as one decision changes the weight of the world forever.',
    tagline: 'The world changed in an instant.',
    palette: ['#da7428', '#1f1611', '#f8dbc0']
  },
  {
    id: 'mock-severance',
    name: 'Severance',
    type: 'Series',
    year: 2022,
    minutes: 50,
    rating: 'TV-MA',
    score: 8.7,
    genres: ['Sci-Fi', 'Mystery'],
    overview: 'What if the walls between work and self were not just blurred but erased?',
    tagline: 'Leave yourself at the door.',
    palette: ['#3c84d5', '#0b1018', '#dbe9f9']
  },
  {
    id: 'mock-blade-runner-2049',
    name: 'Blade Runner 2049',
    year: 2017,
    minutes: 164,
    rating: 'R',
    score: 8.0,
    genres: ['Sci-Fi', 'Drama'],
    overview: 'A detective chases a mystery through neon haze and the ruins of memory.',
    tagline: 'The future never stopped dreaming.',
    palette: ['#f18d3d', '#221316', '#fde0b7']
  },
  {
    id: 'mock-mad-max-fury-road',
    name: 'Mad Max: Fury Road',
    year: 2015,
    minutes: 120,
    rating: 'R',
    score: 8.1,
    genres: ['Action', 'Adventure'],
    overview: 'Engines scream across the wasteland in a relentless sprint toward hope.',
    tagline: 'Ride to survive.',
    palette: ['#d85b23', '#24110d', '#ffd3a6']
  },
  {
    id: 'mock-house-of-the-dragon',
    name: 'House of the Dragon',
    type: 'Series',
    year: 2024,
    minutes: 59,
    rating: 'TV-MA',
    score: 8.4,
    genres: ['Fantasy', 'Drama'],
    overview: 'Dynasties rise and fracture under the heat of ambition and dragonfire.',
    tagline: 'Every throne demands a price.',
    palette: ['#9b2f2a', '#1d0c0d', '#f4d0cb']
  },
  {
    id: 'mock-silo',
    name: 'Silo',
    type: 'Series',
    year: 2023,
    minutes: 52,
    rating: 'TV-14',
    score: 8.1,
    genres: ['Sci-Fi', 'Mystery'],
    overview: 'Truth hides in the concrete shadows of a world built to forget what lies above.',
    tagline: 'Some questions break the surface.',
    palette: ['#6b737e', '#121519', '#dbe0e7']
  },
  {
    id: 'mock-top-gun-maverick',
    name: 'Top Gun: Maverick',
    year: 2022,
    minutes: 130,
    rating: 'PG-13',
    score: 8.3,
    genres: ['Action', 'Drama'],
    overview: 'Speed, legacy, and impossible missions collide high above the clouds.',
    tagline: 'Higher. Faster. Closer.',
    palette: ['#eb7d2e', '#152133', '#f7dcc2']
  },
  {
    id: 'mock-the-bear',
    name: 'The Bear',
    type: 'Series',
    year: 2024,
    minutes: 35,
    rating: 'TV-MA',
    score: 8.6,
    genres: ['Drama', 'Comedy'],
    overview: 'Pressure, family, and artistry simmer together in a kitchen that never stops moving.',
    tagline: 'Chaos can taste incredible.',
    palette: ['#f2a24a', '#231712', '#ffe4b5']
  },
  {
    id: 'mock-reacher',
    name: 'Reacher',
    type: 'Series',
    year: 2023,
    minutes: 49,
    rating: 'TV-MA',
    score: 8.0,
    genres: ['Action', 'Thriller'],
    overview: 'One man walks into town and every secret starts shaking loose.',
    tagline: 'The calm before impact.',
    palette: ['#886242', '#18110f', '#eadacb']
  },
  {
    id: 'mock-the-last-of-us',
    name: 'The Last of Us',
    type: 'Series',
    year: 2023,
    minutes: 57,
    rating: 'TV-MA',
    score: 8.8,
    genres: ['Drama', 'Sci-Fi'],
    overview: 'A fragile bond carries hope across a world that forgot how to heal.',
    tagline: 'Endure and survive.',
    palette: ['#50765f', '#0f1712', '#d9ecd9']
  },
  {
    id: 'mock-andor',
    name: 'Andor',
    type: 'Series',
    year: 2022,
    minutes: 48,
    rating: 'TV-14',
    score: 8.5,
    genres: ['Sci-Fi', 'Thriller'],
    overview: 'Rebellion begins quietly, in small choices made under enormous pressure.',
    tagline: 'Hope starts in the shadows.',
    palette: ['#6d4439', '#16100f', '#f0d7cd']
  },
  {
    id: 'mock-spider-verse',
    name: 'Across the Spider-Verse',
    year: 2023,
    minutes: 140,
    rating: 'PG',
    score: 8.6,
    genres: ['Action', 'Sci-Fi'],
    overview: 'Dimensions split open as style, emotion, and momentum collide in every frame.',
    tagline: 'Leap into every universe.',
    palette: ['#b52cc2', '#160a1d', '#f6d2ff']
  },
  {
    id: 'mock-poor-things',
    name: 'Poor Things',
    year: 2023,
    minutes: 141,
    rating: 'R',
    score: 8.0,
    genres: ['Drama', 'Fantasy'],
    overview: 'A wildly original odyssey of wonder, reinvention, and fearless curiosity.',
    tagline: 'Wonder can be untamed.',
    palette: ['#7bc7de', '#0f1921', '#e1f7ff']
  },
  {
    id: 'mock-dark-matter',
    name: 'Dark Matter',
    type: 'Series',
    year: 2024,
    minutes: 52,
    rating: 'TV-14',
    score: 7.7,
    genres: ['Sci-Fi', 'Thriller'],
    overview: 'Every choice becomes a doorway when one life fractures into countless versions.',
    tagline: 'Choose carefully.',
    palette: ['#5277a9', '#0b1017', '#d8e6ff']
  },
  {
    id: 'mock-the-gentlemen',
    name: 'The Gentlemen',
    type: 'Series',
    year: 2024,
    minutes: 50,
    rating: 'TV-MA',
    score: 8.0,
    genres: ['Action', 'Comedy'],
    overview: 'Style, swagger, and ruthless improvisation keep the empire moving one deal at a time.',
    tagline: 'Power loves a polished suit.',
    palette: ['#4f6a58', '#101512', '#dbe9de']
  }
];

function splitTitle(text: string, maxChars: number): string[] {
  const words = text.replace(':', ': ').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 3);
}

function createPosterSvg(name: string, year: number, genres: string[], palette: Palette): string {
  const [accent, base, glow] = palette;
  const lines = splitTitle(name.toUpperCase(), 13);
  const genresText = genres.slice(0, 2).join(' / ').toUpperCase();

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 1020">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.88"/>
          <stop offset="48%" stop-color="${base}" stop-opacity="1"/>
          <stop offset="100%" stop-color="#03050a" stop-opacity="1"/>
        </linearGradient>
        <radialGradient id="orb" cx="78%" cy="14%" r="40%">
          <stop offset="0%" stop-color="${glow}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="shade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.03"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.78"/>
        </linearGradient>
      </defs>
      <rect width="680" height="1020" fill="url(#bg)"/>
      <circle cx="540" cy="180" r="220" fill="url(#orb)"/>
      <path d="M0 620 C180 560 280 420 680 360 L680 1020 L0 1020 Z" fill="#000000" fill-opacity="0.24"/>
      <path d="M0 720 C180 610 420 640 680 520 L680 1020 L0 1020 Z" fill="#ffffff" fill-opacity="0.04"/>
      <rect width="680" height="1020" fill="url(#shade)"/>
      <text x="56" y="88" fill="#f4f7fb" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="6">${genresText}</text>
      <text x="56" y="126" fill="#f4f7fb" opacity="0.72" font-family="Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="4">${year}</text>
      ${lines
        .map(
          (line, index) =>
            `<text x="56" y="${780 + index * 70}" fill="#f9fbff" font-family="Arial, sans-serif" font-size="64" font-weight="800" letter-spacing="-2">${line}</text>`
        )
        .join('')}
      <rect x="56" y="884" width="128" height="6" rx="3" fill="${glow}" fill-opacity="0.95"/>
    </svg>
  `;
}

function createBackdropSvg(name: string, tagline: string, year: number, genres: string[], palette: Palette): string {
  const [accent, base, glow] = palette;
  const lines = splitTitle(name.toUpperCase(), 20);
  const genresText = genres.slice(0, 2).join(' / ').toUpperCase();

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" stop-opacity="1"/>
          <stop offset="48%" stop-color="#05070c" stop-opacity="1"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.9"/>
        </linearGradient>
        <radialGradient id="glow" cx="82%" cy="18%" r="42%">
          <stop offset="0%" stop-color="${glow}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="overlay" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#020307" stop-opacity="0.94"/>
          <stop offset="54%" stop-color="#020307" stop-opacity="0.54"/>
          <stop offset="100%" stop-color="#020307" stop-opacity="0.18"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)"/>
      <circle cx="1320" cy="170" r="260" fill="url(#glow)"/>
      <path d="M860 820 C980 640 1240 540 1600 420 L1600 900 L860 900 Z" fill="#ffffff" fill-opacity="0.06"/>
      <path d="M980 900 C1070 640 1320 520 1600 350 L1600 900 Z" fill="#000000" fill-opacity="0.18"/>
      <rect width="1600" height="900" fill="url(#overlay)"/>
      <text x="96" y="138" fill="#f4f7fb" font-family="Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="7">${genresText}</text>
      <text x="96" y="178" fill="#f4f7fb" opacity="0.72" font-family="Arial, sans-serif" font-size="28" font-weight="600" letter-spacing="4">${year}</text>
      ${lines
        .map(
          (line, index) =>
            `<text x="96" y="${330 + index * 88}" fill="#f9fbff" font-family="Arial, sans-serif" font-size="88" font-weight="800" letter-spacing="-3">${line}</text>`
        )
        .join('')}
      <text x="96" y="620" fill="#dde5f0" font-family="Arial, sans-serif" font-size="34" font-weight="500">${tagline}</text>
      <rect x="96" y="664" width="144" height="6" rx="3" fill="${glow}" fill-opacity="0.95"/>
    </svg>
  `;
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s{2,}/g, ' ').trim())}`;
}

function buildMockItem(definition: MockItemDefinition): MediaItem {
  const runtimeTicks = definition.minutes * MINUTE_TICKS;
  const item: MediaItem = {
    Id: definition.id,
    Name: definition.name,
    Type: definition.type ?? 'Movie',
    Overview: definition.overview,
    Tagline: definition.tagline,
    Genres: definition.genres,
    ProductionYear: definition.year,
    OfficialRating: definition.rating,
    CommunityRating: definition.score,
    RunTimeTicks: runtimeTicks,
    UserData: definition.progress
      ? {
          PlaybackPositionTicks: Math.round(runtimeTicks * (definition.progress / 100))
        }
      : undefined,
    Available: false,
    Source: 'mock',
    MockPosterUrl: toDataUrl(createPosterSvg(definition.name, definition.year, definition.genres, definition.palette)),
    MockBackdropUrl: toDataUrl(
      createBackdropSvg(
        definition.name,
        definition.tagline,
        definition.year,
        definition.genres,
        definition.palette
      )
    )
  };

  return item;
}

const MOCK_ITEMS = DEFINITIONS.map(buildMockItem);
export const MOCK_ALL_ITEMS = MOCK_ITEMS;
export const MOCK_ITEM_LOOKUP = new Map(MOCK_ITEMS.map((item) => [item.Id, item]));

const getById = (id: string) => MOCK_ITEMS.find((item) => item.Id === id)!;

export const MOCK_HOME_CATALOG: MockHomeCatalog = {
  heroItems: [
    getById('mock-dune-part-two'),
    getById('mock-shogun'),
    getById('mock-the-batman'),
    getById('mock-interstellar')
  ],
  spotlightPicks: [
    getById('mock-severance'),
    getById('mock-john-wick-4'),
    getById('mock-fallout'),
    getById('mock-poor-things')
  ],
  continueWatching: [
    getById('mock-the-batman'),
    getById('mock-interstellar'),
    getById('mock-shogun'),
    getById('mock-dune-part-two'),
    getById('mock-the-last-of-us')
  ],
  trendingNow: [
    getById('mock-dune-part-two'),
    getById('mock-oppenheimer'),
    getById('mock-john-wick-4'),
    getById('mock-fallout'),
    getById('mock-the-batman'),
    getById('mock-shogun'),
    getById('mock-severance'),
    getById('mock-spider-verse'),
    getById('mock-mad-max-fury-road'),
    getById('mock-poor-things'),
    getById('mock-dark-matter'),
    getById('mock-reacher')
  ],
  popularMovies: [
    getById('mock-dune-part-two'),
    getById('mock-oppenheimer'),
    getById('mock-the-batman'),
    getById('mock-interstellar'),
    getById('mock-blade-runner-2049'),
    getById('mock-top-gun-maverick'),
    getById('mock-john-wick-4'),
    getById('mock-mad-max-fury-road'),
    getById('mock-spider-verse'),
    getById('mock-poor-things')
  ],
  newReleases: [
    getById('mock-fallout'),
    getById('mock-shogun'),
    getById('mock-dark-matter'),
    getById('mock-the-gentlemen'),
    getById('mock-house-of-the-dragon'),
    getById('mock-the-bear'),
    getById('mock-reacher'),
    getById('mock-poor-things')
  ],
  recommendedForYou: [
    getById('mock-severance'),
    getById('mock-andor'),
    getById('mock-the-last-of-us'),
    getById('mock-silo'),
    getById('mock-house-of-the-dragon'),
    getById('mock-top-gun-maverick'),
    getById('mock-spider-verse'),
    getById('mock-the-gentlemen')
  ],
  actionMovies: [
    getById('mock-john-wick-4'),
    getById('mock-the-batman'),
    getById('mock-top-gun-maverick'),
    getById('mock-mad-max-fury-road'),
    getById('mock-reacher'),
    getById('mock-spider-verse'),
    getById('mock-fallout')
  ],
  sciFi: [
    getById('mock-dune-part-two'),
    getById('mock-interstellar'),
    getById('mock-blade-runner-2049'),
    getById('mock-severance'),
    getById('mock-silo'),
    getById('mock-dark-matter'),
    getById('mock-andor'),
    getById('mock-fallout')
  ],
  tvShows: [
    getById('mock-shogun'),
    getById('mock-severance'),
    getById('mock-fallout'),
    getById('mock-house-of-the-dragon'),
    getById('mock-the-last-of-us'),
    getById('mock-the-bear'),
    getById('mock-reacher'),
    getById('mock-andor'),
    getById('mock-the-gentlemen'),
    getById('mock-dark-matter')
  ],
  genres: MOCK_GENRES
};

export const MOCK_LOGIN_POSTERS = [
  getById('mock-dune-part-two'),
  getById('mock-the-batman'),
  getById('mock-shogun'),
  getById('mock-interstellar'),
  getById('mock-fallout'),
  getById('mock-the-last-of-us'),
  getById('mock-house-of-the-dragon'),
  getById('mock-spider-verse')
];
