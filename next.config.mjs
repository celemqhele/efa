/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/webp'],
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'tesseract.js'],
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
