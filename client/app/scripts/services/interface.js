//TODO: Send password in body

homeApp.factory('serverInterface', ['$http', function ($http) {
	'use strict';

	var customResource = {

		login: function (username, password, callback)
		{
			$http({
				method: 'POST',
				url: '/api/login',
				data: 	{"user": username,
						"password": password},
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({description: description, status: status});
			});
		},
		remove: function (resourceId, resource, user, callback)
		{

			$http.delete('/api/resources/' + resource.name + "?user="+user.name + "&token=" + user.token + "&id="+resourceId + "&kind=" + resource.resource_kind,
				{}).success(function (result) { //escape.headers
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},
		share: function (resource, userToShare, permission, user, callback)
		{
			$http({
				method: 'PUT',
				url: '/api/users/share/' + userToShare + "?resource="+ resource.name + "&permissions=" + permission + "&user="+ user.name + "&token=" + user.token  + "&id="+resource._id,
				headers:{'kind':resource.resource_kind} ,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		setPassword: function (user, currentPassword, newPassword, callback) // Bad practice for security
		{
			$http.put('/api/users/password/' + user.name + "?user="+ user.name + "&password=" + currentPassword + "&newpass=" + newPassword,
				{
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		sendRecoveryMail: function (email, callback) // Bad practice for security
		{
			$http({
				method: 'PUT',
				url: '/api/users/password/forgot/',
				data: email,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({description: description, status: status});
			});
		},

		resetPassword: function (token, password, callback)
		{
			$http({
				method: 'POST',
				url: '/api/users/password/reset/' + token + "?password=" + password,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		createUser: function (user, callback)
		{
			$http({
				method: 'PUT',
				url: '/api/users/' + user.name + "?user="+ user.name + "&initial_token=" + '9K7oTnWKWVD3BX06380l74J2c8w857Lf',
				data: user,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({description: description, status: status});
			});
		},

		validateAccount: function (validationToken, callback)
		{
			$http({
				method: 'PUT',
				url: '/api/users/validate/' + validationToken + "?initial_token=" + '9K7oTnWKWVD3BX06380l74J2c8w857Lf',
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({description: description, status: status});
			});
		},
		updateUser: function (user, modifications, callback)
		{
			$http({
				method: 'POST',
				url: '/api/users/' + user.name + "?user="+ user.name + "&token=" + user.token,
				data: modifications,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		deleteUser: function (user, callback)
		{
			$http({
				method: 'DELETE',
				url: '/api/users/' + user.name + "?user="+ user.name + "&token=" + user.token,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		encrypt: function (resourceName,resourceId, user, password, callback)
		{
			$http.put('/api/encrypt/' + resourceName + "?user="+ user.name + "&token=" + user.token + "&password=" + password + "&id="+resourceId, {
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		decrypt: function (resourceName,resourceId, user, password, callback)
		{
			$http.put('/api/decrypt/' + resourceName + "?user="+user.name + "&token=" + user.token + "&password=" + password + "&id="+resourceId, {
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		status: function (resourceName, resourceId, user, callback)
		{
			$http.get('/api/status/encrypted/' + resourceName + "?user="+user.name + "&token=" + user.token + "&id="+resourceId, {
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		magnet: function (resourceName, resourceId,user, callback)
		{
			$http.get('/api/p2p/magnet/' + resourceName + "?user="+user.name + "&token=" + user.token + "&id="+resourceId, {
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},

		torrent: function (resourceName, resourceId, user, callback)
		{
			$http.get('/api/p2p/torrent/' + resourceName + "?user="+user.name + "&token=" + user.token + "&id="+resourceId, {
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},
		createDirectory : function (path,resource, user, callback)
		{
			$http({
    			method: 'PUT',
    			url: '/api/resources/dirs/' + path + "?user="+user.name + "&token=" + user.token,
    			headers: resource,
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},
		moveResource : function (resource, user,destination, callback)
		{
			$http({
    			method: 'MOVE',
    			url: '/api/resources/' + resource.name + "?user="+ user.name + "&token=" + user.token + "&id=" + resource._id,
    			headers: {'Destination': destination},
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},
		getPublicToken: function (resourceId,user, callback)
		{
			$http.get('/api/public-token/' + resourceId + "?user=" + user.name + "&token=" + user.token, 	{
			}).success(function (result) {
				callback(null, result);
			}).error(function (description, status) {
				callback({error: description, status: status});
			});
		},
	};
	return customResource;
}]);
