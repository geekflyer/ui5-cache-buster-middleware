process.env.NODE_ENV = 'development';
global.Promise = require('bluebird');
global.chai = require('chai');
global.should = chai.should();
chai.use(require('chai-as-promised'));
// const sinonChai = require('sinon-chai');
// chai.use(sinonChai);
