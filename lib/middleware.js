'use strict';

const vinylfs = require('vinyl-fs');
const express = require('express');
const streamToPromise = require('stream-to-promise');
const values = require('core-js/library/fn/object/values');
const path = require('path');
const hashIndexStream = require('./hashIndexStream');
const debug = require('gulp-debug');
const fs = require('fs');

const regexUrlStartsWithMD5Hash = /\/~([a-f0-9]*)~\//;

const t1Day = 3600000;

const defaults = {
  maxAge: t1Day * 90,
  fileName: 'sap-ui-cachebuster-info.json',
  baseDir: process.cwd()
};

module.exports = function (pathsToCache, options) {

  const pathsToCacheMap = {};

  if (Array.isArray(pathsToCache)) {
    pathsToCache.forEach(path => {
      const isFile = fs.lstatSync(path).isFile();
      pathsToCacheMap[path] = isFile ? path : path + '/**/*';
    });
  } else throw new TypeError('first param `dirsToCache` must be an array of path names');

  options = Object.assign({}, defaults, options);

  const indexFileName = options.fileName;

  const staticMiddlewareNoCache = createMultiPathStaticMiddleware(Object.keys(pathsToCacheMap));
  let staticMiddlewareWithCache = createMultiPathStaticMiddleware(Object.keys(pathsToCacheMap), {maxAge: 500000});

  const indexFileP = createIndexFileFromGlobPatterns(values(pathsToCacheMap), options.baseDir)
    .catch(e => {
      console.trace('error while attempting to create cache-buster index file.', e);
      throw e;
    });

  const middleware = function middleware(req, res, next) {

    return indexFileP.then(indexFile => {
      if (req.path === '/' + indexFileName) {
        res.type('json').send(JSON.stringify(indexFile, null, '\t'));
      } else {
        const matches = regexUrlStartsWithMD5Hash.exec(req.path);
        if (matches && values(indexFile).indexOf(matches[1]) !== -1) {
          req.url = req.url.replace(regexUrlStartsWithMD5Hash, '/');
          return staticMiddlewareWithCache(req, res, next);
        } else {
          return staticMiddlewareNoCache(req, res, next);
        }
      }
    })
      .catch(next);
  };

  middleware.initialized = indexFileP;

  return middleware;

};


function createMultiPathStaticMiddleware(paths, options) {
  const router = express.Router();
  paths.forEach(path => router.use('/' + path, express.static(path, options)));
  return router;
}

function createIndexFileFromGlobPatterns(globPatterns, baseDir) {
  return streamToPromise(vinylfs.src(globPatterns, {base: baseDir}).pipe(hashIndexStream())).then(results => results[0]);
}

