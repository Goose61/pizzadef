FROM node:current-alpine

# Create app directory
WORKDIR /usr/src/app

COPY . .

RUN npm install

VOLUME /usr/src/app/data

CMD [ "node", "app" ]
