#! /usr/bin/env node

const { compileToString } = require('node-elm-compiler');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const pkg = require('./package.json');

const VERSION = pkg.version;
const TMP_DOCS = '.elm-docs';
const WORKING_DIR = process.cwd();
const ELM_PACKAGE_PATH = path.join(WORKING_DIR, 'elm-package.json');
const ELM_MAKE_DOCS_OUTPUT = path.join(WORKING_DIR, TMP_DOCS);

const argv = require('minimist')(process.argv.slice(2));
// console.log(argv);

if (argv['h'] || argv['help']) {
  // TODO: show help and gracefully exit with 0
}

if (argv['v'] || argv['version']) {
  // TODO: show version and gracefully exit with 0
}

const OUTPUT = argv['o'] || argv['output'] || 'DOCS.md';

const isElmPackagePresent = fs.existsSync(ELM_PACKAGE_PATH);
if (isElmPackagePresent) {
  exec(`elm-make --yes --docs=${TMP_DOCS}`, (err, stdout, stderr) => {
    if (err) throw err;
    fs.readFile(ELM_MAKE_DOCS_OUTPUT, (err, file) => {
      if (err) throw err;
      fs.unlinkSync(ELM_MAKE_DOCS_OUTPUT);
      const data = JSON.parse(file);
      const version = data[0]['generated-with-elm-version'];
      const modules = data.map(mapModule).join('\n').concat(
        `---
> Generated with elm-make: ${version} and elm-docs: ${VERSION}`
      );

      // TODO: spis tresci
      fs.writeFileSync(path.join(WORKING_DIR, OUTPUT), modules);
    });
  });
} else {
  console.error(
    `I couldn't find elm-package.json. Make sure you are in correct directory.`
  );
}

function mapModule(module) {
  const { name, comment } = module;
  const mapFunctions = {
    aliases: mapAlias,
    types: mapType,
    values: mapValue
  };

  const dict = Object.keys(mapFunctions).reduce(
    (acc, key) => module[key].reduce(mapFunctions[key], acc),
    { '@@module': name }
  );

  const moduleBody = comment
    .split('\n')
    .map(line => mapCommentLine(line, dict))
    .filter(l => l.length > 0)
    .join('\n');

  return `
# ${name}
${moduleBody}
`;
}

function mapType(dict, type) {
  const { name, comment, args, cases } = type;
  const string = `
### \`type ${name}\`
\`\`\`elm
type ${name} ${args.join(' ')}
    = ${cases.map(c => `${c[0]} ${c[1].join(' ')}`).join('\n    | ')}
\`\`\`
${comment}
---
`;
  return Object.assign({}, dict, { [name]: string });
}

function mapAlias(dict, alias) {
  const { name, comment, type, args } = alias;
  const string = `
### type alias \`${name}\`
\`\`\`elm
type alias ${name} ${args.join(' ')} =
    ${type}
\`\`\`
${comment}
---
`;
  return Object.assign({}, dict, { [name]: string });
}

function mapValue(dict, value) {
  const { name, type, comment } = value;
  const regex = /^([\s]{4}.*)+/gm;
  const wrapper = match =>
    `\`\`\`elm\n${match
      .split('\n')
      .filter(l => l.length > 0)
      .map(l => l.replace(/^\s{4}/g, ''))
      .join('\n')}\n\`\`\``;

  const string = `
### \`${name}\`
\`\`\`elm
${name} : ${type.replace(new RegExp(`${dict['@@module']}.`, 'g'), '')}
\`\`\`
${comment}
---
`.replace(regex, wrapper);
  return Object.assign({}, dict, { [name]: string });
}

function mapCommentLine(line, dict) {
  // starts with @docs -> get from dict
  const docsTest = /^@docs\s/;
  if (docsTest.test(line)) {
    return line
      .replace(docsTest, '')
      .split(', ')
      .map(key => dict[key])
      .join('');
  }
  // starts with # -> append ##
  if (/^#\s[a-z]/i.test(line)) return `#${line}`;
  return line;
}
