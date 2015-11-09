'use strict';

var dandelionApp = angular.module('dandelionApp', [
	"ngRoute",
	"homeApp",
	"modalApp",
	"loginApp"]);

dandelionApp.config(['$routeProvider', 'flowFactoryProvider',
	function($routeProvider, flowFactoryProvider) {
		$routeProvider.
			when('/resources', {
				templateUrl: 'views/resource-list.html',
				controller: 'HomeCtrl'
			}).
			when('/resources/:resourceId', {
				templateUrl: 'views/resource-details.html',
				controller: 'HomeCtrl'
			}).
			when('/configuration/', {
				templateUrl: 'views/configuration.html',
				controller: 'HomeCtrl'
			}).
			when('/login', {
				templateUrl: 'views/login.html',
				controller: 'HomeCtrl'
			}).
			when('/reset/:token', {
				templateUrl: 'views/reset_password.html',
				controller: 'HomeCtrl'
			}).
			when('/signup', {
				templateUrl: 'views/signup.html',
				controller: 'HomeCtrl'
			}).
			when('/validate/:validationToken', {
				templateUrl: 'views/validation.html',
				controller: 'HomeCtrl'
			}).
			when('/forgot', {
				templateUrl: 'views/forgot_password.html',
				controller: 'HomeCtrl'
			}).
			otherwise({
				redirectTo: '/login'
			});
		flowFactoryProvider.defaults =
		{
			target: '/upload',
		}
	}
]);
