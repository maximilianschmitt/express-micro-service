'use strict';

let co           = require('co');
let express      = require('express');
let bodyParser   = require('body-parser');
let objectAssign = require('object-assign');

let service = function(service, endpoints) {
  let app = express();
  app.use(bodyParser.json());

  endpoints.forEach(endpoint => {
    app.post('/' + endpoint.method, function(req, res) {
      let payload = req.body;

      co(function*() {
        try {
          let response = { success: true };
          response[endpoint.returns] = yield service[endpoint.method](payload);
          res.json(response);
        } catch(err) {
          let httpError = false;

          if (err.data && err.data.error && err.data.error.name) {
            httpError = err.data.error;
          }

          if (!endpoint.catch || endpoint.catch.indexOf(httpError ? httpError.name : err.name) === -1) {
            console.log(err);
            if (err.stack) {
              console.log(err.stack);
            }

            res.status(500).json({ error: { name: 'Error', message: 'An unexpected error occurred. ' } });
            process.exit(1);
          }

          if (httpError) {
            res.status(400).json({ error: httpError });
            return;
          }

          res.status(400).json({ error: objectAssign({ name: err.name }, err) });
        }
      })
      .catch(function(err) {
        console.log(err);
        if (err.stack) {
          console.log(err.stack);
        }
        process.exit(1);
      });
    });
  });

  return app;
};

module.exports = service;