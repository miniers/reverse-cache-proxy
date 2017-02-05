FROM smebberson/alpine-nginx-nodejs
MAINTAINER miniers

ADD conf/node /node

RUN cd /node && \
    npm i 

ADD conf/nginx /etc/nginx

WORKDIR /node
CMD ["node", "index.js"]
