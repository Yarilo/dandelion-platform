'use strict';

var users = require ('../routes/users.js');
var settings = require('../settings.js');
var mongodb = require('../util/mongodb.js');
var mongoDriver = require('mongodb');
var request = require('request');
var async = require('async');
var resources = require('../routes/resources.js');


// TODO: This can be refactored into one propagated method and changing only the task/requests to propagate
exports.propagateDelete = function(affectedResource, originalUser, callback)
{
	var query = mongoDriver.ObjectID(affectedResource._id);
	getSharedResources(query, originalUser, function(error, userArray)
	{
		var requests = [];
		userArray.forEach(function(destinationUser)
		{
			if(destinationUser == originalUser)
			{
				return;
			}
			requests.push(getDeleter(affectedResource,originalUser,destinationUser));
		});
		return async.parallel(requests, callback);
	});
};

exports.propagateSharedStatus = function(affectedResource, originalUser,alreadySharedUser, permission, newDestination, callback)
{
	var query = mongoDriver.ObjectID(affectedResource._id);
	getSharedResources(query, originalUser, function(error, userArray)
	{
		var requests = [];
		userArray.forEach(function(destinationUser)
		{
			if(destinationUser == originalUser || destinationUser == alreadySharedUser)
			{
				return;
			}
			requests.push(getSharer(affectedResource,destinationUser,alreadySharedUser,permission, newDestination));
		});
		return async.parallel(requests, callback);
	});
};

exports.propagateParentStatus = function(affectedResource, originalUser, newDestination, callback)
{
	var query = {name: affectedResource.parent};
	if(!query.name) //No parent, on root
	{
		return callback(null);
	}
	mongodb.getResources(query, originalUser, function(error, result)
	{
		if(error)
		{
			console.log("Error getting id of modified resource", error);
			return callback(error);
		}
		if(result.length < 1) //Malformed parent, we don't find it.
		{
			return callback(error);
		}
		var tasks = [];
		var editPermissions = result[0].edit || [];
		var viewPermissions = result[0].view || [];
		if(editPermissions.length < 1 && viewPermissions.length < 1)
		{
			return callback(error,[]);
		}
		editPermissions.forEach(function(destinationUser)
		{
			if(destinationUser == originalUser)
			{
				return;
			}
			tasks.push(getSharer(affectedResource, originalUser, destinationUser,"edit", newDestination));
		});
		viewPermissions.forEach(function(destinationUser)
		{
			if(destinationUser == originalUser)
			{
				return;
			}
			tasks.push(getSharer(affectedResource, originalUser, destinationUser,"view", newDestination));
		});
		return async.parallel(tasks, callback);
	});
};

//Delete permission in edit/view as well as locations
exports.propagateRemovedSharedStatus = function(affectedResource, originalUser, callback)
{
	var query = mongoDriver.ObjectID(affectedResource._id);
	getSharedResources(query, originalUser, function(error, userArray)
	{
		var requests = [];
		userArray.forEach(function(destinationUser)
		{
			var originalUserLocations = [];
			if(destinationUser == originalUser)
			{
				return;
			}
			originalUserLocations = getUserLocations(affectedResource, originalUser);
			requests.push(getDeleterSharedStatus(affectedResource, originalUser, destinationUser, originalUserLocations));
		});
		return async.parallel(requests, callback);
	});
};

function getUserLocations (resource, user)
{
	var userLocations = [];
	resource.locations.forEach(function(location)
	{
		if(location.contains("/data/" + user))
		{
			userLocations.push(location);
		}
	});
	return userLocations;
}

exports.erasePermissionsAndLocations = function(resourceId, originalUser, callback)
{
	var query = mongoDriver.ObjectID(resourceId);
	mongodb.getResources(query, originalUser, function(error, result)
	{
		if(error)
		{
			return callback(error);
		}
		if(result.length < 1)
		{
			return callback("Affected resource while looking for shared consistency not found");
		}
		var affectedResource = result[0];
		getSharedResources(query, originalUser, function(error, userArray)
		{
			if(error){
				return callback(error);
			}
			var tasks = [];
			userArray.forEach(function(destinationUser)
			{
				tasks.push(getFullDeleterSharedStatus(query, affectedResource, originalUser, destinationUser));
			});
			return async.parallel(tasks, callback);
		});
	});
};

