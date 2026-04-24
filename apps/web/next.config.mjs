/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@trainmap/domain",
    "@trainmap/exporter",
    "@trainmap/geo",
    "@trainmap/importer",
    "@trainmap/timetable-adapters",
    "@trainmap/ui"
  ]
};

export default nextConfig;
