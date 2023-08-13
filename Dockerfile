FROM node:18-buster
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser && mkdir -p /home/pptruser/Downloads && chown -R pptruser:pptruser /home/pptruser
COPY --chown=pptruser:pptruser . /home/pptruser/app
WORKDIR /home/pptruser/app
RUN mkdir -p /home/pptruser/app/config
RUN chown -R pptruser:pptruser /home/pptruser/app/config
USER pptruser
RUN npm install
RUN npm run build
CMD npm run start
