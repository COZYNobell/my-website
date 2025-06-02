# Dockerfile (개선된 최종 버전)

# 1. 베이스 이미지 선택 (Node.js 18 LTS - Alpine: 경량화 + 보안성 우수)
FROM node:18-alpine

# 2. 작업 디렉토리 설정 (컨테이너 내부 경로)
WORKDIR /usr/src/app

# 3. package.json 및 package-lock.json 복사
COPY package*.json ./

# 4. bcrypt 등 네이티브 모듈 설치를 위한 빌드 도구 설치 → 설치 후 삭제로 이미지 최소화
RUN apk add --no-cache python3 make g++ \
  && npm ci --omit=dev \
  && apk del python3 make g++

# 5. 애플리케이션 소스 코드 전체 복사
COPY . .

# 6. 애플리케이션 실행 포트 노출 (도커 외부에서 -p 80:3000 등으로 매핑)
EXPOSE 3000

# 7. 애플리케이션 실행 명령어
CMD [ "node", "server.js" ]
