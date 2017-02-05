build:

docker build -t miniers/reverse-proxy-cache .


run:

docker run -d -p 1314:80 -v $PWD/cache:/node/cache miniers/reverse-proxy-cache
