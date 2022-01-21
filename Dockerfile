FROM node:17-buster
COPY . /app
WORKDIR /app
RUN npm i
#RUN npm run build
CMD npm run dev
