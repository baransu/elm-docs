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
const DOCS_TEST = /^@docs\s/;

// NOTE: We have to store all used names for proper anchor creation
let usedNames = [];

const argv = require('minimist')(process.argv.slice(2));

if (argv['h'] || argv['help']) {
  console.log(
    `elm-docs: ${VERSION}

Usage: elm-docs [--output FILE]

Available options:
  -h,--help                Show this help text
  -v,--version             Show elm-docs version
  -o,--output FILE         Write result to the given FILE.

Examples:
  elm-docs                            # generate documentation to DOCS.md
  elm-docs --output DOCUMENTATION.md  # generate documentation to DOCUMENTATION.md`
  );
  process.exit(0);
}

if (argv['v'] || argv['version']) {
  console.log(`elm-docs: ${VERSION}`);
  process.exit(0);
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
      const count = data.length;
      if (count === 0) {
        console.log('Found 0 modules from elm-make --docs');
        process.exit(1);
      }

      const version = data[0]['generated-with-elm-version'];

      const tableOfContent = data
        .map(module => `- [${module.name}](#${makeAnchor(module.name)})`)
        .join('\n');

      const modules = `# Modules
${tableOfContent}
${data.map(mapModule).join('\n')}
> Generated with elm-make: ${version} and elm-docs: ${VERSION}
`;

      fs.writeFileSync(path.join(WORKING_DIR, OUTPUT), modules);
      console.log(
        `Successfully generated documentation for ${count} modules into ${OUTPUT}`
      );
    });
  });
} else {
  console.error(
    `I couldn't find elm-package.json. Make sure you are in correct directory.`
  );
}

function sanitizeKey(key) {
  return key.trim().replace(/\(|\)/g, '');
}

function getUsedNames(module) {
  return module.comment.split('\n').reduce((acc, line) => {
    if (DOCS_TEST.test(line)) {
      return acc.concat(
        line.replace(DOCS_TEST, '').split(', ').map(sanitizeKey)
      );
    }
    return acc;
  }, []);
}

function makeAnchor(name) {
  const duplicates = usedNames.filter(p => p === name).length;
  const suffix = duplicates > 1 ? `-${duplicates - 1}` : '';
  return name.toLowerCase().replace(/\./g, '').replace(/\s/g, '-') + suffix;
}

function mapModule(module) {
  const { name, comment } = module;

  // NOTE: We're storing all previously used names for proper anchoring
  usedNames = usedNames.concat(getUsedNames(module));

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

  const definitions = getUsedNames(module)
    .map(name => `- [${name}](#${makeAnchor(name)})`)
    .join('\n');

  return `
# ${name}
${definitions}

${moduleBody}
`;
}

function mapType(dict, type) {
  const { name, comment, args, cases } = type;
  const string = `
### \`${name}\`
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
### \`${name}\`
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
  if (DOCS_TEST.test(line)) {
    return line
      .replace(DOCS_TEST, '')
      .split(', ')
      .map(key => dict[sanitizeKey(key)])
      .join('');
  }
  // starts with # -> append ##
  if (/^#\s[a-z]/i.test(line)) return `#${line}`;
  return line;
}
