'use strict'

// Usage:
// $ antora --generator=./generate-file-report.js --to-dir=reports ../staging-antora-playbook.yml

const aggregateContent = require('@antora/content-aggregator')
const buildPlaybook = require('@antora/playbook-builder')
const classifyContent = require('@antora/content-classifier')
const loadAsciiDoc = require('@antora/asciidoc-loader')
const publishSite = require('@antora/site-publisher')
const { resolveConfig: resolveAsciiDocConfig } = loadAsciiDoc

//const CSV_DELIM = '\t'
const CSV_DELIM = ','
const LF = '\n'

function quote (str) {
  return str ? '"' + str.replace(new RegExp('"', 'g'), '""') + '"' : '';
}

module.exports = async (args, env) => {
  const serverVersion = env.SERVER_VERSION || '5.5'
  const playbook = buildPlaybook(args, env)
  const contentCatalog = await aggregateContent(playbook).then((contentAggregate) => classifyContent(playbook, contentAggregate))
  const asciidocConfig = resolveAsciiDocConfig(playbook)
  const records = contentCatalog.findBy({ component: 'server', version: serverVersion, family: 'page' }).map((file) => {
    const doc = loadAsciiDoc(file, contentCatalog, asciidocConfig)
    return [
      file.src.path,
      file.src.module,
      file.src.relative,
      quote(doc.getDocumentTitle()),
      doc.getAttribute('page-topic-type', 'topic'),
      quote(doc.getAttribute('description', '')),
      //doc.getAttribute('keywords', ''),
      quote(doc.$sections().map((s) => s.title).join('\n')),
    ]
  }).sort((a, b) => a[4].localeCompare(b[4]) || a[0].localeCompare(b[0]))
  const report = [
    ['path in git', 'module', 'relative path', 'document title', 'topic type', 'description', 'sections'].join(CSV_DELIM)
  ].concat(records.map((record) => record.join(CSV_DELIM))).join(LF)
  const reportFile = { contents: Buffer.from(report), out: { path: `file-report-server-${serverVersion}.csv` } }
  return publishSite(playbook, [{ getFiles: () => [reportFile] }])
}
