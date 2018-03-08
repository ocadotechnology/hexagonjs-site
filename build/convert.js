var quantum = require('./quantum')
var version = require('./version')
var template = require('quantum-template')
var changelog = require('quantum-changelog')

var hexagon = require('hexagon-js')

var Promise = require('bluebird')
var path = require('path')
var fs = Promise.promisifyAll(require('fs-extra'))
var util = require('./util')
var versions = require('../content/versions.json')

var Progress = require('progress')
var chalk = require('chalk')
var watch = require('quantum-watch')
var flatten = require('flatten')
var liveServer = require('live-server')

var privateConfig
try {
  privateConfig = require('../config.json')
} catch (e) {
  privateConfig = {}
}

function buildMetaData () {
  const targetVersions = versions.targetVersions

  return util.moduleList().then(function (moduleNames) {
    var res = {}
    return Promise.all(moduleNames.map(function (moduleName) {
      return fs.readJsonAsync(path.join(util.toModuleDir(moduleName), 'module.json'))
        .then(function (meta) {
          res[moduleName] = meta
        })
    }))
      .then(function () {
        return res
      })
  })
    .then(function (modules) {
      return Promise.props({
        versions: versions.versions,
        targetVersions: targetVersions,
        latest: versions.latest,
        modules: modules
      })
    })
    .then(function (meta) {
      return fs.writeJsonAsync(path.join('target', 'meta.json'), meta)
    })
}

function getTemplateVariables () {
  const targetVersions = versions.targetVersions

  return Promise.props({
    version: versions.latest,
    versionList: versions.versions,
    targetVersionList: targetVersions,
    modules: util.moduleList()
  })
}

function progressSequence (desc, completeStyle, list, func) {
  var bar = new Progress(desc + ' :current/:total [:bar] :percent :etas', { total: list.length, width: 50, complete: completeStyle })
  bar.tick(0)
  return Promise.all(list)
    .map(function (f) {
      return func(f)
        .then(function (res) {
          bar.tick()
          return res
        })
    }, {concurrency: 5})
}

function getOptions (dev) {
  function filenameModifier (filename, version) {
    var baseName = path.basename(filename)
    var moduleName = path.basename(path.dirname(filename))
    return path.join(moduleName, version, baseName)
  }

  var taggable = [
    'function',
    'prototype',
    'method',
    'property',
    'object',
    'constructor',
    'returns',
    'event',
    'data',
    'class',
    'extraclass',
    'childclass'
  ]

  var indexable = [
    'param',
    'group'
  ]

  var buildTags = {
    added: {
      order: 8
    },
    updated: {
      order: 7
    },
    deprecated: {
      order: 5
    },
    removed: {
      order: 4
    },
    enhancement: {
      keyText: 'Enhancement',
      iconClass: 'fa fa-fw fa-magic',
      order: 6,
      retain: false,
      removeEntity: false
    },
    bugfix: {
      keyText: 'Bug Fix',
      iconClass: 'fa fa-fw fa-bug',
      order: 3,
      retain: false,
      removeEntity: false
    },
    docs: {
      keyText: 'Documentation',
      iconClass: 'fa fa-fw fa-book',
      order: 2,
      retain: false,
      removeEntity: false
    },
    info: {
      keyText: 'Information',
      iconClass: 'fa fa-fw fa-info',
      order: 1,
      retain: false,
      removeEntity: false
    }
  }

  const targetVersions = versions.targetVersions

  var versionOptions = {
    tags: buildTags,
    taggable: taggable,
    indexable: indexable,
    unmergeable: ['examples', 'description', 'extra', 'default'],
    filenameModifier: filenameModifier,
    versions: versions.versions,
    targetVersions: targetVersions
  }

  return Promise.props({
    versionOptions: versionOptions
  })
}

function convertToNewFormat (objs) {
  var start = Date.now()
  return Promise.all([getTemplateVariables(), getOptions()]).spread(function (templateVariables, options) {
    return progressSequence('Building pages', chalk.green('='), objs, function (obj) {
      const module = obj.filename.split('/')[0]
      return Promise.resolve(obj)
        .then(template({variables: templateVariables}))
        .then(changelog(options.changelogOptions))
        .then(version(options.versionOptions))
        .map((x) => quantum.stringify(quantum.select(x).select('api').content, options.versionOptions))
        .map(function (qString) {
          return fs.outputFileAsync(path.join('new_format', module +'/api.um'), qString)
        })
    })
  })
}


function buildOnce (module) {
  return quantum.read(`content/pages/modules/*/index.um`)
    .then((c) => convertToNewFormat(c))
}

buildMetaData()
  .then(() => buildOnce(process.argv[2]))
