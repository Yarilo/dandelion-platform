#!/usr/bin/env bash
#Deployment script for Red Hat based distributions
sudo yum install -y mongodb-org #http://docs.mongodb.org/manual/tutorial/install-mongodb-on-red-hat/

#Node
curl -sL https://rpm.nodesource.com/setup | bash -
yum install -y nodejs
