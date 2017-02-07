sudo docker rm -f reverse-cache
sudo docker run -d --name reverse-cache \
                -v $PWD/cache:/node/cache miniers/reverse-proxy-cache \
                -p 1314:80
