// Fallback data used when the live NYT feed cannot be reached (e.g. no network,
// rate limiting, or an egress policy blocking outbound requests).
//
// These entries are FICTIONAL and clearly marked as demo data. They mimic the
// shape of NYT Obituaries RSS <item> elements so the rest of the pipeline can
// treat them identically to live data.

export const SAMPLE_RSS_ITEMS = [
  {
    title: 'Eleanor Vance, Architect Who Reshaped City Skylines, Dies at 91',
    link: 'https://www.nytimes.com/sample/eleanor-vance',
    description:
      'Her glass towers redefined three downtowns and influenced a generation of designers who prized light over ornament.',
    creator: 'The New York Times',
    category: 'Architecture',
    pubDate: 'Sat, 14 Jun 2026 09:12:00 +0000',
  },
  {
    title: 'Marcus Bell, Jazz Pianist of Quiet Intensity, Is Dead at 78',
    link: 'https://www.nytimes.com/sample/marcus-bell',
    description:
      'A fixture of late-night clubs for five decades, he recorded more than 40 albums and mentored countless players.',
    creator: 'The New York Times',
    category: 'Music',
    pubDate: 'Sat, 14 Jun 2026 07:45:00 +0000',
  },
  {
    title: 'Dr. Priya Nair, Virologist Who Tracked Forgotten Diseases, Dies at 84',
    link: 'https://www.nytimes.com/sample/priya-nair',
    description:
      'Her field work in remote clinics produced vaccines that saved an estimated two million lives.',
    creator: 'The New York Times',
    category: 'Science',
    pubDate: 'Fri, 13 Jun 2026 22:30:00 +0000',
  },
  {
    title: 'Tomás Herrera, Novelist of the Borderlands, Dies at 73',
    link: 'https://www.nytimes.com/sample/tomas-herrera',
    description:
      'His sprawling, bilingual novels captured a region in flux and earned a devoted international following.',
    creator: 'The New York Times',
    category: 'Books',
    pubDate: 'Fri, 13 Jun 2026 18:05:00 +0000',
  },
  {
    title: 'Greta Lindqvist, Pioneering Marine Biologist, Is Dead at 88',
    link: 'https://www.nytimes.com/sample/greta-lindqvist',
    description:
      'She spent more time underwater than almost any scientist of her era, cataloging reefs now largely gone.',
    creator: 'The New York Times',
    category: 'Science',
    pubDate: 'Fri, 13 Jun 2026 14:20:00 +0000',
  },
  {
    title: 'Walter Okafor, Civil Rights Lawyer, Dies at 96',
    link: 'https://www.nytimes.com/sample/walter-okafor',
    description:
      'He argued landmark cases over six decades and never lost his appetite for an unwinnable fight.',
    creator: 'The New York Times',
    category: 'Law',
    pubDate: 'Fri, 13 Jun 2026 11:00:00 +0000',
  },
  {
    title: 'Junko Sato, Animator Behind Beloved Films, Dies at 69',
    link: 'https://www.nytimes.com/sample/junko-sato',
    description:
      'Her hand-drawn worlds were painstaking, luminous, and stubbornly resistant to the digital age.',
    creator: 'The New York Times',
    category: 'Film',
    pubDate: 'Thu, 12 Jun 2026 20:40:00 +0000',
  },
  {
    title: 'Colonel Ray Dawson, Test Pilot and Author, Is Dead at 82',
    link: 'https://www.nytimes.com/sample/ray-dawson',
    description:
      'He flew aircraft no one else would and then wrote about it with disarming, deadpan calm.',
    creator: 'The New York Times',
    category: 'Aviation',
    pubDate: 'Thu, 12 Jun 2026 16:15:00 +0000',
  },
  {
    title: 'Ingrid Halvorsen, Chef Who Elevated Humble Food, Dies at 67',
    link: 'https://www.nytimes.com/sample/ingrid-halvorsen',
    description:
      'Her tiny coastal restaurant drew pilgrims from around the world for dishes built on patience and salt.',
    creator: 'The New York Times',
    category: 'Food',
    pubDate: 'Thu, 12 Jun 2026 12:50:00 +0000',
  },
  {
    title: 'Samuel Reyes, Economist Who Warned of Bubbles, Dies at 79',
    link: 'https://www.nytimes.com/sample/samuel-reyes',
    description:
      'Often ignored in good times and quoted endlessly in bad ones, he treated markets as theater.',
    creator: 'The New York Times',
    category: 'Economics',
    pubDate: 'Wed, 11 Jun 2026 23:05:00 +0000',
  },
  {
    title: 'Beatrice Mwangi, Long-Distance Runner and Coach, Is Dead at 64',
    link: 'https://www.nytimes.com/sample/beatrice-mwangi',
    description:
      'A two-time Olympian, she built a training camp that sent dozens of athletes to the world stage.',
    creator: 'The New York Times',
    category: 'Sports',
    pubDate: 'Wed, 11 Jun 2026 17:30:00 +0000',
  },
  {
    title: 'Henry Whitlock, Inventor of the Pocket Synthesizer, Dies at 86',
    link: 'https://www.nytimes.com/sample/henry-whitlock',
    description:
      'His cheap, indestructible noise boxes wound up in bedrooms, basements, and a surprising number of hit records.',
    creator: 'The New York Times',
    category: 'Technology',
    pubDate: 'Wed, 11 Jun 2026 09:10:00 +0000',
  },
];
