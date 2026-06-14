// Fallback data used when a live feed can't be reached (no network, rate
// limiting, egress policy, or a 403). Keyed by source id.
//
// These entries are FICTIONAL and clearly flagged as demo data. Several TMZ
// names deliberately overlap with NYT names (Eleanor Vance, Marcus Bell,
// Junko Sato) so that entity unification is visible even with no network.

export const SAMPLE_BY_SOURCE = {
  "nyt-obits": [
    {
      title: "Eleanor Vance, Architect Who Reshaped City Skylines, Dies at 91",
      link: "https://www.nytimes.com/sample/eleanor-vance",
      description:
        "Her glass towers redefined three downtowns and influenced a generation of designers who prized light over ornament.",
      creator: "The New York Times",
      category: "Architecture",
      pubDate: "Sat, 14 Jun 2026 09:12:00 +0000",
    },
    {
      title: "Marcus Bell, Jazz Pianist of Quiet Intensity, Is Dead at 78",
      link: "https://www.nytimes.com/sample/marcus-bell",
      description:
        "A fixture of late-night clubs for five decades, he recorded more than 40 albums and mentored countless players.",
      creator: "The New York Times",
      category: "Music",
      pubDate: "Sat, 14 Jun 2026 07:45:00 +0000",
    },
    {
      title:
        "Dr. Priya Nair, Virologist Who Tracked Forgotten Diseases, Dies at 84",
      link: "https://www.nytimes.com/sample/priya-nair",
      description:
        "Her field work in remote clinics produced vaccines that saved an estimated two million lives.",
      creator: "The New York Times",
      category: "Science",
      pubDate: "Fri, 13 Jun 2026 22:30:00 +0000",
    },
    {
      title: "Tomás Herrera, Novelist of the Borderlands, Dies at 73",
      link: "https://www.nytimes.com/sample/tomas-herrera",
      description:
        "His sprawling, bilingual novels captured a region in flux and earned a devoted international following.",
      creator: "The New York Times",
      category: "Books",
      pubDate: "Fri, 13 Jun 2026 18:05:00 +0000",
    },
    {
      title: "Greta Lindqvist, Pioneering Marine Biologist, Is Dead at 88",
      link: "https://www.nytimes.com/sample/greta-lindqvist",
      description:
        "She spent more time underwater than almost any scientist of her era, cataloging reefs now largely gone.",
      creator: "The New York Times",
      category: "Science",
      pubDate: "Fri, 13 Jun 2026 14:20:00 +0000",
    },
    {
      title: "Walter Okafor, Civil Rights Lawyer, Dies at 96",
      link: "https://www.nytimes.com/sample/walter-okafor",
      description:
        "He argued landmark cases over six decades and never lost his appetite for an unwinnable fight.",
      creator: "The New York Times",
      category: "Law",
      pubDate: "Fri, 13 Jun 2026 11:00:00 +0000",
    },
    {
      title: "Junko Sato, Animator Behind Beloved Films, Dies at 69",
      link: "https://www.nytimes.com/sample/junko-sato",
      description:
        "Her hand-drawn worlds were painstaking, luminous, and stubbornly resistant to the digital age.",
      creator: "The New York Times",
      category: "Film",
      pubDate: "Thu, 12 Jun 2026 20:40:00 +0000",
    },
    {
      title: "Colonel Ray Dawson, Test Pilot and Author, Is Dead at 82",
      link: "https://www.nytimes.com/sample/ray-dawson",
      description:
        "He flew aircraft no one else would and then wrote about it with disarming, deadpan calm.",
      creator: "The New York Times",
      category: "Aviation",
      pubDate: "Thu, 12 Jun 2026 16:15:00 +0000",
    },
    {
      title: "Ingrid Halvorsen, Chef Who Elevated Humble Food, Dies at 67",
      link: "https://www.nytimes.com/sample/ingrid-halvorsen",
      description:
        "Her tiny coastal restaurant drew pilgrims from around the world for dishes built on patience and salt.",
      creator: "The New York Times",
      category: "Food",
      pubDate: "Thu, 12 Jun 2026 12:50:00 +0000",
    },
    {
      title: "Samuel Reyes, Economist Who Warned of Bubbles, Dies at 79",
      link: "https://www.nytimes.com/sample/samuel-reyes",
      description:
        "Often ignored in good times and quoted endlessly in bad ones, he treated markets as theater.",
      creator: "The New York Times",
      category: "Economics",
      pubDate: "Wed, 11 Jun 2026 23:05:00 +0000",
    },
    {
      title: "Beatrice Mwangi, Long-Distance Runner and Coach, Is Dead at 64",
      link: "https://www.nytimes.com/sample/beatrice-mwangi",
      description:
        "A two-time Olympian, she built a training camp that sent dozens of athletes to the world stage.",
      creator: "The New York Times",
      category: "Sports",
      pubDate: "Wed, 11 Jun 2026 17:30:00 +0000",
    },
    {
      title: "Henry Whitlock, Inventor of the Pocket Synthesizer, Dies at 86",
      link: "https://www.nytimes.com/sample/henry-whitlock",
      description:
        "His cheap, indestructible noise boxes wound up in bedrooms, basements, and a surprising number of hit records.",
      creator: "The New York Times",
      category: "Technology",
      pubDate: "Wed, 11 Jun 2026 09:10:00 +0000",
    },
  ],

  tmz: [
    {
      title: "Eleanor Vance Remembered by Architects as Tributes Pour In",
      link: "https://www.tmz.com/sample/eleanor-vance-tribute",
      description:
        "Stars of the design world flooded social media with memories of the legendary architect.",
      creator: "TMZ Staff",
      category: "Tributes",
      pubDate: "Sat, 14 Jun 2026 12:40:00 +0000",
    },
    {
      title: "Eleanor Vance's Final Tower Project Will Be Completed, Firm Says",
      link: "https://www.tmz.com/sample/eleanor-vance-tower",
      description:
        "The studio confirmed her last commission will go ahead as a memorial.",
      creator: "TMZ Staff",
      category: "Tributes",
      pubDate: "Sat, 14 Jun 2026 10:05:00 +0000",
    },
    {
      title: "Marcus Bell Dead — Jazz World Reacts to Pianist's Passing",
      link: "https://www.tmz.com/sample/marcus-bell-reacts",
      description:
        "Musicians from across generations paid tribute to the late piano great.",
      creator: "TMZ Staff",
      category: "Music",
      pubDate: "Sat, 14 Jun 2026 08:20:00 +0000",
    },
    {
      title: "Junko Sato's Lost Final Film Set for Posthumous Release",
      link: "https://www.tmz.com/sample/junko-sato-film",
      description:
        "Distributors announced a theatrical run for the animator's unfinished masterpiece.",
      creator: "TMZ Staff",
      category: "Film",
      pubDate: "Fri, 13 Jun 2026 02:15:00 +0000",
    },
    {
      title: "Rex Calloway Spotted Leaving Hospital After Health Scare",
      link: "https://www.tmz.com/sample/rex-calloway-hospital",
      description:
        "The action star waved off paparazzi but assured fans he's 'doing great.'",
      creator: "TMZ Staff",
      category: "Celebrity",
      pubDate: "Sat, 14 Jun 2026 13:30:00 +0000",
    },
    {
      title: "Rex Calloway Lands Lead in Next Big Studio Franchise",
      link: "https://www.tmz.com/sample/rex-calloway-franchise",
      description:
        "Sources say the deal is one of the largest of the year.",
      creator: "TMZ Staff",
      category: "Celebrity",
      pubDate: "Sat, 14 Jun 2026 11:10:00 +0000",
    },
    {
      title: "Rex Calloway Seen Courtside at Playoff Game with Mystery Guest",
      link: "https://www.tmz.com/sample/rex-calloway-courtside",
      description: "Cameras caught the star cheering from the front row.",
      creator: "TMZ Staff",
      category: "Celebrity",
      pubDate: "Fri, 13 Jun 2026 21:45:00 +0000",
    },
    {
      title: "Tina Marlowe Slams Tabloid Rumors in Fiery Post",
      link: "https://www.tmz.com/sample/tina-marlowe-post",
      description:
        "The pop singer told followers to 'stop printing lies' about her tour.",
      creator: "TMZ Staff",
      category: "Music",
      pubDate: "Sat, 14 Jun 2026 06:00:00 +0000",
    },
    {
      title: "Tina Marlowe Announces Surprise Stadium Tour",
      link: "https://www.tmz.com/sample/tina-marlowe-tour",
      description: "Tickets reportedly sold out in minutes.",
      creator: "TMZ Staff",
      category: "Music",
      pubDate: "Thu, 12 Jun 2026 19:30:00 +0000",
    },
    {
      title: "Dex Romano Drops New Single, Breaks Streaming Record",
      link: "https://www.tmz.com/sample/dex-romano-single",
      description: "The rapper's latest track is the platform's biggest debut of the year.",
      creator: "TMZ Staff",
      category: "Music",
      pubDate: "Fri, 13 Jun 2026 15:00:00 +0000",
    },
  ],
};