function getFullDeleterSharedStatus(query, affectedResource, originalUser, destinationUser)
{
	return function(callback)
	{
		mongodb.getResources(query, destinationUser, function(error, result)
		{
			if(error)
			{
				return callback(error);
			}
			if(result.length < 1) //This resource is no longer on user fs
			{
				var originalUserLocations = getUserLocations(affectedResource, destinationUser);
				return deleteSharedStatus(affectedResource, destinationUser,originalUser,originalUserLocations, callback);
			}
			return callback(null);
		});
	};
}
exports.propagateNewResource = function(affectedResource, originalUser, source, callback)
{
	var query = {name: affectedResource.parent};
	if(!query.name) //No parent, on root
	{
		return callback(null);
	}
	getSharedResources(query, originalUser, function(error, userArray)
	{
		if(error)
		{
			return callback(error);
		}
		var requests = [];
		userArray.forEach(function(destinationUser)
		{
			if(destinationUser == originalUser)
			{
				return;
			}
			requests.push(getCopier(affectedResource,originalUser,destinationUser, source));
		});
		return async.parallel(requests, callback);
	});
};


exports.propagateMoveResource = function(affectedResource, destinationResource, originalUser, newLocation, destination, callback)
{
	var tasks = [];
	if (!affectedResource.parent && !destinationResource.parent) //Both on root, this is a rename on root
	{
		var query = mongoDriver.ObjectID(affectedResource._id);
		getSharedResources(query, originalUser, function(error, userArray)
		{
			if(error)
			{
				return callback(error);
			}
			userArray.forEach(function(destinationUser)
			{
				if(destinationUser === originalUser)
				{
					return;
				}
				tasks.push(getRenamer(affectedResource,destinationResource, originalUser, destinationUser, destination));
			});
			userArray.forEach(function(destinationUser)
			{
				if(destinationUser === originalUser)
				{
					return;
				}
				tasks.push(function(callback) //Ugly, should be added into the above function
				{
					replaceLocations(affectedResource,destinationResource, destinationUser,originalUser, destination, callback);
				});
			});
			return async.series(tasks, callback);
		});
	}
	//Moving FROM a shared folder to normal folder
	//1. Delete from shared folder (propagateDelete)
	//2. Delete locations and edits.
	if(affectedResource.parent)
	{
		tasks.push(function(callback){exports.propagateDelete(affectedResource,originalUser,callback);});
		tasks.push(function(callback){exports.erasePermissionsAndLocations(affectedResource._id, originalUser, callback);});
	}
	//Moving INTO a shared folder
	//1. Create into shared folder (propagateNewResource)
	//2. Add locations and edits (something like propagateSharedStatus)
	if(destinationResource.parent)
	{
		var source = settings.DATA_PATH + "/" + originalUser + "/" + affectedResource.name;
		tasks.push(function(callback){exports.propagateNewResource(destinationResource,originalUser,source, callback);});
	}
	return async.series(tasks, callback);
};

function replaceLocations(affectedResource, destinationResource, originalUser, destinationUser, destination, callback)
{
	var oldLocationOriginalUser = resources.locateCurrentLocation(affectedResource, originalUser);
	var oldLocationDestinationUser = resources.locateCurrentLocation(affectedResource, destinationUser);
	mongodb.deleteLocations(destinationResource._id, destinationUser,[oldLocationDestinationUser, oldLocationOriginalUser], function(error)
	{
		if(error)
		{
			return callback(error);
		}
		var dbDestination = destination;
		if(affectedResource.resource_kind == 'directory')
		{
			dbDestination = destination.slice(0,-1); //Erase last '/'
		}
		var newLocationOriginalUser = settings.DATA_PATH + "/" + originalUser + "/" + dbDestination;
		var newLocationDestinationUser = settings.DATA_PATH + "/" + destinationUser + "/" + dbDestination;
		mongodb.addLocations(destinationResource._id, destinationUser,[newLocationOriginalUser, newLocationDestinationUser], callback);
	});
}

