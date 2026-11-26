/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Allow ngrok tunnel domains for external access during development */
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],

  /* Security headers applied to all routes */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        // Camera/mic permissions only for interview pages
        source: '/interview/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), display-capture=(self)',
          },
        ],
      },
      {
        source: '/accept/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self)',
          },
        ],
      },
    ];
  },

  /* Standalone output for Docker/GCP Cloud Run deployment */
  output: 'standalone',
};

export default nextConfig;
