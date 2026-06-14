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
    // Vercel's Edge Runtime build doesn't define __dirname (V8 isolate, not Node.js).
    // Some package in the middleware bundle references it — polyfill it to '/'.
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

export default nextConfig
