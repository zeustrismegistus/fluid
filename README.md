# fluid
an extensible fluent idiom task library


    const fluid = require('d__fluid');

example of decorating a task with a definition-ness

      function jump(howHigh){return howHigh;}
			var jumpTask = fluid.task.new(jump, [10]);
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


