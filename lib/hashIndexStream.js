const crypto = require('crypto');
const through = require('through2');

module.exports = function hashIndexStream() {

  const index = {};

  function collectHash(file, enc, done) {
    if (file.isNull()) {
      return done();
    }

    if (file.isStream()) {
      done(new TypeError('no vinyl files with content streams supported.'))
    }

    index[file.relative] = crypto.createHash('md5').update(file.contents, 'utf8').digest('hex');
    done();
  }

  function emitIndex(done) {
    return done(null, index);
  }

  return through.obj(collectHash, emitIndex)

};