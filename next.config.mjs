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
  serverExternalPackages: ['sharp', 'tesseract.js'],
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
