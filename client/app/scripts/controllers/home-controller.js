'use strict';

var homeApp = angular.module('homeApp',[
	"angucomplete-alt",
	"ng-context-menu",
	"ui.bootstrap",
	"ngCookies",
	]);

homeApp.controller('HomeCtrl', function ($rootScope, $scope, $http, $route,$routeParams, $modal, $location, $cookies, serverInterface, loginService,
										 dataService, directoryService)
{

	$scope.user = loginService.user;
	$scope.incorrectLogin = false;
	$scope.currentDir = "";
	$scope.directoryService = directoryService;
	$scope.getIcon = dataService.getIcon;
	$scope.dataService = dataService;
	$scope.updateResourceList = directoryService.updateResourceList;
	$scope.resources = directoryService.getResources();
	$scope.getTotalSize = directoryService.getTotalSize;

	if($scope.user.name)
	{
		retrieveUsers();
	}
	if($routeParams.validationToken)
	{
		$scope.validationSuccess = false;
		$scope.valdiationFailed = false;
		//logout
		serverInterface.validateAccount($routeParams.validationToken, function(error, user)
		{
			if(error)
			{
				console.log("Error validating account", error);
				$scope.validationFailed = true;
				return;
			}
			$scope.validationSuccess = true;
			return;
		});
	}
	function retrieveUsers()
	{
		var usersRoute = '/api/users/' + "?user=" + $scope.user.name + "&token=" + $scope.user.token;
		$http.get(usersRoute).success(function(data)
		{
			$scope.users = [];
			data.forEach(function(user)
			{
				if(user.name == $scope.user.name)
				{
					loginService.user.email = user.email;
					$scope.user.email = loginService.user.email;
				}
				$scope.users.push(user);
			});
		});
	}
	$scope.refreshResources = function(){
		$scope.resources = directoryService.getResources();
	};

	$scope.firstLogin = function(username, password)
	{
		serverInterface.login(username, password, function(error, result)
		{
			if (!result || !result.token || error)
			{
				$scope.incorrectLogin = true;
				$scope.logOut();
				return;
			}
			$scope.user.name = result.username;
			$scope.user.token = result.token;
			loginService.user.name = result.username;
			loginService.user.token = result.token;
			loginService.logUserIn();
			$scope.loadResources();
			if ($location.url() !== '/configuration/')
			{
				$location.path("/resources");
			}
		});
	};

	$scope.loadResources = function ()
	{
		$scope.$on('$viewContentLoaded', function ()
		{
			$scope.currentDir = $scope.directoryService.getCurrentDir();
			$scope.predicate = loginService.getOrder().by || "name";
			$scope.reverse = loginService.getOrder().reverse;
		});
		$scope.updateResourceList("/api/state/", function(error)
		{
			if(error)
			{
				$scope.logOut();
				return;
			}
			$scope.refreshResources();
		});
	};
	$scope.logOut = function()
	{
		loginService.logUserOut();
		if($location.url() === "/resources/" || $location.url() == '/configuration/')
		{
			$location.path("/login");
		}
	};
	$scope.login = function()
	{
		if(!loginService.getCredentials())
		{
			loginService.setLoginStatus(false);
			$scope.logOut();
			return;
		}
		loginService.setLoginStatus(true);
		$scope.loadResources();
		if($location.url() == "/login")
		{
			$location.path("/resources");
		}
	};
	$scope.login();


	$scope.isOwner = function(resource)
	{
		return resource.owner === $scope.user.name;
	};
	$scope.canEdit = function(resource)
	{
		if($scope.isOwner(resource))
		{
			return true;
		}
		if(resource.edit)
		{
			return resource.edit.indexOf($scope.user.name) !== -1;
		}
		return false;
	};

	$scope.containsDat = function(resource)
	{
		return resource.name.indexOf(".dat") != -1;
	};

	$scope.isShared = function(resource)
	{
		var editPermissions = resource.edit && resource.edit.length > 1;
		var viewPermissions = resource.view && resource.view.length > 1;
		return editPermissions || viewPermissions || resource.publicToken;
	};

	//TODO: Probar bien con recursos compartidos
	$scope.openRename = function (resource)
	{
		$scope.resource = resource;

		var modalInstance = $modal.open({
			templateUrl: 'views/modals/rename.html',
			controller: 'ModalRenameCtrl',
			resolve: {
				currentResource: function () {
					return $scope.resource;
				}
			}
		});
		modalInstance.result.then(function (newName)
		{
			if(resource.parent)
			{
				newName = resource.parent + "/" + newName;
			}
			console.log("RESULT MAP", newName);
			if (directoryService.resourceExists(newName, resource.resource_kind))
			{
				$scope.openAlert("Error" , "El archivo o carpeta que intentas mover ya existe en el destino",resource, false);
				//$scope.openRename(resource);
				return;
			}
			serverInterface.moveResource(resource, $scope.user, newName , function(error)
			{
				if(error)
				{
					console.log("error", error);
					$scope.openAlert("Error" , "Error moviendo recurso", resource);
					return;
				}
				resource.name = newName;
				$scope.openAlert("Recurso renombrado" , "Renombrado correctamente", resource);
				$route.reload();
			});
		});
	};


	$scope.openMove = function (resource)
	{
		$scope.resource = resource;

		var modalInstance = $modal.open({
			templateUrl: 'views/modals/move.html',
			controller: 'ModalMoveCtrl',
			resolve: {
				currentResource: function () {
					return $scope.resource;
				}
			}
		});
		//1. El origen no cambia el archivo
		//2. En el destino tenemos que coger simplemente destination + resource.name.substringUpToLast(resource.parent);
		// a/b/c/archivo.txt
		// a/b/archivo.txt

		//a/b/c/carpeta
		//a/b/carpeta
		modalInstance.result.then(function (resultMap)
		{
			var destination = resultMap.destinationFolder.name || "";
			if (destination == $scope.resource.parent || destination == $scope.resource.name)
			{
				$scope.openAlert("Error" , "Una carpeta o archivo no puede moverse dentro de si misma, por favor elige otra carpeta",resource, true);
				return;
			}
			if(!destination) //Root
			{
				destination+= resource.name.replace(resource.parent + "/","");
			}
			else
			{
				destination+= "/" + resource.name.replace(resource.parent + "/","");
			}
			if (directoryService.resourceExists(destination, resource.resource_kind))
			{
				$scope.openAlert("Error" , "El archivo o carpeta que intentas mover ya existe en el destino",resource, true);
				return;
			}
			serverInterface.moveResource(resource, $scope.user, destination , function(error)
			{
				if(error)
				{
					console.log("error", error);
					$scope.openAlert("Error" , "Error moviendo recurso", resource);
					return;
				}
				$scope.openAlert("Recurso movido" , "Movido correctamente", resource);
				$route.reload();
			});
		});
	};

	$scope.openShare = function (resource)
	{
		$scope.resource = resource;

		var modalInstance = $modal.open({
			templateUrl: 'views/modals/share.html',
			controller: 'ModalShareCtrl',
			resolve: {
				currentResource: function () {
					return $scope.resource;
				}
			}
		});

		modalInstance.result.then(function (resultMap)
		{
			if (resultMap.selectedUser)
			{
				$scope.updatePermission(resource, resultMap.selectedUser.name, resultMap.permission.selected);
			}
		});
	};

	$scope.openAlert = function (title, description, resource, sameFolderMove)
	{
		$scope.details = [title,description, resource];
		var modalInstance = $modal.open({
			templateUrl: 'views/modals/alert.html',
			controller: 'ModalAlertCtrl',
			resolve: {
				details: function () {
					return $scope.details;
				}
			}
		});

		modalInstance.result.then(function()
		{
			if(sameFolderMove)
			{
				$scope.openMove(resource);
			}
		});
	};

	$scope.deleteAccount = function(view, controller)
	{
		$scope.openDeleteModal("views/modals/delete_account.html", "ModalDeleteCtrl");
	};
	$scope.openModal = function(view, controller, resource)
	{
		$scope.resource = resource;
		var modalInstance = $modal.open({
			templateUrl: view,
			controller: controller,
			resolve: {
				currentResource: function () {
					return $scope.resource;
				}
			}
		});

		modalInstance.result.then(function ()
		{
			console.log('Modal dismissed at: ' + new Date());
		});
	};

	$scope.openDeleteModal = function(view, controller)
	{
		var modalInstance = $modal.open({
			templateUrl: view,
			controller: controller,
		});

		modalInstance.result.then(function (deleteAccount)
		{
			if(deleteAccount)
			{
				serverInterface.deleteUser($scope.user, function(error)
				{
					if(error)
					{
						console.log(error);
						return;
					}
					$scope.openAlert("Cuenta borrada" , "Cuenta borrado con éxito");
					$scope.logOut();
				});
			}
		});
	};

	$scope.openPermissionsModal = function(view, controller, resource, user)
	{
		$scope.resource = resource;
		$scope.user = user;

		var modalInstance = $modal.open({
			templateUrl: view,
			controller: controller,
			resolve: {
				currentResource: function () {
					return $scope.resource;
				},
				currentUser: function () {
					return $scope.user;
				}
			}
		});

		modalInstance.result.then(function ()
		{
			console.log('Modal dismissed at: ' + new Date());
		});

	};

	$scope.openP2P = function(resource)
	{
		$scope.openModal("views/modals/p2p.html", "ModalCtrl", resource);
	};

	$scope.openTorrent = function(resource)
	{
		$scope.openModal("views/modals/torrent.html", "ModalCtrl", resource);
	};

	$scope.openDetails = function(resource)
	{
		$scope.openModal("views/modals/resource-details.html", "ModalCtrl", resource);
	};

	$scope.openPermissions = function(resource)
	{
		$scope.openPermissionsModal("views/modals/permissions.html", "ModalPermissionsCtrl", resource, $scope.user);
	};
	$scope.switchOrder = function (orderVariable)
	{
		$scope.predicate = orderVariable;
		$scope.reverse = ! $scope.reverse;
	};
	$scope.saveOrder = function()
	{
		loginService.order.by = $scope.predicate;
		loginService.order.reverse = $scope.reverse;
		loginService.storeOrder();
	};

	$scope.byCurrentDir = function(resource)
	{
		return (resource.parent === $scope.currentDir);
	};

	$scope.changeCurrentDir = function(resource)
	{
		if (resource.resource_kind === 'directory')
		{
			$scope.currentDir = resource.name;
		}
	};
	$scope.saveCurrentDir = function(resource)
	{
		if (resource.resource_kind === 'directory')
		{
			$scope.directoryService.changeCurrentDir(resource.name);
		}
	};

	$scope.goUp = function(){
		var resource;
		for (var res in $scope.resources)
		{
			resource = $scope.resources[res];
			if (resource.name === $scope.currentDir)
			{
				break;
			}
		}
		$scope.currentDir = resource.parent;
		$scope.directoryService.changeCurrentDir(resource.parent);
	};
	$scope.getResource = function (resource, listView)
	{
		if(resource.resource_kind === 'directory' && listView)
		{
			return "";
		}
		return "/api/resources/" + resource.name + "?user=" + $scope.user.name + loginService.getCredentialString() + "&id=" + resource._id + "&resource_kind=" + resource.resource_kind;
	};

	$scope.getTorrentName = function (resource)
	{
		var torrentName = resource.name + ".torrent";
		var torrent = $scope.resources.filter(function(res)
		{
			return res.name == torrentName;
		})[0];
		if(!torrent)
		{
			return "";
		}
		return "/api/resources/" + torrent.name + "?user=" + $scope.user.name + loginService.getCredentialString() + "&id=" + torrent._id;
	};

	$scope.deleteResource = function(resource)
	{
		$scope.openConfirmationModal("Borrar", dataService.messages.DELETE_RESOURCE , resource, $scope.remove);
	};
	$scope.remove = function(resource)
	{
		if(resource.resource_kind === 'directory')
		{
			resource.name +="/";
		}
		serverInterface.remove(resource._id, resource, $scope.user, function(error)
		{
			if(error)
			{
				console.log("Error while trying to delete resource", error);
				if(error.status == 403)
				{

				}
				$scope.openAlert("Error" , "Error tratando de borrar el recurso", resource);
			}
			else
			{
				$route.reload();
				$scope.openAlert("Borrado" , "Recurso borrado con éxito", resource);
			}
		});
	};
	$scope.updatePermission = function(resource, userToShare, permission)
	{
		//TODO Check user exists has the rights to give permissions (=only admin)
		serverInterface.share(resource, userToShare, permission, $scope.user, function(error, result)
		{
			if(error)
			{
				console.log("Error while trying to share resource", error);
				var message = "Error tratando de compartir el recurso";
				if(error.error.code == "EEXIST")
				{
					message = "El recurso ya está compartido";
				}
				$scope.openAlert("Error", message, resource);
				console.log("Status:", result);
			}
			else
			{
				$route.reload();
				console.log("Resource successfully shared");
				$scope.openAlert("Compartido" , "Recurso compartido correctamente", resource);
			}
		});
	};

	function isValidMail(email)
	{
    	var re = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
    	return re.test(email);
	}
	$scope.forgotPassword = function(email)
	{
		$scope.mailDiffer = false;
		$scope.mailNotFound = false;
		$scope.mailSent = false;
		if (isValidMail(email))
		{
			serverInterface.sendRecoveryMail({'email':email}, function(error)
			{
				if(error && error.description == "MAIL_NOT_FOUND" )
				{
					$scope.mailNotFound = true;
					console.log("Error sending the reset password mail", error);
					return;
				}
				if(error)
				{
					$scope.openAlert("Error" , "Error tratando de enviar el correo de resetear contraseña");
					console.log("Error sending the reset password mail", error);
					return;
				}
				$scope.mailSent = true;
			});
		}
		else
		{
			$scope.mailDiffer = true;
			console.log("Incorrect mail", email);
		}
	};


	$scope.signup = function(username, email, password, confirmPassword)
	{
		$scope.mailSent = false;
		if(!username || !email || !password || !confirmPassword)
		{
			$scope.completeAll = true;
			return;
		}
		if(!isValidMail(email))
		{
			$scope.mailDiffer = true;
			return;
		}
		if(password !== confirmPassword)
		{
			$scope.passwordsDiffer = true;
			return;
		}
		$scope.passwordsDiffer = false;
		$scope.mailDiffer = false;
		var user =
		{
			name: username,
			email: email,
			password:password,
		};
		$scope.mailInUse = false;
		$scope.nameInUse = false;
		serverInterface.createUser(user, function(error, user)
		{
			if(error && error.description === "MAIL_NOT_UNIQUE")
			{
				$scope.mailInUse = true;
				return;
			}
			if(error && error.description === "NAME_NOT_UNIQUE")
			{
				$scope.nameInUse = true;
				return;
			}
			if(error)
			{
				console.log("Error while trying to create user's profile", error);
				$scope.openAlert("Error" , "Error tratando de crear una cuenta nueva");
				return;
			}
			$scope.mailSent = true;
		});
	};

	$scope.updateProfile = function(email, currentPassword, newPassword, confirmPassword)
	{
		if(email)
		{
			updateMail(email);
		}
		if((!newPassword || !currentPassword || !confirmPassword) && $scope.userWantsPasswordChange)
		{
			$scope.openAlert("Error" , "Por favor rellena todos los campos de contraseña para actualizarla");
			return;
		}
		if(newPassword)
		{
			setPassword(currentPassword, newPassword, confirmPassword);
		}

	};
	function updateMail(email)
	{
		if(!isValidMail(email))
		{
			$scope.mailDiffer = true;
			console.log("Introduced mail is not valid", email);
			return;
		}
		$scope.mailDiffer = false;
		serverInterface.updateUser($scope.user, {email:email}, function(error)
		{
			if(error)
			{
				console.log("Error while trying to update user's profile", error);
				$scope.openAlert("Error" , "Error tratando de actualizar el perfil del usuario");
			}
			else
			{
				$scope.user.email = email;
				$scope.openAlert("Perfil actualizado" , "Perfil actualizado correctamente");
			}
		});
	}
	function setPassword(currentPassword, newPassword, confirmPassword)
	{
		if (newPassword !== confirmPassword)
		{
			$scope.passwordsDiffer = true;
			return;
		}
		$scope.passwordsDiffer = false;
		var username = $scope.user.name;
		serverInterface.setPassword($scope.user,currentPassword, newPassword, function(error)
		{
			if(error)
			{
				console.log("Error while trying to change password", error);
				$scope.openAlert("Error" , "Error tratando de cambiar la contraseña");
				return;
			}
			// TODO: log user out and in to avoid errors.
			loginService.logUserOut();
			$scope.firstLogin(username, newPassword);
			$scope.openAlert("Password" , "Password actualizada con éxito");
		});
	}

	$scope.resetPassword = function(password, confirmPassword)
	{
		if (password && password !== confirmPassword)
		{
			$scope.passwordsDiffer = true;
			console.log("Passwords differ", password, confirmPassword);
			return;
		}
		$scope.passwordsDiffer = false;
		serverInterface.resetPassword($routeParams.token, password, function(error)
		{
			if(error)
			{
				console.log("Error while trying to reset password", error);
				$scope.resetError = true;
				return;
			}
			$scope.resetSuccess=true;
			$scope.openAlert("Contraseña", "Contraseña reseteada con éxito"); //TODO Quitar los dos puntos de la salida
		});
	};

	$scope.isEncrypted = function (resource, callback)
	{
		var resourceName = resource.name.split(".dat")[0]; //Erase .dat extension if is there
		serverInterface.status(resourceName,resource._id, $scope.user, callback);
	};

	$scope.encryptDecrypt = function (resource)
	{
		$scope.isEncrypted(resource, function(error, result)
		{
			console.log("Is encrypted", result);
			if(error)
			{
				console.log("Error while trying to determine the status of resource", error);
				$scope.openAlert("Error" , "Error tratando de determinar el estado del recurso", resource);
			}
			if(result)
			{
				$scope.openPasswordModal("decrypt", resource, $scope.decryptResource);
			}
			else if(!result)
			{
				$scope.openPasswordModal("encrypt", resource, $scope.encryptResource);
			}

		});

	};
	$scope.encryptResource = function(resource, password)
	{
		serverInterface.encrypt(resource.name,resource._id, $scope.user, password, function(error)
		{
			if(error)
			{
				console.log("Error while trying to encrypt resource", error);
				$scope.openAlert("Error" , "Error tratando de encriptar el recurso", resource);
			}
			else
			{
				console.log("Resource sucessfully encrypted", resource);
				$route.reload();
				$scope.openAlert("Encriptado" , "Recurso encriptado con éxito", resource);
			}
		});
	};

	$scope.decryptResource = function(resource, password)
	{
		var resourceName = resource.name.split(".dat")[0];
		serverInterface.decrypt(resourceName, resource._id, $scope.user, password, function(error)
		{
			if(error)
			{
				console.log("Error while trying to decrypt resource", error);
				$scope.openAlert("Error" , "Error tratando de desencriptar el recurso", resource);
			}
			else
			{
				console.log("Resource sucessfully decrypted", resource);
				$route.reload();
				resource.name = resourceName;
				$scope.openAlert("Desencriptado" , "Recurso desencriptado con éxito", resource);
			}
		});
	};

	$scope.createMagnet = function(resource)
	{
		serverInterface.magnet(resource.name, resource._id, $scope.user, function(error, magnetLink)
		{
			if(error)
			{
				console.log("Error while trying to create magnet for resource", error);
				$scope.openAlert("Error" , "Error tratando de crear magnet para el recurso ", resource);
			}
			else
			{
				console.log("Magnet sucessfully created", resource);
				console.log("Magnet info", magnetLink);
				resource.magnetLink = magnetLink;
				$scope.openModal("views/modals/magnet.html","ModalCtrl", resource);
				$route.reload();
			}
		});
	};

	$scope.openConfirmationModal = function(title, description, resource, confirmationFunction)
	{
		$scope.details = [title,description, resource];
		var modalInstance = $modal.open({
			templateUrl: "views/modals/confirmation.html",
			controller: "ModalConfirmationCtrl",
			resolve:
			{
				details: function ()
				{
					return $scope.details;
				}
			}
		});

		modalInstance.result.then(function (confirmation)
		{
			if(confirmation)
			{
				confirmationFunction(resource);
			}
			console.log('Modal dismissed at: ' + new Date());
		});
	};

	$scope.openPasswordModal = function(operation, resource, confirmationFunction)
	{
		$scope.operation = operation;
		var modalInstance = $modal.open({
			templateUrl: "views/modals/password_input.html",
			controller: "ModalPasswordCtrl",
			resolve:
			{
				operation: function ()
				{
					return $scope.operation;
				}
			}
		});

		modalInstance.result.then(function (password)
		{
			if(password)
			{
				confirmationFunction(resource, password);
			}
			console.log('Modal dismissed at: ' + new Date());
		});
	};

	//TODO: Modify
	function createPublicLink (resource)
	{
		return "http://" + $location.host() + "/api/resources/" + resource.name + "?user=" + resource.owner + "&public_token=" + resource.publicToken + "&id=" + resource._id;
	}

	$scope.getPublicLink = function(resource)
	{
		serverInterface.getPublicToken(resource._id, $scope.user, function(error, publicToken)
		{
			if(error)
			{
				console.log("Error while trying to create public for resource", error);
				$scope.openAlert("Error" , "Error tratando de crear el link público para el recurso ", resource);
			}
			else
			{
				var publicLink = createPublicLink(resource);
				resource.publicLink = publicLink;
				$scope.openModal("views/modals/public_link.html", "ModalCtrl", resource);
				$route.reload();
			}
		});
	};

	$scope.createTorrent = function(resource)
	{
		serverInterface.torrent(resource.name,resource._id, $scope.user, function(error)
		{
			if(error)
			{
				console.log("Error while trying to create torrent for resource", error);
				$scope.openAlert("Error" , "Error tratando de crear un torrent para el recurso", resource);
			}
			else
			{

				console.log("Torrent sucessfully created", resource);
				$scope.openTorrent(resource);
				$route.reload();
			}
		});
	};
	$scope.selectResource = function(selectedResource)
	{
		if (selectedResource)
		{
			var resource = selectedResource.originalObject;
			$scope.openDetails(resource);
		}
	};
});
