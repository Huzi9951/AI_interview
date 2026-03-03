/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Allow ngrok tunnel domains for external access */
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.io'],
};

export default nextConfig;
