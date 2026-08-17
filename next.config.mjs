/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: '8mb' }, middlewareClientMaxBodySize: '25mb' },
};
export default nextConfig;