function getRenamer (affectedResource, destinationResource, originalUser, destinationUser, destination)
{
	return function(callback)
	{
		if(destination.contains("/"))
		{
			destinationResource.name = destination.substringUpToLast("/");
		}
		else
		{
			destinationResource.name = destination;
		}
		mongodb.updateResource(destinationResource._id, destinationUser, destinationResource, function(error)
		{
			if(error)
			{
				return callback(error);
			}
			replaceLocations(affectedResource, destinationResource, originalUser, destinationUser, destination, function(error)
			{
				if(error)
				{
					return callback(error);
				}
				var uri =  settings.NGINX_ADDRESS + "/" + destinationUser + "/" + affectedResource.name;
				if(uri[uri.length-1] !== "/" && affectedResource.resource_kind == 'directory')
				{
					uri +="/";
				}
				return request(
				{
					uri: uri,method:'MOVE',
					headers: {'destination':  "/authorizated/" + destinationUser + "/" + destination}
				}, callback);
			});
		});
	};
}

//TODO: Erase duplicates from userArray;
function getSharedResources(query, originalUser, callback)
{
	mongodb.getResources(query, originalUser, function(error, result)
	{
		if(error)
		{
			console.log("Error getting id of modified resource", error);
			return callback(error);
		}
		if(result.length < 1)
		{
			return callback(error);
		}
		var editPermissions = result[0].edit || [];
		var viewPermissions = result[0].view || [];
		if(editPermissions.length < 1 && viewPermissions.length < 1)
		{
			return callback(error,[]);
		}
		var userArray = [].concat(editPermissions, viewPermissions);
		return callback(null,userArray);
	});
}

function getDeleter(resource, originalUser, destinationUser)
{
	return function(callback)
	{
			mongodb.removeResource({_id : mongoDriver.ObjectID(resource._id)}, destinationUser, function(error)
			{
				if(error)
				{
					return callback(error);
				}
				var uri =  settings.NGINX_ADDRESS + "/" + destinationUser + "/" + resource.name;
				if(uri[uri.length-1] !== "/" && resource.resource_kind == 'directory')
				{
					uri +="/";
				}
				return request({uri: uri,method:'DELETE'}, callback);
			});
	};
}

function getCopier(resource, originalUser, destinationUser, source)
{
	return function(callback)
	{
		var options =
		{
			originalUser : originalUser,
			destinationUser: destinationUser,
			resourceId :  resource._id,
			resourcePath: resource.name,
			permissions: "edit",
			isFolder: resource.resource_kind == 'directory'? true : false
		};
		options.source = source || settings.DATA_PATH + "/" + options.originalUser + "/" + options.resourcePath;
		options.destination = settings.DATA_PATH + "/"+  options.destinationUser + "/" + options.resourcePath;
		return users.share(options, callback);
	};
}

function getSharer(resource, originalUser,destinationUser, permission, newDestination)
{
	return function(callback)
	{
		var options =
		{
			resourceId :  resource._id,
			resourcePath: resource.name,
			originalUser : originalUser,
			destinationUser: destinationUser,
			permissions: permission,
			isFolder: resource.resource_kind == 'directory'? true : false
		};
		options.destination = newDestination;
		options.onlyUpdate = true;
		users.shareInDB(options, callback);
	};
}

function deleteSharedStatus(resource, originalUser, destinationUser,locationsToErase, callback)
{
	if (!Array.isArray(locationsToErase))
	{
		locationsToErase = locationsToErase.split();
	}
	if (!Array.isArray(originalUser))
	{
		originalUser = originalUser.split();
	}
	async.waterfall
	([
		function(callback)
		{
			mongodb.deletePermission(resource._id, destinationUser,"edit", originalUser, function(error)
			{
				return callback(error);
			});
		},
		function(callback)
		{
			mongodb.deletePermission(resource._id, destinationUser,"view", originalUser, function(error)
			{
				return callback(error);
			});
		},
		function(callback)
		{
			mongodb.deleteLocations(resource._id, destinationUser, locationsToErase, function(error)
			{
				return callback(error);
			});
		}
	], callback);

}
function getDeleterSharedStatus(resource, originalUser,destinationUser,locationsToErase)
{
	return function(callback)
	{
		deleteSharedStatus(resource, originalUser,destinationUser,locationsToErase, callback);
	};
}
