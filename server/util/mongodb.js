'use strict';
require('prototypes');
var mongodb = require('mongodb');
var db;
var Users =[];
var Resources =[];
var testing = require('testing');
var async = require('async');
var path = require('path');

exports.init = function(callback)
{
	mongodb.connect("mongodb://127.0.0.1:27017/dandelion", function(error, database)
	{
		if (error)
		{
			console.log("Could not stablish a connection to MongoDB", error);
			return callback;
		}
		db = database;
		Users = db.collection('users');
		Users.find({}).toArray(function(error, userArray)
		{
			if(error)
			{
				return callback(error);
			}
			userArray.forEach(function(user)
			{
				createResourcesUserCollection(user.name);
			});
			createIndexes(userArray, callback);
		});
	});
};


function createIndexes(userArray, callback)
{
	var tasks = [];
	Users.createIndex({name:1},{unique:true}, function(error)
	{
		if(error)
		{
			return callback(error);
		}
		Users.createIndex({email:1},{unique:true}, function(error)
		{
			if(error)
			{
				return callback(error);
			}
			userArray.forEach(function(user)
			{
				tasks.push(getIndexCreator(user.name));
			});
			async.series(tasks, callback);
		});
	});
}

function getIndexCreator(user)
{
	return function(callback)
	{
		Resources[user].createIndex({locations:1},{unique:true, sparse:true}, callback);
	};
}

function createResourcesUserCollection(username)
{
	var collectionName = 'resources.' + username;
	Resources[username] = db.collection(collectionName);
}

//Create the user if not already there
exports.createUser = function(user, callback)
{
	Users.insert(user, {safe:true}, function(error)
	{
		if(error)
		{
			return callback(error);
		}
		createResourcesUserCollection(user.name);
		return callback(null);
	});
};

exports.updateUser = function (query,modifications, callback)
{
	Users.update(query,{$set:modifications}, {upsert:true, safe:true}, callback);
};

exports.deleteFields = function (query, fields, callback)
{
	Users.update(query,{$unset:fields}, {safe:true}, callback);
};

exports.deleteUser = function(username, callback)
{
	Users.remove({name:username}, 1, callback);
};


exports.deleteResourcesUserCollection = function(username, callback)
{
	exports.getAllUserResources(username, function(error, results)
	{
		if(error)
		{
			return callback(error);
		}
		if(results.length < 1)
		{
			return callback(null);
		}
		Resources[username].drop(callback);
	});
};

exports.getUser = function (username, callback)
{
	Users.findOne({'$or': [{name:username},{email:username}]}, callback);
};

exports.findUsers = function(query, callback)
{
	Users.find(query).toArray(callback);
};

/*
 CRUD operations
*/

exports.createResource = function(resource,username, callback)
{
	Resources[username].insert(resource, {safe:true}, callback);
};

exports.updateResource = function(resourceId, username, modifications, callback)
{
	var newLocations = [];
	if(modifications.hasOwnProperty('locations'))
	{
		newLocations = modifications.locations;
		delete modifications.locations;
	}
	Resources[username].update({_id:mongodb.ObjectID(resourceId)},
		{
			$set: modifications,
			$addToSet: {locations: {$each:newLocations}}
		},
		{upsert: true, safe:true}, function(error, result)
		{
			return callback(error, result);
		});
};

exports.initialUpdate = function(resourceId,username, modifications, callback)
{
	var newLocations = [];
	if(modifications.hasOwnProperty('locations'))
	{
		newLocations = modifications.locations;
		delete modifications.locations;
	}
	Resources[username].update({_id:resourceId},
		{
			$set: modifications,
			$addToSet: {locations: {$each:newLocations}},
		},
		{upsert: true, safe:true}, callback);
};

exports.getChildren = function(parentId,username, callback)
{
	Resources[username].find({parent_id: mongodb.ObjectID(parentId)}).toArray(callback);
};
exports.getAllChildren = function(parentName,username, callback)
{
	parentName = parentName + "/";
	Resources[username].find({name:{$regex: parentName}}).toArray(callback);
};
exports.getAllUserResources = function(username, callback)
{
	Resources[username].find({}).toArray(callback);
};
exports.getResources = function(query, username, callback)
{
	Resources[username].find(query).toArray(callback);
};

exports.getAllResources = function (query, callback)
{
	var resources = [];
	exports.findUsers({}, function(error, userArray)
	{
		if(error)
		{
			return callback(error, []);
		}
		userArray.forEach(function(user)
		{
			Resources[user.name].find(query).toArray(function(error, result)
			{
				if(error)
				{
					return callback(error, null);
				}
				resources.push(result);
			});
		});
		return callback(null,resources);
	});
};


