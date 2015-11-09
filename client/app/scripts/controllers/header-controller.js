
var loginApp = angular.module('loginApp',
	["angucomplete-alt",
	"flow"]);

	loginApp.controller('HeaderCtrl', function ($scope, $route, $location, $modal, loginService, serverInterface, dataService, directoryService)
	{
		$scope.user = loginService.user;
		$scope.loginState = loginService.getLoginState();
		$scope.getIcon = dataService.getIcon;
		$scope.options = {
			url: "//127.0.0.1/api/"
		};
		$scope.year = new Date().getFullYear();
		$scope.day = new Date().getUTCDate();
		$scope.month = new Date().getMonth() + 1;
		$scope.date = $scope.day + "-" + $scope.month +  "-" + $scope.year;
		$scope.currentDir = directoryService.getCurrentDir();
		$scope.interfaceHeaders =
		{
			'name': "",
			'resource_kind': 'file',
			'owner': $scope.user.name,
			'mtime': Date.now(),
			'size':'0',
			'parent':$scope.currentDir,
		};
		$scope.calculateHeaders = function(size)
		{
			$scope.interfaceHeaders =
			{
				'resource_kind': 'file',
				'owner': $scope.user.name,
				'mtime': Date.now(),
				'size': size,
				'parent':$scope.currentDir,
			};
		};
		$scope.openAlert = function (title, description, resource, directoryNameVoid)
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
				if(directoryNameVoid)
				{
					$scope.openNewDir();
				}
			});
		};

		$scope.openUpload = function ()
		{
			$scope.currentDir = directoryService.getCurrentDir();

			var modalInstance = $modal.open({
				templateUrl: 'views/modals/upload.html',
				controller: 'ModalUploadCtrl',
				resolve: {
					currentParent: function () {
						return $scope.currentDir;
					}
				}
			});

			modalInstance.result.then(function ()
			{
				console.log('Modal dismissed at: ' + new Date());
			});
		};
		$scope.goHome = function()
		{
			$scope.currentDir = "";
			directoryService.changeCurrentDir("");
			$route.reload();
		};

		$scope.openNewDir = function ()
		{
			$scope.currentDir = directoryService.getCurrentDir();

			var modalInstance = $modal.open({
				templateUrl: 'views/modals/new-directory.html',
				controller: 'ModalUploadCtrl',
				resolve: {
					currentParent: function () {
						return $scope.currentDir;
					}
				}
			});

			modalInstance.result.then(function (directoryName)
			{
				$scope.createDir(directoryName);
				console.log('Modal dismissed at: ' + new Date());
			});
		};

		$scope.createDir= function(directoryName)
		{
			if(!directoryName)
			{
				$scope.openAlert("Error" , "Por favor, introduce un nombre de directorio","", true);
				return;
			}
			var path = "";
			if(!$scope.currentDir)
			{
				path = directoryName;
			}
			else
			{
				path = $scope.currentDir + "/" + directoryName;
			}
			if(directoryService.resourceExists(path, "directory"))
			{
				$scope.openAlert("Error" , "Estás intentando crear una carpeta con un nombre existente, por favor, elige otro","", true);
				return;
			}
			//TODO: Modify accordingly, sending headers
			$scope.interfaceHeaders =
			{
				'resource_kind': 'directory',
				'owner': $scope.user.name,
				'mtime': Date.now(),
				'size':'0',
				'parent':$scope.currentDir,
			};
			serverInterface.createDirectory(path, $scope.interfaceHeaders, $scope.user, function(error)
			{
				if(error)
				{
					console.log("Error while trying to create directory", error);
					$scope.openAlert("Error" , "Error tratando de crear el directorio", path);
				}
				else
				{
					$scope.openAlert("Creado" , "Directorio creado con éxito", path);
					$route.reload();
				}
			});
		};

		$scope.logOut = function(){
			loginService.logUserOut();
			if($location.url() === "/resources" || $location.url() == '/configuration')
			{
				$location.path("/login");
			}
		};
		$scope.submitFile = function()
		{
			$('#fileupload').fileupload('add', {files: filesList});
		};
		$scope.$on('flow::fileAdded', function (event, $flow, file)
		{
			var resourceName;
			if(!$scope.currentDir)
			{
				resourceName = file.name;
			}
			else
			{
				resourceName = $scope.currentDir + "/" + file.name;
			}
			if (directoryService.resourceExists(resourceName, "file"))
			{
				$scope.openAlert("Error", "El archivo que intentas subir ya existe, por favor, selecciona otro");
				event.preventDefault();
			}
		});
		$scope.$on('flow::fileSuccess', function (event, $flow, file) {
			console.log("Upload complete for:", file.name);
			$route.reload();
		});
		$scope.$on('flow::fileError', function (event, $flow, file, message)
		{
			if(message === "EEXIST")
			{
				$scope.openAlert("Error", "El archivo que intentas subir ya existe, por favor, selecciona otro");
				file.cancel();
			}
		});
		$scope.getTarget = function()
		{
			return "/api/chunks/" + "?user=" + $scope.user.name + "&token=" + $scope.user.token;
		};
	});
