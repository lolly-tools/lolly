var QUOTES = [
  { text: "People who love ideas must have a love of words, and that means, given a chance, they will take a vivid interest in the **clothes which words wear**", author: "Beatrice Warde"},
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Stay hungry. Stay foolish.", author: "Stewart Brand" },
  { text: "Move fast and learn things.", author: "Unknown" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Make it simple, but significant.", author: "Don Draper" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Act as if what you do makes a difference. **It does.**", author: "William James" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "Spread love everywhere you go. Let no one ever come to you without leaving happier.", author: "Mother Teresa" },
  { text: "When you reach the end of your rope, tie a knot in it and hang on.", author: "Franklin D. Roosevelt" },
  { text: "Always remember that you are absolutely unique. Just like everyone else.", author: "Margaret Mead" },
  { text: "Don't judge each day by the harvest you reap but by the seeds that you plant.", author: "Robert Louis Stevenson" },
  { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
  { text: "Get busy living or get busy dying.", author: "Stephen King" },
  { text: "If life were predictable it would cease to be life, and be without flavor.", author: "Eleanor Roosevelt" },
  { text: "One machine can do the work of fifty ordinary men. **No machine** can do the work of **one extraordinary man**.", author: "Elbert Hubbard" },
  { text: "Technology made large populations possible; large populations now make *technology indispensable*.", author: "Joseph Krutch" },
  { text: "**Creativity and innovation** always builds on the past. The past always tries to control the creativity that builds upon it.", author: "Lawrence Lessig" },
  { text: "The art *challenges* the technology, and the technology **inspires the art**.", author: "John Lasseter" },
  { text: "It is not the strongest of the species that survive, nor the most intelligent, but the one ***most responsive to change***.", author: "Charles Darwin" },
  { text: "No matter how brilliant your mind or strategy, *if you're playing a solo game*, you'll always **lose out to a team**.", author: "Reid Hoffman" },
  { text: "The best way to have a good idea is to have a lot of ideas.", author: "Linus Pauling" },
  { text: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { text: "Do not fear to be eccentric in opinion, for every opinion now accepted was once eccentric.", author: "Bertrand Russell" },
  { text: "Culture eats strategy for breakfast.", author: "Peter Drucker" },
  { text: "Vulnerability is the birthplace of innovation, creativity, and change.", author: "Brene Brown" },
  { text: "Any sufficiently advanced technology is equivalent to magic.", author: "Arthur C. Clarke" },
  { text: "We need diversity of thought in the world to face the new challenges.", author: "Tim Berners-Lee" },
  { text: "The Linux philosophy is 'Laugh in the face of danger'. Oops. Wrong One. 'Do it yourself'. Yes, that's it.", author: "Linus Torvalds" },
  { text: "Intelligence is the ability to avoid doing work, yet getting the work done.", author: "Linus Torvalds" },
  { text: "Creativity is allowing yourself to make mistakes. Art is knowing which ones to keep.", author: "Scott Adams" }
];

// Airport codes and city nicknames → canonical geocoding-friendly name.
var CITY_ALIASES = {
  // US airports
  "lax": "Los Angeles", "la": "Los Angeles", "los angeles": "Los Angeles",
  "jfk": "New York", "nyc": "New York", "ny": "New York", "new york": "New York",
  "sfo": "San Francisco", "sf": "San Francisco", "san francisco": "San Francisco",
  "ord": "Chicago", "chi": "Chicago", "chicago": "Chicago",
  "mia": "Miami", "miami": "Miami",
  "atl": "Atlanta", "atlanta": "Atlanta",
  "sea": "Seattle", "seattle": "Seattle",
  "bos": "Boston", "boston": "Boston",
  "dfw": "Dallas", "dal": "Dallas", "dallas": "Dallas",
  "den": "Denver", "denver": "Denver",
  "las": "Las Vegas", "vegas": "Las Vegas",
  "phx": "Phoenix", "phoenix": "Phoenix",
  "pdx": "Portland", "portland": "Portland",
  "aus": "Austin", "austin": "Austin",
  "msp": "Minneapolis", "minneapolis": "Minneapolis",
  "dtw": "Detroit", "detroit": "Detroit",
  "slc": "Salt Lake City",
  "iah": "Houston", "hou": "Houston", "houston": "Houston",
  "dca": "Washington DC", "iad": "Washington DC", "dc": "Washington DC",
  "bwi": "Baltimore",
  "phl": "Philadelphia", "philly": "Philadelphia",
  "mco": "Orlando", "orlando": "Orlando",
  "tpa": "Tampa",
  "sdq": "San Diego", "san diego": "San Diego",
  "pdx": "Portland",
  // Europe
  "lhr": "London", "lgw": "London", "lon": "London", "london": "London",
  "cdg": "Paris", "ory": "Paris", "par": "Paris", "paris": "Paris",
  "fra": "Frankfurt", "frankfurt": "Frankfurt",
  "ams": "Amsterdam", "amsterdam": "Amsterdam",
  "mad": "Madrid", "madrid": "Madrid",
  "bcn": "Barcelona", "barcelona": "Barcelona",
  "fco": "Rome", "rome": "Rome", "roma": "Rome",
  "mil": "Milan", "mxp": "Milan", "milan": "Milan",
  "muc": "Munich", "munich": "Munich",
  "bru": "Brussels", "brussels": "Brussels",
  "zrh": "Zurich", "zurich": "Zurich",
  "vie": "Vienna", "vienna": "Vienna",
  "cph": "Copenhagen", "copenhagen": "Copenhagen",
  "arn": "Stockholm", "stockholm": "Stockholm",
  "hel": "Helsinki", "helsinki": "Helsinki",
  "osl": "Oslo", "oslo": "Oslo",
  "dub": "Dublin", "dublin": "Dublin",
  "ist": "Istanbul", "istanbul": "Istanbul",
  "ath": "Athens", "athens": "Athens",
  "lsz": "Lisbon", "lis": "Lisbon", "lisbon": "Lisbon",
  "prg": "Prague", "prague": "Prague",
  "bud": "Budapest", "budapest": "Budapest",
  "waw": "Warsaw", "warsaw": "Warsaw",
  "svo": "Moscow", "mow": "Moscow", "moscow": "Moscow",
  "led": "Saint Petersburg",
  // Asia-Pacific
  "nrt": "Tokyo", "hnd": "Tokyo", "tyo": "Tokyo", "tokyo": "Tokyo",
  "pek": "Beijing", "bjs": "Beijing", "beijing": "Beijing",
  "pvg": "Shanghai", "sha": "Shanghai", "shanghai": "Shanghai",
  "hkg": "Hong Kong", "hong kong": "Hong Kong",
  "sin": "Singapore", "singapore": "Singapore",
  "bkk": "Bangkok", "bangkok": "Bangkok",
  "kul": "Kuala Lumpur",
  "cgk": "Jakarta", "jakarta": "Jakarta",
  "mnl": "Manila", "manila": "Manila",
  "icn": "Seoul", "sel": "Seoul", "seoul": "Seoul",
  "syd": "Sydney", "sydney": "Sydney",
  "mel": "Melbourne", "melbourne": "Melbourne",
  "bne": "Brisbane", "brisbane": "Brisbane",
  "akl": "Auckland", "auckland": "Auckland",
  "del": "New Delhi", "delhi": "New Delhi",
  "bom": "Mumbai", "mumbai": "Mumbai", "bombay": "Mumbai",
  "blr": "Bangalore", "bangalore": "Bangalore",
  "dxb": "Dubai", "dubai": "Dubai",
  "auh": "Abu Dhabi",
  "doh": "Doha", "doha": "Doha",
  "thr": "Tehran", "tehran": "Tehran",
  "tlv": "Tel Aviv",
  "cai": "Cairo", "cairo": "Cairo",
  // Africa / Americas
  "jnb": "Johannesburg",
  "cpt": "Cape Town",
  "nbo": "Nairobi", "nairobi": "Nairobi",
  "los": "Lagos", "lagos": "Lagos",
  "acc": "Accra",
  "gru": "São Paulo", "sao paulo": "São Paulo",
  "gig": "Rio de Janeiro", "rio": "Rio de Janeiro",
  "eze": "Buenos Aires",
  "bog": "Bogota",
  "lim": "Lima",
  "scl": "Santiago",
  "mex": "Mexico City",
  "yyz": "Toronto", "toronto": "Toronto",
  "yvr": "Vancouver", "vancouver": "Vancouver",
  "yul": "Montreal", "montreal": "Montreal"
};

function normalizeCity(raw) {
  if (!raw || !raw.trim()) return '';
  var key = raw.trim().toLowerCase();
  return CITY_ALIASES[key] || raw.trim();
}

// Locked once per session so onInput calls don't re-randomize mid-edit.
var _quoteIndex = null;

function sessionQuote() {
  if (_quoteIndex === null) {
    _quoteIndex = Math.floor(Math.random() * QUOTES.length);
  }
  return { quote: QUOTES[_quoteIndex], index: _quoteIndex };
}

function compute(inputs) {
  var city = inputs.city || '';
  var sq = sessionQuote();
  var dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return {
    quoteText:    sq.quote.text,
    quoteAuthor:  sq.quote.author,
    quoteIndex:   sq.index,
    dateStr:      dateStr,
    cityRaw:      city.trim(),
    cityNorm:     normalizeCity(city),
    theme:        inputs.theme || 'dark'
  };
}

function onInit({ model }) {
  return compute(Object.fromEntries(model.map(function(i) { return [i.id, i.value]; })));
}

function onInput({ model }) {
  return compute(Object.fromEntries(model.map(function(i) { return [i.id, i.value]; })));
}
