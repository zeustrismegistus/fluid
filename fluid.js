(function () {
	
	const jsmeta = require('d__jsmeta');
	const mutator = require('d__mutator');
	const fs = require('fs-extra');
	const path = require('path');

	//define the structure of the core unit of work
	const Task = function (fn,args)
	{
		jsmeta.validators.validateIsFunction(fn);
		jsmeta.validators.validateIsArray(args);
		
		//privates
		var that = this;
		var __state = 'stopped';
		
		//publics	
		this.args = args;
		this.behaviour = fn;
		this.result = undefined;
		this.error = undefined;
		
		Object.defineProperty(this, "state", 
		{ 
			get : function() {return  __state;},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(this, "perform", 
		{ 
			value : function() 
			{
				'use strict';
				try
				{
					that.result = that.behaviour.apply(null, that.args); 
					that.markCompleted();
				}
				catch(e)
				{
					that.error = e;
					that.markErrored();
				}
				
				return that;
			},
			enumerable: true,
			configurable: false
		});

		Object.defineProperty(this, "markRunning",
		{
			value : function() {__state = 'running';},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(this, "markStopped",
		{
			value : function() {__state = 'stopped';},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(this, "markCompleted",
		{
			value : function() {__state = 'completed';},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(this, "markErrored",
		{
			value : function() {__state = 'errored';},
			enumerable: true,
			configurable: false
		});
		
		//import export
		Object.defineProperty(this, "serialize",
		{
			value : function() 
			{
				var data = {args: that.args, behaviour: that.behaviour, state: __state, result: that.result, error: that.error};
				return jsmeta.JSONSerializer.serialize(data);
			},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(this, "deserialize",
		{
			value : function(data) 
			{
				var data = jsmeta.JSONSerializer.deserialize(data);
				that.args = data.args;
				that.behaviour = data.behaviour;
				__state = data.state;
				that.result = data.result;
				that.error = data.error;
				
				return that;
			},
			enumerable: true,
			configurable: false
		});
	};

	(()=>{
		Task.new = function(fn, args){return new Task(fn, args);};
		
		Task.empty = function(){return new Task(()=>{},[]);};
	})();

	//create a repo of mutations that we can register our behaviours to
	const TM = mutator.mutationDictionary.new();

	(()=>{
		
		//extend task with a fluent decorator that links to Dictionary
		Object.defineProperty(Task.prototype, "mutate",
		{
			value : function(mutationName)
			{
				var args = [this].concat(Array.prototype.slice.call(arguments).slice(1));
				
				return TM.as(mutationName).apply(null, args); 
			},
			enumerable: true,
			configurable:false
		});
		
		Object.freeze(Task);
		
	})();

	//decorates task.  exposes ability to define a task and its decorations without invoking things
	function TaskDefinition(task)
	{
		jsmeta.validators.assert(()=>{return task instanceof Task;});
		
		//decorate 
		Seed.new(task).decorate(this);
		
		//privates
		var that = this;
		var __clauses = [];
		
		//publics
		this.has = function(decorationName, args)
		{
			jsmeta.validators.isNotNullOrUndefined(decorationName);
			jsmeta.validators.isArray(args);
			//args = Array.prototype.slice.call(arguments).slice(1);
			
			__clauses.push({decorationName: decorationName, args:args});
			return that;
		};
		Object.defineProperty(that, "clauses",
		{
			get : function()
			{
				return __clauses;
			},
			enumerable:true,
			configurable:false
		});	
		//import export
		this.serialize = function()
		{
			var data = {root: that.__decorated.serialize(), clauses : __clauses};
			return jsmeta.JSONSerializer.serialize(data);
		};
		this.deserialize = function(data)
		{
			var dataObj = jsmeta.JSONSerializer.deserialize(data);
			
			that.__decorated = dataObj.root;
			__clauses = data.clauses;
			
			return that;
		}
	};
			
	(()=>{
		Object.freeze(TaskDefinition);
		
		TM.add("definition", (task)=>{return new TaskDefinition(task);})
		
		
	})();
		
	//ok, so now we haven't affected the task behaviour yet, other than give the task an ability to plan
	//let's add a condition that changes behaviour
	function TaskWhen (task, /*expects function(task,..) that returns bool*/conditionFn)
	{
		jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
		//jsmeta.validators.assert(()=>{return jsmeta.hasFunctionArgNames(conditionFn, ['task','args']);});//enforce signature smells

		//decorate 
		Seed.new(task).decorate(this);
		
		//privates
		var that = this;
		var __conditionFn = conditionFn;
		
		//overrides
		Object.defineProperty(that, "perform", 
		{ 
			get : function() 
			{
				'use strict';
				if(conditionFn())
					that.__decorated.perform();
				
				return that;
			},
			enumerable: true,
			configurable: false
		});
	};

	(()=>{
		Object.freeze(TaskWhen);
		
		TM.add("when", (task,conditionFn)=>{return new TaskWhen(task, conditionFn);})
	})();

	//now we want to decorate the ability to save tasks to a file
	function TaskDefinitionAtFile (task, filePath)
	{
		jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
		jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(TaskDefinition);});//validate we have a definition in the stack
		jsmeta.validators.validateNotNullOrEmpty(filePath);

		//decorate 
		Seed.new(task).decorate(this);
		
		//privates
		var that = this;
		var __filePath = filePath;
		
		//behaviour
		Object.defineProperty(that, "save", 
		{ 
			get : function() 
			{
				'use strict';
				
				//go to the task definition and serialize things
				var data = that.doAsInstanceOf(TaskDefinition).serialize();
				
				//write to file
				fs.writefileSync(__filePath, data);
				
				return that;
			},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(that, "load", 
		{ 
			get : function() 
			{
				'use strict';
				var data = fs.readFileSync(__filePath);
				
				that.doAsInstanceOf(TaskDefinition).deserialize(data);
				return that;
			},
			enumerable: true,
			configurable: false
		});
	};

	(()=>{
		Object.freeze(TaskDefinitionAtFile);

		TM.add("definitionAtFile", (task,filePath)=>{return new TaskDefinitionAtFile(task, filePath);})

	})();

	//so now we have the ability to plan tasks, and save them to file, and to run them on a condition of our choosing
	//we want to add some logic to start the task automatically, and to keep trying if it's stopped
	function StoppedTaskStarter (task, pollingIntervalSecs)
	{
		jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
		jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(TaskDefinition);});//validate we have a definition in the stack
		pollingIntervalSecs = pollingIntervalSecs || 20;
		
		//decorate task with a condition first that will only perform the task if it's stopped
		var whenFn = function(task){return task.status === 'stopped';};
		var whenTask = task.mutate("when", whenFn);

		//now decorate this with the whenTask	
		Seed.new(whenTask).decorate(this);
		
		//privates
		var that = this;
		var __pollingIntervalSecs = pollingIntervalSecs;
		var __interval = null;

		//publics
		Object.defineProperty(that, "start", 
		{ 
			get : function() 
			{
				that.stop();
				__interval = setInterval(function()
				{
					if(that.status === 'completed' || that.status === 'errored')
						that.stop();
					else
						that.perform();
				}, __pollingIntervalSecs * 1000);
			},
			enumerable: true,
			configurable: false
		});
		Object.defineProperty(that, "stop", 
		{ 
			get : function() 
			{
				clearInterval(__interval);
				return that;
			},
			enumerable: true,
			configurable: false
		});
	};

	(()=>{
		Object.freeze(StoppedTaskStarter);

		TM.add("stoppedTaskStarter", (task,pollingIntervalSecs)=>{new StoppedTaskStarter(task, pollingIntervalSecs);})

	})();


	//wire up the exports
	var fluid =
	{
		task : Task,
		TM : TM
	};	

	// Node.js
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = fluid;
	}
	// AMD / RequireJS
	else if (typeof define !== 'undefined' && define.amd) {
		define([], function () {
			return fluid;
		});
	}
	// included directly via <script> tag
	else {
		this.fluid = fluid;
	}
	
})();
	
