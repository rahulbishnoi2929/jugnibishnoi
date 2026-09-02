// The escape hatch's entire content. One file. Edit here, nowhere else.
// Moves to MongoDB in Phase 3 (docs/ARCHITECTURE.md §3).

export const me = {
  name: 'Rahul Bishnoi',
  // One line. It is the only thing 40% of visitors will read.
  tagline:
    'Developer from Fazilka, Punjab. I build software for problems I have stood in the middle of.',
  // TODO: confirm which address you want public — this one or rahuldelu96@
  email: 'iamjugnii@gmail.com',
  resume: '/resume.pdf', // TODO: drop the PDF in client/public/
}

export const links = [
  { label: 'GitHub', href: 'https://github.com/rahulbishnoi2929' },
  { label: 'LinkedIn', href: '' }, // TODO
  { label: 'X', href: '' }, // TODO
  { label: 'LeetCode', href: '' }, // TODO — delete the row if you don't use it
]

export const stats = [
  { value: '3', label: 'hackathons hosted' }, // TODO: names + head counts
  { value: '2', label: 'products in build' },
  { value: '23', label: 'years, one of them farming' }, // TODO: make this true
]

export const featured = [
  {
    title: 'Zamindara',
    blurb: 'Uber for farm machinery.',
    body:
      'A farmer walks his field boundary with his phone, the app measures it in killa, kanal and marla, and nearby machine owners get the request. Launching in Fazilka district, Punjab.',
    problem:
      'Land here is measured in units no mapping API understands, by farmers who do not trust a number they did not watch being taken.',
    stack: ['TypeScript', 'Postgres', 'PostGIS', 'React Native'],
    repo: null, // private
    live: null,
  },
  {
    title: 'Rights',
    blurb: 'A legal-emergency app for Indian citizens.',
    body:
      'Press SOS when stopped, harassed or arrested, and get connected to a nearby verified lawyer over chat and video, with an encrypted place to put evidence.',
    problem:
      'The hour you most need a lawyer is the hour you are least able to find one.',
    stack: ['Node', 'Express', 'MongoDB', 'Socket.IO', 'Redis', 'React Native'],
    repo: null, // private
    live: null,
  },
]

export const also = [
  {
    title: 'DSA in Java',
    blurb: 'Full working notes — data structures and algorithms, in public.',
    repo: 'https://github.com/rahulbishnoi2929/DSA-java-',
  },
  {
    title: 'Games',
    blurb: 'Small browser games. Where the Workshop starts.',
    repo: 'https://github.com/rahulbishnoi2929/Games',
  },
]
