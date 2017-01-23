const app = require('express')();

const middleware = require('../lib/middleware');

const mockfs = require('mock-fs');

mockfs({
  'ui/bla.js': 'foo',
  'ui/blub.js': mockfs.symlink({
    path: 'bla.js'
  })
});

app.use(middleware(['ui']));
app.listen(5000, function () {
  console.log('started app on port 5000 - go to /sap-ui-cachebuster-info.json');
});