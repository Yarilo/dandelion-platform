'use strict';

require('prototypes');
var fs = require('fs-extra');
var settings = require('../settings.js');
var mongodb = require('../util/mongodb.js');
var mongoDriver = require('mongodb');
var async = require('async');
var consistency = require('../util/consistency.js');
var auth = require ('./auth.js');

process.umask(0);

exports.updateUser = function(request, response)
{
	var user = auth.getUser(request);
	var modifications = request.body;
	mongodb.updateUser({name:user}, modifications, function(error)
	{
			if(error)
			{
				console.log("Could not save user in DB");
				response.sendStatus(500);
				return;
			}
			console.log("User successfully saved");
			response.sendStatus(200);
	});
};

exports.getAllUsers = function(request, response)
{
	mongodb.findUsers({}, function(error, users)
	{
		if(error)
		{
			console.log("Error trying to get list of users");
			response.sendStatus(500);
			return;
		}
		response.send(users);
	});
};
/**
 3 levels of permission : view, edit, owner
 owner = all http verbs + update permissions
 edit =  all http verbs, but cannot update permissions
 view = get
 **/
//TODO Consider moving this to auth.js
//TODO On PUT/POST/MKCOL We have to check if we have permissions on that folder passing parent through headers.
exports.hasPermission = function (request, response, next)
{
	var user = auth.getUser(request);
	var resourceId = request.query.id  || "";
	var resourceName = request.query.resourceName || request.params.id;
	var permission = "edit";
	if (request.method == "PUT" || request.method == "POST" || request.method =="MKCOL")
	{
		next();
		return;
	}
	if(request.method == "GET")
	{
		permission = "view";
	}
	var query = {};
	if (resourceId)
	{
		query = {"_id" : mongoDriver.ObjectID(resourceId)};
	}
	else if(resourceName)
	{
		query = {"name": resourceName};
	}
	mongodb.can(query,user, permission, function(error, itCan)
	{
		if(error)
		{
			console.log("Error checking permissions", error);
			return response.status("500").send("Internal error checking permissions");
		}
		else if(itCan)
		{
			next();
		}
		else
		{
			return response.status("403").send("Not enough permissions");
		}
	});
};

/*
 Will try to copy in the same path/folder of the original resource. If it can't
 it will try on the root.

 Permissions on db will be updated by looking for the resource
 and modifying its relevant permissions by adding username
*/
exports.shareWithUser = function(request, response)
{
	var options =
	{
		originalUser : auth.getUser(request),
		destinationUser: request.params.id,
		resourceId : request.query.id,
		resourcePath: request.query.resource.replace(/["']/g, ""), //Si hay colisiones, usar el id para buscar la location
		permissions:request.query.permissions.replace(/["']/g, ""),
		isFolder: (request.headers.kind === 'directory'),
		onlyUpdate: false,
	};
	options.source = settings.DATA_PATH + "/" + options.originalUser + "/" + options.resourcePath;
	options.destination = settings.DATA_PATH + "/"+  options.destinationUser + "/" + options.resourcePath;
	exports.share(options, function(error)
	{
		if(error)
		{
			return response.status(500).send(error);
		}
		var resource =
		{
			_id:options.resourceId,
			name:options.resourcePath,
			resource_kind: options.isFolder ? 'directory' : 'file',
		};
		consistency.propagateSharedStatus(resource, options.originalUser,options.destinationUser, options.permissions, options.destination, function(error)
		{
			if(error)
			{
				console.log("Error propating shared status: ", error);
			}
		});
		return response.sendStatus(200);
	});
};

exports.share = function(options, callback)
{
	copyResource(options.source, options.destination,options.destinationUser,options.resourcePath, function(error, finalDestination)
	{
		if(error)
		{
			var errorMessage = "Error creating symlink from: " + options.source + " to: " + options.destination + " : " + error;
			return callback(errorMessage);
		}

		exports.shareInDB(options, function(error)
		{
			console.log("hey yo");
			if(error)
			{
				var errorMessage = "Error updating DB permission " + error;
				return callback(errorMessage);
			}
			return callback(null);
		});
	});
};
//FIXME: If source doesn't exist it may enter in an infinite loop
function copyResource(source,destination,user,resourcePath, callback)
{
	fs.copy(source,destination, function(error)
	{
		if (error && error.code == 'ENOENT')
		{
			var newDestination = settings.DATA_PATH + "/"+  user + "/" + resourcePath.substringFromLast('/');
			return copyResource(source, newDestination,user,resourcePath, callback);
		}
		if(error)
		{
			return callback("Error copying resource: " + error, null);
		}
		return callback(null, destination);
	});
}


exports.shareInDB = function (options, callback)
{
	var tasks = [];
	tasks.push(getSharer(options.resourceId, options.permissions,options.originalUser,options.destinationUser, options.destination, options.onlyUpdate));
	if(!options.isFolder)
	{
		return async.series(tasks, callback);
	}
	var newDestination = options.destination;
	mongodb.getAllChildren(options.resourcePath,options.originalUser, function(error, children)
	{
		children.forEach(function(child)
		{
			child.locations.forEach(function(location)
			{
				if(location.contains("/data/" + options.originalUser))
				{
					var relativePath = location.substringFrom("/data/").replace(options.originalUser, options.destinationUser);
					newDestination = newDestination.substringUpTo("/data/") + "/data/" + relativePath;
				}
			});
			tasks.push(getSharer(child._id, options.permissions,options.originalUser,options.destinationUser, newDestination, options.onlyUpdate));
		});
		return async.series(tasks,callback);
	});
};

//TODO: If file is there already, don't show an error and just update permissions
function getSharer(resourceId, permission,originalUser, destinationUser, newDestination, onlyUpdate)
{
	return function(callback)
	{
		changeShareStatus(resourceId, permission,originalUser, destinationUser, newDestination,function(error)
		{
			if (error)
			{
				return callback(error);
			}
			if (onlyUpdate)
			{
				return callback(null);
			}
			mongodb.getResources(mongoDriver.ObjectID(resourceId),originalUser, function(error, result)
			{
				if (error)
				{
					return callback(error);
				}
				var copiedResource = result [0];
				copiedResource.owner = originalUser;
				return mongodb.updateResource(resourceId, destinationUser, copiedResource, callback);
			});
		});
	};
}

function changeShareStatus (resourceId, permission, originalUser, destinationUser, newDestination, callback)
{
	mongodb.addPermission(resourceId,originalUser, permission,[originalUser, destinationUser], function(error)
	{
		if(error)
		{
			return callback(error);
		}
		mongodb.addLocations(resourceId,originalUser, [newDestination],callback);
	});
}

exports.getUserResources = function(request, response)
{
	var user = auth.getUser(request);
	if(!user)
	{
		response.sendStatus(400);
	}
	mongodb.getAllUserResources(user, function (error, result)
	{
		if(error)
		{
			response.sendStatus(500);
		}
		else
		{
			response.send(result);
		}
	});
};
