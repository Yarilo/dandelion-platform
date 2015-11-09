'use strict';

var auth = require ('./auth.js');
var httpProxy = require('http-proxy');
var apiProxy = httpProxy.createProxyServer();
var encryptor = require('file-encryptor');
var fs = require('fs');
var path = require('path');
var settings = require('../settings.js');
var prefix =  path.resolve(__dirname, "../../data");
var mongodb = require('../util/mongodb.js');
var consistency = require('../util/consistency.js');
var mongoDriver = require('mongodb');
var async = require('async');
var tar = require('tar-fs');
var zlib = require('zlib');
var clone = require('clone');

//TODO: getResource() should be take the name of the resource as escaped, or use the ID instead.

exports.getResource = function(request, response)
{
	var user = auth.getUser(request);
	var resourceName = request.params[0];
	var url =  user + "/" + resourceName;
	var resource_kind = request.query.resource_kind;
	if (resource_kind === 'file' || request.query.token && resource_kind !=='directory')
	{
		response.header("X-Accel-Redirect", "/authorizated_download/"+ url);
		return response.end();
	}
	var fullResourcePath = settings.DATA_PATH + "/" + url;
	var fullCompressedPath =  settings.DATA_COMPRESSED_PATH + "/" + resourceName + ".tar.gz";
	tar.pack(fullResourcePath)
		.pipe(zlib.Gzip())
		.pipe(fs.createWriteStream(fullCompressedPath))
		.on('error', function(error)
		{
			response.status(500).send(error);
		})
		.on('finish', function()
		{
			response.header("Content-Disposition", "attachment; filename=" + resourceName + ".tar.gz");
			response.header("X-Accel-Redirect", "/authorizated_compressed/"+ resourceName + ".tar.gz");
			response.end();
		});
};

 exports.fillResource = function(request, resourceId)
{
	var viewPermissions = request.headers.view || "";
	var editPermissions = request.headers.edit || "";
	var locations = request.headers.locations || "";
	resourceId = resourceId || mongoDriver.ObjectID();
	var name = request.params[0];
	var resource =
	{
		'_id' : resourceId,
		'name': name,
		'resource_kind': request.headers.resource_kind || request.query.kind,
		'owner': request.headers.owner,
		'mtime': request.headers.mtime,
		'size':request.headers.size,
		'parent':request.headers.parent,
	};
	if(viewPermissions)
	{
		resource.view  = viewPermissions;
	}
	if(editPermissions)
	{
		resource.edit  = editPermissions;
	}
	if(locations)
	{
		resource.locations  = locations;
	}
	return resource;
};

//Method created only for angular since Angular's $http service doesn't support mkcol
exports.createDirectory = function(request, response)
{
	var user = auth.getUser(request);
	var resource = exports.fillResource(request);
	var destination = settings.DATA_PATH + "/"+  user + "/" + resource.name;
	resource.locations = [destination];
	resource.resource_kind = 'directory';
	fs.mkdir(destination, function(error)
	{
		if(error)
		{
			var errorMessage = "Error while trying to create folder: " + error;
			return response.status(500).send(errorMessage);
		}
		mongodb.createResource(resource,user, function(error)
		{
			if(error)
			{
				var errorMessage = "Error in DB while trying to create folder: " + error;
				return response.status(500).send(errorMessage);
			}
			response.sendStatus(200);
			consistency.propagateNewResource(resource, user,"", function(error)
			{
				if(error)
				{
					console.log("Error propagating resource", error);
				}
			});
		});
	});
};

exports.putResource = function(request, response)
{
	var user = auth.getUser(request);
	var resource = exports.fillResource(request);
	var destination = settings.DATA_PATH + '/' + user + '/' + request.params[0];
	resource.name = request.params[0];
	resource.resource_kind = "file";
	resource.locations = [destination];
	mongodb.createResource(resource, user, function(error)
	{
		if(error)
		{
			var errorMessage = "Error while trying to create resource: " + error;
			return response.status(500).send(errorMessage);
		}
		var redirectedUrl = "/authorizated/" + user + "/";
		request.url = redirectedUrl + resource.name;
		apiProxy.web(request, response, {target: 'http://localhost:80'});
		//TODO: This is just a wrong workaround as client should be able to send the parent
		if (!resource.parent)
		{
			return response.sendStatus(200);
		}
		consistency.propagateNewResource(resource,user,"", function(error)
		{
			if(error)
			{
				console.log("Error propagating resources", error);
				return response.sendStatus(500);
			}
		});
	});
};


