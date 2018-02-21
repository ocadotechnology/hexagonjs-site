const hexagon = require('hexagon-js')
const path = require('path')

function getFolder (which) {
  return path.join('target', 'themes', which)
}

function buildDemo(which) {
  console.log('Building', which)
  const dest = getFolder(which)
  hexagon.demo({
    dest,
    serverEnabled: false
  })
  return hexagon[which].build({ dest })
    .then(() => console.log('Built', which))
}

Promise.all([
  buildDemo('light'),
  buildDemo('dark')
])
  .then(() => process.exit(0))
  .catch(() => process.exit(1))

