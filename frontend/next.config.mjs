/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exportación estática requerida por Tauri (genera carpeta out/)
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // turbopack.root silencia el warning del lockfile múltiple
  turbopack: {
    root: 'C:/Users/javie/OneDrive/Desktop/OuterHeaven/SAGE/frontend',
  },
  // Oculta el indicador de desarrollo (N circular)
  devIndicators: false,
}

export default nextConfig
