/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
};
export default nextConfig;
