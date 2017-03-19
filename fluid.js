const jsmeta = require('d__jsmeta');
const mutator = require('d__mutator');
const fs = require('fs-extra');
const path = require('path');

//define the structure of the core unit of work
const Task = function(fn,args)
{
	//privates
	var that = this;
	var __state = 'stopped';
	
	//publics	
	this.args = args;
	this.behaviour = fn;
	this.result = undefined;
	this.error = undefined;
	
	Object.defineProperty(that, "state", 
	{ 
		get : function() {return  __state;},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "perform", 
	{ 
		get : function() 
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

	Object.defineProperty(that, "markRunning",
	{
		value : function() {__state = 'running';},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "markStopped",
	{
		value : function() {__state = 'stopped';},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "markCompleted",
	{
		value : function() {__state = 'completed';},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "markErrored",
	{
		value : function() {__state = 'errored';},
		enumerable: true,
		configurable: false
	});
	
	//import export
	Object.defineProperty(that, "serialize",
	{
		value : function() 
		{
			var data = {args: that.args, behaviour: that.behaviour, state: __state, result: that.result, error: that.error};
			return jsmeta.JSONSerializer.serialize(data);
		},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "deserialize",
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
});

//create a repo of decorations by name that we can fluently apply
const DD = const DecorationDictionary = (function()
{
	//privates
	var that = this;
	var __dictionary = {};
	

	Object.defineProperty(that, "add",
	{
		value : function(name, /*expects function(task, [args]) returning the decorator*/ decoratingFn) 
		{
			jsmeta.validators.validateNotNullOrEmpty(name);
			jsmeta.validators.validateIsFunction(decoratingFn);
			jsmeta.validators.assert(()=>{return jsmeta.hasFunctionArgNames(decoratingFn, ['task','args']);});//enforce signature smells
			
			if(__dictionary[name])
				throw 'already defined';
			
			__dictionary[name] = decoratingFn;
		},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "as",
	{
		value : function(name) 
		{
			return __dictionary[name];
		},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "decorate",
	{
		value : function(name, task, args) 
		{
			return __dictionary[name](task, args);
		},
		enumerable: true,
		configurable: false
	});
	
	//import export
	Object.defineProperty(that, "serialize",
	{
		value : function() 
		{
			return jsmeta.JSONSerializer.serialize(__dictionary);
		},
		enumerable: true,
		configurable: false
	});
	Object.defineProperty(that, "deserialize",
	{
		value : function(data) 
		{
			var data = jsmeta.JSONSerializer.deserialize(data);
			__dictionary = data;
			return that;
		},
		enumerable: true,
		configurable: false
	});
	
}());

(()=>{
	Object.freeze(DD);
	
	//extend task with a fluent decorator that links to Dictionary
	Object.defineProperty(Task.prototype, "decorate",
	{
		value : function(decorationName, args)
		{
			return DD.decorate(decorationName, this, args);		
		},
		enumerable: true,
		configurable:false
	});
	
	Object.freeze(Task);
	
});

//decorates task.  exposes ability to define a task and its decorations without invoking things
const TaskDefinition = function(task)
{
	jsmeta.validators.assert(()=>{return task instanceof Task;});
	
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
	
	//now register this guy
	//note: in the case below we use a decorateNew function as the decorator implementation, which keeps a chain that is instanceofy
	DD.add("definition", (task)=>{return Seed.new(task).decorateNew(TaskDefinition).outer;})
	
	/*
		example of decorating a task with a definition-ness
			function jump(howHigh){return howHigh;}
			var jumpTask = Task.new(jump, [10]);
			var jumpTaskDef = jumpTask.has("definition",[]);
		
		now we can define what we want the task to do in the definition.  here we use the method "has" instead of "decorate" - they are otherwise signature identical.  "has" indicates intention/contract, and the building of the definition.  "decorate" indicates implementation of the intention/contract.

			jumpTaskDef.has("beer", []).has("stupidity",[]).has("sweetride",[]).has("startDate",[undefined])
		
		and we can pass this around now..over a wire or whatever
			var wireData = jumpTaskDef.serialize();
			
			var cloneTask = Task.empty().deserialize(wireData);
			
		as long as the dictionary itself is the same at the endpoint
			var dictionaryData = DD.serialize();
			DD.deserialize(dictionaryData);
		
		this gives us portability of task
		
	*/
	
});
	
//ok, so now we haven't affected the task behaviour yet, other than give the task an ability to plan
//let's add a condition that changes behaviour
const TaskWhen = function(task, /*expects function(task, [args]) that returns bool*/conditionFn)
{
	jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
	jsmeta.validators.assert(()=>{return jsmeta.hasFunctionArgNames(conditionFn, ['task','args']);});//enforce signature smells
			
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
	
	//now register this guy
	//note: in the case below we use a decorateNew function as the decorator implementation, which keeps a chain that is instanceofy
	DD.add("when", (task,args)=>{return Seed.new(task).decorateNew(TaskWhen, args).outer;})
	
	/*
		eg. decorate a task to never run
		task.has("when", function never(){return false;});
	*/
});

//now we want to decorate the ability to save tasks to a file
const TaskDefinitionAtFile = function(task, filePath)
{
	jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
	jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(TaskDefinition);});//validate we have a definition in the stack
	
	jsmeta.validators.validateNotNullOrEmpty(filePath);
			
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
	
	//now register this guy
	//note: in the case below we use a decorateNew function as the decorator implementation, which keeps a chain that is instanceofy
	DD.add("definitionAtFile", (task,args)=>{return Seed.new(task).decorateNew(TaskDefinitionAtFile, args).outer;})
	
	/*
		eg. be able to persist the task definition
		task.has("definition").has("definitionAtFile", "\path\to\file")
			.load()
			.save()
		
		
	*/
});

//so now we have the ability to plan tasks, and save them to file, and to run them on a condition of our choosing
//we want to add some logic to start the task automatically, and to keep trying if it's stopped
const StoppedTaskStarter = function(task, pollingIntervalSecs)
{
	jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(Task);});//validate we're dealing with a Task decoration at the core
	jsmeta.validators.assert(()=>{return Seed.new(task).asInstanceOf(TaskDefinition);});//validate we have a definition in the stack
	pollingIntervalSecs = pollingIntervalSecs || 20;
			
	//privates
	var that = this;
	var __pollingIntervalSecs = pollingIntervalSecs;
	var __interval = null;
	
	//ok here's a weird one..we want to decorate self with a condition, but within self
	//so we decorate normally into another instance, and we copy it over
	var whenThat = that.has("when", function(task,args){
		
		//if we're processed, stop the polling
		if(task.status === 'completed' || task.status === 'errored')
		{
			that.stop();
			return false;
		}			
		
		return task.status === 'stopped';
	});

	mutator.extender.addBehaviour(that, whenThat);

	//publics
	Object.defineProperty(that, "start", 
	{ 
		get : function() 
		{
			that.stop();
			__interval = setInterval(function(){that.perform, __pollingIntervalSecs * 1000);
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
	
	//now register this guy
	//note: in the case below we use a decorateNew function as the decorator implementation, which keeps a chain that is instanceofy
	DD.add("stoppedTaskStarter", (task,args)=>{return Seed.new(task).decorateNew(StoppedTaskStarter, args).outer;})
	
	/*
		eg. be able to persist the task definition
		task.has("stoppedTaskStarter")
		.start() //kick it off
		.stop() //stop it
		
		
	*/
});


/*

	we take a basic function call, eg. function sayHiGracie(name){return "hi Gracie";}
	and asynchronize it into a unit of work, aka, a Task
	
		eg.
		var task
		{
			behaviour : sayHiGracie,
			arguments : "bob",
			state : 'stopped' | 'running' | 'completed' | 'errored',
			returnValue: undefined,
			error: undefined
		};
	
	we decorate this idea with behaviours, and keep our decorations in a dictionary

		eg.
		var Decorations
		{
			add : function(name, (task)=>decoration) //one way append 
		}
		
		function _if (task, condition)
		{
			var that = this;
			this.condition = condition;
			this.behaviour = function()
			{
				if(that.condition(task))
					task.behaviour();
			};
		}
		
		Decorations.add("if", (task, condition)=>new _if(task,condition));
		
		task.if(whenDovesCry)
	
	we invoke
		eg.
		task.perform()
			
	we also decorate to pull out serializable data (aka the definition)

		eg. 
		function _define(task)
		{
			var that = this;
			
			//walk the seed stack to get all the decoration args
			//[{if:whenDovesCry}, {if:itsColdOutside(50)}]  
			
			//we have a definition of the task decorations in sequence.  we can pipe that to any similarly wired dictionary
			this.definition = ...
		}
	
	we decorate to provide storage
		eg. function _atFile(task, fileName){...
				
		task.define().atFile("task1.task").save()
		var taskcopy = Task.new().atFile("task1.task").load()
		
	we decorate dictionary to provide storage
		eg. 
		Dictionary.atFile("dictionary.dict").save();
	
	we decorate dictionary with polling
		eg.
		Dictionary.atFile("dictionary.dict").polls((task)=>{if runnable run(), record result)
		
	we decorate dictionary with an endpoint
		dict.atEndpoint(9999).online()
		
	we decorate dictionary with some html reporting output on that endpoint
		dict.atEndpoint(9999).reports('/report/', (dict)=>{return html})
*/


	//wire up the exports
	var fluid =
	{
		task : Task,
		dd : DD
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

