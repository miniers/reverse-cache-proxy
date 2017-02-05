FROM smebberson/alpine-nginx-nodejs
MAINTAINER miniers

ADD conf/node /node

RUN cd /node && \
    npm i 

ADD conf/nginx /etc/nginx

WORKDIR /node

ADD conf/services.d/node /etc/services.d/node