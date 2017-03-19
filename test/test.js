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

var fluid = require('./../fluid.js')();

describe('using fluid ', () => {

	var builder;

    before((done) => {
        done();
    });

    after((done) => {
        done();
    });

    it('creates a task and clones it', (done) => {
	
		//create a simple task
		var task = fluid.task.new(function increment(val){return val + 1;}, 10);

		//it hasn't run yet, so clone it
		var taskData = task.serialize();
		var cloneTask = fluid.task.empty().deserialize(taskData);

		expect(cloneTask.returnValue).to.equal(undefined);
		expect(cloneTask.state).to.equal('stopped');

		//run the clone
		cloneTask.perform();
		expect(cloneTask.returnValue).to.equal(11);
		expect(cloneTask.state).to.equal('completed');

		//serialize/deserialize again to see if the result is preserved
		var cloneTask2 = fluid.task.empty().deserialize(cloneTask.serialize());
		expect(cloneTask2.returnValue).to.equal(11);
		expect(cloneTask2.state).to.equal('completed');
		
		done();
    });
	it('decorates a task with definitionness', (done) => {

		var task = fluid.task.new(function increment(val){return val + 1;}, 10);
		var taskDef = task.decorate("definition");

		//similarly, decorate the definition with clauses, so the verb is "has".  it's the planning corollary to "decorate"
		taskDef.has("beer",['fox','chamblis','vox']).has("stupidity").has("sweetride",[]).has("startDate", [undefined]);

		//serialize/deserialize
		var task2 = fluid.task.empty().deserialize(taskDef.serialize());

		expect(task2.clauses.length).to.equal(4);
		expect(task2.clauses[0].decorationName).to.equal('beer');
		expect(task2.clauses[0].args[0]).to.equal('fox');
		expect(task2.clauses[0].args[1]).to.equal('chamblis');
		expect(task2.clauses[0].args[2]).to.equal('vox');

		expect(task2.clauses[1].decorationName).to.equal('stupidity');
		expect(task2.clauses[1].args).to.equal(undefined);

		expect(task2.clauses[2].decorationName).to.equal('sweetride');
		expect(task2.clauses[2].args).to.equal([]);

		expect(task2.clauses[3].decorationName).to.equal('startDate');
		expect(task2.clauses[3].args[0]).to.equal(undefined);
			
		done();
    });
	it('puts a condition on a task', (done) => {
	
		var task = fluid.task.new(function increment(val){return val + 1;}, 10);
		var neverTask = task.decorate("when", function never(){return false;});

		//this will prevent a perform from happening
		neverTask.perform();
		expect(neverTask.returnValue).to.equal(undefined);
		expect(neverTask.state).to.equal('stopped');

		//create a task that will only run if a flag is on
		var isOn = false;
		var isOnTask = task.decorate("when", function (){return isOn;});
		isOnTask.perform();
		expect(isOnTask.returnValue).to.equal(undefined);
		expect(isOnTask.state).to.equal('stopped');

		//now switch it on
		isOn = true;
		isOnTask.perform();
		expect(isOnTask.returnValue).to.equal(11);
		expect(isOnTask.state).to.equal('completed');
		
		done();
    });
	it('gives a task definitionness and a backing file for it', (done) => {
	
		var task = fluid.task.new(function increment(val){return val + 1;}, 10)
		.decorate("definition")
		.has("beer",['fox','chamblis','vox']).has("stupidity").has("sweetride",[]).has("startDate", [undefined])
		.decorate("definitionAtFile", "definition.txt");
		
		task.save();
		expect(fs.existsSync("definition.txt")).to.equal(true);
			
		var loadedDef = Task.empty().decorate("definition").decorate("definitionAtFile", "definition.txt");
		loadedDef.load();
		expect(loadedDef.clauses.length).to.equal(4);
		expect(loadedDef.clauses[0].decorationName).to.equal('beer');
		expect(loadedDef.clauses[0].args[0]).to.equal('fox');
		expect(loadedDef.clauses[0].args[1]).to.equal('chamblis');
		expect(loadedDef.clauses[0].args[2]).to.equal('vox');

		expect(loadedDef.clauses[1].decorationName).to.equal('stupidity');
		expect(loadedDef.clauses[1].args).to.equal(undefined);

		expect(loadedDef.clauses[2].decorationName).to.equal('sweetride');
		expect(loadedDef.clauses[2].args).to.equal([]);

		expect(loadedDef.clauses[3].decorationName).to.equal('startDate');
		expect(loadedDef.clauses[3].args[0]).to.equal(undefined);
		done();
    });
	
	it('gives a stopped task startyness', (done) => {

		var sides = ['left','right'];
		var members = ['foot','hand','knee','toe'];
		var danceMoves = [];
		
		var restartyTask = fluid.task.new(function hokeypokey(side, member)
		{
			var activity = side + " " + member ;
			danceMoves.push("put your " + activity + " in");
			danceMoves.push("put your " + activity + " out");
			danceMoves.push("do the hokey pokey and turn yourself about");
		}, [sides[0],members[0]).decorate("stoppedTaskStarter");
				
		restartyTask.start(3);	

		setTimeout(()=>
		{
			expect(danceMoves.length).to.equal(3);
		}, 4000);
		
		done();
    });
	
	it('spins up a task endpoint to handle task CRUD', (done) => {
	
		done();
    });

	it('reports a task as HTML', (done) => {
	
		done();
    });

	it('tests a task UI', (done) => {
	
		done();
    });
});