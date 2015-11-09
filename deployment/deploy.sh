#!/usr/bin/env bash

cd ..
parentdir=$(pwd)
cd deployment

echo "Please type the system you are running this script (1/2/3)"
echo "1) RedHat/CentOS  2)Ubuntu  3)Mac OS X"
read system

#Linux
if [ $system -eq 1 ]
then
    sh "deploy-red-hat.sh"
#Ubuntu
elif [ $system -eq 2 ]
then
    sh "deploy-ubuntu.sh"
#Mac OSX
elif [ $system -eq 3 ]
then
    sh "deploy-mac.sh"
fi

##### Common Setup ######

#Nginx setup
echo "Downloading nginx"
wget -c http://nginx.org/download/nginx-1.7.10.tar.gz
tar -xvf nginx-1.7.10.tar.gz

echo "Compiling nginx"
cd nginx-1.7.10
./configure --sbin-path=/usr/local/sbin --with-http_dav_module --with-http_ssl_module --add-module="$parentdir/nginx-dav-ext-module-master"
make
sudo make install

cd "$parentdir/deployment"
echo "Please tell me the absolute location of the data folder of your server"
read data_folder
sudo chmod 777 $data_folder

echo "Please go to server/nginx folder and ensure the configurations (data folders and so on) are ok"
echo "Then press ENTER to continue"
read continue

sudo cp "$parentdir/server/nginx/nginx.conf" /usr/local/nginx/conf/nginx.conf
sudo mkdir /usr/local/nginx/sites-enabled
sudo ln -fs "$parentdir/server/nginx/dandelion.conf" /usr/local/nginx/sites-enabled/dandelion.conf
sudo mkdir /var/cache/

mkdir "$parentdir/server/assets/lists"

sudo npm install -g bower
cd "$parentdir"
echo "Firing up services..."
npm install
bower install
sudo nginx
npm start &

#Admin user
sh create-admin.sh

echo "Cleaning folders.."
rm -rf $parentdir/deployment/nginx-1.7.10
rm -rf $parentdir/deployment/nginx-17.10.tar.gz
rm -rf $parentdir/deployment/node
