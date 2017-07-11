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
console.log(argv);

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
      const modules = data.map(mapModule).join('\n');
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
  const version = module['generated-with-elm-version'];
  const { name, comment } = module;
  // {
  //   name -> file name
  //   comment -> module description
  //   aliases -> aliastes present in module
  //     {
  //     }
  //   types -> types present in module
  //     {
  //       name
  //       comment
  //       args,
  //       cases ->
  //     }
  //   values -> functions present in module
  //     {
  //       name
  //       comment
  //       type
  //     }
  //   generated-with-elm-version -> elm version
  // }
  const mapFunctions = {
    aliases: mapAlias,
    types: mapType,
    values: mapValue
  };

  const dict = Object.keys(mapFunctions).reduce(
    (acc, key) => module[key].reduce(mapFunctions[key], acc),
    {}
  );

  const moduleBody = comment
    .split('\n')
    .map(line => mapCommentLine(line, dict))
    .filter(l => l.length > 0)
    .join('\n');

  return `
## ${name}

${moduleBody}
> Generated with elm-make: ${version} and elm-docs: ${VERSION}
---
`;
}

function mapType(dict, type) {
  return dict;
}

function mapAlias(dict, alias) {
  return dict;
}

function mapValue(dict, value) {
  const { name, type, comment } = value;
  const string = `
#### \`${name} : ${type}\`
${comment}
`;
  // TODO: add comment parsing for elm code samples
  return Object.assign({}, dict, { [name]: string });
}

function mapCommentLine(line, dict) {
  // starts with @docs -> throw away
  const docsTest = /^@docs\s/;
  if (docsTest.test(line)) {
    return line.replace(docsTest, '').split(',').map(key => dict[key]).join('');
  }
  // starts with # -> append ##
  if (/^#\s[a-z]/i.test(line)) return `#${line}`;
  return line;
}
