#!/usr/bin/env node
var fs     = require('fs');
var path   = require('path');
var script = path.basename(__filename);

var srcDir = process.argv[2];
if (!srcDir) {
  var args = [];
  args[0] = process.argv[0].indexOf(' ') !== -1
    ? '"' + process.argv[0] + '"'
    : process.argv[0];
  args[1] = process.argv[1].indexOf(' ') !== -1
    ? '"' + process.argv[1] + '"'
    : process.argv[1];
  args[2] = path.join('path', 'to', 'mysql', 'src');
  console.error('Usage: ' + args.join(' '));
  process.exit(1);
}

var codes      = [];
var targetFile = path.join(__dirname, '..', 'lib', 'protocol', 'constants', 'errors.js');
var previous   = fs.existsSync(targetFile) ? require(targetFile) : {};
var stream     = fs.createWriteStream(targetFile);
var version    = extractMySqlVersion(srcDir);

appendGlobalErrorCodes(srcDir, codes);
appendDatabseErrorCodes(srcDir, codes);
appendSqlErrorCodes(srcDir, codes);
keepUnusedCodes(previous, codes);

stream.write('/**\n * MySQL error constants\n *\n * Extracted from version ' + version + '\n *\n * !! Generated by ' + script + ', do not modify by hand !!\n */\n\n');

var alignment = codes.reduce(maxLength, 0);
for (var i = 0; i < codes.length; i++) {
  if (i in codes) {
    stream.write('exports.' + codes[i] + (new Array(alignment - codes[i].length + 1)).join(' ') + ' = ' + i + ';\n');
  }
}

stream.write('\n// Lookup-by-number table\n');

var alignment = String(codes.length).length;
for (var i = 0; i < codes.length; i++) {
  if (i in codes) {
    stream.write('exports[' + i + ']' + (new Array(alignment - String(i).length + 1)).join(' ') + ' = \'' + codes[i] + '\';\n');
  }
}

function appendGlobalErrorCodes(srcDir, codes) {
  var headerFile = path.join(srcDir, 'include', 'mysys_err.h');
  var code       = '';
  var contents   = fs.readFileSync(headerFile, 'ascii');
  var block      = false;
  var match      = null;
  var num        = 0;
  var regexp     = /#define +(EE_[A-Z0-9_]+)\s+([0-9]+)/mg;

  while ((match = regexp.exec(contents))) {
    code = match[1];
    num  = Number(match[2]);

    if (!block) {
      block = code === 'EE_ERROR_FIRST';
      continue;
    }

    if (code === 'EE_ERROR_LAST') {
      break;
    }

    codes[num] = code;
  }

  return codes;
}

function appendDatabseErrorCodes(srcDir, codes) {
  var headerFile = path.join(srcDir, 'include', 'my_base.h');
  var code       = '';
  var contents   = fs.readFileSync(headerFile, 'ascii');
  var block      = false;
  var match      = null;
  var num        = 0;
  var regexp     = /#define +(HA_[A-Z0-9_]+)\s+([0-9]+)/mg;

  while ((match = regexp.exec(contents))) {
    code = match[1];
    num  = Number(match[2]);

    if (!block) {
      block = code === 'HA_ERR_FIRST';
      continue;
    }

    if (code === 'HA_ERR_LAST') {
      break;
    }

    codes[num] = code;
  }

  return codes;
}

function appendSqlErrorCodes(srcDir, codes) {
  var errorFile = path.join(srcDir, 'sql', 'share', 'errmsg-utf8.txt');
  var contents  = fs.readFileSync(errorFile, 'utf-8');
  var sections  = contents.split(/^start-error-number (\d+)$/m);

  for (var i = 1; i < sections.length; i += 2) {
    var offset = Number(sections[i]);
    var names  = sections[i + 1].match(/^([A-Z0-9_]+)/mg).map(fixupCode);

    for (var j = 0; j < names.length; j++) {
      codes[offset + j] = names[j];
    }
  }

  return codes;
}

function extractMySqlVersion(srcDir) {
  var versionFile = path.join(srcDir, 'VERSION');
  var contents    = fs.readFileSync(versionFile, 'utf-8');
  var dictionary  = Object.create(null);

  contents.split('\n').forEach(function (line) {
    var pair = line.split('=');
    var key  = pair[0];
    var val  = pair.slice(1).join('=').trimRight();
    dictionary[key] = val;
  });

  return dictionary.MYSQL_VERSION_MAJOR + '.' +
    dictionary.MYSQL_VERSION_MINOR + '.' +
    dictionary.MYSQL_VERSION_PATCH;
}

function fixupCode(code) {
  return code
    // remove obsolete markers
    .replace('ER_OBSOLETE_', 'ER_')
    // remove unused markers
    .replace(/(?:_OLD)?_+UNUSED$/, '');
}

function keepUnusedCodes(previousCodes, currentCodes) {
  for (var i = 0; i < currentCodes.length; i++) {
    if (/^ER_UNUSED\d*$/.test(currentCodes[i]) && previousCodes[i]) {
      currentCodes[i] = previousCodes[i];
    }
  }
}

function maxLength(max, value) {
  return Math.max(max, value.length);
}
