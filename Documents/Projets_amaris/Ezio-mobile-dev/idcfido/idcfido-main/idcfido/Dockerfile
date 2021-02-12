FROM node:10-alpine
  
RUN apk --no-cache add curl

#RUN apk add busybox-extras && busybox-extras telnet localhost 6900

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

COPY certbot-etc/live/fido.dbpdemo.com/privkey.pem ./
COPY certbot-etc/live/fido.dbpdemo.com/fullchain.pem ./

RUN chmod +r privkey.pem
RUN chmod +r fullchain.pem

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 8083

ENTRYPOINT ["/usr/local/bin/npm", "start"]
