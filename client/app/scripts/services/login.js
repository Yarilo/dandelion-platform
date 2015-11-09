'use strict';

homeApp.factory('loginService', function ($cookies) {

	var loginState =
	{
		isLogged: false
	};

	var credentials =
	{
		name: "",
		token:"",
		email: ""
	};
	var order =
	{
		by:"",
		reverse: false
	};

	return{
		getLoginState: function ()
		{
			return loginState;
		},
		logUserIn: function ()
		{
			$cookies.putObject("credentials", credentials);
			loginState.isLogged = true;
		},
		logUserOut: function()
		{
			$cookies.remove("credentials");
			loginState.isLogged = false;
			credentials.name = "";
			credentials.token ="";
		},
		getCredentials : function()
		{
			return $cookies.getObject("credentials");
		},
		storeOrder : function()
		{
			$cookies.putObject("order", order);
		},
		getOrder : function(){
			return $cookies.getObject("order");
		},
		getCredentialString: function(){
			return "&token=" + credentials.token;
		},
		setLoginStatus : function (loginStatus)
		{
			loginState.isLogged = loginStatus;
		},
		user: credentials,
		order: order,
	};
});
