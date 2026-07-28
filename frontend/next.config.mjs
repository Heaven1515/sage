import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  // turbopack.root resuelto dinámicamente para funcionar en cualquier máquina
  // (local y GitHub Actions). Apunta al directorio donde está este archivo = frontend/
  turbopack: {
    root: __dirname,
  },
  // Oculta el indicador de desarrollo (N circular)
  devIndicators: false,
}

export default nextConfig
