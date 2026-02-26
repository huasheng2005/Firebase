FROM node:24-bookworm

# Tools
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git tar \
  && rm -rf /var/lib/apt/lists/*

# Install Java 21 (Temurin) and expose java on PATH
RUN mkdir -p /opt/java21 && \
  curl -fsSL -o /tmp/temurin21.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse" && \
  tar -xzf /tmp/temurin21.tar.gz -C /opt/java21 --strip-components=1 && \
  rm -f /tmp/temurin21.tar.gz && \
  ln -sf /opt/java21/bin/java /usr/local/bin/java && \
  ln -sf /opt/java21/bin/keytool /usr/local/bin/keytool || true

ENV JAVA_HOME=/opt/java21
ENV PATH="/opt/java21/bin:${PATH}"

# Firebase CLI
RUN npm install -g firebase-tools

WORKDIR /workspace

COPY functions/package.json functions/package-lock.json* ./functions/
RUN set -eux; \
  cd functions; \
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY . .

RUN npm run build --prefix functions

EXPOSE 4000 4400 4500 5001 8080 9099
CMD ["bash", "-lc", "java -version && firebase emulators:start --only functions,firestore,auth --project ${FIREBASE_PROJECT}"]