exports.removeResource = function(query, username, callback)
{
	Resources[username].findOne(query, function(error, resource)
	{
		if(error)
		{
			return callback(error);
		}
		if (!resource)
		{
			return callback("Resource with query: %j, not found", query);
		}
		Resources[username].remove(query, 1, function(error, result)
		{
			if (error)
			{
				return callback(error);
			}
			if (resource.resource_kind === 'directory') //If folder, delete children folders
			{
				var parentName = path.join(resource.name, "/");
				return Resources[username].remove({name:{$regex: parentName}},callback);
			}
			return callback(null);
		});
	});
};

exports.can = function(query, username, permissionToCheck, callback)
{
	Resources[username].findOne(query,function(error,result)
	{
		if(error)
		{
			return callback(error, false);
		}
		if(!result)
		{
			return callback(null, false);
		}
		var itCan = false;
		var isOwner = result.owner === username;
		var canEdit = result.edit && result.edit.contains(username);
		var canView = result.view && result.view.contains(username);
		if(permissionToCheck == "view" && (isOwner || canEdit || canView))
		{
			itCan =  true;
		}
		else if(permissionToCheck == "edit" && (isOwner || canEdit))
		{
			itCan =  true;
		}
		return callback(null, itCan);
	});
};

exports.addPermission = function(resourceId, username, permission, users, callback)
{
	var newPerm = {};
	newPerm[permission]= {$each: users};
	Resources[username].update({_id:mongodb.ObjectID(resourceId)},{$addToSet: newPerm},{safe:true}, callback);
};
exports.deletePermission = function(resourceId, username, permission, users, callback)
{
	var newPerm = {};
	newPerm[permission] = {$in: users};
	Resources[username].update({_id:mongodb.ObjectID(resourceId)},{$pull: newPerm},{safe:true}, callback);
};

exports.addLocations = function(resourceId,username, locationArray, callback)
{
	Resources[username].update({_id:mongodb.ObjectID(resourceId)},{$addToSet: {locations: {$each:locationArray}}},{safe:true}, callback);
};
exports.deleteLocations = function(resourceId, username, locationArray, callback)
{
	Resources[username].update({_id:mongodb.ObjectID(resourceId)},{$pull: {locations: {$in: locationArray }}},{safe:true}, callback);
};

exports.getResourceId = function(fullPath,username, callback)
{
	Resources[username].findOne({locations:fullPath},{_id:true}, function(error, result)
	{
		if(error)
		{
			return callback(error,null);
		}
		if(!result)
		{
			return callback(null, mongodb.ObjectID());
		}
		return callback(null,result._id);
	});
};

var testId = "55c78e4f8edc26b9c878ab20";
var testUser = "batman";
function testCreateUsers(callback)
{
	var batman =
	{
		name: "batman",
		password: "test"
	};
	var joker =
	{
		name: "joker",
		password: "test"
	};
	var harley =
	{
		name: "harley",
		password: "test"
	};
	exports.createUser(batman, function(error)
	{
		testing.check(error,'Error creating user', callback);
		exports.createUser(joker, function(error)
		{
			testing.check(error,'Error creating user', callback);
			exports.createUser(harley, function(error)
			{
				testing.check(error,'Error creating user', callback);
				testing.success(callback);
			});
		});
	});
}
function testCreateResource(callback)
{
	var resource =
	{
		'_id': mongodb.ObjectID(testId),
		'name': 'test',
		'resource_kind': 'file',
		'owner': "batman",
		'mtime': Date.now(),
		'size': "test",
		'parent':"",
		'edit':['batman'],
		'locations':['sample/location/1','sample/location/2']
	};
	exports.createResource(resource,testUser, function(error)
	{
		testing.check(error,'Error creating resource', callback);
		testing.success(callback);
	});
}
function testUpdateResource(callback)
{
	var modifications =
	{
		'name': 'testmodificado',
		'size': "flejote",
	};
	exports.updateResource(testId,testUser, modifications, function(error)
	{
		testing.check(error,'Error updating resource', callback);
		testing.success(callback);
	});
}

function testAddPermission(callback)
{
	exports.addPermission(testId,testUser, "edit", ["joker", "harley", "gordon"], function(error, result)
	{
		testing.check(error, 'Error adding permission resource', callback);
		testing.success(callback);

	});
}
function testDeletePermission(callback)
{
	exports.deletePermission(testId,testUser, "edit", ["harley","gordon"], function(error, result)
	{
		testing.check(error, 'Error adding permission resource', callback);
		testing.success(callback);
	});
}

