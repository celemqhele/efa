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
}

export default nextConfig
