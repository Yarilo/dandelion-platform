'use strict';

homeApp.factory('directoryService', function ($http, loginService)
{
	var currentDirectory =
	{
		name:""
	};

	var resources = {
		content: []
	};
	return {
		getCurrentDir : function()
		{
			return currentDirectory.name;
		},
		changeCurrentDir: function(newDir)
		{
			currentDirectory.name = newDir;
		},
		updateResourceList : function(initRoute, callback)
		{
			var route = initRoute || "/api/state/list/" ;
			var userCookie = loginService.getCredentials();
			if(userCookie && userCookie.name) //Already logged
			{
				loginService.user.name = userCookie.name;
				loginService.user.token = userCookie.token;
			}
			route = route + "?user=" + loginService.user.name + "&token=" + loginService.user.token;
			$http.get(route).success(function(data)
			{
				resources.totalSize = 0;
				resources.content = data;
				if(callback)
				{
					callback(null, resources.content);
				}
			}).error(function(description, status)
			{
				if(callback)
				{
					callback({error: description, status: status});
				}
			});
		},
		getResources: function()
		{
			return resources.content;
		},
		getTotalSize: function()
		{
			var totalSize = 0;
			resources.content.forEach(function(resource)
			{
				totalSize += resource.size;
			});
			return convertUnits(totalSize);
		},
		resourceExists: function (resourceName, resourceKind)
		{
			return resources.content.some(function(resource)
			{
				return resource.name === resourceName && resource.resource_kind === resourceKind;
			});
		}
	};

	function convertUnits(bytes)
	{
		bytes = parseInt(bytes);
		if(bytes === 0) {return '0 Bytes';}
		var k = 1024;
		var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		var i = Math.floor(Math.log(bytes) / Math.log(k));
		return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
	}
});
