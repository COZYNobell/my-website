# Dockerfile

# 1. 베이스 이미지 선택 (Node.js 18 LTS Alpine 버전 권장 - 가볍고 보안에 좋음)
FROM node:18-alpine

# 2. 작업 디렉토리 설정 (컨테이너 내부 경로)
# 이 경로에 애플리케이션 코드가 복사되고, 여기서 명령이 실행됩니다.
WORKDIR /usr/src/app

# 3. package.json 및 package-lock.json (또는 npm-shrinkwrap.json) 복사
# 의존성 변경이 없을 경우 Docker 빌드 캐시를 활용하여 빌드 시간을 단축하기 위해
# 전체 소스 코드 복사 전에 먼저 복사하고 npm ci를 실행합니다.
COPY package*.json ./

# 4. 운영 환경용 의존성 패키지 설치
# npm ci는 package-lock.json을 사용하여 더 빠르고 안정적인 설치를 제공합니다.
# --omit=dev 옵션은 devDependencies를 제외하고 설치합니다 (이전 --production과 유사)
RUN npm ci --omit=dev 

# 5. 애플리케이션 소스 코드 전체 복사
# .dockerignore 파일에 명시된 파일 및 폴더는 제외됩니다.
COPY . .

# 6. 애플리케이션 실행 포트 노출 (실제 포트 매핑은 docker run 시 -p 옵션으로)
EXPOSE 3000

# 7. 애플리케이션 실행 명령어
# PM2를 컨테이너 내에서 사용하고 싶다면 pm2-runtime을 사용하는 것이 좋습니다.
# 이를 위해서는 Docker 이미지 빌드 시 PM2도 전역으로 설치해야 합니다.
# RUN npm install pm2 -g (npm ci 이후 또는 별도의 RUN 명령으로)
# CMD [ "pm2-runtime", "start", "server.js", "--name", "my-node-app" ]
#
# PM2 없이 Node.js로 직접 실행하려면:
CMD [ "node", "server.js" ]
