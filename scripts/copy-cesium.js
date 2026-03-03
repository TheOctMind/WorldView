const fs = require("fs")
const path = require("path")

const cesiumSource = path.join(__dirname, "..", "node_modules", "cesium", "Build", "Cesium")
const cesiumDest = path.join(__dirname, "..", "public", "cesium")

const dirs = ["Workers", "ThirdParty", "Assets", "Widgets"]

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// Skip if already copied (check Workers dir as sentinel)
const sentinel = path.join(cesiumDest, "Workers")
if (fs.existsSync(sentinel)) {
  console.log("Cesium assets already in public/cesium, skipping copy.")
  process.exit(0)
}

if (!fs.existsSync(cesiumSource)) {
  console.warn("Cesium build not found, skipping asset copy.")
  process.exit(0)
}

console.log("Copying Cesium assets to public/cesium...")
for (const dir of dirs) {
  const src = path.join(cesiumSource, dir)
  if (fs.existsSync(src)) {
    copyDir(src, path.join(cesiumDest, dir))
    console.log(`  Copied ${dir}`)
  }
}
console.log("Done.")
