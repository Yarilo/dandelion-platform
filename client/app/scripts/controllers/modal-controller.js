
var modalApp = angular.module('modalApp',["ui.bootstrap"]);

modalApp.controller('ModalCtrl',function ($scope, $modalInstance, currentResource)
{
	$scope.currentResource = currentResource;
	$scope.ok = function ()
	{
		$modalInstance.close();
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});

modalApp.controller('ModalRenameCtrl',function ($scope, $modalInstance, currentResource)
{
	$scope.currentResource = currentResource;
	$scope.ok = function (newName)
	{
		$modalInstance.close(newName);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});

modalApp.controller('ModalConfirmationCtrl',function ($scope, $modalInstance, details)
{
	$scope.title = details[0];
	$scope.description = details[1];
	$scope.currentResource = details[2];
	var confirmation = false;
	$scope.ok = function ()
	{
		confirmation = true;
		$modalInstance.close(confirmation);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss();
	};
});

modalApp.controller('ModalPasswordCtrl',function ($scope, $modalInstance, operation)
{
	if (operation == 'encrypt')
	{
		$scope.operation = 'encriptar';
	}
	else
	{
		$scope.operation = 'desencriptar';
	}
	$scope.ok = function (password)
	{
		$modalInstance.close(password);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss();
	};
});

modalApp.controller('ModalPermissionsCtrl',function ($scope, $modalInstance, currentResource,currentUser)
{
	$scope.currentResource = currentResource;
	$scope.usersAbleToEdit =  angular.copy(currentResource.edit) || []; //TODO: Erase current user
	$scope.usersAbleToView =  angular.copy(currentResource.view) || []; //TODO: Erase current user

	if(currentResource.owner == currentUser.name)
	{
		var index = $scope.usersAbleToEdit.indexOf(currentUser.name);
		$scope.usersAbleToEdit.splice(index,1);
		index = $scope.usersAbleToView.indexOf(currentUser.name);
		$scope.usersAbleToView.splice(index,1);
	}
	indexOwner = $scope.usersAbleToEdit.indexOf(currentResource.owner);
	if(indexOwner !== -1)
	{
		$scope.usersAbleToEdit.splice(indexOwner,1)
	}
	indexOwner = $scope.usersAbleToView.indexOf(currentResource.owner);
	if(indexOwner !== -1)
	{
		$scope.usersAbleToView.splice(indexOwner,1)
	}
	$scope.ok = function ()
	{
		$modalInstance.close();
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});
modalApp.controller('ModalAlertCtrl',function ($scope, $modalInstance, details)
{
	$scope.title = details[0];
	$scope.description = details[1];
	$scope.currentResource = details[2];
	$scope.ok = function ()
	{
		$modalInstance.close();
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});

modalApp.controller('ModalUploadCtrl',function ($scope, $modalInstance, currentParent)
{
	$scope.currentParent = currentParent;
	$scope.ok = function (dirName)
	{
		$modalInstance.close(dirName);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});

modalApp.controller('ModalDeleteCtrl',function ($scope, $modalInstance)
{
	var deleteAccount = false;
	$scope.ok = function ()
	{
		deleteAccount = true;
		$modalInstance.close(deleteAccount);
	};
	$scope.cancel = function ()
	{
		deleteAccount = false;
		$modalInstance.dismiss(deleteAccount);
	};
});

modalApp.controller('ModalMoveCtrl',function ($scope, $modalInstance, currentResource)
{
	$scope.currentResource = currentResource;
	$scope.destinationFolder = "/";

	$scope.selectFolder = function(resource)
	{
		$scope.destinationFolder = resource;
	};

	$scope.ok = function ()
	{
		$scope.resultMap =
		{
			destinationFolder: $scope.destinationFolder,
		};
		$modalInstance.close($scope.resultMap);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});


modalApp.controller('ModalShareCtrl',function ($scope, $modalInstance, currentResource)
{
	$scope.currentResource = currentResource;
	$scope.selectedUser = "";
	$scope.permission =
	{
		selected: "edit"
	}

	$scope.selectUser = function(user)
	{
		$scope.selectedUser = user.originalObject;
	};

	$scope.ok = function ()
	{
		$scope.resultMap =
		{
			selectedUser: $scope.selectedUser,
			permission: $scope.permission,
		};
		$modalInstance.close($scope.resultMap);
	};
	$scope.cancel = function ()
	{
		$modalInstance.dismiss('cancel');
	};
});
