'use strict';

var settings = require('../settings.js');
var readdirp = require('readdirp');
var mongodb = require('../util/mongodb.js');
var auth = require('./auth.js');
var async = require('async');

exports.generateList = function(request, response)
{
	 var user = auth.getUser(request);
	var dataDir = settings.DATA_PATH + "/" + user;
	var resourcesArray = [];
	var tasks = [];
	readdirp({ root: dataDir, entryType:"both", lstat:false})
		.on('data', function (entry)
		{
			tasks.push(getResourceRetriever(entry, user, resourcesArray));
		})
		.on('end', function()
		{
			async.series(tasks, function(error)
			{
				if (error)
				{
					console.log("Error", error);
					if(response)
					{
						return response.status(500).send(error);
					}
				}
				updateDB(resourcesArray,user, function(error)
				{
					if(error)
					{
						console.log("Error updating DB", error);
					}
					adjustFolderSize (user, function(error)
					{
						if(error)
						{
							var errorMessage = "Error adjusting folder size: " + error;
							console.log(errorMessage);
							return response.status(500).send(errorMessage);
						}
						mongodb.getAllUserResources(user, function(error, resourcesArray)
						{
							if(response)
							{
								return response.send(resourcesArray);
							}
						});
					});
				});
			});
	  });
};

//Needed on Linux, since folders has 4.00 KB size dir (inode size)
function adjustFolderSize(username, callback)
{
	mongodb.getAllUserResources(username, function(error, resourcesArray)
	{
		if(error)
		{
			console.log("Error retrieving all user resources", error);
			return callback(error);
		}
		var sizeTasks = [];
		resourcesArray.forEach(function(resource)
		{
			if(resource.resource_kind == 'directory')
			{
				sizeTasks.push(updateSize(resource, username));
			}
		});
		async.series(sizeTasks, callback);
	});
}

function updateSize(folder, username)
{
	return function(callback)
	{
		var totalSize = folder.size;
		mongodb.getAllChildren(folder.name, username, function(error, children)
		{
			if(error)
			{
				return callback(error);
			}
			children.forEach(function(child)
			{
				totalSize += child.size;
			});
			mongodb.updateResource(folder._id, username,{size: totalSize}, callback);
		});
	};
}
function getResourceRetriever(entry, user, resourcesArray)
{
	return function(callback)
	{
		var resource =
		{
			name: entry.path,
			mtime: Date.parse(entry.stat.mtime),
			size:entry.stat.size,
			resource_kind: entry.stat.isDirectory()? "directory" : "file", //Usar version asíncrona
			parent: entry.parentDir,
			locations: [entry.fullPath],
		};
		mongodb.getResourceId(entry.fullPath, user, function(error, id)
		{
			if(error)
			{
				return callback(error);
			}
			resource._id = id;
			if(!entry.parentDir) //On root.
			{
				resourcesArray.push(resource);
				return callback(null);
			}
			var parentFullPath = entry.fullPath.substringUpToLast("/");
			mongodb.getResourceId(parentFullPath,user, function(error, id)
			{
				resource.parent_id = id;
				resourcesArray.push(resource);
				return callback(null);
			});
		});
	};
}


//TODO: Does not delete resources from DB, it should.
function updateDB(resourcesArray,user, callback)
{
	var tasks = [];
	resourcesArray.forEach(function(resource)
	{
		tasks.push(getResourceUpdater(resource, user));
	});
	async.series(tasks, callback);
}

//TODO: Show how many items have been updated
function getResourceUpdater(resource, user)
{
	return function(callback)
	{
		mongodb.initialUpdate(resource._id,user, resource, function(error)
		{
			if(error)
			{
				return callback("Error trying to insert resource: %j" + resource + " : " + error);
			}
			return callback(null);
		});
	};
}


// run if invoked directly
if (__filename == process.argv[1])
{
	exports.generateList();
}
