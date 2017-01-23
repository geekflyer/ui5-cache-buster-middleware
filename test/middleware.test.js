'use strict';
const Vinyl = require('vinyl');
const hashIndexStream = require('../lib/hashIndexStream');
const cacheBusterMiddleware = require('../lib/middleware');
const express = require('express');
const mockfs = require('mock-fs');
const request = require('supertest');

const testFiles = {
  file1: {
    content: 'bar',
    path: 'ui/foo.js',
    md5: '37b51d194a7513e45b56f6524f2d51f2'
  },
  file2: {
    content: 'asdf',
    path: 'node_modules/bluebird/js/browser/bluebird.min.js',
    md5: '912ec803b2ce49e4a541068d495ab570'
  }
};

const FILE1 = testFiles.file1;
const FILE2 = testFiles.file2;

let app;
beforeEach(function () {
  app = express();
});

describe('hash index transform stream', function () {

  it('hash index stream receives vinyl files and returns an object with filepaths as keys and md5 hashes as values', function (done) {
    const stream = hashIndexStream();

    stream.write(new Vinyl({
      cwd: '/',
      base: '/test/',
      path: '/test/file.js',
      contents: new Buffer('var x = 123')
    }));

    stream.write(new Vinyl({
      cwd: '/',
      base: '/test/',
      path: '/test/file2.js',
      contents: new Buffer('var x = 123')
    }));

    stream.on('data', function (hashIndex) {
      hashIndex.should.deep.equal({
        "file.js": "ae7bddf0383d1c313dbda37c1b7561f0",
        "file2.js": "ae7bddf0383d1c313dbda37c1b7561f0"
      });
      done();
    });

    stream.on('error', console.trace);

    stream.end();

  });
});

describe('middleware', function () {

  before(function () {
    mockfs({
      [FILE1.path]: FILE1.content,
      [FILE2.path]: FILE2.content,
      'ui/foolink.js': mockfs.symlink({
        path: 'foo.js'
      })
    });

    app.use(cacheBusterMiddleware(['ui', FILE2.path], {maxAge: 500 * 1000}));

    this.client = request.agent(app);
  });

  after(function () {
    mockfs.restore();
  });

  it('retrieve buster info', function () {
    return this.client.get('/sap-ui-cachebuster-info.json')
      .then(res => {
        res.status.should.equal(200);
        res.body.should.deep.equal({
          [FILE2.path]: FILE2.md5,
          [FILE1.path]: FILE1.md5,
          'ui/foolink.js': FILE1.md5
        });
      });
  });

  it('get cached file - headers are set to specified max age', function () {
    return this.client
      .get(`/~${FILE1.md5}~/${FILE1.path}`)
      .then(res => {
        res.headers['cache-control'].should.equal('public, max-age=500');
        res.status.should.equal(200);
        res.text.should.equal('bar');
      });
  });

  it('symlinked files can also be retrieved and are hashed', function () {
    return this.client
      .get(`/~${FILE1.md5}~/ui/foolink.js`)
      .then(res => {
        res.text.should.equal('bar');
      });
  });

  it('when using a regular path without a hash it just returns the file with header set as max-age=0', function () {
    return this.client
      .get(`/${FILE1.path}`)
      .then(res => {
        res.headers['cache-control'].should.equal('public, max-age=0');
        res.text.should.equal('bar');
      });
  });

  it('when using an invalid hash in the path it will just respond with a 404', function () {
    return this.client
      .get(`/~123455667abcd~/${FILE1.path}`)
      .then(res => {
        res.status.should.equal(404);
      });
  });

  it('middleware exposes promise `initialized` which signals completion / failure of hash index creation', function () {
    return cacheBusterMiddleware(['ui']).initialized.should.be.fullfilled;
  });

  it('if a wrong path is passed to the middleware factory it will throw an exception', function () {
    (() => cacheBusterMiddleware(['path/does/not/exist'])).should.throw();
  });

});