/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static exports for Vercel
    output: 'standalone',

    // Image optimization
    images: {
        unoptimized: true,
    },

    // Ensure proper handling of static assets
    trailingSlash: true,

    // Environment variables
    env: {
        CUSTOM_KEY: process.env.CUSTOM_KEY,
    },
}

module.exports = nextConfig

