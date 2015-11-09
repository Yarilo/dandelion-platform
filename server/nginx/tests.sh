#!/usr/bin/env bash

echo "Making non-concurrent tests"

ab -n 100 -c 1 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 500 -c 1 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 1000 -c 1 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 10000 -c 1 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"

echo "Making concurrent tests"

ab -n 10000 -c 100 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 10000 -c 500 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 10000 -c 1000 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
ab -n 10000 -c 2000 -H "Accept-Encoding: gzip"  "http://127.0.0.1/api/resources/cabesilla.jpg?user=batman&password=test"