//Locate the location of a resource in user fs.
exports.locateCurrentLocation = function (resource, user)
{
	var locations = resource.locations;
	for (var i=0; i<locations.length; i++)
	{
		var fullResourceName = "/data/" + user + "/" + resource.name;
		if(locations[i].endsWith(fullResourceName))
		{
			return locations[i];
		}
	}
	return "";
};

exports.moveResource = function(request, response)
{
	var user = auth.getUser(request);
	var resourceName = request.params[0];
	var resourceId = request.query.id;
	async.waterfall([
		function(callback)
		{
			mongodb.getResources(mongoDriver.ObjectID(resourceId), user, function(error, result)
			{
				if(result.length < 1)
				{
					return callback(error);
				}
				var originalResource = clone(result[0]);
				var destinationResource = clone(result[0]);
				destinationResource.name = request.headers.destination;
				if(request.headers.destination.contains("/"))
				{
					destinationResource.parent = request.headers.destination.substringUpToLast("/");
				}
				else //Root
				{
					destinationResource.parent = "";
				}
				if(originalResource.resource_kind === 'directory')
				{
					resourceName +="/";
					request.headers.destination += "/";
				}
				return callback(error, originalResource, destinationResource);
			});
		},
		function(originalResource, destinationResource,callback)
		{
			mongodb.updateResource(resourceId, user, destinationResource, function(error)
			{
				var oldLocation = exports.locateCurrentLocation(originalResource, user);
				return callback(error, originalResource, destinationResource, oldLocation);
			});
		},
		//Replace location with the new one.
		function(originalResource, destinationResource,oldLocation, callback)
		{
			mongodb.deleteLocations(resourceId, user,[oldLocation], function(error)
			{
				if(error)
				{
					return callback(error);
				}
				var destination = request.headers.destination;
				if(originalResource.resource_kind == 'directory')
				{
					destination = destination.slice(0,-1); //Erase last '/'
				}
				var newLocation = settings.DATA_PATH + "/" + user + "/" + destination;
				mongodb.addLocations(resourceId, user,[newLocation], function(error)
				{
					return callback(error, originalResource, destinationResource, newLocation);
				});
			});
		},
		function(originalResource, destinationResource, newLocation, callback)
		{
			consistency.propagateMoveResource(originalResource, destinationResource, user, newLocation, request.headers.destination, function(error)
			{
				return callback(error, originalResource, destinationResource);
			});
		},
	],
	function(error)
	{
		if(error)
		{
			console.log("Error", error);
			return response.status(500).send(error);
		}
		var redirectedUrl = "/authorizated/" + user + "/";
		request.url = redirectedUrl + resourceName;
		request.headers.destination =   "/authorizated/" + user + "/" + request.headers.destination;
		apiProxy.web(request, response, {target: 'http://localhost:80'});
	});
};

exports.deleteResource = function(request, response)
{
	var user = auth.getUser(request);
	var resourceName = request.params[0];
	if(resourceName.endsWith("/"))
	{
		resourceName = resourceName.substringUpToLast("/");
	}
	mongodb.getResources({name:resourceName},user, function(error, result)
	{
		if (error || result.length < 1)
		{
			console.log("ERROR", error, result, request.params[0], user);
			return response.status(500).send("Error trying to obtain resource id " + error);
		}
		var resource = exports.fillResource(request, result[0]._id);
		consistency.propagateDelete(resource,user, function(error)
		{
			if(error)
			{
				var errorMessage = "Error trying to delete shared resources " + error;
				return response.status(500).send(errorMessage);
			}
			mongodb.removeResource({_id : mongoDriver.ObjectID(resource._id)},user, function(error)
			{
				if(error)
				{
					return response.status(500).send("Error trying to delete resource " + error);
				}
				var resourceToDelete = resource.name;
				if(result[0].resource_kind == 'directory'&& !resourceName.endsWith("/"))
				{
					resourceToDelete = resourceToDelete + "/";
				}
				var redirectedUrl = "/authorizated/" + user + "/";
				request.url = redirectedUrl + resourceToDelete;
				apiProxy.web(request, response, {target: 'http://localhost:80'});
			});
		});

	});

};


