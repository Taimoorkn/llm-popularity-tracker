/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.anthropic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'docs.mistral.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cohere.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'grok.x.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.perplexity.ai',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.tii.ae',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
