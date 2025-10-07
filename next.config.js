/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ],
    // Deshabilitar optimización automática para evitar errores ECONNRESET
    unoptimized: true
  }
}
module.exports = nextConfig
