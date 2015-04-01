/* global describe, it */
'use strict';

require('co-mocha');

let exec        = require('child_process').exec;
let chai        = require('chai');
let axios       = require('axios');
let service     = require('..');
let expect      = chai.expect;

chai.use(require('chai-as-promised'));

describe('express-micro-service', function() {
  it('exposes methods via post', function*() {
    let server = yield start('echoing-service');
    let request = post('/echo', { some: 'data' });

    return expect(request)
      .to.eventually.be.fulfilled
      .then((res) => {
        expect(res.data).to.deep.equal({ success: true, echoed: { some: 'data' }});
        server.kill();
      });
  });

  it('returns 400 for known errors', function*() {
    let server = yield start('known-error-service');
    let request = post('/erroring');

    return Promise
      .all([
        request.catch((res) => {
          expect(res.status).to.equal(400);
          expect(res.data).to.deep.equal({ error: { name: 'SomeKnownError', message: 'an error message' }});
        }),
        expect(request).to.eventually.be.rejected
      ])
      .then(() => server.kill());
  });

  it('returns 500 for unknown errors', function*() {
    let server = yield start('unkown-error-service');
    let request = post('/erroring');

    return Promise
      .all([
        request.catch((res) => {
          expect(res.status).to.equal(500);
          expect(res.data).to.deep.equal({ error: { name: 'Error', message: 'An unexpected error occurred.' }});
        }),
        expect(request).to.eventually.be.rejected
      ])
      .then(() => server.kill());
  });

  it('supports multiple return values', function*() {
    let server = yield start('multiple-return-values-service');
    let request = post('/brothers');

    return expect(request)
      .to.eventually.be.fulfilled
      .then((res) => {
        expect(res.data).to.deep.equal({ success: true, max: 'my name is max', julian: 'my name is julian' });
        server.kill();
      });
  });

  it('crashes on unkown errors', function(done) {
    start('unkown-error-service')
      .then(function(server) {
        server.on('exit', (code) => {
          expect(code).to.equal(1);
          done();
        });

        return post('/erroring').catch(()=>{});
      })
      .catch(done);
  });

  it('returns 500 for unexpected http errors', function*() {
    let server = yield start('unkown-http-error-service');
    let request = post('/erroring');

    return Promise
      .all([
        request.catch((res) => {
          expect(res.status).to.equal(500);
          expect(res.data).to.deep.equal({ error: { name: 'Error', message: 'An unexpected error occurred.' }});
        }),
        expect(request).to.eventually.be.rejected
      ])
      .then(() => server.kill());
  });
});

function start(service) {
  let started = false;

  return new Promise((resolve, reject) => {
    let p = exec('SERVICE_PORT=3333 node ' + __dirname + '/fixtures/' + service + '.js');

    p.stdout.on('data', function(data) {
      if (!started && data.indexOf('Listening') !== -1) {
        started = true;
        resolve(p);
      }
    });

    p.stderr.on('data', function(data) {
      if (!started) {
        reject(data);
      }
    });

    process.on('exit', () => p.kill());
  });
}

function post(method, data) {
  return axios.post('http://localhost:3333' + method, data);
}