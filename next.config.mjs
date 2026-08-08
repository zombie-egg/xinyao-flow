/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '8mb' }, middlewareClientMaxBodySize: '25mb' },
};
export default nextConfig;
