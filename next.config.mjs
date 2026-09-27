import withSerwist from '@serwist/next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'supabase.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
    ],
  },
  serverExternalPackages: ['sharp', 'tesseract.js', 'tesseract.js-core'],
  outputFileTracingIncludes: {
    '/api/webhook': ['./node_modules/tesseract.js-core/*.wasm'],
    '/api/admin/parse-screenshot': ['./node_modules/tesseract.js-core/*.wasm'],
  },
  // `app/api/og` builds team-crest URLs at runtime and fetches them over HTTP,
  // so nothing there reads public/logos off disk. Next.js traces at folder level
  // though, and public/logos is ~538 MB against Vercel's 250 MB uncompressed
  // function cap, so exclude it explicitly. Same class of bug as the earlier
  // lib/registry fs-readdir blowups.
  outputFileTracingExcludes: {
    '/api/og': ['./public/logos/**'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack(config, { nextRuntime, webpack }) {
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.DefinePlugin({
          __dirname: JSON.stringify('/'),
        })
      )
    }
    return config
  },
}

export default withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  exclude: [/\.map$/, /^manifest.*\.js$/, /\/logos\//, /\/themes\//],
})(nextConfig)