function testAddLocation(callback)
{
	exports.addLocations(testId,testUser, ['/another/location/1', '/another/location/2'], function(error, result)
	{
		testing.check(error, 'Error adding permission resource', callback);
		testing.success(callback);
	});
}
function testDeleteLocation(callback)
{
	exports.deleteLocations(testId,testUser, ['sample/location/1'], function(error, result)
	{
		testing.check(error, 'Error adding permission resource', callback);
		testing.success(callback);
	});
}

function testGetResourceId(callback)
{
	exports.getResourceId("sample/location/2", testUser, function(error, result)
	{
		testing.check(error,'Error getting resource ID', callback);
		testing.assertEquals(result,testId,'No resources found1', callback);
		exports.getResourceId([ 'sample/location/2','/another/location/1','/another/location/2' ],testUser, function(error, result)
		{
			testing.check(error,'Error getting resource ID', callback);
			testing.assertEquals(result,testId,'No resources found2', callback);
			//If we pass and array, it must match completely all locations, otherwise should fail.
			exports.getResourceId([ 'sample/location/2','/another/location/1'], testUser, function(error, result)
			{
				testing.check(error,'Error getting resource ID', callback);
				testing.assertNotEquals(result,testId,'No resources found3', callback);
				testing.success(callback);
			});
		});
	});
}


function testGetUserResources(callback)
{
	exports.getAllUserResources(testUser, function(error, result)
	{
		testing.check(error,'Error getting all resources', callback);
		testing.assert(result,'No resources found', callback);
		testing.success(callback);
	});
}

function testGetAllResources(callback)
{
	exports.getAllResources({},function(error, result)
	{
		testing.check(error,'Error getting all resources', callback);
		testing.assert(result,'No resources found', callback);
		testing.success(callback);
	});
}

function testRemoveResource(callback)
{
	exports.removeResource({_id: mongodb.ObjectID(testId)},testUser, function(error, result)
	{
		testing.check(error, 'Error removing resource', callback);
		testing.assertEquals(result, null, 'Should have removed one element', callback);
		testing.success(callback);
	});
}

function testCan(callback)
{
	exports.can({_id:mongodb.ObjectID(testId)},"joker","edit", function(error, result)
	{
		testing.check(error, 'Error checking can edit', callback);
		testing.assertEquals(result,false,"Joker can edit fails",callback);
		exports.can({_id:mongodb.ObjectID(testId)},"harley","edit", function(error, result)
		{
			testing.check(error, 'Error checking can edit', callback);
			testing.assertEquals(result,false,"harley can edit fails", callback);
			exports.can({_id:mongodb.ObjectID(testId)},"batman","view", function(error, result)
			{
				testing.check(error, 'Error checking can view', callback);
				testing.assertEquals(result,true, "batman can view fails", callback);
				exports.can({_id:mongodb.ObjectID(testId)},"harley","view", function(error, result)
				{
					testing.check(error, 'Error checking can view', callback);
					testing.assertEquals(result,false,"harley can view fails", callback);
					testing.success(callback);
				});
			});
		});
	});
}
function testDeleteUsers(callback)
{
	exports.deleteUser("batman", function(error)
	{
		testing.check(error,'Error deleting user', callback);
		exports.deleteUser("joker", function(error)
		{
			testing.check(error,'Error deleting user', callback);
			exports.deleteUser("harley", function(error)
			{
				testing.check(error,'Error deleting user', callback);
				testing.success(callback);
			});
		});
	});
}
function testDeleteResourcesUserCollection(callback)
{
	exports.deleteResourcesUserCollection("batman", function(error)
	{
		testing.check(error,'Error deleting user resources collection', callback);
		exports.deleteResourcesUserCollection("joker", function(error)
		{
			testing.check(error,'Error deleting user resources collection', callback);
			exports.deleteResourcesUserCollection("harley", function(error)
			{
				testing.check(error,'Error deleting user resources collection', callback);
				testing.success(callback);
			});
		});
	});
}
exports.test = function(callback)
{
	var tests = [
		testCreateUsers,
		testCreateResource,
		testUpdateResource,
		testAddPermission,
		testDeletePermission,
		testAddLocation,
		testDeleteLocation,
		testGetResourceId,
		testGetUserResources,
		testGetAllResources,
		testCan,
		testRemoveResource,
		testDeleteUsers,
		testDeleteResourcesUserCollection,
	];
	exports.init(function(error)
	{
		if(error)
		{
			return callback(error);
		}
		testing.run(tests,callback);
	});
};

//Execute tests if running directly
if (__filename == process.argv[1])
{
	exports.test(function(error)
	{
		if(error)
		{
			console.log("Error executing tests", error);
		}
		else
		{
			console.log("Database tests OK");
		}
	});
}

exports.init(function(error)
{
	if(error)
	{
		console.log("Error stablishing connection to database: " + error);
		return;
	}
	console.log("Connection to database stablished");
	return;
});
