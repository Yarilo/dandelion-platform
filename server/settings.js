'use strict';

var path = require('path');

exports.UTIL_PATH = path.resolve(__dirname, './util/dirsnapshot.py');
exports.RESOURCES_PATH = path.resolve(__dirname, './assets/lists/resources_');
exports.USERS_PATH = path.resolve(__dirname, './assets/users.json');
exports.DATA_PATH = path.resolve(__dirname,"../data/");
exports.DATA_COMPRESSED_PATH = path.resolve(__dirname,"../data_compressed/");
exports.UPLOAD_TEMP_PATH = path.resolve(__dirname,"../data/upload_tmp/");

exports.INITIAL_TOKEN = "9K7oTnWKWVD3BX06380l74J2c8w857Lf";
exports.AUTHENTICATION_KEY = "BA4azxrmeC9rTHXpS8GYbaKJ";

exports.NGINX_ADDRESS = "http://127.0.0.1/authorizated";

exports.MAILGUN_AUTH = {
  auth: {
    api_key: 'key-20f6694a6a16378e35d90b4295c4b6cf',
    domain: 'sandbox099b880af1a141809c7720906749055d.mailgun.org'
  }
}
