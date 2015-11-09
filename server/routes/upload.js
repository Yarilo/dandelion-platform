'use strict';

var fs = require('fs');
var settings = require('../settings.js');
var flow = require('../util/flow-node.js')(settings.UPLOAD_TEMP_PATH);
var auth = require ('./auth.js');
var mongodb = require('../util/mongodb.js');
var resources = require('./resources.js');
var consistency = require('../util/consistency.js');

// Handle uploads through Flow.js
//TODO: Check write permissions on parent folder.
//TODO: Consider cleaning upload_tmp folder periodically
exports.postUpload = function(request, response)
{
	flow.post(request, function(status, filename, original_filename, identifier)
	{
		if (status == 'done')
		{
			var user = auth.getUser(request);
			var destination = settings.DATA_PATH + '/' + user + '/' + filename;
			var stream = fs.createWriteStream(destination);
			var options = {};
			options.onDone = function()
			{
				var resource = resources.fillResource(request);
				resource.name = filename;
				resource.resource_kind = "file";
				resource.locations = [destination];
				mongodb.createResource(resource, user, function(error)
				{
					if(error && error.code === 11000)
					{
						console.log("ERROR", error);
						flow.clean(identifier);
						return response.status(409).send("EEXIST");
					}
					if(error)
					{
						flow.clean(identifier);
						return response.status(500).send(error);
					}
					consistency.propagateNewResource(resource,user,"", function(error)
					{
					if(error)
					{
						console.log("Error propagating resources", error);
						return response.sendStatus(500);
					}
						flow.clean(identifier);
						response.header("Access-Control-Allow-Origin", "*");
						response.sendStatus(status);
					});
				});
			};
			flow.write(identifier, stream, options);
		}
		else
		{
			response.header("Access-Control-Allow-Origin", "*");
			response.sendStatus(status);
		}
	});
};

// Handle status checks on chunks through Flow.js
exports.testChunks = function(request, response)
{
	flow.get(request, function(status, filename, original_filename, identifier)
	{
		response.header("Access-Control-Allow-Origin", "*");
		if (status == 'found')
		{
			status = 200;
		} else
		{
			status = 404;
		}
		response.sendStatus(status);
	});
};

exports.checkOptions = function(request, response)
{
	response.header("Access-Control-Allow-Origin", "*");
	response.sendStatus(200);
};

exports.downloadId = function(request, response)
{
	flow.write(request.params.identifier, response);
};
