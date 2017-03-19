const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();

const describe = lab.describe;
const it = lab.it;
const before = lab.before;
const after = lab.after;
const expect = Code.expect;

const fs = require('fs-extra');
const path = require('path');

var service = require('./../browserifyService.js')();

describe('using browserifyService to broker js', () => {

	var builder;

    before((done) => {
        done();
    });

    after((done) => {
        done();
    });

    it('brokers some requires ', (done) => {
	
		var js = service.require(['underscore', 'bluebird']);
        expect(js).to.not.equal('');
		
		done();
    });

});