exports.isEncrypted = function (request, response)
{
	var user = auth.getUser(request);
	var resourceId = request.query.id; //TODO
	mongodb.getResources(mongoDriver.ObjectID(resourceId), user, function(error, result)
	{
		if(error || result.length > 1)
		{
			return response.status(500).send("Error trying to determinate resource encryption status: " + error);
		}
		var resource = result [0];
		return response.send(resource.encrypted);
	});
};

exports.encryptResource = function(request, response, key)
{
	var user = auth.getUser(request);
	var resourceId = request.query.id; //TODO
	var resourceName = request.params[0];
	var key =  request.query.password || "testingKey";
	var options = { algorithm: 'aes256' };
	var encryptedResource = prefix + "/" + user + "/" + resourceName + ".dat";
	var originalResource = prefix + "/" + user + "/" + resourceName;
	mongodb.updateResource(resourceId,user, {name:resourceName + ".dat", encrypted:true}, function(error)
	{
			if(error)
			{
				return response.status(500).send("Error encrypting file and updating resource: " + resourceName + " : " + error);
			}
			encryptor.encryptFile(originalResource, encryptedResource, key, options, function(error) {
				if(error)
				{
					return response.status(500).send("Error encrypting file: " + resourceName + " : " + error);
				}
				mongodb.addLocations(resourceId,user, [encryptedResource], function(error)
				{
					if (error)
					{
						return response.status(500).send("Error encrypting file and adding location: " + resourceName + " : " + error);
					}
					mongodb.deleteLocations(resourceId,user, [originalResource], function(error)
					{
						if (error)
						{
							return response.status(500).send("Error encrypting file and deleting location: " + resourceName + " : " + error);
						}
						fs.unlink(originalResource);
						return response.sendStatus(200);
					});
				});
			});
	});
};

exports.decryptResource = function(request, response)
{
	var user = auth.getUser(request);
	var key =  request.query.password || "testingKey";
	var resourceId = request.query.id; //TODO
	var resourceName = request.params[0];
	var options = { algorithm: 'aes256' };
	var encryptedResource = prefix + "/" + user + "/" + resourceName + ".dat"; //Dirty
	var originalResource = prefix + "/" + user + "/"+  resourceName;
	mongodb.updateResource(resourceId,user, {name:resourceName, encrypted:false}, function(error)
	{
		if(error)
		{
			return response.status(500).send("Error decrypting file and updating resource: " + resourceName + " : " + error);
		}
		encryptor.decryptFile(encryptedResource, originalResource, key, options, function(error) {
			if(error)
			{
				var errorMessage = "Error decrypting file: " + resourceName + " : " + error;
				console.log(errorMessage);
				return response.status(500).send(errorMessage);
			}
			mongodb.addLocations(resourceId, user, [originalResource], function(error)
			{
				if (error)
				{
					var errorMessage = "Error decrypting file and adding locations: " + resourceName + " : " + error;
					console.log(errorMessage);
					return response.status(500).send(errorMessage);
				}
				mongodb.deleteLocations(resourceId, user, [encryptedResource], function(error)
				{
					if (error)
					{
						var errorMessage = "Error decrypting file and deleting locations: " + resourceName + " : " + error;
						console.log(errorMessage);
						return response.status(500).send(errorMessage);
					}
					fs.unlink(encryptedResource);
					return response.sendStatus(200);
				});
			});
		});
	});
};


exports.getAllResources = function(request, response)
{
	mongodb.getAllResources({}, function (error, result)
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
