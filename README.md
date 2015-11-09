
# Dandelion Platform

Dandelion is an online storage platform built on top of Node.js and Nginx to serve and store user resources. It is
composed by a server, a web client and a [desktop client](https://github.com/Yarilo/dandelion-desktop).

Among others, it offers:
 - HTTPS/SSL
 - Permissions management, being able to share resources between several users
 - Encryption of files using AES 256
 - Ability to create P2P files (torrents) or links (magnets) from normal files to share them.
 - A REST API
 - A SPA application using AngularJS to dynamically load user's resources

You can take a look the platform working on [dandelion.redes.dis.ulpgc.es](http://dandelion.redes.dis.ulpgc.es) (user: yarilo , password: test)
## Architecture

Dandelion is built using the following technologies:
 - Server
	- Nginx: To serve and modify resources.
	- Node.js: To manage authentication and authorization of the requests and to offer a REST API using [Express](http://expressjs.com/)
	- MongoDB
 - Web client
	- AngularJS
	- Bootstrap
	- Material Design Guidelins
 -	[Desktop client](https://github.com/Yarilo/dandelion-desktop)
 	- Electron Framework

## Installation


````
git clone https://github.com/Yarilo/dandelion-platform.git
cd dandelion/deployment
sh deploy.sh
````

## Disclaimer

This platform was built for Computer Engineering Master's Thesis. It is presented here as an Academical Work, and therefore is not suitable for production use.

## License
GNU - GPL v3
