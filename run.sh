sudo docker rm -f reverse-cache
sudo docker run -d --name reverse-cache \
                -p 1314:80 \
                -v $PWD/cache:/node/cache \
                miniers/reverse-proxy-cache