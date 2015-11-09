#!/usr/bin/env bash
# Deployment script for Ubuntu based distributions

sudo apt-get update
sudo apt-get install build-essential
sudo apt-get install libpcre3 libpcre3-dev
sudo apt-get install libexpat1-dev
sudo apt-get install zlib1g-dev
sudo apt-get install libssl-dev
sudo apt-get install python3-pip
sudo pip3 install watchdog
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
echo "deb http://repo.mongodb.org/apt/ubuntu "$(lsb_release -sc)"/mongodb-org/3.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

#PPA by nodesource
curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -
sudo apt-get install -y nodejs
